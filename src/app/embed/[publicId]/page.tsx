import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PublicLedger } from "@/components/public-ledger";
import { VoteWidget } from "@/components/vote-widget";
import {
  calculateCampaignLifetimeTotals,
  type LifetimeDonation,
  type LifetimeSnapshot,
} from "@/lib/campaign-lifetime";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const dynamic = "force-dynamic";

type PublicCampaign = {
  id: string;
  title: string;
  summary: string;
  budget_minor: number;
  currency: string;
  period_cadence: string;
  allocation_model: string;
  timezone: string;
  companies: { public_name: string } | null;
};

type SlateItem = {
  display_order: number;
  organizations: {
    id: number;
    name: string;
    short_description: string;
    category: string;
    brand_color: string;
    verification_state: string;
  } | null;
};

async function getPublicCampaign(publicId: string) {
  // Public pages are assembled server-side. Keep the service credential on the
  // server and retain the explicit published-status boundary on every lookup.
  const supabase = createPrivilegedClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select(
      "id, title, summary, budget_minor, currency, period_cadence, allocation_model, timezone, status, companies(public_name)",
    )
    .eq("public_id", publicId)
    .maybeSingle();

  if (error || !campaign || campaign.status !== "published") {
    console.error("Could not find the published campaign", {
      publicId,
      campaignStatus: campaign?.status ?? null,
      error,
    });
    return null;
  }

  const [
    { data: slate, error: slateError },
    { data: voteResults, error: resultsError },
    { data: ledgerRows, error: ledgerError },
    { data: paypalRecipients, error: paypalRecipientsError },
    { data: snapshots, error: snapshotsError },
    { data: lifetimeDonations, error: lifetimeDonationsError },
  ] =
    await Promise.all([
      supabase
        .from("campaign_organizations")
        .select(
          "display_order, organizations(id, name, short_description, category, brand_color, verification_state)",
        )
        .eq("campaign_id", campaign.id)
        .order("display_order"),
      supabase.rpc("get_campaign_vote_results", { p_public_id: publicId }),
      supabase.rpc("get_campaign_public_ledger", { p_public_id: publicId }),
      supabase.rpc("get_campaign_paypal_recipients", {
        p_public_id: publicId,
      }),
      supabase
        .from("allocation_snapshots")
        .select("period_id, revision, budget_minor, allocated_minor")
        .eq("campaign_id", campaign.id),
      supabase
        .from("donation_records")
        .select("organization_id, amount_minor, environment")
        .eq("campaign_id", campaign.id)
        .eq("status", "confirmed_paid")
        .in("environment", ["live", "sandbox"]),
    ]);

  if (slateError || resultsError || ledgerError || snapshotsError || lifetimeDonationsError) {
    console.error("Could not load the public campaign", {
      slateError,
      resultsError,
      ledgerError,
      snapshotsError,
      lifetimeDonationsError,
    });
    return null;
  }
  if (paypalRecipientsError) {
    console.error("Could not load PayPal recipients", {
      publicId,
      code: paypalRecipientsError.code,
    });
  }

  return {
    campaign: campaign as PublicCampaign,
    slate: (slate ?? []) as SlateItem[],
    voteResults: voteResults ?? [],
    ledgerRows: ledgerRows ?? [],
    paypalRecipients: paypalRecipients ?? [],
    lifetime: calculateCampaignLifetimeTotals(
      (snapshots ?? []) as LifetimeSnapshot[],
      (lifetimeDonations ?? []) as LifetimeDonation[],
    ),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const result = await getPublicCampaign(publicId);

  return result
    ? {
        title: result.campaign.title,
        description: result.campaign.summary,
      }
    : { title: "Campaign not found" };
}

export default async function PublicCampaignPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const result = await getPublicCampaign(publicId);

  if (!result) notFound();

  const { campaign, slate, voteResults, ledgerRows, paypalRecipients, lifetime } = result;
  const cadenceLabel = campaign.period_cadence === "weekly" ? "week" : "day";
  const resultByOrganization = new Map(
    voteResults.map((row) => [row.organization_id, row.vote_count]),
  );
  const period = voteResults[0] ?? null;
  const connectedRecipientIds = new Set(
    paypalRecipients.map((recipient) => recipient.organization_id),
  );
  const voteOrganizations = slate.flatMap(({ display_order, organizations }) =>
    organizations
      ? [{
          id: organizations.id,
          name: organizations.name,
          shortDescription: organizations.short_description,
          category: organizations.category,
          brandColor: organizations.brand_color,
          displayOrder: display_order,
          voteCount: resultByOrganization.get(organizations.id) ?? 0,
          donationEnabled: connectedRecipientIds.has(organizations.id),
        }]
      : [],
  );
  const organizationNames = new Map(
    slate.flatMap(({ organizations }) =>
      organizations ? [[organizations.id, organizations.name] as const] : [],
    ),
  );

  return (
    <main className="bg-surface">
      <section className="overflow-hidden border-t-4 border-mint bg-surface">
          <header className="relative isolate overflow-hidden border-b border-line px-5 py-6 sm:px-7">
            <div className="relative z-10 max-w-4xl sm:pr-[24%]">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">
                {campaign.companies?.public_name ?? "Community campaign"}
              </p>
              <h1 className="display-type mt-2 max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">
                {campaign.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
                {campaign.summary}
              </p>
            </div>
            <div className="absolute inset-y-0 right-0 hidden w-[34%] sm:block" aria-hidden="true">
              <div className="absolute inset-0 z-10 bg-gradient-to-r from-surface via-surface/40 to-transparent" />
              <Image src="/illustrations/hero-botanical-landscape.png" alt="" fill sizes="34vw" priority className="object-contain object-right-bottom opacity-75" />
            </div>
          </header>

          <PublicLedger
            rows={ledgerRows}
            organizationNames={organizationNames}
            committedMinor={campaign.budget_minor}
            currency={campaign.currency}
            cadenceLabel={cadenceLabel}
            lifetime={lifetime}
          />

          <div className="px-5 py-6 sm:px-7">
            <VoteWidget
              publicId={publicId}
              organizations={voteOrganizations}
              totalVotes={period?.total_votes ?? 0}
              votingOpen={period?.period_status === "open"}
              closesAt={period?.closes_at ?? null}
              timezone={campaign.timezone}
            />

          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-line bg-paper/60 px-5 py-3 text-xs text-ink-soft sm:px-7">
            <span className="inline-flex items-center gap-2 font-semibold">
              <Image src="/brand/our-impact-mark.png" alt="" width={24} height={24} className="size-5 rounded-full" />
              Powered by Our Impact
            </span>
            <Link href="/" target="_blank" className="inline-flex items-center gap-1 font-semibold text-mint-dark hover:text-ink">
              About Our Impact <ExternalLink className="size-3" />
            </Link>
          </footer>
      </section>
    </main>
  );
}
