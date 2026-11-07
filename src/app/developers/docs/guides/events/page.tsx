import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Verified events" };

const eventRequest = `import { OurImpactClient } from "@our-impact/node";

const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

const result = await ourImpact.events.createVerifiedEvent({
  body: {
    id: "donation_01JABC123",
    type: "donation.completed",
    externalUserId: "storefront:user_01JABC",
    displayName: "Avery",
    occurredAt: new Date("2026-11-06T12:00:00Z"),
    properties: {
      amount_minor: 5000,
      currency: "USD",
      organization_id: 42,
    },
  },
});`;

const eventResponse = `{
  "id": "d85b1407-351d-4694-9ac2-9c88b415c8c6",
  "replayed": false,
  "entitlements": [
    {
      "entitlement_key": "community_champion",
      "state": "active",
      "qualifying_count": 1,
      "progress_value": 5000,
      "progress_unit": "usd",
      "qualified_at": "2026-11-06T12:00:01Z",
      "valid_until": null,
      "updated_at": "2026-11-06T12:00:01Z"
    }
  ]
}`;

export default function EventsGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Events"
        title="Send activity only after your server has verified it."
        description="Events are the evidence entitlement rules evaluate. Our Impact automatically records completed donations from its widget; use the API for trusted activity completed elsewhere."
      />

      <DocsSection title="Automatic versus custom events">
        <div className="grid gap-4 sm:grid-cols-2">
          <EventSource title="Hosted PayPal donation" badge="Automatic">When an identified supporter completes checkout in the campaign widget, Our Impact records <InlineCode>donation.completed</InlineCode> after PayPal capture succeeds.</EventSource>
          <EventSource title="Your own verified activity" badge="SDK">If your backend confirms a donation or another supported action elsewhere, send it with <InlineCode>client.events.createVerifiedEvent()</InlineCode>.</EventSource>
        </div>
      </DocsSection>

      <DocsSection title="Create an event" description="Use the Node SDK and project secret on your server. Properties remain available to amount, currency, recipient, and count-based rules.">
        <CodeBlock code={eventRequest} filename="record-donation.ts" />
      </DocsSection>

      <DocsSection title="Idempotency is built into the event ID">
        <DocsCallout title="Retry with the same ID" tone="success">The <InlineCode>id</InlineCode> must be stable in your system. If a timeout leaves the result uncertain, repeat the request with the same ID. Our Impact returns the original evaluation with <InlineCode>replayed: true</InlineCode> instead of counting it twice.</DocsCallout>
      </DocsSection>

      <DocsSection title="Use the immediate evaluation result">
        <CodeBlock code={eventResponse} language="json" filename="201 Created" />
        <p className="mt-4 text-sm leading-6 text-ink-soft">The response is useful for immediate server reactions. Monetary progress remains an integer in minor units: <InlineCode>5000</InlineCode> with <InlineCode>usd</InlineCode> means $50.00. Browser experiences should still fetch the current entitlement view using a fresh identity token.</p>
      </DocsSection>
    </>
  );
}

function EventSource({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><span className="rounded-full bg-mint/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mint-dark">{badge}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><div className="mt-2 text-sm leading-6 text-ink-soft">{children}</div></article>;
}
