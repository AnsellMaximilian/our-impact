-- The Stage 2 finalizer was already deployed before its local variable was
-- renamed. Recompile that deployed function with an explicit PL/pgSQL
-- variable-conflict rule. Fresh databases receive the renamed canonical
-- function first, so this remains harmless and replayable there.

do $migration$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'private.finalize_campaign_period(uuid,text,uuid,boolean)'::regprocedure
  ) into function_definition;

  if position('#variable_conflict use_variable' in function_definition) = 0 then
    function_definition := replace(
      function_definition,
      E'AS $function$\ndeclare',
      E'AS $function$\n#variable_conflict use_variable\ndeclare'
    );

    if position('#variable_conflict use_variable' in function_definition) = 0 then
      raise exception 'Could not recompile the Stage 2 period finalizer.';
    end if;

    execute function_definition;
  end if;
end;
$migration$;

revoke all on function private.finalize_campaign_period(
  uuid, text, uuid, boolean
) from public, anon, authenticated, service_role;
