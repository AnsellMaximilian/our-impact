"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function EmbedSnippet({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false);
  const publicId = publicUrl.split("/").filter(Boolean).at(-1) ?? "your-campaign-id";
  const snippet = `import { mountCampaign } from "@our-impact/browser";

// Add <div id="our-impact-campaign"></div> to your page.

const campaign = mountCampaign({
  target: "#our-impact-campaign",
  publicId: "${publicId}",
  height: "auto",
});

// When this view is removed:
campaign.destroy();`;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Simple campaign embed</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">No API keys or customer identity required.</p>
        </div>
        <button
          type="button"
          onClick={copySnippet}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90"
        >
          {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="mt-3 block max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-ink/[0.04] p-3 text-xs leading-5 text-ink-soft">
        {snippet}
      </code>
    </div>
  );
}
