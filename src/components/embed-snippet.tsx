"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function EmbedSnippet({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false);
  const publicId = publicUrl.split("/").filter(Boolean).at(-1) ?? "your-campaign-id";
  const snippet = `import { OurImpact } from "@our-impact/browser";

const impact = new OurImpact({ publishableKey, userToken });

impact.widgets.mountCampaign({
  target: "#our-impact-campaign",
  publicId: "${publicId}",
  height: "auto",
});`;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold">Browser SDK embed</p>
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
