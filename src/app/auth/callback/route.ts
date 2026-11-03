import { NextResponse } from "next/server";
import { safeInternalRedirect } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const safeDestination = safeInternalRedirect(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(safeDestination, url.origin));
    }
  }

  const loginUrl = new URL("/login", url.origin);
  loginUrl.searchParams.set("error", "confirmation");
  loginUrl.searchParams.set("next", safeDestination);
  return NextResponse.redirect(loginUrl);
}
