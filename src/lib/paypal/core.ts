import { getCurrencyDecimals } from "../money";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };

export type PayPalPayoutIdentifiers = {
  eventId: string;
  eventType: string;
  resourceId: string | null;
  batchId: string | null;
  itemId: string | null;
  senderItemId: string | null;
  resourceStatus: string | null;
  summary: JsonObject;
};

export type PayPalErrorDetail = {
  field: string;
  issue: string;
};

export type PayPalErrorDiagnostics = {
  debugId: string | null;
  details: PayPalErrorDetail[];
};

const PAYPAL_ZERO_DECIMAL_CURRENCIES = new Set(["HUF", "JPY", "TWD"]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as unknown as JsonObject)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function redactDiagnosticText(value: string, maxLength: number) {
  return value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function formatPayPalPayoutAmount(
  amountMinor: number,
  currency: string,
) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("PayPal payout amounts must be positive safe integers.");
  }

  const normalizedCurrency = currency.toUpperCase();
  const sourceDecimals = getCurrencyDecimals(normalizedCurrency);
  const targetDecimals = PAYPAL_ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency)
    ? 0
    : 2;
  let scaledAmount = BigInt(amountMinor);

  if (targetDecimals > sourceDecimals) {
    scaledAmount *= 10n ** BigInt(targetDecimals - sourceDecimals);
  } else if (targetDecimals < sourceDecimals) {
    const divisor = 10n ** BigInt(sourceDecimals - targetDecimals);
    if (scaledAmount % divisor !== 0n) {
      throw new Error("The payout amount exceeds PayPal currency precision.");
    }
    scaledAmount /= divisor;
  }

  if (targetDecimals === 0) return scaledAmount.toString();

  const scale = 10n ** BigInt(targetDecimals);
  const whole = scaledAmount / scale;
  const fraction = (scaledAmount % scale)
    .toString()
    .padStart(targetDecimals, "0");
  return `${whole}.${fraction}`;
}

export function extractPayPalErrorDiagnostics(
  payload: unknown,
): PayPalErrorDiagnostics {
  const root = asObject(payload);
  const rawDebugId = asString(root?.debug_id);
  const debugId = rawDebugId
    ? rawDebugId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || null
    : null;
  const rawDetails = Array.isArray(root?.details) ? root.details : [];
  const details = rawDetails.slice(0, 20).flatMap((value) => {
    const detail = asObject(value);
    const field = asString(detail?.field);
    const issue = asString(detail?.issue);
    if (!field || !issue) return [];

    return [
      {
        field: redactDiagnosticText(field, 200),
        issue: redactDiagnosticText(issue, 500),
      },
    ];
  });

  return { debugId, details };
}

export function maskSandboxRecipient(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

export function buildPayoutRequest(input: {
  recipient: string;
  amountMinor: number;
  currency: string;
  senderBatchId: string;
  senderItemId: string;
  organizationName?: string;
}) {
  return {
    sender_batch_header: {
      sender_batch_id: input.senderBatchId,
      email_subject: "Our Impact PayPal Sandbox payout",
      email_message:
        "This is a PayPal Sandbox test from Our Impact. No real money is involved.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        recipient_wallet: "PAYPAL",
        amount: {
          value: formatPayPalPayoutAmount(input.amountMinor, input.currency),
          currency: input.currency,
        },
        receiver: input.recipient,
        note: input.organizationName
          ? `Our Impact Sandbox allocation for ${input.organizationName}`
          : "Our Impact Sandbox allocation",
        sender_item_id: input.senderItemId,
        purpose: "DONATIONS",
      },
    ],
  };
}

export function buildWebhookVerificationBody(
  rawWebhookEvent: string,
  headers: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
    webhookId: string;
  },
) {
  const envelope = JSON.stringify({
    transmission_id: headers.transmissionId,
    transmission_time: headers.transmissionTime,
    cert_url: headers.certUrl,
    auth_algo: headers.authAlgo,
    transmission_sig: headers.transmissionSig,
    webhook_id: headers.webhookId,
  });

  return `${envelope.slice(0, -1)},"webhook_event":${rawWebhookEvent}}`;
}

export function extractPayoutIdentifiers(event: unknown): PayPalPayoutIdentifiers {
  const root = asObject(event);
  const eventId = asString(root?.id);
  const eventType = asString(root?.event_type);
  const resource = asObject(root?.resource);
  const payoutItem = asObject(resource?.payout_item);
  const batchHeader = asObject(resource?.batch_header);

  if (!eventId || !eventType || !resource) {
    throw new Error("The PayPal webhook payload is missing required fields.");
  }

  const batchId =
    asString(resource.payout_batch_id) ?? asString(batchHeader?.payout_batch_id);
  const itemId = asString(resource.payout_item_id);
  const senderItemId = asString(payoutItem?.sender_item_id);
  const resourceStatus =
    asString(resource.transaction_status) ??
    asString(batchHeader?.batch_status) ??
    asString(resource.status);
  const resourceId = asString(resource.id) ?? itemId ?? batchId;

  return {
    eventId,
    eventType,
    resourceId,
    batchId,
    itemId,
    senderItemId,
    resourceStatus,
    summary: {
      event_id: eventId,
      event_type: eventType,
      create_time: asString(root?.create_time),
      resource_type: asString(root?.resource_type),
      resource: {
        id: resourceId,
        payout_batch_id: batchId,
        payout_item_id: itemId,
        sender_item_id: senderItemId,
        status: resourceStatus,
      },
    },
  };
}
