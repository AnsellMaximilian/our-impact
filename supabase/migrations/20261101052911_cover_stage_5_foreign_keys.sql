create index donation_sessions_campaign_company_idx
  on public.donation_sessions (campaign_id, company_id);

create index donation_sessions_campaign_organization_idx
  on public.donation_sessions (campaign_id, organization_id);

create index supporter_entitlements_campaign_company_idx
  on public.supporter_entitlements (campaign_id, company_id);
