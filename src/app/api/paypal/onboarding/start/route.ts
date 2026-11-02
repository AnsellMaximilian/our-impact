import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createPayPalPartnerReferral,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import {
  recipientInvitationPath,
  verifyRecipientInvitationToken,
} from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const runtime = "nodejs";

const formSchema = z.object({
  inviteToken: z.string().min(40).max(200),
});

function invitationUrl(request: NextRequest, invitationId: string, result: string) {
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
    .select("id, company_id, organization_id, status, expires_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (
    !invitation ||
    invitation.status === "revoked" ||
    (invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now())
  ) {
    return NextResponse.redirect(new URL("/?paypal=invalid_invitation", request.url), 303);
  }

  const [{ data: relationship }, { data: organization }, { data: existing }] = await Promise.all([
    privileged
      .from("workspace_recipients")
      .select("organization_id")
      .eq("company_id", invitation.company_id)
      .eq("organization_id", invitation.organization_id)
      .neq("relationship_state", "blocked")
      .maybeSingle(),
    privileged
      .from("organizations")
      .select("id, name")
      .eq("id", invitation.organization_id)
      .maybeSingle(),
    privileged
      .from("paypal_merchant_connections")
      .select("id, status, curation_state")
      .eq("organization_id", invitation.organization_id)
      .maybeSingle(),
  ]);
  if (!relationship || !organization) {
    return NextResponse.redirect(invitationUrl(request, invitation.id, "invalid"), 303);
  }

  if (existing?.status === "active" && existing.curation_state === "approved") {
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
    return NextResponse.redirect(
      invitationUrl(request, invitation.id, "already_connected"),
      303,
    );
  }

  const trackingId = randomUUID();
  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
  const returnUrl = `${siteOrigin}/api/paypal/onboarding/callback`;
  const { error: pendingError } = await privileged
    .from("paypal_merchant_connections")
    .upsert(
      {
        organization_id: invitation.organization_id,
        recipient_invitation_id: invitation.id,
        initiated_for_campaign_id: null,
        status: "pending",
        curation_state: "pending",
        tracking_id: trackingId,
        partner_referral_id: null,
        merchant_id: null,
        permissions_granted: false,
        consent_status: null,
        payments_receivable: false,
        primary_email_confirmed: false,
        products: [],
        capabilities: [],
        last_error_code: null,
        created_by: null,
        last_verified_at: null,
      },
      { onConflict: "organization_id" },
    );
  if (pendingError) {
    console.error("paypal_recipient_onboarding_reservation_failed", {
      code: pendingError.code,
      invitationId: invitation.id,
    });
    return NextResponse.redirect(
      invitationUrl(request, invitation.id, "database_error"),
      303,
    );
  }

  await privileged
    .from("recipient_invitations")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", invitation.id);

  try {
    const referral = await createPayPalPartnerReferral({
      trackingId,
      organizationName: organization.name,
      returnUrl,
    });
    await privileged
      .from("paypal_merchant_connections")
      .update({ partner_referral_id: referral.partnerReferralId })
      .eq("tracking_id", trackingId);
    return NextResponse.redirect(referral.actionUrl, 303);
  } catch (error) {
    const code = error instanceof PayPalPlatformError
      ? error.code
      : "partner_referral_failed";
    console.error("paypal_recipient_onboarding_start_failed", {
      code,
      debugId: error instanceof PayPalPlatformError ? error.debugId : null,
      invitationId: invitation.id,
    });
    await privileged
      .from("paypal_merchant_connections")
      .update({ status: "needs_attention", last_error_code: code })
      .eq("tracking_id", trackingId);
    return NextResponse.redirect(
      invitationUrl(request, invitation.id, "paypal_error"),
      303,
    );
  }
}
