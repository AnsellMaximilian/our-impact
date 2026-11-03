import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, HeartHandshake, LogOut, ShieldCheck, Store } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { RecipientPayPalConnect } from "@/components/recipient-paypal-connect";
import { getPayPalPlatformConfiguration } from "@/lib/paypal/platform";
import {
  createRecipientInvitationToken,
  recipientInvitationPath,
} from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recipient portal" };

export default async function RecipientPortalPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) redirect("/");

  const privileged = createPrivilegedClient();
  const { data: memberships } = await privileged
    .from("recipient_memberships")
    .select("organization_id, company_id, invitation_id, claimed_email, role")
    .eq("user_id", user.id)
    .order("created_at");

  const organizationIds = [...new Set((memberships ?? []).map((item) => item.organization_id))];
  const companyIds = [...new Set((memberships ?? []).map((item) => item.company_id))];
  const invitationIds = (memberships ?? []).map((item) => item.invitation_id);
  const [organizationsResult, companiesResult, invitationsResult, connectionsResult] = await Promise.all([
    organizationIds.length
      ? privileged.from("organizations").select("id, name, category, short_description, brand_color").in("id", organizationIds)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? privileged.from("companies").select("id, public_name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    invitationIds.length
      ? privileged.from("recipient_invitations").select("id, status, expires_at").in("id", invitationIds)
      : Promise.resolve({ data: [] }),
    organizationIds.length
      ? privileged.from("paypal_merchant_connections").select("organization_id, status, curation_state, merchant_id, payments_receivable, last_error_code").in("organization_id", organizationIds)
      : Promise.resolve({ data: [] }),
  ]);

  const organizationById = new Map((organizationsResult.data ?? []).map((item) => [item.id, item]));
  const companyById = new Map((companiesResult.data ?? []).map((item) => [item.id, item]));
  const invitationById = new Map((invitationsResult.data ?? []).map((item) => [item.id, item]));
  const connectionByOrganization = new Map((connectionsResult.data ?? []).map((item) => [item.organization_id, item]));
  const platform = getPayPalPlatformConfiguration();

  return (
    <main className="min-h-screen bg-paper px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Brand href="/recipients/portal" />
          <form action={signOut}>
            <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-ink/10">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2.5rem] bg-ink p-8 text-white shadow-[0_30px_80px_rgba(16,38,63,0.15)] sm:p-11">
          <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-mint">
            <HeartHandshake className="size-4" /> Recipient-owned access
          </p>
          <h1 className="display-type mt-4 max-w-3xl text-5xl font-semibold sm:text-6xl">
            Your organization controls its payment connection.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
            Review the local programs supporting you, connect PayPal, and monitor readiness without entering a business owner’s campaign dashboard.
          </p>
        </section>

        <section className="mt-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Recipient accounts</p>
              <h2 className="mt-2 text-3xl font-semibold">Organizations you represent</h2>
            </div>
            <span className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-bold text-mint-dark">
              {memberships?.length ?? 0} verified
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(memberships ?? []).map((membership) => {
              const organization = organizationById.get(membership.organization_id);
              const company = companyById.get(membership.company_id);
              const invitation = invitationById.get(membership.invitation_id);
              const connection = connectionByOrganization.get(membership.organization_id) ?? null;
              if (!organization || !invitation) return null;
              const invitationToken = createRecipientInvitationToken(membership.invitation_id);
              return (
                <article key={membership.invitation_id} className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8">
                  <div className="flex items-start gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: organization.brand_color }}>
                      <Building2 className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold">{organization.name}</h3>
                      <p className="mt-1 text-sm font-semibold text-ink-soft">{organization.category}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
                  <div className="mt-5 flex items-start gap-3 rounded-2xl bg-paper p-4 text-sm leading-6 text-ink-soft">
                    <Store className="mt-0.5 size-4 shrink-0 text-coral-dark" />
                    <p><span className="font-semibold text-ink">Invited by {company?.public_name ?? "a local business"}.</span> They can see connection readiness, never your PayPal credentials.</p>
                  </div>
                  <div className="mt-5">
                    <RecipientPayPalConnect invitationToken={invitationToken} platformReady={platform.onboardingReady} connection={connection} />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-mint-dark" /> {membership.claimed_email}</span>
                    <Link href={recipientInvitationPath(membership.invitation_id)} className="font-semibold text-ink underline">Invitation details</Link>
                  </div>
                </article>
              );
            })}
            {!memberships?.length && (
              <div className="rounded-[2rem] border border-dashed border-ink/20 p-8 text-center lg:col-span-2">
                <Building2 className="mx-auto size-7 text-coral-dark" />
                <p className="mt-4 font-semibold">No recipient invitations claimed yet</p>
                <p className="mt-2 text-sm text-ink-soft">Open the secure link supplied by a participating business to add an organization here.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
