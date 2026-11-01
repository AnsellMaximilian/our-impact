import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createPayPalPartnerReferral,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const formSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.coerce.number().int().positive(),
});

function campaignUrl(request: NextRequest, campaignId: string, query: string) {
  return new URL(`/dashboard/campaigns/${campaignId}?${query}`, request.url);
}

export async function POST(request: NextRequest) {
  const parsed = formSchema.safeParse(
    Object.fromEntries((await request.formData()).entries()),
  );

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/dashboard", request.url), 303);
  }

  const { campaignId, organizationId } = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const [{ data: campaign }, { data: slateItem }, { data: organization }] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select("id, company_id")
        .eq("id", campaignId)
        .maybeSingle(),
      supabase
        .from("campaign_organizations")
        .select("organization_id")
        .eq("campaign_id", campaignId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("id, name")
        .eq("id", organizationId)
        .maybeSingle(),
    ]);

  if (!campaign || !slateItem || !organization) {
    return NextResponse.redirect(
      campaignUrl(request, campaignId, "paypal_onboarding=invalid"),
      303,
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", campaign.company_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.redirect(
      campaignUrl(request, campaignId, "paypal_onboarding=forbidden"),
      303,
    );
  }

  const privileged = createPrivilegedClient();
  const { data: existing } = await privileged
    .from("paypal_merchant_connections")
    .select("id, status, curation_state")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (existing?.status === "active" && existing.curation_state === "approved") {
    return NextResponse.redirect(
      campaignUrl(request, campaignId, "paypal_onboarding=already_connected"),
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
        organization_id: organizationId,
        initiated_for_campaign_id: campaignId,
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
        created_by: user.id,
        last_verified_at: null,
      },
      { onConflict: "organization_id" },
    );

  if (pendingError) {
    console.error("paypal_onboarding_reservation_failed", {
      code: pendingError.code,
      campaignId,
      organizationId,
    });
    return NextResponse.redirect(
      campaignUrl(request, campaignId, "paypal_onboarding=database_error"),
      303,
    );
  }

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
    const code =
      error instanceof PayPalPlatformError
        ? error.code
        : "partner_referral_failed";
    console.error("paypal_onboarding_start_failed", {
      code,
      debugId: error instanceof PayPalPlatformError ? error.debugId : null,
      campaignId,
      organizationId,
    });
    await privileged
      .from("paypal_merchant_connections")
      .update({ status: "needs_attention", last_error_code: code })
      .eq("tracking_id", trackingId);

    return NextResponse.redirect(
      campaignUrl(request, campaignId, "paypal_onboarding=paypal_error"),
      303,
    );
  }
}
