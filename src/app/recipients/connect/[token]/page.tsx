import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, HeartHandshake, LogOut, UserRoundCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { switchRecipientAccount } from "@/app/recipients/actions";
import { Brand } from "@/components/brand";
import { RecipientClaimForm, RecipientMagicLinkForm } from "@/components/recipient-access";
import { RecipientPayPalConnect } from "@/components/recipient-paypal-connect";
import { getPayPalPlatformConfiguration } from "@/lib/paypal/platform";
import { verifyRecipientInvitationToken } from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recipient invitation" };

export default async function RecipientInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paypal?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const invitationId = verifyRecipientInvitationToken(token);
  if (!invitationId) notFound();

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  const privileged = createPrivilegedClient();
  const { data: invitation } = await privileged
    .from("recipient_invitations")
    .select("id, company_id, organization_id, contact_email, status, expires_at, claimed_at")
    .eq("id", invitationId)
    .maybeSingle();
  if (!invitation || invitation.status === "revoked") notFound();

  const [{ data: company }, { data: organization }, { data: connection }, membershipResult] = await Promise.all([
    privileged
      .from("companies")
      .select("public_name")
      .eq("id", invitation.company_id)
      .maybeSingle(),
    privileged
      .from("organizations")
      .select("name, short_description, category, brand_color")
      .eq("id", invitation.organization_id)
      .maybeSingle(),
    privileged
      .from("paypal_merchant_connections")
      .select("status, curation_state, merchant_id, payments_receivable, last_error_code")
      .eq("organization_id", invitation.organization_id)
      .maybeSingle(),
    user
      ? privileged
          .from("recipient_memberships")
          .select("role, claimed_email")
          .eq("invitation_id", invitation.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (!company || !organization) notFound();

  const active = connection?.status === "active" && connection.curation_state === "approved";
  // This route is dynamic and must evaluate the private link at request time.
  // eslint-disable-next-line react-hooks/purity
  const expired = invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now();
  const platform = getPayPalPlatformConfiguration();
  const membership = membershipResult.data;
  const identityMismatch = Boolean(
    user?.email &&
    user.email.trim().toLowerCase() !== invitation.contact_email.trim().toLowerCase(),
  );

  return (
    <main className="min-h-screen bg-paper px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <div className="flex items-center gap-2">
            {membership && (
              <Link href="/recipients/portal" className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-mint-dark ring-1 ring-mint/25">
                My recipient portal
              </Link>
            )}
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink-soft ring-1 ring-ink/10">
              Recipient portal · Sandbox
            </span>
          </div>
        </div>

        <section className="mt-8 overflow-hidden rounded-[2.5rem] bg-surface shadow-[0_30px_80px_rgba(16,38,63,0.12)] ring-1 ring-ink/8">
          <div className="bg-ink p-7 text-white sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">Private invitation</p>
            <h1 className="display-type mt-4 text-4xl font-semibold sm:text-5xl">
              {company.public_name} wants to support {organization.name}.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Review the relationship and connect the PayPal Sandbox account controlled by your organization. This consent belongs to the recipient—not the program owner.
            </p>
          </div>

          <div className="space-y-6 p-7 sm:p-10">
            {query.paypal === "connected" && (
              <p className="flex items-center gap-2 rounded-2xl bg-mint/15 p-4 text-sm font-semibold text-mint-dark ring-1 ring-mint/30">
                <CheckCircle2 className="size-5" /> PayPal onboarding is complete.
              </p>
            )}
            {query.paypal === "claim_required" && (
              <p className="rounded-2xl bg-sun/15 p-4 text-sm font-semibold ring-1 ring-sun/35">
                Verify the invited email and claim this recipient before connecting PayPal.
              </p>
            )}
            <div className="flex items-start gap-4 rounded-3xl bg-white p-5 ring-1 ring-ink/8">
              <span className="grid size-12 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: organization.brand_color }}>
                <Building2 className="size-5" />
              </span>
              <div>
                <h2 className="text-xl font-semibold">{organization.name}</h2>
                <p className="mt-1 text-sm font-semibold text-ink-soft">{organization.category}</p>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
              </div>
            </div>

            {expired && !active ? (
              <div className="rounded-2xl bg-coral/10 p-5 text-sm leading-6 text-coral-dark ring-1 ring-coral/25">
                This invitation has expired. Ask {company.public_name} to generate a fresh private link.
              </div>
            ) : !user && !active ? (
              <RecipientMagicLinkForm invitationToken={token} />
            ) : identityMismatch && !active ? (
              <div className="rounded-3xl bg-coral/10 p-6 ring-1 ring-coral/25">
                <p className="flex items-center gap-2 font-semibold text-coral-dark">
                  <UserRoundCheck className="size-5" /> Use the invited representative account
                </p>
                <p className="mt-3 text-sm leading-6 text-ink-soft">
                  The signed-in account does not match this invitation. Switch accounts, then request the secure link again.
                </p>
                <form action={switchRecipientAccount} className="mt-4">
                  <input type="hidden" name="invite_token" value={token} />
                  <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
                    <LogOut className="size-4" /> Switch account
                  </button>
                </form>
              </div>
            ) : user && !membership && !active ? (
              <RecipientClaimForm invitationToken={token} />
            ) : (
              <RecipientPayPalConnect
                invitationToken={token}
                platformReady={platform.onboardingReady}
                connection={connection}
              />
            )}

            <div className="flex items-start gap-3 border-t border-line pt-6 text-sm leading-6 text-ink-soft">
              <HeartHandshake className="mt-0.5 size-5 shrink-0 text-coral-dark" />
              <p>Once verified, supporters can donate directly to this recipient through participating Our Impact campaigns. <Link href="/" className="font-semibold text-ink underline">Learn about Our Impact</Link>.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
