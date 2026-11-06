import { redirect } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
import { DashboardNav } from "@/components/dashboard-nav";
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
      <aside className="sticky top-0 z-30 flex items-center gap-3 overflow-x-auto bg-ink px-4 py-3 text-white md:flex md:h-screen md:flex-col md:items-stretch md:overflow-visible md:px-4 md:py-5">
        <Brand href="/dashboard" className="px-2 text-white [&_span:last-child]:text-white" />
        <div className="mt-5 hidden rounded-2xl border border-white/8 bg-white/[0.045] p-3 md:block">
          <p className="truncate text-sm font-semibold text-white">{companyName}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-mint/75">{membership?.role ?? "member"} workspace</p>
        </div>
        <div className="min-w-0 flex-1 md:mt-5"><DashboardNav /></div>
        <div className="mt-5 hidden border-t border-white/10 pt-4 md:block">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint font-bold text-ink">{initial}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-white/45">Account</p></div>
            <ChevronDown className="size-4 text-white/40" aria-hidden="true" />
          </div>
          <form action={signOut} className="mt-1">
            <button type="submit" className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/55 transition hover:bg-white/7 hover:text-white">
              <LogOut className="size-4" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
