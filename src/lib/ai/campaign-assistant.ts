import { z } from "zod";

const supportedCampaignTimezones = [
  "Asia/Jakarta",
  "UTC",
  "America/New_York",
  "Europe/London",
] as const;

const campaignStepNotesSchema = z.object({
  story: z.string().trim().min(2).max(500),
  commitment: z.string().trim().min(2).max(500),
  recipients: z.string().trim().min(2).max(500),
  rounds: z.string().trim().min(2).max(500),
  allocation: z.string().trim().min(2).max(500),
});

export const campaignProposalSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .refine((value) => /[a-z0-9]/i.test(value)),
    summary: z.string().trim().min(20).max(280),
    budget_minor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    currency: z.enum(["EUR", "IDR", "USD"]),
    organization_ids: z.array(z.number().int().positive()).min(2).max(5),
    period_cadence: z.enum(["daily", "weekly"]),
    timezone: z.enum(supportedCampaignTimezones),
    close_local_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    close_weekday: z.number().int().min(0).max(6),
    allocation_model: z.enum(["winner_takes_all", "proportional", "hybrid"]),
    step_notes: campaignStepNotesSchema,
  })
  .superRefine((proposal, context) => {
    if (new Set(proposal.organization_ids).size !== proposal.organization_ids.length) {
      context.addIssue({
        code: "custom",
        path: ["organization_ids"],
        message: "Campaign recipients must be unique.",
      });
    }
  });

export const campaignAssistantResponseSchema = z
  .object({
    kind: z.enum(["clarification", "proposal"]),
    message: z.string().trim().min(2).max(4000),
    referenced_organization_ids: z.array(z.number().int().positive()).max(5),
    proposal: campaignProposalSchema.nullable(),
  })
  .superRefine((response, context) => {
    if (response.kind === "clarification" && response.proposal !== null) {
      context.addIssue({ code: "custom", message: "Clarifications cannot contain a proposal." });
    }
    if (response.kind === "proposal" && response.proposal === null) {
      context.addIssue({ code: "custom", message: "A proposal response needs a proposal." });
    }
  });

export type CampaignProposal = z.infer<typeof campaignProposalSchema>;
export type CampaignAssistantResponse = z.infer<typeof campaignAssistantResponseSchema>;

export type CampaignAssistantContext = {
  workspaceName: string;
  organizations: Array<{
    id: number;
    name: string;
    category: string;
    shortDescription: string;
    countryCode: string;
  }>;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  request: string;
};

const noteProperties = {
  story: { type: "string", minLength: 2, maxLength: 500 },
  commitment: { type: "string", minLength: 2, maxLength: 500 },
  recipients: { type: "string", minLength: 2, maxLength: 500 },
  rounds: { type: "string", minLength: 2, maxLength: 500 },
  allocation: { type: "string", minLength: 2, maxLength: 500 },
} as const;

export const campaignAssistantJsonSchema = {
  name: "campaign_creation_assistant_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["kind", "message", "referenced_organization_ids", "proposal"],
    properties: {
      kind: { type: "string", enum: ["clarification", "proposal"] },
      message: { type: "string", minLength: 2, maxLength: 4000 },
      referenced_organization_ids: {
        type: "array",
        maxItems: 5,
        uniqueItems: true,
        items: { type: "integer", minimum: 1 },
      },
      proposal: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: [
              "title",
              "summary",
              "budget_minor",
              "currency",
              "organization_ids",
              "period_cadence",
              "timezone",
              "close_local_time",
              "close_weekday",
              "allocation_model",
              "step_notes",
            ],
            properties: {
              title: { type: "string", minLength: 3, maxLength: 120 },
              summary: { type: "string", minLength: 20, maxLength: 280 },
              budget_minor: {
                type: "integer",
                minimum: 1,
                maximum: Number.MAX_SAFE_INTEGER,
              },
              currency: { type: "string", enum: ["EUR", "IDR", "USD"] },
              organization_ids: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                uniqueItems: true,
                items: { type: "integer", minimum: 1 },
              },
              period_cadence: { type: "string", enum: ["daily", "weekly"] },
              timezone: { type: "string", enum: [...supportedCampaignTimezones] },
              close_local_time: {
                type: "string",
                pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
              },
              close_weekday: { type: "integer", minimum: 0, maximum: 6 },
              allocation_model: {
                type: "string",
                enum: ["winner_takes_all", "proportional", "hybrid"],
              },
              step_notes: {
                type: "object",
                additionalProperties: false,
                required: ["story", "commitment", "recipients", "rounds", "allocation"],
                properties: noteProperties,
              },
            },
          },
        ],
      },
    },
  },
} as const;

export function buildCampaignAssistantPrompt(context: CampaignAssistantContext) {
  return JSON.stringify({
    product: "Our Impact",
    workspace: context.workspaceName,
    available_recipient_partners: context.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      category: organization.category,
      description: organization.shortDescription,
      country_code: organization.countryCode,
    })),
    recent_conversation: context.history.slice(-8),
    latest_request: context.request,
    campaign_fields: {
      currencies: ["USD", "EUR", "IDR"],
      cadences: ["daily", "weekly"],
      timezones: [...supportedCampaignTimezones],
      allocation_models: {
        proportional: "Divide the commitment according to each recipient's share of valid votes.",
        winner_takes_all: "Direct the full commitment to the recipient with the most valid votes.",
        hybrid: "Give every recipient a base share, then divide the remainder by vote share.",
      },
      close_weekday: "0 is Sunday and 6 is Saturday; it is ignored for daily rounds.",
      budget_minor:
        "The recurring commitment per round. USD and EUR use cents; IDR uses whole rupiah.",
    },
    instructions: [
      "Help a program owner plan one community-giving campaign through a concise conversation.",
      "Use only the supplied recipient partners and copy their numeric IDs exactly. Never invent a recipient.",
      "A proposal must select 2 to 5 recipient partners whose catalog descriptions fit the owner's goal.",
      "If the catalog cannot support the requested cause with at least two honest choices, explain that and ask the owner to connect suitable recipients; return no proposal.",
      "Ask one concise clarification when a missing business decision would materially change the campaign. Otherwise, make clearly labeled, sensible suggestions so the owner can review a complete draft.",
      "The budget is the maximum business commitment in every voting round. Creating a draft never authorizes or captures a payment.",
      "Keep the title specific, the public summary clear, and every field within the supplied options.",
      "Use step_notes for short owner-facing reasons behind the story, commitment, recipient, round, and allocation suggestions. Do not reveal hidden reasoning.",
      "Populate referenced_organization_ids with every recipient ID discussed in the conversational message.",
      "The proposal creates a private draft that the owner can edit before publishing. Never claim it has already been created or published.",
    ],
  });
}
