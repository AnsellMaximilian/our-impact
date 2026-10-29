import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full font-semibold text-ink",
        className,
      )}
      aria-label="Our Impact home"
    >
      <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_rgba(16,38,63,0.10)] ring-1 ring-ink/10">
        <Image
          src="/brand/our-impact-mark.png"
          alt=""
          width={64}
          height={64}
          className="size-11 object-contain"
          priority
        />
      </span>
      {!compact && <span className="display-type text-xl">Our Impact</span>}
    </Link>
  );
}
