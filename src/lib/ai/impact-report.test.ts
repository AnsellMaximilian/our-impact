import { describe, expect, it } from "vitest";
import {
  buildImpactReportSources,
  digestImpactReportSources,
  validateImpactReportContent,
} from "./impact-report";

const sources = buildImpactReportSources({
  campaign: {
    title: "Clean water week",
    summary: "Employees choose how a transparent giving commitment is allocated.",
    budget_minor: 10_000,
    currency: "USD",
    allocation_model: "proportional",
  },
  period: {
    sequence_number: 1,
    status: "closed",
    opens_at: "2026-10-20T00:00:00.000Z",
    closes_at: "2026-10-27T00:00:00.000Z",
    timezone: "Asia/Jakarta",
  },
  snapshot: {
    id: "snapshot-1",
    revision: 1,
    state: "allocated",
    total_valid_votes: 10,
    budget_minor: 10_000,
    allocated_minor: 10_000,
    unallocated_minor: 0,
    currency: "USD",
    allocation_model: "proportional",
    created_at: "2026-10-27T00:00:01.000Z",
  },
  lines: [{ organization_id: 7, vote_count: 10, amount_minor: 10_000 }],
  organizations: [{ id: 7, name: "Water Project" }],
  donations: [
    {
      id: "donation-1",
      organization_id: 7,
      amount_minor: 10_000,
      currency: "USD",
      status: "confirmed_paid",
      environment: "sandbox",
      updated_at: "2026-10-27T01:00:00.000Z",
    },
  ],
  payments: [
    {
      id: "payment-1",
      donation_record_id: "donation-1",
      amount_minor: 10_000,
      currency: "USD",
      provider: "paypal",
      flow: "sandbox_payout",
      status: "completed",
      provider_status: "SUCCESS",
      environment: "sandbox",
      updated_at: "2026-10-27T01:00:00.000Z",
    },
  ],
});

const validContent = {
  title: { text: "Clean water week recap", source_ids: ["campaign", "period"] },
  executive_summary: {
    text: "Ten votes directed the full $100.00 test commitment.",
    source_ids: ["allocation"],
  },
  allocation_summary: {
    text: "Water Project received all ten votes and the allocation.",
    source_ids: ["allocation-line-7"],
  },
  payment_summary: {
    text: "The payment evidence is a successful PayPal sandbox test, not a live donation.",
    source_ids: ["payment-payment-1"],
  },
  highlights: [
    { text: "Ten valid votes were recorded.", source_ids: ["allocation"] },
  ],
  caveats: [
    { text: "PayPal evidence came from the sandbox environment.", source_ids: ["payment-payment-1"] },
  ],
  email_copy: {
    text: "Here is the reviewed recap of this period's transparent test allocation.",
    source_ids: ["campaign", "allocation"],
  },
  social_copy: {
    text: "Our test period closed with ten votes and a transparent allocation.",
    source_ids: ["period", "allocation"],
  },
};

describe("impact report grounding", () => {
  it("builds a stable, non-sensitive source catalog", () => {
    expect(sources.map((source) => source.id)).toEqual([
      "campaign",
      "period",
      "allocation",
      "allocation-line-7",
      "donation-donation-1",
      "payment-payment-1",
    ]);
    expect(JSON.stringify(sources)).not.toContain("recipient");
    expect(digestImpactReportSources(sources)).toMatch(/^[a-f0-9]{64}$/);
    expect(digestImpactReportSources(sources)).toBe(digestImpactReportSources(sources));
  });

  it("accepts only citations from the supplied catalog", () => {
    expect(validateImpactReportContent(validContent, sources)).toEqual(validContent);
    expect(() =>
      validateImpactReportContent(
        {
          ...validContent,
          highlights: [
            { text: "Unsupported claim", source_ids: ["invented-source"] },
          ],
        },
        sources,
      ),
    ).toThrow("unknown source");
  });
});
