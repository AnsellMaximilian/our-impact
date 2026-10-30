-- The caller-privileged publish RPC uses this deterministic helper. Keep every
-- other private function revoked and grant only the two privileges PostgreSQL
-- requires for that one call. The private schema is not exposed by PostgREST.

grant usage on schema private to authenticated;

grant execute on function private.next_campaign_close(
  timestamptz,
  text,
  time without time zone,
  text,
  integer
) to authenticated;
