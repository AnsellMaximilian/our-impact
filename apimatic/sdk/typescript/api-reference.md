# Reference

> Source: [OurImpactDeveloperApiClient](src/client.ts)

## Events

> Source: [Events](src/resources/events.ts)

<details>
<summary><code>createVerifiedEvent(request: Events.CreateVerifiedEventRequest, options?: RequestOptions): ApiPromise&lt;EventResult, Events.CreateVerifiedEventError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Idempotent by event id within a developer project. Replays return the original evaluation state.

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.events.createVerifiedEvent({
    body: { id: "some example string", type: "some example string", externalUserId: "some example string" },
  });
  // TODO: Handle 'response' of type EventResult
} catch (err) {
  // TODO: Handle 'err' of type Events.CreateVerifiedEventError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.events.createVerifiedEvent({
  body: { id: "some example string", type: "some example string", externalUserId: "some example string" },
}).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type EventResult
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>body</code> | <code>[EventInput](src/models/event-input.ts)</code> | A supporter event that the host application has already verified. |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.events.createVerifiedEvent(request)`

- **OnSuccess**: <code>[EventResult](src/models/event-result.ts)</code>
- **OnError**: throws <code>[Events.CreateVerifiedEventError](src/resources/events.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.events.createVerifiedEvent(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;EventResult, Events.CreateVerifiedEventError&gt;</code>, with `result.value` of type <code>[EventResult](src/models/event-result.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[OurImpactDeveloperApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

## Identity

> Source: [Identity](src/resources/identity.ts)

<details>
<summary><code>createIdentityToken(request: Identity.CreateIdentityTokenRequest, options?: RequestOptions): ApiPromise&lt;IdentityTokenResult, Identity.CreateIdentityTokenError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Call from the host application server after it authenticates its own user. Never expose the secret API key in a browser.

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.identity.createIdentityToken({
    body: { externalUserId: "some example string" },
  });
  // TODO: Handle 'response' of type IdentityTokenResult
} catch (err) {
  // TODO: Handle 'err' of type Identity.CreateIdentityTokenError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.identity.createIdentityToken({
  body: { externalUserId: "some example string" },
}).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type IdentityTokenResult
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>body</code> | <code>[IdentityTokenInput](src/models/identity-token-input.ts)</code> | The authenticated host-application user to identify in the browser. |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.identity.createIdentityToken(request)`

- **OnSuccess**: <code>[IdentityTokenResult](src/models/identity-token-result.ts)</code>
- **OnError**: throws <code>[Identity.CreateIdentityTokenError](src/resources/identity.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.identity.createIdentityToken(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;IdentityTokenResult, Identity.CreateIdentityTokenError&gt;</code>, with `result.value` of type <code>[IdentityTokenResult](src/models/identity-token-result.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[OurImpactDeveloperApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

## Entitlements

> Source: [Entitlements](src/resources/entitlements.ts)

<details>
<summary><code>listCurrentUserEntitlements(options?: RequestOptions): ApiPromise&lt;UserEntitlementsResult, Entitlements.ListCurrentUserEntitlementsError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Requires both the project publishable key and a short-lived identity token issued by the host server.

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.entitlements.listCurrentUserEntitlements();
  // TODO: Handle 'response' of type UserEntitlementsResult
} catch (err) {
  // TODO: Handle 'err' of type Entitlements.ListCurrentUserEntitlementsError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.entitlements.listCurrentUserEntitlements().asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type UserEntitlementsResult
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.entitlements.listCurrentUserEntitlements()`

- **OnSuccess**: <code>[UserEntitlementsResult](src/models/user-entitlements-result.ts)</code>
- **OnError**: throws <code>[Entitlements.ListCurrentUserEntitlementsError](src/resources/entitlements.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.entitlements.listCurrentUserEntitlements().asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;UserEntitlementsResult, Entitlements.ListCurrentUserEntitlementsError&gt;</code>, with `result.value` of type <code>[UserEntitlementsResult](src/models/user-entitlements-result.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[OurImpactDeveloperApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

<details>
<summary><code>listUserEntitlements(request: Entitlements.ListUserEntitlementsRequest, options?: RequestOptions): ApiPromise&lt;UserEntitlementsResult, Entitlements.ListUserEntitlementsError&gt;</code></summary>

<dl>
<dd>

### Description

<dl>
<dd>

Returns the current entitlement evaluation for a supporter identified by the host application's stable user id.

</dd>
</dl>

### Direct Usage

<dl>
<dd>

```ts
try {
  const response = await client.entitlements.listUserEntitlements({
    externalUserId: "mikes_vegan_shop:jamie",
  });
  // TODO: Handle 'response' of type UserEntitlementsResult
} catch (err) {
  // TODO: Handle 'err' of type Entitlements.ListUserEntitlementsError, discriminated with 'err.payload.kind'
}
```

</dd>
</dl>

### Usage as ApiResult

<dl>
<dd>

```ts
const result = await client.entitlements.listUserEntitlements({
  externalUserId: "mikes_vegan_shop:jamie",
}).asApiResult();
// TODO: Use 'result.status' and 'result.headers' to read the raw response status and headers
if (result.ok) {
  // TODO: Use 'result.value' of type UserEntitlementsResult
} else {
  // TODO: Handle 'result', discriminated with 'result.payload.kind'
}
```

</dd>
</dl>

### Parameters

<dl>
<dd>

| Name | Type | Description |
| --- | --- | --- |
| <code>externalUserId</code> | <code>string</code> | The stable user id from the host application. |

</dd>
</dl>

### Response

<dl>
<dd>

**Direct**: `await client.entitlements.listUserEntitlements(request)`

- **OnSuccess**: <code>[UserEntitlementsResult](src/models/user-entitlements-result.ts)</code>
- **OnError**: throws <code>[Entitlements.ListUserEntitlementsError](src/resources/entitlements.ts)</code>, with `err.payload` discriminated on `kind`

**As ApiResult**: `await client.entitlements.listUserEntitlements(request).asApiResult()`

- **OnSuccess**: <code>[ApiResult](src/core/api-promise.ts)&lt;UserEntitlementsResult, Entitlements.ListUserEntitlementsError&gt;</code>, with `result.value` of type <code>[UserEntitlementsResult](src/models/user-entitlements-result.ts)</code>
- **OnError**: `result.payload` discriminated on `kind`, with `result.message`

**Thrown**: <code>[OurImpactDeveloperApiError](src/core/errors.ts)</code> on any operational failure — a caller abort and a programmer error stay outside the family and reach you raw

</dd>
</dl>

</dd>
</dl>

</details>

