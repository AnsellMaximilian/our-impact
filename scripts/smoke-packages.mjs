import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OurImpact } from "../packages/browser/dist/index.js";
import { OurImpactClient } from "../packages/node/dist/esm/index.js";

const entitlement = {
  entitlement_key: "community_champion_theme",
  state: "active",
  qualifying_count: 1,
  progress_value: 1,
  progress_unit: "events",
  qualified_at: "2026-11-06T10:00:00.000Z",
  valid_until: null,
  updated_at: "2026-11-06T10:00:00.000Z",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const user = { external_user_id: "mikes-vegan-shop:jamie", display_name: "Jamie" };

  if (url.pathname === "/api/v1/me/entitlements") {
    assert.equal(request.headers.authorization, "Bearer identity-smoke-token");
    assert.equal(request.headers["x-our-impact-key"], "oi_pk_test_smoke");
    return json(response, 200, { user, entitlements: [entitlement] });
  }

  assert.equal(request.headers.authorization, "Bearer oi_sk_test_smoke");

  if (url.pathname === "/api/v1/events") {
    const body = await readJson(request);
    assert.equal(body.external_user_id, "mikes-vegan-shop:jamie");
    return json(response, 201, {
      id: "d85b1407-351d-4694-9ac2-9c88b415c8c6",
      replayed: false,
      entitlements: [entitlement],
    });
  }

  if (url.pathname === "/api/v1/identity-tokens") {
    return json(response, 200, {
      token: "identity-smoke-token",
      expires_at: "2026-11-06T10:15:00.000Z",
      user,
    });
  }

  if (url.pathname === "/api/v1/users/mikes-vegan-shop%3Ajamie/entitlements") {
    return json(response, 200, { user, entitlements: [entitlement] });
  }

  return json(response, 404, { error: "not_found" });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Mock API did not start.");
const baseUrl = `http://127.0.0.1:${address.port}`;

try {
  const node = new OurImpactClient({
    secretApiKey: "oi_sk_test_smoke",
    serverOptions: { baseUrl },
  });
  const event = await node.events.createVerifiedEvent({
    body: {
      id: "donation_smoke_1",
      type: "donation.completed",
      externalUserId: "mikes-vegan-shop:jamie",
      displayName: "Jamie",
      properties: { amountMinor: 5000, currency: "USD" },
    },
  });
  assert.equal(event.entitlements[0].entitlementKey, "community_champion_theme");

  const identity = await node.identity.createIdentityToken({
    body: { externalUserId: "mikes-vegan-shop:jamie", displayName: "Jamie" },
  });
  assert.equal(identity.token, "identity-smoke-token");

  const browser = new OurImpact({
    publishableKey: "oi_pk_test_smoke",
    userToken: identity.token,
    baseUrl,
    now: () => new Date("2026-11-07T00:00:00.000Z"),
  });
  assert.equal(await browser.user.is("community_champion_theme"), true);
  assert.equal((await browser.user.profile()).externalUserId, "mikes-vegan-shop:jamie");

  console.log("Node and browser SDK smoke test passed.");
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || "{}");
}
