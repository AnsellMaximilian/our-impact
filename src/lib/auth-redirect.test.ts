import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "./auth-redirect";

describe("safeInternalRedirect", () => {
  it("keeps an internal recipient invitation path", () => {
    expect(safeInternalRedirect("/recipients/connect/invite-token")).toBe(
      "/recipients/connect/invite-token",
    );
  });

  it.each([
    "https://example.com/steal-session",
    "//example.com/steal-session",
    "/\\example.com/steal-session",
    "dashboard",
  ])("rejects unsafe destinations", (destination) => {
    expect(safeInternalRedirect(destination)).toBe("/dashboard");
  });
});

