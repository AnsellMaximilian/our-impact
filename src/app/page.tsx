import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Eye,
  HandHeart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/brand";

const proofPoints = [
  {
    icon: HandHeart,
    title: "Commit clearly",
    copy: "Show the recurring amount your company has promised before a single vote is cast.",
  },
  {
    icon: BarChart3,
    title: "Choose together",
    copy: "Invite the community to shape allocation across a small, thoughtfully curated slate.",
  },
  {
    icon: ShieldCheck,
    title: "Report honestly",
    copy: "Keep committed, allocated, and paid amounts distinct as the product grows.",
  },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <div className="flex items-center gap-2">
          <Link
            href="/embed/demo-coffee-community"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white/70 hover:text-ink sm:inline-flex"
          >
            View demo
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,38,63,0.16)] transition hover:-translate-y-0.5 hover:bg-ink/90"
          >
            Start a campaign
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.06fr_0.94fr] lg:pb-28">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-ink/8 backdrop-blur">
            <Sparkles className="size-4 text-coral" aria-hidden="true" />
            Giving people can see and shape
          </div>
          <h1 className="display-type max-w-4xl text-6xl font-semibold leading-[0.92] sm:text-7xl lg:text-[5.8rem]">
            Make your giving promise public.
            <span className="text-coral-dark"> Make its impact shared.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft sm:text-xl sm:leading-9">
            Our Impact helps companies turn a recurring giving commitment into a transparent, community-directed campaign—without pretending a promise is already a payment.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-coral px-7 font-semibold text-white shadow-[0_12px_28px_rgba(200,73,59,0.24)] transition hover:-translate-y-0.5 hover:bg-coral-dark"
            >
              Create a draft <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/embed/demo-coffee-community"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-7 font-semibold text-ink ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Eye className="size-4" aria-hidden="true" /> See the public mock
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
            <CheckCircle2 className="size-4 text-mint-dark" aria-hidden="true" />
            Stage 0 foundation · no payments or real voting yet
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute -inset-10 -z-10 rounded-full bg-mint/20 blur-3xl" />
          <div className="paper-grid rotate-1 rounded-[2.5rem] bg-surface p-5 shadow-[0_30px_80px_rgba(16,38,63,0.16)] ring-1 ring-ink/8 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Live commitment</p>
                <p className="mt-1 text-lg font-semibold">Sunrise Coffee gives $100 each week</p>
              </div>
              <Image
                src="/brand/our-impact-mark.png"
                alt=""
                width={72}
                height={72}
                className="size-14 rounded-full bg-white object-contain"
              />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Bright Steps", "City Canopy", "Open Table Network", "Sea Change Lab"].map((name, index) => (
                <div key={name} className="rounded-2xl bg-white p-4 ring-1 ring-ink/8">
                  <span
                    className="mb-3 block size-3 rounded-full"
                    style={{ backgroundColor: ["#F06A55", "#2F9E78", "#E6A23C", "#3D7EA6"][index] }}
                  />
                  <p className="font-semibold">{name}</p>
                  <p className="mt-1 text-xs text-ink-soft">Fictional organization</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-ink px-5 py-4 text-white">
              <p className="text-sm font-semibold">Stage 2 freezes each allocation</p>
              <p className="mt-1 text-xs leading-5 text-white/65">Commitments, allocations, and company-reported payments remain visibly distinct.</p>
            </div>
          </div>
          <Image
            src="/brand/luma-firefly.png"
            alt="Luma, the Our Impact firefly mascot"
            width={320}
            height={320}
            className="absolute -bottom-20 -right-12 hidden h-auto w-48 -rotate-6 drop-shadow-[0_20px_25px_rgba(16,38,63,0.18)] sm:block lg:-right-20 lg:w-56"
            priority
          />
        </div>
      </section>

      <section className="bg-ink px-5 py-20 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">How the promise stays honest</p>
            <h2 className="display-type mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
              Transparency starts with using the right words.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {proofPoints.map(({ icon: Icon, title, copy }, index) => (
              <article key={title} className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
                <div className="mb-8 flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-full bg-mint text-ink">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-white/35">0{index + 1}</span>
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-white/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 sm:px-8 sm:py-24 md:grid-cols-[0.65fr_1fr]">
        <Image
          src="/brand/luma-firefly.png"
          alt="Luma, a firefly mascot holding a tiny glowing loop"
          width={520}
          height={520}
          className="mx-auto h-auto w-full max-w-sm drop-shadow-[0_28px_34px_rgba(16,38,63,0.14)]"
        />
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Meet Luma</p>
          <h2 className="display-type mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl">
            A little light for the gap between promised and delivered.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
            Luma is our friendly reminder that trust comes from showing what changed, what hasn’t, and what still needs to happen.
          </p>
          <Link href="/login" className="mt-8 inline-flex items-center gap-2 font-semibold text-coral-dark hover:text-ink">
            Build your first draft <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
