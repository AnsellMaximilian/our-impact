import type { AuthSchemes } from "../auth-schemes.js";
import { ApiError, type Declared, type Undeclared } from "../core/api-error.js";
import type { ApiPromise } from "../core/api-promise.js";
import type { RequestOptions } from "../core/api-request.js";
import type { RawClient } from "../core/raw-client.js";
import type { ErrorDecoders } from "../core/response-decoder.js";
import { uuid } from "../core/uuid.js";
import * as s from "../core/validation/index.js";
import { apiErrorModelSchema, type ApiErrorModel } from "../models/api-error-model.js";
import { eventInputSchema, type EventInput } from "../models/event-input.js";
import { eventResultSchema, type EventResult } from "../models/event-result.js";
import type { Servers } from "../servers.js";

/**
 * Verified server-to-server supporter activity.
 */
export class Events {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;

  constructor(rawClient: RawClient, servers: Servers, auth: AuthSchemes) {
    this.#rawClient = rawClient;
    this.#servers = servers;
    this.#auth = auth;
  }

  /**
   * Send a verified supporter event
   *
   * @remarks
   * Idempotent by event id within a developer project. Replays return the original evaluation
   * state.
   *
   * @returns Idempotent event replay.
   *
   * @throws {@link Events.CreateVerifiedEventError} when the API answers with an error status —
   * narrow on `err.payload.kind`
   *
   * @throws {@link OurImpactError} when no usable response was produced: a connection failure, a
   * timeout, a body that would not decode, a value that would not encode, or a credential that
   * could not be obtained
   */
  createVerifiedEvent(
    request: Events.CreateVerifiedEventRequest,
    options?: RequestOptions,
  ): ApiPromise<EventResult, Events.CreateVerifiedEventError> {
    return this.#rawClient.execute(
      {
        method: "POST",
        urlTemplate: this.#servers.default("/api/v1/events"),
        auth: this.#auth.secretApiKey,
        pathParams: [],
        query: [],
        headers: [{ name: "Idempotency-Key", value: uuid(), schema: s.string() }],
        body: { kind: "json", value: request.body, schema: eventInputSchema },
      },
      {
        success: { kind: "json", schema: eventResultSchema },
        errorFactory: Events.CreateVerifiedEventError,
      },
      options,
    );
  }
}

export namespace Events {
  export type CreateVerifiedEventRequest = {
    /** A supporter event that the host application has already verified. */
    body: EventInput;
  };

  export class CreateVerifiedEventError extends ApiError {
    declare readonly payload:
      | Declared<"apiErrorModel", ApiErrorModel>
      | Declared<"apiErrorModel2", ApiErrorModel>
      | Undeclared;

    static readonly errors: ErrorDecoders<CreateVerifiedEventError> = [
      { on: 400, kind: "apiErrorModel", decode: { kind: "json", schema: apiErrorModelSchema } },
      { on: 401, kind: "apiErrorModel2", decode: { kind: "json", schema: apiErrorModelSchema } },
    ];
  }
}
