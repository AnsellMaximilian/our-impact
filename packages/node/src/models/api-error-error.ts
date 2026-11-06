import * as s from "../core/validation/index.js";
import type { Schema } from "../core/validation/schema.js";

/** A request error returned by the Our Impact API. */
export type ApiErrorError = {
  /** Stable machine-readable error code. */
  error: string;
};

export const apiErrorErrorSchema: Schema<ApiErrorError> = s.object<ApiErrorError>({
  error: s.string(),
});
