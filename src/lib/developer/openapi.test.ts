import { describe, expect, it } from "vitest";
import { createDeveloperOpenApiDocument } from "./openapi";

describe("developer OpenAPI contract", () => {
  it("describes every public developer endpoint with explicit authentication", () => {
    const document = createDeveloperOpenApiDocument("https://our-impact.example/");
    expect(document.openapi).toBe("3.0.3");
    expect(document.servers[0].url).toBe("https://our-impact.example");
    expect(Object.keys(document.paths)).toEqual([
      "/api/v1/events",
      "/api/v1/identity-tokens",
      "/api/v1/users/{externalUserId}/entitlements",
      "/api/v1/me/entitlements",
    ]);
    expect(document.paths["/api/v1/events"].post.security).toEqual([{ SecretApiKey: [] }]);
    expect(document.paths["/api/v1/me/entitlements"].get.security).toEqual([
      { PublishableKey: [], IdentityBearer: [] },
    ]);
  });
});
