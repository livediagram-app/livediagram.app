# Self-hosting

livediagram is designed to be self-hostable end-to-end. The whole stack runs on Cloudflare Workers, so a self-hoster needs a Cloudflare account and not much else.

This guide is the practical path: provision Cloudflare resources, configure secrets, deploy. For the why-behind-the-shape, read [spec/10](../specs/10-deployment.md) (deployment) and [spec/06](../specs/06-secrets-policy.md) (secrets).

## What you'll provision on Cloudflare

| Resource                             | Used by          | Why                                                                                     |
| ------------------------------------ | ---------------- | --------------------------------------------------------------------------------------- |
| **Workers paid plan**                | All five workers | Durable Objects (per-diagram realtime room) need the paid plan.                         |
| **D1 database**                      | `apps/api`       | Diagrams, tabs, comments, share links, change log, telemetry rows.                      |
| **Durable Object namespace**         | `apps/api`       | One stateful room per diagram for realtime presence + ops.                              |
| **R2 bucket** (optional)             | `apps/api`       | Image uploads. The api degrades to `503 images-unavailable` without it.                 |
| **Rate Limiter bindings** (optional) | `apps/api`       | Per-owner write throttle + per-IP telemetry throttle.                                   |
| **Custom domain**                    | `apps/router`    | The router worker serves your hostname; downstream workers don't need their own domain. |

What you do NOT need:

- Clerk: auth is optional. Without it, every user is a guest (a per-browser id stored in `localStorage`, carried as `X-Owner-Id`). With Clerk configured, the api worker reaches `CLERK_JWKS_URL` to verify Bearer tokens; that's the only outbound SaaS dependency, and only on the auth path.
- Any other SaaS: no Stripe (no paid tier), no Resend (transactional email isn't built yet), no analytics vendor. The telemetry endpoint is first-party only and off by default.
- A separate database host: D1 covers everything.

## One-time Cloudflare setup

1. **Create a Cloudflare account** and sign up for the Workers paid plan ($5/mo at the time of writing).
2. **Create a D1 database**:

   ```sh
   pnpm exec wrangler d1 create livediagram
   ```

   Copy the `database_id` from the output into `apps/api/wrangler.toml` under the `[[d1_databases]]` block (it already has the binding name `DB`; you only need to update the id).

3. **Apply migrations to the new D1**:

   ```sh
   pnpm --filter @livediagram/api exec wrangler d1 migrations apply DB --remote --yes
   ```

   This creates every table the worker expects. The same command runs in the deploy workflow on every release, so you only need it once for the first deploy.

4. **Create an R2 bucket** (optional, for images):

   ```sh
   pnpm exec wrangler r2 bucket create livediagram-images
   ```

   The bucket name is bound to `IMAGES` in `apps/api/wrangler.toml`.

5. **Get an API token + account id**:
   - Account id is at the bottom-right of any Cloudflare dashboard page.
   - API token: create one with **Workers Scripts: Edit**, **D1: Edit**, **R2: Edit** (only if using images), **Workers KV: Edit** (for Durable Objects), and **Account → Account Settings: Read** on your account. Save it.

## Required GitHub Actions secrets

If you're deploying via GitHub Actions (the default workflow), set two repo secrets:

- `CF_API_TOKEN`: the token from the step above.
- `CF_ACCOUNT_ID`: your Cloudflare account id.

That's it. The deploy workflow uses raw `pnpm exec wrangler deploy` against these credentials.

## Optional Clerk auth

The hosted version uses Clerk for sign-in. To enable on your self-host:

1. Create a Clerk application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Copy the publishable key and the JWKS URL.
3. Set them on the two workers / apps:
   - **Live (build-time, browser-side)**: set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` in your CI build env, or in `apps/live/.env.production`.
   - **API (worker secret)**:

     ```sh
     pnpm --filter @livediagram/api exec wrangler secret put CLERK_JWKS_URL
     ```

     Paste the JWKS URL when prompted.

Without these set, the api worker treats every request as a guest (resolves owner from `X-Owner-Id`), and the live frontend's ClerkProvider becomes a pass-through that renders the editor without any auth UI. Self-host without Clerk is a fully-supported path; the canvas works identically.

See [spec/04](../specs/04-auth-and-guest-access.md) for the hybrid auth model.

## Deploy

After the one-time Cloudflare setup:

```sh
git clone https://github.com/livediagram-app/monorepo livediagram
cd livediagram
pnpm install
pnpm build           # static export for marketing + live + telemetry
# Then deploy each worker (run from the repo root):
pnpm --filter @livediagram/marketing exec wrangler deploy
pnpm --filter @livediagram/live exec wrangler deploy
pnpm --filter @livediagram/telemetry exec wrangler deploy
pnpm --filter @livediagram/api exec wrangler deploy
pnpm --filter @livediagram/router exec wrangler deploy   # last, depends on the four above
```

Deploy order matters: the router's service bindings reference the four other workers, so it can't deploy until they exist. The GitHub Actions deploy workflow encodes this as a job dependency.

Or just push to `main` and use the bundled GitHub Actions workflows:

- `.github/workflows/ci.yml` runs lint / format / typecheck / test / build on every PR and push.
- `.github/workflows/deploy.yml` is **manually triggered** from the Actions tab. It builds once then deploys all five workers in the right order.

See [spec/10](../specs/10-deployment.md) for the deeper deploy mechanics, including how D1 migrations run BEFORE the worker deploy so the new code never briefly runs against the old schema.

## Telemetry: off by default for self-hosters

The api worker's telemetry ingest (`/api/events`) is off unless `TELEMETRY_ENABLED=true` is set in `apps/api/wrangler.toml`. OSS forks ingest nothing by default. If you DO turn it on, the public `/telemetry` dashboard renders aggregate counts from your own D1; there's no third-party analytics involved. See [spec/22](../specs/22-telemetry.md).

Turning telemetry on end-to-end takes BOTH the server gate above AND a build-time gate on the editor + dashboard apps. The api flag is the authoritative gate (ingest + summary refuse to serve without it), but the live editor also reads `NEXT_PUBLIC_TELEMETRY_ENABLED` at build time and skips emission entirely when it isn't `"true"`, and the telemetry dashboard does the same. So a fork that only flips the api flag will see "ingest on" but no events flow, and the dashboard stays empty. To turn it fully on, set `NEXT_PUBLIC_TELEMETRY_ENABLED=true` in your CI build env (or `apps/live/.env.production` + `apps/telemetry/.env.production`) alongside the api flag. Per-user opt-out via the Settings dialog (spec/20) still overrides both when off.

## Custom domain

Add a custom-domain route to the router worker (`apps/router/wrangler.toml`) and point your DNS at Cloudflare. The router stitches all paths under one hostname:

- `/` → marketing
- `/live/*` → live editor
- `/telemetry` → telemetry dashboard
- `/api/*` → api worker

The four downstream workers don't need their own domain; the router fans out via service bindings.

## What can break, and how to debug

- **`account not authorized` from wrangler**: the API token is missing a scope. See the token list above; most often it's missing **Account → Account Settings: Read**, which wrangler uses to look up your account.
- **`Durable Object class is not exported`**: the api worker's `wrangler.toml` references `DiagramRoom` as the DO class. It IS exported from `apps/api/src/index.ts`; if you've forked + renamed, keep the export name in step with the binding.
- **Editor loads but every request 403s**: the resolved owner doesn't match the diagram's stored owner. If you migrated from one auth setup to another (added Clerk after running guest-only), the old guest diagrams still belong to the old guest id. The `/api/migrate` endpoint moves rows from a guest id to a Clerk userId after sign-up; see [spec/04](../specs/04-auth-and-guest-access.md).
