import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./sandbox", () => ({
  getPayPalSandboxAccessToken: vi.fn(),
  PAYPAL_SANDBOX_ORIGIN: "https://api-m.sandbox.paypal.com",
}));

import {
  createPayPalCampaignFundingOrder,
  createPayPalPartnerReferral,
  extractPayPalPlatformWebhookIdentifiers,
  parsePayPalCampaignFundingCapture,
  parsePayPalMerchantIntegrationStatus,
} from "./platform";
import { getPayPalSandboxAccessToken } from "./sandbox";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("createPayPalPartnerReferral", () => {
  it("uses only fields accepted by PayPal's partner config override schema", async () => {
    vi.stubEnv("PAYPAL_SANDBOX_CLIENT_ID", "sandbox-client-id");
    vi.stubEnv("PAYPAL_SANDBOX_PARTNER_MERCHANT_ID", "PARTNER123");
    vi.stubEnv("PAYPAL_PARTNER_ATTRIBUTION_ID", "OurImpact_SP_PPCP");
    vi.mocked(getPayPalSandboxAccessToken).mockResolvedValue("access-token");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          partner_referral_id: "REFERRAL-1",
          links: [
            {
              rel: "action_url",
              href: "https://www.sandbox.paypal.com/onboarding",
            },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createPayPalPartnerReferral({
      trackingId: "tracking-id",
      organizationName: "Bright Steps",
      returnUrl: "https://our-impact.vercel.app/api/paypal/onboarding/callback",
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body));

    expect(body.partner_config_override).toEqual({
      return_url:
        "https://our-impact.vercel.app/api/paypal/onboarding/callback",
      return_url_description:
        "Return to Our Impact after connecting Bright Steps",
    });
    expect(body.partner_config_override).not.toHaveProperty("brand_name");
  });
});

describe("parsePayPalMerchantIntegrationStatus", () => {
  it("accepts PayPal's active Express Checkout status with third-party consent", () => {
    const result = parsePayPalMerchantIntegrationStatus(
      {
        merchant_id: "SELLER-1",
        payments_receivable: true,
        primary_email_confirmed: true,
        products: [{ name: "EXPRESS_CHECKOUT", status: "ACTIVE" }],
        capabilities: [{ name: "PAYPAL_CHECKOUT", status: "ACTIVE" }],
        oauth_integrations: [
          {
            integration_type: "OAUTH_THIRD_PARTY",
            oauth_third_party: [{ scopes: ["payment", "refund"] }],
          },
        ],
      },
      "fallback-seller",
    );

    expect(result.active).toBe(true);
    expect(result.permissionsGranted).toBe(true);
    expect(result.merchantId).toBe("SELLER-1");
  });

  it("accepts PayPal Commerce Platform products with subscribed vetting", () => {
    const result = parsePayPalMerchantIntegrationStatus(
      {
        merchant_id: "SELLER-PPCP",
        payments_receivable: true,
        primary_email_confirmed: true,
        products: [
          { name: "PPCP_CUSTOM", vetting_status: "SUBSCRIBED" },
          { name: "PPCP_STANDARD", vetting_status: "SUBSCRIBED" },
        ],
        oauth_integrations: [
          {
            integration_type: "OAUTH_THIRD_PARTY",
            oauth_third_party: [{ scopes: ["payment", "refund"] }],
          },
        ],
      },
      "fallback-seller",
    );

    expect(result.active).toBe(true);
    expect(result.permissionsGranted).toBe(true);
    expect(result.merchantId).toBe("SELLER-PPCP");
  });

  it("does not curate a merchant before email confirmation", () => {
    const result = parsePayPalMerchantIntegrationStatus(
      {
        payments_receivable: true,
        primary_email_confirmed: false,
        products: [{ name: "EXPRESS_CHECKOUT", status: "ACTIVE" }],
        oauth_integrations: [{ integration_type: "OAUTH_THIRD_PARTY" }],
      },
      "SELLER-2",
    );

    expect(result.active).toBe(false);
    expect(result.merchantId).toBe("SELLER-2");
  });
});

describe("extractPayPalPlatformWebhookIdentifiers", () => {
  it("extracts a completed capture without retaining payer details", () => {
    const result = extractPayPalPlatformWebhookIdentifiers({
      id: "WH-CAPTURE-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      create_time: "2026-11-01T00:00:00Z",
      resource_type: "capture",
      resource: {
        id: "CAPTURE-1",
        status: "COMPLETED",
        custom_id: "oi_ds_0123456789abcdef01234567",
        payee: { merchant_id: "SELLER-1", email_address: "private@example.com" },
        supplementary_data: { related_ids: { order_id: "ORDER-1" } },
      },
    });

    expect(result).toMatchObject({
      eventId: "WH-CAPTURE-1",
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      resourceId: "CAPTURE-1",
      orderId: "ORDER-1",
      captureId: "CAPTURE-1",
      customId: "oi_ds_0123456789abcdef01234567",
      merchantId: "SELLER-1",
      resourceStatus: "COMPLETED",
    });
    expect(JSON.stringify(result.summary)).not.toContain("private@example.com");
  });

  it("links a refund to the original capture", () => {
    const result = extractPayPalPlatformWebhookIdentifiers({
      id: "WH-REFUND-1",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: {
        id: "REFUND-1",
        status: "COMPLETED",
        supplementary_data: {
          related_ids: { order_id: "ORDER-1", capture_id: "CAPTURE-1" },
        },
      },
    });

    expect(result.resourceId).toBe("REFUND-1");
    expect(result.captureId).toBe("CAPTURE-1");
    expect(result.orderId).toBe("ORDER-1");
  });

  it("extracts a merchant ID from a consent-revoked event", () => {
    const result = extractPayPalPlatformWebhookIdentifiers({
      id: "WH-CONSENT-1",
      event_type: "MERCHANT.PARTNER-CONSENT.REVOKED",
      resource: {
        merchant_id: "SELLER-1",
      },
    });

    expect(result.merchantId).toBe("SELLER-1");
    expect(result.captureId).toBeNull();
  });
});

describe("campaign funding checkout", () => {
  it("creates one platform order with a purchase unit for each consented payee", async () => {
    vi.stubEnv("PAYPAL_SANDBOX_CLIENT_ID", "sandbox-client-id");
    vi.stubEnv("PAYPAL_SANDBOX_PARTNER_MERCHANT_ID", "PARTNER123");
    vi.stubEnv("PAYPAL_PARTNER_ATTRIBUTION_ID", "OurImpact_SP_PPCP");
    vi.mocked(getPayPalSandboxAccessToken).mockResolvedValue("access-token");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "ORDER-1", status: "CREATED" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await createPayPalCampaignFundingOrder({
      requestId: "request-1",
      campaignTitle: "Rooted in Community",
      units: [
        {
          referenceId: "oi_alloc_one",
          merchantId: "SELLER-1",
          amountMinor: 5000,
          organizationName: "Duluth Animal Shelter",
        },
        {
          referenceId: "oi_alloc_two",
          merchantId: "SELLER-2",
          amountMinor: 5000,
          organizationName: "Duluth Community Garden",
        },
      ],
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(request?.headers);
    const body = JSON.parse(String(request?.body));

    expect(headers.get("PayPal-Partner-Attribution-Id")).toBe(
      "OurImpact_SP_PPCP",
    );
    expect(headers.get("PayPal-Auth-Assertion")).toBeNull();
    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units).toEqual([
      expect.objectContaining({
        reference_id: "oi_alloc_one",
        custom_id: "oi_alloc_one",
        payee: { merchant_id: "SELLER-1" },
        amount: { currency_code: "USD", value: "50.00" },
      }),
      expect.objectContaining({
        reference_id: "oi_alloc_two",
        custom_id: "oi_alloc_two",
        payee: { merchant_id: "SELLER-2" },
        amount: { currency_code: "USD", value: "50.00" },
      }),
    ]);
  });

  it("keeps the capture result for every purchase unit", () => {
    expect(
      parsePayPalCampaignFundingCapture({
        id: "ORDER-1",
        status: "PARTIALLY_COMPLETED",
        purchase_units: [
          {
            reference_id: "oi_alloc_one",
            payments: {
              captures: [{ id: "CAPTURE-1", status: "COMPLETED" }],
            },
          },
          {
            reference_id: "oi_alloc_two",
            payments: {
              captures: [{ id: "CAPTURE-2", status: "DENIED" }],
            },
          },
        ],
      }),
    ).toEqual({
      orderStatus: "PARTIALLY_COMPLETED",
      units: [
        {
          referenceId: "oi_alloc_one",
          captureId: "CAPTURE-1",
          status: "COMPLETED",
        },
        {
          referenceId: "oi_alloc_two",
          captureId: "CAPTURE-2",
          status: "DENIED",
        },
      ],
    });
  });
});
