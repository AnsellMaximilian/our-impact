import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Braces,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Code2,
  Gift,
  HandHeart,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Vote,
} from "lucide-react";
import { Brand } from "@/components/brand";

const productLoop = [
  {
    icon: Building2,
    step: "01",
    title: "Bring your community together",
    copy: "Invite trusted recipients, connect their PayPal accounts, and publish a campaign your customers can vote on or support directly.",
  },
  {
    icon: CircleDollarSign,
    step: "02",
    title: "Let PayPal verify the contribution",
    copy: "Supporters complete checkout with PayPal. Our Impact records the verified result without exposing card details or recipient credentials.",
  },
  {
    icon: Gift,
    step: "03",
    title: "Turn support into belonging",
    copy: "Use clear rules to unlock badges, access, themes, messages, or any customer experience your product can provide.",
  },
];

const boundaries = [
  {
    icon: HandHeart,
    title: "Recipients stay in control",
    copy: "Each organization connects its own PayPal account. You never collect its password or move money through a shared wallet.",
  },
  {
    icon: ShieldCheck,
    title: "Verified activity, predictable rules",
    copy: "Donation events come from confirmed captures. Entitlement rules remain deterministic, reviewable, and owned by your team.",
  },
  {
    icon: Braces,
    title: "One stable key in your product",
    copy: "Your developers check an entitlement key while program owners evolve the earning rule without another product release.",
  },
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex" aria-label="Main navigation">
          <a href="#how-it-works" className="transition hover:text-ink">How it works</a>
          <a href="#quickstart" className="transition hover:text-ink">Quickstart</a>
          <Link href="/developers/docs" className="transition hover:text-ink">Documentation</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white/70 hover:text-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(16,38,63,0.16)] transition hover:-translate-y-0.5 hover:bg-ink/90"
          >
            Start building
          </Link>
        </div>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:pb-28">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-ink-soft ring-1 ring-ink/8 backdrop-blur">
            <Sparkles className="size-4 text-coral" aria-hidden="true" />
            Donations and customer benefits, connected
          </div>
          <h1 className="display-type max-w-4xl text-6xl font-semibold leading-[0.92] sm:text-7xl lg:text-[5.55rem]">
            Add community giving to your product.
            <span className="text-coral-dark"> Skip the payment plumbing.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-ink-soft sm:text-xl sm:leading-9">
            Embed a campaign, let customers vote or donate through PayPal, and turn verified support into badges, access, rewards, or any experience your product can unlock.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-coral px-7 font-semibold text-white shadow-[0_12px_28px_rgba(200,73,59,0.24)] transition hover:-translate-y-0.5 hover:bg-coral-dark"
            >
              Create your workspace <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/developers/docs/quickstart"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-white px-7 font-semibold text-ink ring-1 ring-ink/10 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <Code2 className="size-4" aria-hidden="true" /> Read the quickstart
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {["Hosted campaign widgets", "PayPal-connected recipients", "Node and browser SDKs"].map((item) => (
              <span key={item} className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-mint-dark" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div className="absolute -inset-12 -z-10 rounded-full bg-mint/20 blur-3xl" />
          <div className="paper-grid relative rounded-[2.35rem] bg-surface p-5 shadow-[0_30px_80px_rgba(16,38,63,0.16)] ring-1 ring-ink/8 sm:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Customer experience</p>
                <p className="mt-1 text-lg font-semibold">Rooted in Community</p>
              </div>
              <span className="rounded-full bg-mint/25 px-3 py-1.5 text-xs font-bold text-mint-dark">Campaign live</span>
            </div>

            <div className="mt-5 space-y-3">
              <CampaignChoice name="Duluth Community Garden" category="Community" progress="62%" color="bg-mint" />
              <CampaignChoice name="Duluth Animal Shelter" category="Animal welfare" progress="38%" color="bg-coral" />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="rounded-2xl bg-ink p-4 text-white">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-mint">
                  <CircleDollarSign className="size-4" aria-hidden="true" /> Verified activity
                </p>
                <p className="mt-2 font-semibold">$50 donation completed</p>
                <p className="mt-1 text-xs text-white/60">PayPal capture confirmed</p>
              </div>
              <ArrowRight className="mx-auto hidden size-5 text-coral sm:block" aria-hidden="true" />
              <div className="rounded-2xl bg-coral/12 p-4 ring-1 ring-coral/20">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-coral-dark">
                  <BadgeCheck className="size-4" aria-hidden="true" /> Benefit unlocked
                </p>
                <p className="mt-2 font-semibold">Community Champion</p>
                <p className="mt-1 text-xs text-ink-soft">Active for this customer</p>
              </div>
            </div>
          </div>

          <Image
            src="/brand/luma-firefly.png"
            alt=""
            width={240}
            height={240}
            className="absolute -bottom-16 -right-10 hidden h-auto w-32 -rotate-6 drop-shadow-[0_18px_22px_rgba(16,38,63,0.16)] sm:block lg:-right-14 lg:w-36"
            priority
          />
        </div>
      </section>

      <section id="how-it-works" className="bg-ink px-5 py-20 text-white sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">One connected loop</p>
              <h2 className="display-type mt-4 text-4xl font-semibold leading-tight sm:text-6xl">
                From contribution to customer experience.
              </h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-white/65 lg:justify-self-end">
              Our Impact connects the public campaign, verified payment event, supporter identity, and product benefit—so your team does not have to assemble them from separate systems.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {productLoop.map(({ icon: Icon, step, title, copy }) => (
              <article key={title} className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
                <div className="mb-8 flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-full bg-mint text-ink">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-white/35">{step}</span>
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 leading-7 text-white/65">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">For program owners and product teams</p>
            <h2 className="display-type mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Change the earning rule. Keep the product key.
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
              Create an entitlement in plain language, review the exact rule, and expose one stable key to your application. Your program can evolve without turning every change into an engineering project.
            </p>
            <div className="mt-8 space-y-4">
              <FeatureLine icon={Sparkles} title="Draft rules with the assistant" copy="Describe the outcome you want, then review every proposed change before it goes live." />
              <FeatureLine icon={BadgeCheck} title="See who qualifies and why" copy="Track supporter progress, active grants, and the verified events behind each result." />
              <FeatureLine icon={Code2} title="Use the same key everywhere" copy="Check access from the browser for personalization or from your server for authorization." />
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-5 shadow-[0_24px_65px_rgba(16,38,63,0.12)] ring-1 ring-ink/10 sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Entitlement catalog</p>
                <h3 className="mt-1 text-xl font-semibold">Community Champion</h3>
              </div>
              <span className="rounded-full bg-mint/25 px-3 py-1.5 text-xs font-bold text-mint-dark">Active</span>
            </div>
            <div className="mt-5 rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Earning path</p>
              <div className="mt-4 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-mint-dark ring-1 ring-ink/8">
                  <CircleDollarSign className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">Lifetime donations of at least $50</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">Evaluated after every verified contribution.</p>
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl bg-ink text-sm text-white shadow-inner">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-white/55">
                <span>customer-benefits.ts</span>
                <span className="flex items-center gap-1.5 text-mint"><span className="size-1.5 rounded-full bg-mint" /> Connected</span>
              </div>
              <pre className="overflow-x-auto p-5 leading-7"><code>{`const isChampion = await impact.user.is(
  "community_champion"
);

if (isChampion) unlockCommunityTheme();`}</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section id="quickstart" className="border-y border-line bg-white/60 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Quickstart</p>
            <h2 className="display-type mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Start with one campaign. Connect it in an afternoon.
            </h2>
            <p className="mt-6 text-lg leading-8 text-ink-soft">
              Set up the community program in the dashboard, then hand your product team two SDKs and a stable entitlement key.
            </p>
            <Link href="/developers/docs/quickstart" className="mt-8 inline-flex items-center gap-2 font-semibold text-coral-dark transition hover:text-ink">
              Open the complete quickstart <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <QuickStep number="1" icon={Building2} title="Create the program">Add recipient organizations and publish a campaign with the causes your community can support.</QuickStep>
            <QuickStep number="2" icon={MousePointerClick} title="Embed the campaign">Mount the hosted widget in your site and identify the signed-in customer with a short-lived token.</QuickStep>
            <QuickStep number="3" icon={Sparkles} title="Define the benefit">Create an entitlement and choose the donation, voting, or participation rule that earns it.</QuickStep>
            <QuickStep number="4" icon={Code2} title="React in your product">Query the entitlement key to render a theme, badge, message, feature, or protected experience.</QuickStep>
            <div className="overflow-hidden rounded-[1.75rem] bg-ink text-sm text-white shadow-[0_18px_50px_rgba(16,38,63,0.16)] sm:col-span-2">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-white/55">
                <span>Terminal</span>
                <span>Node 20+</span>
              </div>
              <pre className="overflow-x-auto p-5 text-mint"><code>pnpm add @our-impact/node @our-impact/browser</code></pre>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint-dark">Clear boundaries by design</p>
          <h2 className="display-type mx-auto mt-4 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-6xl">
            Easier setup without hiding who controls what.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {boundaries.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="rounded-[2rem] bg-white p-7 shadow-[0_14px_40px_rgba(16,38,63,0.07)] ring-1 ring-ink/8">
              <span className="grid size-11 place-items-center rounded-full bg-mint/25 text-mint-dark">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-7 text-xl font-semibold">{title}</h3>
              <p className="mt-3 leading-7 text-ink-soft">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-8 sm:px-8 sm:pb-12">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-ink px-7 py-12 text-white shadow-[0_28px_75px_rgba(16,38,63,0.18)] sm:px-12 sm:py-16">
          <div className="absolute inset-y-0 right-0 hidden w-[42%] opacity-35 lg:block">
            <Image src="/illustrations/hero-botanical-landscape.png" alt="" fill className="object-cover object-left" sizes="42vw" />
          </div>
          <div className="relative z-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Your first community program</p>
            <h2 className="display-type mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl">
              Give customers a reason to participate—and a benefit they can carry forward.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">
              Create a workspace, invite one recipient, publish one campaign, and connect the result to your product when you are ready.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-mint px-7 font-semibold text-ink transition hover:-translate-y-0.5 hover:bg-white">
                Start building <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/developers/docs" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-white/20 px-7 font-semibold text-white transition hover:bg-white/10">
                Browse documentation
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Brand />
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/developers/docs" className="hover:text-ink">Documentation</Link>
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <span>© 2026 Our Impact</span>
        </div>
      </footer>
    </main>
  );
}

function CampaignChoice({ name, category, progress, color }: { name: string; category: string; progress: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="mt-1 text-xs text-ink-soft">{category}</p>
        </div>
        <span className="grid size-9 place-items-center rounded-full bg-paper text-xs font-bold text-ink">{progress}</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className={`h-full rounded-full ${color}`} style={{ width: progress }} />
      </div>
    </div>
  );
}

function FeatureLine({ icon: Icon, title, copy }: { icon: typeof Sparkles; title: string; copy: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-mint/25 text-mint-dark">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 leading-6 text-ink-soft">{copy}</p>
      </div>
    </div>
  );
}

function QuickStep({ number, icon: Icon, title, children }: { number: string; icon: typeof Vote; title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-[1.75rem] bg-white p-6 shadow-[0_12px_35px_rgba(16,38,63,0.06)] ring-1 ring-ink/8">
      <div className="flex items-center justify-between">
        <span className="grid size-10 place-items-center rounded-full bg-mint/25 text-mint-dark"><Icon className="size-5" aria-hidden="true" /></span>
        <span className="text-sm font-bold text-ink/25">{number}</span>
      </div>
      <h3 className="mt-6 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p>
    </article>
  );
}
