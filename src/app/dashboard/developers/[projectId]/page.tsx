import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CircleCheck, ExternalLink, Leaf } from "lucide-react";
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
    privileged.from("supporters").select("id, external_user_id, display_name, created_at, last_seen_at").eq("project_id", project.id).order("last_seen_at", { ascending: false }),
    privileged.from("user_entitlements").select("id, supporter_id, entitlement_key, state, qualifying_count, progress_value, progress_unit, valid_until").eq("project_id", project.id).order("updated_at", { ascending: false }),
    privileged.from("developer_events").select("id, supporter_id, event_type, occurred_at, source", { count: "exact" }).eq("project_id", project.id).order("occurred_at", { ascending: false }).limit(100),
    privileged.from("developer_api_keys").select("id, key_prefix, last_four, last_used_at, revoked_at").eq("project_id", project.id).order("created_at", { ascending: false }),
    privileged.from("webhook_endpoints").select("id, url, description, state").eq("project_id", project.id).order("created_at", { ascending: false }),
    privileged.from("webhook_deliveries").select("id, event_type, status, response_status, created_at").eq("project_id", project.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const migrationMissing = definitionsResult.error || entitlementsResult.error;
  const openRouter = getOpenRouterConfiguration();
  const integrationHealthy = project.allowed_origins.length > 0 && (keysResult.data ?? []).some((key) => !key.revoked_at);

  return (
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      <Link href="/dashboard/developers" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> All projects</Link>

      <header className="dashboard-card relative mt-4 min-h-[260px] overflow-hidden rounded-[1.75rem] bg-white sm:min-h-[230px]">
        <div className="relative z-10 max-w-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold capitalize text-mint-dark"><Leaf className="size-3.5" /> {project.environment}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft"><CircleCheck className={`size-3.5 ${integrationHealthy ? "text-mint-dark" : "text-ink-soft"}`} /> {integrationHealthy ? "Integration healthy" : "Setup in progress"}</span></div>
          <h1 className="display-type mt-4 text-3xl font-semibold sm:text-5xl">{project.name}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-ink-soft sm:text-base">Turn verified community support into recognition, access, and customer experiences inside your product.</p>
          <Link href={`/demo/local-shop/${project.id}`} target="_blank" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"><ExternalLink className="size-4" /> Open test site</Link>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[46%] sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[48%]">
          <Image src="/illustrations/hero-developer-integration.png" alt="" fill priority sizes="(min-width: 640px) 48vw, 100vw" className="object-contain object-right-bottom" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/25 to-transparent sm:bg-[linear-gradient(90deg,#fff_0%,rgba(255,255,255,0.9)_18%,rgba(255,255,255,0.12)_58%,transparent_100%)]" />
        </div>
      </header>

      {migrationMissing ? (
        <div className="mt-7 rounded-3xl bg-coral/10 p-6 text-sm text-coral-dark ring-1 ring-coral/25">This project is temporarily unavailable. Contact support if the problem continues.</div>
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
          events={eventsResult.data ?? []}
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
