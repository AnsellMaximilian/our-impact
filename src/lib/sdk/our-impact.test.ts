import { afterEach, describe, expect, it, vi } from "vitest";
import { OurImpact } from "./our-impact";

describe("OurImpact browser SDK", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("checks active entitlements and caches the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      entitlements: [
        {
          entitlement_key: "tier_3",
          state: "active",
          qualifying_count: 3,
          qualified_at: "2026-11-01T00:00:00.000Z",
          valid_until: "2026-12-01T00:00:00.000Z",
          updated_at: "2026-11-01T00:00:00.000Z",
        },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const impact = new OurImpact({ publishableKey: "oi_pk_test_example", userToken: "signed-token" });
    await expect(impact.user.is("tier_3")).resolves.toBe(true);
    await expect(impact.user.is("supporter")).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/entitlements", {
      headers: {
        authorization: "Bearer signed-token",
        "x-our-impact-key": "oi_pk_test_example",
      },
    });
  });
});
