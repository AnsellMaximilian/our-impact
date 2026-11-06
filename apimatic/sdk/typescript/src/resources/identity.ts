import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import { uuid } from "../core/uuid.js";
import * as s from "../core/validation/index.js";
import { apiErrorModelSchema, type ApiErrorModel } from "../models/api-error-model.js";
import { identityTokenInputSchema, type IdentityTokenInput } from "../models/identity-token-input.js";
import { identityTokenResultSchema, type IdentityTokenResult } from "../models/identity-token-result.js";
import type { Servers } from "../servers.js";

/**
 * Short-lived identity tokens issued by the host application server.
 */
export class Identity {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Create a short-lived supporter identity token
   *
   * @remarks
   * Call from the host application server after it authenticates its own user. Never expose the
   * secret API key in a browser.
   *
   * @returns Identity token issued.
   *
   * @throws {@link Identity.CreateIdentityTokenError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link OurImpactDeveloperApiError} when no usable response was produced: a connection
   * failure, a timeout, a body that would not decode, a value that would not encode, or a
   * credential that could not be obtained
   */
  createIdentityToken(
    request: Identity.CreateIdentityTokenRequest,
    options?: RequestOptions,
  ): ApiPromise<IdentityTokenResult, Identity.CreateIdentityTokenError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/api/v1/identity-tokens"),
        auth: this.#auth.secretApiKey,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: uuid(), schema: s.string() }],
        body: { kind: "json", value: request.body, schema: identityTokenInputSchema },
      },
      {
        success: { kind: "json", schema: identityTokenResultSchema },
        errorFactory: Identity.CreateIdentityTokenError,
      },
      options,
    );
  }
}

export namespace Identity {
  export type CreateIdentityTokenRequest = {
    /** The authenticated host-application user to identify in the browser. */
    body: IdentityTokenInput;
  };

  export class CreateIdentityTokenError extends ApiError {
    declare readonly payload:
      | Declared<"apiErrorModel", ApiErrorModel>
      | Declared<"apiErrorModel2", ApiErrorModel>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateIdentityTokenError> = [
      { on: 400, kind: "apiErrorModel", decode: { kind: "json", schema: apiErrorModelSchema } },
      { on: 401, kind: "apiErrorModel2", decode: { kind: "json", schema: apiErrorModelSchema } },
    ];
  }
}
