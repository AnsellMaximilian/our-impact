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

export default function EntitlementsGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Guide · Entitlements"
        title="Keep the rule flexible and the product key stable."
        description="An entitlement is Our Impact’s evaluated answer about one supporter. Your application chooses what that answer unlocks."
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
