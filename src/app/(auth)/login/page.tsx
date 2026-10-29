import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { Brand } from "@/components/brand";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
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

        <div className="grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <section className="max-w-2xl">
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">
              Company workspace
            </p>
            <h1 className="display-type text-5xl font-semibold leading-[0.98] sm:text-6xl">
              Turn a giving promise into something people can see.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-soft">
              Create your workspace, shape a draft campaign, and preview the public experience. No money moves in this foundation release.
            </p>

            <ul className="mt-8 space-y-4 text-sm font-medium text-ink-soft">
              {[
                "Tenant-isolated workspace and campaign data",
                "Transparent committed, allocated, and paid language",
                "Five fictional organizations ready for safe prototyping",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-mint-dark" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-end gap-4">
              <Image
                src="/brand/luma-firefly.png"
                alt="Luma, the Our Impact firefly mascot"
                width={180}
                height={160}
                className="h-auto w-32 drop-shadow-[0_16px_20px_rgba(16,38,63,0.15)] sm:w-40"
                priority
              />
              <p className="mb-4 max-w-xs rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-6 text-ink-soft shadow-sm ring-1 ring-ink/8">
                Meet Luma. Our firefly keeps the difference between promised and delivered impact in the light.
              </p>
            </div>
          </section>

          <section className="mx-auto w-full max-w-lg">
            <AuthForm />
            <p className="mt-5 text-center text-xs leading-5 text-ink-soft">
              By continuing, you agree to use fictional campaign data during this foundation stage.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
