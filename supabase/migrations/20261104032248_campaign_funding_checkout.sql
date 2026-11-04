-- Campaign funding checkout
--
-- A program owner explicitly approves a PayPal order after voting closes.
-- Each purchase unit pays a recipient merchant that previously completed
-- PayPal partner onboarding. Our Impact stores provider references and status,
-- never the payer's or recipient's PayPal credentials.

create table public.campaign_funding_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  campaign_id uuid not null,
  period_id uuid not null,
  allocation_snapshot_id uuid not null unique,
  status text not null default 'reserved',
  environment text not null default 'sandbox',
  currency text not null,
  total_minor bigint not null,
  paypal_order_id text,
  provider_status text,
  request_id uuid not null unique,
  attempt_count integer not null default 0,
  initiated_by uuid references auth.users (id) on delete set null,
  provider_debug_id text,
  last_error_code text,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_funding_orders_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint campaign_funding_orders_snapshot_fkey
    foreign key (allocation_snapshot_id, period_id, campaign_id)
    references public.allocation_snapshots (id, period_id, campaign_id)
    on delete restrict,
  constraint campaign_funding_orders_status_check check (
    status in (
      'reserved',
      'creating',
      'order_created',
      'approved',
      'capturing',
      'completed',
      'partially_completed',
      'failed',
      'canceled',
      'requires_reconciliation'
    )
  ),
  constraint campaign_funding_orders_environment_check check (
    environment in ('sandbox', 'live')
  ),
  constraint campaign_funding_orders_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint campaign_funding_orders_total_positive check (total_minor > 0),
  constraint campaign_funding_orders_attempts_nonnegative check (attempt_count >= 0),
  constraint campaign_funding_orders_paypal_order_length check (
    paypal_order_id is null or char_length(paypal_order_id) between 3 and 255
  ),
  constraint campaign_funding_orders_error_length check (
    last_error_code is null or char_length(last_error_code) <= 120
  ),
  constraint campaign_funding_orders_debug_length check (
    provider_debug_id is null or char_length(provider_debug_id) <= 255
  )
);

create unique index campaign_funding_orders_paypal_order_uidx
  on public.campaign_funding_orders (paypal_order_id)
  where paypal_order_id is not null;

create index campaign_funding_orders_company_created_idx
  on public.campaign_funding_orders (company_id, created_at desc);

create index campaign_funding_orders_campaign_created_idx
  on public.campaign_funding_orders (campaign_id, created_at desc);

create index campaign_funding_orders_period_idx
  on public.campaign_funding_orders (period_id);

create index campaign_funding_orders_snapshot_period_campaign_idx
  on public.campaign_funding_orders (
    allocation_snapshot_id,
    period_id,
    campaign_id
  );

create index campaign_funding_orders_initiated_by_idx
  on public.campaign_funding_orders (initiated_by)
  where initiated_by is not null;

create table public.campaign_funding_units (
  id uuid primary key default gen_random_uuid(),
  funding_order_id uuid not null references public.campaign_funding_orders (id) on delete restrict,
  donation_record_id uuid not null unique references public.donation_records (id) on delete restrict,
  organization_id bigint not null references public.organizations (id) on delete restrict,
  merchant_connection_id uuid not null references public.paypal_merchant_connections (id) on delete restrict,
  merchant_id text not null,
  reference_id text not null,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'reserved',
  paypal_capture_id text,
  provider_status text,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (funding_order_id, reference_id),
  constraint campaign_funding_units_status_check check (
    status in (
      'reserved',
      'order_created',
      'approved',
      'completed',
      'failed',
      'refunded',
      'reversed',
      'requires_reconciliation'
    )
  ),
  constraint campaign_funding_units_amount_positive check (amount_minor > 0),
  constraint campaign_funding_units_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint campaign_funding_units_merchant_length check (
    char_length(merchant_id) between 3 and 255
  ),
  constraint campaign_funding_units_reference_length check (
    char_length(reference_id) between 3 and 127
  ),
  constraint campaign_funding_units_capture_length check (
    paypal_capture_id is null or char_length(paypal_capture_id) between 3 and 255
  ),
  constraint campaign_funding_units_error_length check (
    last_error_code is null or char_length(last_error_code) <= 120
  )
);

create unique index campaign_funding_units_capture_uidx
  on public.campaign_funding_units (paypal_capture_id)
  where paypal_capture_id is not null;

create index campaign_funding_units_order_idx
  on public.campaign_funding_units (funding_order_id);

create index campaign_funding_units_organization_idx
  on public.campaign_funding_units (organization_id);

create index campaign_funding_units_connection_idx
  on public.campaign_funding_units (merchant_connection_id);

alter table public.campaign_funding_orders enable row level security;
alter table public.campaign_funding_units enable row level security;

create policy "campaign_funding_orders_select_member"
on public.campaign_funding_orders for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = campaign_funding_orders.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "campaign_funding_units_select_member"
on public.campaign_funding_units for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_funding_orders
    join public.memberships
      on memberships.company_id = campaign_funding_orders.company_id
    where campaign_funding_orders.id = campaign_funding_units.funding_order_id
      and memberships.user_id = (select auth.uid())
  )
);

create trigger campaign_funding_orders_set_updated_at
before update on public.campaign_funding_orders
for each row execute function private.set_updated_at();

create trigger campaign_funding_units_set_updated_at
before update on public.campaign_funding_units
for each row execute function private.set_updated_at();

create or replace function public.reserve_campaign_funding_order(
  p_snapshot_id uuid,
  p_initiated_by uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_snapshot public.allocation_snapshots%rowtype;
  selected_campaign public.campaigns%rowtype;
  selected_period public.campaign_periods%rowtype;
  selected_order public.campaign_funding_orders%rowtype;
  donation_count integer;
  ready_connection_count integer;
  unit_payload jsonb;
begin
  select * into selected_snapshot
  from public.allocation_snapshots
  where id = p_snapshot_id;

  if selected_snapshot.id is null then
    raise exception 'Allocation snapshot not found.';
  end if;

  select * into selected_campaign
  from public.campaigns
  where id = selected_snapshot.campaign_id;

  select * into selected_period
  from public.campaign_periods
  where id = selected_snapshot.period_id;

  if not exists (
    select 1
    from public.memberships
    where company_id = selected_campaign.company_id
      and user_id = p_initiated_by
      and role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access is required.';
  end if;

  if selected_period.status <> 'closed' or selected_snapshot.state <> 'allocated' then
    raise exception 'Only a completed allocation can be funded.';
  end if;

  if exists (
    select 1
    from public.allocation_snapshots newer
    where newer.period_id = selected_snapshot.period_id
      and newer.revision > selected_snapshot.revision
  ) then
    raise exception 'Choose the latest allocation revision for this period.';
  end if;

  if selected_snapshot.currency <> 'USD' then
    raise exception 'Campaign funding checkout currently supports USD only.';
  end if;

  select count(*) into donation_count
  from public.donation_records
  where allocation_snapshot_id = selected_snapshot.id
    and amount_minor > 0;

  if donation_count < 1 or donation_count > 10 then
    raise exception 'A funding checkout requires between 1 and 10 recipients.';
  end if;

  if exists (
    select 1
    from public.donation_records
    where allocation_snapshot_id = selected_snapshot.id
      and amount_minor > 0
      and status not in (
        'approved_for_payment',
        'payment_failed',
        'requires_reconciliation'
      )
  ) then
    raise exception 'Approve every recipient allocation before checkout.';
  end if;

  select count(distinct donation_records.id) into ready_connection_count
  from public.donation_records
  join public.paypal_merchant_connections
    on paypal_merchant_connections.organization_id = donation_records.organization_id
  where donation_records.allocation_snapshot_id = selected_snapshot.id
    and donation_records.amount_minor > 0
    and paypal_merchant_connections.environment = 'sandbox'
    and paypal_merchant_connections.status = 'active'
    and paypal_merchant_connections.curation_state = 'approved'
    and paypal_merchant_connections.permissions_granted
    and paypal_merchant_connections.payments_receivable
    and paypal_merchant_connections.primary_email_confirmed
    and paypal_merchant_connections.merchant_id is not null;

  if ready_connection_count <> donation_count then
    raise exception 'Every recipient must finish PayPal setup before checkout.';
  end if;

  insert into public.campaign_funding_orders (
    company_id,
    campaign_id,
    period_id,
    allocation_snapshot_id,
    currency,
    total_minor,
    request_id,
    initiated_by
  ) values (
    selected_campaign.company_id,
    selected_campaign.id,
    selected_period.id,
    selected_snapshot.id,
    selected_snapshot.currency,
    selected_snapshot.allocated_minor,
    p_request_id,
    p_initiated_by
  )
  on conflict (allocation_snapshot_id) do nothing;

  select * into selected_order
  from public.campaign_funding_orders
  where allocation_snapshot_id = selected_snapshot.id
  for update;

  if not exists (
    select 1
    from public.campaign_funding_units
    where funding_order_id = selected_order.id
  ) then
    insert into public.campaign_funding_units (
      funding_order_id,
      donation_record_id,
      organization_id,
      merchant_connection_id,
      merchant_id,
      reference_id,
      amount_minor,
      currency
    )
    select distinct on (donation_records.id)
      selected_order.id,
      donation_records.id,
      donation_records.organization_id,
      paypal_merchant_connections.id,
      paypal_merchant_connections.merchant_id,
      'oi_alloc_' || replace(donation_records.id::text, '-', ''),
      donation_records.amount_minor,
      donation_records.currency
    from public.donation_records
    join public.paypal_merchant_connections
      on paypal_merchant_connections.organization_id = donation_records.organization_id
    where donation_records.allocation_snapshot_id = selected_snapshot.id
      and donation_records.amount_minor > 0
      and paypal_merchant_connections.environment = 'sandbox'
      and paypal_merchant_connections.status = 'active'
      and paypal_merchant_connections.curation_state = 'approved'
      and paypal_merchant_connections.permissions_granted
      and paypal_merchant_connections.payments_receivable
      and paypal_merchant_connections.primary_email_confirmed
      and paypal_merchant_connections.merchant_id is not null
    order by donation_records.id, paypal_merchant_connections.last_verified_at desc nulls last;

    insert into public.audit_events (
      company_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      selected_campaign.company_id,
      p_initiated_by,
      'campaign_funding.reserved',
      'campaign_funding_order',
      selected_order.id,
      jsonb_build_object(
        'campaign_id', selected_campaign.id,
        'period_id', selected_period.id,
        'allocation_snapshot_id', selected_snapshot.id,
        'total_minor', selected_snapshot.allocated_minor,
        'currency', selected_snapshot.currency
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', campaign_funding_units.id,
        'donation_record_id', campaign_funding_units.donation_record_id,
        'organization_id', campaign_funding_units.organization_id,
        'merchant_id', campaign_funding_units.merchant_id,
        'reference_id', campaign_funding_units.reference_id,
        'amount_minor', campaign_funding_units.amount_minor,
        'currency', campaign_funding_units.currency,
        'status', campaign_funding_units.status
      ) order by campaign_funding_units.created_at
    ),
    '[]'::jsonb
  ) into unit_payload
  from public.campaign_funding_units
  where funding_order_id = selected_order.id;

  return jsonb_build_object(
    'id', selected_order.id,
    'status', selected_order.status,
    'paypal_order_id', selected_order.paypal_order_id,
    'currency', selected_order.currency,
    'total_minor', selected_order.total_minor,
    'units', unit_payload
  );
end;
$$;

create or replace function public.record_campaign_funding_capture(
  p_funding_order_id uuid,
  p_paypal_order_id text,
  p_order_status text,
  p_units jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.campaign_funding_orders%rowtype;
  selected_unit public.campaign_funding_units%rowtype;
  selected_donation public.donation_records%rowtype;
  unit_item jsonb;
  unit_reference text;
  capture_id text;
  capture_status text;
  next_unit_status text;
  next_donation_status text;
  completed_count integer;
  failed_count integer;
  total_count integer;
  next_order_status text;
  processed_count integer := 0;
begin
  if jsonb_typeof(p_units) <> 'array' or jsonb_array_length(p_units) > 10 then
    raise exception 'PayPal purchase units must be a JSON array of at most 10 items.';
  end if;

  select * into selected_order
  from public.campaign_funding_orders
  where id = p_funding_order_id
  for update;

  if selected_order.id is null or selected_order.paypal_order_id <> trim(p_paypal_order_id) then
    raise exception 'Funding order not found.';
  end if;

  for unit_item in select value from jsonb_array_elements(p_units)
  loop
    unit_reference := nullif(trim(unit_item ->> 'reference_id'), '');
    capture_id := nullif(trim(unit_item ->> 'capture_id'), '');
    capture_status := upper(coalesce(nullif(trim(unit_item ->> 'status'), ''), 'PENDING'));

    select * into selected_unit
    from public.campaign_funding_units
    where funding_order_id = selected_order.id
      and reference_id = unit_reference
    for update;

    if selected_unit.id is null then
      continue;
    end if;

    next_unit_status := case capture_status
      when 'COMPLETED' then 'completed'
      when 'DENIED' then 'failed'
      when 'DECLINED' then 'failed'
      when 'REFUNDED' then 'refunded'
      when 'REVERSED' then 'reversed'
      else 'approved'
    end;

    next_donation_status := case next_unit_status
      when 'completed' then 'confirmed_paid'
      when 'failed' then 'payment_failed'
      when 'refunded' then 'requires_reconciliation'
      when 'reversed' then 'requires_reconciliation'
      else 'payment_pending'
    end;

    update public.campaign_funding_units
    set
      status = next_unit_status,
      paypal_capture_id = coalesce(capture_id, paypal_capture_id),
      provider_status = capture_status,
      last_error_code = case
        when next_unit_status in ('failed', 'refunded', 'reversed')
          then lower(capture_status)
        else null
      end,
      completed_at = case
        when next_unit_status = 'completed' then coalesce(completed_at, now())
        else completed_at
      end
    where id = selected_unit.id;

    select * into selected_donation
    from public.donation_records
    where id = selected_unit.donation_record_id
    for update;

    if selected_donation.status is distinct from next_donation_status then
      update public.donation_records
      set
        status = next_donation_status,
        environment = 'sandbox',
        evidence_reference = case
          when capture_id is not null then 'paypal:capture:' || capture_id
          else evidence_reference
        end,
        current_note = case next_donation_status
          when 'confirmed_paid' then 'PayPal confirmed the campaign funding payment.'
          when 'payment_failed' then 'PayPal did not complete this recipient payment.'
          when 'requires_reconciliation' then 'PayPal reported a post-payment status that needs review.'
          else 'PayPal approved the campaign funding order.'
        end
      where id = selected_donation.id;

      insert into public.donation_status_events (
        donation_record_id,
        actor_user_id,
        from_status,
        to_status,
        note,
        evidence_reference
      ) values (
        selected_donation.id,
        selected_order.initiated_by,
        selected_donation.status,
        next_donation_status,
        'Campaign funding checkout updated this recipient payment.',
        case when capture_id is not null then 'paypal:capture:' || capture_id else null end
      );
    end if;

    processed_count := processed_count + 1;
  end loop;

  if processed_count = 0 then
    raise exception 'No PayPal purchase units matched this funding order.';
  end if;

  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status in ('failed', 'refunded', 'reversed'))
  into total_count, completed_count, failed_count
  from public.campaign_funding_units
  where funding_order_id = selected_order.id;

  next_order_status := case
    when completed_count = total_count then 'completed'
    when completed_count > 0 then 'partially_completed'
    when failed_count = total_count then 'failed'
    when upper(coalesce(p_order_status, '')) = 'PARTIALLY_COMPLETED'
      then 'partially_completed'
    else 'approved'
  end;

  update public.campaign_funding_orders
  set
    status = next_order_status,
    provider_status = upper(coalesce(nullif(trim(p_order_status), ''), next_order_status)),
    approved_at = coalesce(approved_at, now()),
    completed_at = case
      when next_order_status = 'completed' then coalesce(completed_at, now())
      else completed_at
    end,
    last_error_code = case
      when next_order_status in ('failed', 'partially_completed') then next_order_status
      else null
    end
  where id = selected_order.id;

  if next_order_status in ('completed', 'partially_completed')
    and selected_order.status not in ('completed', 'partially_completed') then
    insert into public.audit_events (
      company_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      selected_order.company_id,
      selected_order.initiated_by,
      'campaign_funding.' || next_order_status,
      'campaign_funding_order',
      selected_order.id,
      jsonb_build_object(
        'paypal_order_id', selected_order.paypal_order_id,
        'completed_units', completed_count,
        'total_units', total_count
      )
    );
  end if;

  return jsonb_build_object(
    'status', next_order_status,
    'completed_units', completed_count,
    'total_units', total_count
  );
end;
$$;

create or replace function public.record_campaign_funding_webhook(
  p_provider_event_id text,
  p_event_type text,
  p_paypal_order_id text default null,
  p_paypal_capture_id text default null,
  p_custom_id text default null,
  p_resource_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_event public.paypal_order_events%rowtype;
  selected_unit public.campaign_funding_units%rowtype;
  selected_order public.campaign_funding_orders%rowtype;
  webhook_status text;
  result jsonb;
begin
  select * into selected_event
  from public.paypal_order_events
  where provider_event_id = trim(p_provider_event_id)
  for update;

  if selected_event.id is null or p_event_type not like 'PAYMENT.CAPTURE.%' then
    return jsonb_build_object('status', 'ignored');
  end if;

  select campaign_funding_units.* into selected_unit
  from public.campaign_funding_units
  join public.campaign_funding_orders
    on campaign_funding_orders.id = campaign_funding_units.funding_order_id
  where (nullif(trim(p_custom_id), '') is not null
      and campaign_funding_units.reference_id = trim(p_custom_id))
    or (nullif(trim(p_paypal_capture_id), '') is not null
      and campaign_funding_units.paypal_capture_id = trim(p_paypal_capture_id))
    or (nullif(trim(p_paypal_order_id), '') is not null
      and campaign_funding_orders.paypal_order_id = trim(p_paypal_order_id)
      and campaign_funding_units.merchant_id = selected_event.merchant_id)
  order by case
    when nullif(trim(p_custom_id), '') is not null
      and campaign_funding_units.reference_id = trim(p_custom_id) then 1
    when nullif(trim(p_paypal_capture_id), '') is not null
      and campaign_funding_units.paypal_capture_id = trim(p_paypal_capture_id) then 2
    else 3
  end
  limit 1
  for update of campaign_funding_units;

  if selected_unit.id is null then
    return jsonb_build_object('status', 'unmatched');
  end if;

  select * into selected_order
  from public.campaign_funding_orders
  where id = selected_unit.funding_order_id;

  webhook_status := case p_event_type
    when 'PAYMENT.CAPTURE.COMPLETED' then 'COMPLETED'
    when 'PAYMENT.CAPTURE.DENIED' then 'DENIED'
    when 'PAYMENT.CAPTURE.REFUNDED' then 'REFUNDED'
    when 'PAYMENT.CAPTURE.REVERSED' then 'REVERSED'
    else upper(coalesce(nullif(trim(p_resource_status), ''), 'PENDING'))
  end;

  select public.record_campaign_funding_capture(
    selected_order.id,
    selected_order.paypal_order_id,
    selected_order.provider_status,
    jsonb_build_array(
      jsonb_build_object(
        'reference_id', selected_unit.reference_id,
        'capture_id', coalesce(nullif(trim(p_paypal_capture_id), ''), selected_unit.paypal_capture_id),
        'status', webhook_status
      )
    )
  ) into result;

  update public.paypal_order_events
  set
    company_id = selected_order.company_id,
    campaign_id = selected_order.campaign_id,
    processing_status = 'processed',
    processed_at = now()
  where id = selected_event.id;

  return jsonb_build_object(
    'status', 'processed',
    'funding_order_id', selected_order.id,
    'funding_result', result
  );
end;
$$;

revoke all on table public.campaign_funding_orders from anon, authenticated;
revoke all on table public.campaign_funding_units from anon, authenticated;

grant select on table public.campaign_funding_orders to authenticated;
grant select on table public.campaign_funding_units to authenticated;

grant select, insert, update, delete on table public.campaign_funding_orders to service_role;
grant select, insert, update, delete on table public.campaign_funding_units to service_role;

revoke all on function public.reserve_campaign_funding_order(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_campaign_funding_order(uuid, uuid, uuid)
  to service_role;

revoke all on function public.record_campaign_funding_capture(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_campaign_funding_capture(uuid, text, text, jsonb)
  to service_role;

revoke all on function public.record_campaign_funding_webhook(text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_campaign_funding_webhook(text, text, text, text, text, text)
  to service_role;
