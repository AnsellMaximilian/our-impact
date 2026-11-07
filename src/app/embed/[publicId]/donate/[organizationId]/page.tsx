import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ExternalLink } from "lucide-react";
import { PayPalDonate } from "@/components/paypal-donate";
import { getPayPalPlatformConfiguration } from "@/lib/paypal/platform";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support a curated payee" };

export default async function DonatePage({
  params,
}: {
  params: Promise<{ publicId: string; organizationId: string }>;
}) {
  const { publicId, organizationId: rawOrganizationId } = await params;
  const organizationId = Number(rawOrganizationId);
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) notFound();

  const supabase = createPrivilegedClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, summary, currency, companies(public_name)")
    .eq("public_id", publicId)
    .eq("status", "published")
    .maybeSingle();
  if (!campaign) notFound();

  const [{ data: slateItem }, { data: recipients }] = await Promise.all([
    supabase
      .from("campaign_organizations")
      .select("organizations(id, name, short_description, category, brand_color)")
      .eq("campaign_id", campaign.id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase.rpc("get_campaign_paypal_recipients", { p_public_id: publicId }),
  ]);
  const organization = slateItem?.organizations;
  if (!organization) notFound();
  const recipient = recipients?.find(
    (item) => item.organization_id === organizationId,
  );
  const platform = getPayPalPlatformConfiguration();
  const ready = Boolean(
    recipient?.merchant_id &&
      platform.checkoutReady &&
      platform.clientId &&
      platform.attributionId,
  );

  return (
    <main className="border-t-4 border-mint bg-surface">
      <div className="px-5 py-5 sm:px-7">
        <Link
          href={`/embed/${publicId}`}
          className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to campaign
        </Link>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
              <BadgeCheck className="size-4" aria-hidden="true" /> Consented recipient
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
              {campaign.companies?.public_name ?? "Community campaign"}
            </p>
            <h1 className="display-type mt-2 text-3xl font-semibold sm:text-4xl">
              Support {organization.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-soft">
              Donate directly through PayPal. Your contribution goes to the recipient’s connected account.
            </p>
            <p className="mt-5 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
          </section>

          {ready ? (
            <PayPalDonate
              publicId={publicId}
              organizationId={organizationId}
              organizationName={organization.name}
              merchantId={recipient!.merchant_id!}
              clientId={platform.clientId!}
              attributionId={platform.attributionId!}
            />
          ) : (
            <div className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
              <p className="font-semibold">Checkout is not available yet.</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                This recipient must finish PayPal Sandbox consent and pass the Our Impact curation check first.
              </p>
            </div>
          )}
        </div>
      </div>
      <footer className="flex items-center justify-between gap-4 border-t border-line bg-paper/60 px-5 py-3 text-xs text-ink-soft sm:px-7">
        <span className="inline-flex items-center gap-2 font-semibold"><Image src="/brand/our-impact-mark.png" alt="" width={24} height={24} className="size-5 rounded-full" /> Powered by Our Impact</span>
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 font-semibold text-mint-dark">About Our Impact <ExternalLink className="size-3" /></Link>
      </footer>
    </main>
  );
}
