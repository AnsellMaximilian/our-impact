-- Cover every Stage 2 foreign key with a matching leading-column index.

create index allocation_snapshots_created_by_idx
  on public.allocation_snapshots (created_by)
  where created_by is not null;

create index allocation_snapshots_period_campaign_idx
  on public.allocation_snapshots (period_id, campaign_id);

create index allocation_lines_snapshot_period_campaign_idx
  on public.allocation_lines (snapshot_id, period_id, campaign_id);

create index donation_records_allocation_line_composite_idx
  on public.donation_records (
    allocation_line_id,
    allocation_snapshot_id,
    campaign_id,
    period_id,
    organization_id
  );

create index donation_records_campaign_company_idx
  on public.donation_records (campaign_id, company_id);
