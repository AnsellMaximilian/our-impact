"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeBlock({
  code,
  language = "typescript",
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-ink shadow-[0_18px_50px_rgba(16,38,63,0.12)] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold text-white/55">
        <span>{filename ?? language}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-white/65 transition hover:bg-white/10 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? <Check className="size-3.5 text-mint" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-6 text-mint">
        <code>{code}</code>
      </pre>
    </div>
  );
}
