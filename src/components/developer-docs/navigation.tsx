"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, BookOpen, Braces, Fingerprint, Gift, Layers3, MonitorUp, Radio, Rocket, Webhook } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "Get started",
    links: [
      { href: "/developers/docs", label: "Overview", icon: BookOpen },
      { href: "/developers/docs/quickstart", label: "Quickstart", icon: Rocket },
    ],
  },
  {
    label: "Integration path",
    links: [
      { href: "/developers/docs/guides/widget", label: "1. Embed a campaign", icon: MonitorUp },
      { href: "/developers/docs/guides/identity", label: "2. Identify supporters", icon: Fingerprint },
      { href: "/developers/docs/guides/entitlements", label: "3. Check entitlements", icon: Gift },
    ],
  },
  {
    label: "Guides",
    links: [
      { href: "/developers/docs/guides/nextjs", label: "Next.js integration", icon: AppWindow },
      { href: "/developers/docs/guides/events", label: "Verified events", icon: Radio },
      { href: "/developers/docs/guides/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    label: "Reference",
    links: [
      { href: "/developers/docs/concepts", label: "Core concepts", icon: Layers3 },
      { href: "/developers/docs/api-reference", label: "REST API", icon: Braces },
    ],
  },
];

export function DeveloperDocsNavigation({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  if (compact) {
    return (
      <nav className="flex gap-2 overflow-x-auto py-1 lg:hidden" aria-label="Developer documentation">
        {sections.flatMap((section) => section.links).map((link) => (
          <NavLink key={link.href} {...link} active={pathname === link.href} compact />
        ))}
      </nav>
    );
  }

  return (
    <nav className="space-y-7" aria-label="Developer documentation">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft/55">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.links.map((link) => (
              <NavLink key={link.href} {...link} active={pathname === link.href} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact = false,
}: {
  href: string;
  label: string;
  icon: typeof BookOpen;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 text-[13px] font-semibold transition",
        compact
          ? "shrink-0 rounded-lg border px-3.5 py-2"
          : "flex w-full rounded-lg px-3 py-2.5",
        active
          ? "border-mint/30 bg-mint/14 text-ink"
          : "border-line bg-transparent text-ink-soft hover:bg-white hover:text-ink",
      )}
    >
      <Icon className={cn("size-4", active && "text-mint-dark")} />
      {label}
    </Link>
  );
}
