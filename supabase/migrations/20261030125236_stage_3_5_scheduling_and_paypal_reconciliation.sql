-- Our Impact Stage 3.5
-- Five-minute period closing and webhook-independent PayPal Sandbox status
-- reconciliation. This migration never initiates a payout.

create extension if not exists pg_cron with schema pg_catalog;

alter table public.payment_transactions
  add column reconciliation_attempts integer not null default 0,
  add column last_reconciliation_attempt_at timestamptz,
  add column last_reconciliation_success_at timestamptz,
  add column next_reconcile_at timestamptz,
  add column last_reconciliation_error text;

alter table public.payment_transactions
  add constraint payment_transactions_reconciliation_attempts_nonnegative
    check (reconciliation_attempts >= 0) not valid,
  add constraint payment_transactions_reconciliation_error_length
    check (
      last_reconciliation_error is null
      or char_length(last_reconciliation_error) <= 80
    ) not valid;

alter table public.payment_transactions
  validate constraint payment_transactions_reconciliation_attempts_nonnegative;

alter table public.payment_transactions
  validate constraint payment_transactions_reconciliation_error_length;

comment on column public.payment_transactions.reconciliation_attempts is
  'Number of claimed PayPal status lookups. This does not count payout sends.';

comment on column public.payment_transactions.next_reconcile_at is
  'Earliest time a status-only PayPal reconciliation may claim this transaction.';

comment on column public.payment_transactions.last_reconciliation_error is
  'Bounded internal error code from the latest failed status lookup; contains no recipient data.';

create index payment_transactions_reconciliation_due_idx
  on public.payment_transactions (next_reconcile_at, updated_at, id)
  where environment = 'sandbox'
    and provider = 'paypal'
    and flow = 'payout'
    and provider_batch_id is not null
    and status in ('submitted', 'request_uncertain', 'pending', 'held', 'unclaimed');

create or replace function private.schedule_paypal_sandbox_reconciliation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.environment = 'sandbox'
    and new.provider = 'paypal'
    and new.flow = 'payout'
    and new.provider_batch_id is not null
    and new.status in ('submitted', 'request_uncertain', 'pending', 'held', 'unclaimed') then
    new.next_reconcile_at := coalesce(new.next_reconcile_at, now());
  else
    new.next_reconcile_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.schedule_paypal_sandbox_reconciliation()
  from public, anon, authenticated;

create trigger payment_transactions_schedule_reconciliation
before insert or update of provider_batch_id, status, next_reconcile_at
on public.payment_transactions
for each row execute function private.schedule_paypal_sandbox_reconciliation();

update public.payment_transactions
set next_reconcile_at = now()
where environment = 'sandbox'
  and provider = 'paypal'
  and flow = 'payout'
  and provider_batch_id is not null
  and status in ('submitted', 'request_uncertain', 'pending', 'held', 'unclaimed')
  and next_reconcile_at is null;

create or replace function public.claim_paypal_sandbox_reconciliations(
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table (
  payment_transaction_id uuid,
  provider_batch_id text,
  sender_item_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Reconciliation claim limit must be between 1 and 50.';
  end if;
  if p_lease_seconds < 60 or p_lease_seconds > 3600 then
    raise exception 'Reconciliation lease must be between 60 and 3600 seconds.';
  end if;

  return query
  with candidates as materialized (
    select payment_transactions.id
    from public.payment_transactions
    where payment_transactions.environment = 'sandbox'
      and payment_transactions.provider = 'paypal'
      and payment_transactions.flow = 'payout'
      and payment_transactions.provider_batch_id is not null
      and payment_transactions.status in (
        'submitted', 'request_uncertain', 'pending', 'held', 'unclaimed'
      )
      and payment_transactions.next_reconcile_at <= now()
    order by
      payment_transactions.next_reconcile_at,
      payment_transactions.updated_at,
      payment_transactions.id
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.payment_transactions
    set
      reconciliation_attempts = public.payment_transactions.reconciliation_attempts + 1,
      last_reconciliation_attempt_at = now(),
      next_reconcile_at = now() + make_interval(secs => p_lease_seconds),
      last_reconciliation_error = null
    from candidates
    where public.payment_transactions.id = candidates.id
    returning
      public.payment_transactions.id,
      public.payment_transactions.provider_batch_id,
      public.payment_transactions.sender_item_id
  )
  select claimed.id, claimed.provider_batch_id, claimed.sender_item_id
  from claimed;
end;
$$;

create or replace function public.record_paypal_sandbox_reconciliation(
  p_payment_transaction_id uuid,
  p_provider_batch_id text,
  p_provider_item_id text default null,
  p_sender_item_id text default null,
  p_batch_status text default null,
  p_item_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_row public.payment_transactions%rowtype;
  current_donation_status text;
  current_transaction_status text;
  next_transaction_status text;
  target_donation_status text;
  normalized_batch_status text := upper(
    coalesce(nullif(trim(p_batch_status), ''), 'UNKNOWN')
  );
  normalized_item_status text := upper(
    coalesce(nullif(trim(p_item_status), ''), 'UNKNOWN')
  );
  transaction_state_changed boolean := false;
  donation_state_changed boolean := false;
  reconciliation_evidence_reference text;
begin
  if p_payment_transaction_id is null then
    raise exception 'A payment transaction is required for reconciliation.';
  end if;
  if nullif(trim(p_provider_batch_id), '') is null then
    raise exception 'A PayPal batch ID is required for reconciliation.';
  end if;

  select * into transaction_row
  from public.payment_transactions
  where id = p_payment_transaction_id
  for update;

  if transaction_row.id is null then
    raise exception 'Payment transaction not found.';
  end if;
  if transaction_row.environment <> 'sandbox'
    or transaction_row.provider <> 'paypal'
    or transaction_row.flow <> 'payout' then
    raise exception 'Only PayPal Sandbox payouts can be reconciled.';
  end if;
  if transaction_row.provider_batch_id is distinct from trim(p_provider_batch_id) then
    raise exception 'PayPal batch ID does not match the reserved transaction.';
  end if;
  if nullif(trim(p_sender_item_id), '') is not null
    and transaction_row.sender_item_id is distinct from trim(p_sender_item_id) then
    raise exception 'PayPal sender item ID does not match the reserved transaction.';
  end if;

  current_transaction_status := transaction_row.status;
  next_transaction_status := current_transaction_status;

  if normalized_item_status in ('SUCCESS', 'SUCCEEDED') then
    next_transaction_status := 'succeeded';
  elsif normalized_item_status in ('PENDING', 'PROCESSING') then
    next_transaction_status := 'pending';
  elsif normalized_item_status in ('HELD', 'ONHOLD') then
    next_transaction_status := 'held';
  elsif normalized_item_status = 'UNCLAIMED' then
    next_transaction_status := 'unclaimed';
  elsif normalized_item_status in ('FAILED', 'DENIED', 'BLOCKED') then
    next_transaction_status := 'failed';
  elsif normalized_item_status = 'REFUNDED' then
    next_transaction_status := 'refunded';
  elsif normalized_item_status in ('RETURNED', 'REVERSED') then
    next_transaction_status := 'returned';
  elsif normalized_item_status = 'CANCELED' then
    next_transaction_status := 'canceled';
  end if;

  -- Never let a late or stale poll regress terminal evidence.
  if current_transaction_status in ('refunded', 'returned') then
    next_transaction_status := current_transaction_status;
  elsif current_transaction_status = 'succeeded'
    and next_transaction_status not in ('refunded', 'returned') then
    next_transaction_status := current_transaction_status;
  end if;

  transaction_state_changed :=
    next_transaction_status is distinct from current_transaction_status;

  update public.payment_transactions
  set
    provider_item_id = coalesce(
      nullif(trim(p_provider_item_id), ''),
      provider_item_id
    ),
    provider_status = case
      when normalized_item_status <> 'UNKNOWN' then normalized_item_status
      when normalized_batch_status <> 'UNKNOWN' then normalized_batch_status
      else provider_status
    end,
    status = next_transaction_status,
    completed_at = case
      when next_transaction_status in (
        'succeeded', 'failed', 'refunded', 'returned', 'canceled'
      ) then coalesce(completed_at, now())
      else completed_at
    end,
    last_reconciliation_success_at = now(),
    last_reconciliation_error = case
      when normalized_item_status = 'UNKNOWN'
        then 'paypal_item_status_missing'
      else null
    end,
    next_reconcile_at = case
      when next_transaction_status in (
        'succeeded', 'failed', 'refunded', 'returned', 'canceled'
      ) then null
      when next_transaction_status = 'unclaimed' then now() + interval '6 hours'
      when next_transaction_status = 'held' then now() + interval '30 minutes'
      when normalized_item_status = 'UNKNOWN' then now() + interval '15 minutes'
      else now() + interval '5 minutes'
    end
  where id = transaction_row.id;

  reconciliation_evidence_reference := 'paypal-sandbox:' || coalesce(
    nullif(trim(p_provider_item_id), ''),
    transaction_row.provider_item_id,
    transaction_row.provider_batch_id,
    transaction_row.sender_batch_id
  );

  if normalized_item_status in ('SUCCESS', 'SUCCEEDED') then
    target_donation_status := 'confirmed_paid';
  elsif normalized_item_status in (
    'PENDING', 'PROCESSING', 'HELD', 'ONHOLD', 'UNCLAIMED'
  ) then
    target_donation_status := 'payment_pending';
  elsif normalized_item_status in ('FAILED', 'DENIED', 'BLOCKED') then
    target_donation_status := 'payment_failed';
  elsif normalized_item_status in ('REFUNDED', 'RETURNED', 'REVERSED') then
    target_donation_status := 'requires_reconciliation';
  elsif normalized_item_status = 'CANCELED' then
    select status into current_donation_status
    from public.donation_records
    where id = transaction_row.donation_record_id
    for update;

    target_donation_status := case
      when current_donation_status = 'confirmed_paid' then 'requires_reconciliation'
      else 'canceled'
    end;
  end if;

  if target_donation_status is not null then
    if current_donation_status is null then
      select status into current_donation_status
      from public.donation_records
      where id = transaction_row.donation_record_id
      for update;
    end if;

    if target_donation_status is distinct from current_donation_status
      and (
        target_donation_status = 'requires_reconciliation'
        or (target_donation_status = 'confirmed_paid'
          and current_donation_status in (
            'approved_for_payment', 'payment_pending', 'payment_failed',
            'requires_reconciliation'
          ))
        or (target_donation_status = 'payment_pending'
          and current_donation_status in ('approved_for_payment', 'payment_failed'))
        or (target_donation_status = 'payment_failed'
          and current_donation_status in (
            'approved_for_payment', 'payment_pending', 'payment_failed'
          ))
        or (target_donation_status = 'canceled'
          and current_donation_status in (
            'approved_for_payment', 'payment_pending', 'payment_failed'
          ))
      ) then
      update public.donation_records
      set
        status = target_donation_status,
        environment = 'sandbox',
        current_note = 'Updated from PayPal Sandbox status reconciliation: '
          || normalized_item_status,
        evidence_reference = reconciliation_evidence_reference
      where id = transaction_row.donation_record_id;

      insert into public.donation_status_events (
        donation_record_id,
        actor_user_id,
        from_status,
        to_status,
        note,
        evidence_reference
      ) values (
        transaction_row.donation_record_id,
        null,
        current_donation_status,
        target_donation_status,
        'PayPal Sandbox status reconciliation: ' || normalized_item_status,
        reconciliation_evidence_reference
      );

      donation_state_changed := true;
    end if;
  end if;

  if transaction_state_changed or donation_state_changed then
    insert into public.audit_events (
      company_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      transaction_row.company_id,
      null,
      'paypal_sandbox.reconciliation_applied',
      'payment_transaction',
      transaction_row.id,
      jsonb_build_object(
        'batch_status', normalized_batch_status,
        'item_status', normalized_item_status,
        'from_transaction_status', current_transaction_status,
        'to_transaction_status', next_transaction_status,
        'from_donation_status', current_donation_status,
        'to_donation_status', target_donation_status,
        'environment', 'sandbox'
      )
    );
  end if;

  return jsonb_build_object(
    'status', case
      when transaction_state_changed or donation_state_changed then 'applied'
      else 'no_change'
    end,
    'payment_transaction_id', transaction_row.id,
    'transaction_status', next_transaction_status,
    'donation_status', target_donation_status,
    'batch_status', normalized_batch_status,
    'item_status', normalized_item_status
  );
end;
$$;

create or replace function public.record_paypal_sandbox_reconciliation_error(
  p_payment_transaction_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_row public.payment_transactions%rowtype;
  bounded_error text;
begin
  if p_payment_transaction_id is null then
    raise exception 'A payment transaction is required for reconciliation.';
  end if;

  bounded_error := left(
    coalesce(nullif(trim(p_error_code), ''), 'paypal_reconciliation_failed'),
    80
  );

  select * into transaction_row
  from public.payment_transactions
  where id = p_payment_transaction_id
  for update;

  if transaction_row.id is null then
    raise exception 'Payment transaction not found.';
  end if;
  if transaction_row.environment <> 'sandbox'
    or transaction_row.provider <> 'paypal'
    or transaction_row.flow <> 'payout' then
    raise exception 'Only PayPal Sandbox payouts can be reconciled.';
  end if;

  update public.payment_transactions
  set
    last_reconciliation_error = bounded_error,
    next_reconcile_at = now() + case
      when reconciliation_attempts <= 1 then interval '5 minutes'
      when reconciliation_attempts <= 3 then interval '15 minutes'
      else interval '1 hour'
    end
  where id = transaction_row.id;

  return jsonb_build_object(
    'status', 'retry_scheduled',
    'payment_transaction_id', transaction_row.id,
    'error_code', bounded_error
  );
end;
$$;

revoke all on function public.claim_paypal_sandbox_reconciliations(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_paypal_sandbox_reconciliations(integer, integer)
  to service_role;

revoke all on function public.record_paypal_sandbox_reconciliation(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_paypal_sandbox_reconciliation(
  uuid, text, text, text, text, text
) to service_role;

revoke all on function public.record_paypal_sandbox_reconciliation_error(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_paypal_sandbox_reconciliation_error(uuid, text)
  to service_role;

-- Job names are stable: rerunning cron.schedule with the same name updates the
-- existing job instead of creating duplicates.
select cron.schedule(
  'our-impact-close-due-periods',
  '*/5 * * * *',
  'select public.close_due_campaign_periods(100);'
);

-- pg_cron does not automatically prune run history.
select cron.schedule(
  'our-impact-cron-history-cleanup',
  '15 2 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '14 days'$$
);
