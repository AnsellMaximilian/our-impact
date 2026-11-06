import type { TokenProvider } from "./core/auth/credentials.js";
import type { CoreClientOptions } from "./core/client-options.js";

export type ClientOptions = SdkClientOptions & CoreClientOptions;

type SdkClientOptions = ServerOptions & {
  /** Sandbox project secret. Server-side only. */
  readonly secretApiKey?: TokenProvider | undefined;
  /** Short-lived browser identity token minted by the host application server. */
  readonly identityBearer?: TokenProvider | undefined;
  /** Sandbox publishable project key. */
  readonly publishableKey?: TokenProvider | undefined;
};

type ServerOptions = {
  /** Our Impact sandbox environment */
  readonly serverOptions?: {
    baseUrl?: string;
  };
};
