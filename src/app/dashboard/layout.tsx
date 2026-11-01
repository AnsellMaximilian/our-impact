import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Code2, LayoutDashboard, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { Brand } from "@/components/brand";
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

  return (
    <div className="min-h-screen bg-paper/80">
      <header className="sticky top-0 z-20 border-b border-ink/8 bg-paper/90 px-5 py-3 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Brand href="/dashboard" />
          <nav className="flex items-center gap-1" aria-label="Dashboard navigation">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white hover:text-ink sm:inline-flex"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/organizations"
              className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white hover:text-ink md:inline-flex"
            >
              <Building2 className="size-4" aria-hidden="true" />
              Recipients
            </Link>
            <Link
              href="/dashboard/developers"
              className="hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-white hover:text-ink md:inline-flex"
            >
              <Code2 className="size-4" aria-hidden="true" />
              Developers
            </Link>
            <span className="hidden max-w-36 truncate px-3 text-sm text-ink-soft lg:inline">
              {profile?.display_name ?? "Company admin"}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-ink/20 hover:shadow-sm"
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
