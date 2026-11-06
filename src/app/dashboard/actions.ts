"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buildImpactReportSources,
  digestImpactReportSources,
  IMPACT_REPORT_PROMPT_VERSION,
  IMPACT_REPORT_SCHEMA_VERSION,
} from "@/lib/ai/impact-report";
import {
  generateImpactReportDraft,
  ImpactReportGenerationError,
} from "@/lib/ai/openrouter";
import type { Json } from "@/lib/database.types";
import { moneyToMinorUnits } from "@/lib/money";
import {
  createPublishableKey,
  createSecretApiKey,
  deriveWebhookSecret,
  issueIdentityToken,
} from "@/lib/developer/credentials";
import { ingestDeveloperEvent } from "@/lib/developer/events";
import { deliverDeveloperWebhooks } from "@/lib/developer/webhooks";
import {
  getMikeShopPersona,
  MIKE_SHOP_PERSONA_COOKIE,
  type MikeShopPersonaId,
} from "@/lib/demo/mikes-vegan-shop";
import {
  isPayPalSandboxSettlementCurrency,
  maskSandboxRecipient,
} from "@/lib/paypal/core";
import {
  createSandboxPayout,
  getPayPalSandboxConfiguration,
  PayPalSandboxError,
} from "@/lib/paypal/sandbox";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";
import { recipientInvitationPath } from "@/lib/recipient-invitations";
import { slugify } from "@/lib/utils";

export type DashboardActionState = {
  error?: string;
  inviteUrl?: string;
  success?: string;
};

export type DeveloperActionState = DashboardActionState & {
  projectId?: string;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
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
const impactReportDraftIdSchema = z.string().uuid("This report draft could not be found.");

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

export async function generateImpactReport(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const snapshotId = snapshotIdSchema.safeParse(formData.get("snapshot_id"));
  if (!campaignId.success || !snapshotId.success) redirect("/dashboard");

  const { supabase } = await getAuthenticatedUserId();
  const [{ data: campaign }, { data: snapshot }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, company_id, title, summary, budget_minor, currency, allocation_model")
      .eq("id", campaignId.data)
      .maybeSingle(),
    supabase
      .from("allocation_snapshots")
      .select(
        "id, campaign_id, period_id, revision, state, total_valid_votes, budget_minor, allocated_minor, unallocated_minor, currency, allocation_model, created_at",
      )
      .eq("id", snapshotId.data)
      .eq("campaign_id", campaignId.data)
      .maybeSingle(),
  ]);

  if (!campaign || !snapshot || snapshot.state !== "allocated") {
    redirect(
      campaignRedirect(
        campaignId.data,
        "error",
        "Choose a frozen, allocated campaign period for this report.",
      ),
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("company_id", campaign.company_id)
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (!membership) {
    redirect(
      campaignRedirect(
        campaignId.data,
        "error",
        "Owner or admin access is required to generate an impact report.",
      ),
    );
  }

  const [periodResult, linesResult, organizationsResult, donationsResult] =
    await Promise.all([
      supabase
        .from("campaign_periods")
        .select("sequence_number, status, opens_at, closes_at, timezone")
        .eq("id", snapshot.period_id)
        .eq("campaign_id", campaign.id)
        .maybeSingle(),
      supabase
        .from("allocation_lines")
        .select("organization_id, vote_count, amount_minor")
        .eq("snapshot_id", snapshot.id)
        .eq("campaign_id", campaign.id),
      supabase.from("organizations").select("id, name"),
      supabase
        .from("donation_records")
        .select(
          "id, organization_id, amount_minor, currency, status, environment, updated_at",
        )
        .eq("allocation_snapshot_id", snapshot.id)
        .eq("campaign_id", campaign.id),
    ]);

  const period = periodResult.data;
  const lines = linesResult.data ?? [];
  const organizations = organizationsResult.data ?? [];
  const donations = donationsResult.data ?? [];

  if (!period || period.status !== "closed" || lines.length === 0) {
    redirect(
      campaignRedirect(
        campaignId.data,
        "error",
        "The frozen period evidence is incomplete, so no AI data was sent.",
      ),
    );
  }

  const donationIds = donations.map((donation) => donation.id);
  const paymentsResult = donationIds.length
    ? await supabase
        .from("payment_transactions")
        .select(
          "id, donation_record_id, amount_minor, currency, provider, flow, status, provider_status, environment, updated_at",
        )
        .in("donation_record_id", donationIds)
    : { data: [], error: null };

  const sources = buildImpactReportSources({
    campaign,
    period,
    snapshot,
    lines,
    organizations,
    donations,
    payments: paymentsResult.data ?? [],
  });

  let generation: Awaited<ReturnType<typeof generateImpactReportDraft>>;
  try {
    generation = await generateImpactReportDraft(sources);
  } catch (error) {
    const generationError =
      error instanceof ImpactReportGenerationError
        ? error
        : new ImpactReportGenerationError(
            "unexpected_error",
            "The impact-report draft could not be generated. Please try again.",
          );
    console.error("Impact-report generation stopped", { code: generationError.code });
    redirect(campaignRedirect(campaign.id, "error", generationError.message));
  }

  const { error: createError } = await supabase.rpc("create_impact_report_draft", {
    p_campaign_id: campaign.id,
    p_period_id: snapshot.period_id,
    p_allocation_snapshot_id: snapshot.id,
    p_provider: "openrouter",
    p_model: generation.model,
    p_schema_version: IMPACT_REPORT_SCHEMA_VERSION,
    p_prompt_version: IMPACT_REPORT_PROMPT_VERSION,
    p_source_digest: digestImpactReportSources(sources),
    p_source_catalog: sources as unknown as Json,
    p_content: generation.content as unknown as Json,
  });

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  if (createError) {
    redirect(campaignRedirect(campaign.id, "error", createError.message));
  }
  redirect(campaignRedirect(campaign.id, "impact_report", "generated"));
}

export async function reviewImpactReportDraft(formData: FormData) {
  const campaignId = campaignIdSchema.safeParse(formData.get("campaign_id"));
  const draftId = impactReportDraftIdSchema.safeParse(formData.get("draft_id"));
  const status = z.enum(["draft", "approved"]).safeParse(formData.get("status"));
  if (!campaignId.success || !draftId.success || !status.success) {
    redirect("/dashboard");
  }

  const { supabase } = await getAuthenticatedUserId();
  const { error } = await supabase.rpc("review_impact_report_draft", {
    p_draft_id: draftId.data,
    p_status: status.data,
  });

  revalidatePath(`/dashboard/campaigns/${campaignId.data}`);
  if (error) {
    redirect(campaignRedirect(campaignId.data, "error", error.message));
  }
  redirect(campaignRedirect(campaignId.data, "impact_report", status.data));
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
  const { data: donationRecord, error: donationRecordError } = await supabase
    .from("donation_records")
    .select("id, campaign_id, currency")
    .eq("id", parsed.data.donationRecordId)
    .eq("campaign_id", parsed.data.campaignId)
    .maybeSingle();

  if (donationRecordError || !donationRecord) {
    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "error",
        "The donation record could not be verified for this campaign.",
      ),
    );
  }

  if (!isPayPalSandboxSettlementCurrency(donationRecord.currency)) {
    redirect(
      campaignRedirect(
        parsed.data.campaignId,
        "paypal",
        "unsupported_currency",
      ),
    );
  }

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
      console.error("PayPal Sandbox payout request failed", {
        outcome: error.outcome,
        code: error.code,
        debugId: error.debugId,
        details: error.details,
      });

      const result = await privileged.rpc(
        "record_paypal_sandbox_request_result_v2",
        {
          p_payment_transaction_id: reservation.transaction_id,
          p_outcome: error.outcome,
          p_error_code: error.code,
          p_error_details: error.details,
          ...(error.debugId
            ? { p_provider_debug_id: error.debugId }
            : {}),
        },
      );
      let recordError = result.error;

      if (recordError) {
        console.warn(
          "PayPal diagnostic storage is unavailable; recording the core result with the compatibility function.",
          { code: recordError.code },
        );
        const fallbackErrorCode = error.debugId
          ? `${error.code}:paypal_ref_${error.debugId}`.slice(0, 80)
          : error.code;
        const fallbackResult = await privileged.rpc(
          "record_paypal_sandbox_request_result",
          {
            p_payment_transaction_id: reservation.transaction_id,
            p_outcome: error.outcome,
            p_error_code: fallbackErrorCode,
          },
        );
        recordError = fallbackResult.error;
      }

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

  const result = await privileged.rpc(
    "record_paypal_sandbox_request_result_v2",
    {
      p_payment_transaction_id: reservation.transaction_id,
      p_outcome: "accepted",
      p_provider_batch_id: payout.payoutBatchId,
      p_provider_status: payout.batchStatus,
      p_request_payload_hash: payout.requestPayloadHash,
    },
  );
  let resultError = result.error;

  if (resultError) {
    console.warn(
      "PayPal diagnostic storage is unavailable; recording the accepted result with the compatibility function.",
      { code: resultError.code },
    );
    const fallbackResult = await privileged.rpc(
      "record_paypal_sandbox_request_result",
      {
        p_payment_transaction_id: reservation.transaction_id,
        p_outcome: "accepted",
        p_provider_batch_id: payout.payoutBatchId,
        p_provider_status: payout.batchStatus,
        p_request_payload_hash: payout.requestPayloadHash,
      },
    );
    resultError = fallbackResult.error;
  }

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

const recipientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(12).max(280),
  category: z.string().trim().min(2).max(80),
  countryCode: z.string().trim().length(2),
  websiteUrl: z.union([z.literal(""), z.url().max(500)]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

async function getAdminWorkspace() {
  const { supabase, userId } = await getAuthenticatedUserId();
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  return { supabase, userId, membership };
}

export async function createWorkspaceRecipient(
  _state: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = recipientSchema.safeParse({
    name: formData.get("name"),
    shortDescription: formData.get("short_description"),
    category: formData.get("category"),
    countryCode: formData.get("country_code"),
    websiteUrl: formData.get("website_url"),
    brandColor: formData.get("brand_color"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { supabase, membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const { error } = await supabase.rpc("create_workspace_recipient", {
    p_company_id: membership.company_id,
    p_name: parsed.data.name,
    p_short_description: parsed.data.shortDescription,
    p_category: parsed.data.category,
    p_country_code: parsed.data.countryCode,
    p_website_url: parsed.data.websiteUrl,
    p_brand_color: parsed.data.brandColor,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/organizations");
  revalidatePath("/dashboard/campaigns/new");
  return {};
}

const recipientInvitationSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  contactEmail: z.email().max(320),
});

export async function createRecipientInvitation(
  _state: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  const parsed = recipientInvitationSchema.safeParse({
    organizationId: formData.get("organization_id"),
    contactEmail: formData.get("contact_email"),
  });
  if (!parsed.success) {
    return { error: "Enter the recipient representative’s email address." };
  }

  const { userId, membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const privileged = createPrivilegedClient();
  const { data: relationship } = await privileged
    .from("workspace_recipients")
    .select("organization_id")
    .eq("company_id", membership.company_id)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();
  if (!relationship) return { error: "This recipient is not part of the workspace." };

  const { data: current, error: currentError } = await privileged
    .from("recipient_invitations")
    .select("id, expires_at")
    .eq("company_id", membership.company_id)
    .eq("organization_id", parsed.data.organizationId)
    .eq("status", "pending")
    .maybeSingle();
  if (currentError) {
    return { error: "Apply the Community Program migration before creating invitations." };
  }

  let invitationId = current?.id ?? null;
  if (current && new Date(current.expires_at).getTime() <= Date.now()) {
    await privileged
      .from("recipient_invitations")
      .update({ status: "revoked" })
      .eq("id", current.id);
    invitationId = null;
  }

  if (invitationId) {
    const { error } = await privileged
      .from("recipient_invitations")
      .update({
        contact_email: parsed.data.contactEmail,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", invitationId);
    if (error) return { error: error.message };
  } else {
    const { data: invitation, error } = await privileged
      .from("recipient_invitations")
      .insert({
        company_id: membership.company_id,
        organization_id: parsed.data.organizationId,
        contact_email: parsed.data.contactEmail,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error || !invitation) {
      return { error: error?.message ?? "The recipient invitation could not be created." };
    }
    invitationId = invitation.id;
  }

  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://our-impact.vercel.app").replace(/\/$/, "");
  revalidatePath("/dashboard/organizations");
  return {
    inviteUrl: `${siteOrigin}${recipientInvitationPath(invitationId)}`,
    success: "Invitation ready. Share this private link with the recipient representative.",
  };
}

const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  allowedOrigins: z.string().trim().max(2000),
});

function parseOrigins(value: string) {
  return [...new Set(value.split(/[\n,]/).map((origin) => origin.trim()).filter(Boolean))];
}

export async function createDeveloperProject(
  _state: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    allowedOrigins: formData.get("allowed_origins") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const origins = parseOrigins(parsed.data.allowedOrigins);
  if (!origins.length && process.env.NEXT_PUBLIC_SITE_URL) {
    origins.push(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  }
  if (origins.length > 20 || origins.some((origin) => {
    try { return new URL(origin).origin !== origin; } catch { return true; }
  })) {
    return { error: "Use up to 20 complete origins, such as https://shop.example.com." };
  }

  const { userId, membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const privileged = createPrivilegedClient();
  const publishableKey = createPublishableKey();
  const secret = createSecretApiKey();
  const { data: project, error: projectError } = await privileged
    .from("developer_projects")
    .insert({
      company_id: membership.company_id,
      name: parsed.data.name,
      publishable_key: publishableKey,
      allowed_origins: origins,
      created_by: userId,
    })
    .select("id")
    .single();
  if (projectError || !project) return { error: projectError?.message ?? "Project creation failed." };
  const { error: keyError } = await privileged.from("developer_api_keys").insert({
    project_id: project.id,
    company_id: membership.company_id,
    name: "Default server key",
    key_prefix: secret.prefix,
    key_hash: secret.hash,
    last_four: secret.lastFour,
    created_by: userId,
  });
  if (keyError) {
    await privileged.from("developer_projects").delete().eq("id", project.id);
    return { error: keyError.message };
  }
  revalidatePath("/dashboard/developers");
  revalidatePath(`/dashboard/developers/${project.id}`);
  return {
    projectId: project.id,
    publishableKey,
    secretKey: secret.value,
    success: "Project created. Copy the server key now; only its hash is stored.",
  };
}

export async function rotateDeveloperSecret(
  _state: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const projectId = z.string().uuid().safeParse(formData.get("project_id"));
  if (!projectId.success) return { error: "Project not found." };
  const { userId, membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("id, company_id, publishable_key")
    .eq("id", projectId.data)
    .eq("company_id", membership.company_id)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  const secret = createSecretApiKey();
  const { error } = await privileged.from("developer_api_keys").insert({
    project_id: project.id,
    company_id: project.company_id,
    name: `Rotated ${new Date().toISOString().slice(0, 10)}`,
    key_prefix: secret.prefix,
    key_hash: secret.hash,
    last_four: secret.lastFour,
    created_by: userId,
  });
  if (error) return { error: error.message };
  await privileged
    .from("developer_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("project_id", project.id)
    .neq("key_hash", secret.hash)
    .is("revoked_at", null);
  revalidatePath("/dashboard/developers");
  revalidatePath(`/dashboard/developers/${project.id}`);
  return {
    projectId: project.id,
    publishableKey: project.publishable_key,
    secretKey: secret.value,
    success: "The old server key is revoked. Copy the replacement now.",
  };
}

export async function updateDeveloperAllowedOrigins(
  _state: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    allowedOrigins: z.string().trim().max(2000),
  }).safeParse({
    projectId: formData.get("project_id"),
    allowedOrigins: formData.get("allowed_origins") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const origins = parseOrigins(parsed.data.allowedOrigins);
  if (origins.length > 20 || origins.some((origin) => {
    try { return new URL(origin).origin !== origin; } catch { return true; }
  })) {
    return { error: "Use up to 20 complete origins, such as http://localhost:4173 or https://shop.example.com." };
  }

  const { membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const privileged = createPrivilegedClient();
  const { data: project, error } = await privileged
    .from("developer_projects")
    .update({ allowed_origins: origins })
    .eq("id", parsed.data.projectId)
    .eq("company_id", membership.company_id)
    .select("id")
    .maybeSingle();
  if (error || !project) return { error: error?.message ?? "Project not found." };

  revalidatePath(`/dashboard/developers/${project.id}`);
  return { projectId: project.id, success: "Allowed browser origins updated." };
}

export async function createWebhookEndpoint(
  _state: DeveloperActionState,
  formData: FormData,
): Promise<DeveloperActionState> {
  const parsed = z.object({
    projectId: z.string().uuid(),
    url: z.url().startsWith("https://").max(1000),
    description: z.string().trim().max(200),
  }).safeParse({
    projectId: formData.get("project_id"),
    url: formData.get("url"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { userId, membership } = await getAdminWorkspace();
  if (!membership) return { error: "Owner or admin access is required." };
  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("id, company_id")
    .eq("id", parsed.data.projectId)
    .eq("company_id", membership.company_id)
    .maybeSingle();
  if (!project) return { error: "Project not found." };
  const { data: endpoint, error } = await privileged
    .from("webhook_endpoints")
    .insert({
      project_id: project.id,
      company_id: project.company_id,
      url: parsed.data.url,
      description: parsed.data.description || undefined,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !endpoint) return { error: error?.message ?? "Webhook creation failed." };
  revalidatePath("/dashboard/developers");
  revalidatePath(`/dashboard/developers/${project.id}`);
  return {
    projectId: project.id,
    webhookSecret: deriveWebhookSecret(endpoint.id),
    success: "Webhook saved. Copy the signing secret now.",
  };
}

const mikeShopPersonaSchema = z.enum(["jamie", "alex", "riley"]);

export async function selectMikeShopPersona(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    personaId: mikeShopPersonaSchema,
  }).safeParse({
    projectId: formData.get("project_id"),
    personaId: formData.get("persona_id"),
  });
  if (!parsed.success) redirect("/dashboard/developers");
  const { membership } = await getAdminWorkspace();
  if (!membership) redirect("/dashboard");
  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("id")
    .eq("id", parsed.data.projectId)
    .eq("company_id", membership.company_id)
    .maybeSingle();
  if (!project) redirect("/dashboard/developers");

  const cookieStore = await cookies();
  cookieStore.set(MIKE_SHOP_PERSONA_COOKIE, parsed.data.personaId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 400,
    path: `/demo/local-shop/${project.id}`,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(`/demo/local-shop/${project.id}`);
}

export async function runLocalShopDonation(formData: FormData) {
  const parsed = z.object({
    projectId: z.string().uuid(),
    personaId: mikeShopPersonaSchema,
    organizationId: z.coerce.number().int().positive(),
  }).safeParse({
    projectId: formData.get("project_id"),
    personaId: formData.get("persona_id"),
    organizationId: formData.get("organization_id"),
  });
  if (!parsed.success) redirect("/dashboard/developers");
  const { membership } = await getAdminWorkspace();
  if (!membership) redirect("/dashboard");
  const privileged = createPrivilegedClient();
  const [{ data: project }, { data: relationship }, { data: organization }] = await Promise.all([
    privileged
      .from("developer_projects")
      .select("*")
      .eq("id", parsed.data.projectId)
      .eq("company_id", membership.company_id)
      .maybeSingle(),
    privileged
      .from("workspace_recipients")
      .select("organization_id")
      .eq("company_id", membership.company_id)
      .eq("organization_id", parsed.data.organizationId)
      .neq("relationship_state", "blocked")
      .maybeSingle(),
    privileged
      .from("organizations")
      .select("name")
      .eq("id", parsed.data.organizationId)
      .maybeSingle(),
  ]);
  if (!project) redirect("/dashboard/developers");
  if (!relationship || !organization) {
    redirect(`/demo/local-shop/${project.id}?error=recipient`);
  }
  const persona = getMikeShopPersona(parsed.data.personaId);
  const eventId = `demo_${randomUUID()}`;
  await ingestDeveloperEvent({
    project,
    externalUserId: persona.externalUserId,
    displayName: `${persona.name} · Mike’s Vegan Shop shopper`,
    externalEventId: eventId,
    eventType: "donation.completed",
    occurredAt: new Date().toISOString(),
    source: "demo",
    properties: {
      amount: "5.00",
      amount_minor: 500,
      currency: "USD",
      recipient: organization.name,
      organization_id: parsed.data.organizationId,
    },
  });
  await deliverDeveloperWebhooks({ projectId: project.id, limit: 10 }).catch(() => undefined);
  revalidatePath(`/demo/local-shop/${project.id}`);
  revalidatePath("/dashboard/developers");
  redirect(`/demo/local-shop/${project.id}?donated=1`);
}

export async function createLocalShopIdentityToken(
  projectId: string,
  personaId: MikeShopPersonaId,
) {
  const { membership } = await getAdminWorkspace();
  if (!membership) throw new Error("Unauthorized");
  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("*")
    .eq("id", projectId)
    .eq("company_id", membership.company_id)
    .single();
  if (!project) throw new Error("Developer project not found.");
  const persona = getMikeShopPersona(personaId);
  const { data: supporter } = await privileged
    .from("supporters")
    .upsert({
      project_id: project.id,
      company_id: project.company_id,
      external_user_id: persona.externalUserId,
      display_name: `${persona.name} · Mike’s Vegan Shop shopper`,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "project_id,external_user_id" })
    .select("id, external_user_id")
    .single();
  if (!supporter) throw new Error("Demo supporter could not be created.");
  return issueIdentityToken({
    projectId: project.id,
    companyId: project.company_id,
    supporterId: supporter.id,
    externalUserId: supporter.external_user_id,
  }).token;
}
