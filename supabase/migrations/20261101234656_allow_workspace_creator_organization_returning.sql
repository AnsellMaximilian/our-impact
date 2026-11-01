-- A workspace-created organization is private until it is linked through
-- workspace_recipients. Allow members of the creating workspace to read it
-- immediately so INSERT ... RETURNING can complete before that link exists.
drop policy if exists "organizations_select_public_or_member" on public.organizations;

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
      join public.memberships membership on membership.company_id = recipient.company_id
      where recipient.organization_id = organizations.id
        and membership.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.memberships membership
      where membership.company_id = organizations.created_by_company_id
        and membership.user_id = (select auth.uid())
    )
  )
);
