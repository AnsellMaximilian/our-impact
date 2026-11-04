import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Braces, Download, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Developer documentation" };

const serverEventExample = `await fetch("https://our-impact.vercel.app/api/v1/events", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: \`Bearer \${process.env.OUR_IMPACT_SECRET_KEY}\`,
  },
  body: JSON.stringify({
    id: "donation_01JABC123",
    type: "donation.completed",
    external_user_id: "mikes_vegan_shop:jamie",
    properties: { amount_minor: 5000, currency: "USD" },
  }),
});`;

const identityExample = `// Mike's server, after authenticating Jamie
const { token: userToken } = await fetch(
  "https://our-impact.vercel.app/api/v1/identity-tokens",
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: \`Bearer \${process.env.OUR_IMPACT_SECRET_KEY}\`,
    },
    body: JSON.stringify({
      external_user_id: "mikes_vegan_shop:jamie",
      display_name: "Jamie",
    }),
  },
).then((response) => response.json());

// Mike's browser, when the embedded widget says it is ready
widget.contentWindow.postMessage(
  { type: "our-impact.identify", token: userToken },
  "https://our-impact.vercel.app",
);`;

const browserExample = `const impact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken,
  baseUrl: "https://our-impact.vercel.app",
});

if (await impact.user.is("community_champion_theme")) {
  enableCommunityTheme();
}`;

export default function DeveloperDocumentationPage() {
  return (
    <main className="min-h-screen bg-paper px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <Link href="/dashboard/developers" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
            Open developer dashboard
          </Link>
        </header>

        <section className="mt-9 overflow-hidden rounded-[2.5rem] bg-ink p-8 text-white shadow-[0_30px_80px_rgba(16,38,63,0.16)] sm:p-12">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-mint"><Braces className="size-4" /> Sandbox developer API</p>
          <h1 className="display-type mt-4 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-7xl">Turn verified support into product access.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">Mike keeps his own authentication. Our Impact accepts a stable external user ID, evaluates owner-approved rules, and returns entitlements his website can use.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="/api/openapi" target="_blank" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink"><Download className="size-4" /> OpenAPI 3.0 contract</a>
            <a href="#quickstart" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15">Read quickstart <ArrowRight className="size-4" /></a>
          </div>
        </section>

        <section id="quickstart" className="mt-10 grid gap-7 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-5">
            {[
              { icon: KeyRound, title: "1. Keep the secret server-side", body: "Use the project secret only on Mike’s server. The browser receives a publishable key and a short-lived user token." },
              { icon: ShieldCheck, title: "2. Receive verified events", body: "PayPal contributions made inside the identified widget become donation.completed events automatically. Mike can send other verified donations through the API." },
              { icon: Sparkles, title: "3. Query entitlements", body: "Mike’s UI asks for stable entitlement keys. Our Impact never needs the shopper’s password." },
            ].map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-3xl bg-surface p-6 ring-1 ring-ink/8">
                <Icon className="size-5 text-coral-dark" />
                <h2 className="mt-4 text-lg font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
              </article>
            ))}
            <div className="rounded-3xl bg-mint/12 p-6 ring-1 ring-mint/25">
              <p className="font-semibold">Ready for an SDK generator</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">Import <code>/api/openapi</code> into APIMatic to inspect generated clients and documentation. The OpenAPI file is the source contract; generated packages remain replaceable.</p>
            </div>
          </div>

          <div className="space-y-6">
            <article className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Server + browser · widget identity</p>
              <h2 className="mt-2 text-2xl font-semibold">Connect the signed-in shopper to the embedded campaign</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">The secret stays on Mike’s server. The short-lived token crosses into the widget with <code>postMessage</code>, and the widget validates Mike’s allowed origin before accepting it.</p>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-5 text-xs leading-6 text-mint"><code>{identityExample}</code></pre>
            </article>
            <article className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Server · verified event</p>
              <h2 className="mt-2 text-2xl font-semibold">Record support completed outside the widget</h2>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-5 text-xs leading-6 text-mint"><code>{serverEventExample}</code></pre>
            </article>
            <article className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Browser · customer experience</p>
              <h2 className="mt-2 text-2xl font-semibold">Ask whether the signed-in shopper has access</h2>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-5 text-xs leading-6 text-mint"><code>{browserExample}</code></pre>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
