# Our Impact developer platform

This directory is the source for the APIMatic developer portal and generated SDKs. The
public API contract lives in `src/spec/openapi`; portal configuration and guides live
alongside it under `src/`.

The Next.js application remains the runtime source of truth for API behavior. When the
public contract changes, refresh this OpenAPI snapshot and validate it before generating
or publishing an SDK.

## Local commands

Requires Node.js 24 or newer and APIMatic CLI v2.

```bash
apimatic auth login
apimatic api validate
apimatic portal serve
apimatic sdk generate --language=typescript
npm --prefix sdk/typescript install
node scripts/smoke-generated-sdk.mjs
```

Do not commit APIMatic credentials or Our Impact secret API keys.

## Current portal caveat

APIMatic CLI 2.2.0 successfully builds the portal, but its generated interactive API
playground currently throws a `structuredClone` error on endpoint pages in the Codex
in-app Chromium browser. The static documentation content is present and the generated
SDK is unaffected. Recheck the playground after an APIMatic CLI update before deploying
the portal publicly.
