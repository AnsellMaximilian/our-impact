import { describe, expect, it } from "vitest";
import { assistantMessageParts } from "./assistant-message";

describe("assistant message references", () => {
  it("turns a referenced entitlement name into one inline token", () => {
    const reference = {
      id: "entitlement-1",
      name: "Tier 3 monthly supporter",
      entitlement_key: "tier_3",
    };

    expect(assistantMessageParts(
      "You have Tier 3 monthly supporter (tier_3), earned after three donations.",
      [reference],
    )).toEqual([
      { type: "text", value: "You have " },
      { type: "entitlement", reference },
      { type: "text", value: ", earned after three donations." },
    ]);
  });

  it("also recognizes a bare SDK key when the model returns one", () => {
    const reference = {
      id: "entitlement-2",
      name: "Generous Guy",
      entitlement_key: "generous_guy",
    };

    expect(assistantMessageParts("Use generous_guy for this rule.", [reference])[1]).toEqual({
      type: "entitlement",
      reference,
    });
  });
});
