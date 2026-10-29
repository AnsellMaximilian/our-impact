import { describe, expect, it } from "vitest";
import { previewAllocation } from "./allocation";

const votes = [
  { organizationId: 1, votes: 50 },
  { organizationId: 2, votes: 30 },
  { organizationId: 3, votes: 20 },
];

describe("previewAllocation", () => {
  it("allocates winner-takes-all deterministically", () => {
    const result = previewAllocation("winner_takes_all", 10_000, votes);

    expect(result.lines.map((line) => line.amountMinor)).toEqual([10_000, 0, 0]);
    expect(result.allocatedMinor).toBe(10_000);
  });

  it("splits a tied winner and assigns odd cents by organization ID", () => {
    const result = previewAllocation("winner_takes_all", 101, [
      { organizationId: 8, votes: 4 },
      { organizationId: 3, votes: 4 },
      { organizationId: 9, votes: 1 },
    ]);

    expect(result.lines).toEqual([
      { organizationId: 8, votes: 4, amountMinor: 50 },
      { organizationId: 3, votes: 4, amountMinor: 51 },
      { organizationId: 9, votes: 1, amountMinor: 0 },
    ]);
  });

  it("matches the PRD proportional example", () => {
    const result = previewAllocation("proportional", 10_000, votes);

    expect(result.lines.map((line) => line.amountMinor)).toEqual([5_000, 3_000, 2_000]);
  });

  it("matches the PRD hybrid example with a ten-percent base per organization", () => {
    const result = previewAllocation("hybrid", 10_000, votes);

    expect(result.lines.map((line) => line.amountMinor)).toEqual([4_500, 3_100, 2_400]);
    expect(result.allocatedMinor).toBe(10_000);
  });

  it("distributes proportional rounding remainders without exceeding budget", () => {
    const result = previewAllocation("proportional", 100, [
      { organizationId: 11, votes: 1 },
      { organizationId: 12, votes: 1 },
      { organizationId: 13, votes: 1 },
    ]);

    expect(result.lines.map((line) => line.amountMinor)).toEqual([34, 33, 33]);
    expect(result.allocatedMinor).toBe(100);
    expect(result.unallocatedMinor).toBe(0);
  });

  it("requires manual review when no valid votes exist", () => {
    const result = previewAllocation("proportional", 10_000, [
      { organizationId: 1, votes: 0 },
      { organizationId: 2, votes: 0 },
    ]);

    expect(result.requiresReview).toBe(true);
    expect(result.reason).toBe("no_votes");
    expect(result.allocatedMinor).toBe(0);
    expect(result.unallocatedMinor).toBe(10_000);
  });
});
