import "server-only";

import type { Json, TableRow } from "@/lib/database.types";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export async function ingestDeveloperEvent(input: {
  project: TableRow<"developer_projects">;
  externalUserId: string;
  displayName?: string;
  externalEventId: string;
  eventType: string;
  occurredAt: string;
  properties?: Record<string, Json | undefined>;
  source?: "api" | "demo" | "paypal";
}) {
  const supabase = createPrivilegedClient();
  const { data: supporter, error: supporterError } = await supabase
    .from("supporters")
    .upsert(
      {
        project_id: input.project.id,
        company_id: input.project.company_id,
        external_user_id: input.externalUserId,
        display_name: input.displayName,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "project_id,external_user_id" },
    )
    .select("*")
    .single();
  if (supporterError || !supporter) throw supporterError ?? new Error("Supporter could not be stored.");

  const { data: inserted, error: eventError } = await supabase
    .from("developer_events")
    .insert({
      project_id: input.project.id,
      company_id: input.project.company_id,
      supporter_id: supporter.id,
      external_event_id: input.externalEventId,
      event_type: input.eventType,
      source: input.source ?? "api",
      occurred_at: input.occurredAt,
      event_data: (input.properties ?? {}) as Json,
    })
    .select("*")
    .maybeSingle();

  if (eventError?.code === "23505") {
    const { data: existing } = await supabase
      .from("developer_events")
      .select("*")
      .eq("project_id", input.project.id)
      .eq("external_event_id", input.externalEventId)
      .maybeSingle();
    if (existing) return { event: existing, supporter, replayed: true };
  }
  if (eventError || !inserted) throw eventError ?? new Error("Event could not be stored.");
  return { event: inserted, supporter, replayed: false };
}

export async function listSupporterEntitlements(projectId: string, supporterId: string) {
  const supabase = createPrivilegedClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("entitlement_key, state, qualifying_count, qualified_at, valid_until, updated_at")
    .eq("project_id", projectId)
    .eq("supporter_id", supporterId)
    .order("entitlement_key");
  if (error) throw error;
  return data ?? [];
}
