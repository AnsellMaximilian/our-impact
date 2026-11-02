import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getPayPalMerchantIntegrationStatus,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import {
  recipientInvitationPath,
  verifyRecipientInvitationToken,
} from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const runtime = "nodejs";

const formSchema = z.object({ inviteToken: z.string().min(40).max(200) });

function resultUrl(request: NextRequest, invitationId: string, result: string) {
  return new URL(`${recipientInvitationPath(invitationId)}?paypal=${result}`, request.url);
}

export async function POST(request: NextRequest) {
  const parsed = formSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );
  const invitationId = parsed.success
    ? verifyRecipientInvitationToken(parsed.data.inviteToken)
    : null;
  if (!invitationId) {
    return NextResponse.redirect(new URL("/?paypal=invalid_invitation", request.url), 303);
  }

  const privileged = createPrivilegedClient();
  const { data: invitation } = await privileged
    .from("recipient_invitations")
    .select("id, company_id, organization_id, status")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation || invitation.status === "revoked") {
    return NextResponse.redirect(new URL("/?paypal=invalid_invitation", request.url), 303);
  }

  const { data: connection } = await privileged
    .from("paypal_merchant_connections")
    .select("id, merchant_id")
    .eq("organization_id", invitation.organization_id)
    .maybeSingle();
  if (!connection?.merchant_id) {
    return NextResponse.redirect(resultUrl(request, invitation.id, "not_started"), 303);
  }

  try {
    const status = await getPayPalMerchantIntegrationStatus(connection.merchant_id);
    await privileged
      .from("paypal_merchant_connections")
      .update({
        status: status.active ? "active" : "needs_attention",
        curation_state: status.active ? "approved" : "pending",
        permissions_granted: status.permissionsGranted,
        consent_status: status.active ? "GRANTED" : "PENDING",
        payments_receivable: status.paymentsReceivable,
        primary_email_confirmed: status.primaryEmailConfirmed,
        products: status.products,
        capabilities: status.capabilities,
        last_error_code: status.active ? null : "merchant_setup_incomplete",
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    if (status.active) {
      await Promise.all([
        privileged
          .from("recipient_invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", invitation.id),
        privileged
          .from("workspace_recipients")
          .update({ relationship_state: "active" })
          .eq("company_id", invitation.company_id)
          .eq("organization_id", invitation.organization_id),
      ]);
    }

    return NextResponse.redirect(
      resultUrl(request, invitation.id, status.active ? "connected" : "incomplete"),
      303,
    );
  } catch (error) {
    console.error("paypal_onboarding_refresh_failed", {
      code: error instanceof PayPalPlatformError ? error.code : "merchant_verification_failed",
      connectionId: connection.id,
    });
    return NextResponse.redirect(
      resultUrl(request, invitation.id, "verification_failed"),
      303,
    );
  }
}
