-- Cover both composite vote foreign keys in their declared column order.

drop index if exists public.votes_campaign_period_idx;

create index votes_campaign_organization_idx
  on public.votes (campaign_id, organization_id);

create index votes_period_campaign_idx
  on public.votes (period_id, campaign_id);
