-- Cover the complete composite FK used when linking a donation session to its
-- canonical developer event. The unique partial event-id index enforces
-- one-to-one linkage but is not a covering index for FK maintenance.

create index donation_sessions_developer_event_fk_idx
  on public.donation_sessions (
    developer_event_id,
    developer_project_id,
    company_id
  );
