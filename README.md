# Our Impact

Our Impact is a transparent, community-directed company giving product. The original PRD used the working name ImpactLoop; the product and UI now use **Our Impact**.

## Stage 2 transparent allocation ledger

- Supabase email/password authentication with SSR cookies and tenant-isolated row-level security.
- Owner onboarding plus campaign create, edit, publish, pause/resume, and private-draft deletion.
- A public responsive voting widget with 2–5 organizations, one vote per privacy-minimized browser identity and campaign period, and basic IP-derived rate limiting.
- Daily or weekly periods in a campaign time zone.
- Live aggregate vote counts and admin analytics.
- Deterministic integer-money previews for winner-takes-all, proportional, and hybrid allocation models.
- A standalone fictional partner page under `demo-site` that embeds the production widget.
- Original Our Impact mark and Luma firefly mascot under `public/brand`.
- Timezone-aware local close times (and weekly close days) frozen into each period.
- A replay-safe daily Vercel Cron scan that closes every due period.
- Immutable allocation snapshots and line items with exact minor-unit rounding.
- Zero-vote manual review through a new equal-split or canceled revision.
- Simulated donation status records, append-only status history, and admin audit events.
- Public and admin ledgers that keep committed, allocated, and company-reported paid amounts distinct.
- A manual **close voting & freeze allocation now** control for end-to-end testing without triggering a donation.

Stage 2 does not move money. Donation records remain simulations and the UI never describes an allocation as a completed donation. PayPal support will be researched against its current APIs before a later stage.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill all six values.
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
```

`SUPABASE_SECRET_KEY` is server-only and must never use a `NEXT_PUBLIC_` prefix. It lets the vote route and period-close scheduler call tightly scoped database functions; browsers cannot call those functions directly. `VOTE_HASH_SECRET` is also server-only and creates non-reversible voter and rate-limit hashes. `CRON_SECRET` authenticates Vercel Cron requests and must be a different random value.

For Vercel, add all six variables to Production (and Preview if you use preview deployments), set `NEXT_PUBLIC_SITE_URL=https://our-impact.vercel.app`, then redeploy. Add `https://our-impact.vercel.app/auth/callback` to Supabase Auth’s allowed redirects.

The root `vercel.json` invokes `/api/cron/close-periods` once daily at 00:00 UTC. The database—not the cron expression—decides which periods are due in their configured IANA time zones, and replaying the scan cannot duplicate an allocation. A daily scan is compatible with Vercel Hobby; the actual close may occur after the configured local minute because Hobby cron timing is coarse.

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

## Stage 2 exit gate

- A company admin can create, edit, publish, pause, resume, and delete eligible campaigns.
- A visitor can vote from the direct widget or a separate embedded site, subject to one-vote-per-period and rate-limit rules.
- All three allocation models conserve the committed budget in deterministic tests.
- Tenant-isolation checks confirm one workspace cannot read or mutate another workspace’s private campaigns.
- A scheduled scan can be replayed without duplicate snapshots or donation records.
- A frozen allocation always sums exactly to the period commitment in minor currency units.
- Zero-vote decisions and donation-status corrections create append-only audit history.
- Public copy keeps pledges, allocations, and company-reported payment evidence distinct.

The PRD remains a living source; implementation details may evolve as real integrations are validated.
