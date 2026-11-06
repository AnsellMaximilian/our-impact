import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A verified supporter event submitted by the host application server. */
export type EventInput = {
  /** Stable idempotency key from the source system. */
  id: string;
  /** Namespaced event type used by entitlement rules. */
  type: string;
  /** Stable supporter id assigned by the host application. */
  externalUserId: string;
  /** Optional human-readable supporter name. */
  displayName?: string;
  /** When the verified activity occurred. Defaults to receipt time when omitted. */
  occurredAt?: Date;
  /** Event-specific facts available to entitlement rules. */
  properties?: Record<string, unknown>;
};

export const eventInputSchema: Schema<EventInput> = s.object<EventInput>({
  id: s.string(),
  type: s.string(),
  externalUserId: s.string(),
  displayName: s.optional(s.string()),
  occurredAt: s.optional(s.dateTime()),
  properties: s.optional(s.record(s.string(), s.unknown())),
  _keysMap: {
    externalUserId: "external_user_id",
    displayName: "display_name",
    occurredAt: "occurred_at",
  },
});
