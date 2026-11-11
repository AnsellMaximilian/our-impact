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

const curlRequest = `curl https://our-impact.vercel.app/api/v1/events \\
  --request POST \\
  --header "Authorization: Bearer $OUR_IMPACT_SECRET_KEY" \\
  --header "Content-Type: application/json" \\
  --data '{
    "id": "donation_01JABC123",
    "type": "donation.completed",
    "external_user_id": "storefront:user_01JABC",
    "occurred_at": "2026-11-06T12:00:00Z",
    "properties": {
      "amount_minor": 5000,
      "currency": "USD",
      "organization_id": 42
    }
  }'`;

export default function EventsGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Events"
        title="Send activity only after your server has verified it."
        description="Events are the evidence entitlement rules evaluate. Our Impact automatically records completed donations from its widget; use the API for trusted activity completed elsewhere."
        badge="Server only"
      />

      <DocsSection title="Automatic versus custom events">
        <div className="grid gap-4 sm:grid-cols-2">
          <EventSource title="Hosted PayPal donation" badge="Automatic">When an identified supporter completes checkout in the campaign widget, Our Impact records <InlineCode>donation.completed</InlineCode> after PayPal capture succeeds.</EventSource>
          <EventSource title="Your own verified activity" badge="SDK">If your backend confirms a donation or another supported action elsewhere, send it with <InlineCode>client.events.createVerifiedEvent()</InlineCode>.</EventSource>
        </div>
      </DocsSection>

      <DocsSection title="Create an event" description="Use the project secret from a trusted server. The SDK maps camelCase input to the API’s snake_case wire format.">
        <div className="grid gap-5 2xl:grid-cols-2">
          <CodeBlock code={eventRequest} filename="record-donation.ts" />
          <CodeBlock code={curlRequest} language="bash" filename="Direct REST request" />
        </div>
      </DocsSection>

      <DocsSection title="Shape events for durable rules">
        <div className="overflow-hidden border border-line bg-surface">
          <EventField name="id" requirement="Required">A stable ID from the source system. Reuse it for retries; never generate a new ID merely because the first request timed out.</EventField>
          <EventField name="type" requirement="Required">A namespaced, lowercase value such as <InlineCode>donation.completed</InlineCode>. Entitlement definitions match this value exactly.</EventField>
          <EventField name="externalUserId" requirement="Required">The same immutable supporter ID used when creating browser identity tokens.</EventField>
          <EventField name="occurredAt" requirement="Optional">When the activity really happened. Omit it only when API receipt time is the correct event time.</EventField>
          <EventField name="properties" requirement="Optional">Verified facts available to rule filters and progress calculations. Store monetary amounts as integer minor units.</EventField>
        </div>
      </DocsSection>

      <DocsSection title="Idempotency is built into the event ID">
        <DocsCallout title="Retry with the same ID" tone="success">The <InlineCode>id</InlineCode> must be stable in your system. If a timeout leaves the result uncertain, repeat the request with the same ID. Our Impact returns the original evaluation with <InlineCode>replayed: true</InlineCode> instead of counting it twice.</DocsCallout>
      </DocsSection>

      <DocsSection title="Use the immediate evaluation result">
        <CodeBlock code={eventResponse} language="json" filename="201 Created" />
        <p className="mt-4 text-sm leading-6 text-ink-soft">The response is useful for immediate server reactions. Monetary progress remains an integer in minor units: <InlineCode>5000</InlineCode> with <InlineCode>usd</InlineCode> means $50.00. Browser experiences should still fetch the current entitlement view using a fresh identity token.</p>
      </DocsSection>

      <DocsSection title="Do not send untrusted browser claims">
        <DocsCallout title="Verify before ingesting" tone="secure">Your backend should first verify payment, order, membership, or other activity with its source of truth. A browser saying “I donated” is not evidence. The secret-key event API trusts your server’s assertion and evaluates entitlements immediately.</DocsCallout>
      </DocsSection>
    </>
  );
}

function EventSource({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><span className="rounded-full bg-mint/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-mint-dark">{badge}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><div className="mt-2 text-sm leading-6 text-ink-soft">{children}</div></article>;
}

function EventField({ name, requirement, children }: { name: string; requirement: string; children: React.ReactNode }) {
  return <div className="grid gap-2 border-b border-line p-5 last:border-0 md:grid-cols-[12rem_7rem_1fr] md:items-start"><InlineCode>{name}</InlineCode><span className="text-xs font-bold uppercase tracking-[0.1em] text-coral-dark">{requirement}</span><div className="text-sm leading-6 text-ink-soft">{children}</div></div>;
}
