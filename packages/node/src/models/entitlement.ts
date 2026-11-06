import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { entitlementStateSchema, type EntitlementState } from "./entitlement-state.js";

/** The current evaluated state and progress for one entitlement. */
export type Entitlement = {
  /** Stable key used by application code to check this entitlement. */
  entitlementKey: string;
  /** Whether the supporter currently qualifies for the entitlement. */
  state: EntitlementState;
  /** Number of qualifying records found in the evaluation window. */
  qualifyingCount: number;
  /** Count, or minor currency units when progressUnit is an ISO currency code. */
  progressValue: number;
  /** `events`, or a lowercase ISO 4217 currency code such as `usd`. */
  progressUnit: string;
  /** When the supporter most recently qualified, or null when inactive. */
  qualifiedAt: Date | null;
  /** When the entitlement expires, or null when the rule has no fixed expiry. */
  validUntil: Date | null;
  /** When this entitlement state was last evaluated. */
  updatedAt: Date;
};

export const entitlementSchema: Schema<Entitlement> = s.object<Entitlement>({
  entitlementKey: s.string(),
  state: entitlementStateSchema,
  qualifyingCount: s.int(),
  progressValue: s.int(),
  progressUnit: s.string(),
  qualifiedAt: s.nullable(s.dateTime()),
  validUntil: s.nullable(s.dateTime()),
  updatedAt: s.dateTime(),
  _keysMap: {
    entitlementKey: "entitlement_key",
    qualifyingCount: "qualifying_count",
    progressValue: "progress_value",
    progressUnit: "progress_unit",
    qualifiedAt: "qualified_at",
    validUntil: "valid_until",
    updatedAt: "updated_at",
  },
});
