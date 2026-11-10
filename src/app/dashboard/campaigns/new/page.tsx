import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CampaignForm } from "@/components/campaign-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "New campaign",
};

export default async function NewCampaignPage() {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role")
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/dashboard");
  }

  const { data: recipients } = await supabase
    .from("workspace_recipients")
    .select("organization_id")
    .eq("company_id", membership.company_id)
    .eq("relationship_state", "active");
  const recipientIds = (recipients ?? []).map((recipient) => recipient.organization_id);
  const { data: organizations } = recipientIds.length
    ? await supabase.from("organizations").select("*").in("id", recipientIds).order("name")
    : { data: [] };

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 sm:px-7 sm:py-7 xl:py-9">
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to dashboard
      </Link>
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-coral-dark">New campaign</p>
      <h1 className="display-type mt-3 text-5xl font-semibold sm:text-6xl">Create a community commitment.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-soft">
        Set the commitment, choose the recipient partners, and review everything before opening voting to your community.
      </p>

      <div className="mt-10">
        {organizations && organizations.length >= 2 ? (
          <CampaignForm organizations={organizations} />
        ) : (
          <div className="rounded-[2rem] border border-dashed border-ink/20 bg-surface p-10 text-center">
            <p className="font-semibold">Add at least two workspace recipients first.</p>
            <Link href="/dashboard/organizations" className="mt-4 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Manage recipient network</Link>
          </div>
        )}
      </div>
    </main>
  );
}
