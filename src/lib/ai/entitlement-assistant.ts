import { z } from "zod";

export const entitlementRuleMetricSchema = z.enum([
  "event_count",
  "single_amount",
  "period_amount",
]);

export const entitlementRuleWindowSchema = z.enum([
  "single_event",
  "lifetime",
  "calendar_month",
]);

export const entitlementRuleProposalSchema = z
  .object({
    action: z.enum(["use_existing", "create_new"]),
    existing_entitlement_id: z.uuid().nullable(),
    entitlement_name: z.string().trim().min(2).max(120),
    entitlement_key: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    entitlement_description: z.string().trim().max(280),
    rule_name: z.string().trim().min(2).max(120),
    event_type: z.literal("donation.completed"),
    metric: entitlementRuleMetricSchema,
    evaluation_window: entitlementRuleWindowSchema,
    threshold: z.number().int().positive(),
    amount_threshold_minor: z.number().int().positive().nullable(),
    currency: z.literal("USD").nullable(),
  })
  .superRefine((proposal, context) => {
    if (proposal.action === "use_existing" && !proposal.existing_entitlement_id) {
      context.addIssue({
        code: "custom",
        path: ["existing_entitlement_id"],
        message: "An existing entitlement is required.",
      });
    }
    if (proposal.action === "create_new" && proposal.existing_entitlement_id) {
      context.addIssue({
        code: "custom",
        path: ["existing_entitlement_id"],
        message: "A new entitlement cannot reference an existing entitlement.",
      });
    }
    if (proposal.metric === "event_count") {
      if (proposal.amount_threshold_minor !== null || proposal.currency !== null) {
        context.addIssue({ code: "custom", message: "Count rules cannot include money." });
      }
      if (proposal.evaluation_window === "single_event") {
        context.addIssue({ code: "custom", message: "Count rules need a time window." });
      }
    } else {
      if (proposal.amount_threshold_minor === null || proposal.currency !== "USD") {
        context.addIssue({ code: "custom", message: "Amount rules require a USD amount." });
      }
      if (proposal.threshold !== 1) {
        context.addIssue({
          code: "custom",
          path: ["threshold"],
          message: "Amount rules use the amount threshold and must keep the count threshold at one.",
        });
      }
      if (
        proposal.metric === "period_amount" &&
        proposal.evaluation_window === "single_event"
      ) {
        context.addIssue({
          code: "custom",
          message: "Cumulative amount rules need a lifetime or monthly window.",
        });
      }
    }
  });

export const entitlementAssistantResponseSchema = z.object({
  kind: z.enum(["clarification", "proposal"]),
  message: z.string().trim().min(2).max(4000),
  referenced_entitlement_ids: z.array(z.uuid()).max(8),
  proposal: entitlementRuleProposalSchema.nullable(),
}).superRefine((response, context) => {
  if (response.kind === "clarification" && response.proposal !== null) {
    context.addIssue({ code: "custom", message: "Clarifications cannot contain a proposal." });
  }
  if (response.kind === "proposal" && response.proposal === null) {
    context.addIssue({ code: "custom", message: "A proposal response needs a proposal." });
  }
});

export type EntitlementRuleProposal = z.infer<typeof entitlementRuleProposalSchema>;
export type EntitlementAssistantResponse = z.infer<typeof entitlementAssistantResponseSchema>;

export type EntitlementAssistantContext = {
  projectName: string;
  entitlements: Array<{
    id: string;
    name: string;
    entitlementKey: string;
    description: string;
    state: string;
    rules: Array<{
      name: string;
      metric: string;
      threshold: number;
      amountThresholdMinor: number | null;
      currency: string | null;
      evaluationWindow: string;
      state: string;
    }>;
  }>;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  request: string;
};

export const entitlementAssistantJsonSchema = {
  name: "entitlement_rule_authoring_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "message", "referenced_entitlement_ids", "proposal"],
    properties: {
      kind: { type: "string", enum: ["clarification", "proposal"] },
      message: { type: "string" },
      referenced_entitlement_ids: {
        type: "array",
        maxItems: 8,
        items: { type: "string" },
      },
      proposal: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: [
              "action",
              "existing_entitlement_id",
              "entitlement_name",
              "entitlement_key",
              "entitlement_description",
              "rule_name",
              "event_type",
              "metric",
              "evaluation_window",
              "threshold",
              "amount_threshold_minor",
              "currency",
            ],
            properties: {
              action: { type: "string", enum: ["use_existing", "create_new"] },
              existing_entitlement_id: {
                anyOf: [{ type: "null" }, { type: "string" }],
              },
              entitlement_name: { type: "string" },
              entitlement_key: { type: "string", pattern: "^[a-z][a-z0-9_]{1,79}$" },
              entitlement_description: { type: "string" },
              rule_name: { type: "string" },
              event_type: { type: "string", const: "donation.completed" },
              metric: {
                type: "string",
                enum: ["event_count", "single_amount", "period_amount"],
              },
              evaluation_window: {
                type: "string",
                enum: ["single_event", "lifetime", "calendar_month"],
              },
              threshold: { type: "integer", minimum: 1 },
              amount_threshold_minor: {
                anyOf: [{ type: "null" }, { type: "integer", minimum: 1 }],
              },
              currency: { anyOf: [{ type: "null" }, { type: "string", const: "USD" }] },
            },
          },
        ],
      },
    },
  },
} as const;

export function buildEntitlementAssistantPrompt(context: EntitlementAssistantContext) {
  const catalog = context.entitlements.map((entitlement) => ({
    id: entitlement.id,
    name: entitlement.name,
    key: entitlement.entitlementKey,
    description: entitlement.description,
    state: entitlement.state,
    rules: entitlement.rules,
  }));

  return JSON.stringify({
    product: "Our Impact",
    project: context.projectName,
    existing_entitlements: catalog,
    recent_conversation: context.history.slice(-8),
    latest_request: context.request,
    instructions: [
      "Help the program owner author deterministic donation entitlement rules.",
      "Always compare the requested name and meaning with existing entitlements before suggesting a new one.",
      "Reference every relevant existing entitlement by its exact UUID.",
      "If the request could mean one donation amount or a cumulative amount, ask a clarification and return no proposal.",
      "If time window, donation count, or amount semantics are missing and materially change behavior, ask one concise clarification.",
      "Use use_existing when the requested benefit is substantially the same as an existing entitlement; explain that match in message.",
      "Only propose donation.completed rules. USD is the only supported currency for amount rules.",
      "event_count counts donations; single_amount checks whether any one donation reaches the amount within the selected window; period_amount sums donations in the selected window.",
      "The proposal is a draft requiring human confirmation. Never claim that it has already been applied.",
    ],
  });
}

export function formatEntitlementRule(proposal: EntitlementRuleProposal) {
  if (proposal.metric === "event_count") {
    const window = proposal.evaluation_window === "calendar_month"
      ? "in a calendar month"
      : "over the shopper’s lifetime";
    return `${proposal.threshold} verified donation${proposal.threshold === 1 ? "" : "s"} ${window}`;
  }
  const dollars = ((proposal.amount_threshold_minor ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: proposal.currency ?? "USD",
  });
  if (proposal.metric === "single_amount") {
    const window = proposal.evaluation_window === "calendar_month"
      ? "in a calendar month"
      : proposal.evaluation_window === "lifetime"
        ? "over the shopper’s lifetime"
        : "in one verified event";
    return `one verified donation of at least ${dollars} ${window}`;
  }
  return `${dollars} in verified donations ${proposal.evaluation_window === "calendar_month" ? "in a calendar month" : "over the shopper’s lifetime"}`;
}
