import { describe, expect, it } from "vitest";
import { buildPayPalCampaignFundingSdkConfig } from "./sdk";

describe("buildPayPalCampaignFundingSdkConfig", () => {
  it("places a single merchant ID in the SDK URL", () => {
    const config = buildPayPalCampaignFundingSdkConfig({
      clientId: "sandbox client",
      currency: "USD",
      merchantIds: ["MERCHANT-ONE"],
    });

    expect(config.src).toContain("client-id=sandbox%20client");
    expect(config.src).toContain("merchant-id=MERCHANT-ONE");
    expect(config.dataMerchantId).toBeUndefined();
  });

  it("uses the wildcard URL and data attribute for multiple merchants", () => {
    const config = buildPayPalCampaignFundingSdkConfig({
      clientId: "sandbox-client",
      currency: "USD",
      merchantIds: ["MERCHANT-ONE", "MERCHANT-TWO"],
    });

    expect(config.src).toContain("merchant-id=*");
    expect(config.dataMerchantId).toBe("MERCHANT-ONE,MERCHANT-TWO");
  });

  it("treats repeated merchant IDs as one merchant", () => {
    const config = buildPayPalCampaignFundingSdkConfig({
      clientId: "sandbox-client",
      currency: "USD",
      merchantIds: [" MERCHANT-ONE ", "MERCHANT-ONE"],
    });

    expect(config.src).toContain("merchant-id=MERCHANT-ONE");
    expect(config.dataMerchantId).toBeUndefined();
  });

  it("rejects a configuration without a merchant", () => {
    expect(() =>
      buildPayPalCampaignFundingSdkConfig({
        clientId: "sandbox-client",
        currency: "USD",
        merchantIds: ["  "],
      }),
    ).toThrow("At least one PayPal merchant ID is required.");
  });
});
