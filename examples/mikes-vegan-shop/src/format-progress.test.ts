import { describe, expect, it } from "vitest";
import { formatEntitlementProgress } from "./format-progress";

describe("formatEntitlementProgress", () => {
  it("formats USD progress from minor units", () => {
    expect(formatEntitlementProgress(5000, "usd")).toBe("$50.00");
    expect(formatEntitlementProgress(5300, "USD")).toBe("$53.00");
  });

  it("uses each currency's precision", () => {
    expect(formatEntitlementProgress(5000, "jpy")).toBe("¥5,000");
  });

  it("pluralizes event progress", () => {
    expect(formatEntitlementProgress(1, "events")).toBe("1 event");
    expect(formatEntitlementProgress(3, "events")).toBe("3 events");
  });

  it("preserves unknown units", () => {
    expect(formatEntitlementProgress(12, "points")).toBe("12 points");
  });
});
