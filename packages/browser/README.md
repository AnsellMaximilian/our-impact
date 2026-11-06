# @our-impact/browser

Use Our Impact entitlements in a host application’s browser without exposing a secret API key.

```bash
npm install @our-impact/browser
```

Your server first creates a short-lived identity token with `@our-impact/node`. Then initialize the browser SDK with that token and the project’s safe publishable key:

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
