import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OurImpactDeveloperApiClient } from "../sdk/typescript/dist/esm/index.js";

const requests = [];
const supporter = {
  external_user_id: "mikes_vegan_shop:jamie",
  display_name: "Jamie",
};
const entitlements = [
  {
    entitlement_key: "community_champion_theme",
    state: "active",
    qualifying_count: 1,
    progress_value: 1,
    progress_unit: "events",
    qualified_at: "2026-11-06T12:00:01Z",
    valid_until: null,
    updated_at: "2026-11-06T12:00:01Z",
  },
];

const server = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  requests.push({
    method: request.method,
    url: request.url,
    authorization: request.headers.authorization,
    publishableKey: request.headers["x-our-impact-key"],
    idempotencyKey: request.headers["idempotency-key"],
    body: rawBody ? JSON.parse(rawBody) : undefined,
  });

  response.setHeader("content-type", "application/json");
  if (request.url === "/api/v1/events") {
    response.statusCode = 201;
    response.end(JSON.stringify({
      id: "d85b1407-351d-4694-9ac2-9c88b415c8c6",
      replayed: false,
      entitlements,
    }));
    return;
  }
  if (request.url === "/api/v1/identity-tokens") {
    response.end(JSON.stringify({
      token: "identity-token",
      expires_at: "2026-11-06T12:15:00Z",
      user: supporter,
    }));
    return;
  }
  response.end(JSON.stringify({ user: supporter, entitlements }));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");

try {
  const client = new OurImpactDeveloperApiClient({
    secretApiKey: "oi_sk_test_local",
    identityBearer: "identity-token",
    publishableKey: "oi_pk_test_local",
    serverOptions: { baseUrl: `http://127.0.0.1:${address.port}` },
  });

  const event = await client.events.createVerifiedEvent({
    body: {
      id: "donation_01JABC123",
      type: "donation.completed",
      externalUserId: "mikes_vegan_shop:jamie",
      displayName: "Jamie",
      properties: { amount_minor: 5000, currency: "USD" },
    },
  });
  assert.equal(event.entitlements[0]?.entitlementKey, "community_champion_theme");

  const identity = await client.identity.createIdentityToken({
    body: { externalUserId: "mikes_vegan_shop:jamie", displayName: "Jamie" },
  });
  assert.equal(identity.user.externalUserId, "mikes_vegan_shop:jamie");

  await client.entitlements.listUserEntitlements({
    externalUserId: "mikes_vegan_shop:jamie",
  });
  await client.entitlements.listCurrentUserEntitlements();

  assert.equal(requests.length, 4);
  assert.equal(requests[0].authorization, "Bearer oi_sk_test_local");
  assert.equal(requests[0].body.external_user_id, "mikes_vegan_shop:jamie");
  assert.ok(requests[0].idempotencyKey);
  assert.equal(requests[1].authorization, "Bearer oi_sk_test_local");
  assert.equal(requests[2].authorization, "Bearer oi_sk_test_local");
  assert.equal(requests[3].authorization, "Bearer identity-token");
  assert.equal(requests[3].publishableKey, "oi_pk_test_local");

  console.log("Generated SDK request and response contract passed.");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
