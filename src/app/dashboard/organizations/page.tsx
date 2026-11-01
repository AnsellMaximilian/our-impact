import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2, CircleCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { RecipientForm } from "@/components/recipient-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Recipient network" };

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

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink"><ArrowLeft className="size-4" /> Dashboard</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <section>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">Recipient network</p>
          <h1 className="display-type mt-3 text-5xl font-semibold">Curate who this workspace supports.</h1>
          <p className="mt-5 text-lg leading-8 text-ink-soft">Start with clearly fictional organizations. Each one stays private to this workspace until a published campaign makes it visible.</p>
          <div className="mt-8 space-y-3">
            {organizations?.map((organization) => (
              <article key={organization.id} className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <div className="flex items-start gap-3">
                  <span className="mt-1 size-4 shrink-0 rounded-full" style={{ background: organization.brand_color }} />
                  <div>
                    <h2 className="font-semibold">{organization.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{organization.short_description}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-mint-dark"><CircleCheck className="size-3.5" /> Workspace recipient · {organization.verification_state}</p>
                  </div>
                </div>
              </article>
            ))}
            {!organizations?.length && <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink-soft"><Building2 className="mx-auto mb-3 size-7" />No recipients yet. Add at least two before creating a campaign.</div>}
          </div>
        </section>
        <section>
          <RecipientForm />
          <p className="mt-4 text-sm leading-6 text-ink-soft">PayPal consent is linked later from each recipient’s campaign workflow. This form creates only Our Impact’s fictional directory record.</p>
        </section>
      </div>
    </main>
  );
}
