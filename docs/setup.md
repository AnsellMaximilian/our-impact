# Setup, credentials, and deployment

This guide takes a fresh clone to a working Our Impact environment. It separates the minimum application setup from PayPal, AI, schedulers, and SDK tooling so failures are easier to isolate.

## 1. Prerequisites

### Required

- Git.
- Node.js 24 or newer.
- Corepack and pnpm 11.25.0.
- A Supabase project **or** Docker Desktop for a local Supabase stack.

### Optional by feature

- PayPal Developer account for recipient onboarding and payments.
- OpenRouter account for campaign planning, entitlement assistance, and impact-report drafting.
- Vercel account for the web deployment.
- Render account for five-minute HTTP schedulers.
- APIMatic account and CLI for SDK generation and publication.

Check the local toolchain:

```bash
node --version
corepack --version
corepack enable
pnpm --version
```

The repository's `packageManager` field asks Corepack for pnpm 11.25.0.

## 2. Clone and install

```bash
git clone https://github.com/AnsellMaximilian/our-impact.git
cd our-impact
corepack enable
pnpm install
```

Do not copy another environment's `.env.local`. Start from `.env.example` and create new secrets.

## 3. Choose a Supabase workflow

### Option A: hosted Supabase project

This is recommended when you need email links, Vercel, PayPal callbacks, or another person to test the app.

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open the project's **Connect** dialog or **Settings → API Keys**.
3. Record:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_...`) → `SUPABASE_SECRET_KEY`
4. Link the repository:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref YOUR_PROJECT_REF
   ```

5. Review the target printed by the CLI. Then apply every migration:

   ```bash
   pnpm exec supabase db push
   ```

6. If prompted for the database password, use the password set when the Supabase project was created.

The repository pins Supabase CLI 2.122.0. Use `pnpm exec supabase` rather than a global CLI. Supabase CLI v3 changed to local-by-default targeting and asks before hosted changes; using the pinned binary keeps this repository's commands reproducible.

### Option B: fully local Supabase

This path needs Docker.

```bash
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase status
```

`supabase db reset` rebuilds the database from `supabase/migrations` and runs the explicit no-op `supabase/seed.sql`. Copy the local API URL, publishable/anon-compatible key, and secret/service-compatible key reported by `supabase status` into `.env.local`.

The local services use the ports in `supabase/config.toml`:

| Service | Default URL |
| --- | --- |
| API | `http://127.0.0.1:54321` |
| Database | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Local email inbox | `http://127.0.0.1:54324` |

Stop without deleting local volumes:

```bash
pnpm exec supabase stop
```

## 4. Configure Supabase Auth

### Local application against hosted Supabase

In **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000`
- Additional redirect URL: `http://localhost:3000/auth/callback`

### Deployed application

Add the canonical deployed values as well:

- Site URL: `https://YOUR_APP_HOST`
- Redirect URL: `https://YOUR_APP_HOST/auth/callback`

Preview deployments need explicit redirect URLs or a carefully reviewed wildcard pattern. Do not broaden redirect rules merely to make an authentication error disappear.

### Email behavior

Program-owner signup uses Supabase email/password authentication. Recipient claims use email OTP/magic links to the exact email on the private invitation.

- For local Supabase, open the local email inbox at port 54324.
- For hosted testing, use an email address you can actually open.
- For production-like delivery, configure custom SMTP in Supabase rather than relying on default test email limits.
- Use the newest email link. OTP/magic links expire and are single-use.

The recipient's **Our Impact email** and **PayPal Sandbox login** are separate:

- The Our Impact invitation must go to an inbox the tester controls.
- The PayPal Sandbox seller account uses the generated sandbox email and password shown in PayPal Developer.

## 5. Create `.env.local`

```bash
cp .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Generate three independent random values:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Run it three times and assign different outputs to `VOTE_HASH_SECRET`, `CRON_SECRET`, and `DEVELOPER_SIGNING_SECRET`.

### Core variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_...
VOTE_HASH_SECRET=independent-random-value-at-least-32-characters
CRON_SECRET=another-independent-random-value
DEVELOPER_SIGNING_SECRET=a-third-independent-random-value
```

### Why each core variable exists

| Variable | Exposure | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Safe to embed; identifies the Supabase project. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Safe only because database access is constrained by grants and RLS. It is not an administrator credential. |
| `NEXT_PUBLIC_SITE_URL` | Public | Must be an origin, with no trailing path. Used for auth and PayPal callback URLs, metadata, and generated links. |
| `SUPABASE_SECRET_KEY` | Server only | Bypasses user RLS for trusted routes. Never prefix with `NEXT_PUBLIC_`. |
| `VOTE_HASH_SECRET` | Server only | Prevents raw visitor identifiers from being stored as voting/rate-limit keys. Rotation changes the derived identity namespace. |
| `CRON_SECRET` | Server + scheduler | Must match in Vercel and Render. Protects all `/api/cron/*` endpoints. |
| `DEVELOPER_SIGNING_SECRET` | Server only | One root for recipient invitation signatures, identity/widget JWT-like tokens, and derived developer webhook secrets. Rotation invalidates outstanding signed artifacts. |

The application can now run without PayPal or OpenRouter. Those surfaces will report that they are not configured.

## 6. Run and verify the core application

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Core smoke test:

1. Sign up and sign in.
2. Create a workspace.
3. Create two recipient records.
4. Create a campaign with both recipients.
5. Publish it.
6. Open its public campaign/widget URL in a private window.
7. Cast a vote and verify the dashboard updates.
8. Use the manual close control in a test campaign if waiting for the configured close is inconvenient.

If a database function says permission denied or the UI references a missing relation, compare the linked project migration history with `supabase/migrations` and run `pnpm exec supabase db push` again.

## 7. Configure PayPal Sandbox

Read [paypal.md](paypal.md) for the complete request and state model. These are the setup steps only.

### Create sandbox accounts

In PayPal Developer:

1. Keep or create a **sandbox business account** for the Our Impact platform.
2. Create at least one different **sandbox business account** for a recipient.
3. Create a **sandbox personal account** for a payer/supporter.
4. Record the generated passwords from the sandbox account manager.

The platform, recipient, and payer should not be the same sandbox account.

### Create the REST app

1. Create a **Sandbox REST application** owned by the platform business account.
2. Copy the client ID and secret.
3. In the app's Multiparty/Platform features, enable the integration needed for third-party **Payment** and **Refund** permissions.
4. Copy the platform business account's merchant ID.
5. Copy the partner attribution / BN code exposed by the Multiparty configuration.

Populate:

```dotenv
PAYPAL_SANDBOX_CLIENT_ID=...
PAYPAL_SANDBOX_CLIENT_SECRET=...
PAYPAL_SANDBOX_PARTNER_MERCHANT_ID=...
PAYPAL_PARTNER_ATTRIBUTION_ID=...
```

The app requires a BN code because every platform request sends `PayPal-Partner-Attribution-Id`. A normal REST app alone may not expose one; the Multiparty feature configuration does.

### Create the PayPal webhook

Create a webhook on the same Sandbox REST app:

```text
https://YOUR_PUBLIC_APP_HOST/api/webhooks/paypal
```

PayPal cannot reach localhost. For local UI development, point the webhook to a deployed test environment or use an HTTPS tunnel and temporarily set `NEXT_PUBLIC_SITE_URL` consistently.

Subscribe to:

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `MERCHANT.ONBOARDING.COMPLETED`
- `MERCHANT.PARTNER-CONSENT.REVOKED`

If historical Payouts tests are still in use, retain their batch/item event subscriptions as well.

Copy the generated webhook ID:

```dotenv
PAYPAL_SANDBOX_WEBHOOK_ID=...
```

The webhook ID is not the client ID and is not an event ID.

### End-to-end PayPal check

1. As a program owner, create a recipient invitation using an inbox you control.
2. Open the newest email link and claim the recipient.
3. In the recipient portal, connect the recipient's sandbox business PayPal account.
4. Recheck status until `permissions_granted`, `payments_receivable`, `primary_email_confirmed`, and a supported checkout product make the connection active.
5. Publish a USD campaign containing that recipient.
6. Use a sandbox personal account to make a direct supporter donation.
7. Close a voting period and use the program-owner funding checkout.
8. Confirm the PayPal webhook event log shows successful delivery.

Current supporter checkout is restricted to USD campaigns. The entire PayPal integration is sandbox-bound in code.

## 8. Configure OpenRouter

Create a restricted OpenRouter key and choose a model whose provider route supports JSON-schema structured output.

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=provider/model-slug
```

Test all three features:

1. On the dashboard, use the assistant beside the campaign list to plan a campaign from the connected recipient catalog and approve the resulting private draft.
2. In a developer project's Entitlements tab, ask the assistant to propose an unambiguous earning rule.
3. Review the proposed entitlement change and apply it manually.
4. For a campaign with a frozen allocation, generate an impact-report draft.
5. Verify the report cites only the provided evidence and remains in review until an owner/admin approves it.

An HTTP 402 usually means the OpenRouter account lacks credit. Schema-validation failures usually mean the chosen model/provider route does not honor structured output.

## 9. Deploy the application to Vercel

1. Import the Git repository into Vercel.
2. Keep the repository root as the project root.
3. Use the detected Next.js build settings.
4. Add every core variable to Production.
5. Add PayPal and OpenRouter variables if those features are enabled.
6. Set `NEXT_PUBLIC_SITE_URL` to the canonical Vercel domain.
7. Redeploy after changing any environment variable.
8. Add the deployed `/auth/callback` URL in Supabase Auth.
9. Update the PayPal webhook URL if the deployment hostname changed.

### Vercel variable placement

| Group | Vercel |
| --- | --- |
| Supabase URL/publishable/secret | Required |
| Site URL and three application secrets | Required |
| Five PayPal variables | Required for PayPal |
| Two OpenRouter variables | Required for AI |
| Render-only URLs | Do not add |

The `vercel.json` cron calls `/api/cron/close-periods` daily at 13:00 UTC. It is a replay-safe fallback, not the primary scheduler.

## 10. Deploy Render cron jobs

Create a Render Blueprint from [`render.yaml`](../render.yaml). It creates:

- `our-impact-paypal-reconciliation` every five minutes;
- `our-impact-developer-webhooks` every five minutes.

Set the prompted `CRON_SECRET` to exactly the Vercel value.

The blueprint supplies:

- `RECONCILIATION_URL=https://our-impact.vercel.app/api/cron/reconcile-paypal`
- `DEVELOPER_WEBHOOK_URL=https://our-impact.vercel.app/api/cron/deliver-developer-webhooks`

Change those URLs for a fork or custom domain. Render does not need Supabase, PayPal, OpenRouter, or developer signing credentials; it only makes authenticated HTTPS calls into the application.

## 11. Optional APIMatic tooling

APIMatic is not required to run Our Impact. It is used to validate the API description, generate `@our-impact/node`, and optionally render a developer portal.

Install the current APIMatic CLI according to its versioned documentation. This repository's established workflow uses CLI v2 and requires Node 24:

```bash
npm install --global @apimatic/cli@2
apimatic auth login
```

Then:

```bash
pnpm openapi:export
apimatic api validate --input ./apimatic/server
apimatic sdk generate --language=typescript --input ./apimatic/server --destination ./packages/node
pnpm sdk:check
```

The export command writes generated snapshots. Do not run it casually in a worktree containing OpenAPI changes you do not intend to review.

## 12. Environment matrix

| Variable | Local app | Vercel | Render |
| --- | ---: | ---: | ---: |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes | No |
| `NEXT_PUBLIC_SITE_URL` | Yes | Yes | No |
| `SUPABASE_SECRET_KEY` | Yes | Yes | No |
| `VOTE_HASH_SECRET` | Yes | Yes | No |
| `CRON_SECRET` | For manual cron tests | Yes | Yes |
| `DEVELOPER_SIGNING_SECRET` | Yes | Yes | No |
| PayPal variables | If testing PayPal | If testing PayPal | No |
| OpenRouter variables | If testing AI | If testing AI | No |
| `RECONCILIATION_URL` | No | No | First Render job |
| `DEVELOPER_WEBHOOK_URL` | No | No | Second Render job |

## 13. Troubleshooting

### `invalid_api_key` from Supabase

- Confirm the URL and publishable key belong to the same project.
- Prefer the new `sb_publishable_...` key rather than a legacy anon JWT.
- Redeploy after changing Vercel variables.
- Do not place quotes or trailing whitespace around values.

### Auth link returns `otp_expired`

- Request a new link and use only the newest message.
- Confirm `NEXT_PUBLIC_SITE_URL` and the Supabase redirect allowlist match.
- Avoid link scanners or email security tools that consume single-use links.
- Verify system time is correct.

### Permission denied or missing function

- Verify the app points at the project you migrated.
- Run `pnpm exec supabase migration list`.
- Apply `pnpm exec supabase db push`.
- Do not paste only the last migration into a fresh database; migrations are cumulative.

### PayPal onboarding returns `INVALID_REQUEST`

- Check the PayPal debug ID and event log.
- Confirm Multiparty features are enabled for the REST app.
- Confirm the BN code and platform merchant ID are from the same sandbox integration.
- Compare the request in `src/lib/paypal/platform.ts` with current Partner Referrals documentation.

### Merchant setup stays incomplete

Our Impact requires the merchant status response to show:

- at least one OAuth integration;
- payments receivable;
- primary email confirmed;
- an active supported checkout product.

Use **Recheck PayPal status** after completing or confirming the seller account. Sandbox onboarding UI may say entered profile data is not retained; merchant capability status is still the authoritative result.

### Webhook log is empty

- PayPal must use the same REST app that created the transaction.
- The listener must be public HTTPS.
- The registered webhook ID must match `PAYPAL_SANDBOX_WEBHOOK_ID`.
- Use a real sandbox transaction. PayPal's simulator uses a special webhook ID and is not equivalent to the registered-app flow.
- Check Vercel function logs for `missing_paypal_headers`, `signature_verification_failed`, or persistence errors.

### Render job fails with an AND-style missing-variable message

Each job needs its own URL variable plus `CRON_SECRET`:

- reconciliation: `RECONCILIATION_URL` **and** `CRON_SECRET`;
- developer webhooks: `DEVELOPER_WEBHOOK_URL` **and** `CRON_SECRET`.

### OpenRouter rejects a request

- `provider_401`: wrong or revoked key.
- `provider_402`: account needs credit.
- `failed_validation`: provider/model did not follow the strict schema.
- `timeout`: provider exceeded the 45-second application timeout.

## 14. Setup completion checklist

- [ ] Dependencies install using the pinned pnpm version.
- [ ] All migrations apply to the intended Supabase project.
- [ ] `.env.local` contains unique application secrets.
- [ ] Signup, callback, sign-in, and sign-out work.
- [ ] Workspace and campaign creation work under RLS.
- [ ] A public widget can load and vote.
- [ ] Recipient email claim works.
- [ ] Recipient PayPal status becomes active, if PayPal is enabled.
- [ ] Direct and campaign funding sandbox checkouts complete, if PayPal is enabled.
- [ ] PayPal webhook signatures verify.
- [ ] OpenRouter proposals validate, if AI is enabled.
- [ ] Supabase Cron shows `our-impact-close-due-periods`.
- [ ] Render jobs return successful JSON.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.

## Official references

- [Supabase SSR authentication](https://supabase.com/docs/guides/auth/server-side)
- [Creating Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase local development](https://supabase.com/docs/guides/local-development)
- [Supabase API keys](https://supabase.com/docs/guides/api/api-keys)
- [PayPal OAuth authentication](https://developer.paypal.com/api/rest/authentication)
- [PayPal seller onboarding](https://developer.paypal.com/platforms/seller-onboarding)
- [PayPal multi-seller payments](https://developer.paypal.com/platforms/checkout/standard/customize/multiseller-payments)
- [PayPal webhook integration](https://developer.paypal.com/api/rest/webhooks/rest/)
- [APIMatic CLI installation](https://docs.apimatic.io/v4/apimatic-cli/install/)
