# Our Impact

Our Impact is a transparent, community-directed company giving product. The original PRD used the working name ImpactLoop; the product and UI now use **Our Impact**.

## Stage 4a grounded reporting track

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
- Server-only PayPal Sandbox OAuth and Payouts REST integration.
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

Stage 3.5 still does not move live money automatically. PayPal actions use developer sandbox accounts only, payout initiation remains an explicit admin action, and a sandbox success is displayed as test evidence rather than a real charitable transfer.

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
PAYPAL_SANDBOX_CLIENT_ID=your-paypal-sandbox-rest-app-client-id
PAYPAL_SANDBOX_CLIENT_SECRET=your-paypal-sandbox-rest-app-secret
PAYPAL_SANDBOX_WEBHOOK_ID=your-paypal-sandbox-webhook-id
OPENROUTER_API_KEY=sk-or-v1-your-server-only-key
OPENROUTER_MODEL=your-structured-output-model-slug
```

`SUPABASE_SECRET_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix. It lets protected server routes call tightly scoped database functions; browsers cannot call those functions directly. `VOTE_HASH_SECRET` is also server-only and creates non-reversible voter and rate-limit hashes. `CRON_SECRET` authenticates both Vercel and Render scheduler requests and must be a different random value.

The three PayPal values are server-only and must never use a `NEXT_PUBLIC_` prefix. Create a PayPal developer **Sandbox** REST app, then create a webhook for `https://our-impact.vercel.app/api/webhooks/paypal`. Subscribe it to Payouts batch and item events. The test recipient is a PayPal sandbox personal-account email entered at send time; it is not an environment variable, and Our Impact stores only a masked reference.

The two OpenRouter values are also server-only. Create a restricted OpenRouter API key and choose a model slug whose endpoint supports structured outputs. The request requires that capability, so unsupported provider routes are rejected instead of returning loosely formatted text. Keep both values out of Render: AI generation runs in the authenticated Vercel application, while Render only invokes payment reconciliation.

For Vercel, add all eleven variables to Production (and Preview if you use preview deployments), set `NEXT_PUBLIC_SITE_URL=https://our-impact.vercel.app`, then redeploy. Add `https://our-impact.vercel.app/auth/callback` to Supabase Auth’s allowed redirects.

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
