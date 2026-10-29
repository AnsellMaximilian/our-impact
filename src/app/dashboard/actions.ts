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
  const parsed = campaignSchema.safeParse({
    title: formData.get("title"),
    summary: formData.get("summary"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    periodCadence: formData.get("period_cadence"),
    allocationModel: formData.get("allocation_model"),
    organizationIds: formData.getAll("organization_ids"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the campaign details." };
  }

  let budgetMinor: number;
  try {
    budgetMinor = moneyToMinorUnits(parsed.data.amount, parsed.data.currency);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Enter a valid budget.",
    };
  }

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
    p_budget_minor: budgetMinor,
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
