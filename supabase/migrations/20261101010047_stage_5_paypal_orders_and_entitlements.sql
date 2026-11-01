-- Our Impact Stage 5
-- Consented PayPal Sandbox recipients, direct supporter checkout, verified
-- Orders webhooks, and campaign-scoped supporter entitlements.

create table public.paypal_merchant_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null unique
    references public.organizations (id) on delete restrict,
  initiated_for_campaign_id uuid
    references public.campaigns (id) on delete set null,
  environment text not null default 'sandbox',
  status text not null default 'pending',
  curation_state text not null default 'pending',
  tracking_id text not null unique,
  partner_referral_id text,
  merchant_id text unique,
  permissions_granted boolean not null default false,
  consent_status text,
  payments_receivable boolean not null default false,
  primary_email_confirmed boolean not null default false,
  products jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  last_error_code text,
  created_by uuid references auth.users (id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint paypal_merchant_connections_environment check (environment = 'sandbox'),
  constraint paypal_merchant_connections_status check (
    status in ('pending', 'active', 'needs_attention', 'revoked')
  ),
  constraint paypal_merchant_connections_curation_state check (
    curation_state in ('pending', 'approved', 'rejected')
  ),
  constraint paypal_merchant_connections_tracking_length check (
    char_length(tracking_id) between 8 and 127
  ),
  constraint paypal_merchant_connections_referral_length check (
    partner_referral_id is null or char_length(partner_referral_id) <= 255
  ),
  constraint paypal_merchant_connections_merchant_length check (
    merchant_id is null or char_length(merchant_id) between 3 and 255
  ),
  constraint paypal_merchant_connections_consent_length check (
    consent_status is null or char_length(consent_status) <= 80
  ),
  constraint paypal_merchant_connections_products_array check (
    jsonb_typeof(products) = 'array'
  ),
  constraint paypal_merchant_connections_capabilities_array check (
    jsonb_typeof(capabilities) = 'array'
  ),
  constraint paypal_merchant_connections_error_length check (
    last_error_code is null or char_length(last_error_code) <= 100
  ),
  constraint paypal_merchant_connections_active_complete check (
    status <> 'active'
    or (
      curation_state = 'approved'
      and merchant_id is not null
      and permissions_granted
      and payments_receivable
      and primary_email_confirmed
    )
  )
);

create index paypal_merchant_connections_campaign_idx
  on public.paypal_merchant_connections (initiated_for_campaign_id)
  where initiated_for_campaign_id is not null;

create index paypal_merchant_connections_created_by_idx
  on public.paypal_merchant_connections (created_by)
  where created_by is not null;

create index paypal_merchant_connections_active_organization_idx
  on public.paypal_merchant_connections (organization_id)
  where status = 'active' and curation_state = 'approved';

create table public.donation_sessions (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null unique,
  company_id uuid not null references public.companies (id) on delete restrict,
  campaign_id uuid not null,
  organization_id bigint not null,
  merchant_connection_id uuid not null
    references public.paypal_merchant_connections (id) on delete restrict,
  visitor_key_hash text not null,
  amount_minor bigint not null,
  currency text not null default 'USD',
  status text not null default 'reserved',
  paypal_order_id text,
  paypal_capture_id text,
  provider_status text,
  request_id text not null unique,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_sessions_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint donation_sessions_campaign_organization_fkey
    foreign key (campaign_id, organization_id)
    references public.campaign_organizations (campaign_id, organization_id)
    on delete restrict,
  constraint donation_sessions_public_reference_format check (
    public_reference ~ '^oi_ds_[0-9a-f]{24}$'
  ),
  constraint donation_sessions_visitor_hash check (
    visitor_key_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint donation_sessions_amount_range check (
    amount_minor between 100 and 100000
  ),
  constraint donation_sessions_currency check (currency = 'USD'),
  constraint donation_sessions_status check (
    status in (
      'reserved',
      'order_created',
      'approved',
      'completed',
      'denied',
      'failed',
      'refunded',
      'reversed',
      'canceled'
    )
  ),
  constraint donation_sessions_order_length check (
    paypal_order_id is null or char_length(paypal_order_id) between 3 and 255
  ),
  constraint donation_sessions_capture_length check (
    paypal_capture_id is null or char_length(paypal_capture_id) between 3 and 255
  ),
  constraint donation_sessions_provider_status_length check (
    provider_status is null or char_length(provider_status) <= 80
  ),
  constraint donation_sessions_request_id_length check (
    char_length(request_id) between 8 and 255
  ),
  constraint donation_sessions_error_length check (
    last_error_code is null or char_length(last_error_code) <= 100
  )
);

create unique index donation_sessions_paypal_order_uidx
  on public.donation_sessions (paypal_order_id)
  where paypal_order_id is not null;

create unique index donation_sessions_paypal_capture_uidx
  on public.donation_sessions (paypal_capture_id)
  where paypal_capture_id is not null;

create index donation_sessions_campaign_created_idx
  on public.donation_sessions (campaign_id, created_at desc);

create index donation_sessions_company_created_idx
  on public.donation_sessions (company_id, created_at desc);

create index donation_sessions_organization_created_idx
  on public.donation_sessions (organization_id, created_at desc);

create index donation_sessions_connection_idx
  on public.donation_sessions (merchant_connection_id);

create index donation_sessions_entitlement_count_idx
  on public.donation_sessions (campaign_id, visitor_key_hash, completed_at)
  where status = 'completed';

create table public.paypal_order_events (
  id bigint generated always as identity primary key,
  donation_session_id uuid
    references public.donation_sessions (id) on delete restrict,
  company_id uuid references public.companies (id) on delete restrict,
  campaign_id uuid references public.campaigns (id) on delete restrict,
  provider_event_id text not null unique,
  transmission_id text not null,
  event_type text not null,
  resource_id text,
  paypal_order_id text,
  paypal_capture_id text,
  merchant_id text,
  resource_status text,
  payload_hash text not null,
  event_summary jsonb not null default '{}'::jsonb,
  delivery_count integer not null default 1,
  processing_status text not null default 'received',
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint paypal_order_events_event_id_length check (
    char_length(provider_event_id) between 3 and 255
  ),
  constraint paypal_order_events_transmission_length check (
    char_length(transmission_id) between 3 and 255
  ),
  constraint paypal_order_events_type_length check (
    char_length(event_type) between 3 and 120
  ),
  constraint paypal_order_events_payload_hash check (
    payload_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint paypal_order_events_summary_object check (
    jsonb_typeof(event_summary) = 'object'
  ),
  constraint paypal_order_events_delivery_positive check (delivery_count > 0),
  constraint paypal_order_events_processing_status check (
    processing_status in (
      'received', 'processed', 'duplicate', 'unmatched', 'ignored'
    )
  )
);

create index paypal_order_events_session_received_idx
  on public.paypal_order_events (donation_session_id, first_received_at desc)
  where donation_session_id is not null;

create index paypal_order_events_company_received_idx
  on public.paypal_order_events (company_id, first_received_at desc)
  where company_id is not null;

create index paypal_order_events_campaign_received_idx
  on public.paypal_order_events (campaign_id, first_received_at desc)
  where campaign_id is not null;

create index paypal_order_events_order_idx
  on public.paypal_order_events (paypal_order_id)
  where paypal_order_id is not null;

create index paypal_order_events_capture_idx
  on public.paypal_order_events (paypal_capture_id)
  where paypal_capture_id is not null;

create index paypal_order_events_merchant_idx
  on public.paypal_order_events (merchant_id)
  where merchant_id is not null;

create table public.supporter_entitlements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  campaign_id uuid not null,
  visitor_key_hash text not null,
  entitlement_key text not null,
  state text not null default 'inactive',
  qualifying_count integer not null default 0,
  qualified_at timestamptz,
  revoked_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, visitor_key_hash, entitlement_key),
  constraint supporter_entitlements_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint supporter_entitlements_visitor_hash check (
    visitor_key_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint supporter_entitlements_key check (
    entitlement_key in ('supporter', 'tier_3')
  ),
  constraint supporter_entitlements_state check (
    state in ('active', 'inactive')
  ),
  constraint supporter_entitlements_count_nonnegative check (
    qualifying_count >= 0
  )
);

create index supporter_entitlements_company_idx
  on public.supporter_entitlements (company_id, updated_at desc);

create index supporter_entitlements_active_campaign_idx
  on public.supporter_entitlements (campaign_id, entitlement_key)
  where state = 'active';

create table public.supporter_entitlement_events (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null
    references public.supporter_entitlements (id) on delete restrict,
  company_id uuid not null references public.companies (id) on delete restrict,
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  event_type text not null,
  qualifying_count integer not null,
  source_donation_session_id uuid
    references public.donation_sessions (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint supporter_entitlement_events_type check (
    event_type in ('granted', 'revoked')
  ),
  constraint supporter_entitlement_events_count_nonnegative check (
    qualifying_count >= 0
  )
);

create index supporter_entitlement_events_entitlement_created_idx
  on public.supporter_entitlement_events (entitlement_id, created_at desc);

create index supporter_entitlement_events_company_created_idx
  on public.supporter_entitlement_events (company_id, created_at desc);

create index supporter_entitlement_events_campaign_created_idx
  on public.supporter_entitlement_events (campaign_id, created_at desc);

create index supporter_entitlement_events_source_idx
  on public.supporter_entitlement_events (source_donation_session_id)
  where source_donation_session_id is not null;

create trigger paypal_merchant_connections_set_updated_at
before update on public.paypal_merchant_connections
for each row execute function private.set_updated_at();

create trigger donation_sessions_set_updated_at
before update on public.donation_sessions
for each row execute function private.set_updated_at();

create trigger supporter_entitlements_set_updated_at
before update on public.supporter_entitlements
for each row execute function private.set_updated_at();

create trigger paypal_order_events_immutable
before delete on public.paypal_order_events
for each row execute function private.reject_immutable_ledger_mutation();

create trigger supporter_entitlement_events_immutable
before delete on public.supporter_entitlement_events
for each row execute function private.reject_immutable_ledger_mutation();

create or replace function private.refresh_supporter_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_timezone text;
  month_start timestamptz;
  month_end timestamptz;
  lifetime_count integer;
  monthly_count integer;
  previous_state text;
  next_state text;
  selected_entitlement_id uuid;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'completed' then
      return new;
    end if;
  elsif new.status is not distinct from old.status
    or (new.status <> 'completed' and old.status <> 'completed') then
    return new;
  end if;

  select timezone into campaign_timezone
  from public.campaigns
  where id = new.campaign_id;

  month_start := date_trunc('month', now() at time zone campaign_timezone)
    at time zone campaign_timezone;
  month_end := (date_trunc('month', now() at time zone campaign_timezone) + interval '1 month')
    at time zone campaign_timezone;

  select count(*)::integer into lifetime_count
  from public.donation_sessions
  where campaign_id = new.campaign_id
    and visitor_key_hash = new.visitor_key_hash
    and status = 'completed';

  select count(*)::integer into monthly_count
  from public.donation_sessions
  where campaign_id = new.campaign_id
    and visitor_key_hash = new.visitor_key_hash
    and status = 'completed'
    and completed_at >= month_start
    and completed_at < month_end;

  select state into previous_state
  from public.supporter_entitlements
  where campaign_id = new.campaign_id
    and visitor_key_hash = new.visitor_key_hash
    and entitlement_key = 'supporter';

  next_state := case when lifetime_count >= 1 then 'active' else 'inactive' end;

  insert into public.supporter_entitlements (
    company_id,
    campaign_id,
    visitor_key_hash,
    entitlement_key,
    state,
    qualifying_count,
    qualified_at,
    revoked_at,
    valid_until
  ) values (
    new.company_id,
    new.campaign_id,
    new.visitor_key_hash,
    'supporter',
    next_state,
    lifetime_count,
    case when next_state = 'active' then now() else null end,
    case when next_state = 'inactive' then now() else null end,
    null
  )
  on conflict (campaign_id, visitor_key_hash, entitlement_key) do update
  set
    state = excluded.state,
    qualifying_count = excluded.qualifying_count,
    qualified_at = case
      when public.supporter_entitlements.state <> 'active'
        and excluded.state = 'active' then now()
      else public.supporter_entitlements.qualified_at
    end,
    revoked_at = case
      when public.supporter_entitlements.state = 'active'
        and excluded.state = 'inactive' then now()
      when excluded.state = 'active' then null
      else public.supporter_entitlements.revoked_at
    end,
    valid_until = null
  returning id into selected_entitlement_id;

  if (previous_state is null and next_state = 'active')
    or (previous_state is distinct from next_state and previous_state is not null) then
    insert into public.supporter_entitlement_events (
      entitlement_id,
      company_id,
      campaign_id,
      event_type,
      qualifying_count,
      source_donation_session_id
    ) values (
      selected_entitlement_id,
      new.company_id,
      new.campaign_id,
      case when next_state = 'active' then 'granted' else 'revoked' end,
      lifetime_count,
      new.id
    );
  end if;

  select state into previous_state
  from public.supporter_entitlements
  where campaign_id = new.campaign_id
    and visitor_key_hash = new.visitor_key_hash
    and entitlement_key = 'tier_3';

  next_state := case when monthly_count >= 3 then 'active' else 'inactive' end;

  insert into public.supporter_entitlements (
    company_id,
    campaign_id,
    visitor_key_hash,
    entitlement_key,
    state,
    qualifying_count,
    qualified_at,
    revoked_at,
    valid_until
  ) values (
    new.company_id,
    new.campaign_id,
    new.visitor_key_hash,
    'tier_3',
    next_state,
    monthly_count,
    case when next_state = 'active' then now() else null end,
    case when next_state = 'inactive' then now() else null end,
    case when next_state = 'active' then month_end else null end
  )
  on conflict (campaign_id, visitor_key_hash, entitlement_key) do update
  set
    state = excluded.state,
    qualifying_count = excluded.qualifying_count,
    qualified_at = case
      when public.supporter_entitlements.state <> 'active'
        and excluded.state = 'active' then now()
      else public.supporter_entitlements.qualified_at
    end,
    revoked_at = case
      when public.supporter_entitlements.state = 'active'
        and excluded.state = 'inactive' then now()
      when excluded.state = 'active' then null
      else public.supporter_entitlements.revoked_at
    end,
    valid_until = excluded.valid_until
  returning id into selected_entitlement_id;

  if (previous_state is null and next_state = 'active')
    or (previous_state is distinct from next_state and previous_state is not null) then
    insert into public.supporter_entitlement_events (
      entitlement_id,
      company_id,
      campaign_id,
      event_type,
      qualifying_count,
      source_donation_session_id
    ) values (
      selected_entitlement_id,
      new.company_id,
      new.campaign_id,
      case when next_state = 'active' then 'granted' else 'revoked' end,
      monthly_count,
      new.id
    );
  end if;

  return new;
end;
$$;

create trigger donation_sessions_refresh_entitlements
after insert or update of status on public.donation_sessions
for each row execute function private.refresh_supporter_entitlements();

create or replace function public.get_campaign_paypal_recipients(p_public_id text)
returns table (
  organization_id bigint,
  merchant_id text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    campaign_organizations.organization_id,
    paypal_merchant_connections.merchant_id
  from public.campaigns
  join public.campaign_organizations
    on campaign_organizations.campaign_id = campaigns.id
  join public.paypal_merchant_connections
    on paypal_merchant_connections.organization_id = campaign_organizations.organization_id
  where campaigns.public_id = p_public_id
    and campaigns.status = 'published'
    and paypal_merchant_connections.environment = 'sandbox'
    and paypal_merchant_connections.status = 'active'
    and paypal_merchant_connections.curation_state = 'approved'
    and paypal_merchant_connections.merchant_id is not null
  order by campaign_organizations.display_order;
$$;

create or replace function public.record_verified_paypal_order_webhook(
  p_provider_event_id text,
  p_transmission_id text,
  p_event_type text,
  p_resource_id text default null,
  p_paypal_order_id text default null,
  p_paypal_capture_id text default null,
  p_custom_id text default null,
  p_merchant_id text default null,
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
  selected_session public.donation_sessions%rowtype;
  next_status text;
  event_processing_status text := 'ignored';
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

  insert into public.paypal_order_events (
    provider_event_id,
    transmission_id,
    event_type,
    resource_id,
    paypal_order_id,
    paypal_capture_id,
    merchant_id,
    resource_status,
    payload_hash,
    event_summary
  ) values (
    trim(p_provider_event_id),
    trim(p_transmission_id),
    trim(p_event_type),
    nullif(trim(p_resource_id), ''),
    nullif(trim(p_paypal_order_id), ''),
    nullif(trim(p_paypal_capture_id), ''),
    nullif(trim(p_merchant_id), ''),
    nullif(trim(p_resource_status), ''),
    p_payload_hash,
    coalesce(p_event_summary, '{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    update public.paypal_order_events
    set delivery_count = delivery_count + 1, last_received_at = now()
    where provider_event_id = trim(p_provider_event_id)
    returning id into existing_event_id;

    return jsonb_build_object(
      'status', 'duplicate',
      'paypal_order_event_id', existing_event_id
    );
  end if;

  if p_event_type = 'MERCHANT.PARTNER-CONSENT.REVOKED'
    and nullif(trim(p_merchant_id), '') is not null then
    update public.paypal_merchant_connections
    set
      status = 'revoked',
      curation_state = 'pending',
      permissions_granted = false,
      consent_status = 'REVOKED',
      last_verified_at = now()
    where merchant_id = trim(p_merchant_id);

    event_processing_status := case when found then 'processed' else 'unmatched' end;
  elsif p_event_type like 'PAYMENT.CAPTURE.%' then
    select * into selected_session
    from public.donation_sessions
    where (nullif(trim(p_custom_id), '') is not null
        and public_reference = trim(p_custom_id))
      or (nullif(trim(p_paypal_order_id), '') is not null
        and paypal_order_id = trim(p_paypal_order_id))
      or (nullif(trim(p_paypal_capture_id), '') is not null
        and paypal_capture_id = trim(p_paypal_capture_id))
    order by case
      when nullif(trim(p_custom_id), '') is not null
        and public_reference = trim(p_custom_id) then 1
      when nullif(trim(p_paypal_capture_id), '') is not null
        and paypal_capture_id = trim(p_paypal_capture_id) then 2
      else 3
    end
    limit 1
    for update;

    if selected_session.id is null then
      event_processing_status := 'unmatched';
    else
      next_status := case p_event_type
        when 'PAYMENT.CAPTURE.COMPLETED' then 'completed'
        when 'PAYMENT.CAPTURE.DENIED' then 'denied'
        when 'PAYMENT.CAPTURE.REFUNDED' then 'refunded'
        when 'PAYMENT.CAPTURE.REVERSED' then 'reversed'
        else null
      end;

      if next_status is null then
        event_processing_status := 'ignored';
      elsif selected_session.status in ('refunded', 'reversed') then
        event_processing_status := 'ignored';
      elsif selected_session.status = 'completed'
        and next_status in ('denied', 'failed') then
        event_processing_status := 'ignored';
      else
        update public.donation_sessions
        set
          status = next_status,
          paypal_capture_id = coalesce(
            nullif(trim(p_paypal_capture_id), ''),
            paypal_capture_id
          ),
          provider_status = upper(coalesce(nullif(trim(p_resource_status), ''), next_status)),
          completed_at = case
            when next_status = 'completed' then coalesce(completed_at, now())
            else completed_at
          end,
          last_error_code = case
            when next_status in ('denied', 'failed', 'refunded', 'reversed')
              then next_status
            else null
          end
        where id = selected_session.id;
        event_processing_status := 'processed';
      end if;

      update public.paypal_order_events
      set
        donation_session_id = selected_session.id,
        company_id = selected_session.company_id,
        campaign_id = selected_session.campaign_id
      where id = inserted_event_id;
    end if;
  end if;

  update public.paypal_order_events
  set processing_status = event_processing_status, processed_at = now()
  where id = inserted_event_id;

  return jsonb_build_object(
    'status', event_processing_status,
    'paypal_order_event_id', inserted_event_id,
    'donation_session_id', selected_session.id
  );
end;
$$;

alter table public.paypal_merchant_connections enable row level security;
alter table public.donation_sessions enable row level security;
alter table public.paypal_order_events enable row level security;
alter table public.supporter_entitlements enable row level security;
alter table public.supporter_entitlement_events enable row level security;

create policy "paypal_merchant_connections_select_member"
on public.paypal_merchant_connections for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_organizations
    join public.campaigns
      on campaigns.id = campaign_organizations.campaign_id
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaign_organizations.organization_id = paypal_merchant_connections.organization_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "donation_sessions_select_member"
on public.donation_sessions for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = donation_sessions.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "paypal_order_events_select_member"
on public.paypal_order_events for select
to authenticated
using (
  company_id is not null
  and exists (
    select 1
    from public.memberships
    where memberships.company_id = paypal_order_events.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "supporter_entitlements_select_member"
on public.supporter_entitlements for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = supporter_entitlements.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "supporter_entitlement_events_select_member"
on public.supporter_entitlement_events for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = supporter_entitlement_events.company_id
      and memberships.user_id = (select auth.uid())
  )
);

revoke all on table public.paypal_merchant_connections from anon, authenticated;
revoke all on table public.donation_sessions from anon, authenticated;
revoke all on table public.paypal_order_events from anon, authenticated;
revoke all on table public.supporter_entitlements from anon, authenticated;
revoke all on table public.supporter_entitlement_events from anon, authenticated;

grant select on table public.paypal_merchant_connections to authenticated;
grant select on table public.donation_sessions to authenticated;
grant select on table public.paypal_order_events to authenticated;
grant select on table public.supporter_entitlements to authenticated;
grant select on table public.supporter_entitlement_events to authenticated;

grant select, insert, update, delete on table public.paypal_merchant_connections to service_role;
grant select, insert, update, delete on table public.donation_sessions to service_role;
grant select, insert, update, delete on table public.paypal_order_events to service_role;
grant select, insert, update, delete on table public.supporter_entitlements to service_role;
grant select, insert, update, delete on table public.supporter_entitlement_events to service_role;
grant usage, select on sequence public.paypal_order_events_id_seq to service_role;
grant usage, select on sequence public.supporter_entitlement_events_id_seq to service_role;

revoke all on function public.get_campaign_paypal_recipients(text) from public;
grant execute on function public.get_campaign_paypal_recipients(text)
  to anon, authenticated;

revoke all on function public.record_verified_paypal_order_webhook(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_verified_paypal_order_webhook(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;
