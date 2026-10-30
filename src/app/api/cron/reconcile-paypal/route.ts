import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import {
  getPayPalSandboxConfiguration,
  getSandboxPayoutBatchDetails,
  PayPalSandboxError,
} from "@/lib/paypal/sandbox";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function reconciliationStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = (value as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  if (!getPayPalSandboxConfiguration().clientConfigured) {
    return NextResponse.json(
      { error: "PayPal Sandbox reconciliation is not configured" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const supabase = createPrivilegedClient();
    const { data: claims, error: claimError } = await supabase.rpc(
      "claim_paypal_sandbox_reconciliations",
      { p_limit: 10, p_lease_seconds: 120 },
    );

    if (claimError) {
      console.error("PayPal Sandbox reconciliation claim failed", {
        code: claimError.code,
      });
      return NextResponse.json(
        { error: "Reconciliation claim failed" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const summary = {
      status: "complete" as "complete" | "partial",
      claimed: claims.length,
      reconciled: 0,
      changed: 0,
      unchanged: 0,
      errors: 0,
    };

    for (const claim of claims) {
      try {
        const details = await getSandboxPayoutBatchDetails({
          batchId: claim.provider_batch_id,
          senderItemId: claim.sender_item_id,
        });
        const { data, error } = await supabase.rpc(
          "record_paypal_sandbox_reconciliation",
          {
            p_payment_transaction_id: claim.payment_transaction_id,
            p_provider_batch_id: details.batchId,
            p_provider_item_id: details.itemId ?? undefined,
            p_sender_item_id: details.senderItemId ?? undefined,
            p_batch_status: details.batchStatus,
            p_item_status: details.itemStatus ?? undefined,
          },
        );

        if (error) {
          throw new Error(`persistence_${error.code}`);
        }

        summary.reconciled += 1;
        if (reconciliationStatus(data) === "applied") {
          summary.changed += 1;
        } else {
          summary.unchanged += 1;
        }
      } catch (error) {
        const errorCode =
          error instanceof PayPalSandboxError
            ? error.code
            : error instanceof Error && error.message.startsWith("persistence_")
              ? error.message
              : "paypal_reconciliation_failed";

        const { error: persistenceError } = await supabase.rpc(
          "record_paypal_sandbox_reconciliation_error",
          {
            p_payment_transaction_id: claim.payment_transaction_id,
            p_error_code: errorCode,
          },
        );

        console.error("PayPal Sandbox reconciliation attempt failed", {
          transactionId: claim.payment_transaction_id,
          errorCode,
          errorPersistenceCode: persistenceError?.code,
        });
        summary.errors += 1;
        summary.status = "partial";
      }
    }

    return NextResponse.json(summary, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("PayPal Sandbox reconciliation configuration error", error);
    return NextResponse.json(
      { error: "Reconciliation is not configured" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
