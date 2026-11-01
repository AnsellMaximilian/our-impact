import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { PayPalDonate } from "@/components/paypal-donate";
import { getPayPalPlatformConfiguration } from "@/lib/paypal/platform";
import { createPublicClient } from "@/lib/supabase/public";

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

  const supabase = createPublicClient();
  const [{ data: campaign }, { data: organization }, { data: recipients }] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select("id, title, summary, currency, companies(public_name)")
        .eq("public_id", publicId)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("organizations")
        .select("id, name, short_description, category, brand_color")
        .eq("id", organizationId)
        .maybeSingle(),
      supabase.rpc("get_campaign_paypal_recipients", {
        p_public_id: publicId,
      }),
    ]);

  if (!campaign || !organization) notFound();
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
    <main className="min-h-screen bg-paper">
      <header className="border-b border-ink/8 bg-surface/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Brand />
          <span className="inline-flex items-center gap-2 rounded-full bg-sun/20 px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-sun/30">
            PayPal Sandbox
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href={`/embed/${publicId}`}
          className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to campaign
        </Link>

        <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_26rem] lg:items-start">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
              <BadgeCheck className="size-4" aria-hidden="true" /> Consented recipient
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
              {campaign.companies?.public_name ?? "Community campaign"}
            </p>
            <h1 className="display-type mt-3 text-4xl font-semibold sm:text-6xl">
              Support {organization.name}
            </h1>
            <p className="mt-5 text-lg leading-8 text-ink-soft">
              {organization.short_description}
            </p>
            <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-ink/8">
              <p className="text-sm font-semibold">How this test works</p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-ink-soft">
                <li>1. A sandbox supporter approves the order in PayPal.</li>
                <li>2. PayPal captures directly for this consented merchant.</li>
                <li>3. Our Impact verifies the result and updates supporter roles.</li>
              </ol>
            </div>
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
    </main>
  );
}
