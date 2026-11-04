# Our Impact

Our Impact is a transparent, community-directed company giving product. The original PRD used the working name ImpactLoop; the product and UI now use **Our Impact**.

## Current product track

- Supabase email/password authentication with SSR cookies and tenant-isolated row-level security.
- Owner onboarding plus campaign create, edit, publish, pause/resume, and private-draft deletion.
- A public responsive voting widget with 2–5 organizations, one vote per privacy-minimized browser identity and campaign period, and basic IP-derived rate limiting.
- Daily or weekly periods in a campaign time zone.
- Live aggregate vote counts and admin analytics.
- Deterministic integer-money previews for winner-takes-all, proportional, and hybrid allocation models.
- A standalone fictional partner page under `demo-site` that embeds the production widget.
- Original Our Impact mark and Luma firefly mascot under `public/brand`.
- Timezone-aware local close times (and weekly close days) frozen into each period.
- A replay-safe Supabase Cron scan that closes due periods every five minutes.
- A daily Vercel Cron close scan retained as a harmless fallback.
- Immutable allocation snapshots and line items with exact minor-unit rounding.
- Zero-vote manual review through a new equal-split or canceled revision.
- Simulated donation status records, append-only status history, and admin audit events.
- Public and admin ledgers that keep committed, allocated, and company-reported paid amounts distinct.
- A manual **close voting & freeze allocation now** control for end-to-end testing without triggering a donation.
- A legacy PayPal Payouts sandbox experiment retained only for historical test evidence.
- Idempotent payout reservations with masked sandbox recipient references.
- PayPal webhook signature verification before any webhook-driven payment-state mutation.
- Duplicate delivery handling and conservative out-of-order event reconciliation.
- Five-minute, status-only PayPal reconciliation for missed or delayed webhooks.
- Leased reconciliation claims, retry backoff, and automatic polling stops for terminal payments.
- Separate sandbox, simulation, and live totals in admin and public ledgers.
- No live PayPal host, credentials, or transfer path in the Stage 3 code.
- Source-grounded AI impact-report drafts generated from frozen ledger evidence.
- Strict structured output plus a server-side citation allowlist.
- Human approval recorded separately from generation, with no automatic publishing.
- Privacy-minimized model context that excludes recipient details, evidence notes, and provider identifiers.
- PayPal Sandbox partner referrals for recipient consent without collecting recipient API keys.
- A curated recipient network that enables checkout only after direct PayPal merchant verification.
- Multiparty Orders create/capture calls that identify the consented recipient merchant.
- An explicit program-owner checkout that turns one approved campaign allocation into recipient-specific PayPal purchase units.
- Direct supporter checkout pages kept separate from the company-funded Payouts ledger.
- Verified capture/refund/reversal webhooks with replay-safe event storage.
- Privacy-preserving campaign supporter roles: `supporter` after one completed contribution and `tier_3` after three in the campaign month.
- Workspace-owned fictional recipient directories, developer projects, hashed server API keys, and short-lived signed user identity tokens.
- Replay-safe developer events, deterministic cross-browser entitlements, signed outbound webhooks, and a Local Shop integration demo.
- Email-verified recipient claims and a recipient-owned portal that keeps PayPal onboarding outside the program owner’s dashboard.
- A campaign operations timeline that makes voting, frozen allocation, approval, and payment evidence distinct.
- A versioned OpenAPI 3.0 developer contract at `/api/openapi` plus a public integration quickstart at `/developers/docs`.

The current milestone still does not move live money automatically. PayPal actions use developer sandbox accounts only, the program owner explicitly approves each campaign payment, and a sandbox success is test evidence rather than proof of a live charitable-transfer model.

The durable role, consent, money-movement, and provider boundaries are documented in [docs/product-boundaries.md](docs/product-boundaries.md).

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill the Supabase, scheduler, and PayPal Sandbox values.
3. In Supabase Auth → URL Configuration, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.
4. Run `pnpm dev`, then open [http://localhost:3000](http://localhost:3000).
5. Sign up, create a workspace, and open or publish a campaign.

The seeded public campaign is at [http://localhost:3000/embed/demo-coffee-community](http://localhost:3000/embed/demo-coffee-community).

## Environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_...
VOTE_HASH_SECRET=generate-a-random-secret-with-at-least-32-characters
CRON_SECRET=generate-a-separate-random-32-byte-secret
DEVELOPER_SIGNING_SECRET=generate-another-random-secret-with-at-least-32-characters
PAYPAL_SANDBOX_CLIENT_ID=your-paypal-sandbox-rest-app-client-id
PAYPAL_SANDBOX_CLIENT_SECRET=your-paypal-sandbox-rest-app-secret
PAYPAL_SANDBOX_WEBHOOK_ID=your-paypal-sandbox-webhook-id
PAYPAL_SANDBOX_PARTNER_MERCHANT_ID=your-platform-sandbox-merchant-id
PAYPAL_PARTNER_ATTRIBUTION_ID=your-paypal-build-notation-code
OPENROUTER_API_KEY=sk-or-v1-your-server-only-key
OPENROUTER_MODEL=your-structured-output-model-slug
```

`SUPABASE_SECRET_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix. It lets protected server routes call tightly scoped database functions; browsers cannot call those functions directly. `VOTE_HASH_SECRET` is also server-only and creates non-reversible voter and rate-limit hashes. `CRON_SECRET` authenticates both Vercel and Render scheduler requests. `DEVELOPER_SIGNING_SECRET` signs short-lived user identity tokens and derives per-endpoint webhook secrets; use a separate random value and never expose it to a browser.

All five PayPal values are server-only and must never use a `NEXT_PUBLIC_` prefix. The client ID is passed to PayPal's browser SDK by a server-rendered checkout page, but it is still kept under the same server configuration; the client secret never leaves the server. `PAYPAL_SANDBOX_PARTNER_MERCHANT_ID` is the merchant ID for the sandbox business account acting as the platform. `PAYPAL_PARTNER_ATTRIBUTION_ID` is PayPal's build-notation (BN) code for the partner integration.

Create a PayPal developer **Sandbox** REST app, then create a webhook for `https://our-impact.vercel.app/api/webhooks/paypal`. Keep the existing Payouts batch/item events and add:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `MERCHANT.ONBOARDING.COMPLETED`
- `MERCHANT.PARTNER-CONSENT.REVOKED`

Partner Referrals and multiparty Checkout can be exercised with sandbox seller and buyer accounts. Live platform use still requires PayPal partner approval, recipient consent, and any permissions PayPal requires for the chosen merchant category. A connected recipient supplies no API key to Our Impact: PayPal returns a merchant ID after consent, and the server verifies that merchant directly before enabling checkout.

The two OpenRouter values are also server-only. Create a restricted OpenRouter API key and choose a model slug whose endpoint supports structured outputs. The request requires that capability, so unsupported provider routes are rejected instead of returning loosely formatted text. Keep both values out of Render: AI generation runs in the authenticated Vercel application, while Render only invokes payment reconciliation.

For Vercel, add all thirteen variables to Production (and Preview if you use preview deployments), set `NEXT_PUBLIC_SITE_URL=https://our-impact.vercel.app`, then redeploy. Add `https://our-impact.vercel.app/auth/callback` to Supabase Auth’s allowed redirects.

## PayPal recipient and checkout test

1. In PayPal Developer, create two sandbox business accounts: one represents the Our Impact platform and one represents a recipient. Create a sandbox personal account for the supporter checkout.
2. Put the platform REST app credentials, platform merchant ID, BN code, and webhook ID in Vercel, then redeploy.
3. As Mike, open **Recipients**, create a private invitation using an email address you can access, and copy the secure recipient link.
4. Open that link as the recipient representative. Request the one-time email link, return through it, and confirm **I represent this recipient**. The organization now appears in the separate recipient portal.
5. From the recipient portal, choose **Connect PayPal Sandbox**, sign in with the recipient sandbox business account, and grant consent. Mike can see that PayPal is ready but cannot access the recipient account.
6. Open the public campaign. The connected organization now has **Test a direct PayPal contribution** beneath its vote button.
7. Enter at least $1, open the PayPal button, and sign in with the sandbox personal buyer. Approve the order.
8. The checkout confirms the capture and unlocks the `supporter` badge. Complete three sandbox contributions in the same browser and campaign month to unlock `tier_3`.

The current browser identity is deliberately a sandbox baseline. A production developer package should replace it with an application-signed external user ID so `OurImpact.user.is("tier_3")` can be queried reliably across browsers and devices without Our Impact taking over the host application's authentication.

## Program-owner campaign funding test

1. Finish the recipient test above for every organization in the campaign.
2. End a voting round, review its calculated amounts, and approve each recipient allocation.
3. Open the campaign’s **Fund the community’s choices** section.
4. Choose PayPal and sign in as Mike’s sandbox buyer account. Mike is the payer; he does not onboard as a recipient merchant.
5. Approve the combined total. PayPal creates a separate purchase unit for each recipient and returns a result for each one.
6. Confirm that the section shows **This round is funded** and the payment history shows each recipient as PayPal confirmed.

## Developer API and APIMatic evaluation

The authenticated developer dashboard creates a sandbox publishable key, a one-time server secret, webhook endpoints, entitlement rules, and test supporter events. The Mike’s Vegan Shop demo exercises the same identity-token and entitlement contract used by an external integration.

Open `https://our-impact.vercel.app/developers/docs` for the integration flow. The machine-readable OpenAPI 3.0 document lives at `https://our-impact.vercel.app/api/openapi`; that URL can be imported into APIMatic to evaluate generated SDKs and hosted documentation. The OpenAPI contract remains the source of truth so adopting or replacing a generator does not change the product API.

The Stage 3.5 database migration schedules `close_due_campaign_periods(100)` in Supabase Cron every five minutes. The database—not the cron expression—decides which periods are due in their configured IANA time zones, and replaying the scan cannot duplicate an allocation. The root `vercel.json` keeps its once-daily 13:00 UTC (20:00 Jakarta) call as a fallback; it may find no work and is safe to replay.

## Render reconciliation cron

The root `render.yaml` defines a small Render Cron Job that calls `/api/cron/reconcile-paypal` every five minutes. It only reads the latest status of already-submitted PayPal Sandbox batches. It never creates or retries a payout.

Create a Render Blueprint from this repository, then provide the prompted `CRON_SECRET`. It must exactly match the value in Vercel. `RECONCILIATION_URL` already points to the production deployment and can be changed for another environment. Render needs no Supabase or PayPal credentials because those remain in Vercel.

Pending batches are checked every five minutes. Held batches back off to 30 minutes, unclaimed batches to six hours, and transient request errors progressively back off. Verified webhooks remain the primary status path; polling is the recovery path.

## Separate embed demo

Create a second Vercel project from this repository with:

- Root Directory: `demo-site`
- Framework Preset: `Other`
- Build Command: leave empty
- Output Directory: leave empty
- Environment variables: none

## Database workflow

Migrations live in `supabase/migrations`. Link the CLI to the intended project once, then apply future migrations with `pnpm supabase db push`. Create a new migration for every schema or policy change; never edit one that has already been applied.

## Quality checks

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Stage 4a exit gate

- A company admin can create, edit, publish, pause, resume, and delete eligible campaigns.
- A visitor can vote from the direct widget or a separate embedded site, subject to one-vote-per-period and rate-limit rules.
- All three allocation models conserve the committed budget in deterministic tests.
- Tenant-isolation checks confirm one workspace cannot read or mutate another workspace’s private campaigns.
- A scheduled scan can be replayed without duplicate snapshots or donation records.
- A frozen allocation always sums exactly to the period commitment in minor currency units.
- Zero-vote decisions and donation-status corrections create append-only audit history.
- Public copy keeps pledges, allocations, and company-reported payment evidence distinct.
- PayPal client credentials and webhook IDs remain server-only.
- A sandbox payout can be submitted only after explicit admin approval.
- Only a verified PayPal webhook or the authenticated status-only reconciler can advance a sandbox record to a completed test state.
- Duplicate webhook event IDs do not apply state twice, and stale events do not downgrade completed state.
- A missed webhook can be recovered from PayPal batch details without creating a second payout.
- Overlapping reconciliation runs cannot claim the same transaction, and terminal statuses stop polling.
- Campaign periods close within approximately five minutes of their configured time.
- Sandbox evidence is never counted as live confirmed payment.
- There is no live PayPal endpoint or live-transfer switch in the application.
- AI receives only an allowlisted source catalog derived from a closed, frozen allocation.
- Every generated content block cites a source ID that the server verifies before saving.
- Invalid or uncited structured output is rejected and never stored.
- Draft approval requires an owner or admin and creates an audit event.
- Approval does not publish content, run a workflow, or move funds.

The PRD remains a living source; implementation details may evolve as real integrations are validated.
