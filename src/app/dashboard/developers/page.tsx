import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Braces,
  ExternalLink,
  Leaf,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DeveloperProjectForm } from "@/components/developer-forms";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Developer projects" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const privileged = createPrivilegedClient();
  const { data: projects } = await privileged
    .from("developer_projects")
    .select("*")
    .eq("company_id", membership.company_id)
    .order("created_at");
  const projectIds = (projects ?? []).map((project) => project.id);
  const [supportersResult, eventsResult, definitionsResult, grantsResult] = projectIds.length
    ? await Promise.all([
        privileged.from("supporters").select("project_id, id").in("project_id", projectIds),
        privileged.from("developer_events").select("project_id, id").in("project_id", projectIds),
        privileged.from("entitlement_definitions").select("project_id, id").in("project_id", projectIds),
        privileged.from("user_entitlements").select("project_id, id, state").in("project_id", projectIds).eq("state", "active"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Dashboard</Link>
        <Link href="/developers/docs" className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink"><BookOpen className="size-4" /> Documentation</Link>
      </div>

      <header className="mt-8 overflow-hidden rounded-[2.5rem] bg-ink text-white shadow-[0_30px_80px_rgba(16,38,63,0.16)]">
        <div className="grid gap-8 p-8 sm:p-11 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-mint"><Braces className="size-4" /> Product integrations</p>
            <h1 className="display-type mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] sm:text-6xl">Turn verified support into something customers can feel.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">Give Mike’s software team one place to manage identity, entitlements, API access, webhooks, and safe test events.</p>
          </div>
          <div className="rounded-3xl bg-white/8 p-5 ring-1 ring-white/10"><ShieldCheck className="size-5 text-mint" /><p className="mt-3 font-semibold">Built for controlled rollout</p><p className="mt-2 text-sm leading-6 text-white/60">AI can prepare a change, but only an owner-approved deterministic rule affects shopper access.</p></div>
        </div>
      </header>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Projects</p><h2 className="mt-2 text-3xl font-semibold">Connected customer experiences</h2></div><span className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark">{projects?.length ?? 0} sandbox</span></div>
          <div className="mt-6 space-y-5">
            {(projects ?? []).map((project) => {
              const supporterCount = (supportersResult.data ?? []).filter((item) => item.project_id === project.id).length;
              const eventCount = (eventsResult.data ?? []).filter((item) => item.project_id === project.id).length;
              const entitlementCount = (definitionsResult.data ?? []).filter((item) => item.project_id === project.id).length;
              const activeGrantCount = (grantsResult.data ?? []).filter((item) => item.project_id === project.id).length;
              return (
                <article key={project.id} className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2"><span className="grid size-9 place-items-center rounded-full bg-[#dff28b] text-[#264c37]"><Leaf className="size-4" /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-mint-dark">Sandbox project</p><h3 className="mt-1 text-2xl font-semibold">{project.name}</h3></div></div><code className="mt-4 block max-w-xl truncate text-xs text-ink-soft">{project.publishable_key}</code></div>
                    <div className="flex flex-wrap gap-2"><Link href={`/demo/local-shop/${project.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"><ExternalLink className="size-4" /> Demo</Link><Link href={`/dashboard/developers/${project.id}`} className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">Manage project <ArrowRight className="size-4" /></Link></div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[{ icon: Users, value: supporterCount, label: "shoppers" }, { icon: Radio, value: eventCount, label: "events" }, { icon: BadgeCheck, value: entitlementCount, label: "entitlements" }, { icon: ShieldCheck, value: activeGrantCount, label: "active grants" }].map(({ icon: Icon, value, label }) => <div key={label} className="rounded-2xl bg-paper p-3"><Icon className="size-4 text-coral-dark" /><p className="mt-2 text-xl font-semibold">{value}</p><p className="text-xs text-ink-soft">{label}</p></div>)}
                  </div>
                </article>
              );
            })}
            {!projects?.length && <div className="grid min-h-72 place-items-center rounded-[2rem] border border-dashed border-ink/20 p-8 text-center"><div><Braces className="mx-auto size-7 text-coral-dark" /><p className="mt-4 font-semibold">No customer integration yet</p><p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">Create Mike’s first developer project to get an SDK key, entitlement catalog, test shop, and webhook tools.</p></div></div>}
          </div>
        </div>
        <aside className="space-y-5"><DeveloperProjectForm /><div className="rounded-3xl bg-mint/12 p-5 ring-1 ring-mint/25"><p className="font-semibold">Who uses this area?</p><p className="mt-2 text-sm leading-6 text-ink-soft">Mike or his marketing team owns the program. Mike’s software team uses these credentials and stable entitlement keys to connect the shop website.</p></div></aside>
      </section>
    </main>
  );
}
