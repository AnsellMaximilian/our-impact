import {
  extractPayoutIdentifiers,
} from "@/lib/paypal/core";
import {
  hashWebhookPayload,
  verifyPayPalSandboxWebhook,
} from "@/lib/paypal/sandbox";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 1_000_000;

function getVerificationHeaders(request: Request) {
  const headers = {
    transmissionId: request.headers.get("paypal-transmission-id"),
    transmissionTime: request.headers.get("paypal-transmission-time"),
    certUrl: request.headers.get("paypal-cert-url"),
    authAlgo: request.headers.get("paypal-auth-algo"),
    transmissionSig: request.headers.get("paypal-transmission-sig"),
  };

  if (Object.values(headers).some((value) => !value)) return null;
  return headers as Record<keyof typeof headers, string>;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  const verificationHeaders = getVerificationHeaders(request);
  if (!verificationHeaders) {
    return Response.json({ error: "missing_paypal_headers" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const verified = await verifyPayPalSandboxWebhook(rawBody, verificationHeaders);
  if (!verified) {
    return Response.json({ error: "signature_verification_failed" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let identifiers;
  try {
    identifiers = extractPayoutIdentifiers(event);
  } catch {
    return Response.json({ error: "unsupported_event" }, { status: 400 });
  }

  if (!identifiers.eventType.includes("PAYOUT")) {
    return Response.json({ status: "ignored_event_type" });
  }

  const supabase = createPrivilegedClient();
  const { data, error } = await supabase.rpc("record_verified_paypal_webhook", {
    p_provider_event_id: identifiers.eventId,
    p_transmission_id: verificationHeaders.transmissionId,
    p_event_type: identifiers.eventType,
    p_provider_resource_id: identifiers.resourceId ?? undefined,
    p_provider_batch_id: identifiers.batchId ?? undefined,
    p_provider_item_id: identifiers.itemId ?? undefined,
    p_sender_item_id: identifiers.senderItemId ?? undefined,
    p_resource_status: identifiers.resourceStatus ?? undefined,
    p_payload_hash: hashWebhookPayload(rawBody),
    p_event_summary: identifiers.summary,
  });

  if (error) {
    console.error("PayPal Sandbox webhook persistence failed", {
      code: error.code,
      eventId: identifiers.eventId,
    });
    return Response.json({ error: "persistence_failed" }, { status: 500 });
  }

  return Response.json(data ?? { status: "accepted" });
}
