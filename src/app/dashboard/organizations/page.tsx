import type { Metadata } from "next";
import Image from "next/image";
import { Building2, CircleCheck, CircleDashed, Globe2, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { RecipientForm } from "@/components/recipient-form";
import { RecipientInvitationForm } from "@/components/recipient-invitation-form";
import { Sheet } from "@/components/sheet";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recipients" };

type RecipientInvitationSummary = { organization_id: number; contact_email: string; status: string; expires_at: string; created_at: string };

function recipientImage(name: string, category: string) {
  const value = `${name} ${category}`.toLowerCase();
  if (value.includes("animal") || value.includes("shelter")) return "/illustrations/thumbnail-animal-shelter.png";
  if (value.includes("garden") || value.includes("environment")) return "/illustrations/thumbnail-community-garden.png";
  return "/illustrations/thumbnail-food-bank-fields.png";
}

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: membership } = await supabase.from("memberships").select("company_id, role").limit(1).maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: links } = await supabase.from("workspace_recipients").select("organization_id, relationship_state").eq("company_id", membership.company_id).order("created_at");
  const ids = (links ?? []).map((link) => link.organization_id);
  const { data: organizations } = ids.length ? await supabase.from("organizations").select("*").in("id", ids).order("name") : { data: [] };
  const privileged = createPrivilegedClient();
  const [invitationsResult, connectionsResult] = ids.length
    ? await Promise.all([
        privileged.from("recipient_invitations").select("organization_id, contact_email, status, expires_at, created_at").eq("company_id", membership.company_id).in("organization_id", ids).order("created_at", { ascending: false }),
        privileged.from("paypal_merchant_connections").select("organization_id, status, curation_state, payments_receivable").in("organization_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const latestInvitation = new Map<number, RecipientInvitationSummary>();
  for (const invitation of invitationsResult.data ?? []) if (!latestInvitation.has(invitation.organization_id)) latestInvitation.set(invitation.organization_id, invitation);
  const connectionByOrganization = new Map((connectionsResult.data ?? []).map((connection) => [connection.organization_id, connection]));
  const relationshipByOrganization = new Map((links ?? []).map((relationship) => [relationship.organization_id, relationship.relationship_state]));
  const invitationDatabaseReady = !invitationsResult.error;
  const isAdmin = ["owner", "admin"].includes(membership.role);
  const paypalReadyCount = (organizations ?? []).filter((organization) => {
    const connection = connectionByOrganization.get(organization.id);
    return connection?.status === "active" && connection.curation_state === "approved";
  }).length;

  return (
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      <header className="dashboard-card grid min-h-[330px] overflow-hidden rounded-[1.75rem] bg-[#e0ecdc] md:grid-cols-[minmax(0,1.1fr)_minmax(270px,0.9fr)]">
        <div className="relative z-10 px-6 py-8 sm:px-9 sm:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">Recipient network</p>
          <h1 className="display-type mt-3 text-4xl font-semibold sm:text-5xl">Community partners</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-ink-soft">Invite organizations your community cares about. Each partner verifies their identity and connects their own PayPal account.</p>
          <div className="mt-5">
            <Sheet
              title="Add a recipient"
              description="Create the organization profile, then invite a representative to verify and connect payouts."
              trigger={<button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white"><Plus className="size-4" /> Add recipient</button>}
            >
              <RecipientForm />
            </Sheet>
          </div>
        </div>
        <div className="relative min-h-44 overflow-hidden md:min-h-full">
          <Image src="/illustrations/hero-botanical-landscape.png" alt="" fill sizes="(min-width: 768px) 42vw, 100vw" priority className="object-cover object-right" />
        </div>
      </header>

      <section className="dashboard-card mt-5 grid rounded-[1.5rem] sm:grid-cols-3 sm:divide-x sm:divide-ink/12" aria-label="Recipient summary">
        {[
          { label: "Partner organizations", value: organizations?.length ?? 0, icon: Building2 },
          { label: "Ready to receive", value: paypalReadyCount, icon: CircleCheck },
          { label: "Connections in progress", value: Math.max((organizations?.length ?? 0) - paypalReadyCount, 0), icon: UsersRound },
        ].map(({ label, value, icon: Icon }) => <article key={label} className="border-b border-ink/10 p-5 last:border-b-0 sm:border-b-0 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-ink-soft">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><span className="grid size-10 place-items-center rounded-xl bg-coral/10 text-coral-dark"><Icon className="size-5" /></span></div></article>)}
      </section>

      {!invitationDatabaseReady && <div className="mt-5 rounded-2xl bg-sun/18 p-4 text-sm font-semibold ring-1 ring-sun/35">Recipient invitations are temporarily unavailable. Your existing recipient profiles are unaffected.</div>}

      <section className="mt-5">
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Organizations</p><h2 className="mt-1 text-2xl font-semibold">Your recipient network</h2></div></div>
        {organizations?.length ? (
          <div className="space-y-4">
            {organizations.map((organization) => {
              const invitation = latestInvitation.get(organization.id);
              const connection = connectionByOrganization.get(organization.id);
              const paypalReady = connection?.status === "active" && connection.curation_state === "approved";
              const relationship = relationshipByOrganization.get(organization.id) ?? "invited";
              return (
                <article key={organization.id} className="dashboard-card overflow-hidden rounded-[1.5rem]">
                  <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="bg-[#edf2e9] p-4">
                      <div className="relative h-40 overflow-hidden rounded-2xl bg-[#dceee2] sm:h-full sm:min-h-40">
                        <Image src={recipientImage(organization.name, organization.category)} alt="" fill sizes="180px" className="object-contain p-2" />
                      </div>
                    </div>
                    <div className="p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{organization.category}</p><h3 className="mt-1 text-lg font-semibold">{organization.name}</h3></div><span className={paypalReady ? "inline-flex items-center gap-1.5 rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold text-mint-dark" : "inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-bold text-ink-soft"}>{paypalReady ? <CircleCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}{paypalReady ? "Ready" : invitation?.status === "claimed" ? "Verified" : invitation ? "Invited" : "Not invited"}</span></div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-ink-soft"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> {relationship}</span>{organization.website_url && <span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" /> Website added</span>}</div>
                    </div>
                  </div>
                  {isAdmin && invitationDatabaseReady && <div className="border-t border-ink/8 px-5 pb-5"><RecipientInvitationForm organizationId={organization.id} initialEmail={invitation?.contact_email} /></div>}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-card rounded-[1.5rem] px-8 py-16 text-center"><Building2 className="mx-auto size-8 text-coral-dark" /><p className="mt-4 font-semibold">No recipient partners yet</p><p className="mt-2 text-sm text-ink-soft">Add the first organization your community will be able to support.</p></div>
        )}
      </section>
    </main>
  );
}
