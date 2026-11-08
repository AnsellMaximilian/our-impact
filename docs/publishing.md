# Publishing the Our Impact SDKs

Our Impact ships two public npm packages with different release paths:

- `@our-impact/node` is generated from `apimatic/server/src/spec/openapi.json` and is
  published through APIMatic. It is for trusted server code and accepts secret API keys.
- `@our-impact/browser` is hand-maintained in `packages/browser` and is published directly
  to npm. It accepts only a publishable key and a short-lived user identity token.

The separation is intentional. The browser package also owns the campaign embed and
automatic resizing behavior, which are not generated from the HTTP API description.

## One-time account setup

1. Create or claim the public `@our-impact` scope on npm and enable two-factor
   authentication for the account that owns it.
2. In APIMatic's **Publishing Center**, add an npm credential and create a publishing
   profile whose TypeScript package name is `@our-impact/node`.
3. Optionally attach a dedicated GitHub SDK repository to the same profile if generated
   source should also be public outside this monorepo.
4. Sign the local CLI in with `apimatic auth login`, then confirm the profile ID with
   `apimatic publishing profile list`.

Never commit npm tokens, APIMatic API keys, or Our Impact secret API keys.

## Release checks

Run the complete local package check from the repository root:

```bash
npm run openapi:export
npm run sdk:check
apimatic api validate --input ./apimatic/server
```

Review the generated server SDK before publishing:

```bash
apimatic sdk publish \
  --dry-run \
  --profile-id=<profile-id> \
  --language=typescript \
  --version=0.1.0 \
  --publish-type=package \
  --input=./apimatic/server \
  --destination=./packages/node
```

## Publish the generated server SDK

Remove `--dry-run` after reviewing the package. Add a second
`--publish-type=sourcecode` flag if the publishing profile also has a GitHub repository.

```bash
apimatic sdk publish \
  --profile-id=<profile-id> \
  --language=typescript \
  --version=0.1.0 \
  --publish-type=package \
  --input=./apimatic/server \
  --destination=./packages/node
```

APIMatic generates, builds, and publishes this package to npm using the publishing
profile. Consumers can then install it with:

```bash
npm install @our-impact/node
```

## Publish the browser SDK

Build and inspect the hand-maintained browser tarball, then publish it directly from its
package directory:

```bash
npm --prefix packages/browser run build
npm pack --dry-run ./packages/browser
npm publish ./packages/browser
```

The package's `publishConfig.access` is `public`, so the initial scoped release is public.
Consumers can then install it with:

```bash
npm install @our-impact/browser
```

## Versioning

Both packages currently begin at `0.1.0`. Keep them on the same version while their
public contract is evolving, even though they are published separately. Every new npm
release requires a new semantic version; a published version cannot be overwritten.

For a server API change, update the Next.js route behavior and OpenAPI source together,
export the snapshots, regenerate the server SDK, run the smoke test, and publish both
packages only if the browser surface changed as well.

## Developer portal

The installable packages live on npm. Documentation is a separate concern:

- The product-facing documentation is served by the Next.js app at `/developers/docs`.
- The APIMatic portal can be previewed with `apimatic portal serve --input ./apimatic` or
  generated as a static site with `apimatic portal generate --input ./apimatic`.

Publishing an SDK does not automatically deploy the Next.js documentation site. The
Vercel deployment continues to publish that site from this repository.
