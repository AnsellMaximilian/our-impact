"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { moneyToMinorUnits } from "@/lib/money";
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
