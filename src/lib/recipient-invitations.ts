import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const INVITATION_CONTEXT = "our-impact:recipient-invitation:v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingSecret() {
  const value = process.env.DEVELOPER_SIGNING_SECRET;
  if (!value) {
    throw new Error("DEVELOPER_SIGNING_SECRET is required for recipient invitations.");
  }
  return value;
}

function signatureFor(invitationId: string) {
  return createHmac("sha256", signingSecret())
    .update(`${INVITATION_CONTEXT}:${invitationId}`)
    .digest("base64url");
}

export function createRecipientInvitationToken(invitationId: string) {
  if (!UUID_PATTERN.test(invitationId)) {
    throw new Error("A valid recipient invitation ID is required.");
  }
  return `${invitationId}.${signatureFor(invitationId)}`;
}

export function verifyRecipientInvitationToken(token: string) {
  const [invitationId, suppliedSignature, extra] = token.split(".");
  if (extra || !invitationId || !suppliedSignature || !UUID_PATTERN.test(invitationId)) {
    return null;
  }

  const expectedSignature = signatureFor(invitationId);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return null;
  }

  return invitationId;
}

export function recipientInvitationPath(invitationId: string) {
  return `/recipients/connect/${encodeURIComponent(createRecipientInvitationToken(invitationId))}`;
}
