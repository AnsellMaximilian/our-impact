import type { Metadata } from "next";
import { CodeBlock } from "@/components/developer-docs/code-block";
import { DocsCallout, DocsPageHeader, DocsSection, DocsStep, InlineCode } from "@/components/developer-docs/ui";

export const metadata: Metadata = { title: "Embed a campaign" };

const install = `pnpm add @our-impact/browser`;

const widget = `"use client";

import { mountCampaign, type CampaignWidgetStatus } from "@our-impact/browser";
import { useEffect, useRef, useState } from "react";

export function CommunityCampaign({ publicId }: { publicId: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CampaignWidgetStatus>("loading");

  useEffect(() => {
    if (!target.current) return;

    const campaign = mountCampaign({
      target: target.current,
      publicId,
      title: "Vote in our community campaign",
      height: "auto",
      minHeight: 520,
      borderRadius: 20,
      onStatusChange: setStatus,
    });

    return () => campaign.destroy();
  }, [publicId]);

  return (
    <section aria-busy={status === "loading"}>
      <div ref={target} />
      {status === "error" && <p role="alert">Campaign unavailable.</p>}
    </section>
  );
}`;

const options = `mountCampaign({
  target: "#community-campaign", // HTMLElement or selector
  publicId: "your-public-campaign-id",
  title: "Community campaign",   // iframe accessible name
  height: "auto",               // or a fixed pixel value
  minHeight: 420,
  maxHeight: 900,
  borderRadius: 24,
  onStatusChange(status) {
    // loading | ready | identified | anonymous | error
  },
});`;

export default function WidgetGuidePage() {
  return (
    <>
      <DocsPageHeader
        eyebrow="Integration path · Phase one"
        title="Embed a published campaign."
        description="Add voting and direct recipient donations to an existing website with one public campaign ID. A developer project is not required for this phase."
        badge="Browser SDK"
      />

      <DocsSection title="Get the public campaign ID">
        <p className="max-w-4xl leading-7 text-ink-soft">Publish the campaign in Our Impact, open its embed page, and copy the value after <InlineCode>/embed/</InlineCode>. The public ID is safe to include in browser code and is different from the campaign’s internal database ID.</p>
      </DocsSection>

      <DocsSection title="Install and mount">
        <div className="space-y-10">
          <DocsStep number={1} title="Install the browser SDK">
            <CodeBlock code={install} language="bash" filename="Terminal" />
          </DocsStep>
          <DocsStep number={2} title="Create a client component">
            <CodeBlock code={widget} language="tsx" filename="components/community-campaign.tsx" />
          </DocsStep>
          <DocsStep number={3} title="Render it on the page">
            <p>Pass the public ID from configuration and place the component wherever the campaign should appear. Always destroy the returned widget during component cleanup.</p>
          </DocsStep>
        </div>
      </DocsSection>

      <DocsSection title="Widget options" description="The browser SDK owns iframe creation, safe message handling, and automatic height updates.">
        <CodeBlock code={options} language="typescript" filename="widget-options.ts" />
        <div className="mt-5"><DocsCallout title="Anonymous is valid">Without identity, supporters can still view, vote, and donate. Their payment remains part of the campaign, but it cannot qualify one of your application users for a project entitlement.</DocsCallout></div>
      </DocsSection>

      <DocsSection title="Production checklist">
        <ul className="grid gap-3 lg:grid-cols-2">
          {[
            "The campaign is published and has active recipients.",
            "The public ID comes from the embed URL.",
            "The target element exists before mounting.",
            "The widget is destroyed during route or component cleanup.",
            "The iframe has a meaningful title.",
            "Loading and error states are visible to the user.",
          ].map((item) => <li key={item} className="rounded-xl border border-line bg-white p-4 text-sm leading-6 text-ink-soft">{item}</li>)}
        </ul>
      </DocsSection>
    </>
  );
}
