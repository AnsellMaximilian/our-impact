import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, LockKeyhole, Vote } from "lucide-react";
import { Brand } from "@/components/brand";
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
      "id, title, summary, budget_minor, currency, period_cadence, allocation_model, companies(public_name)",
    )
    .eq("public_id", publicId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !campaign) return null;

  const { data: slate, error: slateError } = await supabase
    .from("campaign_organizations")
    .select(
      "display_order, organizations(id, name, short_description, category, brand_color, verification_state)",
    )
    .eq("campaign_id", campaign.id)
    .order("display_order");

  if (slateError) return null;

  return {
    campaign: campaign as PublicCampaign,
    slate: (slate ?? []) as SlateItem[],
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

  const { campaign, slate } = result;
  const cadenceLabel = campaign.period_cadence === "weekly" ? "week" : "day";

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-ink/8 bg-surface/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Brand />
          <span className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Published mock
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Community slate</p>
                <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Where should the commitment go?</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">All organizations below are fictional Stage 0 data.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm font-semibold text-ink-soft">
                <LockKeyhole className="size-4" aria-hidden="true" /> Voting not open yet
              </span>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {slate.map(({ display_order, organizations: organization }) =>
                organization ? (
                  <article key={organization.id} className="relative overflow-hidden rounded-3xl border border-line bg-white p-5">
                    <span
                      className="absolute inset-y-0 left-0 w-1.5"
                      style={{ backgroundColor: organization.brand_color }}
                    />
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: organization.brand_color }}
                      >
                        {display_order}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                        {organization.category}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{organization.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
                    <button
                      type="button"
                      disabled
                      className="mt-5 inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-ink/5 text-sm font-semibold text-ink/45"
                    >
                      <Vote className="size-4" aria-hidden="true" /> Vote in Stage 1
                    </button>
                  </article>
                ) : null,
              )}
            </div>

            <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-mint/12 p-5 text-sm leading-6 text-ink-soft ring-1 ring-mint/25 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong className="text-ink">Transparent by design:</strong> committed is not the same as allocated or paid. This prototype intentionally shows only the commitment.
              </p>
              <Link href="/" className="inline-flex shrink-0 items-center gap-1 font-semibold text-mint-dark hover:text-ink">
                About Our Impact <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-ink-soft">
          <Image src="/brand/our-impact-mark.png" alt="" width={32} height={32} className="size-7 rounded-full" />
          Powered by Our Impact · foundation preview
        </div>
      </div>
    </main>
  );
}
