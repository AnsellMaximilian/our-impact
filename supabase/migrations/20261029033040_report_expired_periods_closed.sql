-- Present an expired open period as closed to public clients even before the
-- later period-finalization job updates its stored lifecycle state.

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
    case
      when selected_period.status = 'open' and selected_period.closes_at <= now()
        then 'closed'
      else selected_period.status
    end,
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

revoke all on function public.get_campaign_vote_results(text) from public;
grant execute on function public.get_campaign_vote_results(text) to anon, authenticated;
