import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";

export function DocsPageHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <header className="border-b border-line pb-9">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral-dark">{eyebrow}</p>
        {badge && (
          <span className="rounded-full bg-sun/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
            {badge}
          </span>
        )}
      </div>
      <h1 className="display-type mt-3 max-w-4xl text-4xl font-semibold leading-[1.05] tracking-[-0.025em] sm:text-6xl">
        {title}
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-8 text-ink-soft">{description}</p>
    </header>
  );
}

export function DocsSection({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-line py-10 last:border-0">
      <h2 className="display-type text-3xl font-semibold tracking-[-0.02em]">{title}</h2>
      {description && <p className="mt-3 max-w-3xl leading-7 text-ink-soft">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function DocsCallout({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: "info" | "warning" | "secure" | "success";
}) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "secure" ? LockKeyhole : tone === "success" ? CheckCircle2 : Info;
  return (
    <aside
      className={cn(
        "rounded-2xl border p-5",
        tone === "warning" && "border-sun/50 bg-sun/12",
        tone === "secure" && "border-mint/45 bg-mint/10",
        tone === "success" && "border-mint/45 bg-mint/10",
        tone === "info" && "border-line bg-surface",
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-coral-dark" />
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <div className="mt-1.5 text-sm leading-6 text-ink-soft">{children}</div>
        </div>
      </div>
    </aside>
  );
}

export function DocsStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[42px_1fr]">
      <span className="grid size-10 place-items-center rounded-full bg-ink text-sm font-bold text-white">{number}</span>
      <div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <div className="mt-2 leading-7 text-ink-soft">{children}</div>
      </div>
    </div>
  );
}

export function EndpointCard({
  method,
  path,
  title,
  auth,
  children,
}: {
  method: "GET" | "POST";
  path: string;
  title: string;
  auth: string;
  children: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className={cn("rounded-md px-2 py-1 text-[11px] font-black", method === "GET" ? "bg-mint/25 text-mint-dark" : "bg-sun/30 text-ink")}>{method}</span>
        <code className="text-sm font-semibold text-ink">{path}</code>
        <span className="ml-auto text-xs text-ink-soft">{auth}</span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm leading-6 text-ink-soft">{children}</div>
      </div>
    </article>
  );
}

export function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-ink/7 px-1.5 py-0.5 text-[0.88em] font-semibold text-ink">{children}</code>;
}
