-- Our Impact Stage 1 core MVP
-- Publishable campaign periods, privacy-minimized voting, aggregate results,
-- and atomic draft editing/publishing.

create table public.campaign_periods (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  sequence_number integer not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  status text not null default 'open',
  budget_minor bigint not null,
  currency text not null,
  allocation_model text not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (campaign_id, sequence_number),
  unique (id, campaign_id),
  constraint campaign_periods_sequence_positive check (sequence_number > 0),
  constraint campaign_periods_time_order check (closes_at > opens_at),
  constraint campaign_periods_status check (status in ('open', 'closed', 'canceled')),
  constraint campaign_periods_budget_positive check (budget_minor > 0),
  constraint campaign_periods_currency check (currency ~ '^[A-Z]{3}$'),
  constraint campaign_periods_allocation_model check (
    allocation_model in ('winner_takes_all', 'proportional', 'hybrid')
  ),
  constraint campaign_periods_closed_at check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed')
  )
);

create unique index campaign_periods_one_open_idx
  on public.campaign_periods (campaign_id)
  where status = 'open';

create index campaign_periods_campaign_closes_idx
  on public.campaign_periods (campaign_id, closes_at desc);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  period_id uuid not null,
  organization_id bigint not null,
  visitor_key_hash text not null,
  rate_limit_key_hash text not null,
  is_valid boolean not null default true,
  invalid_reason text,
  created_at timestamptz not null default now(),
  unique (period_id, visitor_key_hash),
  constraint votes_period_campaign_fkey
    foreign key (period_id, campaign_id)
    references public.campaign_periods (id, campaign_id)
    on delete cascade,
  constraint votes_campaign_organization_fkey
    foreign key (campaign_id, organization_id)
    references public.campaign_organizations (campaign_id, organization_id)
    on delete restrict,
  constraint votes_visitor_key_hash check (visitor_key_hash ~ '^[0-9a-f]{64}$'),
  constraint votes_rate_limit_key_hash check (rate_limit_key_hash ~ '^[0-9a-f]{64}$'),
  constraint votes_invalid_reason check (
    (is_valid and invalid_reason is null)
    or (not is_valid and char_length(invalid_reason) between 3 and 120)
  )
);

create index votes_campaign_period_idx
  on public.votes (campaign_id, period_id);

create index votes_period_organization_valid_idx
  on public.votes (period_id, organization_id)
  where is_valid;

create index votes_rate_limit_window_idx
  on public.votes (period_id, rate_limit_key_hash, created_at desc);

alter table public.campaign_periods enable row level security;
alter table public.votes enable row level security;

create policy "campaign_periods_select_public"
on public.campaign_periods for select
to anon
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = campaign_periods.campaign_id
      and campaigns.status = 'published'
  )
);

create policy "campaign_periods_select_authenticated"
on public.campaign_periods for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = campaign_periods.campaign_id
      and campaigns.status = 'published'
  )
  or exists (
    select 1
    from public.campaigns
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaigns.id = campaign_periods.campaign_id
      and memberships.user_id = (select auth.uid())
  )
);

create policy "campaign_periods_insert_admin"
on public.campaign_periods for insert
to authenticated
with check (
  exists (
    select 1
    from public.campaigns
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaigns.id = campaign_periods.campaign_id
      and memberships.user_id = (select auth.uid())
      and memberships.role in ('owner', 'admin')
  )
);

create policy "campaigns_delete_draft_admin"
on public.campaigns for delete
to authenticated
using (
  status = 'draft'
  and exists (
    select 1
    from public.memberships
    where memberships.company_id = campaigns.company_id
      and memberships.user_id = (select auth.uid())
      and memberships.role in ('owner', 'admin')
  )
);

create or replace function public.update_draft_campaign(
  p_campaign_id uuid,
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
  updated_campaign public.campaigns;
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
    allocation_model = p_allocation_model
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

  insert into public.campaign_periods (
    campaign_id,
    sequence_number,
    opens_at,
    closes_at,
    status,
    budget_minor,
    currency,
    allocation_model,
    timezone
  ) values (
    published_campaign.id,
    1,
    now(),
    now() + case published_campaign.period_cadence
      when 'daily' then interval '1 day'
      else interval '7 days'
    end,
    'open',
    published_campaign.budget_minor,
    published_campaign.currency,
    published_campaign.allocation_model,
    published_campaign.timezone
  );

  return published_campaign;
end;
$$;

create or replace function public.cast_vote(
  p_public_id text,
  p_organization_id bigint,
  p_visitor_key_hash text,
  p_rate_limit_key_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_campaign_id uuid;
  selected_period_id uuid;
  recent_rate_count integer;
  period_rate_count integer;
  accepted_total bigint;
begin
  if p_visitor_key_hash !~ '^[0-9a-f]{64}$'
    or p_rate_limit_key_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'invalid_request');
  end if;

  select campaigns.id, campaign_periods.id
    into selected_campaign_id, selected_period_id
  from public.campaigns
  join public.campaign_periods
    on campaign_periods.campaign_id = campaigns.id
  where campaigns.public_id = p_public_id
    and campaigns.status = 'published'
    and campaign_periods.status = 'open'
    and campaign_periods.opens_at <= now()
    and campaign_periods.closes_at > now()
  order by campaign_periods.sequence_number desc
  limit 1
  for update of campaign_periods;

  if selected_period_id is null then
    return jsonb_build_object('status', 'voting_closed');
  end if;

  if not exists (
    select 1
    from public.campaign_organizations
    where campaign_id = selected_campaign_id
      and organization_id = p_organization_id
  ) then
    return jsonb_build_object('status', 'invalid_choice');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_key_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_rate_limit_key_hash, 1));

  if exists (
    select 1
    from public.votes
    where period_id = selected_period_id
      and visitor_key_hash = p_visitor_key_hash
  ) then
    return jsonb_build_object('status', 'already_voted');
  end if;

  select
    count(*) filter (where created_at >= now() - interval '10 minutes'),
    count(*)
  into recent_rate_count, period_rate_count
  from public.votes
  where period_id = selected_period_id
    and rate_limit_key_hash = p_rate_limit_key_hash;

  if recent_rate_count >= 8 or period_rate_count >= 40 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.votes (
    campaign_id,
    period_id,
    organization_id,
    visitor_key_hash,
    rate_limit_key_hash
  ) values (
    selected_campaign_id,
    selected_period_id,
    p_organization_id,
    p_visitor_key_hash,
    p_rate_limit_key_hash
  );

  select count(*)
    into accepted_total
  from public.votes
  where period_id = selected_period_id
    and is_valid;

  return jsonb_build_object(
    'status', 'accepted',
    'period_id', selected_period_id,
    'total_votes', accepted_total
  );
end;
$$;

create or replace function public.get_campaign_vote_results(p_public_id text)
returns table (
  period_id uuid,
  period_status text,
  opens_at timestamptz,
  closes_at timestamptz,
  organization_id bigint,
  vote_count bigint,
  total_votes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with selected_period as (
    select campaign_periods.id,
           campaign_periods.status,
           campaign_periods.opens_at,
           campaign_periods.closes_at,
           campaign_periods.campaign_id
    from public.campaigns
    join public.campaign_periods
      on campaign_periods.campaign_id = campaigns.id
    where campaigns.public_id = p_public_id
      and campaigns.status = 'published'
    order by
      (campaign_periods.status = 'open') desc,
      campaign_periods.sequence_number desc
    limit 1
  ), vote_totals as (
    select votes.organization_id, count(*) as vote_count
    from public.votes
    join selected_period on selected_period.id = votes.period_id
    where votes.is_valid
    group by votes.organization_id
  )
  select
    selected_period.id,
    selected_period.status,
    selected_period.opens_at,
    selected_period.closes_at,
    campaign_organizations.organization_id,
    coalesce(vote_totals.vote_count, 0)::bigint,
    sum(coalesce(vote_totals.vote_count, 0)) over ()::bigint
  from selected_period
  join public.campaign_organizations
    on campaign_organizations.campaign_id = selected_period.campaign_id
  left join vote_totals
    on vote_totals.organization_id = campaign_organizations.organization_id
  order by campaign_organizations.display_order;
$$;

revoke all on table public.campaign_periods from anon, authenticated;
revoke all on table public.votes from anon, authenticated;

grant select on table public.campaign_periods to anon, authenticated;
grant insert on table public.campaign_periods to authenticated;
grant delete on table public.campaigns to authenticated;

revoke all on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, bigint[]
) from public, anon;
grant execute on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, bigint[]
) to authenticated;

revoke all on function public.publish_campaign(uuid) from public, anon;
grant execute on function public.publish_campaign(uuid) to authenticated;

revoke all on function public.cast_vote(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.cast_vote(text, bigint, text, text)
  to service_role;

revoke all on function public.get_campaign_vote_results(text)
  from public;
grant execute on function public.get_campaign_vote_results(text)
  to anon, authenticated;

insert into public.campaign_periods (
  campaign_id,
  sequence_number,
  opens_at,
  closes_at,
  status,
  budget_minor,
  currency,
  allocation_model,
  timezone
)
select
  campaigns.id,
  1,
  coalesce(campaigns.published_at, now()),
  now() + case campaigns.period_cadence
    when 'daily' then interval '1 day'
    else interval '7 days'
  end,
  'open',
  campaigns.budget_minor,
  campaigns.currency,
  campaigns.allocation_model,
  campaigns.timezone
from public.campaigns
where campaigns.status = 'published'
  and not exists (
    select 1
    from public.campaign_periods
    where campaign_periods.campaign_id = campaigns.id
  );
