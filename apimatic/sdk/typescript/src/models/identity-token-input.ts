import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A host-application user for whom a short-lived browser identity token should be issued. */
export type IdentityTokenInput = {
  /** Stable supporter id assigned by the host application. */
  externalUserId: string;
  /** Optional human-readable supporter name. */
  displayName?: string;
  /** Identity token lifetime in seconds. @default 900 */
  ttlSeconds?: number;
};

export const identityTokenInputSchema: Schema<IdentityTokenInput> = s.object<IdentityTokenInput>({
  externalUserId: s.string(),
  displayName: s.optional(s.string()),
  ttlSeconds: s.defaulted(s.int(), 900),
  _keysMap: {
    externalUserId: "external_user_id",
    displayName: "display_name",
    ttlSeconds: "ttl_seconds",
  },
});
