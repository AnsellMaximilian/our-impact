import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Info,
  Users,
} from "lucide-react";
import { CampaignControls } from "@/components/campaign-controls";
import { CampaignForm } from "@/components/campaign-form";
import { EmbedSnippet } from "@/components/embed-snippet";
import { previewAllocation, type AllocationModel } from "@/lib/allocation";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage campaign" };

const modelLabels: Record<string, string> = {
  winner_takes_all: "Winner takes all",
  proportional: "Proportional to votes",
  hybrid: "10% base each + proportional remainder",
};

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(value));
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    published?: string;
    status?: string;
    error?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const [organizationsResult, slateResult, periodsResult, resultsResult] = await Promise.all([
    supabase.from("organizations").select("*").order("id"),
    supabase
      .from("campaign_organizations")
      .select("organization_id, display_order")
      .eq("campaign_id", campaign.id)
      .order("display_order"),
    supabase
      .from("campaign_periods")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("sequence_number", { ascending: false }),
    campaign.status === "draft"
      ? Promise.resolve({ data: [], error: null })
      : supabase.rpc("get_campaign_vote_results", { p_public_id: campaign.public_id }),
  ]);

  const organizations = organizationsResult.data ?? [];
  const slate = slateResult.data ?? [];
  const periods = periodsResult.data ?? [];
  const voteResults = resultsResult.data ?? [];
  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  const resultByOrganization = new Map(
    voteResults.map((item) => [item.organization_id, item.vote_count]),
  );
  const allocationInputs = slate.map((item, index) => ({
    organizationId: item.organization_id,
    votes:
      campaign.status === "draft"
        ? [50, 30, 20, 10, 5][index] ?? 1
        : resultByOrganization.get(item.organization_id) ?? 0,
  }));
  const allocation = previewAllocation(
    campaign.allocation_model as AllocationModel,
    campaign.budget_minor,
    allocationInputs,
  );
  const totalVotes = allocationInputs.reduce((sum, item) => sum + item.votes, 0);
  const currentPeriod = periods[0] ?? null;
  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://our-impact.vercel.app").replace(/\/$/, "");
  const publicUrl = `${siteOrigin}/embed/${campaign.public_id}`;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to dashboard
      </Link>

      {(query.saved === "1" || query.published === "1" || query.status) && (
        <div className="mt-6 rounded-2xl bg-mint/15 px-5 py-4 text-sm font-semibold text-mint-dark ring-1 ring-mint/35" role="status">
          {query.saved === "1" && "Draft changes saved."}
          {query.published === "1" && "Campaign published. Public voting is now open."}
          {query.status === "paused" && "Public voting is paused."}
          {query.status === "published" && "Public voting resumed."}
        </div>
      )}
      {query.error && (
        <div className="mt-6 rounded-2xl bg-coral/10 px-5 py-4 text-sm font-semibold text-coral-dark ring-1 ring-coral/25" role="alert">
          {query.error}
        </div>
      )}

      <section className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-sun/25 px-3 py-1.5 text-xs font-bold capitalize text-ink">
            {campaign.status}
          </span>
          <h1 className="display-type mt-4 text-4xl font-semibold sm:text-6xl">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-soft">{campaign.summary}</p>
        </div>
        <CampaignControls campaignId={campaign.id} status={campaign.status} />
      </section>

      {campaign.status === "draft" ? (
        <div className="mt-10">
          <CampaignForm
            organizations={organizations}
            campaign={campaign}
            selectedOrganizationIds={slate.map((item) => item.organization_id)}
          />
          <div className="mt-6 rounded-2xl bg-sun/15 p-5 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
            Save any changes before publishing. Publishing freezes this campaign’s first budget, allocation model, and voting period.
          </div>
          <div className="mt-6">
            <CampaignControls campaignId={campaign.id} status={campaign.status} />
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Current period</p>
                <h2 className="mt-2 text-2xl font-semibold">Voting and allocation preview</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-3 py-2 text-sm font-semibold capitalize text-ink-soft">
                <Activity className="size-4 text-mint-dark" aria-hidden="true" /> {currentPeriod?.status ?? "not started"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-ink p-5 text-white">
                <Users className="size-5 text-mint" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold">{totalVotes}</p>
                <p className="text-sm text-white/65">accepted votes</p>
              </div>
              <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
                <BarChart3 className="size-5 text-coral-dark" aria-hidden="true" />
                <p className="mt-4 text-lg font-semibold">{modelLabels[campaign.allocation_model]}</p>
                <p className="text-sm text-ink-soft">allocation model</p>
              </div>
              <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
                <CalendarClock className="size-5 text-mint-dark" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold">
                  {currentPeriod ? formatDate(currentPeriod.closes_at, campaign.timezone) : "Not scheduled"}
                </p>
                <p className="text-sm text-ink-soft">period closes</p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {allocation.lines.map((line) => {
                const organization = organizationById.get(line.organizationId);
                const percentage = totalVotes ? Math.round((line.votes / totalVotes) * 100) : 0;
                return (
                  <div key={line.organizationId} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{organization?.name ?? "Organization"}</p>
                        <p className="mt-1 text-xs text-ink-soft">{line.votes} votes · {percentage}%</p>
                      </div>
                      <p className="font-semibold">{formatMoney(line.amountMinor, campaign.currency)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/8">
                      <div className="h-full rounded-full bg-mint-dark" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {allocation.requiresReview && (
              <div className="mt-5 flex gap-3 rounded-2xl bg-sun/15 p-4 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
                <Info className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
                No votes yet, so the commitment remains unallocated and needs review. No money moves in Stage 1.
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[2rem] bg-ink p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">Public widget</p>
              <p className="mt-3 text-sm leading-6 text-white/70">Share the direct link or embed the same voting experience on another website.</p>
              <Link href={publicUrl} target="_blank" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-mint">
                Open public campaign <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            </section>
            <EmbedSnippet publicUrl={publicUrl} />
            <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8">
              <p className="text-sm font-semibold">Campaign rules</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Commitment</dt><dd className="font-semibold">{formatMoney(campaign.budget_minor, campaign.currency)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Cadence</dt><dd className="font-semibold capitalize">{campaign.period_cadence}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Time zone</dt><dd className="font-semibold">{campaign.timezone}</dd></div>
              </dl>
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
