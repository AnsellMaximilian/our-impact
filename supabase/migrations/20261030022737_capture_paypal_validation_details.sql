alter table public.payment_transactions
  add column provider_debug_id text,
  add column error_details jsonb not null default '[]'::jsonb;

alter table public.payment_transactions
  add constraint payment_transactions_provider_debug_id_length_check
    check (provider_debug_id is null or char_length(provider_debug_id) <= 64)
    not valid,
  add constraint payment_transactions_error_details_array_check
    check (
      jsonb_typeof(error_details) = 'array'
      and jsonb_array_length(error_details) <= 20
      and octet_length(error_details::text) <= 8192
    )
    not valid;

alter table public.payment_transactions
  validate constraint payment_transactions_provider_debug_id_length_check;

alter table public.payment_transactions
  validate constraint payment_transactions_error_details_array_check;

comment on column public.payment_transactions.provider_debug_id is
  'Opaque PayPal support reference captured from a rejected or uncertain API response.';

comment on column public.payment_transactions.error_details is
  'Bounded, redacted PayPal validation field and issue details; never stores the full provider response.';

create or replace function public.record_paypal_sandbox_request_result_v2(
  p_payment_transaction_id uuid,
  p_outcome text,
  p_provider_batch_id text default null,
  p_provider_status text default null,
  p_request_payload_hash text default null,
  p_error_code text default null,
  p_provider_debug_id text default null,
  p_error_details jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  normalized_error_details jsonb := coalesce(p_error_details, '[]'::jsonb);
begin
  if jsonb_typeof(normalized_error_details) <> 'array'
    or jsonb_array_length(normalized_error_details) > 20
    or octet_length(normalized_error_details::text) > 8192 then
    raise exception 'Invalid PayPal error details.';
  end if;

  result := public.record_paypal_sandbox_request_result(
    p_payment_transaction_id,
    p_outcome,
    p_provider_batch_id,
    p_provider_status,
    p_request_payload_hash,
    p_error_code
  );

  update public.payment_transactions
  set
    provider_debug_id = case
      when p_outcome = 'accepted' then null
      else left(nullif(trim(p_provider_debug_id), ''), 64)
    end,
    error_details = case
      when p_outcome = 'accepted' then '[]'::jsonb
      else normalized_error_details
    end
  where id = p_payment_transaction_id;

  return result;
end;
$$;

revoke all on function public.record_paypal_sandbox_request_result_v2(
  uuid, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.record_paypal_sandbox_request_result_v2(
  uuid, text, text, text, text, text, text, jsonb
) to service_role;
