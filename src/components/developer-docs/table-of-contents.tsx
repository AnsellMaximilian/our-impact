"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type TocItem = { id: string; title: string };

export function DeveloperDocsTableOfContents() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const headings = Array.from(
        document.querySelectorAll<HTMLElement>(".docs-article h2[id][data-docs-heading]"),
      );
      const nextItems = headings.map((heading) => ({
        id: heading.id,
        title: heading.textContent?.trim() ?? heading.id,
      }));
      setItems(nextItems);
      setActiveId(nextItems[0]?.id ?? null);

      const nextObserver = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
          if (visible[0]?.target.id) setActiveId(visible[0].target.id);
        },
        { rootMargin: "-96px 0px -70% 0px", threshold: [0, 1] },
      );
      headings.forEach((heading) => nextObserver.observe(heading));
      observer = nextObserver;
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathname]);

  if (!items.length) return null;

  return (
    <nav aria-label="On this page">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft/55">On this page</p>
      <div className="mt-3 border-l border-line">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              "-ml-px block border-l px-4 py-2 text-xs leading-5 transition",
              activeId === item.id
                ? "border-mint-dark font-semibold text-ink"
                : "border-transparent text-ink-soft hover:border-ink/25 hover:text-ink",
            )}
          >
            {item.title}
          </a>
        ))}
      </div>
    </nav>
  );
}
