-- Link a verified PayPal supporter checkout to the developer identity that the
-- embedding site handed to the widget. Anonymous checkouts remain supported.

alter table public.donation_sessions
  add column developer_project_id uuid,
  add column supporter_id uuid,
  add column developer_event_id uuid;

alter table public.donation_sessions
  add constraint donation_sessions_developer_project_fkey
    foreign key (developer_project_id, company_id)
    references public.developer_projects (id, company_id)
    on delete restrict,
  add constraint donation_sessions_supporter_fkey
    foreign key (supporter_id, developer_project_id, company_id)
    references public.supporters (id, project_id, company_id)
    on delete restrict,
  add constraint donation_sessions_developer_event_fkey
    foreign key (developer_event_id, developer_project_id, company_id)
    references public.developer_events (id, project_id, company_id)
    on delete restrict,
  add constraint donation_sessions_developer_identity_pair_check
    check (
      (developer_project_id is null and supporter_id is null)
      or (developer_project_id is not null and supporter_id is not null)
    ),
  add constraint donation_sessions_event_requires_identity_check
    check (developer_event_id is null or developer_project_id is not null);

create index donation_sessions_developer_project_idx
  on public.donation_sessions (developer_project_id, company_id)
  where developer_project_id is not null;

create index donation_sessions_supporter_idx
  on public.donation_sessions (supporter_id, developer_project_id, company_id)
  where supporter_id is not null;

create unique index donation_sessions_developer_event_uidx
  on public.donation_sessions (developer_event_id)
  where developer_event_id is not null;
