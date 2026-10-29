create index companies_created_by_idx on public.companies (created_by);

drop policy "companies_select_public" on public.companies;
drop policy "companies_select_member" on public.companies;

create policy "companies_select_public"
on public.companies for select
to anon
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.company_id = companies.id
      and campaigns.status = 'published'
  )
);

create policy "companies_select_authenticated"
on public.companies for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.company_id = companies.id
      and campaigns.status = 'published'
  )
  or exists (
    select 1
    from public.memberships
    where memberships.company_id = companies.id
      and memberships.user_id = (select auth.uid())
  )
);

drop policy "campaigns_select_public" on public.campaigns;
drop policy "campaigns_select_member" on public.campaigns;

create policy "campaigns_select_public"
on public.campaigns for select
to anon
using (status = 'published');

create policy "campaigns_select_authenticated"
on public.campaigns for select
to authenticated
using (
  status = 'published'
  or exists (
    select 1
    from public.memberships
    where memberships.company_id = campaigns.company_id
      and memberships.user_id = (select auth.uid())
  )
);

drop policy "campaign_organizations_select_public" on public.campaign_organizations;
drop policy "campaign_organizations_select_member" on public.campaign_organizations;

create policy "campaign_organizations_select_public"
on public.campaign_organizations for select
to anon
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = campaign_organizations.campaign_id
      and campaigns.status = 'published'
  )
);

create policy "campaign_organizations_select_authenticated"
on public.campaign_organizations for select
to authenticated
using (
  exists (
    select 1
    from public.campaigns
    where campaigns.id = campaign_organizations.campaign_id
      and campaigns.status = 'published'
  )
  or exists (
    select 1
    from public.campaigns
    join public.memberships
      on memberships.company_id = campaigns.company_id
    where campaigns.id = campaign_organizations.campaign_id
      and memberships.user_id = (select auth.uid())
  )
);
