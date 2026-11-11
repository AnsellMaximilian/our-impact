import type { Metadata } from "next";
import { ArrowUpRight, Download } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, EndpointCard, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "REST API reference" };

const baseRequest = `curl https://our-impact.vercel.app/api/v1/users/storefront%3Auser_01JABC/entitlements \\
  --header "Authorization: Bearer $OUR_IMPACT_SECRET_KEY"`;

const createEventRequest = `{
  "id": "donation_01JABC123",
  "type": "donation.completed",
  "external_user_id": "storefront:user_01JABC",
  "display_name": "Avery",
  "occurred_at": "2026-11-06T12:00:00Z",
  "properties": {
    "amount_minor": 5000,
    "currency": "USD",
    "organization_id": 42
  }
}`;

const createEventResponse = `{
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

const identityRequest = `{
  "external_user_id": "storefront:user_01JABC",
  "display_name": "Avery",
  "ttl_seconds": 900
}`;

const identityResponse = `{
  "token": "oi_identity_opaque_value",
  "expires_at": "2026-11-06T12:15:00Z",
  "user": {
    "external_user_id": "storefront:user_01JABC",
    "display_name": "Avery"
  }
}`;

const serverEntitlements = `curl "https://our-impact.vercel.app/api/v1/users/storefront%3Auser_01JABC/entitlements" \\
  --header "Authorization: Bearer $OUR_IMPACT_SECRET_KEY"`;

const browserEntitlements = `curl https://our-impact.vercel.app/api/v1/me/entitlements \\
  --header "x-our-impact-key: oi_pk_test_..." \\
  --header "Authorization: Bearer $IDENTITY_TOKEN" \\
  --header "Origin: https://shop.example.com"`;

export default function ApiReferencePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Reference"
        title="REST API"
        description="The sandbox API uses JSON over HTTPS. Server operations authenticate with a project secret; browser reads combine a publishable key with a short-lived identity token."
        badge="v1"
      />

      <DocsSection title="Base URL">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <code className="text-sm font-semibold">https://our-impact.vercel.app</code>
          <a href="/api/openapi" target="_blank" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"><Download className="size-4" /> Download OpenAPI</a>
        </div>
      </DocsSection>

      <DocsSection title="Authentication">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-[130px_1fr] gap-4 border-b border-line p-5 sm:grid-cols-[180px_180px_1fr]"><strong className="text-sm">Credential</strong><strong className="hidden text-sm sm:block">Location</strong><strong className="text-sm">Purpose</strong></div>
          <AuthRow credential="oi_sk_test_*" location="Authorization: Bearer" purpose="Trusted server operations. Never send it to a browser." />
          <AuthRow credential="oi_pk_test_*" location="x-our-impact-key" purpose="Safe project identifier used for browser reads." />
          <AuthRow credential="Identity token" location="Authorization: Bearer" purpose="Short-lived token scoped to one project and external user." />
        </div>
        <div className="mt-5"><CodeBlock code={baseRequest} language="bash" filename="Server request" /></div>
      </DocsSection>

      <DocsSection title="Endpoint index" description="All request and response field names use snake_case on the wire. The TypeScript SDKs map them to camelCase.">
        <div className="space-y-4">
          <EndpointCard method="POST" path="/api/v1/events" title="Create a verified event" auth="Secret key">
            Accepts a stable event ID, event type, external user ID, occurrence time, and free-form properties. Returns the supporter’s newly evaluated entitlements. Replaying the same event ID is safe.
          </EndpointCard>
          <EndpointCard method="POST" path="/api/v1/identity-tokens" title="Create a browser identity token" auth="Secret key">
            Issues an opaque token for one external user. <InlineCode>ttl_seconds</InlineCode> accepts 60–3600 seconds and defaults to 900.
          </EndpointCard>
          <EndpointCard method="GET" path="/api/v1/users/{externalUserId}/entitlements" title="Read a supporter from your server" auth="Secret key">
            Returns the supporter profile and all current entitlement states using the stable user ID from your application.
          </EndpointCard>
          <EndpointCard method="GET" path="/api/v1/me/entitlements" title="Read the current browser user" auth="Publishable key + identity token">
            Returns only the supporter identified by the short-lived token. The request origin must be in the developer project’s allowed origins.
          </EndpointCard>
        </div>
      </DocsSection>

      <DocsSection title="Create a verified event" description="POST /api/v1/events · Secret key · 201 on creation, 200 on replay">
        <div className="grid gap-5 2xl:grid-cols-2">
          <CodeBlock code={createEventRequest} language="json" filename="Request body" />
          <CodeBlock code={createEventResponse} language="json" filename="201 Created" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ReferenceFact label="Idempotency">The request <InlineCode>id</InlineCode> is unique within one project. Retry with the same ID.</ReferenceFact>
          <ReferenceFact label="Event type"><InlineCode>type</InlineCode> must match <InlineCode>{"^[a-z][a-z0-9_.]{2,79}$"}</InlineCode>.</ReferenceFact>
          <ReferenceFact label="Currency">Send integer minor units plus an uppercase ISO currency code in properties.</ReferenceFact>
          <ReferenceFact label="SDK"><InlineCode>{"client.events.createVerifiedEvent({ body })"}</InlineCode></ReferenceFact>
        </div>
      </DocsSection>

      <DocsSection title="Create an identity token" description="POST /api/v1/identity-tokens · Secret key · 200">
        <div className="grid gap-5 2xl:grid-cols-2">
          <CodeBlock code={identityRequest} language="json" filename="Request body" />
          <CodeBlock code={identityResponse} language="json" filename="200 OK" />
        </div>
        <div className="mt-5"><DocsCallout title="Lifetime and scope" tone="secure"><InlineCode>ttl_seconds</InlineCode> accepts 60–3600 seconds and defaults to 900. The token is bound to the issuing project and supporter. Create it only after authenticating the user in your own application.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Read supporter entitlements" description="Use the secret-key route for server decisions and the identity route for browser experiences.">
        <div className="grid gap-5 2xl:grid-cols-2">
          <CodeBlock code={serverEntitlements} language="bash" filename="GET /api/v1/users/{externalUserId}/entitlements" />
          <CodeBlock code={browserEntitlements} language="bash" filename="GET /api/v1/me/entitlements" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ReferenceFact label="Server SDK"><InlineCode>{"client.entitlements.listUserEntitlements({ externalUserId })"}</InlineCode></ReferenceFact>
          <ReferenceFact label="Browser SDK"><InlineCode>impact.user.is()</InlineCode>, <InlineCode>get()</InlineCode>, <InlineCode>all()</InlineCode>, and <InlineCode>profile()</InlineCode></ReferenceFact>
          <ReferenceFact label="Origin policy">The browser route checks the exact request origin against the project’s allowed origins.</ReferenceFact>
          <ReferenceFact label="Not found">The server route returns 404 when the project has no supporter with that external ID.</ReferenceFact>
        </div>
      </DocsSection>

      <DocsSection title="SDK to API map">
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-line bg-canvas/70"><th className="p-4 font-semibold">Package</th><th className="p-4 font-semibold">Method</th><th className="p-4 font-semibold">HTTP operation</th><th className="p-4 font-semibold">Runtime</th></tr></thead>
            <tbody>
              <SdkRow pkg="@our-impact/node" method="events.createVerifiedEvent" operation="POST /api/v1/events" runtime="Trusted server" />
              <SdkRow pkg="@our-impact/node" method="identity.createIdentityToken" operation="POST /api/v1/identity-tokens" runtime="Trusted server" />
              <SdkRow pkg="@our-impact/node" method="entitlements.listUserEntitlements" operation="GET /api/v1/users/{externalUserId}/entitlements" runtime="Trusted server" />
              <SdkRow pkg="@our-impact/browser" method="user.is / get / all / profile" operation="GET /api/v1/me/entitlements" runtime="Allowed browser origin" />
            </tbody>
          </table>
        </div>
      </DocsSection>

      <DocsSection title="Response status codes">
        <div className="grid gap-3 sm:grid-cols-2">
          <Status code="200" label="Success or idempotent replay" />
          <Status code="201" label="Verified event created" />
          <Status code="400" label="Request validation failed" />
          <Status code="401" label="Credential or identity is invalid" />
          <Status code="403" label="Browser origin is not allowed" />
          <Status code="404" label="Supporter was not found" />
        </div>
        <div className="mt-5"><DocsCallout title="Machine-readable errors">Error responses use a stable shape such as <InlineCode>{`{ "error": "invalid_api_key" }`}</InlineCode>. Log the code on your server, but do not expose secret credentials in diagnostic output.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Generated contract">
        <a href="/api/openapi" target="_blank" className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 font-semibold hover:border-ink/30">
          Open the complete OpenAPI 3.0 document
          <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
      </DocsSection>
    </>
  );
}

function AuthRow({ credential, location, purpose }: { credential: string; location: string; purpose: string }) {
  return <div className="grid grid-cols-[130px_1fr] gap-4 border-b border-line p-5 last:border-0 sm:grid-cols-[180px_180px_1fr]"><code className="text-xs font-semibold">{credential}</code><span className="hidden text-sm text-ink-soft sm:block">{location}</span><span className="text-sm leading-6 text-ink-soft">{purpose}</span></div>;
}

function Status({ code, label }: { code: string; label: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"><code className="font-bold text-coral-dark">{code}</code><span className="text-sm text-ink-soft">{label}</span></div>;
}

function ReferenceFact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="border-l-2 border-mint bg-surface px-4 py-3"><strong className="text-sm">{label}</strong><div className="mt-1 text-sm leading-6 text-ink-soft">{children}</div></div>;
}

function SdkRow({ pkg, method, operation, runtime }: { pkg: string; method: string; operation: string; runtime: string }) {
  return <tr className="border-b border-line last:border-0"><td className="p-4"><InlineCode>{pkg}</InlineCode></td><td className="p-4 font-mono text-xs">{method}</td><td className="p-4 font-mono text-xs">{operation}</td><td className="p-4 text-ink-soft">{runtime}</td></tr>;
}
