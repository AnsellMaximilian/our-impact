create table public.entitlement_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  name text not null,
  entitlement_key text not null,
  description text not null default '',
  state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  unique (project_id, entitlement_key),
  unique (id, project_id, company_id),
  constraint entitlement_definitions_name_length
    check (char_length(name) between 2 and 120),
  constraint entitlement_definitions_key_format
    check (entitlement_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  constraint entitlement_definitions_description_length
    check (char_length(description) <= 280),
  constraint entitlement_definitions_state_check
    check (state in ('active', 'disabled'))
);

create index entitlement_definitions_project_state_idx
  on public.entitlement_definitions (project_id, state, created_at);

insert into public.entitlement_definitions (
  project_id,
  company_id,
  name,
  entitlement_key,
  description,
  state,
  created_at,
  updated_at
)
select
  rule.project_id,
  rule.company_id,
  rule.name,
  rule.entitlement_key,
  '',
  case when rule.state = 'disabled' then 'disabled' else 'active' end,
  min(rule.created_at),
  max(rule.updated_at)
from public.entitlement_rules rule
group by
  rule.project_id,
  rule.company_id,
  rule.name,
  rule.entitlement_key,
  case when rule.state = 'disabled' then 'disabled' else 'active' end;

alter table public.entitlement_rules
  add column entitlement_id uuid,
  add column metric text not null default 'event_count',
  add column amount_threshold_minor bigint,
  add column currency text;

update public.entitlement_rules rule
set entitlement_id = definition.id
from public.entitlement_definitions definition
where definition.project_id = rule.project_id
  and definition.entitlement_key = rule.entitlement_key;

alter table public.entitlement_rules
  alter column entitlement_id set not null,
  add constraint entitlement_rules_definition_fkey
    foreign key (entitlement_id, project_id, company_id)
    references public.entitlement_definitions (id, project_id, company_id)
    on delete cascade,
  add constraint entitlement_rules_metric_check
    check (metric in ('event_count', 'single_amount', 'period_amount')),
  add constraint entitlement_rules_amount_threshold_check
    check (
      (metric = 'event_count' and amount_threshold_minor is null and currency is null)
      or (
        metric in ('single_amount', 'period_amount')
        and amount_threshold_minor > 0
        and currency ~ '^[A-Z]{3}$'
      )
    );

alter table public.entitlement_rules
  drop constraint entitlement_rules_project_id_entitlement_key_key,
  drop constraint entitlement_rules_window_check;

alter table public.entitlement_rules
  add constraint entitlement_rules_window_check
    check (evaluation_window in ('single_event', 'lifetime', 'calendar_month'));

create index entitlement_rules_definition_state_idx
  on public.entitlement_rules (entitlement_id, state, event_type);

alter table public.user_entitlements
  add column entitlement_definition_id uuid,
  add column progress_value bigint not null default 0,
  add column progress_unit text not null default 'events';

update public.user_entitlements entitlement
set entitlement_definition_id = definition.id
from public.entitlement_definitions definition
where definition.project_id = entitlement.project_id
  and definition.entitlement_key = entitlement.entitlement_key;

alter table public.user_entitlements
  alter column entitlement_definition_id set not null,
  add constraint user_entitlements_definition_fkey
    foreign key (entitlement_definition_id, project_id, company_id)
    references public.entitlement_definitions (id, project_id, company_id)
    on delete cascade,
  add constraint user_entitlements_progress_nonnegative
    check (progress_value >= 0),
  add constraint user_entitlements_progress_unit_length
    check (char_length(progress_unit) between 3 and 12);

create index user_entitlements_definition_state_idx
  on public.user_entitlements (entitlement_definition_id, state, updated_at desc);

create table public.entitlement_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  company_id uuid not null,
  requested_by uuid references auth.users (id) on delete set null,
  prompt text not null,
  response_message text not null,
  proposal jsonb,
  referenced_entitlement_ids uuid[] not null default '{}',
  provider text not null default 'openrouter',
  model text not null,
  status text not null default 'proposed',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (project_id, company_id)
    references public.developer_projects (id, company_id) on delete cascade,
  constraint entitlement_assistant_runs_prompt_length
    check (char_length(prompt) between 2 and 2000),
  constraint entitlement_assistant_runs_response_length
    check (char_length(response_message) between 2 and 4000),
  constraint entitlement_assistant_runs_proposal_object
    check (proposal is null or jsonb_typeof(proposal) = 'object'),
  constraint entitlement_assistant_runs_status_check
    check (status in ('clarification', 'proposed', 'applied', 'dismissed', 'failed'))
);

create index entitlement_assistant_runs_project_created_idx
  on public.entitlement_assistant_runs (project_id, created_at desc);

create trigger entitlement_definitions_set_updated_at
before update on public.entitlement_definitions
for each row execute function private.set_updated_at();

create or replace function private.create_default_entitlement_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  supporter_definition_id uuid;
  tier_definition_id uuid;
begin
  insert into public.entitlement_definitions (
    project_id,
    company_id,
    name,
    entitlement_key,
    description
  ) values (
    new.id,
    new.company_id,
    'Supporter badge',
    'supporter',
    'Recognizes a shopper after their first verified contribution.'
  ) returning id into supporter_definition_id;

  insert into public.entitlement_definitions (
    project_id,
    company_id,
    name,
    entitlement_key,
    description
  ) values (
    new.id,
    new.company_id,
    'Tier 3 monthly supporter',
    'tier_3',
    'Recognizes sustained support during the current calendar month.'
  ) returning id into tier_definition_id;

  insert into public.entitlement_rules (
    project_id,
    company_id,
    entitlement_id,
    name,
    entitlement_key,
    event_type,
    threshold,
    evaluation_window,
    state
  ) values
    (
      new.id, new.company_id, supporter_definition_id,
      'First verified contribution', 'supporter',
      'donation.completed', 1, 'lifetime', 'active'
    ),
    (
      new.id, new.company_id, tier_definition_id,
      'Three contributions this month', 'tier_3',
      'donation.completed', 3, 'calendar_month', 'active'
    );
  return new;
end;
$$;

create or replace function private.evaluate_developer_entitlements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_definition public.entitlement_definitions%rowtype;
  candidate_rule public.entitlement_rules%rowtype;
  chosen_rule public.entitlement_rules%rowtype;
  candidate_progress bigint;
  candidate_target bigint;
  best_progress bigint;
  best_target bigint;
  qualifying_count integer;
  previous_state text;
  next_state text;
  selected_entitlement_id uuid;
  selected_valid_until timestamptz;
  chosen_window_end timestamptz;
  window_start timestamptz;
  window_end timestamptz;
  any_qualified boolean;
begin
  for selected_definition in
    select definition.*
    from public.entitlement_definitions definition
    where definition.project_id = new.project_id
      and definition.state = 'active'
      and exists (
        select 1
        from public.entitlement_rules matching_rule
        where matching_rule.entitlement_id = definition.id
          and matching_rule.event_type = new.event_type
          and matching_rule.state = 'active'
      )
    order by definition.entitlement_key
  loop
    best_progress := 0;
    best_target := 1;
    any_qualified := false;
    chosen_rule := null;
    selected_valid_until := null;
    chosen_window_end := null;

    for candidate_rule in
      select rule.*
      from public.entitlement_rules rule
      where rule.entitlement_id = selected_definition.id
        and rule.event_type = new.event_type
        and rule.state = 'active'
      order by rule.created_at, rule.id
    loop
      if candidate_rule.evaluation_window = 'calendar_month' then
        window_start := date_trunc('month', new.occurred_at at time zone 'UTC')
          at time zone 'UTC';
        window_end := (
          date_trunc('month', new.occurred_at at time zone 'UTC') + interval '1 month'
        ) at time zone 'UTC';
      elsif candidate_rule.evaluation_window = 'single_event' then
        window_start := new.occurred_at;
        window_end := new.occurred_at + interval '1 microsecond';
      else
        window_start := '-infinity'::timestamptz;
        window_end := 'infinity'::timestamptz;
      end if;

      if candidate_rule.metric = 'event_count' then
        select count(*)::bigint into candidate_progress
        from public.developer_events event
        where event.project_id = new.project_id
          and event.supporter_id = new.supporter_id
          and event.event_type = candidate_rule.event_type
          and event.occurred_at >= window_start
          and event.occurred_at < window_end;
        candidate_target := candidate_rule.threshold;
      elsif candidate_rule.metric = 'single_amount' then
        select coalesce(max(
          case
            when event.event_data ->> 'amount_minor' ~ '^[0-9]+$'
              then (event.event_data ->> 'amount_minor')::bigint
            else 0
          end
        ), 0) into candidate_progress
        from public.developer_events event
        where event.project_id = new.project_id
          and event.supporter_id = new.supporter_id
          and event.event_type = candidate_rule.event_type
          and event.occurred_at >= window_start
          and event.occurred_at < window_end
          and upper(coalesce(event.event_data ->> 'currency', '')) = candidate_rule.currency;
        candidate_target := candidate_rule.amount_threshold_minor;
      else
        select coalesce(sum(
          case
            when event.event_data ->> 'amount_minor' ~ '^[0-9]+$'
              then (event.event_data ->> 'amount_minor')::bigint
            else 0
          end
        ), 0) into candidate_progress
        from public.developer_events event
        where event.project_id = new.project_id
          and event.supporter_id = new.supporter_id
          and event.event_type = candidate_rule.event_type
          and event.occurred_at >= window_start
          and event.occurred_at < window_end
          and upper(coalesce(event.event_data ->> 'currency', '')) = candidate_rule.currency;
        candidate_target := candidate_rule.amount_threshold_minor;
      end if;

      if candidate_progress >= candidate_target then
        if not any_qualified then
          chosen_rule := candidate_rule;
          best_progress := candidate_progress;
          best_target := candidate_target;
          chosen_window_end := window_end;
        end if;
        any_qualified := true;
      elsif not any_qualified and (
        chosen_rule.id is null
        or candidate_progress::numeric / candidate_target::numeric
          > best_progress::numeric / best_target::numeric
      ) then
        chosen_rule := candidate_rule;
        best_progress := candidate_progress;
        best_target := candidate_target;
        chosen_window_end := window_end;
      end if;
    end loop;

    select entitlement.state into previous_state
    from public.user_entitlements entitlement
    where entitlement.project_id = new.project_id
      and entitlement.supporter_id = new.supporter_id
      and entitlement.entitlement_key = selected_definition.entitlement_key;

    next_state := case when any_qualified then 'active' else 'inactive' end;
    qualifying_count := case
      when chosen_rule.metric = 'event_count'
        then least(best_progress, 2147483647)::integer
      when any_qualified then 1
      else 0
    end;
    selected_valid_until := case
      when any_qualified and chosen_rule.evaluation_window = 'calendar_month'
        then chosen_window_end
      else null
    end;

    insert into public.user_entitlements (
      project_id,
      company_id,
      supporter_id,
      rule_id,
      entitlement_definition_id,
      entitlement_key,
      state,
      qualifying_count,
      progress_value,
      progress_unit,
      qualified_at,
      revoked_at,
      valid_until
    ) values (
      new.project_id,
      new.company_id,
      new.supporter_id,
      chosen_rule.id,
      selected_definition.id,
      selected_definition.entitlement_key,
      next_state,
      qualifying_count,
      best_progress,
      case when chosen_rule.metric = 'event_count' then 'events' else lower(chosen_rule.currency) end,
      case when next_state = 'active' then now() else null end,
      case when next_state = 'inactive' then now() else null end,
      selected_valid_until
    )
    on conflict (project_id, supporter_id, entitlement_key) do update
    set
      rule_id = excluded.rule_id,
      entitlement_definition_id = excluded.entitlement_definition_id,
      state = excluded.state,
      qualifying_count = excluded.qualifying_count,
      progress_value = excluded.progress_value,
      progress_unit = excluded.progress_unit,
      qualified_at = case
        when public.user_entitlements.state <> 'active'
          and excluded.state = 'active' then now()
        else public.user_entitlements.qualified_at
      end,
      revoked_at = case
        when public.user_entitlements.state = 'active'
          and excluded.state = 'inactive' then now()
        when excluded.state = 'active' then null
        else public.user_entitlements.revoked_at
      end,
      valid_until = excluded.valid_until
    returning id into selected_entitlement_id;

    if (previous_state is null and next_state = 'active')
      or (previous_state is distinct from next_state and previous_state is not null) then
      insert into public.user_entitlement_events (
        entitlement_id,
        project_id,
        company_id,
        supporter_id,
        source_event_id,
        event_type,
        qualifying_count
      ) values (
        selected_entitlement_id,
        new.project_id,
        new.company_id,
        new.supporter_id,
        new.id,
        case when next_state = 'active' then 'granted' else 'revoked' end,
        qualifying_count
      );
    end if;
  end loop;
  return new;
end;
$$;

alter table public.entitlement_definitions enable row level security;
alter table public.entitlement_assistant_runs enable row level security;

revoke all on table public.entitlement_definitions from public, anon, authenticated;
revoke all on table public.entitlement_assistant_runs from public, anon, authenticated;
grant select, insert, update, delete on table public.entitlement_definitions to service_role;
grant select, insert, update on table public.entitlement_assistant_runs to service_role;

revoke all on function private.create_default_entitlement_rules() from public, anon, authenticated;
revoke all on function private.evaluate_developer_entitlements() from public, anon, authenticated;
