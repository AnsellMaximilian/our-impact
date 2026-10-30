import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = createPrivilegedClient();
    const { data, error } = await supabase.rpc("close_due_campaign_periods", {
      p_limit: 100,
    });

    if (error) {
      console.error("Stage 2 period close failed", error);
      return NextResponse.json(
        { error: "Period close failed" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Stage 2 period close configuration error", error);
    return NextResponse.json(
      { error: "Period close is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
