# Mike’s Vegan Shop

A standalone host-application example using both Our Impact packages. It deliberately lives outside the Our Impact app so the integration boundary is real:

- `@our-impact/node` runs only in `server.mjs` and protects the secret key.
- `@our-impact/browser` receives a short-lived identity token and the safe publishable key.
- Mike owns his customer identity (`mikes-vegan-shop:jamie`) and asks Our Impact only for the resulting entitlements.

## Run it

1. Copy `.env.example` to `.env.local`.
2. Open Mike’s developer project, then its **API & webhooks** tab.
3. Copy the full **Browser publishable key** into `OUR_IMPACT_PUBLISHABLE_KEY`.
4. If you no longer have a full server secret, choose **Replace and reveal server secret**. Copy the one-time value into `OUR_IMPACT_SECRET_KEY`; the fingerprint rows are not usable credentials.
5. Add `http://localhost:4173` under **Allowed browser origins** and save.
6. Run `npm install`, then `npm run dev`.

`OUR_IMPACT_API_URL` should remain `https://our-impact.vercel.app` unless you are intentionally running the Our Impact API itself somewhere else.

The user selector persists Mike’s customer id in local storage, which makes the same fake customer stable across reloads. It does not pretend to replace Mike’s real authentication system.
