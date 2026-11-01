import { z } from "zod";
import { authenticateSecretRequest } from "@/lib/developer/auth";
import { ingestDeveloperEvent, listSupporterEntitlements } from "@/lib/developer/events";
import { deliverDeveloperWebhooks } from "@/lib/developer/webhooks";

const inputSchema = z.object({
  id: z.string().trim().min(3).max(120),
  type: z.string().trim().regex(/^[a-z][a-z0-9_.]{2,79}$/),
  external_user_id: z.string().trim().min(1).max(120),
  display_name: z.string().trim().min(1).max(120).optional(),
  occurred_at: z.iso.datetime().optional(),
  properties: z.record(z.string(), z.json()).optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateSecretRequest(request);
  if (!auth) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await ingestDeveloperEvent({
      project: auth.project,
      externalEventId: parsed.data.id,
      eventType: parsed.data.type,
      externalUserId: parsed.data.external_user_id,
      displayName: parsed.data.display_name,
      occurredAt: parsed.data.occurred_at ?? new Date().toISOString(),
      properties: parsed.data.properties,
    });
    const entitlements = await listSupporterEntitlements(auth.project.id, result.supporter.id);
    await deliverDeveloperWebhooks({ projectId: auth.project.id, limit: 10 }).catch((error) => {
      console.error("Immediate developer webhook delivery failed", error);
    });
    return Response.json(
      { id: result.event.id, replayed: result.replayed, entitlements },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    console.error("Developer event ingestion failed", error);
    return Response.json({ error: "event_unavailable" }, { status: 500 });
  }
}
