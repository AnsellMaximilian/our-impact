import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createPayPalCampaignFundingOrder,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({ snapshotId: z.uuid() });
const reservationSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  paypal_order_id: z.string().nullable(),
  currency: z.string(),
  total_minor: z.number().int().positive(),
  units: z.array(
    z.object({
      organization_id: z.number().int().positive(),
      merchant_id: z.string().min(3),
      reference_id: z.string().min(3),
      amount_minor: z.number().int().positive(),
      currency: z.string(),
    }),
  ),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: campaignId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(campaignId).success || !parsed.success) {
    return NextResponse.json(
      { message: "Choose a valid campaign allocation." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { message: "Sign in to fund this campaign." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, company_id, title, currency")
    .eq("id", campaignId)
    .maybeSingle();
  const { data: membership } = campaign
    ? await supabase
        .from("memberships")
        .select("role")
        .eq("company_id", campaign.company_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (!campaign || !membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json(
      { message: "Owner or admin access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const privileged = createPrivilegedClient();
  const { data: reservationData, error: reservationError } = await privileged.rpc(
    "reserve_campaign_funding_order",
    {
      p_snapshot_id: parsed.data.snapshotId,
      p_initiated_by: user.id,
      p_request_id: randomUUID(),
    },
  );
  const reservation = reservationSchema.safeParse(reservationData);

  if (reservationError || !reservation.success) {
    console.error("campaign_funding_reservation_failed", {
      code: reservationError?.code,
      campaignId,
      snapshotId: parsed.data.snapshotId,
    });
    return NextResponse.json(
      {
        message:
          reservationError?.message ??
          "This allocation is not ready for PayPal checkout yet.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const fundingOrder = reservation.data;
  if (fundingOrder.status === "completed") {
    return NextResponse.json(
      { message: "This campaign allocation has already been funded." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (fundingOrder.paypal_order_id) {
    return NextResponse.json(
      { id: fundingOrder.paypal_order_id },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: claimed } = await privileged
    .from("campaign_funding_orders")
    .update({ status: "creating", last_error_code: null })
    .eq("id", fundingOrder.id)
    .in("status", ["reserved", "failed"])
    .is("paypal_order_id", null)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json(
      { message: "PayPal checkout is already starting. Try again in a moment." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const organizationIds = [
    ...new Set(fundingOrder.units.map((unit) => unit.organization_id)),
  ];
  const { data: organizations } = await privileged
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);
  const organizationNames = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name]),
  );

  try {
    const order = await createPayPalCampaignFundingOrder({
      requestId: `funding-${fundingOrder.id}`,
      campaignTitle: campaign.title,
      units: fundingOrder.units.map((unit) => ({
        referenceId: unit.reference_id,
        merchantId: unit.merchant_id,
        amountMinor: unit.amount_minor,
        organizationName:
          organizationNames.get(unit.organization_id) ?? "Community recipient",
      })),
    });

    const { error: updateError } = await privileged
      .from("campaign_funding_orders")
      .update({
        status: "order_created",
        paypal_order_id: order.id,
        provider_status: order.status,
        attempt_count: 1,
      })
      .eq("id", fundingOrder.id)
      .eq("status", "creating");
    if (updateError) throw updateError;

    await privileged
      .from("campaign_funding_units")
      .update({ status: "order_created", provider_status: order.status })
      .eq("funding_order_id", fundingOrder.id);

    return NextResponse.json(
      { id: order.id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code =
      error instanceof PayPalPlatformError
        ? error.code
        : "create_funding_order_failed";
    await privileged
      .from("campaign_funding_orders")
      .update({
        status: "failed",
        last_error_code: code,
        provider_debug_id:
          error instanceof PayPalPlatformError ? error.debugId : null,
      })
      .eq("id", fundingOrder.id);
    console.error("paypal_create_campaign_funding_order_failed", {
      code,
      debugId: error instanceof PayPalPlatformError ? error.debugId : null,
      fundingOrderId: fundingOrder.id,
    });
    return NextResponse.json(
      { message: "PayPal could not start this checkout. Please try again." },
      {
        status: error instanceof PayPalPlatformError ? error.status : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
