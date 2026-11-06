import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A supporter identified by the host application. */
export type Supporter = {
  /** Stable supporter id assigned by the host application. */
  externalUserId: string;
  /** Human-readable supporter name when supplied by the host application. */
  displayName?: string | null;
};

export const supporterSchema: Schema<Supporter> = s.object<Supporter>({
  externalUserId: s.string(),
  displayName: s.optionalNullable(s.string()),
  _keysMap: {
    externalUserId: "external_user_id",
    displayName: "display_name",
  },
});
