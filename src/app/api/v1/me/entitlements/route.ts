import {
  authenticateUserRequest,
  requestOriginAllowed,
} from "@/lib/developer/auth";
import { listSupporterEntitlements } from "@/lib/developer/events";

function cors(origin: string | null): Record<string, string> {
  return origin
    ? { "access-control-allow-origin": origin, vary: "Origin" }
    : {};
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...cors(request.headers.get("origin")),
      "access-control-allow-headers": "authorization, x-our-impact-key",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function GET(request: Request) {
  const auth = await authenticateUserRequest(request);
  if (!auth) return Response.json({ error: "invalid_identity" }, { status: 401 });
  if (!requestOriginAllowed(request, auth.project.allowed_origins)) {
    return Response.json({ error: "origin_not_allowed" }, { status: 403 });
  }
  const entitlements = await listSupporterEntitlements(auth.project.id, auth.claims.supporterId);
  return Response.json(
    { user: { external_user_id: auth.claims.externalUserId }, entitlements },
    { headers: { ...cors(request.headers.get("origin")), "cache-control": "private, no-store" } },
  );
}
