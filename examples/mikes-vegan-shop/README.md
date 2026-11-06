# Mike’s Vegan Shop

A standalone host-application example using both Our Impact packages. It deliberately lives outside the Our Impact app so the integration boundary is real:

- `@our-impact/node` runs only in `server.mjs` and protects the secret key.
- `@our-impact/browser` receives a short-lived identity token and the safe publishable key.
- Mike owns his customer identity (`mikes-vegan-shop:jamie`) and asks Our Impact only for the resulting entitlements.

## Run it

1. Copy `.env.example` to `.env.local`.
2. Paste the secret and publishable keys from Mike’s developer project.
3. Add `http://localhost:4173` to that project’s allowed browser origins.
4. Run `npm install`, then `npm run dev`.

The user selector persists Mike’s customer id in local storage, which makes the same fake customer stable across reloads. It does not pretend to replace Mike’s real authentication system.
