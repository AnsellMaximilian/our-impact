-- Qualify the company identifier used by the manual close authorization check.
-- PostgreSQL otherwise treats it as ambiguous between a PL/pgSQL variable and
-- the campaign table column selected above.

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

revoke all on function public.finalize_campaign_period_now(uuid)
  from public, anon;
grant execute on function public.finalize_campaign_period_now(uuid)
  to authenticated;
