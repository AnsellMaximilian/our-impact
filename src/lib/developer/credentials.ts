import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const IDENTITY_TOKEN_TTL_SECONDS = 15 * 60;

export type IdentityClaims = {
  typ: "our-impact-user";
  v: 1;
  projectId: string;
  companyId: string;
  supporterId: string;
  externalUserId: string;
  iat: number;
  exp: number;
};

export type WidgetIdentityClaims = {
  typ: "our-impact-widget";
  v: 1;
  projectId: string;
  companyId: string;
  supporterId: string;
  externalUserId: string;
  campaignId: string;
  parentOrigin: string;
  iat: number;
  exp: number;
};

function signingSecret() {
  const secret = process.env.DEVELOPER_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("DEVELOPER_SIGNING_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

export function createPublishableKey() {
  return `oi_pk_test_${randomBytes(24).toString("base64url")}`;
}

export function createSecretApiKey() {
  const value = `oi_sk_test_${randomBytes(32).toString("base64url")}`;
  return {
    value,
    prefix: value.slice(0, 24),
    hash: hashApiKey(value),
    lastFour: value.slice(-4),
  };
}

export function hashApiKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function issueIdentityToken(
  claims: Omit<IdentityClaims, "typ" | "v" | "iat" | "exp">,
  ttlSeconds = IDENTITY_TOKEN_TTL_SECONDS,
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: IdentityClaims = {
    ...claims,
    typ: "our-impact-user",
    v: 1,
    iat: now,
    exp: now + Math.min(Math.max(ttlSeconds, 60), 3600),
  };
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return { token: `${unsigned}.${sign(unsigned)}`, expiresAt: payload.exp };
}

export function verifyIdentityToken(token: string): IdentityClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${body}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as IdentityClaims;
    if (
      claims.typ !== "our-impact-user" ||
      claims.v !== 1 ||
      !claims.projectId ||
      !claims.companyId ||
      !claims.supporterId ||
      !claims.externalUserId ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function issueWidgetIdentity(
  claims: Omit<WidgetIdentityClaims, "typ" | "v" | "iat" | "exp">,
  ttlSeconds: number,
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: WidgetIdentityClaims = {
    ...claims,
    typ: "our-impact-widget",
    v: 1,
    iat: now,
    exp: now + Math.min(Math.max(ttlSeconds, 1), 3600),
  };
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return { token: `${unsigned}.${sign(unsigned)}`, expiresAt: payload.exp };
}

export function verifyWidgetIdentity(token: string): WidgetIdentityClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expected = Buffer.from(sign(`${header}.${body}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const claims = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as WidgetIdentityClaims;
    if (
      claims.typ !== "our-impact-widget" ||
      claims.v !== 1 ||
      !claims.projectId ||
      !claims.companyId ||
      !claims.supporterId ||
      !claims.externalUserId ||
      !claims.campaignId ||
      !claims.parentOrigin ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function deriveWebhookSecret(endpointId: string) {
  const value = createHmac("sha256", signingSecret())
    .update(`webhook:${endpointId}`)
    .digest("base64url");
  return `whsec_${value}`;
}

export function signWebhookPayload(endpointId: string, timestamp: number, body: string) {
  return createHmac("sha256", deriveWebhookSecret(endpointId))
    .update(`${timestamp}.${body}`)
    .digest("hex");
}
