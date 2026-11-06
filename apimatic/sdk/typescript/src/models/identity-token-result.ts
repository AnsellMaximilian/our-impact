import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { supporterSchema, type Supporter } from "./supporter.js";

/** A short-lived token and its identified supporter. */
export type IdentityTokenResult = {
  /** Opaque identity token safe to return to the authenticated browser. */
  token: string;
  /** When the identity token stops being accepted. */
  expiresAt: Date;
  /** A supporter identified by the host application. */
  user: Supporter;
};

export const identityTokenResultSchema: Schema<IdentityTokenResult> = s.object<IdentityTokenResult>({
  token: s.string(),
  expiresAt: s.dateTime(),
  user: supporterSchema,
  _keysMap: {
    expiresAt: "expires_at",
  },
});
