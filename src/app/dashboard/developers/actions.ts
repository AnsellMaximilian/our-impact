"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  entitlementRuleProposalSchema,
  type EntitlementAssistantResponse,
} from "@/lib/ai/entitlement-assistant";
import {
  EntitlementAssistantError,
  generateEntitlementRuleDraft,
  getOpenRouterConfiguration,
} from "@/lib/ai/openrouter";
import type { Json, TableRow } from "@/lib/database.types";
import { ingestDeveloperEvent, listSupporterEntitlements } from "@/lib/developer/events";
import { deliverDeveloperWebhooks } from "@/lib/developer/webhooks";
import { moneyToMinorUnits } from "@/lib/money";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export type EntitlementStudioState = {
  error?: string;
  success?: string;
};

export type AssistantState = EntitlementStudioState & {
  responseId?: string;
  runId?: string;
  response?: EntitlementAssistantResponse;
};

export type TestEventState = EntitlementStudioState & {
  entitlements?: Array<{
    entitlement_key: string;
    state: string;
    qualifying_count: number;
    progress_value: number;
    progress_unit: string;
  }>;
};

const projectIdSchema = z.uuid();
const entitlementKeySchema = z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/);
const metricSchema = z.enum(["event_count", "single_amount", "period_amount"]);
const windowSchema = z.enum(["single_event", "lifetime", "calendar_month"]);

async function getAuthorizedProject(projectId: string) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", project.company_id)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  if (!membership) return null;

  return { project, privileged, userId };
}

function parseRuleInput(formData: FormData) {
  const parsed = z.object({
    ruleName: z.string().trim().min(2).max(120),
    metric: metricSchema,
    evaluationWindow: windowSchema,
    threshold: z.coerce.number().int().positive().max(100000),
    amount: z.string().trim().max(24),
  }).safeParse({
    ruleName: formData.get("rule_name"),
    metric: formData.get("metric"),
    evaluationWindow: formData.get("evaluation_window"),
    threshold: formData.get("threshold") || 1,
    amount: formData.get("amount") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the rule." } as const;

  const { metric, evaluationWindow } = parsed.data;
  if (metric === "event_count" && evaluationWindow === "single_event") {
    return { error: "Donation counts need a monthly or lifetime window." } as const;
  }
  if (metric === "period_amount" && evaluationWindow === "single_event") {
    return { error: "A cumulative amount needs a monthly or lifetime window." } as const;
  }

  let amountThresholdMinor: number | null = null;
  if (metric !== "event_count") {
    try {
      amountThresholdMinor = moneyToMinorUnits(parsed.data.amount, "USD");
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Enter a valid USD amount." } as const;
    }
  }

  return {
    data: {
      ruleName: parsed.data.ruleName,
      metric,
      evaluationWindow,
      threshold: metric === "event_count" ? parsed.data.threshold : 1,
      amountThresholdMinor,
      currency: metric === "event_count" ? null : "USD",
    },
  } as const;
}

export async function createEntitlement(
  _state: EntitlementStudioState,
  formData: FormData,
): Promise<EntitlementStudioState> {
  const parsed = z.object({
    projectId: projectIdSchema,
    name: z.string().trim().min(2).max(120),
    entitlementKey: entitlementKeySchema,
    description: z.string().trim().max(280),
  }).safeParse({
    projectId: formData.get("project_id"),
    name: formData.get("name"),
    entitlementKey: formData.get("entitlement_key"),
    description: formData.get("description") ?? "",
  });
  const rule = parseRuleInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the entitlement." };
  if ("error" in rule) return { error: rule.error };

  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return { error: "Owner or admin access is required." };
  const { project, privileged } = authorization;
  const { data: definition, error: definitionError } = await privileged
    .from("entitlement_definitions")
    .insert({
      project_id: project.id,
      company_id: project.company_id,
      name: parsed.data.name,
      entitlement_key: parsed.data.entitlementKey,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (definitionError || !definition) {
    return { error: definitionError?.code === "23505" ? "That entitlement key is already in use." : definitionError?.message ?? "The entitlement could not be created." };
  }

  const { error: ruleError } = await privileged.from("entitlement_rules").insert({
    project_id: project.id,
    company_id: project.company_id,
    entitlement_id: definition.id,
    name: rule.data.ruleName,
    entitlement_key: parsed.data.entitlementKey,
    event_type: "donation.completed",
    metric: rule.data.metric,
    threshold: rule.data.threshold,
    amount_threshold_minor: rule.data.amountThresholdMinor,
    currency: rule.data.currency,
    evaluation_window: rule.data.evaluationWindow,
  });
  if (ruleError) {
    await privileged.from("entitlement_definitions").delete().eq("id", definition.id);
    return { error: ruleError.message };
  }

  revalidatePath(`/dashboard/developers/${project.id}`);
  return { success: `${parsed.data.name} is ready to test.` };
}

export async function addEntitlementRule(
  _state: EntitlementStudioState,
  formData: FormData,
): Promise<EntitlementStudioState> {
  const parsed = z.object({
    projectId: projectIdSchema,
    entitlementId: z.uuid(),
  }).safeParse({
    projectId: formData.get("project_id"),
    entitlementId: formData.get("entitlement_id"),
  });
  const rule = parseRuleInput(formData);
  if (!parsed.success) return { error: "Choose an entitlement." };
  if ("error" in rule) return { error: rule.error };

  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return { error: "Owner or admin access is required." };
  const { project, privileged } = authorization;
  const { data: definition } = await privileged
    .from("entitlement_definitions")
    .select("id, entitlement_key, name")
    .eq("id", parsed.data.entitlementId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!definition) return { error: "That entitlement no longer exists." };

  const { error } = await privileged.from("entitlement_rules").insert({
    project_id: project.id,
    company_id: project.company_id,
    entitlement_id: definition.id,
    name: rule.data.ruleName,
    entitlement_key: definition.entitlement_key,
    event_type: "donation.completed",
    metric: rule.data.metric,
    threshold: rule.data.threshold,
    amount_threshold_minor: rule.data.amountThresholdMinor,
    currency: rule.data.currency,
    evaluation_window: rule.data.evaluationWindow,
  });
  if (error) return { error: error.message };
  revalidatePath(`/dashboard/developers/${project.id}`);
  return { success: `A new earning path was added to ${definition.name}.` };
}

export async function setEntitlementState(formData: FormData) {
  const parsed = z.object({
    projectId: projectIdSchema,
    entitlementId: z.uuid(),
    state: z.enum(["active", "disabled"]),
  }).safeParse({
    projectId: formData.get("project_id"),
    entitlementId: formData.get("entitlement_id"),
    state: formData.get("state"),
  });
  if (!parsed.success) return;
  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return;
  const { project, privileged } = authorization;
  const { data: definition } = await privileged
    .from("entitlement_definitions")
    .update({ state: parsed.data.state })
    .eq("id", parsed.data.entitlementId)
    .eq("project_id", project.id)
    .select("id")
    .maybeSingle();
  if (definition && parsed.data.state === "disabled") {
    await privileged.from("user_entitlements").update({
      state: "inactive",
      revoked_at: new Date().toISOString(),
      valid_until: null,
    }).eq("entitlement_definition_id", definition.id).eq("project_id", project.id);
  }
  revalidatePath(`/dashboard/developers/${project.id}`);
}

const historySchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
})).max(8);

export async function askEntitlementAssistant(
  _state: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const parsed = z.object({
    projectId: projectIdSchema,
    message: z.string().trim().min(2).max(2000),
    history: z.string().max(24000),
  }).safeParse({
    projectId: formData.get("project_id"),
    message: formData.get("message"),
    history: formData.get("history") ?? "[]",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a request." };
  const requestMessage = parsed.data.message;
  let historyInput: unknown;
  try {
    historyInput = JSON.parse(parsed.data.history || "[]");
  } catch {
    return { error: "The assistant conversation could not be read." };
  }
  const history = historySchema.safeParse(historyInput);
  if (!history.success) return { error: "The assistant conversation could not be read." };

  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return { error: "Owner or admin access is required." };
  const { project, privileged, userId } = authorization;
  const [definitionsResult, rulesResult] = await Promise.all([
    privileged.from("entitlement_definitions").select("*").eq("project_id", project.id).order("created_at"),
    privileged.from("entitlement_rules").select("*").eq("project_id", project.id).order("created_at"),
  ]);
  if (definitionsResult.error || rulesResult.error) {
    return { error: "Apply the Entitlement Studio migration before using the assistant." };
  }
  const definitions = definitionsResult.data ?? [];
  const rules = rulesResult.data ?? [];

  async function persistAssistantResponse(
    response: EntitlementAssistantResponse,
    status: "clarification" | "proposed" | "failed",
    model: string,
  ): Promise<AssistantState> {
    const { data: run } = await privileged
      .from("entitlement_assistant_runs")
      .insert({
        project_id: project.id,
        company_id: project.company_id,
        requested_by: userId,
        prompt: requestMessage,
        response_message: response.message,
        proposal: response.proposal as unknown as Json | null,
        referenced_entitlement_ids: response.referenced_entitlement_ids,
        model,
        status,
      })
      .select("id")
      .maybeSingle();

    const responseId = run?.id ?? randomUUID();
    if (!run && response.kind === "proposal") {
      return {
        responseId,
        response: {
          kind: "clarification",
          message: "I prepared a rule, but I couldn’t save the review card safely, so I left your configuration unchanged. Refresh the project and resend the same request. If it happens again, check the Supabase connection before retrying.",
          referenced_entitlement_ids: response.referenced_entitlement_ids,
          proposal: null,
        },
      };
    }
    return { responseId, runId: run?.id, response };
  }

  function recoveryResponse(error: unknown): EntitlementAssistantResponse {
    const code = error instanceof EntitlementAssistantError ? error.code : "unknown";
    let message: string;

    if (code === "not_configured") {
      message = "I can’t reach the rule model yet. Ask an owner to add OPENROUTER_API_KEY and OPENROUTER_MODEL, redeploy, then resend this message.";
    } else if (code === "timeout" || code === "network_error") {
      message = "I couldn’t reach the rule model reliably, so I left your configuration unchanged. Please resend the request. If it fails again, shorten it to the entitlement name, trigger, threshold, and time window.";
    } else if (code === "provider_402") {
      message = "OpenRouter declined the request because the account needs available credit. Add credit, then resend this message; no entitlement was changed.";
    } else if (code.startsWith("provider_")) {
      message = "The configured OpenRouter model couldn’t return a safe structured rule. Try a model that supports structured outputs, then resend with: reuse or create, donation count or amount, threshold, and monthly or lifetime window.";
    } else if (code === "failed_validation" || code === "invalid_provider_response") {
      message = "I couldn’t safely convert that answer into a deterministic rule, so I did not change anything. Please reply with four details: reuse an existing entitlement or create one, donation count or amount, the threshold, and the time window. For example: ‘Reuse Generous Gary after one donation of at least $50, lifetime.’";
    } else {
      message = "I couldn’t prepare a safe rule and left your configuration unchanged. Please restate the entitlement name, whether to reuse or create it, the exact donation condition, and the monthly or lifetime window.";
    }

    return {
      kind: "clarification",
      message,
      referenced_entitlement_ids: [],
      proposal: null,
    };
  }

  let generation: Awaited<ReturnType<typeof generateEntitlementRuleDraft>>;
  try {
    generation = await generateEntitlementRuleDraft({
      projectName: project.name,
      entitlements: definitions.map((definition) => ({
        id: definition.id,
        name: definition.name,
        entitlementKey: definition.entitlement_key,
        description: definition.description,
        state: definition.state,
        rules: rules.filter((rule) => rule.entitlement_id === definition.id).map((rule) => ({
          name: rule.name,
          metric: rule.metric,
          threshold: rule.threshold,
          amountThresholdMinor: rule.amount_threshold_minor,
          currency: rule.currency,
          evaluationWindow: rule.evaluation_window,
          state: rule.state,
        })),
      })),
      history: history.data,
      request: parsed.data.message,
    });
  } catch (error) {
    const configuration = getOpenRouterConfiguration();
    return persistAssistantResponse(
      recoveryResponse(error),
      "failed",
      configuration.model ?? "unconfigured",
    );
  }

  const knownIds = new Set(definitions.map((definition) => definition.id));
  const response = generation.response;
  if (response.referenced_entitlement_ids.some((id) => !knownIds.has(id))) {
    return persistAssistantResponse({
      kind: "clarification",
      message: "The entitlement catalog changed while I was drafting, so I did not apply anything. Refresh the project and resend your request so I can compare it with the latest catalog.",
      referenced_entitlement_ids: [],
      proposal: null,
    }, "failed", generation.model);
  }
  if (
    response.proposal?.action === "use_existing" &&
    (!response.proposal.existing_entitlement_id || !knownIds.has(response.proposal.existing_entitlement_id))
  ) {
    return persistAssistantResponse({
      kind: "clarification",
      message: "The entitlement I tried to reuse no longer exists, so I left your rules unchanged. Refresh the project, name the entitlement you want to reuse or say ‘create new,’ and resend the condition.",
      referenced_entitlement_ids: [],
      proposal: null,
    }, "failed", generation.model);
  }

  return persistAssistantResponse(
    response,
    response.kind === "proposal" ? "proposed" : "clarification",
    generation.model,
  );
}

export async function applyAssistantProposal(
  _state: EntitlementStudioState,
  formData: FormData,
): Promise<EntitlementStudioState> {
  const parsed = z.object({ projectId: projectIdSchema, runId: z.uuid() }).safeParse({
    projectId: formData.get("project_id"),
    runId: formData.get("run_id"),
  });
  if (!parsed.success) return { error: "That assistant draft could not be found." };
  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return { error: "Owner or admin access is required." };
  const { project, privileged } = authorization;
  const { data: run } = await privileged
    .from("entitlement_assistant_runs")
    .select("id, proposal, status")
    .eq("id", parsed.data.runId)
    .eq("project_id", project.id)
    .eq("status", "proposed")
    .maybeSingle();
  if (!run) return { error: "This proposal was already applied or is no longer available." };
  const proposal = entitlementRuleProposalSchema.safeParse(run.proposal);
  if (!proposal.success) return { error: "The saved proposal no longer passes validation." };

  let definition: Pick<TableRow<"entitlement_definitions">, "id" | "name" | "entitlement_key"> | null = null;
  let createdDefinitionId: string | null = null;
  if (proposal.data.action === "use_existing") {
    const result = await privileged
      .from("entitlement_definitions")
      .select("id, name, entitlement_key")
      .eq("id", proposal.data.existing_entitlement_id!)
      .eq("project_id", project.id)
      .maybeSingle();
    definition = result.data;
  } else {
    const result = await privileged.from("entitlement_definitions").insert({
      project_id: project.id,
      company_id: project.company_id,
      name: proposal.data.entitlement_name,
      entitlement_key: proposal.data.entitlement_key,
      description: proposal.data.entitlement_description,
    }).select("id, name, entitlement_key").single();
    definition = result.data;
    createdDefinitionId = result.data?.id ?? null;
    if (result.error) return { error: result.error.code === "23505" ? "That entitlement key already exists." : result.error.message };
  }
  if (!definition) return { error: "The selected entitlement no longer exists." };

  const { error: ruleError } = await privileged.from("entitlement_rules").insert({
    project_id: project.id,
    company_id: project.company_id,
    entitlement_id: definition.id,
    name: proposal.data.rule_name,
    entitlement_key: definition.entitlement_key,
    event_type: proposal.data.event_type,
    metric: proposal.data.metric,
    threshold: proposal.data.threshold,
    amount_threshold_minor: proposal.data.amount_threshold_minor,
    currency: proposal.data.currency,
    evaluation_window: proposal.data.evaluation_window,
  });
  if (ruleError) {
    if (createdDefinitionId) {
      await privileged.from("entitlement_definitions").delete().eq("id", createdDefinitionId);
    }
    return { error: ruleError.message };
  }
  await privileged.from("entitlement_assistant_runs").update({
    status: "applied",
    applied_at: new Date().toISOString(),
  }).eq("id", run.id).eq("status", "proposed");
  revalidatePath(`/dashboard/developers/${project.id}`);
  return { success: `${definition.name} now has the proposed earning rule.` };
}

export async function sendTestDonation(
  _state: TestEventState,
  formData: FormData,
): Promise<TestEventState> {
  const parsed = z.object({
    projectId: projectIdSchema,
    externalUserId: z.string().trim().min(1).max(120),
    displayName: z.string().trim().min(1).max(120),
    amount: z.string().trim().min(1).max(24),
  }).safeParse({
    projectId: formData.get("project_id"),
    externalUserId: formData.get("external_user_id"),
    displayName: formData.get("display_name"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the test event." };
  let amountMinor: number;
  try {
    amountMinor = moneyToMinorUnits(parsed.data.amount, "USD");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid USD amount." };
  }
  const authorization = await getAuthorizedProject(parsed.data.projectId);
  if (!authorization) return { error: "Owner or admin access is required." };
  const { project } = authorization;
  try {
    const result = await ingestDeveloperEvent({
      project,
      externalUserId: parsed.data.externalUserId,
      displayName: parsed.data.displayName,
      externalEventId: `console_${randomUUID()}`,
      eventType: "donation.completed",
      occurredAt: new Date().toISOString(),
      source: "demo",
      properties: {
        amount: parsed.data.amount,
        amount_minor: amountMinor,
        currency: "USD",
        source: "entitlement_studio",
      },
    });
    const entitlements = await listSupporterEntitlements(project.id, result.supporter.id);
    await deliverDeveloperWebhooks({ projectId: project.id, limit: 10 }).catch(() => undefined);
    revalidatePath(`/dashboard/developers/${project.id}`);
    revalidatePath(`/demo/local-shop/${project.id}`);
    return {
      success: `Recorded a verified $${(amountMinor / 100).toFixed(2)} test donation.`,
      entitlements: entitlements.map((entitlement) => ({
        entitlement_key: entitlement.entitlement_key,
        state: entitlement.state,
        qualifying_count: entitlement.qualifying_count,
        progress_value: entitlement.progress_value,
        progress_unit: entitlement.progress_unit,
      })),
    };
  } catch (error) {
    console.error("Entitlement Studio test event failed", error);
    return { error: "The test event could not be recorded." };
  }
}
