import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  issueWidgetIdentity,
  verifyIdentityToken,
  verifyWidgetIdentity,
} from "@/lib/developer/credentials";
import { getWidgetIdentityCookieName } from "@/lib/developer/widget-identity";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  token: z.string().min(32).max(4096),
  parentOrigin: z.url().max(500),
});
const clearInputSchema = z.object({ parentOrigin: z.url().max(500) });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId)
  ) {
    return NextResponse.json(
      { message: "The shopper identity could not be verified." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const claims = verifyIdentityToken(parsed.data.token);
  if (!claims) {
    return NextResponse.json(
      { message: "The shopper identity has expired. Refresh the host page." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const privileged = createPrivilegedClient();
  const [{ data: campaign }, { data: project }, { data: supporter }] =
    await Promise.all([
      privileged
        .from("campaigns")
        .select("id, company_id")
        .eq("public_id", publicId)
        .eq("status", "published")
        .maybeSingle(),
      privileged
        .from("developer_projects")
        .select("id, company_id, allowed_origins")
        .eq("id", claims.projectId)
        .eq("company_id", claims.companyId)
        .maybeSingle(),
      privileged
        .from("supporters")
        .select("id, project_id, company_id, external_user_id")
        .eq("id", claims.supporterId)
        .eq("project_id", claims.projectId)
        .eq("company_id", claims.companyId)
        .maybeSingle(),
    ]);

  const originAllowed =
    parsed.data.parentOrigin === request.nextUrl.origin ||
    project?.allowed_origins.includes("*") ||
    project?.allowed_origins.includes(parsed.data.parentOrigin);
  if (
    !campaign ||
    !project ||
    !supporter ||
    campaign.company_id !== claims.companyId ||
    supporter.external_user_id !== claims.externalUserId ||
    !originAllowed
  ) {
    return NextResponse.json(
      {
        message:
          "This site is not allowed to identify shoppers for this campaign.",
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const issued = issueWidgetIdentity(
    {
      projectId: project.id,
      companyId: project.company_id,
      supporterId: supporter.id,
      externalUserId: supporter.external_user_id,
      campaignId: campaign.id,
      parentOrigin: parsed.data.parentOrigin,
    },
    claims.exp - now,
  );
  const response = NextResponse.json(
    {
      status: "identified",
      externalUserId: supporter.external_user_id,
      expiresAt: new Date(issued.expiresAt * 1000).toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(getWidgetIdentityCookieName(), issued.token, {
    httpOnly: true,
    maxAge: Math.max(1, issued.expiresAt - now),
    path: "/",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    partitioned: isProduction,
  });
  return response;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const parsed = clearInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId)) {
    return NextResponse.json(
      { message: "The widget identity could not be cleared." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cookieName = getWidgetIdentityCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const claims = token ? verifyWidgetIdentity(token) : null;

  if (claims) {
    const privileged = createPrivilegedClient();
    const [{ data: campaign }, { data: project }] = await Promise.all([
      privileged
        .from("campaigns")
        .select("id, company_id")
        .eq("public_id", publicId)
        .eq("status", "published")
        .maybeSingle(),
      privileged
        .from("developer_projects")
        .select("id, company_id, allowed_origins")
        .eq("id", claims.projectId)
        .eq("company_id", claims.companyId)
        .maybeSingle(),
    ]);
    const originAllowed =
      parsed.data.parentOrigin === request.nextUrl.origin ||
      project?.allowed_origins.includes("*") ||
      project?.allowed_origins.includes(parsed.data.parentOrigin);
    if (
      !campaign ||
      !project ||
      campaign.id !== claims.campaignId ||
      campaign.company_id !== claims.companyId ||
      !originAllowed
    ) {
      return NextResponse.json(
        { message: "This site is not allowed to clear the widget identity." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const response = NextResponse.json(
    { status: "cleared" },
    { headers: { "Cache-Control": "no-store" } },
  );
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    partitioned: isProduction,
  });
  return response;
}
