import "server-only";

import { z } from "zod";
import {
  buildImpactReportPrompt,
  impactReportJsonSchema,
  type ImpactReportSource,
  validateImpactReportContent,
} from "@/lib/ai/impact-report";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const completionResponseSchema = z.object({
  model: z.string().optional(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    }),
  ).min(1),
});

export class ImpactReportGenerationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImpactReportGenerationError";
  }
}

export function getOpenRouterConfiguration() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();

  return {
    ready: Boolean(apiKey && model),
    model: model ?? null,
    missing: [
      ...(!apiKey ? ["OPENROUTER_API_KEY"] : []),
      ...(!model ? ["OPENROUTER_MODEL"] : []),
    ],
  };
}

export async function generateImpactReportDraft(sources: ImpactReportSource[]) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();

  if (!apiKey || !model) {
    throw new ImpactReportGenerationError(
      "not_configured",
      "OpenRouter is not configured on the server.",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  let response: Response;

  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://our-impact.vercel.app",
        "X-OpenRouter-Title": "Our Impact",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1_800,
        provider: { require_parameters: true },
        messages: [
          {
            role: "system",
            content:
              "You draft careful corporate-giving impact recaps. Use only supplied facts, preserve evidence qualifiers, and never claim unverified real-world impact.",
          },
          { role: "user", content: buildImpactReportPrompt(sources) },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "our_impact_report",
            strict: true,
            schema: impactReportJsonSchema,
          },
        },
      }),
    });
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    throw new ImpactReportGenerationError(
      code,
      code === "timeout"
        ? "The AI provider took too long to respond. Please try again."
        : "The AI provider could not be reached. Please try again.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    console.error("OpenRouter impact-report request failed", {
      status: response.status,
      requestId: response.headers.get("x-request-id"),
    });
    throw new ImpactReportGenerationError(
      `provider_${response.status}`,
      "The AI provider rejected the draft request. Check the key, model, and account credit, then try again.",
    );
  }

  let completion: z.infer<typeof completionResponseSchema>;
  try {
    completion = completionResponseSchema.parse(await response.json());
  } catch {
    throw new ImpactReportGenerationError(
      "invalid_provider_response",
      "The AI provider returned an unreadable response. Please try again.",
    );
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(completion.choices[0].message.content);
  } catch {
    throw new ImpactReportGenerationError(
      "invalid_json",
      "The AI provider did not return a valid structured draft. Try a model that supports structured outputs.",
    );
  }

  try {
    return {
      content: validateImpactReportContent(candidate, sources),
      model: completion.model ?? model,
    };
  } catch {
    throw new ImpactReportGenerationError(
      "failed_validation",
      "The AI draft failed factual-source validation and was not saved. Please try again.",
    );
  }
}
