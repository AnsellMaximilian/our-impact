import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Gift, HeartHandshake, Leaf, Settings2 } from "lucide-react";
import {
  createLocalShopIdentityToken,
  runLocalShopDonation,
  selectMikeShopPersona,
} from "@/app/dashboard/actions";
import { LocalShopEntitlements } from "@/components/local-shop-entitlements";
import { OurImpactCampaignEmbed } from "@/components/our-impact-campaign-embed";
import {
  getMikeShopPersona,
  MIKE_SHOP_PERSONA_COOKIE,
  MIKE_SHOP_PERSONAS,
} from "@/lib/demo/mikes-vegan-shop";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LocalShopDemo({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ donated?: string; error?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  const privileged = createPrivilegedClient();
  const { data: project } = await privileged
    .from("developer_projects")
    .select("*")
    .eq("id", projectId)
    .eq("company_id", membership.company_id)
    .maybeSingle();
  if (!project) notFound();

  const cookieStore = await cookies();
  const persona = getMikeShopPersona(cookieStore.get(MIKE_SHOP_PERSONA_COOKIE)?.value);
  const userToken = await createLocalShopIdentityToken(project.id, persona.id);
  const [{ data: supporter }, { data: links }, { data: campaign }] = await Promise.all([
    privileged
      .from("supporters")
      .select("id")
      .eq("project_id", project.id)
      .eq("external_user_id", persona.externalUserId)
      .single(),
    privileged
      .from("workspace_recipients")
      .select("organization_id")
      .eq("company_id", membership.company_id)
      .neq("relationship_state", "blocked"),
    privileged
      .from("campaigns")
      .select("public_id, title")
      .eq("company_id", membership.company_id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!supporter) notFound();

  const organizationIds = (links ?? []).map((link) => link.organization_id);
  const { data: organizations } = organizationIds.length
    ? await privileged
        .from("organizations")
        .select("id, name")
        .in("id", organizationIds)
        .order("name")
    : { data: [] };
  const { count } = await privileged
    .from("developer_events")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .eq("supporter_id", supporter.id)
    .eq("event_type", "donation.completed");

  return (
    <main className="min-h-screen bg-[#edf4e8] px-5 py-10 text-[#223127] sm:py-16">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/developers" className="inline-flex items-center gap-2 text-sm font-semibold text-[#55705d]">
          <ArrowLeft className="size-4" /> Our Impact developer tools
        </Link>

        <div className="mt-8 overflow-hidden rounded-[2.5rem] bg-[#fffdf7] shadow-[0_30px_80px_rgba(45,80,54,0.16)]">
          <header className="flex flex-col gap-5 bg-[#264c37] px-8 py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:px-12">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-[#dff28b] text-[#264c37]"><Leaf /></span>
              <div><p className="text-xl font-semibold">Mike’s Vegan Shop</p><p className="text-sm text-white/65">Good food, stronger neighborhoods.</p></div>
            </div>
            <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em]">Our Impact demo</span>
          </header>

          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <section className="p-8 sm:p-12">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#cf6c46]">Mike’s community program</p>
              <h1 className="mt-3 max-w-xl text-5xl font-semibold leading-tight">Your order can help the neighborhood choose what comes next.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#55705d]">
                Vote for a local recipient, then let Mike’s shop recognize your verified support with member-only experiences.
              </p>

              {campaign ? (
                <div className="mt-8">
                  <OurImpactCampaignEmbed
                    src={`/embed/${campaign.public_id}`}
                    title={campaign.title}
                    userToken={userToken}
                    shopperName={persona.name}
                  />
                </div>
              ) : (
                <div className="mt-8 rounded-3xl border border-dashed border-[#aec0ac] p-6 text-sm text-[#55705d]">
                  Publish a campaign to embed its live voting widget here.
                </div>
              )}
            </section>

            <section className="bg-[#f7f1e7] p-8 sm:p-12">
              {query.donated === "1" && (
                <div className="mb-6 rounded-2xl bg-[#dff5e8] px-5 py-4 text-sm font-semibold text-[#246443]">
                  Verified donation event recorded. {persona.name}’s SDK state was refreshed.
                </div>
              )}
              {query.error && (
                <div className="mb-6 rounded-2xl bg-[#ffe2d8] px-5 py-4 text-sm font-semibold text-[#8c3d25]">
                  Choose a valid recipient before sending the demo event.
                </div>
              )}

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[#d8e2d4]">
                <p className="flex items-center gap-2 font-semibold"><HeartHandshake className="size-5 text-[#cf6c46]" /> Signed-in shopper</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {MIKE_SHOP_PERSONAS.map((option) => (
                    <form action={selectMikeShopPersona} key={option.id}>
                      <input type="hidden" name="project_id" value={project.id} />
                      <input type="hidden" name="persona_id" value={option.id} />
                      <button className={option.id === persona.id
                        ? "w-full rounded-2xl bg-[#264c37] px-2 py-3 text-sm font-semibold text-white"
                        : "w-full rounded-2xl bg-[#edf4e8] px-2 py-3 text-sm font-semibold text-[#55705d] hover:bg-[#dfead9]"}
                      >{option.name}</button>
                    </form>
                  ))}
                </div>
                <p className="mt-3 font-mono text-xs text-[#7b8f80]">{persona.externalUserId}</p>
                <p className="mt-1 text-sm text-[#55705d]">{count ?? 0} verified contribution event(s)</p>
              </div>

              <div className="mt-6">
                <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#9c5b35]"><Gift className="size-4" /> Shopper benefit</p>
                <h2 className="mt-3 text-3xl font-semibold">Your community status</h2>
                <p className="mt-3 text-sm leading-6 text-[#55705d]">This UI asks the browser SDK whether the signed-in Mike’s shopper has the theme entitlement.</p>
                <div className="mt-6"><LocalShopEntitlements publishableKey={project.publishable_key} userToken={userToken} /></div>
              </div>

              <div className="mt-8 rounded-3xl border border-dashed border-[#b9aa95] p-5">
                <p className="flex items-center gap-2 font-semibold"><Settings2 className="size-4" /> Mike’s developer demo control</p>
                <p className="mt-2 text-xs leading-5 text-[#736756]">Fallback API simulator. The embedded PayPal contribution above now records the same event automatically for the connected shopper.</p>
                <form action={runLocalShopDonation} className="mt-4 space-y-3">
                  <input type="hidden" name="project_id" value={project.id} />
                  <input type="hidden" name="persona_id" value={persona.id} />
                  <select name="organization_id" required className="min-h-12 w-full rounded-2xl border border-[#d9cdbb] bg-white px-4 text-sm">
                    <option value="">Choose the recipient supported</option>
                    {(organizations ?? []).map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                  </select>
                  <button className="min-h-12 w-full rounded-full bg-[#dff28b] px-6 font-semibold text-[#264c37] hover:bg-[#d4ec6c]">Send verified $5 donation event</button>
                </form>
              </div>

              <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#203128] p-4 text-xs leading-6 text-[#dff5e8]">{`const impact = new OurImpact({ publishableKey, userToken });\nawait impact.user.is("community_champion_theme");`}</pre>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
