-- Cover every foreign-key lookup used by cascades and integrity checks.
create index developer_api_keys_created_by_idx
  on public.developer_api_keys (created_by)
  where created_by is not null;
create index developer_api_keys_project_company_idx
  on public.developer_api_keys (project_id, company_id);
create index developer_events_supporter_project_company_idx
  on public.developer_events (supporter_id, project_id, company_id);
create index developer_projects_created_by_idx
  on public.developer_projects (created_by)
  where created_by is not null;
create index entitlement_rules_project_company_idx
  on public.entitlement_rules (project_id, company_id);
create index supporters_project_company_idx
  on public.supporters (project_id, company_id);
create index user_entitlement_events_entitlement_project_company_idx
  on public.user_entitlement_events (entitlement_id, project_id, company_id);
create index user_entitlement_events_source_project_company_idx
  on public.user_entitlement_events (source_event_id, project_id, company_id);
create index user_entitlement_events_supporter_project_company_idx
  on public.user_entitlement_events (supporter_id, project_id, company_id);
create index user_entitlements_rule_idx
  on public.user_entitlements (rule_id);
create index user_entitlements_supporter_project_company_idx
  on public.user_entitlements (supporter_id, project_id, company_id);
create index webhook_deliveries_entitlement_event_idx
  on public.webhook_deliveries (entitlement_event_id)
  where entitlement_event_id is not null;
create index webhook_deliveries_source_project_company_idx
  on public.webhook_deliveries (source_event_id, project_id, company_id)
  where source_event_id is not null;
create index webhook_deliveries_endpoint_project_company_idx
  on public.webhook_deliveries (webhook_endpoint_id, project_id, company_id);
create index webhook_endpoints_created_by_idx
  on public.webhook_endpoints (created_by)
  where created_by is not null;
create index webhook_endpoints_project_company_idx
  on public.webhook_endpoints (project_id, company_id);
create index workspace_recipients_created_by_idx
  on public.workspace_recipients (created_by)
  where created_by is not null;
