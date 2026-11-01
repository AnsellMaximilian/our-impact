import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createPayPalDonationOrder,
  PayPalPlatformError,
} from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createVoteIdentity } from "@/lib/vote-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  organizationId: z.number().int().positive(),
  amountMinor: z.number().int().min(100).max(100000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId)) {
    return NextResponse.json(
      { message: "Choose a valid recipient and an amount from $1 to $1,000." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const identity = createVoteIdentity(request);
    const privileged = createPrivilegedClient();
    const { data: campaign } = await privileged
      .from("campaigns")
      .select("id, company_id, title, currency, status")
      .eq("public_id", publicId)
      .eq("status", "published")
      .maybeSingle();

    if (!campaign || campaign.currency !== "USD") {
      return NextResponse.json(
        {
          message: campaign
            ? "Supporter checkout currently supports USD campaigns only."
            : "This campaign is not available for checkout.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const [{ data: slateItem }, { data: organization }, { data: connection }] =
      await Promise.all([
        privileged
          .from("campaign_organizations")
          .select("organization_id")
          .eq("campaign_id", campaign.id)
          .eq("organization_id", parsed.data.organizationId)
          .maybeSingle(),
        privileged
          .from("organizations")
          .select("id, name")
          .eq("id", parsed.data.organizationId)
          .maybeSingle(),
        privileged
          .from("paypal_merchant_connections")
          .select("id, merchant_id, status, curation_state")
          .eq("organization_id", parsed.data.organizationId)
          .eq("status", "active")
          .eq("curation_state", "approved")
          .maybeSingle(),
      ]);

    if (!slateItem || !organization || !connection?.merchant_id) {
      return NextResponse.json(
        { message: "This recipient is not connected for PayPal checkout." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const publicReference = `oi_ds_${randomBytes(12).toString("hex")}`;
    const requestId = randomUUID();
    const { data: donation, error: reservationError } = await privileged
      .from("donation_sessions")
      .insert({
        public_reference: publicReference,
        company_id: campaign.company_id,
        campaign_id: campaign.id,
        organization_id: organization.id,
        merchant_connection_id: connection.id,
        visitor_key_hash: identity.visitorKeyHash,
        amount_minor: parsed.data.amountMinor,
        currency: "USD",
        status: "reserved",
        request_id: requestId,
      })
      .select("id")
      .single();

    if (reservationError || !donation) {
      console.error("donation_session_reservation_failed", {
        code: reservationError?.code,
        publicId,
        organizationId: organization.id,
      });
      return NextResponse.json(
        { message: "Checkout is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const order = await createPayPalDonationOrder({
        merchantId: connection.merchant_id,
        publicReference,
        requestId,
        amountMinor: parsed.data.amountMinor,
        campaignTitle: campaign.title,
        organizationName: organization.name,
      });
      const { error: updateError } = await privileged
        .from("donation_sessions")
        .update({
          status: "order_created",
          paypal_order_id: order.id,
          provider_status: order.status,
        })
        .eq("id", donation.id);

      if (updateError) {
        console.error("donation_order_persistence_failed", {
          code: updateError.code,
          donationSessionId: donation.id,
        });
        return NextResponse.json(
          { message: "The PayPal order could not be safely recorded." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      const response = NextResponse.json(
        { id: order.id },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
      if (identity.isNew) {
        const isProduction = process.env.NODE_ENV === "production";
        response.cookies.set(identity.cookieName, identity.voterToken, {
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 400,
          path: "/",
          sameSite: isProduction ? "none" : "lax",
          secure: isProduction,
          partitioned: isProduction,
        });
      }
      return response;
    } catch (error) {
      const code =
        error instanceof PayPalPlatformError
          ? error.code
          : "create_order_failed";
      await privileged
        .from("donation_sessions")
        .update({ status: "failed", last_error_code: code })
        .eq("id", donation.id);
      console.error("paypal_create_donation_order_failed", {
        code,
        debugId: error instanceof PayPalPlatformError ? error.debugId : null,
        donationSessionId: donation.id,
      });
      return NextResponse.json(
        { message: "PayPal could not start this sandbox checkout." },
        {
          status: error instanceof PayPalPlatformError ? error.status : 502,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
  } catch (error) {
    console.error("donation_order_configuration_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { message: "Checkout is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
