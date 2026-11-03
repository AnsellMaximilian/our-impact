export function createDeveloperOpenApiDocument(origin: string) {
  const serverOrigin = origin.replace(/\/$/, "");
  return {
    openapi: "3.0.3",
    info: {
      title: "Our Impact Developer API",
      version: "1.0.0-sandbox",
      description:
        "Send verified supporter events, issue short-lived browser identity tokens, and query deterministic entitlements. All operations are sandbox-only in this version.",
      contact: { name: "Our Impact" },
    },
    servers: [{ url: serverOrigin, description: "Current Our Impact deployment" }],
    tags: [
      { name: "Events", description: "Verified server-to-server supporter activity." },
      { name: "Identity", description: "Short-lived identity tokens issued by the host application server." },
      { name: "Entitlements", description: "Current deterministic product access for a supporter." },
    ],
    paths: {
      "/api/v1/events": {
        post: {
          operationId: "createVerifiedEvent",
          tags: ["Events"],
          summary: "Send a verified supporter event",
          description: "Idempotent by event id within a developer project. Replays return the original evaluation state.",
          security: [{ SecretApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/EventInput" } },
            },
          },
          responses: {
            "201": {
              description: "Event created and entitlements evaluated.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/EventResult" } } },
            },
            "200": {
              description: "Idempotent event replay.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/EventResult" } } },
            },
            "400": { $ref: "#/components/responses/InvalidRequest" },
            "401": { $ref: "#/components/responses/InvalidApiKey" },
          },
        },
      },
      "/api/v1/identity-tokens": {
        post: {
          operationId: "createIdentityToken",
          tags: ["Identity"],
          summary: "Create a short-lived supporter identity token",
          description: "Call from the host application server after it authenticates its own user. Never expose the secret API key in a browser.",
          security: [{ SecretApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/IdentityTokenInput" } },
            },
          },
          responses: {
            "200": {
              description: "Identity token issued.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/IdentityTokenResult" } } },
            },
            "400": { $ref: "#/components/responses/InvalidRequest" },
            "401": { $ref: "#/components/responses/InvalidApiKey" },
          },
        },
      },
      "/api/v1/users/{externalUserId}/entitlements": {
        get: {
          operationId: "listUserEntitlements",
          tags: ["Entitlements"],
          summary: "List a supporter’s entitlements from a server",
          security: [{ SecretApiKey: [] }],
          parameters: [
            {
              name: "externalUserId",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1, maxLength: 120 },
              description: "The stable user id from the host application.",
            },
          ],
          responses: {
            "200": {
              description: "Supporter and current entitlement state.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UserEntitlementsResult" } } },
            },
            "401": { $ref: "#/components/responses/InvalidApiKey" },
            "404": { $ref: "#/components/responses/UserNotFound" },
          },
        },
      },
      "/api/v1/me/entitlements": {
        get: {
          operationId: "listCurrentUserEntitlements",
          tags: ["Entitlements"],
          summary: "List entitlements for a browser identity token",
          description: "Requires both the project publishable key and a short-lived identity token issued by the host server.",
          security: [{ PublishableKey: [], IdentityBearer: [] }],
          responses: {
            "200": {
              description: "Current user and entitlement state.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UserEntitlementsResult" } } },
            },
            "401": { $ref: "#/components/responses/InvalidIdentity" },
            "403": { $ref: "#/components/responses/OriginNotAllowed" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        SecretApiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "oi_sk_test_*",
          description: "Sandbox project secret. Server-side only.",
        },
        IdentityBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "Our Impact identity token",
        },
        PublishableKey: {
          type: "apiKey",
          in: "header",
          name: "x-our-impact-key",
          description: "Sandbox publishable project key.",
        },
      },
      schemas: {
        EventInput: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "external_user_id"],
          properties: {
            id: { type: "string", minLength: 3, maxLength: 120, example: "donation_01JABC123" },
            type: { type: "string", pattern: "^[a-z][a-z0-9_.]{2,79}$", example: "donation.completed" },
            external_user_id: { type: "string", minLength: 1, maxLength: 120, example: "mikes_vegan_shop:jamie" },
            display_name: { type: "string", minLength: 1, maxLength: 120, example: "Jamie" },
            occurred_at: { type: "string", format: "date-time" },
            properties: {
              type: "object",
              additionalProperties: true,
              example: { amount_minor: 5000, currency: "USD", organization_id: 42 },
            },
          },
        },
        IdentityTokenInput: {
          type: "object",
          additionalProperties: false,
          required: ["external_user_id"],
          properties: {
            external_user_id: { type: "string", minLength: 1, maxLength: 120 },
            display_name: { type: "string", minLength: 1, maxLength: 120 },
            ttl_seconds: { type: "integer", minimum: 60, maximum: 3600, default: 900 },
          },
        },
        Entitlement: {
          type: "object",
          required: ["entitlement_key", "state", "qualifying_count", "progress_value", "progress_unit", "qualified_at", "valid_until", "updated_at"],
          properties: {
            entitlement_key: { type: "string", example: "community_champion_theme" },
            state: { type: "string", enum: ["active", "inactive"] },
            qualifying_count: { type: "integer", minimum: 0 },
            progress_value: { type: "integer", minimum: 0 },
            progress_unit: { type: "string", example: "events" },
            qualified_at: { type: "string", format: "date-time", nullable: true },
            valid_until: { type: "string", format: "date-time", nullable: true },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        EventResult: {
          type: "object",
          required: ["id", "replayed", "entitlements"],
          properties: {
            id: { type: "string", format: "uuid" },
            replayed: { type: "boolean" },
            entitlements: { type: "array", items: { $ref: "#/components/schemas/Entitlement" } },
          },
        },
        IdentityTokenResult: {
          type: "object",
          required: ["token", "expires_at", "user"],
          properties: {
            token: { type: "string" },
            expires_at: { type: "string", format: "date-time" },
            user: {
              type: "object",
              required: ["external_user_id"],
              properties: { external_user_id: { type: "string" } },
            },
          },
        },
        UserEntitlementsResult: {
          type: "object",
          required: ["user", "entitlements"],
          properties: {
            user: {
              type: "object",
              required: ["external_user_id"],
              properties: {
                external_user_id: { type: "string" },
                display_name: { type: "string", nullable: true },
              },
            },
            entitlements: { type: "array", items: { $ref: "#/components/schemas/Entitlement" } },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
      responses: {
        InvalidRequest: {
          description: "The request body did not pass validation.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        InvalidApiKey: {
          description: "The secret API key is missing, invalid, or revoked.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        InvalidIdentity: {
          description: "The identity token or publishable key is invalid.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        OriginNotAllowed: {
          description: "The browser origin is not allowed for this project.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
        UserNotFound: {
          description: "No supporter exists for the supplied external user id.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  } as const;
}
