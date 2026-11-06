import { buildAuthSchemes, type AuthSchemes } from "./auth-schemes.js";
import type { ClientOptions } from "./client-options.js";
import { buildCoreClientOptions } from "./core/client-options.js";
import { RawClient } from "./core/raw-client.js";
import * as host from "./core/runtime-environment.js";
import * as s from "./core/validation/index.js";
import { Entitlements } from "./resources/entitlements.js";
import { Events } from "./resources/events.js";
import { Identity } from "./resources/identity.js";
import { buildServers, type Servers } from "./servers.js";

/**
 * Send verified supporter events, issue short-lived browser identity tokens, and query
 * deterministic entitlements from a trusted server.
 */
export class OurImpactClient {
  readonly #rawClient: RawClient;
  readonly #servers: Servers;
  readonly #auth: AuthSchemes;
  #events?: Events;
  #identity?: Identity;
  #entitlements?: Entitlements;

  constructor(options: ClientOptions = {}) {
    this.#rawClient = new RawClient({
      ...buildCoreClientOptions(options, "OUR_IMPACT_CLIENT_LOG"),
      defaultHeaders: [
        { name: "User-Agent", value: "OurImpactClient/0.1.0 TypeScript", schema: s.string() },
        { name: "X-APIMatic-Lang", value: "TypeScript", schema: s.string() },
        { name: "X-APIMatic-Package-Version", value: "0.1.0", schema: s.string() },
        { name: "X-APIMatic-Gen-Version", value: "4.0.0", schema: s.string() },
        { name: "X-APIMatic-OS", value: host.operatingSystem(), schema: s.optional(s.string()) },
        { name: "X-APIMatic-Runtime", value: host.runtimeDescription(), schema: s.optional(s.string()) },
      ],
      defaultQuery: [],
      defaultPathParams: [],
    });

    this.#servers = buildServers(options);

    this.#auth = buildAuthSchemes(options);
  }

  /**
   * Verified server-to-server supporter activity.
   */
  get events(): Events {
    return (this.#events ??= new Events(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Short-lived identity tokens issued by the host application server.
   */
  get identity(): Identity {
    return (this.#identity ??= new Identity(this.#rawClient, this.#servers, this.#auth));
  }

  /**
   * Current deterministic product access for a supporter.
   */
  get entitlements(): Entitlements {
    return (this.#entitlements ??= new Entitlements(this.#rawClient, this.#servers, this.#auth));
  }
}
