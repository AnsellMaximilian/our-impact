import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Next.js integration" };

const install = `pnpm add @our-impact/node @our-impact/browser`;

const environment = `OUR_IMPACT_SECRET_KEY=oi_sk_test_...
NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY=oi_pk_test_...
NEXT_PUBLIC_OUR_IMPACT_CAMPAIGN_ID=your-campaign-id`;

const serverClient = `import "server-only";
import { OurImpactClient } from "@our-impact/node";

export const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});`;

const serverPage = `import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ourImpact } from "@/lib/our-impact/server";
import { CommunityProgram } from "@/components/community-program";

export default async function CommunityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const identity = await ourImpact.identity.createIdentityToken({
    body: {
      externalUserId: session.user.id,
      displayName: session.user.name ?? undefined,
      ttlSeconds: 900,
    },
  });

  return (
    <CommunityProgram
      userToken={identity.token}
      publishableKey={process.env.NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY!}
      campaignId={process.env.NEXT_PUBLIC_OUR_IMPACT_CAMPAIGN_ID!}
    />
  );
}`;

const clientExperience = `"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OurImpact } from "@our-impact/browser";

export function CommunityProgram({
  userToken,
  publishableKey,
  campaignId,
}: {
  userToken: string;
  publishableKey: string;
  campaignId: string;
}) {
  const campaignTarget = useRef<HTMLDivElement>(null);
  const [isChampion, setIsChampion] = useState(false);
  const impact = useMemo(
    () => new OurImpact({ publishableKey, userToken }),
    [publishableKey, userToken],
  );

  const refreshAccess = useCallback(async () => {
    await impact.refresh();
    setIsChampion(await impact.user.is("community_champion"));
  }, [impact]);

  useEffect(() => { void refreshAccess(); }, [refreshAccess]);

  useEffect(() => {
    if (!campaignTarget.current) return;
    const widget = impact.widgets.mountCampaign({
      target: campaignTarget.current,
      publicId: campaignId,
      height: "auto",
      onDonationCompleted() {
        void impact.user.is("community_champion").then(setIsChampion);
      },
    });
    return () => widget.destroy();
  }, [campaignId, impact]);

  return (
    <main data-community-champion={isChampion || undefined}>
      <div ref={campaignTarget} />

      {isChampion ? <ChampionExperience /> : <StandardExperience />}
      <button onClick={() => void refreshAccess()}>Refresh benefits</button>
    </main>
  );
}`;

const serverGate = `const result = await ourImpact.entitlements.listUserEntitlements({
  externalUserId: session.user.id,
});

const canAccess = result.entitlements.some(
  (item) => item.entitlementKey === "community_champion"
    && item.state === "active",
);

if (!canAccess) redirect("/community");`;

export default function NextJsGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Next.js"
        title="Add a campaign widget and entitlement gates to a Next.js app."
        description="Keep the secret SDK in Server Components or Route Handlers. Use the browser SDK only with a publishable key and a short-lived identity token."
        badge="App Router"
      />

      <DocsSection title="What you will build">
        <div className="grid gap-4 sm:grid-cols-3">
          <Outcome title="Identified widget">The campaign knows which signed-in customer completed a donation.</Outcome>
          <Outcome title="Automatic evaluation">A verified PayPal capture becomes a project event and evaluates entitlement rules.</Outcome>
          <Outcome title="Product gate">The Next.js app checks a stable entitlement key before showing a benefit.</Outcome>
        </div>
      </DocsSection>

      <DocsSection title="Configure Our Impact first">
        <ol className="space-y-4 text-sm leading-6 text-ink-soft">
          <SetupItem number="1" title="Create or select a workspace">The workspace owns both the community campaigns and developer projects used by your application.</SetupItem>
          <SetupItem number="2" title="Add recipient organizations">Invite each recipient to connect its own PayPal account, then wait until it is ready to receive.</SetupItem>
          <SetupItem number="3" title="Publish a campaign">Choose its recipients, schedule, voting behavior, and commitment. Copy the public embed URL.</SetupItem>
          <SetupItem number="4" title="Create a developer project">Add your Next.js origin, then copy the publishable key and the one-time server secret.</SetupItem>
          <SetupItem number="5" title="Create an entitlement">Give it a stable key such as <InlineCode>community_champion</InlineCode> and add an earning path such as “lifetime donations of at least $50.”</SetupItem>
        </ol>
      </DocsSection>

      <DocsSection title="Connect the Next.js application">
        <div className="space-y-10">
          <DocsStep number={1} title="Install both SDKs">
            <CodeBlock code={install} language="shell" filename="Terminal" />
          </DocsStep>
          <DocsStep number={2} title="Add project configuration">
            <CodeBlock code={environment} language="shell" filename=".env.local" />
            <div className="mt-4"><DocsCallout title="Keep the boundary clear" tone="secure">Only variables prefixed with <InlineCode>NEXT_PUBLIC_</InlineCode> enter the browser bundle. Never prefix or pass <InlineCode>OUR_IMPACT_SECRET_KEY</InlineCode> to a Client Component.</DocsCallout></div>
          </DocsStep>
          <DocsStep number={3} title="Create one server-only client">
            <CodeBlock code={serverClient} filename="lib/our-impact/server.ts" />
          </DocsStep>
          <DocsStep number={4} title="Issue identity after authenticating the customer">
            <p className="mb-4">This Server Component uses the application’s existing session. The stable application user ID becomes the supporter ID inside this developer project.</p>
            <CodeBlock code={serverPage} filename="app/community/page.tsx" />
          </DocsStep>
          <DocsStep number={5} title="Identify the widget and render a client-side gate">
            <p className="mb-4">The same short-lived token powers both the hosted campaign and browser entitlement reads. The SDK creates the iframe, identifies the supporter, removes nested scrolling, and refreshes entitlements after a completed donation.</p>
            <CodeBlock code={clientExperience} filename="components/community-program.tsx" />
            <div className="mt-4"><DocsCallout title="Control the embed height">The default <InlineCode>height: &quot;auto&quot;</InlineCode> follows the campaign content. Pass <InlineCode>height: 560</InlineCode> for an intentionally fixed, scrollable frame, or combine auto height with <InlineCode>maxHeight</InlineCode>.</DocsCallout></div>
          </DocsStep>
          <DocsStep number={6} title="Protect a route on the server when needed">
            <p className="mb-4">For authorization—not just visual personalization—query with the secret SDK before rendering or mutating protected data.</p>
            <CodeBlock code={serverGate} filename="app/champion-area/page.tsx" />
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="What happens after a donation">
        <div className="space-y-3 text-sm leading-6 text-ink-soft">
          <p>PayPal capture completes inside the campaign widget. Our Impact records the donation against the campaign and recipient, then creates <InlineCode>donation.completed</InlineCode> for the identified supporter in this developer project.</p>
          <p>The project evaluates every matching entitlement rule. A subsequent browser <InlineCode>impact.refresh()</InlineCode>, server render, or server entitlement query returns the new state.</p>
        </div>
        <div className="mt-5"><DocsCallout title="Treat server checks as authorization">Browser gates are ideal for themes, badges, and progressive UI. Re-check entitlements with <InlineCode>@our-impact/node</InlineCode> before granting sensitive data, credits, or privileged server actions.</DocsCallout></div>
      </DocsSection>
    </>
  );
}

function Outcome({ title, children }: { title: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p></article>;
}

function SetupItem({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <li className="grid grid-cols-[34px_1fr] gap-3"><span className="grid size-8 place-items-center rounded-full bg-ink text-xs font-bold text-white">{number}</span><div><strong className="text-ink">{title}</strong><p className="mt-1">{children}</p></div></li>;
}
