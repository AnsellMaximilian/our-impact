import "server-only";

import { createHash } from "node:crypto";
import {
  buildPayoutRequest,
  buildWebhookVerificationBody,
  extractPayPalErrorDiagnostics,
  extractPayoutBatchStatus,
  isPayPalSandboxSettlementCurrency,
  type PayPalErrorDetail,
} from "@/lib/paypal/core";

export const PAYPAL_SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com";
const REQUEST_TIMEOUT_MS = 15_000;

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

export class PayPalSandboxError extends Error {
  constructor(
    public readonly outcome: "rejected" | "uncertain",
    public readonly code: string,
    public readonly debugId: string | null = null,
    public readonly details: PayPalErrorDetail[] = [],
  ) {
    super("The PayPal Sandbox request could not be completed.");
  }
}

function getCredentials() {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new PayPalSandboxError("rejected", "sandbox_credentials_missing");
  }

  return { clientId, clientSecret };
}

export function getPayPalSandboxConfiguration() {
  return {
    clientConfigured: Boolean(
      process.env.PAYPAL_SANDBOX_CLIENT_ID &&
        process.env.PAYPAL_SANDBOX_CLIENT_SECRET,
    ),
    webhookConfigured: Boolean(process.env.PAYPAL_SANDBOX_WEBHOOK_ID),
    ready: Boolean(
      process.env.PAYPAL_SANDBOX_CLIENT_ID &&
        process.env.PAYPAL_SANDBOX_CLIENT_SECRET &&
        process.env.PAYPAL_SANDBOX_WEBHOOK_ID,
    ),
  };
}

export async function getPayPalSandboxAccessToken() {
  if (
    cachedAccessToken &&
    cachedAccessToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedAccessToken.value;
  }

  const { clientId, clientSecret } = getCredentials();
  let response: Response;

  try {
    response = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new PayPalSandboxError("rejected", "oauth_unavailable");
  }

  const payload = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    expires_in?: unknown;
  } | null;
  const accessToken = payload?.access_token;

  if (!response.ok || typeof accessToken !== "string") {
    const diagnostics = extractPayPalErrorDiagnostics(payload);
    throw new PayPalSandboxError(
      "rejected",
      "oauth_rejected",
      diagnostics.debugId,
      diagnostics.details,
    );
  }

  const expiresIn =
    typeof payload?.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 300;
  cachedAccessToken = {
    value: accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

export async function createSandboxPayout(input: {
  recipient: string;
  amountMinor: number;
  currency: string;
  senderBatchId: string;
  senderItemId: string;
  organizationName?: string;
}) {
  if (!isPayPalSandboxSettlementCurrency(input.currency)) {
    throw new PayPalSandboxError(
      "rejected",
      "unsupported_sandbox_currency",
      null,
      [
        {
          field: "items[0].amount.currency",
          issue: "Our Impact PayPal Sandbox payouts currently support USD only.",
        },
      ],
    );
  }

  const accessToken = await getPayPalSandboxAccessToken();
  const request = buildPayoutRequest(input);
  const body = JSON.stringify(request);
  const requestPayloadHash = createHash("sha256").update(body).digest("hex");
  let response: Response;

  try {
    response = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": input.senderBatchId,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new PayPalSandboxError("uncertain", "payout_request_uncertain");
  }

  const payload = (await response.json().catch(() => null)) as {
    batch_header?: {
      payout_batch_id?: unknown;
      batch_status?: unknown;
    };
    name?: unknown;
    debug_id?: unknown;
    details?: unknown;
  } | null;

  const payoutBatchId = payload?.batch_header?.payout_batch_id;
  const batchStatus = payload?.batch_header?.batch_status;

  if (
    !response.ok ||
    typeof payoutBatchId !== "string" ||
    typeof batchStatus !== "string"
  ) {
    const errorName =
      typeof payload?.name === "string"
        ? payload.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 50)
        : `http_${response.status}`;
    const diagnostics = extractPayPalErrorDiagnostics(payload);
    throw new PayPalSandboxError(
      response.status >= 500 ? "uncertain" : "rejected",
      errorName || "payout_rejected",
      diagnostics.debugId,
      diagnostics.details,
    );
  }

  return {
    payoutBatchId,
    batchStatus,
    requestPayloadHash,
  };
}

export async function getSandboxPayoutBatchDetails(input: {
  batchId: string;
  senderItemId: string;
}) {
  if (!input.batchId.trim() || input.batchId.length > 1000) {
    throw new PayPalSandboxError("rejected", "invalid_payout_batch_id");
  }

  const accessToken = await getPayPalSandboxAccessToken();
  let response: Response;

  try {
    const batchId = encodeURIComponent(input.batchId);
    response = await fetch(
      `${PAYPAL_SANDBOX_ORIGIN}/v1/payments/payouts/${batchId}?page_size=1000&total_required=true`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch {
    throw new PayPalSandboxError(
      "uncertain",
      "payout_reconciliation_unavailable",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const root =
      payload !== null && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as { name?: unknown })
        : null;
    const errorName =
      typeof root?.name === "string"
        ? root.name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 45)
        : `http_${response.status}`;
    const diagnostics = extractPayPalErrorDiagnostics(payload);
    throw new PayPalSandboxError(
      "uncertain",
      `reconciliation_${errorName}`,
      diagnostics.debugId,
      diagnostics.details,
    );
  }

  let details;
  try {
    details = extractPayoutBatchStatus(payload, input.senderItemId);
  } catch {
    throw new PayPalSandboxError(
      "uncertain",
      "invalid_reconciliation_response",
    );
  }

  if (details.batchId !== input.batchId) {
    throw new PayPalSandboxError(
      "uncertain",
      "reconciliation_batch_mismatch",
    );
  }

  return details;
}

export async function verifyPayPalSandboxWebhook(
  rawBody: string,
  headers: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
  },
) {
  const webhookId = process.env.PAYPAL_SANDBOX_WEBHOOK_ID;
  if (!webhookId) return false;

  const accessToken = await getPayPalSandboxAccessToken();
  const body = buildWebhookVerificationBody(rawBody, { ...headers, webhookId });
  let response: Response;

  try {
    response = await fetch(
      `${PAYPAL_SANDBOX_ORIGIN}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch {
    return false;
  }

  const payload = (await response.json().catch(() => null)) as {
    verification_status?: unknown;
  } | null;

  return response.ok && payload?.verification_status === "SUCCESS";
}

export function hashWebhookPayload(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}
