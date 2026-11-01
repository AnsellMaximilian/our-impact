import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CircleCheck, Code2, Plus, Settings2, ShieldCheck } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

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
      <main className="mx-auto grid min-h-[calc(100vh-76px)] max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_0.85fr] lg:px-8">
        <section>
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">
            One quick setup
          </p>
          <h1 className="display-type max-w-2xl text-5xl font-semibold leading-[1.02] sm:text-6xl">
            Create the company workspace behind your campaigns.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
            You’ll become the owner. The database trigger creates the membership atomically, and RLS keeps every future campaign inside this workspace.
          </p>
          <div className="mt-8 max-w-xl rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
            <OnboardingForm />
          </div>
        </section>
        <Image
          src="/brand/luma-firefly.png"
          alt="Luma, the Our Impact firefly mascot"
          width={620}
          height={620}
          className="mx-auto h-auto w-full max-w-md drop-shadow-[0_28px_34px_rgba(16,38,63,0.15)]"
          priority
        />
      </main>
    );
  }

  const [{ data: company }, { data: campaigns }] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, public_name, slug")
      .eq("id", membership.company_id)
      .single(),
    supabase
      .from("campaigns")
      .select("id, title, summary, budget_minor, currency, period_cadence, status, public_id, created_at")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      {(created === "1" || deleted === "1") && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl bg-mint/15 px-5 py-4 text-sm text-mint-dark ring-1 ring-mint/35" role="status">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>{created === "1" ? "Your draft campaign is safely stored in Supabase." : "The private draft was deleted."}</span>
        </div>
      )}

      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
            <ShieldCheck className="size-4 text-mint-dark" aria-hidden="true" />
            {membership.role} · tenant-isolated workspace
          </div>
          <h1 className="display-type text-4xl font-semibold sm:text-5xl">
            {company?.public_name ?? company?.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-soft">
            Create and publish community campaigns, then follow live votes and allocation previews from one tenant-isolated workspace.
          </p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white shadow-[0_10px_24px_rgba(16,38,63,0.18)] transition hover:-translate-y-0.5 hover:bg-ink/90"
        >
          <Plus className="size-4" aria-hidden="true" />
          New draft campaign
        </Link>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Campaigns</p>
              <h2 className="mt-1 text-2xl font-semibold">Your workspace</h2>
            </div>
            <span className="rounded-full bg-ink/5 px-3 py-1.5 text-sm font-semibold text-ink-soft">
              {campaigns?.length ?? 0} total
            </span>
          </div>

          {campaigns?.length ? (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <article key={campaign.id} className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{campaign.title}</h3>
                        <span className="rounded-full bg-sun/25 px-2.5 py-1 text-xs font-bold capitalize text-ink">
                          {campaign.status}
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">{campaign.summary}</p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="font-semibold">{formatMoney(campaign.budget_minor, campaign.currency)}</p>
                      <p className="text-xs capitalize text-ink-soft">
                        per {campaign.period_cadence === "weekly" ? "week" : "day"}
                      </p>
                      <Link
                        href={`/dashboard/campaigns/${campaign.id}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-dark hover:text-ink"
                      >
                        <Settings2 className="size-4" aria-hidden="true" /> Manage
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-paper/50 px-6 py-12 text-center">
              <p className="font-semibold">No campaigns yet</p>
              <p className="mt-2 text-sm text-ink-soft">Create a draft, shape its rules, then publish when it is ready.</p>
            </div>
          )}
        </div>

        <aside className="rounded-[2rem] bg-ink p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">Product baseline</p>
          <h2 className="mt-3 text-2xl font-semibold">Recipients + developer roles</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Curate fictional recipients, then prove the complete identity, donation-event, entitlement, and webhook loop in a Local Shop demo.
          </p>
          <Link
            href="/dashboard/organizations"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint"
          >
            <Building2 className="size-4" aria-hidden="true" />
            Manage recipients
          </Link>
          <div className="mt-8 border-t border-white/15 pt-6">
            <p className="text-sm font-semibold text-mint">Developer milestone</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Issue short-lived user identity tokens and query deterministic roles without exposing server credentials in the browser.
            </p>
            <Link href="/dashboard/developers" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-mint">
              <Code2 className="size-4" /> Open developer tools <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
