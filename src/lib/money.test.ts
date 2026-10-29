import { describe, expect, it } from "vitest";
import { formatMoney, moneyToMinorUnits } from "./money";

describe("moneyToMinorUnits", () => {
  it("converts two-decimal currencies without floating-point math", () => {
    expect(moneyToMinorUnits("100.05", "USD")).toBe(10005);
    expect(moneyToMinorUnits("0.99", "EUR")).toBe(99);
  });

  it("supports zero-decimal currencies", () => {
    expect(moneyToMinorUnits("250000", "IDR")).toBe(250000);
  });

  it("rejects malformed, zero, and overly precise amounts", () => {
    expect(() => moneyToMinorUnits("0", "USD")).toThrow();
    expect(() => moneyToMinorUnits("1.001", "USD")).toThrow();
    expect(() => moneyToMinorUnits("1.5", "IDR")).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats stored minor units using currency precision", () => {
    expect(formatMoney(10000, "USD")).toContain("100.00");
    expect(formatMoney(250000, "IDR")).toContain("250,000");
  });
});
