import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Leaf, ShieldCheck } from "lucide-react";
import { DeveloperProjectWorkspace } from "@/components/developer-project-workspace";
import { getOpenRouterConfiguration } from "@/lib/ai/openrouter";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Developer project" };
export const dynamic = "force-dynamic";

export default async function DeveloperProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", project.company_id)
    .maybeSingle();
  if (!membership) notFound();

  const [
    definitionsResult,
    rulesResult,
    supportersResult,
    entitlementsResult,
    eventsResult,
    keysResult,
    endpointsResult,
    deliveriesResult,
  ] = await Promise.all([
    privileged.from("entitlement_definitions").select("*").eq("project_id", project.id).order("created_at"),
    privileged.from("entitlement_rules").select("*").eq("project_id", project.id).order("created_at"),
    privileged.from("supporters").select("id, external_user_id, display_name, last_seen_at").eq("project_id", project.id).order("last_seen_at", { ascending: false }),
    privileged.from("user_entitlements").select("id, supporter_id, entitlement_key, state, qualifying_count, progress_value, progress_unit, valid_until").eq("project_id", project.id).order("updated_at", { ascending: false }),
    privileged.from("developer_events").select("id", { count: "exact", head: true }).eq("project_id", project.id),
    privileged.from("developer_api_keys").select("id, key_prefix, last_four, last_used_at, revoked_at").eq("project_id", project.id).order("created_at", { ascending: false }),
    privileged.from("webhook_endpoints").select("id, url, description, state").eq("project_id", project.id).order("created_at", { ascending: false }),
    privileged.from("webhook_deliveries").select("id, event_type, status, response_status, created_at").eq("project_id", project.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const migrationMissing = definitionsResult.error || entitlementsResult.error;
  const openRouter = getOpenRouterConfiguration();

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard/developers" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Developer projects</Link>
        <Link href={`/demo/local-shop/${project.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white"><ExternalLink className="size-4" /> Open Mike’s test shop</Link>
      </div>

      <header className="mt-8 overflow-hidden rounded-[2.25rem] bg-surface ring-1 ring-ink/8">
        <div className="flex flex-col gap-6 p-7 sm:flex-row sm:items-end sm:justify-between sm:p-9">
          <div>
            <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark"><Leaf className="size-3.5" /> Sandbox project</span><span className="rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft">Mike’s software team</span></div>
            <h1 className="display-type mt-4 text-4xl font-semibold sm:text-5xl">{project.name}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-ink-soft">Configure how verified community support becomes customer recognition inside Mike’s own website and product.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-paper px-4 py-3 text-xs font-semibold text-ink-soft"><ShieldCheck className="size-4 text-mint-dark" /> Owner-approved deterministic rules</div>
        </div>
      </header>

      {migrationMissing ? (
        <div className="mt-7 rounded-3xl bg-coral/10 p-6 text-sm text-coral-dark ring-1 ring-coral/25">Apply the Entitlement Studio database migration before opening this project.</div>
      ) : (
        <DeveloperProjectWorkspace
          project={{
            id: project.id,
            name: project.name,
            publishable_key: project.publishable_key,
            allowed_origins: project.allowed_origins,
            environment: project.environment,
          }}
          definitions={definitionsResult.data ?? []}
          rules={rulesResult.data ?? []}
          supporters={supportersResult.data ?? []}
          userEntitlements={entitlementsResult.data ?? []}
          eventCount={eventsResult.count ?? 0}
          keys={keysResult.data ?? []}
          endpoints={endpointsResult.data ?? []}
          deliveries={deliveriesResult.data ?? []}
          openRouterReady={openRouter.ready}
          openRouterModel={openRouter.model}
        />
      )}
    </main>
  );
}
