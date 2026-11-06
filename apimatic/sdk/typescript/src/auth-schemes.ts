import type { ClientOptions } from "./client-options.js";
import type { AuthScheme } from "./core/api-request.js";
import { apiKeyHeaderAuth, bearerAuth } from "./core/auth/schemes.js";

export type AuthSchemes = {
  readonly secretApiKey: AuthScheme;
  readonly identityBearer: AuthScheme;
  readonly publishableKey: AuthScheme;
};

export function buildAuthSchemes(options: ClientOptions): AuthSchemes {
  return {
    secretApiKey: bearerAuth(options.secretApiKey),
    identityBearer: bearerAuth(options.identityBearer),
    publishableKey: apiKeyHeaderAuth({ name: "x-our-impact-key", token: options.publishableKey }),
  };
}
