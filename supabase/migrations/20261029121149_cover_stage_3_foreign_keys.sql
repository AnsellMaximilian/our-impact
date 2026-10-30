create index payment_transactions_campaign_company_idx
  on public.payment_transactions (campaign_id, company_id);
