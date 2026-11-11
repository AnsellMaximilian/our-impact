import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "User identity" };

const nodePreview = `import { OurImpactClient } from "@our-impact/node";
import { auth } from "@/lib/auth";

const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const identity = await ourImpact.identity.createIdentityToken({
    body: {
      externalUserId: "storefront:" + session.user.id,
      displayName: session.user.name ?? undefined,
      ttlSeconds: 900,
    },
  });

  return Response.json(identity);
}`;

const identityResponse = `{
  "token": "oi_identity_opaque_value",
  "expires_at": "2026-11-11T08:15:00.000Z",
  "user": {
    "external_user_id": "storefront:usr_01JABC",
    "display_name": "Avery"
  }
}`;

const widgetIdentity = `import { OurImpact } from "@our-impact/browser";

const impact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken: identity.token,
});

const campaign = impact.widgets.mountCampaign({
  target: "#our-impact-campaign",
  publicId: "your-campaign-id",
  height: "auto",
});

// When your signed-in customer changes:
impact.setIdentity(nextIdentityToken);

// During view cleanup:
campaign.destroy();`;

const identityLifecycle = `async function signInToOurImpact() {
  const response = await fetch("/api/our-impact/identity", { method: "POST" });
  if (!response.ok) throw new Error("Could not identify supporter");

  const identity = await response.json();
  impact.setIdentity(identity.token);
}

function onSignedOut() {
  impact.clearIdentity();
}`;

export default function IdentityGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Identity"
        title="Keep your login. Share only a stable customer identity."
        description="Our Impact does not replace your authentication. Your server confirms who is signed in, then exchanges that trusted identity for a short-lived browser token."
        badge="Phase two"
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
          <li><strong className="text-ink">Do:</strong> namespace IDs if several apps share a project, for example <InlineCode>storefront:usr_01JABC</InlineCode>.</li>
          <li><strong className="text-ink">Avoid:</strong> email addresses, display names, or anything a customer can change or claim.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Issue identity after authenticating your user" description="The identity route belongs in your application. It verifies your existing session and calls POST /api/v1/identity-tokens from the server.">
        <div className="space-y-10">
          <DocsStep number={1} title="Authenticate first, then create the token">
            <CodeBlock code={nodePreview} filename="app/api/our-impact/identity/route.ts" />
          </DocsStep>
          <DocsStep number={2} title="Return only the short-lived result">
            <CodeBlock code={identityResponse} language="json" filename="200 OK" />
          </DocsStep>
        </div>
        <div className="mt-5"><DocsCallout title="Secret means server-only" tone="secure">A browser must never receive an <InlineCode>oi_sk_*</InlineCode> value. It receives only the resulting identity token and your safe publishable key. Do not accept an external user ID directly from the request body without comparing it with the authenticated session.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Identify the embedded campaign" description="The browser SDK mounts the hosted campaign, supplies the same identity token, and follows content height without a nested scrollbar.">
        <CodeBlock code={widgetIdentity} filename="campaign-widget.ts" />
        <p className="mt-4 text-sm leading-6 text-ink-soft">The widget still validates that the host origin appears in the project’s allowed-origin list. Use a numeric <InlineCode>height</InlineCode> only when you intentionally want a fixed, scrollable frame.</p>
      </DocsSection>

      <DocsSection title="Handle sign-in, sign-out, and expiry" description="Tokens expire by design. Treat them like a short-lived projection of your application session, not a new login system.">
        <CodeBlock code={identityLifecycle} language="typescript" filename="our-impact-session.ts" />
        <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
          <li><strong className="text-ink">Sign-in:</strong> request a token after your application knows the current user, then call <InlineCode>setIdentity()</InlineCode>.</li>
          <li><strong className="text-ink">Sign-out or account switch:</strong> call <InlineCode>clearIdentity()</InlineCode> before showing another session.</li>
          <li><strong className="text-ink">Expiry:</strong> request a new token from your server and call <InlineCode>setIdentity()</InlineCode> again. Never persist the token as a durable account credential.</li>
        </ul>
      </DocsSection>

      <DocsSection title="Production identity checklist">
        <div className="grid gap-3 md:grid-cols-2">
          <Check>Identity endpoint requires your real application session.</Check>
          <Check>External user IDs are immutable and at most 120 characters.</Check>
          <Check>Secret key exists only in server-side environment variables.</Check>
          <Check>Every browser origin is explicitly allowed in the developer project.</Check>
          <Check>Account switches clear cached identity before loading the next user.</Check>
          <Check>401 responses trigger token renewal, not secret-key exposure.</Check>
        </div>
      </DocsSection>
    </>
  );
}

function BoundaryCard({ number, title, body }: { number: string; title: string; body: string }) {
  return <article className="rounded-2xl border border-line bg-surface p-5"><span className="text-xs font-bold text-coral-dark">{number}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p></article>;
}

function Check({ children }: { children: React.ReactNode }) {
  return <div className="border-l-2 border-mint bg-surface px-4 py-3 text-sm leading-6 text-ink-soft">{children}</div>;
}
