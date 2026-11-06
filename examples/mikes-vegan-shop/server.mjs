import { createServer as createHttpServer } from "node:http";
import { OurImpactClient } from "@our-impact/node";
import { createServer as createViteServer } from "vite";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // A missing local env file is handled by the setup response below.
}

const port = Number(process.env.PORT ?? 4173);
const baseUrl = process.env.OUR_IMPACT_API_URL ?? "https://our-impact.vercel.app";
const secretApiKey = process.env.OUR_IMPACT_SECRET_KEY;
const publishableKey = process.env.OUR_IMPACT_PUBLISHABLE_KEY;
const users = new Map([
  ["mikes-vegan-shop:jamie", "Jamie"],
  ["mikes-vegan-shop:alex", "Alex"],
  ["mikes-vegan-shop:riley", "Riley"],
]);

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

    try {
      const body = await readJson(request);
      const externalUserId = typeof body.externalUserId === "string" ? body.externalUserId : "";
      const displayName = users.get(externalUserId);
      if (!displayName) return json(response, 400, { error: "unknown_demo_user" });

      const identity = await client.identity.createIdentityToken({
        body: { externalUserId, displayName, ttlSeconds: 900 },
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

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request body is too large.");
  }
  return JSON.parse(body || "{}");
}
