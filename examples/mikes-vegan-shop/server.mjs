import { createServer as createHttpServer } from "node:http";
import { OurImpactClient } from "@our-impact/node";
import { createServer as createViteServer } from "vite";
import { AuthError, createAuthStore } from "./server/auth.mjs";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // A missing local env file is handled by the setup response below.
}

const port = Number(process.env.PORT ?? 4173);
const baseUrl = process.env.OUR_IMPACT_API_URL ?? "https://our-impact.vercel.app";
const secretApiKey = process.env.OUR_IMPACT_SECRET_KEY;
const publishableKey = process.env.OUR_IMPACT_PUBLISHABLE_KEY;
const campaignPublicId = normalizeCampaignPublicId(process.env.OUR_IMPACT_CAMPAIGN_PUBLIC_ID);
const auth = createAuthStore({
  databasePath: process.env.MIKES_SHOP_DATABASE_PATH,
  secureCookies: process.env.NODE_ENV === "production",
});

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});

const client = secretApiKey
  ? new OurImpactClient({
      secretApiKey,
      serverOptions: { baseUrl },
    })
  : null;

const server = createHttpServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (url.pathname === "/api/shop/config" && request.method === "GET") {
    return json(response, 200, {
      campaignEmbedUrl: campaignPublicId
        ? new URL(`/embed/${encodeURIComponent(campaignPublicId)}`, baseUrl).toString()
        : null,
    });
  }

  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    return json(response, 200, { user: auth.getUser(request) });
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    return handleAuthentication(response, async () => auth.signUp(await readJson(request)));
  }

  if (url.pathname === "/api/auth/signin" && request.method === "POST") {
    return handleAuthentication(response, async () => auth.signIn(await readJson(request)));
  }

  if (url.pathname === "/api/auth/signout" && request.method === "POST") {
    return json(response, 200, { user: null }, { "set-cookie": auth.signOut(request) });
  }

  if (url.pathname === "/api/our-impact/config" && request.method === "GET") {
    if (!publishableKey) {
      return json(response, 503, { error: "missing_our_impact_configuration" });
    }
    return json(response, 200, { publishableKey, baseUrl });
  }

  if (url.pathname === "/api/our-impact/identity" && request.method === "POST") {
    if (!client) {
      return json(response, 503, { error: "missing_our_impact_configuration" });
    }

    const user = auth.getUser(request);
    if (!user) return json(response, 401, { error: "shop_authentication_required" });

    try {
      const identity = await client.identity.createIdentityToken({
        body: {
          externalUserId: user.externalUserId,
          displayName: user.displayName,
          ttlSeconds: 900,
        },
      });
      return json(response, 200, identity);
    } catch (error) {
      console.error("Could not create Our Impact identity", error);
      return json(response, 502, { error: "identity_token_failed" });
    }
  }

  vite.middlewares(request, response, () => {
    response.statusCode = 404;
    response.end("Not found");
  });
});

server.listen(port, () => {
  console.log(`Mike’s Vegan Shop is running at http://localhost:${port}`);
});

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

async function handleAuthentication(response, action) {
  try {
    const result = await action();
    return json(response, 200, { user: result.user }, { "set-cookie": result.cookie });
  } catch (error) {
    if (error instanceof AuthError) return json(response, error.status, { error: error.code });
    if (error instanceof SyntaxError) return json(response, 400, { error: "invalid_json" });
    console.error("Shop authentication failed", error);
    return json(response, 500, { error: "authentication_failed" });
  }
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request body is too large.");
  }
  return JSON.parse(body || "{}");
}

function normalizeCampaignPublicId(value) {
  if (!value) return null;
  const normalized = value.trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return normalized;
  console.warn("OUR_IMPACT_CAMPAIGN_PUBLIC_ID is not a valid public campaign ID.");
  return null;
}
