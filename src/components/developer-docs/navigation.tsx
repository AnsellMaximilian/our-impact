"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppWindow, BookOpen, Braces, Fingerprint, Gift, Layers3, Radio, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    label: "Start",
    links: [
      { href: "/developers/docs", label: "Overview", icon: BookOpen },
      { href: "/developers/docs/concepts", label: "Core concepts", icon: Layers3 },
      { href: "/developers/docs/quickstart", label: "Quickstart", icon: Rocket },
    ],
  },
  {
    label: "Guides",
    links: [
      { href: "/developers/docs/guides/identity", label: "User identity", icon: Fingerprint },
      { href: "/developers/docs/guides/events", label: "Verified events", icon: Radio },
      { href: "/developers/docs/guides/entitlements", label: "Entitlements", icon: Gift },
      { href: "/developers/docs/guides/nextjs", label: "Next.js integration", icon: AppWindow },
    ],
  },
  {
    label: "Reference",
    links: [
      { href: "/developers/docs/api-reference", label: "REST API", icon: Braces },
    ],
  },
];

export function DeveloperDocsNavigation({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  if (compact) {
    return (
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Developer documentation">
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
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft/60">
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
        "inline-flex items-center gap-2.5 text-sm font-semibold transition",
        compact
          ? "shrink-0 rounded-full border px-3.5 py-2"
          : "flex w-full rounded-xl px-3 py-2.5",
        active
          ? "border-ink bg-ink text-white shadow-sm"
          : "border-line bg-surface/75 text-ink-soft hover:bg-white hover:text-ink",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}
