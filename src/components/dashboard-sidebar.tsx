"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { DashboardAccountMenu } from "@/components/dashboard-account-menu";
import { DashboardNav } from "@/components/dashboard-nav";

type SidebarContentProps = {
  companyName: string;
  role: string;
  displayName: string;
  initial: string;
  onNavigate?: () => void;
  onClose?: () => void;
};

function SidebarContent({ companyName, role, displayName, initial, onNavigate, onClose }: SidebarContentProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-2">
        <Brand href="/dashboard" className="text-white [&_span:last-child]:text-white" />
        {onClose && <button type="button" onClick={onClose} aria-label="Close menu" className="grid size-10 place-items-center rounded-xl border border-white/12 bg-white/7"><X className="size-5" /></button>}
      </div>
      <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.045] p-3">
        <p className="truncate text-sm font-semibold text-white">{companyName}</p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint/75">{role} workspace</p>
      </div>
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto"><DashboardNav onNavigate={onNavigate} /></div>
      <div className="mt-5 border-t border-white/10 pt-4"><DashboardAccountMenu displayName={displayName} initial={initial} /></div>
    </>
  );
}

export function DashboardSidebar({
  companyName,
  role,
  displayName,
  initial,
}: {
  companyName: string;
  role: string;
  displayName: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-ink px-4 text-white md:hidden">
        <Brand href="/dashboard" compact className="text-white" />
        <p className="min-w-0 flex-1 truncate px-3 text-sm font-semibold">{companyName}</p>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open dashboard navigation" aria-expanded={open} className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/12 bg-white/7 text-white"><Menu className="size-5" /></button>
      </header>

      {open && <button type="button" aria-label="Close dashboard navigation" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink/55 backdrop-blur-[2px] md:hidden" />}

      <aside inert={!open} aria-hidden={!open} className={`fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] flex-col bg-ink px-4 py-5 text-white shadow-[24px_0_70px_rgba(4,18,32,0.34)] transition-transform duration-200 md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent companyName={companyName} role={role} displayName={displayName} initial={initial} onNavigate={() => setOpen(false)} onClose={() => setOpen(false)} />
      </aside>

      <aside className="sticky top-0 z-30 hidden h-screen flex-col bg-ink px-4 py-5 text-white md:flex">
        <SidebarContent companyName={companyName} role={role} displayName={displayName} initial={initial} />
      </aside>
    </>
  );
}
