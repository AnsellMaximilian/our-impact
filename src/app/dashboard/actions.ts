"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { moneyToMinorUnits } from "@/lib/money";
import { maskSandboxRecipient } from "@/lib/paypal/core";
import {
  createSandboxPayout,
  getPayPalSandboxConfiguration,
  PayPalSandboxError,
} from "@/lib/paypal/sandbox";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export type DashboardActionState = {
  error?: string;
};

const companySchema = z.object({
  name: z.string().trim().min(2, "Enter a company name.").max(120),
  publicName: z.string().trim().min(2, "Enter a public display name.").max(120),
});

const campaignSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Give the campaign a title.")
    .max(120)
    .refine((value) => /[a-z0-9]/i.test(value), "Use at least one letter or number."),
  summary: z.string().trim().min(20, "Add a little more context for visitors.").max(280),
  amount: z.string().trim().min(1),
  currency: z.enum(["EUR", "IDR", "USD"]),
  timezone: z.string().trim().min(3).max(80),
  periodCadence: z.enum(["daily", "weekly"]),
  closeLocalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid local close time."),
  closeWeekday: z.coerce.number().int().min(0).max(6),
  allocationModel: z.enum(["winner_takes_all", "proportional", "hybrid"]),
  organizationIds: z.array(z.coerce.number().int().positive()).min(2).max(5),
});

const campaignIdSchema = z.string().uuid("This campaign could not be found.");

function parseCampaign(formData: FormData) {
  return campaignSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    periodCadence: formData.get("period_cadence"),
    closeLocalTime: formData.get("close_local_time"),
    closeWeekday: formData.get("close_weekday"),
    allocationModel: formData.get("allocation_model"),
    organizationIds: formData.getAll("organization_ids"),
  });
}

function parseBudget(amount: string, currency: string) {
  try {
    return { budgetMinor: moneyToMinorUnits(amount, currency) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Enter a valid budget.",
    };
  }
}

async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  return { supabase, userId };
}

export async function createCompany(
  _state: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = companySchema.safeParse({
    name: formData.get("name"),
    publicName: formData.get("public_name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the workspace details." };
  }

  const { supabase, userId } = await getAuthenticatedUserId();
  const slugBase = slugify(parsed.data.name) || "company";
  const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;

  const { error } = await supabase.from("companies").insert({
    name: parsed.data.name,
    public_name: parsed.data.publicName,
    slug,
    created_by: userId,
  });

  if (error) {
    return { error: "We couldn’t create the workspace. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createDraftCampaign(
  _state: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = parseCampaign(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the campaign details." };
  }

  const budget = parseBudget(parsed.data.amount, parsed.data.currency);
  if ("error" in budget) return { error: budget.error };

  const { supabase } = await getAuthenticatedUserId();
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("company_id, role")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return { error: "You need owner or admin access to create a campaign." };
  }

  const { error } = await supabase.rpc("create_draft_campaign", {
    p_company_id: membership.company_id,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary,
    p_budget_minor: budget.budgetMinor,
    p_currency: parsed.data.currency,
    p_timezone: parsed.data.timezone,
    p_period_cadence: parsed.data.periodCadence,
    p_allocation_model: parsed.data.allocationModel,
    p_close_local_time: parsed.data.closeLocalTime,
    p_close_weekday: parsed.data.closeWeekday,
    p_organization_ids: parsed.data.organizationIds,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?created=1");
}

export async function updateDraftCampaign(
  _state: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const parsed = parseCampaign(formData);

  if (!campaignId.success) {
    return { error: campaignId.error.issues[0]?.message };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the campaign details." };
  }

  const budget = parseBudget(parsed.data.amount, parsed.data.currency);
  if ("error" in budget) return { error: budget.error };

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("update_draft_campaign", {
    p_campaign_id: campaignId.data,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary,
    p_budget_minor: budget.budgetMinor,
    p_currency: parsed.data.currency,
    p_timezone: parsed.data.timezone,
    p_period_cadence: parsed.data.periodCadence,
    p_allocation_model: parsed.data.allocationModel,
    p_close_local_time: parsed.data.closeLocalTime,
    p_close_weekday: parsed.data.closeWeekday,
    p_organization_ids: parsed.data.organizationIds,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  redirect(`/dashboard/campaigns/${campaignId.data}?saved=1`);
}

export async function publishDraftCampaign(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  if (!campaignId.success) redirect("/dashboard");

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("publish_campaign", {
    p_campaign_id: campaignId.data,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  if (error) {
    redirect(`/dashboard/campaigns/${campaignId.data}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/campaigns/${campaignId.data}?published=1`);
}

export async function setCampaignStatus(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const status = z.enum(["published", "paused"]).safeParse(formData.get("status"));
  if (!campaignId.success || !status.success) redirect("/dashboard");

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase
    .from("campaigns")
    .update({ status: status.data })
    .eq("id", campaignId.data)
    .in("status", ["published", "paused"]);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  revalidatePath("/embed", "layout");
  if (error) {
    redirect(`/dashboard/campaigns/${campaignId.data}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/dashboard/campaigns/${campaignId.data}?status=${status.data}`);
}

export async function deleteDraftCampaign(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  if (!campaignId.success) redirect("/dashboard");

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId.data)
    .eq("status", "draft");

  if (error) {
    redirect(`/dashboard/campaigns/${campaignId.data}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}

const periodIdSchema = z.string().uuid("This voting period could not be found.");
const snapshotIdSchema = z.string().uuid("This allocation could not be found.");
const donationRecordIdSchema = z.string().uuid("This donation record could not be found.");

function campaignRedirect(campaignId: string, key: string, value: string) {
  return `/dashboard/campaigns/${campaignId}?${key}=${encodeURIComponent(value)}`;
}

export async function finalizeCampaignPeriodNow(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const periodId = periodIdSchema.safeParse(formData.get("period_id"));
  if (!campaignId.success || !periodId.success) redirect("/dashboard");

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("finalize_campaign_period_now", {
    p_period_id: periodId.data,
  });

  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  revalidatePath("/embed", "layout");
  if (error) {
    redirect(campaignRedirect(campaignId.data, "error", error.message));
  }
  redirect(campaignRedirect(campaignId.data, "finalized", "1"));
}

export async function resolveZeroVoteAllocation(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const snapshotId = snapshotIdSchema.safeParse(formData.get("snapshot_id"));
  const resolution = z
    .enum(["equal_split", "canceled"])
    .safeParse(formData.get("resolution"));
  if (!campaignId.success || !snapshotId.success || !resolution.success) {
    redirect("/dashboard");
  }

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("resolve_zero_vote_allocation", {
    p_snapshot_id: snapshotId.data,
    p_resolution: resolution.data,
  });

  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  revalidatePath("/embed", "layout");
  if (error) {
    redirect(campaignRedirect(campaignId.data, "error", error.message));
  }
  redirect(campaignRedirect(campaignId.data, "reviewed", resolution.data));
}

export async function recordDonationStatus(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const donationRecordId = donationRecordIdSchema.safeParse(
    formData.get("donation_record_id"),
  );
  const status = z
    .enum([
      "approved_for_payment",
      "payment_pending",
      "confirmed_paid",
      "payment_failed",
      "canceled",
      "requires_reconciliation",
    ])
    .safeParse(formData.get("status"));
  const note = z.string().trim().max(1000).safeParse(formData.get("note") ?? "");
  const evidence = z
    .string()
    .trim()
    .max(500)
    .safeParse(formData.get("evidence_reference") ?? "");

  if (
    !campaignId.success ||
    !donationRecordId.success ||
    !status.success ||
    !note.success ||
    !evidence.success
  ) {
    redirect("/dashboard");
  }

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("record_donation_status", {
    p_donation_record_id: donationRecordId.data,
    p_status: status.data,
    p_note: note.data || undefined,
    p_evidence_reference: evidence.data || undefined,
  });

  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  revalidatePath("/embed", "layout");
  if (error) {
    redirect(campaignRedirect(campaignId.data, "error", error.message));
  }
  redirect(campaignRedirect(campaignId.data, "donation_status", status.data));
}

const paypalSandboxPayoutSchema = z.object({
  campaignId: z.string().uuid(),
  donationRecordId: z.string().uuid(),
  recipientEmail: z.string().trim().email().max(254),
});

type ReservedSandboxPayout = {
  dispatch_allowed: boolean;
  transaction_id: string;
  sender_batch_id: string;
  sender_item_id: string;
  amount_minor: number;
  currency: string;
};

function parseReservedSandboxPayout(value: unknown): ReservedSandboxPayout | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.dispatch_allowed !== "boolean" ||
    typeof candidate.transaction_id !== "string" ||
    typeof candidate.sender_batch_id !== "string" ||
    typeof candidate.sender_item_id !== "string" ||
    typeof candidate.amount_minor !== "number" ||
    typeof candidate.currency !== "string"
  ) {
    return null;
  }
  return candidate as ReservedSandboxPayout;
}

export async function sendPayPalSandboxPayout(formData: FormData) {
  const parsed = paypalSandboxPayoutSchema.safeParse({
    campaignId: formData.get("campaign_id"),
    donationRecordId: formData.get("donation_record_id"),
    recipientEmail: formData.get("recipient_email"),
  });

  if (!parsed.success) redirect("/dashboard");
  if (!getPayPalSandboxConfiguration().ready) {
    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "error",
        "PayPal Sandbox is not fully configured on the server.",
      ),
    );
  }

  const { supabase } = await getAuthenticatedUserId();
  const { data: reservationData, error: reservationError } = await supabase.rpc(
    "reserve_paypal_sandbox_payout",
    {
      p_donation_record_id: parsed.data.donationRecordId,
      p_recipient_reference_masked: maskSandboxRecipient(parsed.data.recipientEmail),
    },
  );

  const reservation = parseReservedSandboxPayout(reservationData);
  if (reservationError || !reservation) {
    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "error",
        reservationError?.message ?? "The sandbox payout could not be reserved.",
      ),
    );
  }

  if (!reservation.dispatch_allowed) {
    redirect(campaignRedirect(parsed.data.campaignId, "paypal", "already_reserved"));
  }

  const privileged = createPrivilegedClient();

  let payout;
  try {
    payout = await createSandboxPayout({
      recipient: parsed.data.recipientEmail,
      amountMinor: reservation.amount_minor,
      currency: reservation.currency,
      senderBatchId: reservation.sender_batch_id,
      senderItemId: reservation.sender_item_id,
    });
  } catch (error) {
    if (error instanceof PayPalSandboxError) {
      const { error: recordError } = await privileged.rpc(
        "record_paypal_sandbox_request_result",
        {
          p_payment_transaction_id: reservation.transaction_id,
          p_outcome: error.outcome,
          p_error_code: error.code,
        },
      );

      revalidatePath(`/dashboard/campaigns/${parsed.data.campaignId}`);
      if (recordError) {
        redirect(
          campaignRedirect(
            parsed.data.campaignId,
            "error",
            "The PayPal request failed and its result could not be recorded.",
          ),
        );
      }
      redirect(campaignRedirect(parsed.data.campaignId, "paypal", error.outcome));
    }

    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "error",
        "PayPal Sandbox may have accepted the request, but local recording is incomplete. Wait for the verified webhook before retrying.",
      ),
    );
  }

  const { error: resultError } = await privileged.rpc(
    "record_paypal_sandbox_request_result",
    {
      p_payment_transaction_id: reservation.transaction_id,
      p_outcome: "accepted",
      p_provider_batch_id: payout.payoutBatchId,
      p_provider_status: payout.batchStatus,
      p_request_payload_hash: payout.requestPayloadHash,
    },
  );

  if (resultError) {
    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "error",
        "PayPal Sandbox accepted the request, but local recording is incomplete. Wait for the verified webhook before retrying.",
      ),
    );
  }

  revalidatePath(`/dashboard/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/embed", "layout");
  redirect(campaignRedirect(parsed.data.campaignId, "paypal", "submitted"));
}
