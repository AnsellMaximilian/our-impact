-- Our Impact developer identity and entitlements milestone.
-- Workspace-scoped recipient relationships, external supporters, deterministic
-- rules, API credentials, and a replay-safe outbound webhook queue.

alter table public.organizations
  add column created_by_company_id uuid
    references public.companies (id) on delete set null,
  add column created_by uuid
    references auth.users (id) on delete set null,
  add column visibility text not null default 'directory';

alter table public.organizations
  add constraint organizations_visibility_check
  check (visibility in ('private', 'directory'));

create index organizations_created_by_company_idx
  on public.organizations (created_by_company_id)
  where created_by_company_id is not null;

create index organizations_created_by_idx
  on public.organizations (created_by)
  where created_by is not null;

create table public.workspace_recipients (
  company_id uuid not null
    references public.companies (id) on delete cascade,
  organization_id bigint not null
    references public.organizations (id) on delete restrict,
  relationship_state text not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, organization_id),
  constraint workspace_recipients_state_check
    check (relationship_state in ('invited', 'active', 'blocked'))
);

create index workspace_recipients_organization_idx
  on public.workspace_recipients (organization_id, company_id);

create trigger workspace_recipients_set_updated_at
before update on public.workspace_recipients
for each row execute function private.set_updated_at();

create table public.developer_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies (id) on delete cascade,
  name text not null,
  publishable_key text not null unique,
  environment text not null default 'sandbox',
  allowed_origins text[] not null default '{}'::text[],
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id),
  constraint developer_projects_name_length
    check (char_length(name) between 2 and 80),
  constraint developer_projects_publishable_key_format
    check (publishable_key ~ '^oi_pk_test_[A-Za-z0-9_-]{24,}$'),
  constraint developer_projects_environment_check
    check (environment = 'sandbox'),
  constraint developer_projects_origins_limit
    check (cardinality(allowed_origins) <= 20)
);

create index developer_projects_company_idx
  on public.developer_projects (company_id, created_at desc);

create table public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  name text not null,
  key_prefix text not null unique,
  key_hash text not null unique,
  last_four text not null,
  created_by uuid references auth.users (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  constraint developer_api_keys_name_length
    check (char_length(name) between 2 and 80),
  constraint developer_api_keys_prefix_format
    check (key_prefix ~ '^oi_sk_test_[A-Za-z0-9_-]{8,24}$'),
  constraint developer_api_keys_hash_format
    check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint developer_api_keys_last_four_format
    check (last_four ~ '^[A-Za-z0-9_-]{4}$')
);

create index developer_api_keys_project_active_idx
  on public.developer_api_keys (project_id, created_at desc)
  where revoked_at is null;

create table public.supporters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  external_user_id text not null,
  display_name text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  unique (project_id, external_user_id),
  unique (id, project_id, company_id),
  constraint supporters_external_user_id_length
    check (char_length(external_user_id) between 1 and 120),
  constraint supporters_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120)
);

create index supporters_company_updated_idx
  on public.supporters (company_id, updated_at desc);

create table public.entitlement_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  name text not null,
  entitlement_key text not null,
  event_type text not null,
  threshold integer not null,
  evaluation_window text not null,
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  unique (project_id, entitlement_key),
  constraint entitlement_rules_name_length
    check (char_length(name) between 2 and 120),
  constraint entitlement_rules_key_format
    check (entitlement_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint entitlement_rules_event_type_format
    check (event_type ~ '^[a-z][a-z0-9_.]{2,79}$'),
  constraint entitlement_rules_threshold_positive check (threshold > 0),
  constraint entitlement_rules_window_check
    check (evaluation_window in ('lifetime', 'calendar_month')),
  constraint entitlement_rules_state_check
    check (state in ('draft', 'active', 'disabled'))
);

create index entitlement_rules_project_event_idx
  on public.entitlement_rules (project_id, event_type)
  where state = 'active';

create table public.developer_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  supporter_id uuid not null,
  external_event_id text not null,
  event_type text not null,
  source text not null default 'api',
  occurred_at timestamptz not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (supporter_id, project_id, company_id)
    references public.supporters (id, project_id, company_id) on delete restrict,
  unique (project_id, external_event_id),
  unique (id, project_id, company_id),
  constraint developer_events_external_id_length
    check (char_length(external_event_id) between 3 and 120),
  constraint developer_events_type_format
    check (event_type ~ '^[a-z][a-z0-9_.]{2,79}$'),
  constraint developer_events_source_check
    check (source in ('api', 'demo', 'paypal')),
  constraint developer_events_data_object
    check (jsonb_typeof(event_data) = 'object')
);

create index developer_events_supporter_occurred_idx
  on public.developer_events (project_id, supporter_id, occurred_at desc);

create index developer_events_project_type_occurred_idx
  on public.developer_events (project_id, event_type, occurred_at desc);

create table public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  supporter_id uuid not null,
  rule_id uuid not null references public.entitlement_rules (id) on delete restrict,
  entitlement_key text not null,
  state text not null default 'inactive',
  qualifying_count integer not null default 0,
  qualified_at timestamptz,
  revoked_at timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (supporter_id, project_id, company_id)
    references public.supporters (id, project_id, company_id) on delete restrict,
  unique (project_id, supporter_id, entitlement_key),
  unique (id, project_id, company_id),
  constraint user_entitlements_key_format
    check (entitlement_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint user_entitlements_state_check
    check (state in ('active', 'inactive')),
  constraint user_entitlements_count_nonnegative
    check (qualifying_count >= 0)
);

create index user_entitlements_supporter_state_idx
  on public.user_entitlements (project_id, supporter_id, state, entitlement_key);

create index user_entitlements_company_updated_idx
  on public.user_entitlements (company_id, updated_at desc);

create table public.user_entitlement_events (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null,
  project_id uuid not null,
  company_id uuid not null,
  supporter_id uuid not null,
  source_event_id uuid not null,
  event_type text not null,
  qualifying_count integer not null,
  created_at timestamptz not null default now(),
  foreign key (entitlement_id, project_id, company_id)
    references public.user_entitlements (id, project_id, company_id) on delete restrict,
  foreign key (supporter_id, project_id, company_id)
    references public.supporters (id, project_id, company_id) on delete restrict,
  foreign key (source_event_id, project_id, company_id)
    references public.developer_events (id, project_id, company_id) on delete restrict,
  constraint user_entitlement_events_type_check
    check (event_type in ('granted', 'revoked')),
  constraint user_entitlement_events_count_nonnegative
    check (qualifying_count >= 0)
);

create index user_entitlement_events_entitlement_created_idx
  on public.user_entitlement_events (entitlement_id, created_at desc);

create index user_entitlement_events_project_created_idx
  on public.user_entitlement_events (project_id, created_at desc);

create index user_entitlement_events_supporter_created_idx
  on public.user_entitlement_events (supporter_id, created_at desc);

create index user_entitlement_events_source_idx
  on public.user_entitlement_events (source_event_id);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  url text not null,
  description text,
  subscribed_events text[] not null default array[
    'donation.completed', 'entitlement.granted', 'entitlement.revoked'
  ]::text[],
  state text not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  unique (project_id, url),
  unique (id, project_id, company_id),
  constraint webhook_endpoints_url_length
    check (char_length(url) between 12 and 1000),
  constraint webhook_endpoints_url_https
    check (url ~ '^https://'),
  constraint webhook_endpoints_description_length
    check (description is null or char_length(description) <= 200),
  constraint webhook_endpoints_events_limit
    check (cardinality(subscribed_events) between 1 and 20),
  constraint webhook_endpoints_state_check
    check (state in ('active', 'disabled'))
);

create index webhook_endpoints_project_active_idx
  on public.webhook_endpoints (project_id, created_at desc)
  where state = 'active';

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid not null,
  project_id uuid not null,
  company_id uuid not null,
  source_event_id uuid,
  entitlement_event_id bigint,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  response_status smallint,
  last_error_code text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (webhook_endpoint_id, project_id, company_id)
    references public.webhook_endpoints (id, project_id, company_id) on delete cascade,
  foreign key (source_event_id, project_id, company_id)
    references public.developer_events (id, project_id, company_id) on delete restrict,
  foreign key (entitlement_event_id)
    references public.user_entitlement_events (id) on delete restrict,
  constraint webhook_deliveries_source_check
    check (num_nonnulls(source_event_id, entitlement_event_id) = 1),
  constraint webhook_deliveries_type_format
    check (event_type ~ '^[a-z][a-z0-9_.]{2,79}$'),
  constraint webhook_deliveries_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint webhook_deliveries_status_check
    check (status in ('pending', 'processing', 'retry_scheduled', 'delivered', 'failed')),
  constraint webhook_deliveries_attempt_nonnegative
    check (attempt_count >= 0),
  constraint webhook_deliveries_response_status_check
    check (response_status is null or response_status between 100 and 599),
  constraint webhook_deliveries_error_length
    check (last_error_code is null or char_length(last_error_code) <= 120)
);

create unique index webhook_deliveries_source_event_uidx
  on public.webhook_deliveries (webhook_endpoint_id, source_event_id)
  where source_event_id is not null;

create unique index webhook_deliveries_entitlement_event_uidx
  on public.webhook_deliveries (webhook_endpoint_id, entitlement_event_id)
  where entitlement_event_id is not null;

create index webhook_deliveries_due_idx
  on public.webhook_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'retry_scheduled');

create index webhook_deliveries_project_created_idx
  on public.webhook_deliveries (project_id, created_at desc);

create trigger developer_projects_set_updated_at
before update on public.developer_projects
for each row execute function private.set_updated_at();

create trigger supporters_set_updated_at
before update on public.supporters
for each row execute function private.set_updated_at();

create trigger entitlement_rules_set_updated_at
before update on public.entitlement_rules
for each row execute function private.set_updated_at();

create trigger user_entitlements_set_updated_at
before update on public.user_entitlements
for each row execute function private.set_updated_at();

create trigger webhook_endpoints_set_updated_at
before update on public.webhook_endpoints
for each row execute function private.set_updated_at();

create trigger webhook_deliveries_set_updated_at
before update on public.webhook_deliveries
for each row execute function private.set_updated_at();

create trigger developer_events_immutable
before update or delete on public.developer_events
for each row execute function private.reject_immutable_ledger_mutation();

create trigger user_entitlement_events_immutable
before update or delete on public.user_entitlement_events
for each row execute function private.reject_immutable_ledger_mutation();

create or replace function private.create_default_entitlement_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.entitlement_rules (
    project_id,
    company_id,
    name,
    entitlement_key,
    event_type,
    threshold,
    evaluation_window,
    state
  ) values
    (
      new.id, new.company_id, 'Supporter badge', 'supporter',
      'donation.completed', 1, 'lifetime', 'active'
    ),
    (
      new.id, new.company_id, 'Tier 3 monthly supporter', 'tier_3',
      'donation.completed', 3, 'calendar_month', 'active'
    );
  return new;
end;
$$;

create trigger developer_projects_create_default_rules
after insert on public.developer_projects
for each row execute function private.create_default_entitlement_rules();

create or replace function private.evaluate_developer_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_rule public.entitlement_rules%rowtype;
  qualifying_count integer;
  previous_state text;
  next_state text;
  selected_entitlement_id uuid;
  selected_valid_until timestamptz;
  window_start timestamptz;
  window_end timestamptz;
begin
  for selected_rule in
    select *
    from public.entitlement_rules
    where project_id = new.project_id
      and event_type = new.event_type
      and state = 'active'
    order by entitlement_key
  loop
    if selected_rule.evaluation_window = 'calendar_month' then
      window_start := date_trunc('month', new.occurred_at at time zone 'UTC')
        at time zone 'UTC';
      window_end := (
        date_trunc('month', new.occurred_at at time zone 'UTC') + interval '1 month'
      ) at time zone 'UTC';

      select count(*)::integer into qualifying_count
      from public.developer_events
      where project_id = new.project_id
        and supporter_id = new.supporter_id
        and event_type = selected_rule.event_type
        and occurred_at >= window_start
        and occurred_at < window_end;
      selected_valid_until := case
        when qualifying_count >= selected_rule.threshold then window_end
        else null
      end;
    else
      select count(*)::integer into qualifying_count
      from public.developer_events
      where project_id = new.project_id
        and supporter_id = new.supporter_id
        and event_type = selected_rule.event_type;
      selected_valid_until := null;
    end if;

    select state into previous_state
    from public.user_entitlements
    where project_id = new.project_id
      and supporter_id = new.supporter_id
      and entitlement_key = selected_rule.entitlement_key;

    next_state := case
      when qualifying_count >= selected_rule.threshold then 'active'
      else 'inactive'
    end;

    insert into public.user_entitlements (
      project_id,
      company_id,
      supporter_id,
      rule_id,
      entitlement_key,
      state,
      qualifying_count,
      qualified_at,
      revoked_at,
      valid_until
    ) values (
      new.project_id,
      new.company_id,
      new.supporter_id,
      selected_rule.id,
      selected_rule.entitlement_key,
      next_state,
      qualifying_count,
      case when next_state = 'active' then now() else null end,
      case when next_state = 'inactive' then now() else null end,
      selected_valid_until
    )
    on conflict (project_id, supporter_id, entitlement_key) do update
    set
      rule_id = excluded.rule_id,
      state = excluded.state,
      qualifying_count = excluded.qualifying_count,
      qualified_at = case
        when public.user_entitlements.state <> 'active'
          and excluded.state = 'active' then now()
        else public.user_entitlements.qualified_at
      end,
      revoked_at = case
        when public.user_entitlements.state = 'active'
          and excluded.state = 'inactive' then now()
        when excluded.state = 'active' then null
        else public.user_entitlements.revoked_at
      end,
      valid_until = excluded.valid_until
    returning id into selected_entitlement_id;

    if (previous_state is null and next_state = 'active')
      or (previous_state is distinct from next_state and previous_state is not null) then
      insert into public.user_entitlement_events (
        entitlement_id,
        project_id,
        company_id,
        supporter_id,
        source_event_id,
        event_type,
        qualifying_count
      ) values (
        selected_entitlement_id,
        new.project_id,
        new.company_id,
        new.supporter_id,
        new.id,
        case when next_state = 'active' then 'granted' else 'revoked' end,
        qualifying_count
      );
    end if;
  end loop;
  return new;
end;
$$;

create trigger developer_events_evaluate_entitlements
after insert on public.developer_events
for each row execute function private.evaluate_developer_entitlements();

create or replace function private.queue_developer_event_webhooks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.webhook_deliveries (
    webhook_endpoint_id,
    project_id,
    company_id,
    source_event_id,
    event_type,
    payload
  )
  select
    endpoint.id,
    new.project_id,
    new.company_id,
    new.id,
    new.event_type,
    jsonb_build_object(
      'id', new.id,
      'type', new.event_type,
      'created_at', new.created_at,
      'data', jsonb_build_object(
        'external_event_id', new.external_event_id,
        'external_user_id', supporter.external_user_id,
        'occurred_at', new.occurred_at,
        'properties', new.event_data
      )
    )
  from public.webhook_endpoints endpoint
  join public.supporters supporter on supporter.id = new.supporter_id
  where endpoint.project_id = new.project_id
    and endpoint.state = 'active'
    and new.event_type = any(endpoint.subscribed_events)
  on conflict do nothing;
  return new;
end;
$$;

create trigger developer_events_queue_webhooks
after insert on public.developer_events
for each row execute function private.queue_developer_event_webhooks();

create or replace function private.queue_entitlement_webhooks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  outbound_type text := concat('entitlement.', new.event_type);
begin
  insert into public.webhook_deliveries (
    webhook_endpoint_id,
    project_id,
    company_id,
    entitlement_event_id,
    event_type,
    payload
  )
  select
    endpoint.id,
    new.project_id,
    new.company_id,
    new.id,
    outbound_type,
    jsonb_build_object(
      'id', new.id,
      'type', outbound_type,
      'created_at', new.created_at,
      'data', jsonb_build_object(
        'external_user_id', supporter.external_user_id,
        'entitlement', entitlement.entitlement_key,
        'state', entitlement.state,
        'qualifying_count', new.qualifying_count,
        'valid_until', entitlement.valid_until
      )
    )
  from public.webhook_endpoints endpoint
  join public.supporters supporter on supporter.id = new.supporter_id
  join public.user_entitlements entitlement on entitlement.id = new.entitlement_id
  where endpoint.project_id = new.project_id
    and endpoint.state = 'active'
    and outbound_type = any(endpoint.subscribed_events)
  on conflict do nothing;
  return new;
end;
$$;

create trigger user_entitlement_events_queue_webhooks
after insert on public.user_entitlement_events
for each row execute function private.queue_entitlement_webhooks();

create or replace function public.claim_developer_webhook_deliveries(
  p_limit integer default 20,
  p_project_id uuid default null
)
returns setof public.webhook_deliveries
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with selected as (
    select delivery.id
    from public.webhook_deliveries delivery
    where (
        (
          delivery.status in ('pending', 'retry_scheduled')
          and delivery.next_attempt_at <= now()
        )
        or (
          delivery.status = 'processing'
          and delivery.last_attempt_at < now() - interval '10 minutes'
        )
      )
      and (p_project_id is null or delivery.project_id = p_project_id)
    order by delivery.next_attempt_at, delivery.created_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  update public.webhook_deliveries delivery
  set
    status = 'processing',
    attempt_count = delivery.attempt_count + 1,
    last_attempt_at = now()
  from selected
  where delivery.id = selected.id
  returning delivery.*;
end;
$$;

revoke all on function public.claim_developer_webhook_deliveries(integer, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_developer_webhook_deliveries(integer, uuid)
  to service_role;

create or replace function public.create_workspace_recipient(
  p_company_id uuid,
  p_name text,
  p_short_description text,
  p_category text,
  p_country_code text,
  p_website_url text,
  p_brand_color text
)
returns public.organizations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_organization public.organizations;
begin
  insert into public.organizations (
    slug,
    name,
    short_description,
    category,
    country_code,
    website_url,
    verification_state,
    brand_color,
    is_active,
    created_by_company_id,
    created_by,
    visibility
  ) values (
    concat(
      trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g')),
      '-',
      left(gen_random_uuid()::text, 8)
    ),
    p_name,
    p_short_description,
    p_category,
    upper(p_country_code),
    nullif(trim(p_website_url), ''),
    'fictional',
    p_brand_color,
    true,
    p_company_id,
    (select auth.uid()),
    'private'
  )
  returning * into created_organization;

  insert into public.workspace_recipients (
    company_id,
    organization_id,
    relationship_state,
    created_by
  ) values (
    p_company_id,
    created_organization.id,
    'active',
    (select auth.uid())
  );

  return created_organization;
end;
$$;

revoke all on function public.create_workspace_recipient(
  uuid, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_workspace_recipient(
  uuid, text, text, text, text, text, text
) to authenticated;

create or replace function public.create_draft_campaign(
  p_company_id uuid,
  p_title text,
  p_summary text,
  p_budget_minor bigint,
  p_currency text,
  p_timezone text,
  p_period_cadence text,
  p_allocation_model text,
  p_organization_ids bigint[]
)
returns public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_campaign public.campaigns;
  organization_count integer;
  unique_organization_count integer;
begin
  organization_count := coalesce(array_length(p_organization_ids, 1), 0);
  select count(distinct organization_id)
    into unique_organization_count
  from unnest(p_organization_ids) as selected(organization_id);

  if organization_count < 2 or organization_count > 5 then
    raise exception 'Select between 2 and 5 organizations.';
  end if;

  if unique_organization_count <> organization_count then
    raise exception 'Organizations must be unique.';
  end if;

  if (
    select count(*)
    from public.organizations organization
    join public.workspace_recipients recipient
      on recipient.organization_id = organization.id
    where organization.id = any(p_organization_ids)
      and organization.is_active
      and recipient.company_id = p_company_id
      and recipient.relationship_state = 'active'
  ) <> organization_count then
    raise exception 'One or more organizations are unavailable to this workspace.';
  end if;

  insert into public.campaigns (
    company_id,
    public_id,
    title,
    summary,
    budget_minor,
    currency,
    timezone,
    period_cadence,
    allocation_model,
    status,
    created_by
  ) values (
    p_company_id,
    concat(
      trim(both '-' from regexp_replace(lower(p_title), '[^a-z0-9]+', '-', 'g')),
      '-',
      left(gen_random_uuid()::text, 8)
    ),
    p_title,
    p_summary,
    p_budget_minor,
    upper(p_currency),
    p_timezone,
    p_period_cadence,
    p_allocation_model,
    'draft',
    (select auth.uid())
  )
  returning * into created_campaign;

  insert into public.campaign_organizations (
    campaign_id,
    organization_id,
    display_order
  )
  select
    created_campaign.id,
    selected.organization_id,
    selected.ordinality::smallint
  from unnest(p_organization_ids) with ordinality
    as selected(organization_id, ordinality);

  return created_campaign;
end;
$$;

drop policy if exists "organizations_select_active" on public.organizations;

create policy "organizations_select_public_or_member"
on public.organizations for select
to anon, authenticated
using (
  is_active
  and (
    visibility = 'directory'
    or exists (
      select 1
      from public.campaign_organizations slate
      join public.campaigns campaign on campaign.id = slate.campaign_id
      where slate.organization_id = organizations.id
        and campaign.status = 'published'
    )
    or exists (
      select 1
      from public.workspace_recipients recipient
      join public.memberships membership
        on membership.company_id = recipient.company_id
      where recipient.organization_id = organizations.id
        and membership.user_id = (select auth.uid())
    )
  )
);

create policy "organizations_insert_workspace_admin"
on public.organizations for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and visibility = 'private'
  and exists (
    select 1
    from public.memberships membership
    where membership.company_id = created_by_company_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
);

alter table public.workspace_recipients enable row level security;
alter table public.developer_projects enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.supporters enable row level security;
alter table public.entitlement_rules enable row level security;
alter table public.developer_events enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.user_entitlement_events enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy "workspace_recipients_select_member"
on public.workspace_recipients for select
to authenticated
using (
  exists (
    select 1
    from public.memberships membership
    where membership.company_id = workspace_recipients.company_id
      and membership.user_id = (select auth.uid())
  )
);

create policy "workspace_recipients_insert_admin"
on public.workspace_recipients for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.memberships membership
    where membership.company_id = workspace_recipients.company_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
);

create policy "workspace_recipients_update_admin"
on public.workspace_recipients for update
to authenticated
using (
  exists (
    select 1
    from public.memberships membership
    where membership.company_id = workspace_recipients.company_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.memberships membership
    where membership.company_id = workspace_recipients.company_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin')
  )
);

revoke all on table public.workspace_recipients from anon;
grant select, insert, update on table public.workspace_recipients to authenticated;
grant select, insert on table public.organizations to authenticated;

revoke all on table public.developer_projects from anon, authenticated;
revoke all on table public.developer_api_keys from anon, authenticated;
revoke all on table public.supporters from anon, authenticated;
revoke all on table public.entitlement_rules from anon, authenticated;
revoke all on table public.developer_events from anon, authenticated;
revoke all on table public.user_entitlements from anon, authenticated;
revoke all on table public.user_entitlement_events from anon, authenticated;
revoke all on table public.webhook_endpoints from anon, authenticated;
revoke all on table public.webhook_deliveries from anon, authenticated;

grant select, insert, update, delete on table public.developer_projects to service_role;
grant select, insert, update, delete on table public.developer_api_keys to service_role;
grant select, insert, update, delete on table public.supporters to service_role;
grant select, insert, update, delete on table public.entitlement_rules to service_role;
grant select, insert on table public.developer_events to service_role;
grant select, insert, update, delete on table public.user_entitlements to service_role;
grant select, insert on table public.user_entitlement_events to service_role;
grant select, insert, update, delete on table public.webhook_endpoints to service_role;
grant select, insert, update, delete on table public.webhook_deliveries to service_role;
grant usage, select on sequence public.user_entitlement_events_id_seq to service_role;

revoke all on all functions in schema private from public, anon, authenticated;
