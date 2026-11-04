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
        'allocated',
        'approved_for_payment',
        'payment_failed',
        'requires_reconciliation'
      )
  ) then
    raise exception 'This allocation is not available for checkout.';
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

revoke all on function public.reserve_campaign_funding_order(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_campaign_funding_order(uuid, uuid, uuid)
  to service_role;
