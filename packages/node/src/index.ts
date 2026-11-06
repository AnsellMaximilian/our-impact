export { OurImpactClient } from "./client.js";
export type { ClientOptions } from "./client-options.js";

export type { TokenProvider } from "./core/auth/credentials.js";

export { Events } from "./resources/events.js";
export { Identity } from "./resources/identity.js";
export { Entitlements } from "./resources/entitlements.js";

export { apiErrorModelSchema, type ApiErrorModel } from "./models/api-error-model.js";
export { apiErrorErrorSchema, type ApiErrorError } from "./models/api-error-error.js";
export { entitlementSchema, type Entitlement } from "./models/entitlement.js";
export { EntitlementState, entitlementStateSchema } from "./models/entitlement-state.js";
export { eventInputSchema, type EventInput } from "./models/event-input.js";
export { eventResultSchema, type EventResult } from "./models/event-result.js";
export { identityTokenInputSchema, type IdentityTokenInput } from "./models/identity-token-input.js";
export { identityTokenResultSchema, type IdentityTokenResult } from "./models/identity-token-result.js";
export { supporterSchema, type Supporter } from "./models/supporter.js";
export {
  userEntitlementsResultSchema,
  type UserEntitlementsResult,
} from "./models/user-entitlements-result.js";

export {
  CoreError as OurImpactError,
  ResponseError,
  DecodeError,
  EncodeError,
  ConnectionError,
  TimeoutError,
  AuthError,
  PaginationError,
  ConfigurationError,
} from "./core/errors.js";
export { ApiError } from "./core/api-error.js";
export { SchemaError } from "./core/validation/schema-error.js";
export {
  defaultLoggingOptions,
  type LoggingOptions,
  type RequestLoggingOptions,
  type Logger,
  type LogDetails,
  type HttpRequestDetails,
  type RequestHeadersDetails,
  type RequestBodyDetails,
  type HttpResponseDetails,
  type ResponseHeadersDetails,
  type HttpRetryingDetails,
  type HttpFailedDetails,
  type LogLevel,
} from "./core/logging.js";
export type { ApiPromise, ApiResult } from "./core/api-promise.js";
export type { Pageable, PageableApiResult } from "./core/pagination/pageable.js";
export type { HttpMethod, RequestOptions } from "./core/api-request.js";
export type { RetryOptions, RequestRetryOptions, RetryAttempt, RetryReason } from "./core/retry.js";
export type { BinaryContent, BinaryData, BinaryErrorContent, FileData, FileInput } from "./core/binary.js";
export type { ErrorKind } from "./core/errors.js";
export type { Declared, Undeclared } from "./core/api-error.js";
export type { Schema, EnumSchema, Encoded } from "./core/validation/schema.js";
