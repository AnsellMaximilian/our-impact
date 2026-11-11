import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, GitBranch, Gift, MonitorUp, ShieldCheck } from "lucide-react";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Overview" };

const entitlementCheck = `const impact = new OurImpact({
  publishableKey: process.env.NEXT_PUBLIC_OUR_IMPACT_PUBLISHABLE_KEY!,
  userToken,
});

if (await impact.user.is("community_champion")) {
  enableCommunityChampionExperience();
}`;

const phases = [
  {
    number: "01",
    icon: MonitorUp,
    title: "Embed the campaign",
    body: "Mount a published campaign with its public ID. No developer project or customer identity is required yet.",
    href: "/developers/docs/guides/widget",
    label: "Widget guide",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Identify supporters",
    body: "Use your project secret on the server to mint a short-lived token for the customer your app already authenticated.",
    href: "/developers/docs/guides/identity",
    label: "Identity guide",
  },
  {
    number: "03",
    icon: Gift,
    title: "Check entitlements",
    body: "Use the publishable key and identity token in the browser, or the secret SDK for authoritative server checks.",
    href: "/developers/docs/guides/entitlements",
    label: "Entitlement guide",
  },
];

const referenceBranches = [
  {
    label: "main",
    title: "Before integration",
    body: "A working paper storefront with its own accounts, catalog, cart, and checkout. No Our Impact code.",
    href: "https://github.com/AnsellMaximilian/paper-company-website/tree/main",
  },
  {
    label: "phase one",
    title: "Campaign widget",
    body: "Adds @our-impact/browser and mounts a public campaign without changing the storefront’s identity system.",
    href: "https://github.com/AnsellMaximilian/paper-company-website/tree/phase_one-install-and-mount-widget",
  },
  {
    label: "phase two",
    title: "Identity and entitlement",
    body: "Adds the server SDK, short-lived identity, identified widget, entitlement check, and a product-specific reward.",
    href: "https://github.com/AnsellMaximilian/paper-company-website/tree/phase_two-integrate-entitlement-and-special-features",
  },
];

export default function DeveloperDocumentationPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Our Impact developer platform"
        title="Ship the widget. Identify supporters. Check entitlements."
        description="A complete integration path for adding a community campaign to an existing product without replacing its authentication, payments, or customer database."
        badge="Sandbox API"
      />

      <DocsSection
        title="Integration path"
        description="Start with the smallest useful integration. Each phase works independently and builds on the previous one."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {phases.map(({ number, icon: Icon, title, body, href, label }) => (
            <Link key={number} href={href} className="group flex min-h-64 flex-col rounded-xl border border-line bg-white p-6 transition hover:-translate-y-0.5 hover:border-mint-dark/40 hover:shadow-[0_16px_40px_rgba(16,38,63,0.08)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-ink-soft/55">PHASE {number}</span>
                <Icon className="size-5 text-mint-dark" />
              </div>
              <h3 className="mt-8 text-2xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold text-ink">{label} <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </DocsSection>

      <DocsSection title="Before you write code" description="The SDKs consume configuration created in the dashboard. Complete these checks once for each environment.">
        <div className="grid gap-3 lg:grid-cols-2">
          {[
            ["Publish a campaign", "Copy the public ID from its embed URL."],
            ["Create a developer project", "Copy the publishable key and one-time secret key."],
            ["Add allowed browser origins", "Include the exact protocol, host, and port used by your app."],
            ["Create an entitlement rule", "Choose a stable key your product can depend on."],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-3 rounded-xl border border-line bg-white p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint-dark" />
              <div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-ink-soft">{body}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <DocsCallout title="Two keys, two trust boundaries" tone="secure">
            Keep <InlineCode>oi_sk_*</InlineCode> on your server. The <InlineCode>oi_pk_*</InlineCode> publishable key is safe for browser code, but browser entitlement requests also require a short-lived identity token and an allowed origin.
          </DocsCallout>
        </div>
      </DocsSection>

      <DocsSection title="The final product check" description="Program owners can evolve the earning rule while your application continues to depend on one stable entitlement key.">
        <CodeBlock code={entitlementCheck} language="tsx" filename="components/community-access.tsx" />
      </DocsSection>

      <DocsSection title="Follow a real integration" description="The Michael Scott Paper Company repository records the integration as three reviewable Git branches, from an untouched storefront to an identified entitlement experience.">
        <div className="grid gap-4 lg:grid-cols-3">
          {referenceBranches.map((branch) => (
            <a key={branch.label} href={branch.href} target="_blank" rel="noreferrer" className="group rounded-xl border border-line bg-white p-5 hover:border-ink/25">
              <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-coral-dark"><GitBranch className="size-4" /> {branch.label}</span>
              <h3 className="mt-4 text-lg font-semibold">{branch.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{branch.body}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">View branch <ArrowRight className="size-4 transition group-hover:translate-x-1" /></span>
            </a>
          ))}
        </div>
      </DocsSection>
    </>
  );
}
