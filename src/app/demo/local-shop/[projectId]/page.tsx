import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Coffee, Gift, HeartHandshake } from "lucide-react";
import { createLocalShopIdentityToken, runLocalShopDonation } from "@/app/dashboard/actions";
import { LocalShopEntitlements } from "@/components/local-shop-entitlements";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LocalShopDemo({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ donated?: string }> }) {
  const { projectId } = await params;
  const { donated } = await searchParams;
  const supabase = await createClient();
  const { data: membership } = await supabase.from("memberships").select("company_id").limit(1).maybeSingle();
  if (!membership) redirect("/login");
  const privileged = createPrivilegedClient();
  const { data: project } = await privileged.from("developer_projects").select("*").eq("id", projectId).eq("company_id", membership.company_id).maybeSingle();
  if (!project) notFound();
  const userToken = await createLocalShopIdentityToken(project.id);
  const { data: supporter } = await privileged.from("supporters").select("id").eq("project_id", project.id).eq("external_user_id", "local_shop_customer_123").single();
  if (!supporter) notFound();
  const { count } = await privileged.from("developer_events").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("supporter_id", supporter.id).eq("event_type", "donation.completed");

  return (
    <main className="min-h-screen bg-[#f7efe4] px-5 py-10 text-[#3f2b22] sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/developers" className="inline-flex items-center gap-2 text-sm font-semibold text-[#73584b]"><ArrowLeft className="size-4" /> Our Impact developer tools</Link>
        <div className="mt-8 grid overflow-hidden rounded-[2.5rem] bg-[#fffaf2] shadow-[0_30px_80px_rgba(80,48,31,0.15)] lg:grid-cols-[1.05fr_0.95fr]">
          <section className="bg-[#4a2f24] p-8 text-white sm:p-12">
            <Coffee className="size-10 text-[#f1bf7a]" />
            <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-[#f1bf7a]">Local Shop demo</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight">Coffee that gives back to the block.</h1>
            <p className="mt-5 text-lg leading-8 text-white/70">Jamie is signed into this fictional shop. A $5 sandbox donation becomes a verified event, and Our Impact converts repeated generosity into a shop perk.</p>
            <div className="mt-10 rounded-2xl bg-white/10 p-5"><p className="flex items-center gap-2 font-semibold"><HeartHandshake className="size-5 text-[#f1bf7a]" /> Demo customer</p><p className="mt-2 font-mono text-sm text-white/70">local_shop_customer_123</p><p className="mt-2 text-sm">{count ?? 0} completed donation event(s)</p></div>
          </section>
          <section className="p-8 sm:p-12">
            {donated === "1" && <div className="mb-6 rounded-2xl bg-[#dff5e8] px-5 py-4 text-sm font-semibold text-[#246443]">Donation event recorded and roles refreshed.</div>}
            <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#9c5b35]"><Gift className="size-4" /> Member benefits</p>
            <h2 className="mt-3 text-3xl font-semibold">Your community status</h2>
            <p className="mt-3 text-sm leading-6 text-[#73584b]">This card calls the same publishable endpoint a developer package would use.</p>
            <div className="mt-6"><LocalShopEntitlements publishableKey={project.publishable_key} userToken={userToken} /></div>
            <form action={runLocalShopDonation} className="mt-8">
              <input type="hidden" name="project_id" value={project.id} />
              <button className="min-h-14 w-full rounded-full bg-[#e89a55] px-6 font-semibold text-[#3f2b22] shadow-lg transition hover:-translate-y-0.5">Simulate a $5 completed donation</button>
            </form>
            <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#241913] p-4 text-xs leading-6 text-[#dff5e8]">{`const impact = new OurImpact({ publishableKey, userToken });\nawait impact.user.is("tier_3");`}</pre>
          </section>
        </div>
      </div>
    </main>
  );
}
