import type { Metadata } from "next";
import { ArrowUpRight, Download } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, EndpointCard, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "REST API reference" };

const baseRequest = `curl https://our-impact.vercel.app/api/v1/users/mikes-vegan-shop%3Ajamie/entitlements \\
  --header "Authorization: Bearer $OUR_IMPACT_SECRET_KEY"`;

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

      <DocsSection title="Endpoints" description="All request and response field names use snake_case on the wire. The preview TypeScript SDKs map them to camelCase.">
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
