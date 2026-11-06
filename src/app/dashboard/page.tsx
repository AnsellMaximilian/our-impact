import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CircleCheck, Code2, HeartHandshake, Megaphone, Plus, Settings2, Sparkles, UsersRound } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ created?: string; deleted?: string }> }) {
  const { created, deleted } = await searchParams;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("memberships").select("company_id, role").limit(1).maybeSingle();

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

  const [{ data: company }, { data: campaigns }, { count: recipientCount }, { count: projectCount }] = await Promise.all([
    supabase.from("companies").select("id, name, public_name, slug").eq("id", membership.company_id).single(),
    supabase.from("campaigns").select("id, title, summary, budget_minor, currency, period_cadence, status, public_id, created_at").eq("company_id", membership.company_id).order("created_at", { ascending: false }),
    supabase.from("workspace_recipients").select("organization_id", { count: "exact", head: true }).eq("company_id", membership.company_id),
    supabase.from("developer_projects").select("id", { count: "exact", head: true }).eq("company_id", membership.company_id),
  ]);

  const publishedCount = campaigns?.filter((campaign) => campaign.status === "published").length ?? 0;
  const totalBudgetMinor = campaigns?.reduce((total, campaign) => total + campaign.budget_minor, 0) ?? 0;
  const currency = campaigns?.[0]?.currency ?? "USD";
  const companyName = company?.public_name ?? company?.name ?? "Your workspace";
  const stats = [
    { label: "Active campaigns", value: String(publishedCount), icon: Megaphone, accent: "bg-mint/18 text-mint-dark" },
    { label: "Recipient partners", value: String(recipientCount ?? 0), icon: HeartHandshake, accent: "bg-coral/12 text-coral-dark" },
    { label: "Campaign commitments", value: formatMoney(totalBudgetMinor, currency), icon: Sparkles, accent: "bg-sun/22 text-ink" },
    { label: "Connected products", value: String(projectCount ?? 0), icon: Code2, accent: "bg-ink/7 text-ink" },
  ];

  return (
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      {(created === "1" || deleted === "1") && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-mint/15 px-5 py-4 text-sm font-semibold text-mint-dark ring-1 ring-mint/30" role="status">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>{created === "1" ? "Campaign created. You can review the details before publishing." : "Campaign deleted."}</span>
        </div>
      )}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-soft">Welcome back</p>
          <h1 className="display-type mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">{companyName}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-ink-soft">Manage every campaign, recipient relationship, and customer experience from one place.</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,38,63,0.16)] transition hover:-translate-y-0.5 hover:bg-ink/92"><Plus className="size-4" aria-hidden="true" /> New campaign</Link>
      </header>
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace summary">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <article key={label} className="dashboard-card rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-ink-soft">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${accent}`}><Icon className="size-5" aria-hidden="true" /></span></div></article>
        ))}
      </section>
      <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div id="campaigns" className="dashboard-card overflow-hidden rounded-[1.75rem] scroll-mt-6">
          <div className="flex items-center justify-between gap-4 border-b border-ink/8 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Campaigns</p><h2 className="mt-1 text-2xl font-semibold">Community commitments</h2></div><span className="rounded-full bg-ink/5 px-3 py-1.5 text-xs font-bold text-ink-soft">{campaigns?.length ?? 0} total</span></div>
          {campaigns?.length ? (
            <div className="divide-y divide-ink/8">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="group grid gap-4 px-5 py-5 transition hover:bg-paper/55 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{campaign.title}</h3><span className={campaign.status === "published" ? "rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold capitalize text-mint-dark" : "rounded-full bg-sun/22 px-2.5 py-1 text-[11px] font-bold capitalize text-ink"}>{campaign.status}</span></div><p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-ink-soft">{campaign.summary}</p></div>
                  <div className="flex items-center justify-between gap-5 lg:justify-end"><div className="text-right"><p className="font-semibold">{formatMoney(campaign.budget_minor, campaign.currency)}</p><p className="text-xs capitalize text-ink-soft">per {campaign.period_cadence === "weekly" ? "week" : "day"}</p></div><Link href={`/dashboard/campaigns/${campaign.id}`} aria-label={`Manage ${campaign.title}`} className="grid size-10 place-items-center rounded-xl border border-line bg-white text-ink-soft transition group-hover:border-ink/20 group-hover:text-ink"><Settings2 className="size-4" aria-hidden="true" /></Link></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center"><Megaphone className="mx-auto size-7 text-coral-dark" /><p className="mt-3 font-semibold">Create your first campaign</p><p className="mt-2 text-sm text-ink-soft">Turn a community commitment into a clear, participatory program.</p></div>
          )}
        </div>
        <aside className="relative min-h-[430px] overflow-hidden rounded-[1.75rem] bg-[#dcebd9] p-6 ring-1 ring-ink/8 sm:p-7">
          <div className="relative z-10"><p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Community program</p><h2 className="display-type mt-3 text-3xl font-semibold leading-tight">Build the relationships around every contribution.</h2><p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">Invite trusted recipients, then connect your website so customers can see the impact they helped create.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/dashboard/organizations" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white"><Building2 className="size-4" /> Recipients</Link><Link href="/dashboard/developers" className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-ink/8"><UsersRound className="size-4" /> Integrations</Link></div></div>
          <Image src="/illustrations/hero-botanical-landscape.png" alt="A flourishing community landscape" width={1400} height={700} className="absolute inset-x-0 bottom-0 h-auto w-full object-cover object-bottom" />
        </aside>
      </section>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-ink-soft"><span>Every recipient controls their own PayPal connection.</span><Link href="/developers/docs" className="inline-flex items-center gap-1.5 font-semibold text-ink">View integration guide <ArrowRight className="size-3.5" /></Link></footer>
    </main>
  );
}
