import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { Brand } from "@/components/brand";
import { DeveloperDocsNavigation } from "@/components/developer-docs/navigation";
import { DeveloperDocsTableOfContents } from "@/components/developer-docs/table-of-contents";

export const metadata: Metadata = {
  title: {
    default: "Developer documentation",
    template: "%s · Developer documentation",
  },
  description: "Integrate verified community support and entitlements with Our Impact.",
};

export default function DeveloperDocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-shell min-h-screen bg-[#f8faf9] text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur-xl">
        <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:h-18 lg:px-8">
          <div className="flex items-center gap-4">
            <Brand href="/" />
            <span className="hidden h-6 w-px bg-line sm:block" />
            <Link href="/developers/docs" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:block">Developers</Link>
            <span className="hidden rounded-md bg-mint/15 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-mint-dark md:inline">Sandbox</span>
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

      <div className="w-full lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] 2xl:grid-cols-[17rem_minmax(0,1fr)_15rem]">
        <div className="border-b border-line px-4 py-3 sm:px-6 lg:hidden"><DeveloperDocsNavigation compact /></div>
        <aside className="hidden border-r border-line bg-white/55 lg:block">
          <div className="sticky top-18 h-[calc(100vh-4.5rem)] overflow-y-auto px-5 py-8"><DeveloperDocsNavigation /></div>
        </aside>
        <main className="docs-article min-w-0 px-5 py-8 pb-24 sm:px-8 lg:px-10 lg:py-12 xl:px-14 2xl:px-16">{children}</main>
        <aside className="hidden border-l border-line bg-white/45 2xl:block">
          <div className="sticky top-18 max-h-[calc(100vh-4.5rem)] overflow-y-auto px-6 py-10">
            <DeveloperDocsTableOfContents />
          </div>
        </aside>
      </div>
    </div>
  );
}
