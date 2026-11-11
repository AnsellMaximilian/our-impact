import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitCompare, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Quickstart" };

const installBrowser = `pnpm add @our-impact/browser`;

const publicWidget = `"use client";

import { mountCampaign } from "@our-impact/browser";
import { useEffect, useRef } from "react";

export function CommunityCampaign({ publicId }: { publicId: string }) {
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target.current) return;

    const widget = mountCampaign({
      target: target.current,
      publicId,
      height: "auto",
    });

    return () => widget.destroy();
  }, [publicId]);

  return <div ref={target} />;
}`;

const installServer = `pnpm add @our-impact/node`;

const environment = `OUR_IMPACT_SECRET_KEY=oi_sk_test_...
NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY=oi_pk_test_...
NEXT_PUBLIC_OUR_IMPACT_CAMPAIGN_ID=your-public-campaign-id`;

const identityRoute = `import { OurImpactClient } from "@our-impact/node";
import { getCurrentUser } from "@/lib/session";

const impact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const identity = await impact.identity.createIdentityToken({
    body: {
      externalUserId: user.id,
      displayName: user.name,
      ttlSeconds: 900,
    },
  });

  return Response.json(
    { token: identity.token, expiresAt: identity.expiresAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}`;

const entitlementCheck = `const impact = new OurImpact({
  publishableKey,
  userToken: identityToken,
});

const isChampion = await impact.user.is("community_champion");

const widget = impact.widgets.mountCampaign({
  target: "#community-campaign",
  publicId: campaignId,
  height: "auto",
  onDonationCompleted() {
    void impact.refresh();
  },
});`;

export default function QuickstartPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Quickstart"
        title="Go from a normal website to an identified campaign experience."
        description="This path mirrors the reference paper storefront: baseline application, public campaign widget, then user identity and entitlement checks."
        badge="Next.js · 20 minutes"
      />

      <DocsSection title="Prerequisites">
        <div className="grid gap-4 lg:grid-cols-2">
          <DocsCallout title="Campaign configuration" tone="secure">
            Publish a campaign with at least two ready recipients and copy the public ID from <InlineCode>/embed/&lt;publicId&gt;</InlineCode>.
          </DocsCallout>
          <DocsCallout title="Developer project configuration" tone="secure">
            Create a project, add your exact browser origin, copy both keys, and create an entitlement with a stable key.
          </DocsCallout>
        </div>
      </DocsSection>

      <DocsSection title="Phase one — mount the campaign" description="A public campaign can be embedded before you integrate customer identity or entitlement logic.">
        <div className="space-y-10">
          <DocsStep number={1} title="Install the browser package">
            <CodeBlock code={installBrowser} language="bash" filename="Terminal" />
          </DocsStep>
          <DocsStep number={2} title="Mount the published campaign">
            <p className="mb-4">Use the public campaign ID—not its database UUID. The SDK creates and resizes the hosted iframe and validates messages from the Our Impact origin.</p>
            <CodeBlock code={publicWidget} language="tsx" filename="components/community-campaign.tsx" />
          </DocsStep>
          <DocsStep number={3} title="Render it anywhere in the existing product">
            <p>Your application keeps its own navigation, account system, and visual design. The widget only owns the campaign frame.</p>
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Phase two — identify the supporter" description="Add the server SDK only when campaign activity should accumulate toward project entitlements for a signed-in customer.">
        <div className="space-y-10">
          <DocsStep number={1} title="Install the trusted server package">
            <CodeBlock code={installServer} language="bash" filename="Terminal" />
          </DocsStep>
          <DocsStep number={2} title="Store the project and campaign configuration">
            <CodeBlock code={environment} language="dotenv" filename=".env.local" />
            <div className="mt-4"><DocsCallout title="Never expose the secret" tone="warning">Only the publishable key may use a <InlineCode>NEXT_PUBLIC_</InlineCode> prefix. The secret key must remain in server-only code.</DocsCallout></div>
          </DocsStep>
          <DocsStep number={3} title="Issue identity from an authenticated server route">
            <p className="mb-4">Use the stable ID from your existing session. Do not accept an arbitrary external user ID from browser input.</p>
            <CodeBlock code={identityRoute} language="typescript" filename="app/api/our-impact/identity/route.ts" />
          </DocsStep>
          <DocsStep number={4} title="Share identity between the widget and entitlement checks">
            <p className="mb-4">An identified widget attributes a verified donation to the project that issued the token. The same browser client can then read the resulting entitlement state.</p>
            <CodeBlock code={entitlementCheck} language="typescript" filename="components/our-impact-provider.tsx" />
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Verify the integration">
        <ol className="grid gap-3 lg:grid-cols-2">
          {[
            "The campaign renders without a signed-in customer.",
            "A signed-in customer receives a short-lived identity token.",
            "The identified widget reports an identified status.",
            "A completed sandbox donation appears in the developer project.",
            "The matching entitlement changes to active when its rule qualifies.",
            "Signing out clears the identity and cached entitlement state.",
          ].map((item, index) => (
            <li key={item} className="flex gap-3 rounded-xl border border-line bg-white p-4 text-sm leading-6 text-ink-soft">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-mint/15 font-mono text-[11px] font-bold text-mint-dark">{index + 1}</span>
              {item}
            </li>
          ))}
        </ol>
      </DocsSection>

      <DocsSection title="Reference implementation">
        <div className="grid gap-4 lg:grid-cols-2">
          <a href="https://github.com/AnsellMaximilian/paper-company-website/compare/main...phase_one-install-and-mount-widget" target="_blank" rel="noreferrer" className="group rounded-xl border border-line bg-white p-5 hover:border-ink/25">
            <GitCompare className="size-5 text-coral-dark" /><h3 className="mt-4 font-semibold">Baseline → campaign widget</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Review the exact package, component, page, and styling changes from phase one.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">Open comparison <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </a>
          <a href="https://github.com/AnsellMaximilian/paper-company-website/compare/phase_one-install-and-mount-widget...phase_two-integrate-entitlement-and-special-features" target="_blank" rel="noreferrer" className="group rounded-xl border border-line bg-white p-5 hover:border-ink/25">
            <Terminal className="size-5 text-coral-dark" /><h3 className="mt-4 font-semibold">Widget → identified entitlements</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Review the server identity route, provider, entitlement check, and reward experience.</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">Open comparison <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
          </a>
        </div>
        <p className="mt-6 text-sm text-ink-soft">Need the framework-specific version? Continue to the <Link href="/developers/docs/guides/nextjs" className="font-semibold text-ink underline underline-offset-4">complete Next.js guide</Link>.</p>
      </DocsSection>
    </>
  );
}
