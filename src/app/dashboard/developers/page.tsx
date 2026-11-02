import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Code2, ExternalLink, KeyRound, Radio, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { DeveloperProjectForm, RotateKeyForm, WebhookForm } from "@/components/developer-forms";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Developer tools" };

export default async function DevelopersPage() {
  const supabase = await createClient();
  const { data: membership } = await supabase.from("memberships").select("company_id, role").limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");
  const privileged = createPrivilegedClient();
  const { data: projects } = await privileged.from("developer_projects").select("*").eq("company_id", membership.company_id).order("created_at");

  const projectIds = (projects ?? []).map((project) => project.id);
  const [keysResult, supportersResult, eventsResult, entitlementsResult, rulesResult, endpointsResult, deliveriesResult] = projectIds.length
    ? await Promise.all([
        privileged.from("developer_api_keys").select("project_id, key_prefix, last_four, last_used_at, revoked_at").in("project_id", projectIds).order("created_at", { ascending: false }),
        privileged.from("supporters").select("project_id, id, external_user_id, display_name, last_seen_at").in("project_id", projectIds).order("last_seen_at", { ascending: false }),
        privileged.from("developer_events").select("project_id, id").in("project_id", projectIds),
        privileged.from("user_entitlements").select("project_id, id, supporter_id, entitlement_key, qualifying_count, state").in("project_id", projectIds),
        privileged.from("entitlement_rules").select("project_id, id, name, entitlement_key, threshold, evaluation_window, state").in("project_id", projectIds).order("threshold"),
        privileged.from("webhook_endpoints").select("project_id, id, url, state").in("project_id", projectIds),
        privileged.from("webhook_deliveries").select("project_id, id, event_type, status, response_status, created_at").in("project_id", projectIds).order("created_at", { ascending: false }).limit(25),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Dashboard</Link>
      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Identity + entitlements</p>
          <h1 className="display-type mt-3 text-5xl font-semibold">Make impact useful inside your product.</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-soft">Mike’s software team identifies its own shoppers, forwards verified donation events, and lets Our Impact deterministically grant benefits the shop can query.</p>
        </div>
        <code className="rounded-2xl bg-ink px-4 py-3 text-sm text-mint">await impact.user.is(&quot;community_champion_theme&quot;)</code>
      </div>

      <section className="mt-10 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <DeveloperProjectForm />
        <div className="space-y-6">
          {(projects ?? []).map((project) => {
            const keys = (keysResult.data ?? []).filter((item) => item.project_id === project.id);
            const supporters = (supportersResult.data ?? []).filter((item) => item.project_id === project.id);
            const supporterCount = supporters.length;
            const eventCount = (eventsResult.data ?? []).filter((item) => item.project_id === project.id).length;
            const projectEntitlements = (entitlementsResult.data ?? []).filter((item) => item.project_id === project.id);
            const activeEntitlements = projectEntitlements.filter((item) => item.state === "active").length;
            const rules = (rulesResult.data ?? []).filter((item) => item.project_id === project.id);
            const endpoints = (endpointsResult.data ?? []).filter((item) => item.project_id === project.id);
            const deliveries = (deliveriesResult.data ?? []).filter((item) => item.project_id === project.id);
            return (
              <article key={project.id} className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Sandbox project</p><h2 className="mt-2 text-2xl font-semibold">{project.name}</h2><p className="mt-2 break-all font-mono text-xs text-ink-soft">{project.publishable_key}</p></div>
                  <Link href={`/demo/local-shop/${project.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white"><ExternalLink className="size-4" /> Open Mike’s Vegan Shop demo</Link>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-paper p-4"><Users className="size-4 text-mint-dark" /><p className="mt-2 text-2xl font-semibold">{supporterCount}</p><p className="text-xs text-ink-soft">supporters</p></div>
                  <div className="rounded-2xl bg-paper p-4"><Radio className="size-4 text-coral-dark" /><p className="mt-2 text-2xl font-semibold">{eventCount}</p><p className="text-xs text-ink-soft">events</p></div>
                  <div className="rounded-2xl bg-paper p-4"><Code2 className="size-4 text-ink" /><p className="mt-2 text-2xl font-semibold">{activeEntitlements}</p><p className="text-xs text-ink-soft">active roles</p></div>
                </div>
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl border border-line bg-white p-5">
                    <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Server keys</p>
                    <div className="my-4 space-y-2 text-xs text-ink-soft">{keys.map((key) => <p key={`${key.key_prefix}${key.last_four}`} className="font-mono">{key.key_prefix}…{key.last_four} · {key.revoked_at ? "revoked" : "active"}</p>)}</div>
                    <RotateKeyForm projectId={project.id} />
                  </div>
                  <WebhookForm projectId={project.id} />
                </div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <div className="rounded-2xl bg-paper p-5">
                    <p className="font-semibold">Deterministic rules</p>
                    {rules.map((rule) => <div key={rule.id} className="mt-3 flex items-center justify-between gap-4 text-sm"><div><p className="font-medium">{rule.name}</p><code className="text-xs text-ink-soft">{rule.entitlement_key}</code></div><span className="text-right text-xs font-semibold text-ink-soft">{rule.threshold} event{rule.threshold === 1 ? "" : "s"}<br />{rule.evaluation_window.replace("_", " ")}</span></div>)}
                  </div>
                  <div className="rounded-2xl bg-paper p-5">
                    <p className="font-semibold">Known users</p>
                    {supporters.slice(0, 5).map((supporter) => {
                      const roles = projectEntitlements.filter((item) => item.supporter_id === supporter.id && item.state === "active");
                      return <div key={supporter.id} className="mt-3"><p className="text-sm font-medium">{supporter.display_name ?? supporter.external_user_id}</p><p className="font-mono text-xs text-ink-soft">{supporter.external_user_id}</p><p className="mt-1 text-xs font-semibold text-mint-dark">{roles.length ? roles.map((role) => `${role.entitlement_key} (${role.qualifying_count})`).join(" · ") : "No active roles"}</p></div>;
                    })}
                    {!supporters.length && <p className="mt-3 text-sm text-ink-soft">No identified users yet.</p>}
                  </div>
                </div>
                {!!endpoints.length && <div className="mt-5 rounded-2xl bg-paper p-5"><p className="font-semibold">Webhook health</p>{endpoints.map((endpoint) => <p key={endpoint.id} className="mt-2 break-all text-sm text-ink-soft">{endpoint.state} · {endpoint.url}</p>)}{deliveries.slice(0, 5).map((delivery) => <p key={delivery.id} className="mt-2 text-xs text-ink-soft">{delivery.event_type} · {delivery.status}{delivery.response_status ? ` · HTTP ${delivery.response_status}` : ""}</p>)}</div>}
              </article>
            );
          })}
          {!projects?.length && <div className="grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-ink/20 p-8 text-center text-ink-soft">Create the first project to unlock the test shop, API keys, rules, and webhooks.</div>}
        </div>
      </section>
    </main>
  );
}
