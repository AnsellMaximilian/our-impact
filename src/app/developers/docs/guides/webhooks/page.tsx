import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Webhooks" };

const headers = `POST /api/our-impact/webhook HTTP/1.1
Content-Type: application/json
Our-Impact-Event: entitlement.granted
Our-Impact-Delivery: 6ff3c38e-...
Our-Impact-Signature: t=1794362400,v1=HEX_HMAC`;

const payload = `{
  "id": "019a6f04-...",
  "type": "entitlement.granted",
  "created_at": "2026-11-11T08:00:00.000Z",
  "data": {
    "external_user_id": "storefront:user_123",
    "entitlement": "community_champion",
    "state": "active",
    "qualifying_count": 3,
    "valid_until": null
  }
}`;

const verifier = `import { createHmac, timingSafeEqual } from "node:crypto";

function verifyOurImpactWebhook(rawBody: string, signature: string, secret: string) {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.split("=", 2)),
  );
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(String(timestamp) + "." + rawBody)
    .digest("hex");
  const received = parts.v1 ?? "";
  const left = Buffer.from(expected);
  const right = Buffer.from(received);

  return left.length === right.length && timingSafeEqual(left, right);
}`;

const route = `export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("our-impact-signature") ?? "";

  if (!verifyOurImpactWebhook(
    rawBody,
    signature,
    process.env.OUR_IMPACT_WEBHOOK_SECRET!,
  )) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }

  const deliveryId = request.headers.get("our-impact-delivery");
  const event = JSON.parse(rawBody);
  await processOnce(deliveryId, event);

  return new Response(null, { status: 204 });
}`;

export default function WebhooksGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Webhooks"
        title="Receive signed activity and entitlement changes."
        description="Webhooks let your backend react asynchronously when verified supporter activity arrives or an entitlement changes state."
        badge="Server only"
      />

      <DocsSection title="Create an endpoint">
        <p className="max-w-4xl leading-7 text-ink-soft">In the developer project’s <strong className="text-ink">API &amp; Webhooks</strong> tab, add a public HTTPS URL. Copy the signing secret immediately; it is shown only when the endpoint is created.</p>
        <div className="mt-5"><DocsCallout title="Local development">The endpoint must use public HTTPS. Use a trusted tunnel for local testing and replace it with the production URL before launch.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Request format">
        <div className="grid gap-5 xl:grid-cols-2">
          <CodeBlock code={headers} language="http" filename="Webhook headers" />
          <CodeBlock code={payload} language="json" filename="Example payload" />
        </div>
      </DocsSection>

      <DocsSection title="Verify before parsing" description="The signature covers the exact raw request body. Do not parse and re-stringify the body before verification.">
        <div className="space-y-10">
          <DocsStep number={1} title="Verify the timestamped HMAC">
            <CodeBlock code={verifier} language="typescript" filename="lib/our-impact-webhook.ts" />
          </DocsStep>
          <DocsStep number={2} title="Process each delivery once">
            <CodeBlock code={route} language="typescript" filename="app/api/our-impact/webhook/route.ts" />
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Events and delivery behavior">
        <div className="overflow-hidden rounded-xl border border-line bg-white text-sm">
          {[
            ["donation.completed", "A verified donation event entered the developer project."],
            ["entitlement.granted", "A supporter newly qualified for an entitlement."],
            ["entitlement.revoked", "A supporter no longer qualifies or the entitlement was disabled."],
          ].map(([event, meaning]) => <div key={event} className="grid gap-2 border-b border-line p-4 last:border-0 md:grid-cols-[13rem_1fr]"><InlineCode>{event}</InlineCode><span className="text-ink-soft">{meaning}</span></div>)}
        </div>
        <div className="mt-5"><DocsCallout title="Return a 2xx quickly" tone="secure">Non-2xx responses and network failures are retried with exponential delays. Deliveries stop after six claimed attempts, so queue slow work internally and deduplicate using <InlineCode>Our-Impact-Delivery</InlineCode>.</DocsCallout></div>
      </DocsSection>
    </>
  );
}
