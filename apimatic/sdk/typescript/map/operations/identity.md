<!-- Generated file — do not edit; regenerated with the SDK. -->

# Identity — operations

Accessor: `client.identity` · Source: `src/resources/identity.ts` · 1 operation · Request and error types: namespace `Identity`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `our-impact-developer-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### createIdentityToken

- **Signature**: `createIdentityToken(request: Identity.CreateIdentityTokenRequest, options?: RequestOptions): ApiPromise<IdentityTokenResult, Identity.CreateIdentityTokenError>`
- **Wire**: `POST /api/v1/identity-tokens`
- **Auth**: `secretApiKey`
- **Request body**: `application/json` — the `body` field
- **SDK-sent**: `header Idempotency-Key` (minted per call)
- **Returns**: `IdentityTokenResult`
- **Error**: `OurImpactDeveloperApiError` with `kind: "api"`, an instance of `Identity.CreateIdentityTokenError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"apiErrorModel"` [400] `ApiErrorModel` · `"apiErrorModel2"` [401] `ApiErrorModel` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Identity.CreateIdentityTokenRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `body` | `body` | `IdentityTokenInput` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `IdentityTokenInput` | `identityTokenInputSchema` | `src/models/identity-token-input.ts` |
| `IdentityTokenResult` | `identityTokenResultSchema` | `src/models/identity-token-result.ts` |
| `ApiErrorModel` | `apiErrorModelSchema` | `src/models/api-error-model.ts` |

