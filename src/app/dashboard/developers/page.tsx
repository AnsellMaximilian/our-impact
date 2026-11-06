import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, BookOpen, Braces, ExternalLink, Leaf, Plus, Radio, ShieldCheck, Users } from "lucide-react";
import { DeveloperProjectForm } from "@/components/developer-forms";
import { Sheet } from "@/components/sheet";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Developer projects" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");
  const { data: membership } = await supabase.from("memberships").select("company_id, role").eq("user_id", userId).limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");

  const privileged = createPrivilegedClient();
  const { data: projects } = await privileged.from("developer_projects").select("*").eq("company_id", membership.company_id).order("created_at");
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
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-ink px-6 py-8 text-white sm:px-9 sm:py-10">
        <div className="relative z-10 max-w-2xl">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mint"><Braces className="size-4" /> Developer platform</p>
          <h1 className="display-type mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Bring community impact into your product.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-white/65">Connect verified supporters to customer recognition, member experiences, and your own product workflows.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Sheet title="Create a developer project" description="Set up browser origins and generate the credentials for one website or application." trigger={<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-mint px-5 text-sm font-semibold text-ink"><Plus className="size-4" /> New project</button>}><DeveloperProjectForm /></Sheet>
            <Link href="/developers/docs" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/8 px-5 text-sm font-semibold text-white ring-1 ring-white/12"><BookOpen className="size-4" /> Read the docs</Link>
          </div>
        </div>
        <Image src="/illustrations/hero-developer-integration.png" alt="" width={1400} height={700} className="absolute bottom-0 right-0 hidden h-full w-[46%] object-cover object-left opacity-90 lg:block" />
      </header>

      <section className="mt-7">
        <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Projects</p><h2 className="mt-1 text-2xl font-semibold">Connected experiences</h2></div><span className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark">{projects?.length ?? 0} project{projects?.length === 1 ? "" : "s"}</span></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {(projects ?? []).map((project, index) => {
            const supporterCount = (supportersResult.data ?? []).filter((item) => item.project_id === project.id).length;
            const eventCount = (eventsResult.data ?? []).filter((item) => item.project_id === project.id).length;
            const entitlementCount = (definitionsResult.data ?? []).filter((item) => item.project_id === project.id).length;
            const activeGrantCount = (grantsResult.data ?? []).filter((item) => item.project_id === project.id).length;
            return (
              <article key={project.id} className="dashboard-card overflow-hidden rounded-[1.5rem]">
                <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-ink/8">
                  <div className="relative min-h-32 bg-[#e3ebdf]"><Image src={index % 2 === 0 ? "/illustrations/thumbnail-production-website.png" : "/illustrations/thumbnail-sandbox-server.png"} alt="" fill sizes="112px" className="object-cover" /></div>
                  <div className="min-w-0 p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-mint-dark"><Leaf className="size-3.5" /> Development</div><h3 className="mt-2 truncate text-xl font-semibold">{project.name}</h3><code className="mt-3 block truncate text-xs text-ink-soft">{project.publishable_key}</code></div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-2">
                    {[{ icon: Users, value: supporterCount, label: "users" }, { icon: Radio, value: eventCount, label: "events" }, { icon: BadgeCheck, value: entitlementCount, label: "rules" }, { icon: ShieldCheck, value: activeGrantCount, label: "active" }].map(({ icon: Icon, value, label }) => <div key={label} className="rounded-xl bg-paper p-3"><Icon className="size-4 text-coral-dark" /><p className="mt-2 text-xl font-semibold">{value}</p><p className="text-[11px] text-ink-soft">{label}</p></div>)}
                  </div>
                  <div className="mt-5 flex flex-wrap justify-end gap-2"><Link href={`/demo/local-shop/${project.id}`} target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold"><ExternalLink className="size-4" /> Preview</Link><Link href={`/dashboard/developers/${project.id}`} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">Manage <ArrowRight className="size-4" /></Link></div>
                </div>
              </article>
            );
          })}
          {!projects?.length && <div className="dashboard-card col-span-full grid min-h-72 place-items-center rounded-[1.5rem] p-8 text-center"><div><Braces className="mx-auto size-8 text-coral-dark" /><p className="mt-4 font-semibold">Connect your first product</p><p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">Create a project to access identity, entitlements, webhooks, and integration credentials.</p></div></div>}
        </div>
      </section>
    </main>
  );
}
