import { minorUnitsToMoneyInput } from "../money";

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

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as unknown as JsonObject)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
          value: minorUnitsToMoneyInput(input.amountMinor, input.currency),
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
