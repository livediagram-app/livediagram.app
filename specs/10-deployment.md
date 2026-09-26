# Deployment

All deployments run **via GitHub Actions** to **Cloudflare Workers**. The **production** deploy is **manually triggered** — a green CI run no longer ships on its own.

There is a second environment, **staging**, which does deploy on its own: every green CI run on `main` lands on `staging.livediagram.app`. It runs the same jobs described below through the same reusable workflow, against its own workers and its own D1 / R2 / KV. This spec covers production; [spec/140](140-staging-environment.md) covers what staging changes and why.

## Apps and their Cloudflare Workers

| App              | Cloudflare Worker       | Type                                             |
| ---------------- | ----------------------- | ------------------------------------------------ |
| `apps/marketing` | `livediagram-marketing` | Static assets only (Next.js `output: 'export'`). |
| `apps/live`      | `livediagram-live`      | Static assets + a tiny path-rewrite worker.      |
| `apps/telemetry` | `livediagram-telemetry` | Static assets only (public dashboard, spec/22).  |
| `apps/help`      | `livediagram-help`      | Static assets only (help centre, spec/55).       |
| `apps/api`       | `livediagram-api`       | Worker (D1 binding + Durable Object).            |
| `apps/mcp`       | `livediagram-mcp`       | Worker (OAuth + MCP tools; own host, spec/62).   |
| `apps/router`    | `livediagram-router`    | Worker (service bindings to the other five).     |

The marketing worker serves files from `apps/marketing/out/` (`output: 'export'`). The live worker serves files from `apps/live/out/` plus a small worker (`apps/live/src/worker.ts`) that rewrites every `/diagram/<id>` request to the single statically-built `/diagram/placeholder/` page — see [14-new-diagram-route.md](14-new-diagram-route.md). The telemetry worker is static-assets-only like marketing, served under `/telemetry` ([22-telemetry](22-telemetry.md)). The help worker is static-assets-only too, served under `/help` ([55-help-app](55-help-app.md)). The api worker holds the REST + WebSocket layer (see [11-api.md](11-api.md)). The mcp worker exposes the AI tools over its own host `mcp.livediagram.app` (it binds to the api worker, not the router; see [62-mcp-server.md](62-mcp-server.md)). The router holds **no application logic** — only `MARKETING`, `LIVE`, `TELEMETRY`, `HELP`, and `API` service bindings that forward requests to the right downstream worker.

`wrangler.toml` for each app sits at the app root and is the source of truth for the worker's name, compatibility date, `[assets]`, `[[services]]`, `[[d1_databases]]`, and Durable Object bindings. Account-level identifiers (account id, custom domain, secrets) **never** go in `wrangler.toml` — they live in environment variables or the Cloudflare dashboard. See [06-secrets-policy.md](06-secrets-policy.md).

## Toolchain

- **Node:** `>=22` (Wrangler 4 requires it). Both `ci.yml` and `deploy.yml` pin Node 22.
- **pnpm:** `9.15.0` via `pnpm/action-setup`.
- **Wrangler:** `^4.40.0` across all workspaces.

## CI

`.github/workflows/ci.yml` runs on **every PR** and **every push to `main`**.

Steps:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm typecheck`
5. `pnpm turbo run test --concurrency=2`
6. `pnpm turbo run test:coverage --concurrency=2` (enforces the per-file coverage thresholds)
7. `pnpm build`
8. `pnpm staging:check`

The two test steps run two packages at a time. Each package's Vitest already fills the runner's cores, and turbo's default fan-out on the 4-vCPU runner slowed the CPU-heavy `sticky-vision` suite about 70x, into timeouts. `pnpm test` cannot carry the flag: it is pnpm's built-in test command, so CI calls turbo directly.

CI is the gate you check before deploying to production, but it does **not** trigger that deploy — production is a separate, manually-dispatched workflow (see below). It **does** trigger the staging deploy, via `workflow_run` on a successful CI run on `main` ([spec/140](140-staging-environment.md)).

`pnpm staging:check` runs `wrangler deploy --dry-run --env staging` for the three workers that carry bindings (api, mcp, router). Wrangler does not inherit bindings into a named environment, so a binding missing from an `[env.staging]` block — or a `service =` that lost its `-staging` suffix, pointing the staging router at **production** — is neither a type error nor a test failure. Without this step the first sign of either is a deploy.

**Testing** runs via [Vitest](https://vitest.dev). Workspaces opt in by adding `"test": "vitest run"` to their `package.json` scripts and `vitest` to their `devDependencies`; turbo then picks the task up automatically. Tests live next to the source they cover as `*.test.ts` files. Most workspaces are opted in (`pnpm turbo run test --dry` lists them); a workspace mirrors the pattern when it adds its first test.

## Deploy

The deploy is split in two: `.github/workflows/deploy-reusable.yml` holds every job below as a **reusable workflow** (`workflow_call`), and two thin callers trigger it — `deploy.yml` for production and `deploy-staging.yml` for staging. Both environments therefore run byte-identical steps; the only difference is the inputs (`wrangler_env`, the MCP origin) and which secrets the caller passes. One body, because a staging deploy that has drifted from production's tests nothing.

`.github/workflows/deploy.yml` is **manual-only** (`workflow_dispatch`). It does not chain off CI; trigger it yourself from the Actions tab, where it appears as **Deploy Production** (or `gh workflow run deploy.yml --ref main` — the file name is passed rather than the display name, so a future rename can't stale this out) once CI on `main` is green and you've decided to ship. It checks out and builds whatever the current `main` is at trigger time.

Every `wrangler` invocation in the reusable workflow ends in `${WRANGLER_ENV:+--env "$WRANGLER_ENV"}`, which expands to nothing for production — so production runs exactly the commands it always ran — and to `--env staging` for the staging caller. Shell expansion rather than a GitHub expression, so it reads the same locally as in the log.

Jobs:

1. **build** — installs deps, runs `pnpm build`, uploads `apps/marketing/out`, `apps/live/out`, `apps/telemetry/out`, and `apps/help/out` as workflow artifacts.
2. **deploy-marketing** — downloads `marketing-out`, runs `pnpm exec wrangler deploy` from `apps/marketing/`.
3. **deploy-live** — downloads `live-out`, runs `pnpm exec wrangler deploy` from `apps/live/`.
4. **deploy-api** — runs:
   - `pnpm exec wrangler whoami` (diagnostic — prints which Cloudflare account the token authenticates against so a `7403 account not authorized` error is debuggable from the log).
   - `pnpm exec wrangler d1 migrations apply DB --remote` applies any pending migrations BEFORE the worker deploy so the new code never briefly runs against an older schema. If this step fails the job halts and surfaces a precise error pointing at the missing token scopes. (Wrangler 4 dropped the `--yes` flag; the command is non-interactive by default in CI.)
   - `pnpm exec wrangler deploy` from `apps/api/`.
5. **deploy-telemetry** — downloads `telemetry-out`, runs `pnpm exec wrangler deploy` from `apps/telemetry/` (in parallel with marketing/live/api).
6. **deploy-help** — downloads `help-out`, runs `pnpm exec wrangler deploy` from `apps/help/` (in parallel with the others).
7. **deploy-mcp** — depends on **deploy-api** (the MCP worker has a service binding to the api worker, spec/62, so api must exist first). Runs `pnpm exec wrangler deploy` from `apps/mcp/` — no static artifact to download, the worker bundles from source. NOT a `deploy-router` dependency: `mcp.livediagram.app` is its own host, not a path under the main hostname.
8. **deploy-router** — depends on **deploy-marketing**, **deploy-live**, **deploy-api**, **deploy-telemetry**, and **deploy-help**. Runs `pnpm exec wrangler deploy` from `apps/router/`. The router's service bindings target the five workers above, so it must deploy after they exist. This is the one job carrying a GitHub `environment`, so a run files a single deployment record with the public URL rather than seven.

`deploy-marketing`, `deploy-live`, `deploy-api`, `deploy-telemetry`, and `deploy-help` run in parallel off `build`; `deploy-mcp` runs once `deploy-api` is up (parallel to the rest); `deploy-router` waits for the five it binds (not mcp, which is a separate host).

All seven deploy jobs use raw `pnpm exec wrangler` rather than `cloudflare/wrangler-action` — wrangler 4 ships sensible defaults and the explicit invocation makes the workflow log read 1:1 against a local run.

## Required GitHub Action secrets

Set in the repo under **Settings → Secrets and variables → Actions**:

| Secret          | What it is                                                                      |
| --------------- | ------------------------------------------------------------------------------- |
| `CF_API_TOKEN`  | A Cloudflare API token with permissions to deploy Workers and apply migrations. |
| `CF_ACCOUNT_ID` | The Cloudflare account ID the workers belong to.                                |

**Optional**, each synced into `wrangler secret put` by the deploy workflow and skipped when unset, so a fork that sets none still deploys:

| Secret                 | Synced to       | See                                                                        |
| ---------------------- | --------------- | -------------------------------------------------------------------------- |
| `CLERK_JWKS_URL`       | api             | [04](04-auth-and-guest-access.md)                                          |
| `GUEST_ID_HMAC_SECRET` | api             | [04](04-auth-and-guest-access.md)                                          |
| `INTERNAL_EVENTS_KEY`  | api **and** mcp | [22](22-telemetry.md) — one GitHub secret drives both, so they can't drift |

Syncing on every deploy means these rotate by editing the GitHub secret rather than by running `wrangler` against production. [spec/06](06-secrets-policy.md) holds the full worker-secret table.

Staging has a `_STAGING`-suffixed twin of each optional secret plus its own Clerk publishable key, listed in [spec/140](140-staging-environment.md). `CF_API_TOKEN` and `CF_ACCOUNT_ID` are shared: both environments live in the same Cloudflare account.

### Creating the API token

Cloudflare dashboard → **My Profile → API Tokens → Create Token → Custom Token**.

Permissions (all on the account that owns the workers):

- **Workers Scripts → Edit** — deploy & update workers.
- **D1 → Edit** — apply migrations during deploy.
- **Workers Routes → Edit** — wire / update custom domain routes.
- **Account Settings → Read** — required by wrangler.
- **User → User Details → Read** — `wrangler whoami` introspection.

Scope to **the specific account** that owns the workers. Do **not** issue an "all-account" token. If the deploy-api step emits `7403 The given account is not valid or is not authorized to access this service`, the token is missing D1 Edit (or was minted for a different account than `CF_ACCOUNT_ID`).

### Getting the account ID

Cloudflare dashboard → any zone → right sidebar → **Account ID** (copy).

## First deploy

On the first run, none of the workers exist yet. The job ordering handles this: `deploy-marketing`, `deploy-live`, `deploy-api`, `deploy-telemetry`, and `deploy-help` run first and create those workers, then `deploy-router` runs, by which point its five service-binding targets already exist, so wrangler accepts the bindings.

Subsequent deploys are idempotent updates.

## Custom domain

Production lives at **`https://livediagram.app`**. The apex routes to the router worker (configured in the Cloudflare dashboard, not in `wrangler.toml`). From there:

- `https://livediagram.app/api/*` → api worker (REST + WebSocket).
- `https://livediagram.app/live` and `https://livediagram.app/live/<anything>` → live editor (the router strips the `/live` prefix before forwarding).
- `https://livediagram.app/telemetry` → telemetry dashboard; `https://livediagram.app/help` → help centre (both prefix-stripped).
- Everything else → marketing.

The workers themselves remain reachable at their default `*.workers.dev` URLs for direct testing.

## What this spec does **not** yet cover

- Preview deploys for PRs (one environment tracking `main` is all there is — see [spec/140](140-staging-environment.md) "What staging is not").
- Rollback procedure (currently: `wrangler rollback` via dashboard or CLI).
- Per-worker secrets that are **not** in the optional sync table above (e.g. the model key (`GOOGLE_AI_STUDIO_API_KEY` / `OPENAI_API_KEY` / `AI_API_KEY`), `RESEND_API_KEY`) — those are set by hand with `wrangler secret put` and persist across deploys.
