import "server-only";

import type { NextRequest } from "next/server";
import {
  verifyWidgetIdentity,
  type WidgetIdentityClaims,
} from "@/lib/developer/credentials";

const localCookieName = "our-impact-widget";
const productionCookieName = "__Host-our-impact-widget";

export function getWidgetIdentityCookieName() {
  return process.env.NODE_ENV === "production"
    ? productionCookieName
    : localCookieName;
}

export function readWidgetIdentity(
  request: NextRequest,
  campaign: { id: string; companyId: string },
): WidgetIdentityClaims | null {
  const value = request.cookies.get(getWidgetIdentityCookieName())?.value;
  if (!value) return null;
  const claims = verifyWidgetIdentity(value);
  if (
    !claims ||
    claims.campaignId !== campaign.id ||
    claims.companyId !== campaign.companyId
  ) {
    return null;
  }
  return claims;
}
