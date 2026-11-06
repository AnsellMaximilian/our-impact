<!-- Generated file — do not edit; regenerated with the SDK. -->

# Entitlements — operations

Accessor: `client.entitlements` · Source: `src/resources/entitlements.ts` · 2 operations · Request and error types: namespace `Entitlements`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `our-impact-developer-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### listCurrentUserEntitlements

- **Signature**: `listCurrentUserEntitlements(options?: RequestOptions): ApiPromise<UserEntitlementsResult, Entitlements.ListCurrentUserEntitlementsError>`
- **Wire**: `GET /api/v1/me/entitlements`
- **Auth**: all of `publishableKey`, `identityBearer` — both are sent
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `UserEntitlementsResult`
- **Error**: `OurImpactDeveloperApiError` with `kind: "api"`, an instance of `Entitlements.ListCurrentUserEntitlementsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"apiErrorModel"` [401] `ApiErrorModel` · `"apiErrorModel2"` [403] `ApiErrorModel` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

| Type | Schema value | Source |
| --- | --- | --- |
| `UserEntitlementsResult` | `userEntitlementsResultSchema` | `src/models/user-entitlements-result.ts` |
| `ApiErrorModel` | `apiErrorModelSchema` | `src/models/api-error-model.ts` |

### listUserEntitlements

- **Signature**: `listUserEntitlements(request: Entitlements.ListUserEntitlementsRequest, options?: RequestOptions): ApiPromise<UserEntitlementsResult, Entitlements.ListUserEntitlementsError>`
- **Wire**: `GET /api/v1/users/{externalUserId}/entitlements`
- **Auth**: `secretApiKey`
- **Request body**: none — no `Content-Type` header is sent
- **Returns**: `UserEntitlementsResult`
- **Error**: `OurImpactDeveloperApiError` with `kind: "api"`, an instance of `Entitlements.ListUserEntitlementsError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"apiErrorModel"` [401] `ApiErrorModel` · `"apiErrorModel2"` [404] `ApiErrorModel` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Entitlements.ListUserEntitlementsRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `externalUserId` | `path` | `string` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `UserEntitlementsResult` | `userEntitlementsResultSchema` | `src/models/user-entitlements-result.ts` |
| `ApiErrorModel` | `apiErrorModelSchema` | `src/models/api-error-model.ts` |

