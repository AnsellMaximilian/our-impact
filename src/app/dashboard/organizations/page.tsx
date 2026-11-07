import type { Metadata } from "next";
import Image from "next/image";
import { Building2, CircleCheck, Plus, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { RecipientForm } from "@/components/recipient-form";
import { RecipientNetwork, type RecipientNetworkItem } from "@/components/recipient-network";
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
  const [invitationsResult, connectionsResult, campaignOrganizationsResult] = ids.length
    ? await Promise.all([
        privileged.from("recipient_invitations").select("organization_id, contact_email, status, expires_at, created_at").eq("company_id", membership.company_id).in("organization_id", ids).order("created_at", { ascending: false }),
        privileged.from("paypal_merchant_connections").select("organization_id, status, curation_state, payments_receivable, permissions_granted, primary_email_confirmed").in("organization_id", ids),
        privileged.from("campaign_organizations").select("organization_id, campaign_id").in("organization_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const campaignIds = [...new Set((campaignOrganizationsResult.data ?? []).map((link) => link.campaign_id))];
  const { data: campaigns } = campaignIds.length
    ? await privileged.from("campaigns").select("id, title, status").eq("company_id", membership.company_id).in("id", campaignIds)
    : { data: [] };
  const campaignById = new Map((campaigns ?? []).map((campaign) => [campaign.id, campaign]));
  const campaignsByOrganization = new Map<number, Array<{ id: string; title: string; status: string }>>();
  for (const link of campaignOrganizationsResult.data ?? []) {
    const campaign = campaignById.get(link.campaign_id);
    if (!campaign) continue;
    const current = campaignsByOrganization.get(link.organization_id) ?? [];
    current.push(campaign);
    campaignsByOrganization.set(link.organization_id, current);
  }
  const latestInvitation = new Map<number, RecipientInvitationSummary>();
  for (const invitation of invitationsResult.data ?? []) if (!latestInvitation.has(invitation.organization_id)) latestInvitation.set(invitation.organization_id, invitation);
  const verifiedOrganizationIds = new Set(
    (invitationsResult.data ?? [])
      .filter((invitation) => ["claimed", "accepted"].includes(invitation.status))
      .map((invitation) => invitation.organization_id),
  );
  const connectionByOrganization = new Map((connectionsResult.data ?? []).map((connection) => [connection.organization_id, connection]));
  const relationshipByOrganization = new Map((links ?? []).map((relationship) => [relationship.organization_id, relationship.relationship_state]));
  const invitationDatabaseReady = !invitationsResult.error;
  const isAdmin = ["owner", "admin"].includes(membership.role);
  const paypalReadyCount = (organizations ?? []).filter((organization) => {
    const connection = connectionByOrganization.get(organization.id);
    return connection?.status === "active"
      && connection.curation_state === "approved"
      && connection.payments_receivable
      && connection.permissions_granted
      && connection.primary_email_confirmed;
  }).length;
  const networkItems: RecipientNetworkItem[] = (organizations ?? []).map((organization) => {
    const invitation = latestInvitation.get(organization.id);
    const connection = connectionByOrganization.get(organization.id);
    return {
      id: organization.id,
      name: organization.name,
      category: organization.category,
      shortDescription: organization.short_description,
      websiteUrl: organization.website_url,
      imageSrc: recipientImage(organization.name, organization.category),
      relationship: relationshipByOrganization.get(organization.id) ?? "invited",
      representativeVerified: verifiedOrganizationIds.has(organization.id),
      invitation: invitation ? { contactEmail: invitation.contact_email, status: invitation.status } : null,
      connection: connection ? {
        status: connection.status,
        curationState: connection.curation_state,
        paymentsReceivable: connection.payments_receivable,
        permissionsGranted: connection.permissions_granted,
        primaryEmailConfirmed: connection.primary_email_confirmed,
      } : null,
      campaigns: campaignsByOrganization.get(organization.id) ?? [],
    };
  });

  return (
    <main className="px-4 py-5 sm:px-7 sm:py-7 xl:px-10 xl:py-9">
      <header className="dashboard-card relative min-h-[350px] overflow-hidden rounded-[1.75rem] bg-white">
        <div className="relative z-10 max-w-xl px-6 py-8 sm:px-9 sm:py-10">
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
        <div className="absolute inset-x-0 bottom-0 h-[48%] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[64%]">
          <Image src="/illustrations/hero-botanical-landscape.png" alt="" fill sizes="(min-width: 640px) 65vw, 100vw" priority className="object-cover object-right-bottom" />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/35 to-transparent lg:hidden" />
          <div className="absolute inset-0 hidden bg-[linear-gradient(90deg,#fff_0%,#fff_30%,rgba(255,255,255,0.94)_48%,rgba(255,255,255,0.28)_76%,transparent_100%)] lg:block" />
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
        <div className="mb-4 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Organizations</p><h2 className="mt-1 text-2xl font-semibold">Your recipients</h2></div></div>
        <RecipientNetwork items={networkItems} canInvite={isAdmin && invitationDatabaseReady} />
      </section>
    </main>
  );
}
