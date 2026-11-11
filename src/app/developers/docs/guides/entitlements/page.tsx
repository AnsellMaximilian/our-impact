import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Entitlements" };

const browserSdk = `import { OurImpact } from "@our-impact/browser";

const impact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken,
});

const hasTheme = await impact.user.is("community_champion_theme");
const allAccess = await impact.user.all();

if (hasTheme) {
  document.documentElement.dataset.theme = "community-champion";
}`;

const entitlementShape = `{
  "entitlement_key": "community_champion_theme",
  "state": "active",
  "qualifying_count": 1,
  "progress_value": 1,
  "progress_unit": "events",
  "qualified_at": "2026-11-06T12:00:01Z",
  "valid_until": null,
  "updated_at": "2026-11-06T12:00:01Z"
}`;

const serverSdk = `import { OurImpactClient } from "@our-impact/node";

const ourImpact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

const state = await ourImpact.entitlements.listUserEntitlements({
  externalUserId: "storefront:user_01JABC",
});

const hasServerAccess = state.entitlements.some(
  (item) =>
    item.entitlementKey === "community_champion_theme" &&
    item.state === "active" &&
    (!item.validUntil || item.validUntil > new Date()),
);`;

export default function EntitlementsGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Entitlements"
        title="Keep the rule flexible and the product key stable."
        description="An entitlement is Our Impact’s evaluated answer about one supporter. Your application chooses what that answer unlocks."
        badge="Phase two"
      />

      <DocsSection title="Design the contract between teams">
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-line bg-surface p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-coral-dark">Program owner</p><h3 className="mt-3 text-lg font-semibold">Defines who qualifies</h3><p className="mt-2 text-sm leading-6 text-ink-soft">A program or community team can say “donate at least $50” or “complete three donations this month.”</p></article>
          <article className="rounded-2xl border border-line bg-surface p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-coral-dark">Software team</p><h3 className="mt-3 text-lg font-semibold">Defines what the key does</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Code reacts to <InlineCode>community_champion_theme</InlineCode> without duplicating qualification logic.</p></article>
        </div>
      </DocsSection>

      <DocsSection title="Understand the entitlement shape">
        <CodeBlock code={entitlementShape} language="json" filename="entitlement.json" />
        <dl className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          <Field name="state">Current active/inactive answer.</Field>
          <Field name="qualifying_count">Records that matched the rule window.</Field>
          <Field name="progress_value">Count, or accumulated minor currency units.</Field>
          <Field name="progress_unit"><InlineCode>events</InlineCode>, or a lowercase ISO currency code. For example, <InlineCode>5000</InlineCode> plus <InlineCode>usd</InlineCode> means $50.00.</Field>
          <Field name="qualified_at">When the supporter most recently qualified.</Field>
          <Field name="valid_until">Optional expiry; null means no fixed expiration.</Field>
        </dl>
      </DocsSection>

      <DocsSection title="Use the browser helper" description="The preview browser package caches one entitlement request and checks expiry when you call user.is().">
        <CodeBlock code={browserSdk} filename="community-access.ts" />
        <div className="mt-5"><DocsCallout title="Refresh after new activity">Call <InlineCode>impact.refresh()</InlineCode> after a supporter completes a new donation. Call <InlineCode>impact.setIdentity(token)</InlineCode> when the signed-in customer changes.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Choose the read that matches the decision">
        <div className="overflow-hidden border border-line bg-surface">
          <SdkMethod method="user.is(key)" use="Client feature toggles">Returns a boolean and accounts for state and expiry. Use it for themes, badges, and immediate UI changes.</SdkMethod>
          <SdkMethod method="user.get(key)" use="Client progress UI">Returns one full entitlement or null, including qualification count, progress, and validity.</SdkMethod>
          <SdkMethod method="user.all()" use="Client dashboards">Returns all evaluated entitlements from the browser SDK’s shared cached request.</SdkMethod>
          <SdkMethod method="user.profile()" use="Client identity display">Returns the identified supporter profile associated with the current token.</SdkMethod>
          <SdkMethod method="listUserEntitlements()" use="Server authorization">Reads one supporter using the project secret and stable external user ID.</SdkMethod>
        </div>
      </DocsSection>

      <DocsSection title="Enforce sensitive access on the server" description="A browser entitlement is excellent for presentation, but it must not be the only check protecting paid data, private routes, or privileged mutations.">
        <CodeBlock code={serverSdk} filename="lib/our-impact/access.ts" />
        <div className="mt-5"><DocsCallout title="Authorize where the resource lives" tone="secure">For a protected server route, resolve the signed-in user in your own session, derive the same external user ID, and read entitlements with <InlineCode>@our-impact/node</InlineCode>. Never trust a boolean posted back by the browser.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Good entitlement keys">
        <ul className="space-y-3 text-sm leading-6 text-ink-soft">
          <li>Use product language: <InlineCode>community_champion_theme</InlineCode>, <InlineCode>supporter_badge</InlineCode>, or <InlineCode>tier_3</InlineCode>.</li>
          <li>Do not encode thresholds into names such as <InlineCode>donated_50_dollars</InlineCode>; thresholds will change.</li>
          <li>Treat renaming a key as an API-breaking change for the applications using it.</li>
        </ul>
      </DocsSection>
    </>
  );
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return <div><dt><InlineCode>{name}</InlineCode></dt><dd className="mt-1.5 text-sm leading-6 text-ink-soft">{children}</dd></div>;
}

function SdkMethod({ method, use, children }: { method: string; use: string; children: React.ReactNode }) {
  return <div className="grid gap-2 border-b border-line p-5 last:border-0 md:grid-cols-[13rem_12rem_1fr]"><InlineCode>{method}</InlineCode><strong className="text-sm">{use}</strong><div className="text-sm leading-6 text-ink-soft">{children}</div></div>;
}
