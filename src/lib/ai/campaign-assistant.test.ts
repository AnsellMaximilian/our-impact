import { describe, expect, it } from "vitest";
import {
  buildCampaignAssistantPrompt,
  campaignAssistantResponseSchema,
  campaignProposalSchema,
} from "./campaign-assistant";

const organizations = [
  {
    id: 11,
    name: "Kind Paws Collective",
    category: "Animal welfare",
    shortDescription: "Supports rescued animals and responsible adoption.",
    countryCode: "ID",
  },
  {
    id: 12,
    name: "City Seed Garden",
    category: "Food and environment",
    shortDescription: "Builds organic community gardens and teaches growers.",
    countryCode: "ID",
  },
];

const proposal = {
  title: "One year of kinder choices",
  summary: "Celebrate the shop’s first anniversary by letting customers support animal welfare and organic community gardens.",
  budget_minor: 50000,
  currency: "USD" as const,
  organization_ids: [11, 12],
  period_cadence: "weekly" as const,
  timezone: "Asia/Jakarta" as const,
  close_local_time: "20:00",
  close_weekday: 5,
  allocation_model: "proportional" as const,
  step_notes: {
    story: "Connects the anniversary with the shop’s values.",
    commitment: "A clear weekly ceiling that remains owner-approved.",
    recipients: "Both partners match the causes in the request.",
    rounds: "A week gives customers time to participate.",
    allocation: "Every vote influences how the commitment is divided.",
  },
};

describe("campaign assistant", () => {
  it("grounds the prompt in the available recipient catalog", () => {
    const prompt = buildCampaignAssistantPrompt({
      workspaceName: "Mike’s Vegan Shop",
      organizations,
      history: [],
      request: "Help me celebrate our first anniversary.",
    });

    expect(prompt).toContain("Kind Paws Collective");
    expect(prompt).toContain("City Seed Garden");
    expect(prompt).toContain('"id":11');
    expect(prompt).toContain("Creating a draft never authorizes or captures a payment");
  });

  it("accepts a complete structured campaign proposal", () => {
    const result = campaignAssistantResponseSchema.safeParse({
      kind: "proposal",
      message: "I prepared a weekly anniversary campaign for review.",
      referenced_organization_ids: [11, 12],
      proposal,
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate campaign recipients", () => {
    const result = campaignProposalSchema.safeParse({
      ...proposal,
      organization_ids: [11, 11],
    });

    expect(result.success).toBe(false);
  });

  it("requires clarification responses to omit a proposal", () => {
    const result = campaignAssistantResponseSchema.safeParse({
      kind: "clarification",
      message: "What commitment would you like to make per round?",
      referenced_organization_ids: [11, 12],
      proposal,
    });

    expect(result.success).toBe(false);
  });
});
