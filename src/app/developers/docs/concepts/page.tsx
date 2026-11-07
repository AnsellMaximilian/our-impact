import type { Metadata } from "next";
import { ArrowDown, BadgeCheck, Blocks, Gift, Megaphone, UserRound } from "lucide-react";
import { DocsCallout, DocsPageHeader, DocsSection, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Core concepts" };

const resources = [
  {
    icon: Megaphone,
    title: "Campaign",
    body: "A public community program. It controls the published widget, voting rounds, contribution budget, and the recipients supporters can choose.",
  },
  {
    icon: Blocks,
    title: "Developer project",
    body: "An integration boundary. It owns API keys, browser origins, external user identities, entitlement rules, and webhook endpoints.",
  },
  {
    icon: UserRound,
    title: "Supporter",
    body: "Your customer inside one developer project, identified by the stable external user ID supplied by your server.",
  },
  {
    icon: Gift,
    title: "Entitlement",
    body: "A stable product-facing key and its current state. Rules decide when a supporter earns it; your application decides what it unlocks.",
  },
];

export default function CoreConceptsPage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Core concepts"
        title="Campaigns run the program. Projects connect your product."
        description="Both belong to a workspace, but they solve different problems. They connect only when an identified supporter completes verified activity."
      />

      <DocsSection title="The resource model" description="A workspace can publish several campaigns and create several developer projects without pairing them one to one.">
        <div className="grid gap-4 sm:grid-cols-2">
          {resources.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-line bg-surface p-5">
              <Icon className="size-5 text-coral-dark" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
            </article>
          ))}
        </div>
      </DocsSection>

      <DocsSection title="How an identified campaign donation flows" description="The developer project is attached at runtime through the supporter identity token—not through a permanent campaign setting.">
        <div className="mx-auto max-w-2xl space-y-3">
          <FlowStep number="1" title="Your app identifies the supporter" body="Your server issues a short-lived identity token from one developer project." />
          <FlowArrow />
          <FlowStep number="2" title="The campaign widget accepts that identity" body="The campaign and project must share a workspace, and the embedding origin must be allowed by the project." />
          <FlowArrow />
          <FlowStep number="3" title="The supporter contributes to a campaign recipient" body="The donation remains associated with the campaign and selected recipient for payment and reporting." />
          <FlowArrow />
          <FlowStep number="4" title="Our Impact records a project event" body={<>After PayPal capture succeeds, the identified donation becomes a <InlineCode>donation.completed</InlineCode> event in the project that issued the token.</>} />
          <FlowArrow />
          <FlowStep number="5" title="That project evaluates its rules" body="Only matching entitlement rules in that developer project update the supporter’s access." />
        </div>
      </DocsSection>

      <DocsSection title="What is—and is not—connected">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <RelationshipRow label="Campaign → recipient" value="Direct" detail="The campaign defines which connected recipients appear in its widget." />
          <RelationshipRow label="Project → supporter" value="Direct" detail="The project owns the external identity namespace and supporter record." />
          <RelationshipRow label="Project → entitlement" value="Direct" detail="Definitions and earning rules are scoped to one project." />
          <RelationshipRow label="Campaign → project" value="Runtime" detail="There is no permanent one-to-one link. A valid project identity joins them for one supporter session." />
        </div>
        <div className="mt-5">
          <DocsCallout title="Anonymous donations do not grant project entitlements" tone="secure">
            Checkout can succeed without a project identity, but Our Impact cannot attribute that activity to one of your users. Likewise, an identified donation is evaluated only in the project that supplied the token—not across every project in the workspace.
          </DocsCallout>
        </div>
      </DocsSection>

      <DocsSection title="Events outside a campaign">
        <p className="max-w-3xl leading-7 text-ink-soft">
          Campaign widgets automatically record verified, identified PayPal donations. For trusted activity that happens elsewhere, your server can send <InlineCode>POST /api/v1/events</InlineCode> directly to a developer project. Those events can evaluate the same project-scoped entitlement rules without involving a campaign.
        </p>
      </DocsSection>
    </>
  );
}

function FlowStep({ number, title, body }: { number: string; title: string; body: React.ReactNode }) {
  return (
    <article className="grid grid-cols-[42px_1fr] gap-4 rounded-2xl border border-line bg-surface p-5">
      <span className="grid size-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">{number}</span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</div>
      </div>
    </article>
  );
}

function FlowArrow() {
  return <ArrowDown className="mx-auto size-5 text-mint-dark" aria-hidden="true" />;
}

function RelationshipRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="grid gap-2 border-b border-line p-5 last:border-0 sm:grid-cols-[180px_90px_1fr] sm:items-center">
      <strong className="text-sm">{label}</strong>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-bold text-mint-dark">
        <BadgeCheck className="size-3.5" /> {value}
      </span>
      <span className="text-sm leading-6 text-ink-soft">{detail}</span>
    </div>
  );
}
