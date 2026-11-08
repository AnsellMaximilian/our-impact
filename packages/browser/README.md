# @our-impact/browser

Embed public community campaigns and use Our Impact entitlements in a host application’s browser.

```bash
npm install @our-impact/browser
```

## Embed a public campaign

A published campaign needs only its public ID. No developer project, API key, or customer identity is required:

```ts
import { mountCampaign } from "@our-impact/browser";

const campaign = mountCampaign({
  target: "#community-campaign",
  publicId: "your-campaign-id",
  height: "auto",
});

// During view cleanup:
campaign.destroy();
```

The default `height: "auto"` follows the hosted campaign content and removes nested scrolling. Pass a number to intentionally keep a fixed, scrollable viewport.

## Identify a customer and check entitlements

When you are ready to connect activity to your own signed-in users, your server creates a short-lived identity token with `@our-impact/node`. Initialize the browser SDK with that token and the project’s safe publishable key:

```ts
import { OurImpact } from "@our-impact/browser";

const ourImpact = new OurImpact({
  publishableKey: "oi_pk_test_...",
  userToken: identityTokenFromYourServer,
});

if (await ourImpact.user.is("community_champion_theme")) {
  document.documentElement.dataset.theme = "community-champion";
}
```

`user.is()`, `user.get()`, `user.all()`, and `user.profile()` share one cached request. Call `refresh()` after the supporter completes new activity, or `setIdentity()` when your signed-in user changes.

Never pass an `oi_sk_*` secret key to this package or any browser code.

The identified client can mount the same campaign. The widget shares the client’s identity and refreshes entitlements after a completed donation:

```ts
const campaign = ourImpact.widgets.mountCampaign({
  target: "#community-campaign",
  publicId: "your-campaign-id",
  height: "auto",
  onDonationCompleted() {
    // Entitlements have already been refreshed here.
  },
});

// When the host user changes:
ourImpact.setIdentity(nextIdentityToken);

// During view cleanup:
campaign.destroy();
```
