import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CircleCheck,
  Code2,
  HeartHandshake,
  Megaphone,
  Plus,
  Settings2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { CampaignAssistant } from "@/components/campaign-assistant";
import { OnboardingForm } from "@/components/onboarding-form";
import { getOpenRouterConfiguration } from "@/lib/ai/openrouter";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; deleted?: string }>;
}) {
  const { created, deleted } = await searchParams;
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="grid min-h-screen items-center gap-10 px-6 py-12 lg:grid-cols-[1fr_0.85fr] lg:px-14">
        <section className="mx-auto max-w-xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Create your workspace</p>
          <h1 className="display-type mt-3 text-5xl font-semibold leading-[1.02] sm:text-6xl">A home for your community giving.</h1>
          <p className="mt-5 text-lg leading-8 text-ink-soft">Set up the organization your team will use to manage campaigns, recipients, and customer rewards.</p>
          <div className="dashboard-card mt-8 rounded-[2rem] p-6 sm:p-8"><OnboardingForm /></div>
        </section>
        <Image src="/brand/luma-firefly.png" alt="Luma, the Our Impact firefly mascot" width={620} height={620} className="mx-auto h-auto w-full max-w-md" priority />
      </main>
    );
  }

  const [{ data: company }, { data: campaigns }, { data: recipientRelationships, count: recipientCount }, { count: projectCount }] = await Promise.all([
    supabase.from("companies").select("id, name, public_name, slug").eq("id", membership.company_id).single(),
    supabase.from("campaigns").select("id, title, summary, budget_minor, currency, period_cadence, status, public_id, created_at").eq("company_id", membership.company_id).order("created_at", { ascending: false }),
    supabase.from("workspace_recipients").select("organization_id", { count: "exact" }).eq("company_id", membership.company_id).eq("relationship_state", "active"),
    supabase.from("developer_projects").select("id", { count: "exact", head: true }).eq("company_id", membership.company_id),
  ]);
  const recipientIds = (recipientRelationships ?? []).map((relationship) => relationship.organization_id);
  const { data: organizations } = recipientIds.length
    ? await supabase.from("organizations").select("*").in("id", recipientIds).eq("is_active", true).order("name")
    : { data: [] };
  const openRouter = getOpenRouterConfiguration();
  const assistantAvailable = ["owner", "admin"].includes(membership.role) && (organizations?.length ?? 0) >= 2;

  const publishedCount = campaigns?.filter((campaign) => campaign.status === "published").length ?? 0;
  const totalBudgetMinor = campaigns?.reduce((total, campaign) => total + campaign.budget_minor, 0) ?? 0;
  const largestBudgetMinor = Math.max(...(campaigns ?? []).map((campaign) => campaign.budget_minor), 1);
  const currency = campaigns?.[0]?.currency ?? "USD";
  const companyName = company?.public_name ?? company?.name ?? "Your workspace";
  const snapshot = [
    { label: "Active campaigns", value: String(publishedCount), icon: Megaphone },
    { label: "Recipients", value: String(recipientCount ?? 0), icon: HeartHandshake },
    { label: "Projects", value: String(projectCount ?? 0), icon: Code2 },
  ];

  return (
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      {(created === "1" || deleted === "1") && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-mint/15 px-5 py-4 text-sm font-semibold text-mint-dark ring-1 ring-mint/30" role="status">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>{created === "1" ? "Campaign created. You can review the details before publishing." : "Campaign deleted."}</span>
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)]">
        <div className="dashboard-card relative min-h-[390px] overflow-hidden rounded-[1.75rem] p-6 sm:p-8 lg:p-9">
          <div className="relative z-10 max-w-2xl">
            <p className="text-sm font-semibold text-ink-soft">Welcome back</p>
            <h1 className="display-type mt-2 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{companyName}</h1>
            <p className="mt-3 max-w-sm text-base leading-7 text-ink-soft sm:max-w-md">Manage every campaign, recipient relationship, and customer experience from one place.</p>
            <Link href="/dashboard/campaigns/new" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-mint px-5 text-sm font-semibold text-ink shadow-[0_10px_24px_rgba(31,114,93,0.16)] transition hover:-translate-y-0.5 hover:bg-mint/85"><Plus className="size-4" aria-hidden="true" /> New campaign</Link>
          </div>
          <Image src="/illustrations/hero-botanical-landscape.png" alt="" width={1400} height={700} priority className="absolute inset-x-0 bottom-0 h-auto w-full object-contain object-bottom" />
        </div>

        <aside className="dashboard-card rounded-[1.75rem] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Workspace snapshot</p>
          <div className="mt-3 flex items-end gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-coral/12 text-coral-dark"><Sparkles className="size-6" /></span>
            <div><p className="text-4xl font-semibold tracking-tight sm:text-5xl">{formatMoney(totalBudgetMinor, currency)}</p><p className="mt-1 text-sm text-ink-soft">in recurring campaign commitments</p></div>
          </div>
          <div className="mt-7 grid grid-cols-3 divide-x divide-ink/12 border-y border-ink/12 py-5">
            {snapshot.map(({ label, value, icon: Icon }) => <div key={label} className="px-3 first:pl-0 last:pr-0"><Icon className="size-5 text-mint-dark" /><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-ink-soft">{label}</p></div>)}
          </div>
          <div className="mt-6">
            <div className="flex items-center justify-between"><h2 className="text-base font-semibold">Campaign commitments</h2><span className="text-xs font-semibold text-ink-soft">per period</span></div>
            <div className="mt-4 space-y-4">
              {(campaigns ?? []).slice(0, 3).map((campaign, index) => (
                <div key={campaign.id}>
                  <div className="flex items-center justify-between gap-4 text-xs"><span className="truncate font-semibold">{campaign.title}</span><span className="shrink-0 text-ink-soft">{formatMoney(campaign.budget_minor, campaign.currency)}</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8"><div className={index % 2 === 0 ? "h-full rounded-full bg-mint-dark" : "h-full rounded-full bg-coral"} style={{ width: `${Math.max(12, Math.round((campaign.budget_minor / largestBudgetMinor) * 100))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section id="campaigns" className="mt-8 scroll-mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Campaigns</p><h2 className="display-type mt-1 text-3xl font-semibold">Your campaigns</h2></div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-ink-soft ring-1 ring-ink/12">{campaigns?.length ?? 0} total</span>
            <Link href="/dashboard/organizations" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"><Building2 className="size-4" /> Recipients</Link>
            <Link href="/dashboard/developers" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-ink/12"><UsersRound className="size-4" /> Integrations</Link>
          </div>
        </div>
        <div className={assistantAvailable ? "mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(360px,0.86fr)] xl:items-start" : "mt-5"}>
          <div className="space-y-4">
            {campaigns?.length ? campaigns.map((campaign, index) => (
              <article key={campaign.id} className="dashboard-card group grid gap-4 rounded-[1.5rem] p-4 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center">
                <div className="relative h-28 overflow-hidden rounded-2xl bg-[#e3eee3]"><Image src={index % 2 === 0 ? "/illustrations/thumbnail-community-garden.png" : "/illustrations/thumbnail-food-bank-fields.png"} alt="" fill sizes="150px" className="object-contain p-2" /></div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{campaign.title}</h3><span className={campaign.status === "published" ? "rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold capitalize text-mint-dark" : "rounded-full bg-sun/22 px-2.5 py-1 text-[11px] font-bold capitalize text-ink"}>{campaign.status}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">{campaign.summary}</p></div>
                <div className="flex items-center justify-between gap-4 sm:block sm:text-right"><div><p className="font-semibold">{formatMoney(campaign.budget_minor, campaign.currency)}</p><p className="text-xs capitalize text-ink-soft">per {campaign.period_cadence === "weekly" ? "week" : "day"}</p></div><Link href={`/dashboard/campaigns/${campaign.id}`} aria-label={`Manage ${campaign.title}`} className="mt-3 inline-grid size-10 place-items-center rounded-xl border border-ink/14 bg-white text-ink-soft transition group-hover:border-ink/25 group-hover:text-ink"><Settings2 className="size-4" aria-hidden="true" /></Link></div>
              </article>
            )) : <div className="dashboard-card rounded-[1.5rem] px-6 py-16 text-center"><Megaphone className="mx-auto size-7 text-coral-dark" /><p className="mt-3 font-semibold">Create your first campaign</p><p className="mt-2 text-sm text-ink-soft">Turn a community commitment into a clear, participatory program.</p></div>}
          </div>
          {assistantAvailable && (
            <aside className="xl:sticky xl:top-5">
              <CampaignAssistant
                organizations={organizations ?? []}
                ready={openRouter.ready}
                model={openRouter.model}
              />
            </aside>
          )}
        </div>
      </section>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-ink-soft"><span>Every recipient controls their own PayPal connection.</span><Link href="/developers/docs" className="inline-flex items-center gap-1.5 font-semibold text-ink">View integration guide <ArrowRight className="size-3.5" /></Link></footer>
    </main>
  );
}
