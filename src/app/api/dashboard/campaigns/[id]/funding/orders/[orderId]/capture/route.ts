import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  capturePayPalCampaignFundingOrder,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: campaignId, orderId } = await context.params;
  if (
    !z.uuid().safeParse(campaignId).success ||
    !/^[A-Za-z0-9_-]{3,255}$/.test(orderId)
  ) {
    return NextResponse.json(
      { message: "The PayPal order could not be validated." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { message: "Sign in to complete this payment." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, company_id")
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
  const { data: fundingOrder } = await privileged
    .from("campaign_funding_orders")
    .select("id, status, paypal_order_id")
    .eq("campaign_id", campaignId)
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  if (!fundingOrder) {
    return NextResponse.json(
      { message: "This campaign payment could not be found." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (fundingOrder.status === "completed") {
    return NextResponse.json(
      { status: "completed", message: "This campaign payment is complete." },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: claimed } = await privileged
    .from("campaign_funding_orders")
    .update({ status: "capturing", provider_status: "APPROVED" })
    .eq("id", fundingOrder.id)
    .in("status", ["order_created", "approved", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return NextResponse.json(
      { message: "This payment is already being confirmed. Refresh shortly." },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const capture = await capturePayPalCampaignFundingOrder({ orderId });
    const { data: result, error: recordError } = await privileged.rpc(
      "record_campaign_funding_capture",
      {
        p_funding_order_id: fundingOrder.id,
        p_paypal_order_id: orderId,
        p_order_status: capture.orderStatus,
        p_units: capture.units.map((unit) => ({
          reference_id: unit.referenceId,
          capture_id: unit.captureId,
          status: unit.status,
        })),
      },
    );
    if (recordError) {
      console.error("campaign_funding_capture_persistence_failed", {
        code: recordError.code,
        fundingOrderId: fundingOrder.id,
      });
      await privileged
        .from("campaign_funding_orders")
        .update({
          status: "requires_reconciliation",
          last_error_code: "capture_persistence_failed",
        })
        .eq("id", fundingOrder.id);
      return NextResponse.json(
        {
          message:
            "PayPal responded, but the result still needs to be reconciled. Do not pay again yet.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    revalidatePath(`/dashboard/campaigns/${campaignId}`);
    const completed =
      result !== null &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      result.status === "completed";
    return NextResponse.json(
      {
        status: completed ? "completed" : "partially_completed",
        message: completed
          ? "Payment complete. Each recipient’s result is now recorded."
          : "PayPal completed part of this payment. Review the recipient results before trying anything again.",
      },
      {
        status: completed ? 200 : 207,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const code =
      error instanceof PayPalPlatformError
        ? error.code
        : "capture_funding_order_failed";
    const uncertain =
      error instanceof PayPalPlatformError && error.status === 503;
    const restart =
      error instanceof PayPalPlatformError &&
      error.details.some((detail) => detail.issue === "INSTRUMENT_DECLINED");
    await privileged
      .from("campaign_funding_orders")
      .update({
        status: uncertain ? "requires_reconciliation" : "failed",
        last_error_code: code,
        provider_debug_id:
          error instanceof PayPalPlatformError ? error.debugId : null,
      })
      .eq("id", fundingOrder.id);
    console.error("paypal_capture_campaign_funding_order_failed", {
      code,
      debugId: error instanceof PayPalPlatformError ? error.debugId : null,
      fundingOrderId: fundingOrder.id,
    });
    return NextResponse.json(
      {
        restart,
        message: uncertain
          ? "PayPal’s result is still being confirmed. Do not pay again yet."
          : restart
            ? "PayPal declined that payment method. Choose another one to continue."
            : "PayPal did not complete this payment. No completed recipient payment was recorded.",
      },
      {
        status: uncertain ? 503 : 422,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
