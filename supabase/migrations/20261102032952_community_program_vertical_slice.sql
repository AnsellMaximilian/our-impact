-- Our Impact community-program vertical slice
-- Recipient-owned onboarding invitations and a tangible SDK theme entitlement.

create table public.recipient_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  organization_id bigint not null,
  contact_email text not null,
  status text not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  last_opened_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, organization_id)
    references public.workspace_recipients (company_id, organization_id)
    on delete cascade,
  constraint recipient_invitations_email_length
    check (char_length(contact_email) between 3 and 320),
  constraint recipient_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked')),
  constraint recipient_invitations_acceptance_check
    check ((status = 'accepted') = (accepted_at is not null))
);

create unique index recipient_invitations_pending_recipient_idx
  on public.recipient_invitations (company_id, organization_id)
  where status = 'pending';

create index recipient_invitations_organization_created_idx
  on public.recipient_invitations (organization_id, created_at desc);

create index recipient_invitations_company_created_idx
  on public.recipient_invitations (company_id, created_at desc);

create trigger recipient_invitations_set_updated_at
before update on public.recipient_invitations
for each row execute function private.set_updated_at();

alter table public.recipient_invitations enable row level security;

revoke all on table public.recipient_invitations
  from public, anon, authenticated;
grant select, insert, update, delete on table public.recipient_invitations
  to service_role;

alter table public.paypal_merchant_connections
  add column recipient_invitation_id uuid
    references public.recipient_invitations (id) on delete set null;

create index paypal_merchant_connections_invitation_idx
  on public.paypal_merchant_connections (recipient_invitation_id)
  where recipient_invitation_id is not null;

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
    'invited',
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
      new.id, new.company_id, 'Community Champion theme',
      'community_champion_theme',
      'donation.completed', 1, 'lifetime', 'active'
    ),
    (
      new.id, new.company_id, 'Tier 3 monthly supporter', 'tier_3',
      'donation.completed', 3, 'calendar_month', 'active'
    )
  on conflict (project_id, entitlement_key) do nothing;
  return new;
end;
$$;

insert into public.entitlement_rules (
  project_id,
  company_id,
  name,
  entitlement_key,
  event_type,
  threshold,
  evaluation_window,
  state
)
select
  project.id,
  project.company_id,
  'Community Champion theme',
  'community_champion_theme',
  'donation.completed',
  1,
  'lifetime',
  'active'
from public.developer_projects project
on conflict (project_id, entitlement_key) do nothing;

-- publish_campaign is SECURITY INVOKER and calls this deterministic helper.
-- Preserve only the narrow private-schema privilege it needs.
grant usage on schema private to authenticated;
grant execute on function private.next_campaign_close(
  timestamptz,
  text,
  time without time zone,
  text,
  integer
) to authenticated;
