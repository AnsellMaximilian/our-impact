import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { Brand } from "@/components/brand";
import { DeveloperDocsNavigation } from "@/components/developer-docs/navigation";

export const metadata: Metadata = {
  title: {
    default: "Developer documentation",
    template: "%s · Developer documentation",
  },
  description: "Integrate verified community support and entitlements with Our Impact.",
};

export default function DeveloperDocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1480px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Brand href="/" />
            <span className="hidden h-6 w-px bg-line sm:block" />
            <span className="hidden text-sm font-semibold text-ink-soft sm:block">Developers</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/openapi" target="_blank" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white hover:text-ink sm:inline-flex">
              OpenAPI <ArrowUpRight className="size-3.5" />
            </a>
            <Link href="/dashboard/developers" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">
              <LayoutDashboard className="size-4" /> Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-5 sm:px-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12 lg:py-10 xl:grid-cols-[250px_minmax(0,920px)_1fr]">
        <div className="mb-7 lg:hidden"><DeveloperDocsNavigation compact /></div>
        <aside className="hidden lg:block">
          <div className="sticky top-28"><DeveloperDocsNavigation /></div>
        </aside>
        <main className="min-w-0 pb-20">{children}</main>
      </div>
    </div>
  );
}
