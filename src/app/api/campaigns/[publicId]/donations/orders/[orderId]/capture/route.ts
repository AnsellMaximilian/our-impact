import { NextResponse, type NextRequest } from "next/server";
import {
  capturePayPalDonationOrder,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { recordPayPalDonationDeveloperEvent } from "@/lib/developer/paypal-donations";
import { createVoteIdentity } from "@/lib/vote-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function loadEntitlements(
  campaignId: string,
  visitorKeyHash: string,
) {
  const privileged = createPrivilegedClient();
  const { data } = await privileged
    .from("supporter_entitlements")
    .select("entitlement_key, state, qualifying_count, valid_until")
    .eq("campaign_id", campaignId)
    .eq("visitor_key_hash", visitorKeyHash)
    .order("entitlement_key");

  return (data ?? []).map((entitlement) => {
    const expired =
      entitlement.valid_until !== null &&
      new Date(entitlement.valid_until).getTime() <= Date.now();
    return {
      key: entitlement.entitlement_key,
      state: expired ? "inactive" : entitlement.state,
      qualifyingCount: expired ? 0 : entitlement.qualifying_count,
    };
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string; orderId: string }> },
) {
  const { publicId, orderId } = await context.params;
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId) ||
    !/^[A-Za-z0-9_-]{3,255}$/.test(orderId)
  ) {
    return NextResponse.json(
      { message: "The PayPal order could not be validated." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const identity = createVoteIdentity(request);
    const privileged = createPrivilegedClient();
    const donationResult = await privileged
      .from("donation_sessions")
      .select(
        "id, campaign_id, merchant_connection_id, visitor_key_hash, status, paypal_capture_id, developer_project_id",
      )
      .eq("paypal_order_id", orderId)
      .maybeSingle();
    let donation = donationResult.data;
    if (donationResult.error?.code === "PGRST204") {
      const legacyResult = await privileged
        .from("donation_sessions")
        .select(
          "id, campaign_id, merchant_connection_id, visitor_key_hash, status, paypal_capture_id",
        )
        .eq("paypal_order_id", orderId)
        .maybeSingle();
      donation = legacyResult.data
        ? { ...legacyResult.data, developer_project_id: null }
        : null;
    }

    if (!donation || donation.visitor_key_hash !== identity.visitorKeyHash) {
      return NextResponse.json(
        { message: "This PayPal order does not belong to this browser." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const [{ data: campaign }, { data: connection }] = await Promise.all([
      privileged
        .from("campaigns")
        .select("public_id")
        .eq("id", donation.campaign_id)
        .maybeSingle(),
      privileged
        .from("paypal_merchant_connections")
        .select("merchant_id, status, curation_state")
        .eq("id", donation.merchant_connection_id)
        .maybeSingle(),
    ]);

    if (
      campaign?.public_id !== publicId ||
      !connection?.merchant_id ||
      connection.status !== "active" ||
      connection.curation_state !== "approved"
    ) {
      return NextResponse.json(
        { message: "This recipient is no longer available for checkout." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (donation.status === "completed") {
      const developerResult = await recordPayPalDonationDeveloperEvent(
        donation.id,
      ).catch((error) => {
        console.error("completed_donation_developer_event_failed", {
          donationSessionId: donation.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
        return null;
      });
      return NextResponse.json(
        {
          status: "completed",
          captureId: donation.paypal_capture_id,
          message: "This sandbox contribution was already completed.",
          entitlements:
            developerResult?.entitlements ??
            (await loadEntitlements(
              donation.campaign_id,
              identity.visitorKeyHash,
            )),
          externalUserId: developerResult?.externalUserId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!["order_created", "approved"].includes(donation.status)) {
      return NextResponse.json(
        { message: "This PayPal order cannot be captured in its current state." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    await privileged
      .from("donation_sessions")
      .update({ status: "approved", provider_status: "APPROVED" })
      .eq("id", donation.id);

    try {
      const capture = await capturePayPalDonationOrder({
        merchantId: connection.merchant_id,
        orderId,
      });
      const completed = capture.captureStatus === "COMPLETED";
      const nextStatus = completed
        ? "completed"
        : capture.captureStatus === "DENIED"
          ? "denied"
          : "approved";
      const { error: updateError } = await privileged
        .from("donation_sessions")
        .update({
          status: nextStatus,
          paypal_capture_id: capture.captureId,
          provider_status: capture.captureStatus,
          completed_at: completed ? new Date().toISOString() : null,
          last_error_code:
            capture.captureStatus === "DENIED" ? "capture_denied" : null,
        })
        .eq("id", donation.id);

      if (updateError) {
        console.error("donation_capture_persistence_failed", {
          code: updateError.code,
          donationSessionId: donation.id,
        });
        return NextResponse.json(
          {
            message:
              "PayPal responded, but Our Impact could not safely record the capture. The verified webhook will retry reconciliation.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      const developerResult = completed
        ? await recordPayPalDonationDeveloperEvent(donation.id).catch((error) => {
            console.error("donation_developer_event_failed", {
              donationSessionId: donation.id,
              message:
                error instanceof Error ? error.message : "Unknown error",
            });
            return null;
          })
        : null;
      const entitlements =
        developerResult?.entitlements ??
        (await loadEntitlements(
          donation.campaign_id,
          identity.visitorKeyHash,
        ));
      return NextResponse.json(
        {
          status: nextStatus,
          captureId: capture.captureId,
          message: completed
            ? developerResult
              ? "Contribution completed. Your Mike’s Vegan Shop benefits were refreshed."
              : donation.developer_project_id
                ? "Contribution completed. Your benefits will refresh after PayPal’s verified confirmation arrives."
                : "Contribution completed and this browser’s supporter status was refreshed."
            : "PayPal accepted the capture, but it is not complete yet.",
          entitlements,
          externalUserId: developerResult?.externalUserId,
        },
        {
          status: completed ? 200 : 202,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch (error) {
      const code =
        error instanceof PayPalPlatformError
          ? error.code
          : "capture_order_failed";
      const uncertain =
        error instanceof PayPalPlatformError && error.status === 503;
      await privileged
        .from("donation_sessions")
        .update({
          status: uncertain ? "approved" : "failed",
          last_error_code: code,
        })
        .eq("id", donation.id);
      console.error("paypal_capture_donation_order_failed", {
        code,
        debugId: error instanceof PayPalPlatformError ? error.debugId : null,
        donationSessionId: donation.id,
      });
      return NextResponse.json(
        {
          message: uncertain
            ? "The PayPal result is uncertain. Wait for the verified webhook before retrying."
            : "PayPal did not complete this sandbox capture.",
        },
        {
          status: uncertain ? 503 : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  } catch (error) {
    console.error("donation_capture_configuration_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { message: "Checkout is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
