-- Cover every column of the Stage 4 composite foreign keys. The campaign and
-- snapshot leading-column indexes remain useful for application reads, while
-- these indexes protect referenced-row updates and deletes from table scans.

create index impact_report_drafts_campaign_company_idx
  on public.impact_report_drafts (campaign_id, company_id);

create index impact_report_drafts_snapshot_period_campaign_idx
  on public.impact_report_drafts (
    allocation_snapshot_id,
    period_id,
    campaign_id
  );
