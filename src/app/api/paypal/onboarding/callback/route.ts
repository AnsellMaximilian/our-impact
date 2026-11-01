import { NextResponse, type NextRequest } from "next/server";
import {
  getPayPalMerchantIntegrationStatus,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const runtime = "nodejs";

function dashboardUrl(
  request: NextRequest,
  campaignId: string | null,
  result: string,
) {
  const path = campaignId
    ? `/dashboard/campaigns/${campaignId}`
    : "/dashboard";
  return new URL(`${path}?paypal_onboarding=${result}`, request.url);
}

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("merchantId")?.trim();
  const merchantId = request.nextUrl.searchParams
    .get("merchantIdInPayPal")
    ?.trim();
  const callbackConsent = request.nextUrl.searchParams
    .get("consentStatus")
    ?.trim();

  if (!trackingId || !merchantId) {
    return NextResponse.redirect(
      dashboardUrl(request, null, "invalid_callback"),
      303,
    );
  }

  const privileged = createPrivilegedClient();
  const { data: connection } = await privileged
    .from("paypal_merchant_connections")
    .select("id, initiated_for_campaign_id")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.redirect(
      dashboardUrl(request, null, "unknown_connection"),
      303,
    );
  }

  try {
    const status = await getPayPalMerchantIntegrationStatus(merchantId);
    const nextStatus = status.active ? "active" : "needs_attention";
    const { error } = await privileged
      .from("paypal_merchant_connections")
      .update({
        merchant_id: status.merchantId,
        status: nextStatus,
        curation_state: status.active ? "approved" : "pending",
        permissions_granted: status.permissionsGranted,
        consent_status: callbackConsent ?? (status.active ? "GRANTED" : "PENDING"),
        payments_receivable: status.paymentsReceivable,
        primary_email_confirmed: status.primaryEmailConfirmed,
        products: status.products,
        capabilities: status.capabilities,
        last_error_code: status.active ? null : "merchant_setup_incomplete",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    if (error) throw error;

    return NextResponse.redirect(
      dashboardUrl(
        request,
        connection.initiated_for_campaign_id,
        status.active ? "connected" : "incomplete",
      ),
      303,
    );
  } catch (error) {
    const code =
      error instanceof PayPalPlatformError
        ? error.code
        : "merchant_verification_failed";
    console.error("paypal_onboarding_callback_failed", {
      code,
      debugId: error instanceof PayPalPlatformError ? error.debugId : null,
      connectionId: connection.id,
    });
    await privileged
      .from("paypal_merchant_connections")
      .update({
        merchant_id: merchantId,
        status: "needs_attention",
        curation_state: "pending",
        last_error_code: code,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return NextResponse.redirect(
      dashboardUrl(
        request,
        connection.initiated_for_campaign_id,
        "verification_failed",
      ),
      303,
    );
  }
}
