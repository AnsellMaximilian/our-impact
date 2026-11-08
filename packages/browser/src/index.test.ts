import { describe, expect, it, vi } from "vitest";
import { mountCampaign, OurImpact, OurImpactError } from "./index";

const activeResponse = {
  user: { external_user_id: "mikes-vegan-shop:jamie", display_name: "Jamie" },
  entitlements: [
    {
      entitlement_key: "community_champion_theme",
      state: "active",
      qualifying_count: 1,
      progress_value: 1,
      progress_unit: "events",
      qualified_at: "2026-11-06T10:00:00.000Z",
      valid_until: "2026-12-01T00:00:00.000Z",
      updated_at: "2026-11-06T10:00:00.000Z",
    },
  ],
};

describe("@our-impact/browser", () => {
  it("mounts a public campaign without project credentials", () => {
    const postMessage = vi.fn();
    const remove = vi.fn();
    const iframe = {
      contentWindow: { postMessage },
      remove,
      style: {},
    } as unknown as HTMLIFrameElement;
    const target = {
      replaceChildren: vi.fn(),
    } as unknown as HTMLElement;

    vi.stubGlobal("document", {
      createElement: vi.fn(() => iframe),
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const widget = mountCampaign({
      target,
      publicId: "campaign-public-id",
      height: "auto",
    });

    expect(widget.element.src).toBe(
      "https://our-impact.vercel.app/embed/campaign-public-id",
    );
    expect(target.replaceChildren).toHaveBeenCalledWith(iframe);

    widget.destroy();
    expect(remove).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("allows anonymous campaign setup but protects user queries", async () => {
    const ourImpact = new OurImpact({
      publishableKey: "oi_pk_test_example",
    });

    await expect(ourImpact.user.all()).rejects.toThrow(
      "Our Impact userToken is required for user entitlement queries.",
    );
  });

  it("checks an entitlement and caches the supporter state", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(activeResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const ourImpact = new OurImpact({
      publishableKey: "oi_pk_test_example",
      userToken: "identity-token",
      fetch,
      now: () => new Date("2026-11-07T00:00:00.000Z"),
    });

    await expect(ourImpact.user.is("community_champion_theme")).resolves.toBe(true);
    await expect(ourImpact.user.profile()).resolves.toEqual({
      externalUserId: "mikes-vegan-shop:jamie",
      displayName: "Jamie",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("treats an expired active entitlement as inactive", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(activeResponse), { status: 200 }),
    );
    const ourImpact = new OurImpact({
      publishableKey: "oi_pk_test_example",
      userToken: "identity-token",
      fetch,
      now: () => new Date("2027-01-01T00:00:00.000Z"),
    });

    await expect(ourImpact.user.is("community_champion_theme")).resolves.toBe(false);
  });

  it("returns structured API errors and retries after a failure", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_identity_token" }), { status: 401 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(activeResponse), { status: 200 }));
    const ourImpact = new OurImpact({
      publishableKey: "oi_pk_test_example",
      userToken: "expired-token",
      fetch,
    });

    await expect(ourImpact.user.all()).rejects.toMatchObject<Partial<OurImpactError>>({
      status: 401,
      code: "invalid_identity_token",
    });
    await expect(ourImpact.user.all()).resolves.toHaveLength(1);
  });
});
