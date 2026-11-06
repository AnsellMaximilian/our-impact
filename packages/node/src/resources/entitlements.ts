import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import * as s from "../core/validation/index.js";
import { apiErrorModelSchema, type ApiErrorModel } from "../models/api-error-model.js";
import {
  userEntitlementsResultSchema,
  type UserEntitlementsResult,
} from "../models/user-entitlements-result.js";
import type { Servers } from "../servers.js";

/**
 * Current deterministic product access for a supporter.
 */
export class Entitlements {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * List a supporter’s entitlements from a server
   *
   * @remarks
   * Returns the current entitlement evaluation for a supporter identified by the host application's
   * stable user id.
   *
   * @returns Supporter and current entitlement state.
   *
   * @throws {@link Entitlements.ListUserEntitlementsError} when the API answers with an error
   * status — narrow on `err.payload.kind`
   *
   * @throws {@link OurImpactError} when no usable response was produced: a connection failure, a
   * timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  listUserEntitlements(
    request: Entitlements.ListUserEntitlementsRequest,
    options?: RequestOptions,
  ): ApiPromise<UserEntitlementsResult, Entitlements.ListUserEntitlementsError> {
    return this.#rawClient.execute(
      {
        method: "GET",
        urlTemplate: this.#servers.default("/api/v1/users/{externalUserId}/entitlements"),
        auth: this.#auth.secretApiKey,
        pathParams: [{ name: "externalUserId", value: request.externalUserId, schema: s.string() }],
        query: [],
        headers: [],
        body: { kind: "empty" },
      },
      {
        success: { kind: "json", schema: userEntitlementsResultSchema },
        errorFactory: Entitlements.ListUserEntitlementsError,
      },
      options,
    );
  }
}

export namespace Entitlements {
  export type ListUserEntitlementsRequest = {
    /** The stable user id from the host application. */
    externalUserId: string;
  };

  export class ListUserEntitlementsError extends ApiError {
    declare readonly payload:
      | Declared<"apiErrorModel", ApiErrorModel>
      | Declared<"apiErrorModel2", ApiErrorModel>
      | Undeclared;

    static readonly errors: ErrorDecoders<ListUserEntitlementsError> = [
      { on: 401, kind: "apiErrorModel", decode: { kind: "json", schema: apiErrorModelSchema } },
      { on: 404, kind: "apiErrorModel2", decode: { kind: "json", schema: apiErrorModelSchema } },
    ];
  }
}
