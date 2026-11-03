import { describe, expect, it } from "vitest";
import {
  buildEntitlementAssistantPrompt,
  entitlementAssistantResponseSchema,
  formatEntitlementRule,
} from "./entitlement-assistant";

const entitlementId = "71f0461d-1e39-4079-a85f-f4af6240af4f";

describe("entitlement assistant", () => {
  it("keeps existing entitlements in the grounded prompt", () => {
    const prompt = buildEntitlementAssistantPrompt({
      projectName: "Mike’s Vegan Shop Website",
      entitlements: [{
        id: entitlementId,
        name: "Generous Gary",
        entitlementKey: "generous_gary",
        description: "A generous community supporter.",
        state: "active",
        rules: [{
          name: "Two donations this month",
          metric: "event_count",
          threshold: 2,
          amountThresholdMinor: null,
          currency: null,
          evaluationWindow: "calendar_month",
          state: "active",
        }],
      }],
      history: [],
      request: "Make a donor of 50 plus a generous guy",
    });

    expect(prompt).toContain(entitlementId);
    expect(prompt).toContain("Generous Gary");
    expect(prompt).toContain("single_amount");
  });

  it("rejects ambiguous count proposals that include money", () => {
    const result = entitlementAssistantResponseSchema.safeParse({
      kind: "proposal",
      message: "Draft ready.",
      referenced_entitlement_ids: [entitlementId],
      proposal: {
        action: "use_existing",
        existing_entitlement_id: entitlementId,
        entitlement_name: "Generous Gary",
        entitlement_key: "generous_gary",
        entitlement_description: "A generous community supporter.",
        rule_name: "Two donations",
        event_type: "donation.completed",
        metric: "event_count",
        evaluation_window: "calendar_month",
        threshold: 2,
        amount_threshold_minor: 5000,
        currency: "USD",
      },
    });

    expect(result.success).toBe(false);
  });

  it("formats a single-donation amount for human review", () => {
    expect(formatEntitlementRule({
      action: "create_new",
      existing_entitlement_id: null,
      entitlement_name: "Generous Gary",
      entitlement_key: "generous_gary",
      entitlement_description: "A generous community supporter.",
      rule_name: "$50 donation",
      event_type: "donation.completed",
      metric: "single_amount",
      evaluation_window: "single_event",
      threshold: 1,
      amount_threshold_minor: 5000,
      currency: "USD",
    })).toContain("$50.00");
  });

  it("accepts a lifetime window for a qualifying single donation", () => {
    const result = entitlementAssistantResponseSchema.safeParse({
      kind: "proposal",
      message: "Draft ready.",
      referenced_entitlement_ids: [entitlementId],
      proposal: {
        action: "use_existing",
        existing_entitlement_id: entitlementId,
        entitlement_name: "Generous Gary",
        entitlement_key: "generous_gary",
        entitlement_description: "A generous community supporter.",
        rule_name: "$50 lifetime donation",
        event_type: "donation.completed",
        metric: "single_amount",
        evaluation_window: "lifetime",
        threshold: 1,
        amount_threshold_minor: 5000,
        currency: "USD",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects a second count threshold on amount rules", () => {
    const result = entitlementAssistantResponseSchema.safeParse({
      kind: "proposal",
      message: "Draft ready.",
      referenced_entitlement_ids: [],
      proposal: {
        action: "create_new",
        existing_entitlement_id: null,
        entitlement_name: "Generous Gary",
        entitlement_key: "generous_gary",
        entitlement_description: "A generous community supporter.",
        rule_name: "$50 donation",
        event_type: "donation.completed",
        metric: "single_amount",
        evaluation_window: "single_event",
        threshold: 50,
        amount_threshold_minor: 5000,
        currency: "USD",
      },
    });

    expect(result.success).toBe(false);
  });
});
