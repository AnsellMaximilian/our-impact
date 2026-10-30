-- Our Impact Stage 3
-- PayPal Sandbox payouts, verified webhook reconciliation, and explicit
-- separation between sandbox evidence and live money movement.

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  campaign_id uuid not null,
  donation_record_id uuid not null unique
    references public.donation_records (id) on delete restrict,
  provider text not null default 'paypal',
  environment text not null default 'sandbox',
  flow text not null default 'payout',
  status text not null default 'reserved',
  sender_batch_id text not null unique,
  sender_item_id text not null unique,
  provider_batch_id text,
  provider_item_id text,
  provider_status text,
  amount_minor bigint not null,
  currency text not null,
  recipient_type text not null default 'EMAIL',
  recipient_reference_masked text not null,
  request_payload_hash text,
  request_attempts integer not null default 0,
  last_error_code text,
  initiated_by uuid references auth.users (id) on delete set null,
  requested_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_transactions_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint payment_transactions_provider check (provider = 'paypal'),
  constraint payment_transactions_environment check (environment = 'sandbox'),
  constraint payment_transactions_flow check (flow = 'payout'),
  constraint payment_transactions_status check (
    status in (
      'reserved',
      'submitted',
      'request_failed',
      'request_uncertain',
      'pending',
      'held',
      'unclaimed',
      'succeeded',
      'failed',
      'refunded',
      'returned',
      'canceled'
    )
  ),
  constraint payment_transactions_sender_batch_length check (
    char_length(sender_batch_id) between 1 and 30
  ),
  constraint payment_transactions_sender_item_length check (
    char_length(sender_item_id) between 1 and 30
  ),
  constraint payment_transactions_amount_positive check (amount_minor > 0),
  constraint payment_transactions_currency check (currency ~ '^[A-Z]{3}$'),
  constraint payment_transactions_recipient_type check (recipient_type = 'EMAIL'),
  constraint payment_transactions_masked_recipient_length check (
    char_length(recipient_reference_masked) between 3 and 254
  ),
  constraint payment_transactions_request_hash check (
    request_payload_hash is null or request_payload_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint payment_transactions_attempts_nonnegative check (request_attempts >= 0),
  constraint payment_transactions_error_code_length check (
    last_error_code is null or char_length(last_error_code) <= 80
  )
);

create unique index payment_transactions_provider_batch_uidx
  on public.payment_transactions (provider_batch_id)
  where provider_batch_id is not null;

create unique index payment_transactions_provider_item_uidx
  on public.payment_transactions (provider_item_id)
  where provider_item_id is not null;

create index payment_transactions_company_created_idx
  on public.payment_transactions (company_id, created_at desc);

create index payment_transactions_campaign_created_idx
  on public.payment_transactions (campaign_id, created_at desc);

create index payment_transactions_initiated_by_idx
  on public.payment_transactions (initiated_by)
  where initiated_by is not null;

create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_transaction_id uuid
    references public.payment_transactions (id) on delete restrict,
  company_id uuid references public.companies (id) on delete restrict,
  provider text not null default 'paypal',
  environment text not null default 'sandbox',
  provider_event_id text not null unique,
  transmission_id text not null,
  event_type text not null,
  provider_resource_id text,
  provider_batch_id text,
  provider_item_id text,
  sender_item_id text,
  resource_status text,
  verification_status text not null default 'success',
  processing_status text not null default 'received',
  payload_hash text not null,
  event_summary jsonb not null default '{}'::jsonb,
  delivery_count integer not null default 1,
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error_code text,
  constraint payment_events_provider check (provider = 'paypal'),
  constraint payment_events_environment check (environment = 'sandbox'),
  constraint payment_events_event_id_length check (
    char_length(provider_event_id) between 3 and 255
  ),
  constraint payment_events_transmission_id_length check (
    char_length(transmission_id) between 3 and 255
  ),
  constraint payment_events_type_length check (char_length(event_type) between 3 and 120),
  constraint payment_events_verification check (verification_status = 'success'),
  constraint payment_events_processing_status check (
    processing_status in (
      'received',
      'processed',
      'duplicate',
      'unmatched',
      'batch_only',
      'matched_no_change',
      'ignored'
    )
  ),
  constraint payment_events_payload_hash check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint payment_events_summary_object check (jsonb_typeof(event_summary) = 'object'),
  constraint payment_events_delivery_count_positive check (delivery_count > 0),
  constraint payment_events_error_code_length check (
    processing_error_code is null or char_length(processing_error_code) <= 80
  )
);

create index payment_events_transaction_received_idx
  on public.payment_events (payment_transaction_id, first_received_at desc)
  where payment_transaction_id is not null;

create index payment_events_company_received_idx
  on public.payment_events (company_id, first_received_at desc)
  where company_id is not null;

create index payment_events_provider_batch_idx
  on public.payment_events (provider_batch_id)
  where provider_batch_id is not null;

create index payment_events_provider_item_idx
  on public.payment_events (provider_item_id)
  where provider_item_id is not null;

create index payment_events_sender_item_idx
  on public.payment_events (sender_item_id)
  where sender_item_id is not null;

alter table public.payment_transactions enable row level security;
alter table public.payment_events enable row level security;

create policy "payment_transactions_select_member"
on public.payment_transactions for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = payment_transactions.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "payment_events_select_member"
on public.payment_events for select
to authenticated
using (
  company_id is not null
  and exists (
    select 1
    from public.memberships
    where memberships.company_id = payment_events.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row execute function private.set_updated_at();

create trigger payment_events_immutable
before delete on public.payment_events
for each row execute function private.reject_immutable_ledger_mutation();

create or replace function public.reserve_paypal_sandbox_payout(
  p_donation_record_id uuid,
  p_recipient_reference_masked text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  donation_row public.donation_records%rowtype;
  transaction_row public.payment_transactions%rowtype;
  new_transaction_id uuid;
  generated_sender_id text;
  previous_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_recipient_reference_masked is null
    or char_length(trim(p_recipient_reference_masked)) not between 3 and 254 then
    raise exception 'A masked sandbox recipient reference is required.';
  end if;

  select * into donation_row
  from public.donation_records
  where id = p_donation_record_id
  for update;

  if donation_row.id is null then
    raise exception 'Donation record not found.';
  end if;
  if not exists (
    select 1
    from public.memberships
    where memberships.company_id = donation_row.company_id
      and memberships.user_id = actor_id
      and memberships.role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access is required.';
  end if;

  select * into transaction_row
  from public.payment_transactions
  where donation_record_id = p_donation_record_id
  for update;

  if transaction_row.id is not null
    and transaction_row.status not in ('request_failed', 'request_uncertain', 'failed') then
    return jsonb_build_object(
      'status', 'already_reserved',
      'dispatch_allowed', false,
      'transaction_id', transaction_row.id,
      'sender_batch_id', transaction_row.sender_batch_id,
      'sender_item_id', transaction_row.sender_item_id,
      'amount_minor', transaction_row.amount_minor,
      'currency', transaction_row.currency
    );
  end if;

  if donation_row.status not in ('approved_for_payment', 'payment_failed', 'requires_reconciliation') then
    raise exception 'Approve this allocation before starting a sandbox payout.';
  end if;

  previous_status := donation_row.status;

  if transaction_row.id is null then
    new_transaction_id := gen_random_uuid();
    generated_sender_id := 'oi-' || left(replace(new_transaction_id::text, '-', ''), 27);

    insert into public.payment_transactions (
      id,
      company_id,
      campaign_id,
      donation_record_id,
      sender_batch_id,
      sender_item_id,
      amount_minor,
      currency,
      recipient_reference_masked,
      request_attempts,
      initiated_by
    ) values (
      new_transaction_id,
      donation_row.company_id,
      donation_row.campaign_id,
      donation_row.id,
      generated_sender_id,
      generated_sender_id,
      donation_row.amount_minor,
      donation_row.currency,
      trim(p_recipient_reference_masked),
      1,
      actor_id
    )
    returning * into transaction_row;
  else
    update public.payment_transactions
    set
      status = 'reserved',
      recipient_reference_masked = trim(p_recipient_reference_masked),
      request_attempts = request_attempts + 1,
      last_error_code = null,
      initiated_by = actor_id
    where id = transaction_row.id
    returning * into transaction_row;
  end if;

  update public.donation_records
  set
    status = 'payment_pending',
    environment = 'sandbox',
    current_note = 'PayPal Sandbox payout reserved; no live funds are involved.',
    evidence_reference = 'paypal-sandbox:' || transaction_row.sender_batch_id
  where id = donation_row.id;

  if previous_status <> 'payment_pending' then
    insert into public.donation_status_events (
      donation_record_id,
      actor_user_id,
      from_status,
      to_status,
      note,
      evidence_reference
    ) values (
      donation_row.id,
      actor_id,
      previous_status,
      'payment_pending',
      'PayPal Sandbox payout reserved; no live funds are involved.',
      'paypal-sandbox:' || transaction_row.sender_batch_id
    );
  end if;

  insert into public.audit_events (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    donation_row.company_id,
    actor_id,
    'paypal_sandbox.payout_reserved',
    'payment_transaction',
    transaction_row.id,
    jsonb_build_object(
      'donation_record_id', donation_row.id,
      'sender_batch_id', transaction_row.sender_batch_id,
      'attempt', transaction_row.request_attempts,
      'environment', 'sandbox'
    )
  );

  return jsonb_build_object(
    'status', 'reserved',
    'dispatch_allowed', true,
    'transaction_id', transaction_row.id,
    'sender_batch_id', transaction_row.sender_batch_id,
    'sender_item_id', transaction_row.sender_item_id,
    'amount_minor', transaction_row.amount_minor,
    'currency', transaction_row.currency
  );
end;
$$;

create or replace function public.record_paypal_sandbox_request_result(
  p_payment_transaction_id uuid,
  p_outcome text,
  p_provider_batch_id text default null,
  p_provider_status text default null,
  p_request_payload_hash text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_row public.payment_transactions%rowtype;
  previous_donation_status text;
  next_donation_status text;
  next_transaction_status text;
begin
  if p_outcome not in ('accepted', 'rejected', 'uncertain') then
    raise exception 'Unknown sandbox request outcome.';
  end if;
  if p_outcome = 'accepted' and nullif(trim(p_provider_batch_id), '') is null then
    raise exception 'Accepted sandbox payouts require a PayPal batch ID.';
  end if;
  if p_request_payload_hash is not null
    and p_request_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid request payload hash.';
  end if;

  select * into transaction_row
  from public.payment_transactions
  where id = p_payment_transaction_id
  for update;

  if transaction_row.id is null then
    raise exception 'Payment transaction not found.';
  end if;

  select status into previous_donation_status
  from public.donation_records
  where id = transaction_row.donation_record_id
  for update;

  if p_outcome = 'accepted' then
    next_transaction_status := 'submitted';
    next_donation_status := 'payment_pending';
  elsif p_outcome = 'rejected' then
    next_transaction_status := 'request_failed';
    next_donation_status := 'payment_failed';
  else
    next_transaction_status := 'request_uncertain';
    next_donation_status := 'requires_reconciliation';
  end if;

  update public.payment_transactions
  set
    status = next_transaction_status,
    provider_batch_id = coalesce(nullif(trim(p_provider_batch_id), ''), provider_batch_id),
    provider_status = coalesce(nullif(trim(p_provider_status), ''), provider_status),
    request_payload_hash = coalesce(p_request_payload_hash, request_payload_hash),
    last_error_code = case
      when p_outcome = 'accepted' then null
      else left(coalesce(nullif(trim(p_error_code), ''), 'paypal_request_failed'), 80)
    end,
    requested_at = case when p_outcome = 'accepted' then now() else requested_at end
  where id = transaction_row.id;

  if previous_donation_status is distinct from next_donation_status then
    update public.donation_records
    set
      status = next_donation_status,
      current_note = case p_outcome
        when 'rejected' then 'PayPal Sandbox rejected the payout request.'
        when 'uncertain' then 'PayPal Sandbox request outcome is uncertain; reconciliation is required.'
        else 'PayPal Sandbox accepted the payout batch; awaiting a verified item webhook.'
      end,
      evidence_reference = 'paypal-sandbox:' || coalesce(
        nullif(trim(p_provider_batch_id), ''),
        transaction_row.sender_batch_id
      )
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
      previous_donation_status,
      next_donation_status,
      case p_outcome
        when 'rejected' then 'PayPal Sandbox rejected the payout request.'
        when 'uncertain' then 'PayPal Sandbox request outcome is uncertain; reconciliation is required.'
        else 'PayPal Sandbox accepted the payout batch; awaiting a verified item webhook.'
      end,
      'paypal-sandbox:' || coalesce(
        nullif(trim(p_provider_batch_id), ''),
        transaction_row.sender_batch_id
      )
    );
  end if;

  insert into public.audit_events (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    transaction_row.company_id,
    transaction_row.initiated_by,
    'paypal_sandbox.request_' || p_outcome,
    'payment_transaction',
    transaction_row.id,
    jsonb_build_object(
      'outcome', p_outcome,
      'provider_batch_id', p_provider_batch_id,
      'provider_status', p_provider_status,
      'environment', 'sandbox'
    )
  );

  return jsonb_build_object(
    'status', next_transaction_status,
    'payment_transaction_id', transaction_row.id,
    'donation_status', next_donation_status
  );
end;
$$;

create or replace function public.record_verified_paypal_webhook(
  p_provider_event_id text,
  p_transmission_id text,
  p_event_type text,
  p_provider_resource_id text default null,
  p_provider_batch_id text default null,
  p_provider_item_id text default null,
  p_sender_item_id text default null,
  p_resource_status text default null,
  p_payload_hash text default null,
  p_event_summary jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_event_id bigint;
  existing_event_id bigint;
  transaction_row public.payment_transactions%rowtype;
  current_donation_status text;
  target_donation_status text;
  normalized_status text := upper(coalesce(nullif(trim(p_resource_status), ''), 'UNKNOWN'));
  item_event boolean := p_event_type like 'PAYMENT.PAYOUTS-ITEM.%';
  state_changed boolean := false;
  event_processing_status text;
  next_transaction_status text;
begin
  if nullif(trim(p_provider_event_id), '') is null
    or nullif(trim(p_transmission_id), '') is null
    or nullif(trim(p_event_type), '') is null then
    raise exception 'Verified PayPal event identifiers are required.';
  end if;
  if p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PayPal event payload hash.';
  end if;
  if jsonb_typeof(coalesce(p_event_summary, '{}'::jsonb)) <> 'object' then
    raise exception 'PayPal event summary must be a JSON object.';
  end if;

  insert into public.payment_events (
    provider_event_id,
    transmission_id,
    event_type,
    provider_resource_id,
    provider_batch_id,
    provider_item_id,
    sender_item_id,
    resource_status,
    payload_hash,
    event_summary
  ) values (
    trim(p_provider_event_id),
    trim(p_transmission_id),
    trim(p_event_type),
    nullif(trim(p_provider_resource_id), ''),
    nullif(trim(p_provider_batch_id), ''),
    nullif(trim(p_provider_item_id), ''),
    nullif(trim(p_sender_item_id), ''),
    nullif(trim(p_resource_status), ''),
    p_payload_hash,
    coalesce(p_event_summary, '{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    update public.payment_events
    set
      delivery_count = delivery_count + 1,
      last_received_at = now()
    where provider_event_id = trim(p_provider_event_id)
    returning id into existing_event_id;

    return jsonb_build_object(
      'status', 'duplicate',
      'payment_event_id', existing_event_id
    );
  end if;

  select * into transaction_row
  from public.payment_transactions
  where
    (p_provider_item_id is not null and provider_item_id = p_provider_item_id)
    or (p_sender_item_id is not null and sender_item_id = p_sender_item_id)
    or (p_provider_batch_id is not null and provider_batch_id = p_provider_batch_id)
  order by
    case
      when p_provider_item_id is not null and provider_item_id = p_provider_item_id then 1
      when p_sender_item_id is not null and sender_item_id = p_sender_item_id then 2
      else 3
    end
  limit 1
  for update;

  if transaction_row.id is null then
    update public.payment_events
    set processing_status = 'unmatched', processed_at = now()
    where id = inserted_event_id;

    return jsonb_build_object(
      'status', 'unmatched',
      'payment_event_id', inserted_event_id
    );
  end if;

  if normalized_status in ('SUCCESS', 'SUCCEEDED') then
    next_transaction_status := 'succeeded';
  elsif normalized_status in ('PENDING', 'PROCESSING') then
    next_transaction_status := 'pending';
  elsif normalized_status = 'HELD' then
    next_transaction_status := 'held';
  elsif normalized_status = 'UNCLAIMED' then
    next_transaction_status := 'unclaimed';
  elsif normalized_status in ('FAILED', 'DENIED', 'BLOCKED') then
    next_transaction_status := 'failed';
  elsif normalized_status = 'REFUNDED' then
    next_transaction_status := 'refunded';
  elsif normalized_status = 'RETURNED' then
    next_transaction_status := 'returned';
  elsif normalized_status = 'CANCELED' then
    next_transaction_status := 'canceled';
  else
    next_transaction_status := transaction_row.status;
  end if;

  -- Batch-level success does not prove that an individual payout succeeded.
  if not item_event then
    next_transaction_status := transaction_row.status;
  elsif transaction_row.status in ('refunded', 'returned') then
    next_transaction_status := transaction_row.status;
  elsif transaction_row.status = 'succeeded'
    and next_transaction_status not in ('refunded', 'returned') then
    next_transaction_status := transaction_row.status;
  end if;

  update public.payment_transactions
  set
    provider_batch_id = coalesce(nullif(trim(p_provider_batch_id), ''), provider_batch_id),
    provider_item_id = coalesce(nullif(trim(p_provider_item_id), ''), provider_item_id),
    provider_status = normalized_status,
    status = next_transaction_status,
    completed_at = case
      when next_transaction_status in ('succeeded', 'failed', 'refunded', 'returned', 'canceled')
        then coalesce(completed_at, now())
      else completed_at
    end,
    last_error_code = case
      when next_transaction_status in ('failed', 'refunded', 'returned', 'canceled')
        then lower(next_transaction_status)
      else last_error_code
    end
  where id = transaction_row.id;

  update public.payment_events
  set
    payment_transaction_id = transaction_row.id,
    company_id = transaction_row.company_id
  where id = inserted_event_id;

  if not item_event then
    event_processing_status := 'batch_only';
  else
    select status into current_donation_status
    from public.donation_records
    where id = transaction_row.donation_record_id
    for update;

    if normalized_status in ('SUCCESS', 'SUCCEEDED') then
      target_donation_status := 'confirmed_paid';
    elsif normalized_status in ('PENDING', 'PROCESSING', 'HELD', 'UNCLAIMED') then
      target_donation_status := 'payment_pending';
    elsif normalized_status in ('FAILED', 'DENIED', 'BLOCKED') then
      target_donation_status := 'payment_failed';
    elsif normalized_status in ('REFUNDED', 'RETURNED') then
      target_donation_status := 'requires_reconciliation';
    elsif normalized_status = 'CANCELED' then
      target_donation_status := case
        when current_donation_status = 'confirmed_paid' then 'requires_reconciliation'
        else 'canceled'
      end;
    end if;

    if target_donation_status is not null
      and target_donation_status is distinct from current_donation_status
      and (
        target_donation_status = 'requires_reconciliation'
        or (target_donation_status = 'confirmed_paid'
          and current_donation_status in (
            'approved_for_payment', 'payment_pending', 'payment_failed', 'requires_reconciliation'
          ))
        or (target_donation_status = 'payment_pending'
          and current_donation_status in ('approved_for_payment', 'payment_failed'))
        or (target_donation_status = 'payment_failed'
          and current_donation_status in ('approved_for_payment', 'payment_pending', 'payment_failed'))
        or (target_donation_status = 'canceled'
          and current_donation_status in ('approved_for_payment', 'payment_pending', 'payment_failed'))
      ) then
      update public.donation_records
      set
        status = target_donation_status,
        environment = 'sandbox',
        current_note = 'Updated from a verified PayPal Sandbox webhook: ' || p_event_type,
        evidence_reference = 'paypal-sandbox:' || coalesce(
          nullif(trim(p_provider_item_id), ''),
          nullif(trim(p_provider_batch_id), ''),
          transaction_row.sender_batch_id
        )
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
        'Verified PayPal Sandbox webhook: ' || p_event_type,
        'paypal-sandbox:' || coalesce(
          nullif(trim(p_provider_item_id), ''),
          nullif(trim(p_provider_batch_id), ''),
          transaction_row.sender_batch_id
        )
      );

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
        'paypal_sandbox.webhook_applied',
        'payment_transaction',
        transaction_row.id,
        jsonb_build_object(
          'provider_event_id', p_provider_event_id,
          'event_type', p_event_type,
          'from_status', current_donation_status,
          'to_status', target_donation_status,
          'environment', 'sandbox'
        )
      );

      state_changed := true;
    end if;

    event_processing_status := case
      when state_changed then 'processed'
      when target_donation_status is null then 'ignored'
      else 'matched_no_change'
    end;
  end if;

  update public.payment_events
  set processing_status = event_processing_status, processed_at = now()
  where id = inserted_event_id;

  return jsonb_build_object(
    'status', event_processing_status,
    'payment_event_id', inserted_event_id,
    'payment_transaction_id', transaction_row.id,
    'state_changed', state_changed
  );
end;
$$;

-- Sandbox records may only be advanced by the PayPal request/webhook functions.
create or replace function public.record_donation_status(
  p_donation_record_id uuid,
  p_status text,
  p_note text default null,
  p_evidence_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_company_id uuid;
  previous_status text;
  selected_environment text;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Notes must be 1000 characters or fewer.';
  end if;
  if p_evidence_reference is not null
    and char_length(p_evidence_reference) > 500 then
    raise exception 'Evidence references must be 500 characters or fewer.';
  end if;

  select company_id, status, environment
    into selected_company_id, previous_status, selected_environment
  from public.donation_records
  where id = p_donation_record_id
  for update;

  if selected_company_id is null then
    raise exception 'Donation record not found.';
  end if;
  if not exists (
    select 1
    from public.memberships
    where memberships.company_id = selected_company_id
      and memberships.user_id = actor_id
      and memberships.role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access is required.';
  end if;
  if selected_environment = 'sandbox' then
    raise exception 'Sandbox payment statuses are controlled by verified PayPal events.';
  end if;
  if p_status = previous_status then
    raise exception 'Choose a different status.';
  end if;
  if not (
    (previous_status = 'allocated' and p_status in ('approved_for_payment', 'canceled'))
    or (previous_status = 'approved_for_payment' and p_status in ('payment_pending', 'canceled'))
    or (previous_status = 'payment_pending' and p_status in (
      'confirmed_paid', 'payment_failed', 'requires_reconciliation'
    ))
    or (previous_status = 'payment_failed' and p_status in (
      'payment_pending', 'canceled', 'requires_reconciliation'
    ))
    or (previous_status = 'confirmed_paid' and p_status = 'requires_reconciliation')
    or (previous_status = 'requires_reconciliation' and p_status in (
      'confirmed_paid', 'payment_failed', 'canceled'
    ))
  ) then
    raise exception 'That donation status transition is not allowed.';
  end if;

  update public.donation_records
  set
    status = p_status,
    current_note = nullif(trim(p_note), ''),
    evidence_reference = coalesce(
      nullif(trim(p_evidence_reference), ''),
      evidence_reference
    )
  where id = p_donation_record_id;

  insert into public.donation_status_events (
    donation_record_id,
    actor_user_id,
    from_status,
    to_status,
    note,
    evidence_reference
  ) values (
    p_donation_record_id,
    actor_id,
    previous_status,
    p_status,
    nullif(trim(p_note), ''),
    nullif(trim(p_evidence_reference), '')
  );

  insert into public.audit_events (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    selected_company_id,
    actor_id,
    'donation.status_changed',
    'donation_record',
    p_donation_record_id,
    jsonb_build_object(
      'from_status', previous_status,
      'to_status', p_status,
      'environment', selected_environment,
      'has_evidence_reference', nullif(trim(p_evidence_reference), '') is not null
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'donation_record_id', p_donation_record_id,
    'from_status', previous_status,
    'to_status', p_status
  );
end;
$$;

drop function public.get_campaign_public_ledger(text);

create function public.get_campaign_public_ledger(p_public_id text)
returns table (
  snapshot_id uuid,
  period_id uuid,
  period_sequence integer,
  period_closed_at timestamptz,
  allocation_state text,
  snapshot_revision integer,
  total_valid_votes bigint,
  budget_minor bigint,
  allocated_minor bigint,
  unallocated_minor bigint,
  currency text,
  allocation_model text,
  organization_id bigint,
  vote_count bigint,
  amount_minor bigint,
  donation_status text,
  donation_environment text,
  confirmed_paid_minor bigint,
  simulation_confirmed_minor bigint,
  sandbox_confirmed_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_snapshot as (
    select
      allocation_snapshots.*,
      campaign_periods.sequence_number,
      campaign_periods.closed_at
    from public.campaigns
    join public.campaign_periods
      on campaign_periods.campaign_id = campaigns.id
    join public.allocation_snapshots
      on allocation_snapshots.period_id = campaign_periods.id
    where campaigns.public_id = p_public_id
      and (
        campaigns.status = 'published'
        or exists (
          select 1
          from public.memberships
          where memberships.company_id = campaigns.company_id
            and memberships.user_id = (select auth.uid())
        )
      )
    order by
      campaign_periods.sequence_number desc,
      allocation_snapshots.revision desc
    limit 1
  )
  select
    selected_snapshot.id,
    selected_snapshot.period_id,
    selected_snapshot.sequence_number,
    selected_snapshot.closed_at,
    selected_snapshot.state,
    selected_snapshot.revision,
    selected_snapshot.total_valid_votes,
    selected_snapshot.budget_minor,
    selected_snapshot.allocated_minor,
    selected_snapshot.unallocated_minor,
    selected_snapshot.currency,
    selected_snapshot.allocation_model,
    allocation_lines.organization_id,
    allocation_lines.vote_count,
    allocation_lines.amount_minor,
    donation_records.status,
    donation_records.environment,
    case
      when donation_records.status = 'confirmed_paid'
        and donation_records.environment = 'live'
        then donation_records.amount_minor
      else 0
    end,
    case
      when donation_records.status = 'confirmed_paid'
        and donation_records.environment = 'simulation'
        then donation_records.amount_minor
      else 0
    end,
    case
      when donation_records.status = 'confirmed_paid'
        and donation_records.environment = 'sandbox'
        then donation_records.amount_minor
      else 0
    end
  from selected_snapshot
  join public.allocation_lines
    on allocation_lines.snapshot_id = selected_snapshot.id
  left join public.donation_records
    on donation_records.allocation_line_id = allocation_lines.id
  order by allocation_lines.organization_id;
$$;

revoke all on table public.payment_transactions from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
grant select on table public.payment_transactions to authenticated;
grant select on table public.payment_events to authenticated;

revoke all on function public.reserve_paypal_sandbox_payout(uuid, text)
  from public, anon;
grant execute on function public.reserve_paypal_sandbox_payout(uuid, text)
  to authenticated;

revoke all on function public.record_paypal_sandbox_request_result(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_paypal_sandbox_request_result(
  uuid, text, text, text, text, text
) to service_role;

revoke all on function public.record_verified_paypal_webhook(
  text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_verified_paypal_webhook(
  text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.get_campaign_public_ledger(text) from public;
grant execute on function public.get_campaign_public_ledger(text)
  to anon, authenticated;
