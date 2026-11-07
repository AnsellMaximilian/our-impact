"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Building2,
  Code2,
  LayoutDashboard,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard#campaigns", label: "Campaigns", icon: Megaphone, exact: true },
  { href: "/dashboard/organizations", label: "Recipients", icon: Building2 },
  { href: "/dashboard/developers", label: "Developers", icon: Code2 },
  { href: "/developers/docs", label: "Documentation", icon: BookOpenText },
];

export function DashboardNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Dashboard navigation">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const route = href.split("#")[0];
        const active = href.includes("#") ? false : exact ? pathname === route : pathname.startsWith(route);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
              active
                ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-white/62 hover:bg-white/7 hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-mint" : "text-white/48 group-hover:text-white/80")} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
