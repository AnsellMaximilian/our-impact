import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Quickstart" };

const envExample = `OUR_IMPACT_SECRET_KEY=oi_sk_test_...
NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY=oi_pk_test_...`;

const installPackages = `pnpm add @our-impact/node @our-impact/browser`;

const createIdentity = `import { OurImpactClient } from "@our-impact/node";

const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

// Run this only after your server authenticates its own customer.
const identity = await ourImpact.identity.createIdentityToken({
  body: {
    externalUserId: "storefront:user_01JABC",
    displayName: "Avery",
    ttlSeconds: 900,
  },
});

// Return identity.token only to this authenticated customer.`;

const readEntitlements = `import { OurImpact } from "@our-impact/browser";

const impact = new OurImpact({
  publishableKey: process.env.NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY!,
  userToken: identity.token,
});

const isChampion = await impact.user.is("community_champion_theme");`;

export default function QuickstartPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Quickstart"
        title="Identify one customer and read their access."
        description="Use the server SDK to issue a trusted identity and the browser SDK to turn an entitlement key into product behavior."
        badge="About 10 minutes"
      />

      <DocsSection title="Before you begin">
        <DocsCallout title="Create a developer project first" tone="secure">
          In the <Link href="/dashboard/developers" className="font-semibold text-ink underline underline-offset-4">developer dashboard</Link>, create a project, copy both keys when shown, and add your browser origin. Secret keys are shown only when created or rotated.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Integrate">
        <div className="space-y-10">
          <DocsStep number={1} title="Install the SDK packages">
            <p>The Node package stays on your server. The browser package receives only a publishable key and short-lived identity token.</p>
            <div className="mt-4"><CodeBlock code={installPackages} language="shell" filename="Terminal" /></div>
            <div className="mt-4"><DocsCallout title="Sandbox package preview">The SDK names and interfaces are final for this preview. Registry publishing is not enabled yet, so local testing uses the package archives or workspace paths supplied with the SDK build.</DocsCallout></div>
          </DocsStep>

          <DocsStep number={2} title="Store the two project keys">
            <p>The <InlineCode>oi_sk_*</InlineCode> key belongs only on your server. The <InlineCode>oi_pk_*</InlineCode> key is designed for browser code.</p>
            <div className="mt-4"><CodeBlock code={envExample} language="shell" filename=".env.local" /></div>
          </DocsStep>

          <DocsStep number={3} title="Create a short-lived identity token">
            <p>After your app authenticates a customer, ask Our Impact for a token tied to your stable internal user ID. Never accept the external ID directly from an untrusted browser request.</p>
            <div className="mt-4"><CodeBlock code={createIdentity} filename="server/our-impact.ts" /></div>
          </DocsStep>

          <DocsStep number={4} title="Read the customer’s entitlements in the browser">
            <p>Return the token to the same authenticated browser. Our Impact checks the token, publishable key, and configured browser origin together.</p>
            <div className="mt-4"><CodeBlock code={readEntitlements} filename="client/community-perks.ts" /></div>
          </DocsStep>

          <DocsStep number={5} title="Turn a stable key into your own experience">
            <p>Your code decides what <InlineCode>community_champion_theme</InlineCode> means. Program owners can change the qualifying rule without requiring your software team to ship new product logic.</p>
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Next steps">
        <div className="grid gap-4 sm:grid-cols-2">
          <NextLink href="/developers/docs/guides/nextjs" title="Build with Next.js" body="Embed a campaign, pass trusted identity, and render an entitlement gate." />
          <NextLink href="/developers/docs/guides/events" title="Send verified events" body="Record support that happens outside the hosted donation flow." />
          <NextLink href="/developers/docs/guides/entitlements" title="Design product access" body="Understand states, progress, expiry, and stable entitlement keys." />
        </div>
      </DocsSection>
    </>
  );
}

function NextLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
      <ArrowRight className="mt-4 size-4 transition group-hover:translate-x-1" />
    </Link>
  );
}
