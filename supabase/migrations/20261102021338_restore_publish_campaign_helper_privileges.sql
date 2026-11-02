-- publish_campaign is SECURITY INVOKER and calls this deterministic helper.
-- A later blanket revoke on private functions unintentionally removed the
-- narrow privilege established for authenticated campaign owners.
grant usage on schema private to authenticated;

grant execute on function private.next_campaign_close(
  timestamptz,
  text,
  time without time zone,
  text,
  integer
) to authenticated;
