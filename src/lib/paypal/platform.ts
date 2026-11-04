import "server-only";

import { randomUUID } from "node:crypto";
import {
  extractPayPalErrorDiagnostics,
  formatPayPalPayoutAmount,
  type PayPalErrorDetail,
} from "./core";
import {
  getPayPalSandboxAccessToken,
  PAYPAL_SANDBOX_ORIGIN,
} from "./sandbox";

const REQUEST_TIMEOUT_MS = 15_000;

type JsonObject = { [key: string]: unknown };

type PayPalLink = {
  href?: unknown;
  rel?: unknown;
};

export class PayPalPlatformError extends Error {
  constructor(
    public readonly code: string,
    public readonly debugId: string | null = null,
    public readonly details: PayPalErrorDetail[] = [],
    public readonly status: number = 502,
  ) {
    super("The PayPal platform request could not be completed.");
  }
}

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function safeCode(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value : fallback;
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 80) || fallback;
}

function getRequiredPlatformConfiguration() {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const partnerMerchantId = process.env.PAYPAL_SANDBOX_PARTNER_MERCHANT_ID;
  const attributionId = process.env.PAYPAL_PARTNER_ATTRIBUTION_ID;

  if (!clientId || !partnerMerchantId || !attributionId) {
    throw new PayPalPlatformError("platform_configuration_missing", null, [], 503);
  }

  return { clientId, partnerMerchantId, attributionId };
}

export function getPayPalPlatformConfiguration() {
  const clientId = process.env.PAYPAL_SANDBOX_CLIENT_ID ?? null;
  const partnerMerchantId =
    process.env.PAYPAL_SANDBOX_PARTNER_MERCHANT_ID ?? null;
  const attributionId = process.env.PAYPAL_PARTNER_ATTRIBUTION_ID ?? null;
  const clientSecretConfigured = Boolean(
    process.env.PAYPAL_SANDBOX_CLIENT_SECRET,
  );

  return {
    clientId,
    partnerMerchantId,
    attributionId,
    onboardingReady: Boolean(
      clientId &&
        clientSecretConfigured &&
        partnerMerchantId &&
        attributionId,
    ),
    checkoutReady: Boolean(
      clientId &&
        clientSecretConfigured &&
        partnerMerchantId &&
        attributionId,
    ),
  };
}

async function readPayPalResponse(response: Response) {
  const payload = await response.json().catch(() => null);
  if (response.ok) return payload;

  const root = asObject(payload);
  const diagnostics = extractPayPalErrorDiagnostics(payload);
  throw new PayPalPlatformError(
    safeCode(root?.name, `paypal_http_${response.status}`),
    diagnostics.debugId,
    diagnostics.details,
    response.status >= 500 ? 503 : 502,
  );
}

function platformHeaders(accessToken: string, requestId?: string) {
  const { attributionId } = getRequiredPlatformConfiguration();
  return {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "PayPal-Partner-Attribution-Id": attributionId,
    ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
  };
}

export async function createPayPalPartnerReferral(input: {
  trackingId: string;
  organizationName: string;
  returnUrl: string;
}) {
  if (input.trackingId.length > 127 || input.returnUrl.length > 127) {
    throw new PayPalPlatformError("partner_referral_input_too_long", null, [], 400);
  }

  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(
    `${PAYPAL_SANDBOX_ORIGIN}/v2/customer/partner-referrals`,
    {
      method: "POST",
      headers: platformHeaders(accessToken, `onboard-${input.trackingId}`),
      body: JSON.stringify({
        tracking_id: input.trackingId,
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: {
                integration_method: "PAYPAL",
                integration_type: "THIRD_PARTY",
                third_party_details: {
                  features: ["PAYMENT", "REFUND"],
                },
              },
            },
          },
        ],
        products: ["EXPRESS_CHECKOUT"],
        legal_consents: [
          {
            type: "SHARE_DATA_CONSENT",
            granted: true,
          },
        ],
        partner_config_override: {
          return_url: input.returnUrl,
          return_url_description:
            `Return to Our Impact after connecting ${input.organizationName}`.slice(
              0,
              127,
            ),
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new PayPalPlatformError("partner_referral_unavailable", null, [], 503);
  });
  const payload = asObject(await readPayPalResponse(response));
  const links = Array.isArray(payload?.links)
    ? (payload.links as PayPalLink[])
    : [];
  const actionUrl = links.find((link) => link.rel === "action_url")?.href;
  const selfUrl = links.find((link) => link.rel === "self")?.href;

  if (typeof actionUrl !== "string") {
    throw new PayPalPlatformError("partner_referral_action_missing");
  }

  return {
    actionUrl,
    partnerReferralId:
      asString(payload?.partner_referral_id) ??
      (typeof selfUrl === "string"
        ? selfUrl.split("/").filter(Boolean).at(-1) ?? null
        : null),
  };
}

export async function getPayPalMerchantIntegrationStatus(merchantId: string) {
  const { partnerMerchantId } = getRequiredPlatformConfiguration();
  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(
    `${PAYPAL_SANDBOX_ORIGIN}/v1/customer/partners/${encodeURIComponent(partnerMerchantId)}/merchant-integrations/${encodeURIComponent(merchantId)}`,
    {
      headers: platformHeaders(accessToken),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new PayPalPlatformError("merchant_status_unavailable", null, [], 503);
  });
  return parsePayPalMerchantIntegrationStatus(
    await readPayPalResponse(response),
    merchantId,
  );
}

export function parsePayPalMerchantIntegrationStatus(
  rawPayload: unknown,
  merchantId: string,
) {
  const payload = asObject(rawPayload);
  const products = Array.isArray(payload?.products) ? payload.products : [];
  const capabilities = Array.isArray(payload?.capabilities)
    ? payload.capabilities
    : [];
  const oauthIntegrations = Array.isArray(payload?.oauth_integrations)
    ? payload.oauth_integrations
    : [];
  const checkoutProductActive = products.some((value) => {
    const product = asObject(value);
    const name = asString(product?.name);
    const status =
      asString(product?.vetting_status) ?? asString(product?.status);

    if (name === "EXPRESS_CHECKOUT") {
      return !status || ["ACTIVE", "SUBSCRIBED"].includes(status);
    }

    return (
      ["PPCP", "PPCP_CUSTOM", "PPCP_STANDARD"].includes(name ?? "") &&
      ["ACTIVE", "SUBSCRIBED", "SUBSCRIBED_WITH_LIMIT"].includes(
        status ?? "",
      )
    );
  });
  const permissionsGranted = oauthIntegrations.length > 0;
  const paymentsReceivable = asBoolean(payload?.payments_receivable);
  const primaryEmailConfirmed = asBoolean(payload?.primary_email_confirmed);

  return {
    merchantId: asString(payload?.merchant_id) ?? merchantId,
    permissionsGranted,
    paymentsReceivable,
    primaryEmailConfirmed,
    products,
    capabilities,
    active:
      permissionsGranted &&
      paymentsReceivable &&
      primaryEmailConfirmed &&
      checkoutProductActive,
  };
}

function base64Url(value: JsonObject) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function buildPayPalAuthAssertion(merchantId: string) {
  const { clientId } = getRequiredPlatformConfiguration();
  return `${base64Url({ alg: "none" })}.${base64Url({ iss: clientId, payer_id: merchantId })}.`;
}

function merchantHeaders(
  accessToken: string,
  merchantId: string,
  requestId: string,
) {
  return {
    ...platformHeaders(accessToken, requestId),
    "PayPal-Auth-Assertion": buildPayPalAuthAssertion(merchantId),
  };
}

export async function createPayPalDonationOrder(input: {
  merchantId: string;
  publicReference: string;
  requestId: string;
  amountMinor: number;
  campaignTitle: string;
  organizationName: string;
}) {
  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v2/checkout/orders`, {
    method: "POST",
    headers: merchantHeaders(accessToken, input.merchantId, input.requestId),
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.publicReference,
          custom_id: input.publicReference,
          description: `${input.campaignTitle} · ${input.organizationName}`.slice(
            0,
            127,
          ),
          payee: { merchant_id: input.merchantId },
          amount: {
            currency_code: "USD",
            value: formatPayPalPayoutAmount(input.amountMinor, "USD"),
          },
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new PayPalPlatformError("create_order_unavailable", null, [], 503);
  });
  const payload = asObject(await readPayPalResponse(response));
  const id = asString(payload?.id);
  const status = asString(payload?.status);

  if (!id || !status) {
    throw new PayPalPlatformError("invalid_create_order_response");
  }

  return { id, status };
}

export async function capturePayPalDonationOrder(input: {
  merchantId: string;
  orderId: string;
  requestId?: string;
}) {
  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(
    `${PAYPAL_SANDBOX_ORIGIN}/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`,
    {
      method: "POST",
      headers: merchantHeaders(
        accessToken,
        input.merchantId,
        input.requestId ?? `capture-${randomUUID()}`,
      ),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new PayPalPlatformError("capture_order_unavailable", null, [], 503);
  });
  const payload = asObject(await readPayPalResponse(response));
  const orderStatus = asString(payload?.status);
  const purchaseUnits = Array.isArray(payload?.purchase_units)
    ? payload.purchase_units
    : [];
  const firstPurchaseUnit = asObject(purchaseUnits[0]);
  const payments = asObject(firstPurchaseUnit?.payments);
  const captures = Array.isArray(payments?.captures) ? payments.captures : [];
  const capture = asObject(captures[0]);
  const captureId = asString(capture?.id);
  const captureStatus = asString(capture?.status);

  if (!orderStatus || !captureId || !captureStatus) {
    throw new PayPalPlatformError("invalid_capture_order_response");
  }

  return { orderStatus, captureId, captureStatus };
}

export type PayPalCampaignFundingUnit = {
  referenceId: string;
  merchantId: string;
  amountMinor: number;
  organizationName: string;
};

export async function createPayPalCampaignFundingOrder(input: {
  requestId: string;
  campaignTitle: string;
  units: PayPalCampaignFundingUnit[];
}) {
  if (input.units.length < 1 || input.units.length > 10) {
    throw new PayPalPlatformError("invalid_purchase_unit_count", null, [], 400);
  }

  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(`${PAYPAL_SANDBOX_ORIGIN}/v2/checkout/orders`, {
    method: "POST",
    // Multi-seller checkout is created by the platform. Each consented receiver
    // is identified in its purchase unit; no recipient or payer credentials are
    // ever passed through Our Impact.
    headers: platformHeaders(accessToken, input.requestId),
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: input.units.map((unit) => ({
        reference_id: unit.referenceId,
        custom_id: unit.referenceId,
        description: `${input.campaignTitle} · ${unit.organizationName}`.slice(
          0,
          127,
        ),
        payee: { merchant_id: unit.merchantId },
        amount: {
          currency_code: "USD",
          value: formatPayPalPayoutAmount(unit.amountMinor, "USD"),
        },
      })),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => {
    throw new PayPalPlatformError("create_funding_order_unavailable", null, [], 503);
  });
  const payload = asObject(await readPayPalResponse(response));
  const id = asString(payload?.id);
  const status = asString(payload?.status);

  if (!id || !status) {
    throw new PayPalPlatformError("invalid_create_funding_order_response");
  }

  return { id, status };
}

export type PayPalCampaignFundingCaptureUnit = {
  referenceId: string;
  captureId: string | null;
  status: string;
};

export function parsePayPalCampaignFundingCapture(rawPayload: unknown) {
  const payload = asObject(rawPayload);
  const orderStatus = asString(payload?.status);
  const purchaseUnits = Array.isArray(payload?.purchase_units)
    ? payload.purchase_units
    : [];
  const units = purchaseUnits.flatMap((rawUnit) => {
    const unit = asObject(rawUnit);
    const referenceId = asString(unit?.reference_id);
    if (!referenceId) return [];

    const payments = asObject(unit?.payments);
    const captures = Array.isArray(payments?.captures) ? payments.captures : [];
    const capture = asObject(captures[0]);
    return [
      {
        referenceId,
        captureId: asString(capture?.id),
        status: asString(capture?.status) ?? "PENDING",
      },
    ];
  });

  if (!orderStatus || units.length === 0) {
    throw new PayPalPlatformError("invalid_capture_funding_order_response");
  }

  return { orderStatus, units };
}

export async function capturePayPalCampaignFundingOrder(input: {
  orderId: string;
  requestId?: string;
}) {
  const accessToken = await getPayPalSandboxAccessToken();
  const response = await fetch(
    `${PAYPAL_SANDBOX_ORIGIN}/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`,
    {
      method: "POST",
      headers: platformHeaders(
        accessToken,
        input.requestId ?? `funding-capture-${randomUUID()}`,
      ),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  ).catch(() => {
    throw new PayPalPlatformError("capture_funding_order_unavailable", null, [], 503);
  });

  return parsePayPalCampaignFundingCapture(await readPayPalResponse(response));
}

export type PayPalPlatformWebhookIdentifiers = {
  eventId: string;
  eventType: string;
  resourceId: string | null;
  orderId: string | null;
  captureId: string | null;
  customId: string | null;
  merchantId: string | null;
  resourceStatus: string | null;
  summary: {
    event_id: string;
    event_type: string;
    create_time: string | null;
    resource_type: string | null;
    resource: {
      id: string | null;
      order_id: string | null;
      capture_id: string | null;
      custom_id: string | null;
      merchant_id: string | null;
      status: string | null;
    };
  };
};

export function extractPayPalPlatformWebhookIdentifiers(
  event: unknown,
): PayPalPlatformWebhookIdentifiers {
  const root = asObject(event);
  const resource = asObject(root?.resource);
  const eventId = asString(root?.id);
  const eventType = asString(root?.event_type);

  if (!eventId || !eventType || !resource) {
    throw new Error("The PayPal webhook payload is missing required fields.");
  }

  const supplementaryData = asObject(resource?.supplementary_data);
  const relatedIds = asObject(supplementaryData?.related_ids);
  const payee = asObject(resource?.payee);
  const resourceId = asString(resource?.id);
  const orderId =
    asString(relatedIds?.order_id) ?? asString(resource?.order_id);
  const isRefundOrReversal =
    eventType === "PAYMENT.CAPTURE.REFUNDED" ||
    eventType === "PAYMENT.CAPTURE.REVERSED";
  const captureId = isRefundOrReversal
    ? asString(relatedIds?.capture_id) ?? resourceId
    : eventType.startsWith("PAYMENT.CAPTURE.")
      ? resourceId
      : asString(relatedIds?.capture_id);
  const customId = asString(resource?.custom_id);
  const merchantId =
    asString(resource?.merchant_id) ??
    asString(resource?.merchant_id_in_paypal) ??
    asString(payee?.merchant_id);
  const resourceStatus = asString(resource?.status);

  return {
    eventId,
    eventType,
    resourceId,
    orderId,
    captureId,
    customId,
    merchantId,
    resourceStatus,
    summary: {
      event_id: eventId,
      event_type: eventType,
      create_time: asString(root?.create_time),
      resource_type: asString(root?.resource_type),
      resource: {
        id: resourceId,
        order_id: orderId,
        capture_id: captureId,
        custom_id: customId,
        merchant_id: merchantId,
        status: resourceStatus,
      },
    },
  };
}
