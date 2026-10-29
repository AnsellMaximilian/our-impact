-- Keep Data API privileges narrow in addition to row-level security.
-- A hosted-project event trigger granted broad defaults when these tables were created.

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.companies from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.campaigns from anon, authenticated;
revoke all on table public.campaign_organizations from anon, authenticated;

grant select on table public.companies to anon;
grant select on table public.organizations to anon;
grant select on table public.campaigns to anon;
grant select on table public.campaign_organizations to anon;

grant select, update on table public.profiles to authenticated;
grant select, insert on table public.companies to authenticated;
grant select on table public.memberships to authenticated;
grant select on table public.organizations to authenticated;
grant select, insert, update on table public.campaigns to authenticated;
grant select, insert, delete on table public.campaign_organizations to authenticated;

revoke all on sequence public.organizations_id_seq from anon, authenticated;
revoke all on sequence public.campaign_organizations_id_seq from anon, authenticated;
grant usage, select on sequence public.campaign_organizations_id_seq to authenticated;
