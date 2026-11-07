"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

export function DashboardAccountMenu({
  displayName,
  initial,
}: {
  displayName: string;
  initial: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {open && (
        <div className="absolute inset-x-0 bottom-[calc(100%+0.5rem)] rounded-2xl bg-white p-2 text-ink shadow-[0_18px_50px_rgba(4,18,32,0.32)] ring-1 ring-ink/10" role="menu">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{displayName}</p>
            <p className="mt-0.5 text-xs text-ink-soft">Workspace account</p>
          </div>
          <div className="my-1 border-t border-ink/8" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-coral-dark transition hover:bg-coral/8">
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/7"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-bold text-ink">{initial}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{displayName}</span><span className="block truncate text-xs text-white/45">Account</span></span>
        <ChevronDown className={`size-4 text-white/40 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
    </div>
  );
}
