"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

export function Sheet({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-ink/48 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="Close panel"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="sheet-enter absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-paper text-ink shadow-[-24px_0_70px_rgba(16,38,63,0.22)]"
          >
            <header className="flex items-start justify-between gap-5 border-b border-ink/8 bg-surface px-6 py-5 sm:px-8">
              <div>
                <h2 id={titleId} className="display-type text-2xl font-semibold">{title}</h2>
                {description && <p id={descriptionId} className="mt-1 max-w-xl text-sm leading-6 text-ink-soft">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:text-ink"
                aria-label="Close panel"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">{children}</div>
          </section>
        </div>
      )}
    </>
  );
}
