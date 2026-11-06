import * as s from "../core/validation/index.js";
import type { EnumSchema } from "../core/validation/schema.js";

/** Whether the supporter currently qualifies for the entitlement. */
export const EntitlementState = {
  Active: "active",
  Inactive: "inactive",
} as const;
export type EntitlementState = (typeof EntitlementState)[keyof typeof EntitlementState] | (string & {});

export const entitlementStateSchema: EnumSchema<EntitlementState> =
  s.enumOf<EntitlementState>(EntitlementState);
