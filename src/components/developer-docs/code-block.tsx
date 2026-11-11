import type { BundledLanguage } from "shiki";
import { codeToHtml } from "shiki";
import { CopyCodeButton } from "@/components/developer-docs/copy-code-button";

const languageAliases: Record<string, BundledLanguage | "text"> = {
  bash: "bash",
  dotenv: "dotenv",
  html: "html",
  http: "http",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  shell: "bash",
  text: "text",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
};

export async function CodeBlock({
  code,
  language = "typescript",
  filename,
}: {
  code: string;
  language?: string;
  filename?: string;
}) {
  const normalizedLanguage = languageAliases[language] ?? "text";
  const html = await codeToHtml(code.trim(), {
    lang: normalizedLanguage,
    theme: "github-dark-default",
  });

  return (
    <figure className="docs-code min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1b2a] shadow-[0_18px_50px_rgba(16,38,63,0.14)]">
      <figcaption className="flex min-h-11 items-center justify-between gap-4 border-b border-white/10 bg-[#12243a] px-4 text-[11px] font-semibold text-white/60">
        <span className="flex min-w-0 items-center gap-3">
          <span className="hidden items-center gap-1.5 sm:flex" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#ff705d]" />
            <span className="size-2.5 rounded-full bg-[#ffc95c]" />
            <span className="size-2.5 rounded-full bg-[#74dfbd]" />
          </span>
          <span className="truncate font-mono">{filename ?? language}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden uppercase tracking-[0.14em] text-white/35 sm:inline">{language}</span>
          <CopyCodeButton code={code.trim()} />
        </span>
      </figcaption>
      <div
        className="docs-code-highlight overflow-x-auto text-[13px] leading-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
