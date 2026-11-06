import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "User identity" };

const nodePreview = `import { OurImpactClient } from "@our-impact/node";

const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

const identity = await ourImpact.identity.createIdentityToken({
  body: {
    externalUserId: currentUser.id,
    displayName: currentUser.name,
    ttlSeconds: 900,
  },
});

return Response.json(identity);`;

const widgetIdentity = `const widget = document.querySelector("#our-impact-widget");

widget.contentWindow.postMessage(
  { type: "our-impact.identify", token: identity.token },
  "https://our-impact.vercel.app",
);`;

export default function IdentityGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Identity"
        title="Keep your login. Share only a stable customer identity."
        description="Our Impact does not authenticate Mike’s customers. Mike’s server confirms who is signed in, then exchanges that trusted identity for a short-lived browser token."
      />

      <DocsSection title="The trust boundary">
        <div className="grid gap-4 md:grid-cols-3">
          <BoundaryCard number="01" title="Your app authenticates" body="Use your existing session, SSO, magic link, or account system." />
          <BoundaryCard number="02" title="Your server identifies" body="Send the same stable external user ID every time that customer returns." />
          <BoundaryCard number="03" title="Our Impact authorizes" body="A 60–3600 second token permits browser reads for only that user and project." />
        </div>
      </DocsSection>

      <DocsSection title="Choose the external user ID" description="The external ID is the join between your customer record and their Our Impact activity.">
        <ul className="space-y-3 text-sm leading-6 text-ink-soft">
          <li><strong className="text-ink">Do:</strong> use an immutable internal database ID such as <InlineCode>usr_01JABC</InlineCode>.</li>
          <li><strong className="text-ink">Do:</strong> namespace IDs if several apps share a project, for example <InlineCode>mikes-shop:usr_01JABC</InlineCode>.</li>
          <li><strong className="text-ink">Avoid:</strong> email addresses, display names, or anything a customer can change or claim.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Create the token on your server" description="This is the preview Node SDK equivalent of POST /api/v1/identity-tokens.">
        <CodeBlock code={nodePreview} filename="app/api/our-impact/identity/route.ts" />
        <div className="mt-5"><DocsCallout title="Secret means server-only" tone="secure">A browser must never receive an <InlineCode>oi_sk_*</InlineCode> value. It receives only the resulting identity token and your safe publishable key.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Identify the embedded campaign" description="When you use the hosted widget, pass the same token with a targeted postMessage.">
        <CodeBlock code={widgetIdentity} filename="identify-widget.ts" />
        <p className="mt-4 text-sm leading-6 text-ink-soft">Use the exact Our Impact origin as the second argument—not <InlineCode>*</InlineCode>. The widget also validates that the sending origin appears in the project’s allowed-origin list.</p>
      </DocsSection>
    </>
  );
}

function BoundaryCard({ number, title, body }: { number: string; title: string; body: string }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><span className="text-xs font-bold text-coral-dark">{number}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p></article>;
}
