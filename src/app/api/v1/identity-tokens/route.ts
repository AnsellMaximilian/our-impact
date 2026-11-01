import { z } from "zod";
import { authenticateSecretRequest } from "@/lib/developer/auth";
import { issueIdentityToken } from "@/lib/developer/credentials";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

const inputSchema = z.object({
  external_user_id: z.string().trim().min(1).max(120),
  display_name: z.string().trim().min(1).max(120).optional(),
  ttl_seconds: z.number().int().min(60).max(3600).optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateSecretRequest(request);
  if (!auth) return Response.json({ error: "invalid_api_key" }, { status: 401 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createPrivilegedClient();
  const { data: supporter, error } = await supabase
    .from("supporters")
    .upsert(
      {
        project_id: auth.project.id,
        company_id: auth.project.company_id,
        external_user_id: parsed.data.external_user_id,
        display_name: parsed.data.display_name,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "project_id,external_user_id" },
    )
    .select("id, external_user_id")
    .single();
  if (error || !supporter) {
    console.error("Identity token supporter upsert failed", error);
    return Response.json({ error: "identity_unavailable" }, { status: 500 });
  }

  const issued = issueIdentityToken(
    {
      projectId: auth.project.id,
      companyId: auth.project.company_id,
      supporterId: supporter.id,
      externalUserId: supporter.external_user_id,
    },
    parsed.data.ttl_seconds,
  );
  return Response.json({
    token: issued.token,
    expires_at: new Date(issued.expiresAt * 1000).toISOString(),
    user: { external_user_id: supporter.external_user_id },
  });
}
