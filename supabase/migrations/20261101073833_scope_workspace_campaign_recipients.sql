drop function if exists public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, bigint[]
);

create or replace function public.create_draft_campaign(
  p_company_id uuid,
  p_title text,
  p_summary text,
  p_budget_minor bigint,
  p_currency text,
  p_timezone text,
  p_period_cadence text,
  p_allocation_model text,
  p_close_local_time text,
  p_close_weekday integer,
  p_organization_ids bigint[]
)
returns public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_campaign public.campaigns;
  organization_count integer;
  unique_organization_count integer;
  parsed_close_time time without time zone;
begin
  organization_count := coalesce(array_length(p_organization_ids, 1), 0);
  select count(distinct organization_id)
    into unique_organization_count
  from unnest(p_organization_ids) as selected(organization_id);

  if organization_count < 2 or organization_count > 5 then
    raise exception 'Select between 2 and 5 organizations.';
  end if;
  if unique_organization_count <> organization_count then
    raise exception 'Organizations must be unique.';
  end if;
  if p_close_weekday not between 0 and 6 then
    raise exception 'Choose a valid weekly close day.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Choose a valid IANA time zone.';
  end if;

  begin
    parsed_close_time := p_close_local_time::time;
  exception when others then
    raise exception 'Choose a valid local close time.';
  end;

  if (
    select count(*)
    from public.organizations organization
    join public.workspace_recipients recipient
      on recipient.organization_id = organization.id
    where organization.id = any(p_organization_ids)
      and organization.is_active
      and recipient.company_id = p_company_id
      and recipient.relationship_state = 'active'
  ) <> organization_count then
    raise exception 'One or more organizations are unavailable to this workspace.';
  end if;

  insert into public.campaigns (
    company_id,
    public_id,
    title,
    summary,
    budget_minor,
    currency,
    timezone,
    period_cadence,
    allocation_model,
    close_local_time,
    close_weekday,
    status,
    created_by
  ) values (
    p_company_id,
    concat(
      trim(both '-' from regexp_replace(lower(p_title), '[^a-z0-9]+', '-', 'g')),
      '-',
      left(gen_random_uuid()::text, 8)
    ),
    p_title,
    p_summary,
    p_budget_minor,
    upper(p_currency),
    p_timezone,
    p_period_cadence,
    p_allocation_model,
    parsed_close_time,
    p_close_weekday,
    'draft',
    (select auth.uid())
  )
  returning * into created_campaign;

  insert into public.campaign_organizations (
    campaign_id,
    organization_id,
    display_order
  )
  select
    created_campaign.id,
    selected.organization_id,
    selected.ordinality::smallint
  from unnest(p_organization_ids) with ordinality
    as selected(organization_id, ordinality);

  return created_campaign;
end;
$$;

create or replace function public.update_draft_campaign(
  p_campaign_id uuid,
  p_title text,
  p_summary text,
  p_budget_minor bigint,
  p_currency text,
  p_timezone text,
  p_period_cadence text,
  p_allocation_model text,
  p_close_local_time text,
  p_close_weekday integer,
  p_organization_ids bigint[]
)
returns public.campaigns
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_campaign public.campaigns;
  selected_company_id uuid;
  organization_count integer;
  unique_organization_count integer;
  parsed_close_time time without time zone;
begin
  organization_count := coalesce(array_length(p_organization_ids, 1), 0);
  select count(distinct organization_id)
    into unique_organization_count
  from unnest(p_organization_ids) as selected(organization_id);

  if organization_count < 2 or organization_count > 5 then
    raise exception 'Select between 2 and 5 organizations.';
  end if;
  if unique_organization_count <> organization_count then
    raise exception 'Organizations must be unique.';
  end if;
  if p_close_weekday not between 0 and 6 then
    raise exception 'Choose a valid weekly close day.';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Choose a valid IANA time zone.';
  end if;

  begin
    parsed_close_time := p_close_local_time::time;
  exception when others then
    raise exception 'Choose a valid local close time.';
  end;

  select company_id into selected_company_id
  from public.campaigns
  where id = p_campaign_id and status = 'draft';

  if selected_company_id is null then
    raise exception 'Only an authorized draft campaign can be edited.';
  end if;

  if (
    select count(*)
    from public.organizations organization
    join public.workspace_recipients recipient
      on recipient.organization_id = organization.id
    where organization.id = any(p_organization_ids)
      and organization.is_active
      and recipient.company_id = selected_company_id
      and recipient.relationship_state = 'active'
  ) <> organization_count then
    raise exception 'One or more organizations are unavailable to this workspace.';
  end if;

  update public.campaigns
  set
    title = p_title,
    summary = p_summary,
    budget_minor = p_budget_minor,
    currency = upper(p_currency),
    timezone = p_timezone,
    period_cadence = p_period_cadence,
    allocation_model = p_allocation_model,
    close_local_time = parsed_close_time,
    close_weekday = p_close_weekday
  where id = p_campaign_id
    and status = 'draft'
  returning * into updated_campaign;

  delete from public.campaign_organizations
  where campaign_id = p_campaign_id;

  insert into public.campaign_organizations (
    campaign_id,
    organization_id,
    display_order
  )
  select
    p_campaign_id,
    selected.organization_id,
    selected.ordinality::smallint
  from unnest(p_organization_ids) with ordinality
    as selected(organization_id, ordinality);

  return updated_campaign;
end;
$$;

revoke all on function public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) from public, anon;
grant execute on function public.create_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) to authenticated;

revoke all on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) from public, anon;
grant execute on function public.update_draft_campaign(
  uuid, text, text, bigint, text, text, text, text, text, integer, bigint[]
) to authenticated;
