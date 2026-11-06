import type { TokenProvider } from "./core/auth/credentials.js";
import type { CoreClientOptions } from "./core/client-options.js";

export type ClientOptions = SdkClientOptions & CoreClientOptions;

type SdkClientOptions = ServerOptions & {
  /** Sandbox project secret. Server-side only. */
  readonly secretApiKey?: TokenProvider | undefined;
};

type ServerOptions = {
  /** Our Impact sandbox environment */
  readonly serverOptions?: {
    baseUrl?: string;
  };
};
