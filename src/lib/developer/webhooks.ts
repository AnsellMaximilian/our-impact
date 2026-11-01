import "server-only";

import { signWebhookPayload } from "@/lib/developer/credentials";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

function safeWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (host === "localhost" || host === "::1" || host.endsWith(".local")) return false;
    if (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(host)) return false;
    const match = host.match(/^172\.(\d+)\./);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return false;
    return true;
  } catch {
    return false;
  }
}

function errorCode(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return "request_timeout";
  return "network_error";
}

export async function deliverDeveloperWebhooks(options: { limit?: number; projectId?: string } = {}) {
  const supabase = createPrivilegedClient();
  const { data: deliveries, error } = await supabase.rpc("claim_developer_webhook_deliveries", {
    p_limit: options.limit ?? 20,
    ...(options.projectId ? { p_project_id: options.projectId } : {}),
  });
  if (error) throw error;

  const results = { claimed: deliveries.length, delivered: 0, retried: 0, failed: 0 };
  for (const delivery of deliveries) {
    const { data: endpoint } = await supabase
      .from("webhook_endpoints")
      .select("url, state")
      .eq("id", delivery.webhook_endpoint_id)
      .maybeSingle();

    let responseStatus: number | null = null;
    let lastErrorCode: string | null = null;
    let delivered = false;

    if (!endpoint || endpoint.state !== "active" || !safeWebhookUrl(endpoint.url)) {
      lastErrorCode = "endpoint_unavailable";
    } else {
      const body = JSON.stringify(delivery.payload);
      const timestamp = Math.floor(Date.now() / 1000);
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "OurImpact-Webhooks/0.1",
            "our-impact-event": delivery.event_type,
            "our-impact-delivery": delivery.id,
            "our-impact-signature": `t=${timestamp},v1=${signWebhookPayload(delivery.webhook_endpoint_id, timestamp, body)}`,
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        responseStatus = response.status;
        delivered = response.ok;
        if (!delivered) lastErrorCode = `http_${response.status}`;
      } catch (fetchError) {
        lastErrorCode = errorCode(fetchError);
      }
    }

    const terminal = !delivered && delivery.attempt_count >= 6;
    const delayMinutes = Math.min(2 ** delivery.attempt_count, 60);
    const { error: updateError } = await supabase
      .from("webhook_deliveries")
      .update({
        status: delivered ? "delivered" : terminal ? "failed" : "retry_scheduled",
        response_status: responseStatus,
        last_error_code: lastErrorCode,
        delivered_at: delivered ? new Date().toISOString() : null,
        next_attempt_at: delivered
          ? new Date().toISOString()
          : new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      })
      .eq("id", delivery.id);
    if (updateError) throw updateError;
    if (delivered) results.delivered += 1;
    else if (terminal) results.failed += 1;
    else results.retried += 1;
  }
  return results;
}
