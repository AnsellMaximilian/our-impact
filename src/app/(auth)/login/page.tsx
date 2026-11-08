import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Code2,
  HeartHandshake,
} from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { AuthFeedback } from "@/components/auth-feedback";
import { Brand } from "@/components/brand";
import { safeInternalRedirect } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  const nextPath = safeInternalRedirect(query.next);

  return (
    <main className="min-h-screen px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <Brand />
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-white/70 hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back home
          </Link>
        </div>

        <div className="grid items-center gap-12 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <section className="order-2 max-w-2xl lg:order-1">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">
              One home for your community program
            </p>
            <h1 className="display-type text-5xl font-semibold leading-[0.98] sm:text-6xl">
              Give customers a meaningful way to take part.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
              Publish campaigns, connect trusted recipient organizations, and turn verified support into benefits your customers can use in your product.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <AuthBenefit icon={Building2} title="Campaigns" copy="Give customers a place to vote and donate." />
              <AuthBenefit icon={HeartHandshake} title="Recipients" copy="Let each organization connect PayPal directly." />
              <AuthBenefit icon={BadgeCheck} title="Benefits" copy="Reward verified support with clear rules." />
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-sm text-white shadow-[0_14px_36px_rgba(16,38,63,0.13)]">
              <Code2 className="size-5 shrink-0 text-mint" aria-hidden="true" />
              <p><span className="font-semibold">Building your own product?</span> Connect campaigns and entitlements with our Node and browser SDKs.</p>
            </div>
          </section>

          <section className="order-1 mx-auto w-full max-w-lg lg:order-2">
            <AuthFeedback fallbackError={query.error} nextPath={nextPath} />
            <AuthForm />
            <p className="mx-auto mt-5 max-w-md text-center text-xs leading-5 text-ink-soft">
              Recipient organizations connect and control their own PayPal accounts. Our Impact never asks for their PayPal passwords.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function AuthBenefit({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Building2;
  title: string;
  copy: string;
}) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-[0_10px_28px_rgba(16,38,63,0.06)] ring-1 ring-ink/8">
      <span className="grid size-9 place-items-center rounded-full bg-mint/25 text-mint-dark">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{copy}</p>
    </article>
  );
}
