import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createVoteIdentity } from "@/lib/vote-identity";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  organizationId: z.number().int().positive(),
});

type VoteResult = {
  status?:
    | "accepted"
    | "already_voted"
    | "rate_limited"
    | "voting_closed"
    | "invalid_choice"
    | "invalid_request";
  total_votes?: number;
};

function responseForStatus(result: VoteResult) {
  switch (result.status) {
    case "accepted":
      return { status: 201, message: "Your vote was counted." };
    case "already_voted":
      return { status: 409, message: "This browser has already voted in this period." };
    case "rate_limited":
      return { status: 429, message: "Too many votes came from this network. Try again later." };
    case "voting_closed":
      return { status: 409, message: "Voting is not currently open." };
    case "invalid_choice":
      return { status: 400, message: "That organization is not eligible in this campaign." };
    default:
      return { status: 400, message: "We couldn’t validate this vote." };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await context.params;
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicId)) {
    return NextResponse.json(
      { status: "invalid_request", message: "We couldn’t validate this vote." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const identity = createVoteIdentity(request);
    const supabase = createPrivilegedClient();
    const { data, error } = await supabase.rpc("cast_vote", {
      p_public_id: publicId,
      p_organization_id: parsed.data.organizationId,
      p_visitor_key_hash: identity.visitorKeyHash,
      p_rate_limit_key_hash: identity.rateLimitKeyHash,
    });

    if (error) {
      console.error("vote_rpc_failed", { code: error.code });
      return NextResponse.json(
        { status: "unavailable", message: "Voting is temporarily unavailable." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const result = (data ?? {}) as VoteResult;
    const mapped = responseForStatus(result);
    const response = NextResponse.json(
      {
        status: result.status,
        message: mapped.message,
        totalVotes: result.total_votes,
      },
      { status: mapped.status, headers: { "Cache-Control": "no-store" } },
    );

    if (identity.isNew) {
      const isProduction = process.env.NODE_ENV === "production";
      response.cookies.set(identity.cookieName, identity.voterToken, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 400,
        path: "/",
        sameSite: isProduction ? "none" : "lax",
        secure: isProduction,
        partitioned: isProduction,
      });
    }

    return response;
  } catch (error) {
    console.error("vote_configuration_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { status: "unavailable", message: "Voting is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
