import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("company_id, role, companies(name, public_name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const company = Array.isArray(membership?.companies)
    ? membership.companies[0]
    : membership?.companies;
  const companyName = company?.public_name ?? company?.name ?? "Our Impact workspace";
  const displayName = profile?.display_name ?? "Company admin";
  const initial = displayName.trim().charAt(0).toUpperCase() || "O";

  return (
    <div className="dashboard-canvas min-h-screen md:grid md:grid-cols-[236px_minmax(0,1fr)]">
      <DashboardSidebar companyName={companyName} role={membership?.role ?? "member"} displayName={displayName} initial={initial} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
