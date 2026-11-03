import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, CircleCheck, CircleDashed, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { RecipientForm } from "@/components/recipient-form";
import { RecipientInvitationForm } from "@/components/recipient-invitation-form";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recipient network" };

type RecipientInvitationSummary = {
  organization_id: number;
  contact_email: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export default async function OrganizationsPage() {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/dashboard");

  const { data: links } = await supabase
    .from("workspace_recipients")
    .select("organization_id, relationship_state")
    .eq("company_id", membership.company_id)
    .order("created_at");
  const ids = (links ?? []).map((link) => link.organization_id);
  const { data: organizations } = ids.length
    ? await supabase.from("organizations").select("*").in("id", ids).order("name")
    : { data: [] };
  const privileged = createPrivilegedClient();
  const [invitationsResult, connectionsResult] = ids.length
    ? await Promise.all([
        privileged
          .from("recipient_invitations")
          .select("organization_id, contact_email, status, expires_at, created_at")
          .eq("company_id", membership.company_id)
          .in("organization_id", ids)
          .order("created_at", { ascending: false }),
        privileged
          .from("paypal_merchant_connections")
          .select("organization_id, status, curation_state, payments_receivable")
          .in("organization_id", ids),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  const latestInvitation = new Map<number, RecipientInvitationSummary>();
  for (const invitation of invitationsResult.data ?? []) {
    if (!latestInvitation.has(invitation.organization_id)) {
      latestInvitation.set(invitation.organization_id, invitation);
    }
  }
  const connectionByOrganization = new Map(
    (connectionsResult.data ?? []).map((connection) => [connection.organization_id, connection]),
  );
  const relationshipByOrganization = new Map(
    (links ?? []).map((relationship) => [relationship.organization_id, relationship.relationship_state]),
  );
  const invitationDatabaseReady = !invitationsResult.error;
  const isAdmin = ["owner", "admin"].includes(membership.role);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Dashboard</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Recipient organizations</p>
          <h1 className="display-type mt-3 text-5xl font-semibold">Invite the community organizations you support.</h1>
          <p className="mt-5 text-lg leading-8 text-ink-soft">Your workspace proposes each recipient. Their representative verifies the invited email, claims a separate recipient portal, and connects their own PayPal account—your team never handles their credentials.</p>
          {!invitationDatabaseReady && (
            <div className="mt-6 rounded-2xl bg-sun/15 p-4 text-sm font-semibold ring-1 ring-sun/35">
              Apply the Community Program migration before creating recipient invitations.
            </div>
          )}
          <div className="mt-8 space-y-3">
            {organizations?.map((organization) => {
              const invitation = latestInvitation.get(organization.id);
              const connection = connectionByOrganization.get(organization.id);
              const paypalReady = connection?.status === "active" && connection.curation_state === "approved";
              const relationship = relationshipByOrganization.get(organization.id) ?? "invited";
              return (
                <article key={organization.id} className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 size-4 shrink-0 rounded-full" style={{ background: organization.brand_color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-semibold">{organization.name}</h2>
                          <p className="mt-1 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
                        </div>
                        <span className={paypalReady ? "inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark" : "inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink-soft"}>
                          {paypalReady ? <CircleCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
                          {paypalReady
                            ? "PayPal ready"
                            : invitation?.status === "claimed"
                              ? "Identity verified"
                              : invitation
                                ? "Invitation ready"
                                : "Needs invitation"}
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                        <ShieldCheck className="size-3.5" /> Relationship: {relationship}
                      </p>
                      {isAdmin && invitationDatabaseReady && (
                        <RecipientInvitationForm
                          organizationId={organization.id}
                          initialEmail={invitation?.contact_email}
                        />
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            {!organizations?.length && <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink-soft"><Building2 className="mx-auto mb-3 size-7" />No recipients yet. Add at least two before creating a campaign.</div>}
          </div>
        </section>
        <section>
          <RecipientForm />
          <p className="mt-4 text-sm leading-6 text-ink-soft">This creates a private proposed recipient. Generate its invitation from the card, then share that link with the organization’s representative.</p>
        </section>
      </div>
    </main>
  );
}
