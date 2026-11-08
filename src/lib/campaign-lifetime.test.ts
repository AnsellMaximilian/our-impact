import { describe, expect, it } from "vitest";
import { calculateCampaignLifetimeTotals } from "./campaign-lifetime";

describe("campaign lifetime totals", () => {
  it("uses only the latest allocation revision for each completed round", () => {
    const totals = calculateCampaignLifetimeTotals([
      { period_id: "round-1", revision: 1, budget_minor: 10_000, allocated_minor: 8_000 },
      { period_id: "round-1", revision: 2, budget_minor: 10_000, allocated_minor: 10_000 },
      { period_id: "round-2", revision: 1, budget_minor: 20_000, allocated_minor: 15_000 },
    ], []);

    expect(totals).toMatchObject({
      committedMinor: 30_000,
      allocatedMinor: 25_000,
      completedPeriods: 2,
    });
  });

  it("aggregates confirmed payments across recipients and environments", () => {
    const totals = calculateCampaignLifetimeTotals([], [
      { organization_id: 3, amount_minor: 5_000, environment: "sandbox" },
      { organization_id: 3, amount_minor: 2_500, environment: "live" },
      { organization_id: 4, amount_minor: 3_000, environment: "live" },
    ]);

    expect(totals).toMatchObject({
      paidMinor: 10_500,
      livePaidMinor: 5_500,
      sandboxPaidMinor: 5_000,
      paymentCount: 3,
    });
    expect(totals.recipientPayments).toEqual([
      { organizationId: 3, paidMinor: 7_500, paymentCount: 2 },
      { organizationId: 4, paidMinor: 3_000, paymentCount: 1 },
    ]);
  });
});
