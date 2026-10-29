import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Brand } from "@/components/brand";
import { VoteWidget } from "@/components/vote-widget";
import { formatMoney } from "@/lib/money";
import { createPublicClient } from "@/lib/supabase/public";

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
  const supabase = createPublicClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select(
      "id, title, summary, budget_minor, currency, period_cadence, allocation_model, timezone, companies(public_name)",
    )
    .eq("public_id", publicId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !campaign) return null;

  const [{ data: slate, error: slateError }, { data: voteResults, error: resultsError }] =
    await Promise.all([
      supabase
        .from("campaign_organizations")
        .select(
          "display_order, organizations(id, name, short_description, category, brand_color, verification_state)",
        )
        .eq("campaign_id", campaign.id)
        .order("display_order"),
      supabase.rpc("get_campaign_vote_results", { p_public_id: publicId }),
    ]);

  if (slateError || resultsError) return null;

  return {
    campaign: campaign as PublicCampaign,
    slate: (slate ?? []) as SlateItem[],
    voteResults: voteResults ?? [],
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

  const { campaign, slate, voteResults } = result;
  const cadenceLabel = campaign.period_cadence === "weekly" ? "week" : "day";
  const resultByOrganization = new Map(
    voteResults.map((row) => [row.organization_id, row.vote_count]),
  );
  const period = voteResults[0] ?? null;
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
        }]
      : [],
  );

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-ink/8 bg-surface/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Brand />
          <span className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Published campaign
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="overflow-hidden rounded-[2.25rem] bg-surface shadow-[0_28px_70px_rgba(16,38,63,0.11)] ring-1 ring-ink/8">
          <div className="grid gap-8 bg-ink p-7 text-white sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
                {campaign.companies?.public_name ?? "A participating company"} has committed
              </p>
              <h1 className="display-type mt-4 max-w-3xl text-4xl font-semibold leading-[1.03] sm:text-6xl">
                {campaign.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                {campaign.summary}
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 px-6 py-5 ring-1 ring-white/15">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Committed</p>
              <p className="mt-1 text-3xl font-semibold">
                {formatMoney(campaign.budget_minor, campaign.currency)}
              </p>
              <p className="mt-1 text-sm text-white/65">each {cadenceLabel}</p>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <VoteWidget
              publicId={publicId}
              organizations={voteOrganizations}
              totalVotes={period?.total_votes ?? 0}
              votingOpen={period?.period_status === "open"}
              closesAt={period?.closes_at ?? null}
              timezone={campaign.timezone}
            />

            <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-mint/12 p-5 text-sm leading-6 text-ink-soft ring-1 ring-mint/25 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong className="text-ink">Transparent by design:</strong> committed is not the same as allocated or paid. Voting results guide a preview; no money moves in this stage.
              </p>
              <Link href="/" className="inline-flex shrink-0 items-center gap-1 font-semibold text-mint-dark hover:text-ink">
                About Our Impact <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-ink-soft">
          <Image src="/brand/our-impact-mark.png" alt="" width={32} height={32} className="size-7 rounded-full" />
          Powered by Our Impact · community voting preview
        </div>
      </div>
    </main>
  );
}
