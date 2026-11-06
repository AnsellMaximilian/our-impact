# Mike’s Vegan Shop

A standalone host-application example using both Our Impact packages. It deliberately lives outside the Our Impact app so the integration boundary is real:

- Mike’s shop owns email/password accounts in a local SQLite database and issues HttpOnly sessions.
- The storefront and account states render from Handlebars templates under `src/templates/`; TypeScript handles behavior and data loading instead of containing the page markup.
- `@our-impact/node` runs only in `server.mjs` and protects the secret key.
- The server derives a stable `mikes-vegan-shop:<uuid>` customer ID from the authenticated shop session. It never trusts a user ID supplied by the browser.
- `@our-impact/browser` receives a short-lived identity token and the safe publishable key, never the customer’s password or Mike’s server secret.

## Run it

1. Copy `.env.example` to `.env.local`.
2. Open Mike’s developer project, then its **API & webhooks** tab.
3. Copy the full **Browser publishable key** into `OUR_IMPACT_PUBLISHABLE_KEY`.
4. If you no longer have a full server secret, choose **Replace and reveal server secret**. Copy the one-time value into `OUR_IMPACT_SECRET_KEY`; the fingerprint rows are not usable credentials.
5. Add `http://localhost:4173` under **Allowed browser origins** and save.
6. Copy a published campaign’s public ID into `OUR_IMPACT_CAMPAIGN_PUBLIC_ID`. This is the final path segment from its `/embed/...` URL.
7. Run `npm install`, then `npm run dev`.

`OUR_IMPACT_API_URL` should remain `https://our-impact.vercel.app` unless you are intentionally running the Our Impact API itself somewhere else.

## Test the complete identity flow

1. Create an account on Mike’s local site and copy the stable customer ID shown in the community profile.
2. In Our Impact, open Mike’s developer project and choose **Test console**.
3. Send a `donation.completed` event for that external user ID. Add an amount that satisfies one of Mike’s entitlement rules.
4. Return to the shop and select **Refresh perks**. The entitlement—and any theme it controls—should appear for that signed-in account.
5. Sign out and back in. The same customer ID and entitlements should return because Mike’s account and session state live in SQLite.

The voting section is a real hosted iframe rendered by `src/templates/page.hbs`. After signin, the host sends the short-lived customer identity token to the iframe with `postMessage`; signing out clears both the shop session and the iframe identity. This is the same boundary a separate merchant website would use.

Money in entitlement payloads uses minor units. For example, `progress_value: 5000` with `progress_unit: "usd"` is $50.00. The example formats that value for display while preserving the integer API representation.

The SQLite file defaults to `data/mikes-vegan-shop.sqlite` and is ignored by Git. Delete that file only when you intentionally want to reset all local shop accounts and sessions.

This is a realistic integration reference, not a production-ready identity service. A real shop should use its established authentication provider—or add email verification, password recovery, rate limiting, and account-management controls before shipping this auth implementation.
