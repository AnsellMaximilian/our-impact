# Our Impact

Stage 0 foundation for a transparent, community-directed company giving product. The working name in the original PRD was ImpactLoop; the product and UI now use **Our Impact**.

## What is implemented

- Next.js 16 App Router application with a small design system, responsive landing page, dashboard, and public campaign mock.
- Supabase email/password authentication with SSR cookies and route protection.
- Tenant-aware company membership and campaign data with row-level security on every public table.
- Owner onboarding and atomic creation of private draft campaigns with a 2–5 organization slate.
- Anonymous read access only to published campaigns and their related public data.
- Five clearly fictional organizations and one published fictional demo campaign.
- Original Our Impact mark and the Luma firefly mascot under `public/brand`.

Stage 0 intentionally does **not** implement real votes, allocation execution, PayPal, payouts, or AI copy generation.

## Local setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` and fill in the public Supabase values.
3. In Supabase Auth → URL Configuration, set the local Site URL to `http://localhost:3000` and allow `http://localhost:3000/auth/callback` as a redirect URL.
4. Run `pnpm dev`, then open [http://localhost:3000](http://localhost:3000).
5. Sign up, confirm the email if confirmation is enabled, create a workspace, and save the first draft campaign.

The seeded public mock is at [http://localhost:3000/embed/demo-coffee-community](http://localhost:3000/embed/demo-coffee-community).

## Environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

No `service_role` key belongs in this app. The browser and server clients rely on the same publishable key plus Supabase Auth and RLS.

For a deployed staging site, set `NEXT_PUBLIC_SITE_URL` to its exact `https://` origin, add `<origin>/auth/callback` to Supabase Auth’s allowed redirects, and set the same three values in the host’s environment configuration.

## Database workflow

The current migrations live in `supabase/migrations`. Link the CLI to the intended project once, then apply them:

```bash
pnpm supabase link --project-ref your-project-ref
pnpm supabase db push
```

Create a new migration for every future schema or policy change; do not edit a migration that has already been applied.

## Quality checks

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Stage 0 exit gate

- A signed-in owner or admin can create a draft campaign that is stored in Supabase.
- A separate anonymous route can read the published fictional campaign.
- Anonymous users cannot read private drafts or mutate campaign data.

The PRD is treated as a living source. Later stages—especially the PayPal flow—should be validated against current provider capabilities before implementation.
