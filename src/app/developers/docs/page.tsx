import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Braces, Fingerprint, Gift, Radio, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Overview" };

const entitlementCheck = `const impact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken,
});

if (await impact.user.is("community_champion_theme")) {
  enableCommunityTheme();
}`;

const concepts = [
  {
    icon: Fingerprint,
    title: "Mike owns identity",
    body: "Your application keeps its login system and sends the stable user ID it already trusts.",
    href: "/developers/docs/guides/identity",
  },
  {
    icon: Radio,
    title: "Events prove support",
    body: "Our Impact records verified activity, including completed donations from the hosted widget.",
    href: "/developers/docs/guides/events",
  },
  {
    icon: Gift,
    title: "Entitlements power UX",
    body: "Stable keys let your product unlock themes, badges, roles, messages, or your own custom behavior.",
    href: "/developers/docs/guides/entitlements",
  },
];

export default function DeveloperDocumentationPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Our Impact developer platform"
        title="Turn verified support into product experiences."
        description="Connect your own users to community campaigns, accept verified activity, and ask one simple question: what has this supporter unlocked?"
        badge="Sandbox"
      />

      <DocsSection title="The integration model" description="Our Impact fits alongside your existing authentication and product. It does not become your customer database or payment account.">
        <div className="grid gap-4 md:grid-cols-3">
          {concepts.map(({ icon: Icon, title, body, href }) => (
            <Link key={title} href={href} className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-lg">
              <Icon className="size-5 text-coral-dark" />
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-ink">Read guide <ArrowRight className="size-3.5 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid items-center gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FlowNode label="Your app" detail="Mike signs Jamie in" />
          <ArrowRight className="mx-auto size-5 rotate-90 text-ink-soft sm:rotate-0" />
          <FlowNode label="Our Impact" detail="Evaluates verified support" accent />
          <ArrowRight className="mx-auto size-5 rotate-90 text-ink-soft sm:rotate-0" />
          <FlowNode label="Your experience" detail="Unlocks a theme or role" />
        </div>
      </DocsSection>

      <DocsSection title="One check, any product reaction" description="Rules stay editable in the Our Impact dashboard. Your application depends only on the entitlement key.">
        <CodeBlock code={entitlementCheck} filename="shop-theme.ts" />
        <div className="mt-5">
          <DocsCallout title="SDK packages are in preview">
            The package APIs shown in these guides are stable in the repository but are not on npm yet. Use the REST API today, or test the local packages from the Mike’s Vegan Shop example. Publishing is the next distribution step.
          </DocsCallout>
        </div>
      </DocsSection>

      <DocsSection title="Choose where to begin">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/developers/docs/quickstart" className="rounded-2xl bg-ink p-6 text-white">
            <ShieldCheck className="size-5 text-mint" />
            <h3 className="mt-5 text-xl font-semibold">Build the first integration</h3>
            <p className="mt-2 text-sm leading-6 text-white/65">Create a token, identify a customer, and read their entitlements using plain fetch.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-mint">Open quickstart <ArrowRight className="size-4" /></span>
          </Link>
          <Link href="/developers/docs/api-reference" className="rounded-2xl border border-line bg-surface p-6">
            <Braces className="size-5 text-coral-dark" />
            <h3 className="mt-5 text-xl font-semibold">Explore the REST API</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">Review authentication, payloads, status codes, and the downloadable OpenAPI contract.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Open reference <ArrowRight className="size-4" /></span>
          </Link>
        </div>
      </DocsSection>
    </>
  );
}

function FlowNode({ label, detail, accent = false }: { label: string; detail: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-xl bg-mint/15 p-4" : "p-4"}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-coral-dark">{label}</p>
      <p className="mt-1 text-sm text-ink-soft">{detail}</p>
    </div>
  );
}
