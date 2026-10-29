-- Our Impact Stage 2
-- Timezone-aware period schedules, replay-safe allocation snapshots,
-- simulated donation status records, and append-only audit history.

alter table public.campaigns
  add column close_local_time time without time zone not null default time '20:00:00',
  add column close_weekday smallint not null default 5;

alter table public.campaigns
  add constraint campaigns_close_weekday check (close_weekday between 0 and 6);

alter table public.campaign_periods
  add column period_cadence text not null default 'weekly',
  add column close_local_time time without time zone not null default time '20:00:00',
  add column close_weekday smallint not null default 5,
  add column allocation_rule_version text not null default 'stage2-v1';

alter table public.campaign_periods
  add constraint campaign_periods_cadence check (period_cadence in ('daily', 'weekly')),
  add constraint campaign_periods_close_weekday check (close_weekday between 0 and 6),
  add constraint campaign_periods_rule_version check (
    char_length(allocation_rule_version) between 3 and 40
  );

update public.campaigns
set
  close_local_time = latest_period.local_close_time,
  close_weekday = latest_period.local_close_weekday
from (
  select distinct on (campaign_periods.campaign_id)
    campaign_periods.campaign_id,
    (campaign_periods.closes_at at time zone campaign_periods.timezone)::time
      as local_close_time,
    extract(
      dow from (campaign_periods.closes_at at time zone campaign_periods.timezone)
    )::smallint as local_close_weekday
  from public.campaign_periods
  order by campaign_periods.campaign_id, campaign_periods.sequence_number desc
) as latest_period
where campaigns.id = latest_period.campaign_id;

update public.campaign_periods
set
  period_cadence = campaigns.period_cadence,
  close_local_time = campaigns.close_local_time,
  close_weekday = campaigns.close_weekday
from public.campaigns
where campaigns.id = campaign_periods.campaign_id;

alter table public.campaigns
  add constraint campaigns_id_company_unique unique (id, company_id);

create table public.allocation_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  period_id uuid not null,
  revision integer not null default 1,
  supersedes_snapshot_id uuid references public.allocation_snapshots (id) on delete restrict,
  state text not null,
  total_valid_votes bigint not null,
  budget_minor bigint not null,
  allocated_minor bigint not null,
  unallocated_minor bigint not null,
  currency text not null,
  allocation_model text not null,
  rule_version text not null default 'stage2-v1',
  close_source text not null,
  zero_vote_resolution text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (period_id, revision),
  unique (id, period_id, campaign_id),
  constraint allocation_snapshots_period_campaign_fkey
    foreign key (period_id, campaign_id)
    references public.campaign_periods (id, campaign_id)
    on delete restrict,
  constraint allocation_snapshots_revision_positive check (revision > 0),
  constraint allocation_snapshots_state check (
    state in ('allocated', 'requires_review', 'canceled')
  ),
  constraint allocation_snapshots_votes_nonnegative check (total_valid_votes >= 0),
  constraint allocation_snapshots_budget_positive check (budget_minor > 0),
  constraint allocation_snapshots_amounts_nonnegative check (
    allocated_minor >= 0 and unallocated_minor >= 0
  ),
  constraint allocation_snapshots_amounts_balance check (
    allocated_minor + unallocated_minor = budget_minor
  ),
  constraint allocation_snapshots_currency check (currency ~ '^[A-Z]{3}$'),
  constraint allocation_snapshots_model check (
    allocation_model in ('winner_takes_all', 'proportional', 'hybrid')
  ),
  constraint allocation_snapshots_source check (
    close_source in ('scheduled', 'manual_close', 'manual_review')
  ),
  constraint allocation_snapshots_zero_resolution check (
    zero_vote_resolution is null
    or zero_vote_resolution in ('manual_review', 'equal_split', 'canceled')
  ),
  constraint allocation_snapshots_review_consistency check (
    (state = 'requires_review' and total_valid_votes = 0
      and allocated_minor = 0 and zero_vote_resolution = 'manual_review')
    or state <> 'requires_review'
  )
);

create index allocation_snapshots_campaign_created_idx
  on public.allocation_snapshots (campaign_id, created_at desc);

create index allocation_snapshots_period_revision_idx
  on public.allocation_snapshots (period_id, revision desc);

create index allocation_snapshots_supersedes_idx
  on public.allocation_snapshots (supersedes_snapshot_id)
  where supersedes_snapshot_id is not null;

create index allocation_snapshots_created_by_idx
  on public.allocation_snapshots (created_by)
  where created_by is not null;

create index allocation_snapshots_period_campaign_idx
  on public.allocation_snapshots (period_id, campaign_id);

create table public.allocation_lines (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null,
  campaign_id uuid not null,
  period_id uuid not null,
  organization_id bigint not null,
  vote_count bigint not null,
  amount_minor bigint not null,
  created_at timestamptz not null default now(),
  unique (snapshot_id, organization_id),
  unique (id, snapshot_id, campaign_id, period_id, organization_id),
  constraint allocation_lines_snapshot_fkey
    foreign key (snapshot_id, period_id, campaign_id)
    references public.allocation_snapshots (id, period_id, campaign_id)
    on delete restrict,
  constraint allocation_lines_campaign_organization_fkey
    foreign key (campaign_id, organization_id)
    references public.campaign_organizations (campaign_id, organization_id)
    on delete restrict,
  constraint allocation_lines_vote_count_nonnegative check (vote_count >= 0),
  constraint allocation_lines_amount_nonnegative check (amount_minor >= 0)
);

create index allocation_lines_period_idx
  on public.allocation_lines (period_id, snapshot_id);

create index allocation_lines_campaign_organization_idx
  on public.allocation_lines (campaign_id, organization_id);

create index allocation_lines_snapshot_period_campaign_idx
  on public.allocation_lines (snapshot_id, period_id, campaign_id);

create table public.donation_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  campaign_id uuid not null,
  period_id uuid not null,
  allocation_snapshot_id uuid not null,
  allocation_line_id uuid not null unique,
  organization_id bigint not null,
  amount_minor bigint not null,
  currency text not null,
  status text not null default 'allocated',
  environment text not null default 'simulation',
  evidence_reference text,
  current_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_records_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint donation_records_allocation_line_fkey
    foreign key (
      allocation_line_id,
      allocation_snapshot_id,
      campaign_id,
      period_id,
      organization_id
    ) references public.allocation_lines (
      id,
      snapshot_id,
      campaign_id,
      period_id,
      organization_id
    ) on delete restrict,
  constraint donation_records_amount_positive check (amount_minor > 0),
  constraint donation_records_currency check (currency ~ '^[A-Z]{3}$'),
  constraint donation_records_status check (
    status in (
      'allocated',
      'approved_for_payment',
      'payment_pending',
      'confirmed_paid',
      'payment_failed',
      'canceled',
      'requires_reconciliation'
    )
  ),
  constraint donation_records_environment check (
    environment in ('simulation', 'sandbox', 'live')
  ),
  constraint donation_records_evidence_length check (
    evidence_reference is null or char_length(evidence_reference) <= 500
  ),
  constraint donation_records_note_length check (
    current_note is null or char_length(current_note) <= 1000
  )
);

create index donation_records_company_status_idx
  on public.donation_records (company_id, status, updated_at desc);

create index donation_records_campaign_period_idx
  on public.donation_records (campaign_id, period_id);

create index donation_records_snapshot_idx
  on public.donation_records (allocation_snapshot_id);

create index donation_records_organization_idx
  on public.donation_records (organization_id);

create index donation_records_allocation_line_composite_idx
  on public.donation_records (
    allocation_line_id,
    allocation_snapshot_id,
    campaign_id,
    period_id,
    organization_id
  );

create index donation_records_campaign_company_idx
  on public.donation_records (campaign_id, company_id);

create table public.donation_status_events (
  id uuid primary key default gen_random_uuid(),
  donation_record_id uuid not null references public.donation_records (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  evidence_reference text,
  created_at timestamptz not null default now(),
  constraint donation_status_events_from_status check (
    from_status is null or from_status in (
      'allocated',
      'approved_for_payment',
      'payment_pending',
      'confirmed_paid',
      'payment_failed',
      'canceled',
      'requires_reconciliation'
    )
  ),
  constraint donation_status_events_to_status check (
    to_status in (
      'allocated',
      'approved_for_payment',
      'payment_pending',
      'confirmed_paid',
      'payment_failed',
      'canceled',
      'requires_reconciliation'
    )
  ),
  constraint donation_status_events_note_length check (
    note is null or char_length(note) <= 1000
  ),
  constraint donation_status_events_evidence_length check (
    evidence_reference is null or char_length(evidence_reference) <= 500
  )
);

create index donation_status_events_record_created_idx
  on public.donation_status_events (donation_record_id, created_at desc);

create index donation_status_events_actor_idx
  on public.donation_status_events (actor_user_id)
  where actor_user_id is not null;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_action_length check (char_length(action) between 3 and 100),
  constraint audit_events_entity_type_length check (
    char_length(entity_type) between 3 and 60
  ),
  constraint audit_events_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_company_created_idx
  on public.audit_events (company_id, created_at desc);

create index audit_events_actor_idx
  on public.audit_events (actor_user_id)
  where actor_user_id is not null;

create index audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

alter table public.allocation_snapshots enable row level security;
alter table public.allocation_lines enable row level security;
alter table public.donation_records enable row level security;
alter table public.donation_status_events enable row level security;
alter table public.audit_events enable row level security;

create policy "allocation_snapshots_select_member"
on public.allocation_snapshots for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaigns.id = allocation_snapshots.campaign_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "allocation_lines_select_member"
on public.allocation_lines for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaigns.id = allocation_lines.campaign_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "donation_records_select_member"
on public.donation_records for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = donation_records.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "donation_status_events_select_member"
on public.donation_status_events for select
to authenticated
using (
  exists (
    select 1
    from public.donation_records
    join public.memberships
      on memberships.company_id = donation_records.company_id
    where donation_records.id = donation_status_events.donation_record_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "audit_events_select_member"
on public.audit_events for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = audit_events.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create trigger donation_records_set_updated_at
before update on public.donation_records
for each row execute function private.set_updated_at();

create or replace function private.reject_immutable_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; create a new revision or event instead.', tg_table_name;
end;
$$;

create trigger allocation_snapshots_immutable
before update or delete on public.allocation_snapshots
for each row execute function private.reject_immutable_ledger_mutation();

create trigger allocation_lines_immutable
before update or delete on public.allocation_lines
for each row execute function private.reject_immutable_ledger_mutation();

create trigger donation_status_events_immutable
before update or delete on public.donation_status_events
for each row execute function private.reject_immutable_ledger_mutation();

create trigger audit_events_immutable
before update or delete on public.audit_events
for each row execute function private.reject_immutable_ledger_mutation();

create or replace function private.next_campaign_close(
  p_reference timestamptz,
  p_timezone text,
  p_close_local_time time without time zone,
  p_period_cadence text,
  p_close_weekday integer
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  local_reference timestamp without time zone;
  local_candidate timestamp without time zone;
  days_until_close integer;
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Unknown IANA time zone.';
  end if;

  local_reference := p_reference at time zone p_timezone;

  if p_period_cadence = 'daily' then
    local_candidate := local_reference::date + p_close_local_time;
    if local_candidate <= local_reference then
      local_candidate := local_candidate + interval '1 day';
    end if;
  elsif p_period_cadence = 'weekly' then
    days_until_close := (
      p_close_weekday - extract(dow from local_reference)::integer + 7
    ) % 7;
    local_candidate := local_reference::date
      + make_interval(days => days_until_close)
      + p_close_local_time;
    if local_candidate <= local_reference then
      local_candidate := local_candidate + interval '7 days';
    end if;
  else
    raise exception 'Unsupported period cadence.';
  end if;

  return local_candidate at time zone p_timezone;
end;
$$;

drop function public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, bigint[]
);

create function public.create_draft_campaign(
  p_company_id uuid,
  p_title text,
  p_summary text,
  p_budget_minor bigint,
  p_currency text,
  p_timezone text,
  p_period_cadence text,
  p_allocation_model text,
  p_close_local_time text,
  p_close_weekday integer,
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
  parsed_close_time time without time zone;
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
  if p_close_weekday not between 0 and 6 then
    raise exception 'Choose a valid weekly close day.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Choose a valid IANA time zone.';
  end if;

  begin
    parsed_close_time := p_close_local_time::time;
  exception when others then
    raise exception 'Choose a valid local close time.';
  end;

  if (
    select count(*)
    from public.organizations
    where id = any(p_organization_ids) and is_active
  ) <> organization_count then
    raise exception 'One or more organizations are unavailable.';
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
    close_local_time,
    close_weekday,
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
    parsed_close_time,
    p_close_weekday,
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

drop function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, bigint[]
);

create function public.update_draft_campaign(
  p_campaign_id uuid,
  p_title text,
  p_summary text,
  p_budget_minor bigint,
  p_currency text,
  p_timezone text,
  p_period_cadence text,
  p_allocation_model text,
  p_close_local_time text,
  p_close_weekday integer,
  p_organization_ids bigint[]
)
returns public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_campaign public.campaigns;
  organization_count integer;
  unique_organization_count integer;
  parsed_close_time time without time zone;
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
  if p_close_weekday not between 0 and 6 then
    raise exception 'Choose a valid weekly close day.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Choose a valid IANA time zone.';
  end if;

  begin
    parsed_close_time := p_close_local_time::time;
  exception when others then
    raise exception 'Choose a valid local close time.';
  end;

  if (
    select count(*)
    from public.organizations
    where id = any(p_organization_ids) and is_active
  ) <> organization_count then
    raise exception 'One or more organizations are unavailable.';
  end if;

  update public.campaigns
  set
    title = p_title,
    summary = p_summary,
    budget_minor = p_budget_minor,
    currency = upper(p_currency),
    timezone = p_timezone,
    period_cadence = p_period_cadence,
    allocation_model = p_allocation_model,
    close_local_time = parsed_close_time,
    close_weekday = p_close_weekday
  where id = p_campaign_id
    and status = 'draft'
  returning * into updated_campaign;

  if updated_campaign.id is null then
    raise exception 'Only an authorized draft campaign can be edited.';
  end if;

  delete from public.campaign_organizations
  where campaign_id = p_campaign_id;

  insert into public.campaign_organizations (
    campaign_id,
    organization_id,
    display_order
  )
  select
    p_campaign_id,
    selected.organization_id,
    selected.ordinality::smallint
  from unnest(p_organization_ids) with ordinality
    as selected(organization_id, ordinality);

  return updated_campaign;
end;
$$;

create or replace function public.publish_campaign(p_campaign_id uuid)
returns public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  published_campaign public.campaigns;
  first_close timestamptz;
begin
  if (
    select count(*)
    from public.campaign_organizations
    where campaign_id = p_campaign_id
  ) not between 2 and 5 then
    raise exception 'A campaign needs between 2 and 5 organizations before publishing.';
  end if;

  update public.campaigns
  set
    status = 'published',
    published_at = coalesce(published_at, now())
  where id = p_campaign_id
    and status = 'draft'
  returning * into published_campaign;

  if published_campaign.id is null then
    raise exception 'Only an authorized draft campaign can be published.';
  end if;

  first_close := private.next_campaign_close(
    now(),
    published_campaign.timezone,
    published_campaign.close_local_time,
    published_campaign.period_cadence,
    published_campaign.close_weekday
  );

  insert into public.campaign_periods (
    campaign_id,
    sequence_number,
    opens_at,
    closes_at,
    status,
    budget_minor,
    currency,
    allocation_model,
    timezone,
    period_cadence,
    close_local_time,
    close_weekday,
    allocation_rule_version
  ) values (
    published_campaign.id,
    1,
    now(),
    first_close,
    'open',
    published_campaign.budget_minor,
    published_campaign.currency,
    published_campaign.allocation_model,
    published_campaign.timezone,
    published_campaign.period_cadence,
    published_campaign.close_local_time,
    published_campaign.close_weekday,
    'stage2-v1'
  );

  return published_campaign;
end;
$$;

create or replace function private.finalize_campaign_period(
  p_period_id uuid,
  p_source text,
  p_actor uuid,
  p_allow_early boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_campaign_id uuid;
  selected_company_id uuid;
  selected_campaign_status text;
  selected_sequence integer;
  selected_closes_at timestamptz;
  selected_period_status text;
  selected_budget bigint;
  selected_currency text;
  selected_model text;
  selected_timezone text;
  selected_cadence text;
  selected_close_time time without time zone;
  selected_close_weekday integer;
  selected_rule_version text;
  created_snapshot_id uuid;
  existing_snapshot_id uuid;
  valid_vote_total bigint;
  next_close timestamptz;
begin
  if p_source not in ('scheduled', 'manual_close') then
    raise exception 'Unsupported close source.';
  end if;

  select
    campaign_periods.campaign_id,
    campaigns.company_id,
    campaigns.status,
    campaign_periods.sequence_number,
    campaign_periods.closes_at,
    campaign_periods.status,
    campaign_periods.budget_minor,
    campaign_periods.currency,
    campaign_periods.allocation_model,
    campaign_periods.timezone,
    campaign_periods.period_cadence,
    campaign_periods.close_local_time,
    campaign_periods.close_weekday,
    campaign_periods.allocation_rule_version
  into
    selected_campaign_id,
    selected_company_id,
    selected_campaign_status,
    selected_sequence,
    selected_closes_at,
    selected_period_status,
    selected_budget,
    selected_currency,
    selected_model,
    selected_timezone,
    selected_cadence,
    selected_close_time,
    selected_close_weekday,
    selected_rule_version
  from public.campaign_periods
  join public.campaigns
    on campaigns.id = campaign_periods.campaign_id
  where campaign_periods.id = p_period_id
  for update of campaign_periods;

  if selected_campaign_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  select allocation_snapshots.id
    into existing_snapshot_id
  from public.allocation_snapshots
  where allocation_snapshots.period_id = p_period_id
  order by allocation_snapshots.revision desc
  limit 1;

  if existing_snapshot_id is not null then
    return jsonb_build_object(
      'status', 'already_finalized',
      'snapshot_id', existing_snapshot_id,
      'period_id', p_period_id
    );
  end if;

  if selected_period_status <> 'open' then
    return jsonb_build_object('status', 'not_open', 'period_id', p_period_id);
  end if;

  if not p_allow_early and selected_closes_at > now() then
    return jsonb_build_object('status', 'not_due', 'period_id', p_period_id);
  end if;

  select count(*)
    into valid_vote_total
  from public.votes
  where period_id = p_period_id
    and is_valid;

  update public.campaign_periods
  set status = 'closed', closed_at = now()
  where id = p_period_id;

  insert into public.allocation_snapshots (
    campaign_id,
    period_id,
    revision,
    state,
    total_valid_votes,
    budget_minor,
    allocated_minor,
    unallocated_minor,
    currency,
    allocation_model,
    rule_version,
    close_source,
    zero_vote_resolution,
    created_by
  ) values (
    selected_campaign_id,
    p_period_id,
    1,
    case when valid_vote_total = 0 then 'requires_review' else 'allocated' end,
    valid_vote_total,
    selected_budget,
    case when valid_vote_total = 0 then 0 else selected_budget end,
    case when valid_vote_total = 0 then selected_budget else 0 end,
    selected_currency,
    selected_model,
    selected_rule_version,
    p_source,
    case when valid_vote_total = 0 then 'manual_review' else null end,
    p_actor
  )
  returning id into created_snapshot_id;

  if valid_vote_total = 0 then
    insert into public.allocation_lines (
      snapshot_id,
      campaign_id,
      period_id,
      organization_id,
      vote_count,
      amount_minor
    )
    select
      created_snapshot_id,
      selected_campaign_id,
      p_period_id,
      campaign_organizations.organization_id,
      0,
      0
    from public.campaign_organizations
    where campaign_organizations.campaign_id = selected_campaign_id
    order by campaign_organizations.display_order;
  else
    insert into public.allocation_lines (
      snapshot_id,
      campaign_id,
      period_id,
      organization_id,
      vote_count,
      amount_minor
    )
    with vote_counts as (
      select
        campaign_organizations.organization_id,
        campaign_organizations.display_order,
        count(votes.id) filter (where votes.is_valid)::bigint as vote_count
      from public.campaign_organizations
      left join public.votes
        on votes.campaign_id = campaign_organizations.campaign_id
       and votes.organization_id = campaign_organizations.organization_id
       and votes.period_id = p_period_id
      where campaign_organizations.campaign_id = selected_campaign_id
      group by
        campaign_organizations.organization_id,
        campaign_organizations.display_order
    ), weighted as (
      select
        vote_counts.*,
        case selected_model
          when 'winner_takes_all' then
            case
              when vote_count = max(vote_count) over () then 1::bigint
              else 0::bigint
            end
          else vote_count
        end as weight,
        case
          when selected_model = 'hybrid' then selected_budget / 10
          else 0
        end as base_amount
      from vote_counts
    ), prepared as (
      select
        weighted.*,
        sum(weight) over () as total_weight,
        sum(base_amount) over () as base_total
      from weighted
    ), floored as (
      select
        prepared.*,
        floor(
          (selected_budget - base_total)::numeric * weight::numeric
          / total_weight::numeric
        )::bigint as proportional_floor,
        mod(
          (selected_budget - base_total)::numeric * weight::numeric,
          total_weight::numeric
        ) as proportional_remainder
      from prepared
    ), ranked as (
      select
        floored.*,
        row_number() over (
          order by
            case when weight > 0 then 0 else 1 end,
            proportional_remainder desc,
            display_order,
            organization_id
        ) as remainder_rank,
        selected_budget
          - sum(base_amount + proportional_floor) over () as leftover_minor
      from floored
    )
    select
      created_snapshot_id,
      selected_campaign_id,
      p_period_id,
      ranked.organization_id,
      ranked.vote_count,
      ranked.base_amount
        + ranked.proportional_floor
        + case
            when ranked.weight > 0
              and ranked.remainder_rank <= ranked.leftover_minor
              then 1
            else 0
          end
    from ranked
    order by ranked.display_order;

    insert into public.donation_records (
      company_id,
      campaign_id,
      period_id,
      allocation_snapshot_id,
      allocation_line_id,
      organization_id,
      amount_minor,
      currency,
      status,
      environment
    )
    select
      selected_company_id,
      allocation_lines.campaign_id,
      allocation_lines.period_id,
      allocation_lines.snapshot_id,
      allocation_lines.id,
      allocation_lines.organization_id,
      allocation_lines.amount_minor,
      selected_currency,
      'allocated',
      'simulation'
    from public.allocation_lines
    where allocation_lines.snapshot_id = created_snapshot_id
      and allocation_lines.amount_minor > 0;

    insert into public.donation_status_events (
      donation_record_id,
      actor_user_id,
      from_status,
      to_status,
      note
    )
    select
      donation_records.id,
      p_actor,
      null,
      'allocated',
      case p_source
        when 'scheduled' then 'Created by scheduled period close.'
        else 'Created by manual period close.'
      end
    from public.donation_records
    where donation_records.allocation_snapshot_id = created_snapshot_id;
  end if;

  insert into public.audit_events (
    company_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    selected_company_id,
    p_actor,
    'period.finalized',
    'campaign_period',
    p_period_id,
    jsonb_build_object(
      'snapshot_id', created_snapshot_id,
      'source', p_source,
      'valid_vote_total', valid_vote_total,
      'budget_minor', selected_budget,
      'allocation_state', case
        when valid_vote_total = 0 then 'requires_review'
        else 'allocated'
      end
    )
  );

  if selected_campaign_status = 'published' then
    next_close := private.next_campaign_close(
      now(),
      selected_timezone,
      selected_close_time,
      selected_cadence,
      selected_close_weekday
    );

    insert into public.campaign_periods (
      campaign_id,
      sequence_number,
      opens_at,
      closes_at,
      status,
      budget_minor,
      currency,
      allocation_model,
      timezone,
      period_cadence,
      close_local_time,
      close_weekday,
      allocation_rule_version
    ) values (
      selected_campaign_id,
      selected_sequence + 1,
      now(),
      next_close,
      'open',
      selected_budget,
      selected_currency,
      selected_model,
      selected_timezone,
      selected_cadence,
      selected_close_time,
      selected_close_weekday,
      selected_rule_version
    )
    on conflict (campaign_id, sequence_number) do nothing;
  end if;

  return jsonb_build_object(
    'status', case when valid_vote_total = 0 then 'requires_review' else 'allocated' end,
    'snapshot_id', created_snapshot_id,
    'period_id', p_period_id,
    'valid_vote_total', valid_vote_total,
    'allocated_minor', case when valid_vote_total = 0 then 0 else selected_budget end,
    'unallocated_minor', case when valid_vote_total = 0 then selected_budget else 0 end
  );
end;
$$;

create or replace function public.close_due_campaign_periods(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_period record;
  result jsonb;
  processed_count integer := 0;
  allocated_count integer := 0;
  review_count integer := 0;
  error_count integer := 0;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'Close limit must be between 1 and 500.';
  end if;

  if not pg_try_advisory_xact_lock(
    hashtextextended('our-impact:close-due-periods', 0)
  ) then
    return jsonb_build_object('status', 'busy');
  end if;

  for due_period in
    select campaign_periods.id
    from public.campaign_periods
    where campaign_periods.status = 'open'
      and campaign_periods.closes_at <= now()
    order by campaign_periods.closes_at, campaign_periods.id
    limit p_limit
  loop
    begin
      result := private.finalize_campaign_period(
        due_period.id,
        'scheduled',
        null,
        false
      );
      processed_count := processed_count + 1;
      if result ->> 'status' = 'allocated' then
        allocated_count := allocated_count + 1;
      elsif result ->> 'status' = 'requires_review' then
        review_count := review_count + 1;
      end if;
    exception when others then
      error_count := error_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'status', 'complete',
    'processed', processed_count,
    'allocated', allocated_count,
    'requires_review', review_count,
    'errors', error_count
  );
end;
$$;

create or replace function public.finalize_campaign_period_now(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_company_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select campaigns.company_id
    into selected_company_id
  from public.campaign_periods
  join public.campaigns
    on campaigns.id = campaign_periods.campaign_id
  where campaign_periods.id = p_period_id;

  if not exists (
    select 1
    from public.memberships
    where memberships.company_id = selected_company_id
      and memberships.user_id = actor_id
      and memberships.role in ('owner', 'admin')
  ) then
    raise exception 'Owner or admin access is required.';
  end if;

  return private.finalize_campaign_period(
    p_period_id,
    'manual_close',
    actor_id,
    true
  );
end;
$$;

create or replace function public.resolve_zero_vote_allocation(
  p_snapshot_id uuid,
  p_resolution text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_campaign_id uuid;
  selected_company_id uuid;
  selected_period_id uuid;
  selected_revision integer;
  selected_budget bigint;
  selected_currency text;
  selected_model text;
  selected_rule_version text;
  selected_state text;
  selected_votes bigint;
  new_snapshot_id uuid;
  organization_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_resolution not in ('equal_split', 'canceled') then
    raise exception 'Choose equal_split or canceled.';
  end if;

  select
    allocation_snapshots.campaign_id,
    campaigns.company_id,
    allocation_snapshots.period_id,
    allocation_snapshots.revision,
    allocation_snapshots.budget_minor,
    allocation_snapshots.currency,
    allocation_snapshots.allocation_model,
    allocation_snapshots.rule_version,
    allocation_snapshots.state,
    allocation_snapshots.total_valid_votes
  into
    selected_campaign_id,
    selected_company_id,
    selected_period_id,
    selected_revision,
    selected_budget,
    selected_currency,
    selected_model,
    selected_rule_version,
    selected_state,
    selected_votes
  from public.allocation_snapshots
  join public.campaigns
    on campaigns.id = allocation_snapshots.campaign_id
  where allocation_snapshots.id = p_snapshot_id
  for update of allocation_snapshots;

  if selected_campaign_id is null then
    raise exception 'Allocation snapshot not found.';
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
  if selected_state <> 'requires_review' or selected_votes <> 0 then
    raise exception 'Only a zero-vote review can be resolved.';
  end if;
  if exists (
    select 1
    from public.allocation_snapshots
    where period_id = selected_period_id
      and revision > selected_revision
  ) then
    raise exception 'This review already has a later revision.';
  end if;

  select count(*) into organization_count
  from public.campaign_organizations
  where campaign_id = selected_campaign_id;

  insert into public.allocation_snapshots (
    campaign_id,
    period_id,
    revision,
    supersedes_snapshot_id,
    state,
    total_valid_votes,
    budget_minor,
    allocated_minor,
    unallocated_minor,
    currency,
    allocation_model,
    rule_version,
    close_source,
    zero_vote_resolution,
    created_by
  ) values (
    selected_campaign_id,
    selected_period_id,
    selected_revision + 1,
    p_snapshot_id,
    case when p_resolution = 'equal_split' then 'allocated' else 'canceled' end,
    0,
    selected_budget,
    case when p_resolution = 'equal_split' then selected_budget else 0 end,
    case when p_resolution = 'equal_split' then 0 else selected_budget end,
    selected_currency,
    selected_model,
    selected_rule_version,
    'manual_review',
    p_resolution,
    actor_id
  ) returning id into new_snapshot_id;

  insert into public.allocation_lines (
    snapshot_id,
    campaign_id,
    period_id,
    organization_id,
    vote_count,
    amount_minor
  )
  select
    new_snapshot_id,
    selected_campaign_id,
    selected_period_id,
    campaign_organizations.organization_id,
    0,
    case
      when p_resolution = 'equal_split' then
        selected_budget / organization_count
        + case
            when row_number() over (
              order by campaign_organizations.display_order,
                       campaign_organizations.organization_id
            ) <= selected_budget % organization_count
              then 1
            else 0
          end
      else 0
    end
  from public.campaign_organizations
  where campaign_organizations.campaign_id = selected_campaign_id
  order by campaign_organizations.display_order;

  if p_resolution = 'equal_split' then
    insert into public.donation_records (
      company_id,
      campaign_id,
      period_id,
      allocation_snapshot_id,
      allocation_line_id,
      organization_id,
      amount_minor,
      currency,
      status,
      environment
    )
    select
      selected_company_id,
      allocation_lines.campaign_id,
      allocation_lines.period_id,
      allocation_lines.snapshot_id,
      allocation_lines.id,
      allocation_lines.organization_id,
      allocation_lines.amount_minor,
      selected_currency,
      'allocated',
      'simulation'
    from public.allocation_lines
    where allocation_lines.snapshot_id = new_snapshot_id
      and allocation_lines.amount_minor > 0;

    insert into public.donation_status_events (
      donation_record_id,
      actor_user_id,
      from_status,
      to_status,
      note
    )
    select
      donation_records.id,
      actor_id,
      null,
      'allocated',
      'Created after zero-vote equal-split review.'
    from public.donation_records
    where donation_records.allocation_snapshot_id = new_snapshot_id;
  end if;

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
    'allocation.zero_vote_resolved',
    'allocation_snapshot',
    new_snapshot_id,
    jsonb_build_object(
      'supersedes_snapshot_id', p_snapshot_id,
      'resolution', p_resolution,
      'revision', selected_revision + 1
    )
  );

  return jsonb_build_object(
    'status', case when p_resolution = 'equal_split' then 'allocated' else 'canceled' end,
    'snapshot_id', new_snapshot_id,
    'revision', selected_revision + 1
  );
end;
$$;

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

create or replace function public.get_campaign_public_ledger(p_public_id text)
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
  confirmed_paid_minor bigint
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
    case
      when donation_records.status = 'confirmed_paid'
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

revoke all on table public.allocation_snapshots from anon, authenticated;
revoke all on table public.allocation_lines from anon, authenticated;
revoke all on table public.donation_records from anon, authenticated;
revoke all on table public.donation_status_events from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.allocation_snapshots to authenticated;
grant select on table public.allocation_lines to authenticated;
grant select on table public.donation_records to authenticated;
grant select on table public.donation_status_events to authenticated;
grant select on table public.audit_events to authenticated;

revoke all on function private.reject_immutable_ledger_mutation()
  from public, anon, authenticated, service_role;
revoke all on function private.next_campaign_close(
  timestamptz, text, time without time zone, text, integer
) from public, anon, authenticated, service_role;
revoke all on function private.finalize_campaign_period(
  uuid, text, uuid, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) from public, anon;
grant execute on function public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) to authenticated;

revoke all on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) from public, anon;
grant execute on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) to authenticated;

revoke all on function public.close_due_campaign_periods(integer)
  from public, anon, authenticated;
grant execute on function public.close_due_campaign_periods(integer)
  to service_role;

revoke all on function public.finalize_campaign_period_now(uuid)
  from public, anon;
grant execute on function public.finalize_campaign_period_now(uuid)
  to authenticated;

revoke all on function public.resolve_zero_vote_allocation(uuid, text)
  from public, anon;
grant execute on function public.resolve_zero_vote_allocation(uuid, text)
  to authenticated;

revoke all on function public.record_donation_status(uuid, text, text, text)
  from public, anon;
grant execute on function public.record_donation_status(uuid, text, text, text)
  to authenticated;

revoke all on function public.get_campaign_public_ledger(text) from public;
grant execute on function public.get_campaign_public_ledger(text)
  to anon, authenticated;
