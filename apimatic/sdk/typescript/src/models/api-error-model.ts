import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A request error returned by the Our Impact API. */
export type ApiErrorModel = {
  /** Stable machine-readable error code. */
  error: string;
};

export const apiErrorModelSchema: Schema<ApiErrorModel> = s.object<ApiErrorModel>({
  error: s.string(),
});
