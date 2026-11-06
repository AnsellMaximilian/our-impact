# Our Impact developer platform

This directory is the source for the APIMatic developer portal and server SDK. The full
public API contract lives in `src/spec/openapi.json`; the server-only SDK contract lives
in `server/src/spec/openapi.json`. Portal configuration and guides live under `src/`.

The Next.js application remains the runtime source of truth for API behavior. When the
public contract changes, refresh this OpenAPI snapshot and validate it before generating
or publishing an SDK.

## Local commands

Requires Node.js 24 or newer and APIMatic CLI v2.

```bash
apimatic auth login
node ../scripts/export-openapi.mjs
apimatic api validate --input ./server
apimatic portal serve
apimatic sdk generate --language=typescript --input ./server --destination ../packages/node
npm --prefix ../packages/node install
npm --prefix ../packages/browser install
node ../scripts/smoke-packages.mjs
```

`@our-impact/node` is generated from APIMatic and is safe only for trusted server code.
`@our-impact/browser` is intentionally small and hand-maintained around the browser-only
identity-token flow. Neither package is published automatically.

Do not commit APIMatic credentials or Our Impact secret API keys.

## Current portal caveat

APIMatic CLI 2.2.0 successfully builds the portal, but its generated interactive API
playground currently throws a `structuredClone` error on endpoint pages in the Codex
in-app Chromium browser. The static documentation content is present and the generated
SDK is unaffected. Recheck the playground after an APIMatic CLI update before deploying
the portal publicly.
