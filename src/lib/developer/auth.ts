import "server-only";

import type { TableRow } from "@/lib/database.types";
import { hashApiKey, verifyIdentityToken } from "@/lib/developer/credentials";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export type DeveloperProjectAuth = {
  project: TableRow<"developer_projects">;
  keyId: string;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

export async function authenticateSecretRequest(request: Request): Promise<DeveloperProjectAuth | null> {
  const secret = bearer(request);
  if (!secret?.startsWith("oi_sk_test_")) return null;

  const supabase = createPrivilegedClient();
  const { data: key } = await supabase
    .from("developer_api_keys")
    .select("id, project_id")
    .eq("key_hash", hashApiKey(secret))
    .is("revoked_at", null)
    .maybeSingle();
  if (!key) return null;

  const { data: project } = await supabase
    .from("developer_projects")
    .select("*")
    .eq("id", key.project_id)
    .maybeSingle();
  if (!project) return null;

  void supabase
    .from("developer_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { project, keyId: key.id };
}

export async function authenticateUserRequest(request: Request) {
  const publishableKey = request.headers.get("x-our-impact-key");
  const token = bearer(request);
  if (!publishableKey?.startsWith("oi_pk_test_") || !token) return null;

  const claims = verifyIdentityToken(token);
  if (!claims) return null;

  const supabase = createPrivilegedClient();
  const { data: project } = await supabase
    .from("developer_projects")
    .select("*")
    .eq("publishable_key", publishableKey)
    .eq("id", claims.projectId)
    .maybeSingle();
  if (!project || project.company_id !== claims.companyId) return null;

  return { project, claims };
}

export function requestOriginAllowed(request: Request, allowedOrigins: string[]) {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}
