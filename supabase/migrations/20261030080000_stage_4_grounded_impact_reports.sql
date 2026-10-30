-- Our Impact Stage 4a
-- Human-reviewed, source-grounded AI impact-report drafts. AI output cannot
-- publish content or initiate payments; all writes pass through admin-only RPCs.

create table public.impact_report_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  campaign_id uuid not null,
  period_id uuid not null,
  allocation_snapshot_id uuid not null,
  revision integer not null,
  status text not null default 'draft',
  provider text not null,
  model text not null,
  schema_version text not null,
  prompt_version text not null,
  source_digest text not null,
  source_catalog jsonb not null,
  content jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, period_id, revision),
  constraint impact_report_drafts_campaign_company_fkey
    foreign key (campaign_id, company_id)
    references public.campaigns (id, company_id)
    on delete restrict,
  constraint impact_report_drafts_snapshot_fkey
    foreign key (allocation_snapshot_id, period_id, campaign_id)
    references public.allocation_snapshots (id, period_id, campaign_id)
    on delete restrict,
  constraint impact_report_drafts_revision_positive check (revision > 0),
  constraint impact_report_drafts_status check (status in ('draft', 'approved')),
  constraint impact_report_drafts_provider_length check (
    char_length(provider) between 2 and 60
  ),
  constraint impact_report_drafts_model_length check (
    char_length(model) between 2 and 200
  ),
  constraint impact_report_drafts_schema_version_length check (
    char_length(schema_version) between 3 and 80
  ),
  constraint impact_report_drafts_prompt_version_length check (
    char_length(prompt_version) between 3 and 80
  ),
  constraint impact_report_drafts_source_digest check (
    source_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint impact_report_drafts_source_catalog check (
    jsonb_typeof(source_catalog) = 'array'
    and jsonb_array_length(source_catalog) between 1 and 100
  ),
  constraint impact_report_drafts_content check (
    jsonb_typeof(content) = 'object'
  ),
  constraint impact_report_drafts_review_consistency check (
    (status = 'draft' and reviewed_by is null and reviewed_at is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index impact_report_drafts_company_status_created_idx
  on public.impact_report_drafts (company_id, status, created_at desc);

create index impact_report_drafts_campaign_created_idx
  on public.impact_report_drafts (campaign_id, created_at desc);

create index impact_report_drafts_snapshot_idx
  on public.impact_report_drafts (allocation_snapshot_id);

create index impact_report_drafts_period_idx
  on public.impact_report_drafts (period_id);

create index impact_report_drafts_created_by_idx
  on public.impact_report_drafts (created_by)
  where created_by is not null;

create index impact_report_drafts_reviewed_by_idx
  on public.impact_report_drafts (reviewed_by)
  where reviewed_by is not null;

alter table public.impact_report_drafts enable row level security;

create policy "impact_report_drafts_select_member"
on public.impact_report_drafts for select
to authenticated
using (
  exists (
    select 1
    from public.memberships
    where memberships.company_id = impact_report_drafts.company_id
      and memberships.user_id = (select auth.uid())
  )
);

create trigger impact_report_drafts_set_updated_at
before update on public.impact_report_drafts
for each row execute function private.set_updated_at();

create or replace function public.create_impact_report_draft(
  p_campaign_id uuid,
  p_period_id uuid,
  p_allocation_snapshot_id uuid,
  p_provider text,
  p_model text,
  p_schema_version text,
  p_prompt_version text,
  p_source_digest text,
  p_source_catalog jsonb,
  p_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_company_id uuid;
  next_revision integer;
  created_draft_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  select campaigns.company_id
    into selected_company_id
  from public.allocation_snapshots
  join public.campaigns
    on campaigns.id = allocation_snapshots.campaign_id
  join public.campaign_periods
    on campaign_periods.id = allocation_snapshots.period_id
    and campaign_periods.campaign_id = allocation_snapshots.campaign_id
  where allocation_snapshots.id = p_allocation_snapshot_id
    and allocation_snapshots.campaign_id = p_campaign_id
    and allocation_snapshots.period_id = p_period_id
    and allocation_snapshots.state = 'allocated'
    and campaign_periods.status = 'closed';

  if selected_company_id is null then
    raise exception 'Choose a frozen, allocated campaign period.';
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

  if jsonb_typeof(p_source_catalog) <> 'array'
    or jsonb_array_length(p_source_catalog) not between 1 and 100 then
    raise exception 'The source catalog is invalid.';
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'The report content is invalid.';
  end if;
  if p_source_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'The source digest is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_campaign_id::text || ':' || p_period_id::text, 0)
  );

  select coalesce(max(impact_report_drafts.revision), 0) + 1
    into next_revision
  from public.impact_report_drafts
  where impact_report_drafts.campaign_id = p_campaign_id
    and impact_report_drafts.period_id = p_period_id;

  insert into public.impact_report_drafts (
    company_id,
    campaign_id,
    period_id,
    allocation_snapshot_id,
    revision,
    provider,
    model,
    schema_version,
    prompt_version,
    source_digest,
    source_catalog,
    content,
    created_by
  ) values (
    selected_company_id,
    p_campaign_id,
    p_period_id,
    p_allocation_snapshot_id,
    next_revision,
    trim(p_provider),
    trim(p_model),
    trim(p_schema_version),
    trim(p_prompt_version),
    p_source_digest,
    p_source_catalog,
    p_content,
    actor_id
  ) returning id into created_draft_id;

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
    'impact_report_draft_created',
    'impact_report_draft',
    created_draft_id,
    jsonb_build_object(
      'campaign_id', p_campaign_id,
      'period_id', p_period_id,
      'allocation_snapshot_id', p_allocation_snapshot_id,
      'revision', next_revision,
      'provider', trim(p_provider),
      'model', trim(p_model),
      'schema_version', trim(p_schema_version),
      'prompt_version', trim(p_prompt_version),
      'source_digest', p_source_digest
    )
  );

  return created_draft_id;
end;
$$;

create or replace function public.review_impact_report_draft(
  p_draft_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  selected_company_id uuid;
  selected_campaign_id uuid;
  previous_status text;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;
  if p_status not in ('draft', 'approved') then
    raise exception 'Choose a valid review status.';
  end if;

  select company_id, campaign_id, status
    into selected_company_id, selected_campaign_id, previous_status
  from public.impact_report_drafts
  where id = p_draft_id;

  if selected_company_id is null then
    raise exception 'The impact-report draft could not be found.';
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

  if previous_status = p_status then
    return;
  end if;

  update public.impact_report_drafts
  set
    status = p_status,
    reviewed_by = case when p_status = 'approved' then actor_id else null end,
    reviewed_at = case when p_status = 'approved' then now() else null end
  where id = p_draft_id;

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
    case
      when p_status = 'approved' then 'impact_report_draft_approved'
      else 'impact_report_draft_returned_to_review'
    end,
    'impact_report_draft',
    p_draft_id,
    jsonb_build_object(
      'campaign_id', selected_campaign_id,
      'from_status', previous_status,
      'to_status', p_status
    )
  );
end;
$$;

-- Explicit Data API privileges are required; RLS is the second boundary.
revoke all on table public.impact_report_drafts from anon, authenticated;
grant select on table public.impact_report_drafts to authenticated;

revoke all on function public.create_impact_report_draft(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.create_impact_report_draft(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb
) to authenticated;

revoke all on function public.review_impact_report_draft(uuid, text)
  from public, anon;
grant execute on function public.review_impact_report_draft(uuid, text)
  to authenticated;
