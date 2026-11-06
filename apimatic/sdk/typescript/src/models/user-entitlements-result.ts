import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { entitlementSchema, type Entitlement } from "./entitlement.js";
import { supporterSchema, type Supporter } from "./supporter.js";

/** A supporter and every entitlement currently evaluated for that supporter. */
export type UserEntitlementsResult = {
  /** A supporter identified by the host application. */
  user: Supporter;
  /** Current evaluated entitlement states for the supporter. */
  entitlements: Entitlement[];
};

export const userEntitlementsResultSchema: Schema<UserEntitlementsResult> = s.object<UserEntitlementsResult>({
  user: supporterSchema,
  entitlements: s.array(s.lazy(() => entitlementSchema)),
});
