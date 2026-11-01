import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getPayPalMerchantIntegrationStatus,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const formSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.coerce.number().int().positive(),
});

function resultUrl(request: NextRequest, campaignId: string, result: string) {
  return new URL(
    `/dashboard/campaigns/${campaignId}?paypal_onboarding=${result}`,
    request.url,
  );
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
  if (!user) return NextResponse.redirect(new URL("/login", request.url), 303);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("company_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) {
    return NextResponse.redirect(resultUrl(request, campaignId, "invalid"), 303);
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", campaign.company_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.redirect(
      resultUrl(request, campaignId, "forbidden"),
      303,
    );
  }

  const privileged = createPrivilegedClient();
  const { data: connection } = await privileged
    .from("paypal_merchant_connections")
    .select("id, merchant_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!connection?.merchant_id) {
    return NextResponse.redirect(
      resultUrl(request, campaignId, "not_started"),
      303,
    );
  }

  try {
    const status = await getPayPalMerchantIntegrationStatus(
      connection.merchant_id,
    );
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

    return NextResponse.redirect(
      resultUrl(request, campaignId, status.active ? "connected" : "incomplete"),
      303,
    );
  } catch (error) {
    console.error("paypal_onboarding_refresh_failed", {
      code:
        error instanceof PayPalPlatformError
          ? error.code
          : "merchant_verification_failed",
      connectionId: connection.id,
    });
    return NextResponse.redirect(
      resultUrl(request, campaignId, "verification_failed"),
      303,
    );
  }
}
