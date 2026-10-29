import Link from "next/link";
import { Brand } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-16">
      <section className="w-full max-w-xl rounded-[2rem] bg-surface p-8 text-center shadow-[0_24px_70px_rgba(16,38,63,0.10)] ring-1 ring-ink/8 sm:p-12">
        <div className="flex justify-center"><Brand /></div>
        <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Campaign not found</p>
        <h1 className="display-type mt-3 text-5xl font-semibold">This impact link isn’t public.</h1>
        <p className="mt-5 leading-7 text-ink-soft">
          It may be a private draft, an expired link, or a campaign that doesn’t exist.
        </p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-ink px-6 font-semibold text-white hover:bg-ink/90">
          Return home
        </Link>
      </section>
    </main>
  );
}
