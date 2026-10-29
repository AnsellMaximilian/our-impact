import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

const localCookieName = "our-impact-voter";
const productionCookieName = "__Host-our-impact-voter";

export function getVoteCookieName() {
  return process.env.NODE_ENV === "production"
    ? productionCookieName
    : localCookieName;
}

function getHashSecret() {
  const secret = process.env.VOTE_HASH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("VOTE_HASH_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function digest(value: string) {
  return createHmac("sha256", getHashSecret()).update(value).digest("hex");
}

export function createVoteIdentity(request: NextRequest) {
  const cookieName = getVoteCookieName();
  const existing = request.cookies.get(cookieName)?.value;
  const voterToken =
    existing && /^[0-9a-f]{64}$/.test(existing)
      ? existing
      : randomBytes(32).toString("hex");
  const ip =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    `unknown:${voterToken}`;

  return {
    cookieName,
    voterToken,
    isNew: voterToken !== existing,
    visitorKeyHash: digest(`visitor:${voterToken}`),
    rateLimitKeyHash: digest(`rate:${ip.split(",")[0]?.trim()}`),
  };
}
