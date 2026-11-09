# Developer platform, identity, entitlements, and SDKs

The developer platform connects an Our Impact workspace to a customer's own application. It does not replace that application's authentication. The customer app remains the authority for “who is this user?”; Our Impact evaluates what that identified user has earned from verified events.

## Relationship to campaigns

Campaigns and developer projects are siblings owned by one workspace:

```mermaid
flowchart TB
  Workspace["Workspace"]
  Campaign["Campaign<br/>recipients, vote, schedule, budget"]
  Project["Developer project<br/>keys, origins, users, entitlements"]
  Widget["Embedded widget"]
  User["Host-app user"]
  Event["donation.completed"]
  Entitlement["Project entitlement"]

  Workspace --> Campaign
  Workspace --> Project
  Campaign --> Widget
  Project --> User
  User --> Widget
  Widget -->|"identified donation"| Event
  Event --> Project
  Project --> Entitlement
```

There is no permanent one-to-one campaign/project foreign key:

- a campaign determines which voting/donation experience and recipients are available;
- a developer project determines the host application's user namespace, credentials, rules, and webhooks;
- an identified widget session temporarily binds a project supporter to a campaign;
- a verified direct donation through that widget becomes a `donation.completed` event in that project;
- entitlement rules decide whether that event contributes to a grant.

An anonymous donation remains campaign activity but cannot grant a project entitlement because it is not safely associated with a host application's user.

## Credential model

Every developer project has two credential classes.

### Publishable key

Format:

```text
oi_pk_test_...
```

- stored in plaintext because it is intended for browser code;
- identifies one developer project;
- accepted only with a valid short-lived user token;
- browser requests are checked against the project's allowed origin list;
- cannot create identity tokens or submit trusted server events.

### Secret API key

Format:

```text
oi_sk_test_...
```

- generated from 32 random bytes;
- shown only at creation/rotation;
- only SHA-256 hash, prefix, and last four characters are stored;
- sent as a Bearer token from a trusted server;
- can issue user identity tokens, submit verified events, and query users server-side;
- records `last_used_at`;
- can be revoked without deleting the project.

Do not put the secret key in a `NEXT_PUBLIC_*` variable, mobile binary, browser bundle, log, or support ticket.

## Public API

Base URL:

```text
https://our-impact.vercel.app
```

The runtime OpenAPI document is served at `/api/openapi` and is created from `src/lib/developer/openapi.ts`.

| Operation | Authentication | Purpose |
| --- | --- | --- |
| `POST /api/v1/identity-tokens` | Secret key | Upsert a supporter and issue a short-lived browser token. |
| `POST /api/v1/events` | Secret key | Ingest a replay-safe verified host event and return current entitlements. |
| `GET /api/v1/users/{externalUserId}/entitlements` | Secret key | Authoritative server-side entitlement query. |
| `GET /api/v1/me/entitlements` | Publishable key + user token + allowed Origin | Browser-side current-user entitlement query. |

### Server authentication

```http
Authorization: Bearer oi_sk_test_...
```

### Browser authentication

```http
Authorization: Bearer SHORT_LIVED_USER_TOKEN
X-Our-Impact-Key: oi_pk_test_...
Origin: https://configured-host-app.example
```

Browser responses are private/no-store and return CORS headers for the accepted origin.

## User identity tokens

### Issuance

After the host server authenticates its own customer, it calls:

```ts
import { OurImpactClient } from "@our-impact/node";

const impact = new OurImpactClient({
  secretApiKey: process.env.OUR_IMPACT_SECRET_KEY,
});

const identity = await impact.identity.createIdentityToken({
  body: {
    externalUserId: session.user.id,
    displayName: session.user.name ?? undefined,
    ttlSeconds: 900,
  },
});
```

The external user ID must be stable inside the host application. It is scoped by developer project, so two customers can both use `user_123` without colliding.

### Claims and signature

The token is a compact, JWT-shaped HMAC-SHA256 token signed with `DEVELOPER_SIGNING_SECRET`. Claims include:

- type and version;
- project ID;
- company ID;
- internal supporter ID;
- external user ID;
- issued-at and expiry.

TTL is limited to 60–3600 seconds; the default client example uses 900 seconds. The browser cannot change a claim without invalidating the timing-safe signature comparison.

These tokens are intentionally short-lived. The host app should mint a new one as part of its authenticated page/API response rather than persist one as a long-lived credential.

### Widget identity

The identified browser SDK sends the user token and publishable key to the campaign identity route. Our Impact verifies:

- token signature and expiry;
- project and company;
- campaign workspace;
- parent origin against allowed origins.

The server returns a shorter-lived widget identity stored in:

- `__Host-our-impact-widget` in production;
- `our-impact-widget` locally.

The token additionally binds campaign ID and parent origin. Donation creation reads this cookie and attaches the developer project/supporter IDs to the donation session.

```mermaid
sequenceDiagram
  participant User as Signed-in host user
  participant Host as Host server
  participant Node as @our-impact/node
  participant Browser as @our-impact/browser
  participant API as Our Impact
  participant Widget as Hosted widget

  User->>Host: Authenticated request
  Host->>Node: createIdentityToken(external user ID)
  Node->>API: Secret-key request
  API-->>Node: Short-lived user token
  Host-->>Browser: Token + publishable key
  Browser->>Widget: Mount campaign iframe
  Browser->>Widget: Send identity context
  Widget->>API: Token + key + parent origin + campaign
  API-->>Widget: Campaign-bound identity cookie
  Widget-->>Browser: Ready / auto-resize
```

## Browser SDK

Package:

```bash
pnpm add @our-impact/browser
```

### Public campaign only

No developer project or key is required:

```ts
import { mountCampaign } from "@our-impact/browser";

const widget = mountCampaign({
  target: "#community-campaign",
  publicId: "campaign-public-id",
  height: "auto",
});

// Framework cleanup:
widget.destroy();
```

The SDK creates the iframe, checks message origin/source, coordinates automatic height, and destroys listeners during cleanup. A numeric height intentionally creates a fixed, internally scrollable frame; `"auto"` avoids nested scroll.

### Identified client

```ts
import { OurImpact } from "@our-impact/browser";

const impact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken,
});

const widget = impact.widgets.mountCampaign({
  target: "#community-campaign",
  publicId: "campaign-public-id",
  height: "auto",
  onDonationCompleted() {
    // The SDK has refreshed its entitlement cache.
  },
});

if (await impact.user.is("community_champion")) {
  enableChampionExperience();
}
```

The user API includes:

- `user.is(key)`;
- `user.get(key)`;
- `user.all()`;
- `user.profile()`;
- `refresh()` to invalidate/reload cached state;
- `setIdentity(nextToken)` when the host user changes.

Browser checks are appropriate for personalization, themes, badges, and progressive UI. Recheck with the server SDK before granting sensitive data, credits, or privileged server actions.

## Server SDK

Package:

```bash
pnpm add @our-impact/node
```

The APIMatic-generated `OurImpactClient` exposes three server resource operations:

### Issue identity

```ts
await impact.identity.createIdentityToken({
  body: {
    externalUserId: "user_123",
    displayName: "Avery",
    ttlSeconds: 900,
  },
});
```

### Send a verified event

```ts
await impact.events.createVerifiedEvent({
  body: {
    id: "order_741_payment_completed",
    type: "donation.completed",
    externalUserId: "user_123",
    occurredAt: new Date().toISOString(),
    properties: {
      amountMinor: 5000,
      currency: "USD",
      source: "host_checkout",
    },
  },
});
```

`id` is an idempotency identity chosen by the host. Replaying the same ID in the same project returns the existing event with `replayed: true`.

### Authoritative entitlement query

```ts
const result = await impact.entitlements.listUserEntitlements({
  externalUserId: "user_123",
});

const allowed = result.entitlements.some(
  (item) =>
    item.entitlementKey === "community_champion" &&
    item.state === "active",
);
```

## Events

### Sources

`developer_events.source` distinguishes:

- `api`: host server submitted;
- `paypal`: verified direct donation capture;
- `demo`: sandbox test console.

### Contract

Every event has:

- project/company/supporter scope;
- host-provided unique external event ID;
- validated event type (`lowercase.dotted_name` style);
- occurrence time;
- JSON properties;
- immutable storage after insert.

The primary built-in event type is `donation.completed`. Custom event type strings can be ingested, but an entitlement changes only if an active rule listens to that exact type.

### PayPal event properties

Identified direct donations include:

- amount and `amount_minor`;
- currency;
- campaign internal/public ID and title;
- recipient ID and name;
- donation public reference;
- PayPal capture ID;
- `source: widget`.

The capture ID produces a deterministic external event ID, which makes synchronous capture and webhook confirmation converge on one developer event.

## Entitlement model

### Definition vs earning path

- `entitlement_definitions` owns the stable key, display name, description, illustration, and state.
- `entitlement_rules` owns one earning path for that definition.
- Multiple active rules for one definition are **OR** paths: qualifying for any path activates the entitlement.

Stable key example:

```text
michaels_best_friend
```

Host code should depend on the key, not the display name or current threshold.

### Supported metrics

| Metric | Meaning |
| --- | --- |
| `event_count` | Count matching events in the evaluation window. |
| `single_amount` | Largest one-event `amount_minor` for the configured currency. |
| `cumulative_amount` | Sum matching `amount_minor` values for the configured currency. |

### Supported windows

| Window | Behavior |
| --- | --- |
| `single_event` | Evaluate the triggering event only. |
| `calendar_month` | UTC calendar month; active entitlement receives the next month boundary as `valid_until`. |
| `lifetime` | All matching project events for the supporter. |

The original rules supported lifetime and calendar month; the Entitlement Studio migration adds single-event amount semantics and multiple earning paths.

### Evaluation

An `AFTER INSERT` trigger on `developer_events`:

1. selects active definitions with matching active rules;
2. computes each rule's progress from immutable event history;
3. chooses a qualifying path, or the best-progress path for display;
4. upserts `user_entitlements`;
5. appends `user_entitlement_events` only when state changes;
6. triggers outbound webhook queueing.

The current state includes:

- `active` / `inactive`;
- qualifying count;
- progress value/unit;
- qualification and revocation timestamps;
- optional validity boundary.

### AI assistant

The assistant can:

- describe the existing catalog;
- identify a referenced entitlement;
- ask a clarifying question;
- propose creating/reusing a definition and one deterministic rule.

It cannot:

- grant a user;
- change payment records;
- bypass validation;
- apply a proposal without the owner's review action.

Assistant runs and proposals are persisted separately for auditability.

## Outbound developer webhooks

### Queue creation

Database triggers enqueue one delivery per active subscribed endpoint for:

- the original developer event, such as `donation.completed`;
- entitlement state changes, such as `entitlement.granted` or `entitlement.revoked`.

Unique indexes prevent the same endpoint/source event pair from being queued twice.

### Delivery

Delivery is attempted:

- immediately after API event ingestion or PayPal donation event creation;
- every five minutes through the Render cron recovery route.

Endpoints must:

- use HTTPS;
- have no embedded username/password;
- not be localhost, `.local`, loopback, link-local, or common private IPv4 ranges;
- be active.

The request has an eight-second timeout and includes:

```http
Content-Type: application/json
User-Agent: OurImpact-Webhooks/0.1
Our-Impact-Event: entitlement.granted
Our-Impact-Delivery: DELIVERY_UUID
Our-Impact-Signature: t=UNIX_SECONDS,v1=HEX_HMAC
```

### Signature verification

Each endpoint has a derived `whsec_...` secret. Verify:

```text
expected = HMAC_SHA256(webhook_secret, timestamp + "." + raw_request_body)
```

Compare the received `v1` value with a timing-safe comparison. Reject timestamps outside a small tolerance and store delivery IDs so a valid replay does not apply twice.

Do not parse and re-stringify the body before signature calculation.

### Retry model

Deliveries are claimed under a database lease. Failed attempts use exponential minute delays capped at 60 minutes. After six claimed attempts, the delivery is terminal `failed`. Successful 2xx responses become `delivered`.

The dashboard history is the operational source for response status and bounded error code.

## OpenAPI and APIMatic

### Sources

- Runtime document generator: `src/lib/developer/openapi.ts`.
- Full portal snapshot: `apimatic/src/spec/openapi.json`.
- Server-only SDK snapshot: `apimatic/server/src/spec/openapi.json`.
- Portal guides/configuration: `apimatic/src/content` and `apimatic/src/apimatic.json`.
- Generated Node package: `packages/node`.

`scripts/export-openapi.mjs` creates both snapshots from the TypeScript generator and fixes the server URL to the deployed Our Impact host.

The server-only snapshot excludes browser-specific operations so generated server consumers cannot mistake a publishable-key operation for a secret-key workflow.

### APIMatic lifecycle

```mermaid
flowchart LR
  Routes["Runtime routes"] --> Generator["openapi.ts"]
  Generator --> Export["pnpm openapi:export"]
  Export --> Full["Full portal OpenAPI"]
  Export --> Server["Server SDK OpenAPI"]
  Server --> Validate["APIMatic validate"]
  Server --> Generate["APIMatic TypeScript generation"]
  Generate --> NodePkg["@our-impact/node"]
  NodePkg --> Smoke["pnpm sdk:check"]
  Smoke --> Publish["APIMatic publishing profile → npm"]
  Full --> Portal["APIMatic portal preview/generate"]
```

APIMatic is a build and publication tool, not a runtime dependency. The Next.js routes and TypeScript OpenAPI generator are the behavioral source of truth.

The browser package is published directly to npm because APIMatic cannot generate:

- iframe creation and lifecycle;
- postMessage origin/source validation;
- dynamic resizing;
- campaign widget callbacks;
- browser entitlement cache and identity switching.

See [publishing.md](publishing.md) for exact commands.

## Local package verification

```bash
pnpm openapi:export
pnpm sdk:build
pnpm sdk:smoke
```

The smoke script starts an in-process mock HTTP server and verifies:

- Node secret authorization;
- event ingestion;
- identity issuance;
- server entitlement query;
- browser publishable key + identity token;
- browser `user.is()` behavior.

It does not call a deployed Our Impact environment or PayPal.

## Security checklist for integrations

- [ ] Secret key exists only in trusted server configuration.
- [ ] External user ID comes from the host's authenticated session, never an arbitrary browser body.
- [ ] Identity token is returned only to that same user.
- [ ] Browser origin is listed exactly, including scheme and port.
- [ ] Sensitive authorization is rechecked server-side.
- [ ] Every event has a stable, unique idempotency ID.
- [ ] Money properties include integer `amountMinor` and uppercase currency.
- [ ] Webhook signatures use the raw body and a timing-safe comparison.
- [ ] Webhook delivery IDs are deduplicated by the receiver.
- [ ] Keys are rotated after exposure and old keys are revoked.
- [ ] Production behavior is not built on `_test_` credentials without a deliberate environment design.
