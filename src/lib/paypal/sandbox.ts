import "server-only";

import { createHash } from "node:crypto";
import { buildPayoutRequest, buildWebhookVerificationBody } from "@/lib/paypal/core";

const PAYPAL_SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com";
const REQUEST_TIMEOUT_MS = 15_000;

export class PayPalSandboxError extends Error {
  constructor(
    public readonly outcome: "rejected" | "uncertain",
    public readonly code: string,
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

async function getAccessToken() {
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
  } | null;

  if (!response.ok || typeof payload?.access_token !== "string") {
    throw new PayPalSandboxError("rejected", "oauth_rejected");
  }

  return payload.access_token;
}

export async function createSandboxPayout(input: {
  recipient: string;
  amountMinor: number;
  currency: string;
  senderBatchId: string;
  senderItemId: string;
  organizationName?: string;
}) {
  const accessToken = await getAccessToken();
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
    throw new PayPalSandboxError(
      response.status >= 500 ? "uncertain" : "rejected",
      errorName || "payout_rejected",
    );
  }

  return {
    payoutBatchId,
    batchStatus,
    requestPayloadHash,
  };
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

  const accessToken = await getAccessToken();
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
