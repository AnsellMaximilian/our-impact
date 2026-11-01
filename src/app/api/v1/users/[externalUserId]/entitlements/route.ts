import { authenticateSecretRequest } from "@/lib/developer/auth";
import { listSupporterEntitlements } from "@/lib/developer/events";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalUserId: string }> },
) {
  const auth = await authenticateSecretRequest(request);
  if (!auth) return Response.json({ error: "invalid_api_key" }, { status: 401 });
  const { externalUserId } = await params;
  const supabase = createPrivilegedClient();
  const { data: supporter } = await supabase
    .from("supporters")
    .select("id, external_user_id, display_name")
    .eq("project_id", auth.project.id)
    .eq("external_user_id", decodeURIComponent(externalUserId))
    .maybeSingle();
  if (!supporter) return Response.json({ error: "user_not_found" }, { status: 404 });
  const entitlements = await listSupporterEntitlements(auth.project.id, supporter.id);
  return Response.json({ user: supporter, entitlements });
}
