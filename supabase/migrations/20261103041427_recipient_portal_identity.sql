-- Recipient-owned identity and portal access.
-- A signed invitation still identifies the proposed relationship, but PayPal
-- onboarding now requires an authenticated user whose verified auth email
-- matches the invitation contact address.

alter table public.recipient_invitations
  add column claimed_at timestamptz,
  add column claimed_by_user_id uuid
    references auth.users (id) on delete set null;

update public.recipient_invitations
set claimed_at = accepted_at
where status = 'accepted'
  and accepted_at is not null;

alter table public.recipient_invitations
  drop constraint recipient_invitations_status_check,
  drop constraint recipient_invitations_acceptance_check;

alter table public.recipient_invitations
  add constraint recipient_invitations_status_check
    check (status in ('pending', 'claimed', 'accepted', 'revoked')),
  add constraint recipient_invitations_acceptance_check
    check (
      (status = 'accepted' and accepted_at is not null)
      or (status in ('pending', 'claimed') and accepted_at is null)
      or status = 'revoked'
    ),
  add constraint recipient_invitations_claim_check
    check (
      (status = 'pending' and claimed_at is null)
      or (status in ('claimed', 'accepted') and claimed_at is not null)
      or status = 'revoked'
    ),
  add constraint recipient_invitations_identity_key
    unique (id, company_id, organization_id);

create index recipient_invitations_claimed_by_idx
  on public.recipient_invitations (claimed_by_user_id)
  where claimed_by_user_id is not null;

create table public.recipient_memberships (
  organization_id bigint not null
    references public.organizations (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  company_id uuid not null,
  invitation_id uuid not null unique,
  claimed_email text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  constraint recipient_memberships_invitation_fkey
  foreign key (invitation_id, company_id, organization_id)
    references public.recipient_invitations (id, company_id, organization_id)
    on delete restrict,
  constraint recipient_memberships_email_length
    check (char_length(claimed_email) between 3 and 320),
  constraint recipient_memberships_email_normalized
    check (claimed_email = lower(trim(claimed_email))),
  constraint recipient_memberships_role_check
    check (role in ('admin', 'viewer'))
);

create index recipient_memberships_user_idx
  on public.recipient_memberships (user_id, created_at desc);

create index recipient_memberships_company_organization_idx
  on public.recipient_memberships (company_id, organization_id);

create trigger recipient_memberships_set_updated_at
before update on public.recipient_memberships
for each row execute function private.set_updated_at();

create or replace function private.claim_recipient_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_email text;
  invitation_status text;
  invitation_expiry timestamptz;
  authenticated_email text;
begin
  select
    lower(trim(invitation.contact_email)),
    invitation.status,
    invitation.expires_at
  into
    invitation_email,
    invitation_status,
    invitation_expiry
  from public.recipient_invitations invitation
  where invitation.id = new.invitation_id
    and invitation.company_id = new.company_id
    and invitation.organization_id = new.organization_id
  for update;

  if invitation_email is null or invitation_status = 'revoked' then
    raise exception 'Recipient invitation is unavailable.';
  end if;
  if invitation_status = 'pending' and invitation_expiry <= now() then
    raise exception 'Recipient invitation has expired.';
  end if;

  select lower(trim(auth_user.email))
    into authenticated_email
  from auth.users auth_user
  where auth_user.id = new.user_id;

  if authenticated_email is null
    or authenticated_email <> invitation_email
    or new.claimed_email <> authenticated_email then
    raise exception 'Use the email address invited by the program owner.';
  end if;

  update public.recipient_invitations
  set
    status = case when status = 'accepted' then 'accepted' else 'claimed' end,
    claimed_at = coalesce(claimed_at, now()),
    claimed_by_user_id = new.user_id,
    last_opened_at = now()
  where id = new.invitation_id;

  return new;
end;
$$;

create trigger recipient_memberships_claim_invitation
before insert on public.recipient_memberships
for each row execute function private.claim_recipient_membership();

alter table public.recipient_memberships enable row level security;

revoke all on table public.recipient_memberships
  from public, anon, authenticated;
grant select, insert, update, delete on table public.recipient_memberships
  to service_role;

revoke all on function private.claim_recipient_membership()
  from public, anon, authenticated, service_role;
