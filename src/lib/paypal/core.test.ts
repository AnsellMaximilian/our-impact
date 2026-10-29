import { describe, expect, it } from "vitest";
import {
  buildPayoutRequest,
  buildWebhookVerificationBody,
  extractPayoutIdentifiers,
  maskSandboxRecipient,
} from "./core";

describe("PayPal Sandbox helpers", () => {
  it("formats zero-decimal and two-decimal payout currencies", () => {
    expect(
      buildPayoutRequest({
        recipient: "recipient@example.test",
        amountMinor: 1250,
        currency: "USD",
        senderBatchId: "oi-batch",
        senderItemId: "oi-item",
      }).items[0].amount.value,
    ).toBe("12.50");

    expect(
      buildPayoutRequest({
        recipient: "recipient@example.test",
        amountMinor: 1250,
        currency: "IDR",
        senderBatchId: "oi-batch",
        senderItemId: "oi-item",
      }).items[0].amount.value,
    ).toBe("1250");
  });

  it("preserves the exact raw webhook event inside the verification envelope", () => {
    const raw = '{"id":"WH-1",  "event_type":"PAYMENT.PAYOUTS-ITEM.SUCCEEDED"}';
    const body = buildWebhookVerificationBody(raw, {
      transmissionId: "transmission-1",
      transmissionTime: "2026-10-29T00:00:00Z",
      certUrl: "https://api-m.sandbox.paypal.com/cert.pem",
      authAlgo: "SHA256withRSA",
      transmissionSig: "signature",
      webhookId: "webhook-1",
    });

    expect(body).toContain(`"webhook_event":${raw}`);
  });

  it("extracts payout item identifiers without retaining the recipient", () => {
    const identifiers = extractPayoutIdentifiers({
      id: "WH-1",
      event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      resource_type: "payouts_item",
      resource: {
        payout_item_id: "ITEM-1",
        payout_batch_id: "BATCH-1",
        transaction_status: "SUCCESS",
        payout_item: {
          sender_item_id: "oi-item",
          receiver: "secret@example.test",
        },
      },
    });

    expect(identifiers).toMatchObject({
      eventId: "WH-1",
      batchId: "BATCH-1",
      itemId: "ITEM-1",
      senderItemId: "oi-item",
      resourceStatus: "SUCCESS",
    });
    expect(JSON.stringify(identifiers.summary)).not.toContain("secret@example.test");
  });

  it("masks sandbox recipient references", () => {
    expect(maskSandboxRecipient("demo-recipient@example.test")).toBe(
      "de************@example.test",
    );
  });
});
