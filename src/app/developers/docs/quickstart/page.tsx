import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Quickstart" };

const envExample = `OUR_IMPACT_SECRET_KEY=oi_sk_test_...
NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY=oi_pk_test_...`;

const createIdentity = `// Your server, after authenticating its own customer
const response = await fetch(
  "https://our-impact.vercel.app/api/v1/identity-tokens",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${process.env.OUR_IMPACT_SECRET_KEY}\`,
    },
    body: JSON.stringify({
      external_user_id: "storefront:user_01JABC",
      display_name: "Avery",
      ttl_seconds: 900,
    }),
  },
);

const { token, expires_at } = await response.json();`;

const readEntitlements = `// The browser receives only a publishable key and short-lived token
const response = await fetch(
  "https://our-impact.vercel.app/api/v1/me/entitlements",
  {
    headers: {
      authorization: \`Bearer \${token}\`,
      "x-our-impact-key": "oi_pk_test_...",
    },
  },
);

const { user, entitlements } = await response.json();
const isChampion = entitlements.some(
  (item) => item.entitlement_key === "community_champion_theme"
    && item.state === "active",
);`;

export default function QuickstartPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Quickstart"
        title="Identify one customer and read their access."
        description="This path uses plain HTTP so it works before the preview SDK packages are published. You can complete it with any server framework and browser client."
        badge="About 10 minutes"
      />

      <DocsSection title="Before you begin">
        <DocsCallout title="Create a developer project first" tone="secure">
          In the <Link href="/dashboard/developers" className="font-semibold text-ink underline underline-offset-4">developer dashboard</Link>, create a project, copy both keys when shown, and add your browser origin. Secret keys are shown only when created or rotated.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Integrate">
        <div className="space-y-10">
          <DocsStep number={1} title="Store the two project keys">
            <p>The <InlineCode>oi_sk_*</InlineCode> key belongs only on your server. The <InlineCode>oi_pk_*</InlineCode> key is designed for browser code.</p>
            <div className="mt-4"><CodeBlock code={envExample} language="shell" filename=".env.local" /></div>
          </DocsStep>

          <DocsStep number={2} title="Create a short-lived identity token">
            <p>After your app authenticates a customer, ask Our Impact for a token tied to your stable internal user ID. Never accept the external ID directly from an untrusted browser request.</p>
            <div className="mt-4"><CodeBlock code={createIdentity} filename="server/our-impact.ts" /></div>
          </DocsStep>

          <DocsStep number={3} title="Read the customer’s entitlements in the browser">
            <p>Return the token to the same authenticated browser. Our Impact checks the token, publishable key, and configured browser origin together.</p>
            <div className="mt-4"><CodeBlock code={readEntitlements} filename="client/community-perks.ts" /></div>
          </DocsStep>

          <DocsStep number={4} title="Turn a stable key into your own experience">
            <p>Your code decides what <InlineCode>community_champion_theme</InlineCode> means. Program owners can change the qualifying rule without requiring your software team to ship new product logic.</p>
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Next steps">
        <div className="grid gap-4 sm:grid-cols-2">
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
