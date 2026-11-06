<!-- Generated file — do not edit; regenerated with the SDK. -->

# Events — operations

Accessor: `client.events` · Source: `src/resources/events.ts` · 1 operation · Request and error types: namespace `Events`

**Type sources**: every type an operation names, with the file that declares it and the schema value exported beside it. Import every name from `our-impact-developer-api`; the `Source` path is where to **read** the shape, never what to import. `ApiError`, the runtime error family and the file vocabulary are excluded — see sdk-map.md.

### createVerifiedEvent

- **Signature**: `createVerifiedEvent(request: Events.CreateVerifiedEventRequest, options?: RequestOptions): ApiPromise<EventResult, Events.CreateVerifiedEventError>`
- **Wire**: `POST /api/v1/events`
- **Auth**: `secretApiKey`
- **Request body**: `application/json` — the `body` field
- **SDK-sent**: `header Idempotency-Key` (minted per call)
- **Returns**: `EventResult`
- **Error**: `OurImpactDeveloperApiError` with `kind: "api"`, an instance of `Events.CreateVerifiedEventError` — **typed arms**, narrowed on `err.payload.kind`
- **Error arms**: `"apiErrorModel"` [400] `ApiErrorModel` · `"apiErrorModel2"` [401] `ApiErrorModel` · `"undeclared"` [any other] `rawBody: ArrayBuffer`

**Fields** — `Events.CreateVerifiedEventRequest` (1):

| Field | Channel | Type | Req |
| --- | --- | --- | --- |
| `body` | `body` | `EventInput` | yes |

| Type | Schema value | Source |
| --- | --- | --- |
| `EventInput` | `eventInputSchema` | `src/models/event-input.ts` |
| `EventResult` | `eventResultSchema` | `src/models/event-result.ts` |
| `ApiErrorModel` | `apiErrorModelSchema` | `src/models/api-error-model.ts` |

