import { NextResponse, type NextRequest } from "next/server";
import {
  getPayPalMerchantIntegrationStatus,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { recipientInvitationPath } from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const runtime = "nodejs";

type ConnectionReturn = {
  initiated_for_campaign_id: string | null;
  recipient_invitation_id: string | null;
};

function resultUrl(request: NextRequest, connection: ConnectionReturn | null, result: string) {
  if (connection?.recipient_invitation_id) {
    return new URL(
      `${recipientInvitationPath(connection.recipient_invitation_id)}?paypal=${result}`,
      request.url,
    );
  }
  const path = connection?.initiated_for_campaign_id
    ? `/dashboard/campaigns/${connection.initiated_for_campaign_id}`
    : "/dashboard";
  return new URL(`${path}?paypal_onboarding=${result}`, request.url);
}

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("merchantId")?.trim();
  const merchantId = request.nextUrl.searchParams.get("merchantIdInPayPal")?.trim();
  const callbackConsent = request.nextUrl.searchParams.get("consentStatus")?.trim();

  if (!trackingId || !merchantId) {
    return NextResponse.redirect(resultUrl(request, null, "invalid_callback"), 303);
  }

  const privileged = createPrivilegedClient();
  const { data: connection } = await privileged
    .from("paypal_merchant_connections")
    .select("id, organization_id, initiated_for_campaign_id, recipient_invitation_id")
    .eq("tracking_id", trackingId)
    .maybeSingle();
  if (!connection) {
    return NextResponse.redirect(resultUrl(request, null, "unknown_connection"), 303);
  }

  try {
    const status = await getPayPalMerchantIntegrationStatus(merchantId);
    const { error } = await privileged
      .from("paypal_merchant_connections")
      .update({
        merchant_id: status.merchantId,
        status: status.active ? "active" : "needs_attention",
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

    if (status.active && connection.recipient_invitation_id) {
      const { data: invitation } = await privileged
        .from("recipient_invitations")
        .select("company_id, organization_id")
        .eq("id", connection.recipient_invitation_id)
        .maybeSingle();
      if (invitation) {
        await Promise.all([
          privileged
            .from("recipient_invitations")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", connection.recipient_invitation_id),
          privileged
            .from("workspace_recipients")
            .update({ relationship_state: "active" })
            .eq("company_id", invitation.company_id)
            .eq("organization_id", invitation.organization_id),
        ]);
      }
    }

    return NextResponse.redirect(
      resultUrl(request, connection, status.active ? "connected" : "incomplete"),
      303,
    );
  } catch (error) {
    const code = error instanceof PayPalPlatformError
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
    return NextResponse.redirect(resultUrl(request, connection, "verification_failed"), 303);
  }
}
