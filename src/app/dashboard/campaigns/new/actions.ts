"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  campaignProposalSchema,
  type CampaignAssistantResponse,
} from "@/lib/ai/campaign-assistant";
import {
  CampaignAssistantError,
  generateCampaignDraft,
} from "@/lib/ai/openrouter";
import { createClient } from "@/lib/supabase/server";

export type CampaignAssistantState = {
  error?: string;
  responseId?: string;
  response?: CampaignAssistantResponse;
};

export type CampaignAssistantApplyState = {
  error?: string;
  success?: string;
  campaignId?: string;
};

const historySchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
})).max(8);

async function getCampaignWorkspace() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  if (!membership) return null;

  const [{ data: company }, { data: relationships }] = await Promise.all([
    supabase
      .from("companies")
      .select("name, public_name")
      .eq("id", membership.company_id)
      .maybeSingle(),
    supabase
      .from("workspace_recipients")
      .select("organization_id")
      .eq("company_id", membership.company_id)
      .eq("relationship_state", "active"),
  ]);
  const organizationIds = (relationships ?? []).map((relationship) => relationship.organization_id);
  const { data: organizations } = organizationIds.length
    ? await supabase
      .from("organizations")
      .select("id, name, category, short_description, country_code")
      .in("id", organizationIds)
      .eq("is_active", true)
      .order("name")
    : { data: [] };

  return {
    supabase,
    membership,
    workspaceName: company?.public_name ?? company?.name ?? "Your workspace",
    organizations: organizations ?? [],
  };
}

function recoveryResponse(error: unknown): CampaignAssistantResponse {
  const code = error instanceof CampaignAssistantError ? error.code : "unknown";
  let message: string;

  if (code === "not_configured") {
    message = "I can’t reach the campaign-planning model yet. Ask an owner to configure OpenRouter and redeploy; the manual builder is still available from New campaign.";
  } else if (code === "timeout" || code === "network_error") {
    message = "I couldn’t reach the campaign-planning model reliably, so I didn’t prepare a draft. Please resend your idea; no campaign was created.";
  } else if (code === "provider_402") {
    message = "OpenRouter declined the request because the account needs available credit. Add credit and resend your idea; no campaign was created.";
  } else if (code.startsWith("provider_")) {
    message = "The configured OpenRouter model couldn’t return a safe structured campaign. Try a model that supports structured outputs, then resend your idea.";
  } else if (code === "failed_validation" || code === "invalid_provider_response") {
    message = "I couldn’t safely turn that answer into a campaign draft. Please include the cause, rough commitment per round, preferred cadence, and any recipient preferences.";
  } else {
    message = "I couldn’t prepare a safe campaign draft and left everything unchanged. Please restate the occasion, causes, budget, and timing you have in mind.";
  }

  return {
    kind: "clarification",
    message,
    referenced_organization_ids: [],
    proposal: null,
  };
}

export async function askCampaignAssistant(
  _state: CampaignAssistantState,
  formData: FormData,
): Promise<CampaignAssistantState> {
  const parsed = z.object({
    message: z.string().trim().min(2).max(2000),
    history: z.string().max(24000),
  }).safeParse({
    message: formData.get("message"),
    history: formData.get("history") ?? "[]",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Describe the campaign you have in mind." };
  }

  let historyInput: unknown;
  try {
    historyInput = JSON.parse(parsed.data.history || "[]");
  } catch {
    return { error: "The campaign-planning conversation could not be read." };
  }
  const history = historySchema.safeParse(historyInput);
  if (!history.success) {
    return { error: "The campaign-planning conversation could not be read." };
  }

  const workspace = await getCampaignWorkspace();
  if (!workspace) return { error: "Owner or admin access is required." };
  if (workspace.organizations.length < 2) {
    return {
      responseId: randomUUID(),
      response: {
        kind: "clarification",
        message: "Connect at least two active recipient partners before planning a voting campaign. Once they are ready, I can compare their missions with your campaign idea.",
        referenced_organization_ids: [],
        proposal: null,
      },
    };
  }

  let generation: Awaited<ReturnType<typeof generateCampaignDraft>>;
  try {
    generation = await generateCampaignDraft({
      workspaceName: workspace.workspaceName,
      organizations: workspace.organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        category: organization.category,
        shortDescription: organization.short_description,
        countryCode: organization.country_code,
      })),
      history: history.data,
      request: parsed.data.message,
    });
  } catch (error) {
    return { responseId: randomUUID(), response: recoveryResponse(error) };
  }

  const knownIds = new Set(workspace.organizations.map((organization) => organization.id));
  const referencedIds = generation.response.referenced_organization_ids;
  const proposedIds = generation.response.proposal?.organization_ids ?? [];
  if ([...referencedIds, ...proposedIds].some((id) => !knownIds.has(id))) {
    return {
      responseId: randomUUID(),
      response: {
        kind: "clarification",
        message: "The recipient network changed while I was planning, so I left everything unchanged. Refresh this page and resend your idea so I can use the current partners.",
        referenced_organization_ids: [],
        proposal: null,
      },
    };
  }

  return { responseId: randomUUID(), response: generation.response };
}

export async function applyCampaignAssistantProposal(
  _state: CampaignAssistantApplyState,
  formData: FormData,
): Promise<CampaignAssistantApplyState> {
  const rawProposal = z.string().min(2).max(20000).safeParse(formData.get("proposal"));
  if (!rawProposal.success) return { error: "That campaign suggestion could not be read." };

  let proposalInput: unknown;
  try {
    proposalInput = JSON.parse(rawProposal.data);
  } catch {
    return { error: "That campaign suggestion could not be read." };
  }
  const proposal = campaignProposalSchema.safeParse(proposalInput);
  if (!proposal.success) return { error: "That campaign suggestion no longer passes validation." };

  const workspace = await getCampaignWorkspace();
  if (!workspace) return { error: "Owner or admin access is required." };
  const activeIds = new Set(workspace.organizations.map((organization) => organization.id));
  if (proposal.data.organization_ids.some((id) => !activeIds.has(id))) {
    return { error: "One or more suggested recipients are no longer active. Ask for a new suggestion." };
  }

  const { data: campaign, error } = await workspace.supabase.rpc("create_draft_campaign", {
    p_company_id: workspace.membership.company_id,
    p_title: proposal.data.title,
    p_summary: proposal.data.summary,
    p_budget_minor: proposal.data.budget_minor,
    p_currency: proposal.data.currency,
    p_timezone: proposal.data.timezone,
    p_period_cadence: proposal.data.period_cadence,
    p_allocation_model: proposal.data.allocation_model,
    p_close_local_time: proposal.data.close_local_time,
    p_close_weekday: proposal.data.close_weekday,
    p_organization_ids: proposal.data.organization_ids,
  });
  if (error || !campaign) {
    return { error: error?.message ?? "The private campaign draft could not be created." };
  }

  revalidatePath("/dashboard");
  return {
    success: `${campaign.title} was added to your campaigns as a private draft.`,
    campaignId: campaign.id,
  };
}
