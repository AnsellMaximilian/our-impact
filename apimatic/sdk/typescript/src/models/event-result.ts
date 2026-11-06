import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";
import { entitlementSchema, type Entitlement } from "./entitlement.js";

/** The accepted event and the supporter entitlements evaluated from it. */
export type EventResult = {
  /** Our Impact's internal event id. */
  id: string;
  /** True when this idempotency key had already been processed. */
  replayed: boolean;
  /** Current entitlement states after evaluating the event. */
  entitlements: Entitlement[];
};

export const eventResultSchema: Schema<EventResult> = s.object<EventResult>({
  id: s.string(),
  replayed: s.boolean(),
  entitlements: s.array(s.lazy(() => entitlementSchema)),
});
