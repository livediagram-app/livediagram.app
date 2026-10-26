# Deployment

liveplanner deploys from the liveworkspace monorepo's root `.github/` workflows to **Cloudflare Workers** in the
liveworkspace Cloudflare account, as every product and the platform do ([docs/ci.md](../../../../docs/ci.md)
"Deploys"). **Staging** follows `main` on its own; **production** is a manual gate that ships what staging runs.
This spec covers what is liveplanner's within that pipeline; [Staging environment](staging-environment.md) covers
what staging changes and why.

## Apps and their Cloudflare Workers

| App              | Cloudflare Worker       | Type                                                                          |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `apps/marketing` | `liveplanner-marketing` | Static assets only (Next.js `output: 'export'`).                              |
| `apps/editor`    | `liveplanner-editor`    | Static assets plus a small path-rewrite worker.                               |
| `apps/help`      | `liveplanner-help`      | Static assets only (help centre, [Help app](../018-help/help-app.md)).        |
| `apps/api`       | `liveplanner-api`       | Worker with one Durable Object class (`PlanRoom`); no D1 and no R2.           |
| `apps/mcp`       | `liveplanner-mcp`       | Worker (OAuth + MCP tools; own host, [MCP server](../015-api/mcp-server.md)). |
| `apps/router`    | `liveplanner-router`    | Worker with service bindings to marketing, editor, api and help.              |

`apps/cli` is the npm CLI ([CLI](../015-api/cli.md)) and deploys nowhere.

The marketing and help workers serve their `out/` folders. The editor worker serves `apps/editor/out/` through
`apps/editor/src/worker.ts`, which rewrites every `/project/<id>` request to the one statically built
`/project/placeholder/` page ([New project route](../007-editor/new-project-route.md)) and serves the share page. The
api worker holds the REST and WebSocket layer ([API](../015-api/api.md)). The mcp worker serves the AI tools on its
own host, `mcp.liveplanner.app`, and binds to the api worker directly, not through the router
([MCP server](../015-api/mcp-server.md)). The router holds **no application logic**: its `MARKETING`, `EDITOR`,
`API` and `HELP` service bindings forward each request to its worker, and it forwards the platform's paths to
liveworkspace ([Router app](router-app.md)).

Telemetry, its dashboard, the status page, the Explorer, previews, Drive sync and the index are liveworkspace's
services and deploy with the platform ([liveworkspace/docs/telemetry.md](../../../../liveworkspace/docs/telemetry.md),
[liveworkspace/docs/previews.md](../../../../liveworkspace/docs/previews.md)).

Each app's `wrangler.toml` sits at the app root and is the source of truth for the worker's name, compatibility
date, `[assets]`, `[[services]]`, Durable Object bindings, the account it deploys to (`account_id`, the liveworkspace
account) and its public hostnames ([Custom domain](#custom-domain)). Secrets **never** go in `wrangler.toml`
([Secrets policy](../002-project-scope/secrets-policy.md)).

## Toolchain

- **Node:** 22 (Wrangler 4 requires 22 or later); the root `.github/actions/setup` pins it for every job.
- **pnpm:** `9.15.0`, the root `packageManager`, through `pnpm/action-setup`.
- **Wrangler:** `^4.148.0` in every app that deploys.
- **Asset size:** Workers Static Assets refuses any file over 25 MiB, and only at deploy. The editor's `build` ends
  with `scripts/asset-size-gate.mjs`, which fails the build on any file in `out/` over the limit, so CI catches it
  first.

## CI

The root `ci.yml` runs on every pull request and every push to `main`, and runs liveplanner's group only when a
change reaches it ([docs/ci.md](../../../../docs/ci.md) "Only what changed"). For the liveplanner group:

- **Checks**: lint and type check of the affected workspaces, and liveplanner's own `format:check`.
- **Tests**: every affected workspace's suite once. Those with `test:coverage` run that, so their per-file
  thresholds are enforced; the rest run `test`. Two at a time (`--concurrency=2`): each vitest fills the cores.
- **Editor unit tests i/3**: `@liveplanner/editor` under coverage, a third of its files per job
  (`vitest run --coverage --shard=i/3`) ([Coverage report](../003-system-architecture/testing.md#coverage-report)).
  `scripts/ci-test-filters.mjs` keeps the editor out of the Tests job, so each suite runs exactly once.
- **Build**: the affected workspaces' builds, the CLI's `npm pack --dry-run`, and `staging:check`.
- **CI**: one job that fails when any of the above failed. It is the check `main` requires.

No job needs another's output: only the seven apps have a `build` script, and no workspace depends on an app, so
checks and tests build nothing.

`staging:check` runs `wrangler deploy --dry-run --env staging` for the three workers that carry bindings (api, mcp,
router). Wrangler does not inherit bindings into a named environment, so a binding missing from an `[env.staging]`
block, or a `service =` that lost its `-staging` suffix and points the staging router at **production**, is neither
a type error nor a test failure. Without this step the first sign of either is a deploy.

The root `e2e.yml` runs liveplanner's six smoke shards, its sites audit and its signed-in specs through
`e2e-product.yml` when a change reaches the editor ([E2E smoke](../003-system-architecture/e2e-smoke.md)).
`canvas-perf.yml` runs the canvas performance probe nightly against `main`
([Canvas performance](../008-canvas/canvas-performance.md)). It never blocks anything: a miss opens or comments on
one issue, **Canvas performance budget: liveplanner**, which the first all-pass run closes.

**Testing** runs via [Vitest](https://vitest.dev). Workspaces opt in by adding `"test": "vitest run"` to their
`package.json` scripts and `vitest` to their `devDependencies`; turbo picks the task up. Tests live next to the
source they cover as `*.test.ts` files.

### Runs on main are never cancelled

`ci.yml` and `e2e.yml` cancel a run only on a pull request, where a newer push makes the older run moot. On `main`
every commit runs to the end, each in a concurrency group of its own (keyed by the commit), so a failure can be
pinned on its commit and every pull request has a base to compare coverage against. Runs on `main` finishing out of
order are handled by the staging deploy, which skips a commit `main` has moved past.

## Deploy

`deploy.yml` (**Deploy (reusable)**) deploys one environment. Two callers run it:

- `deploy-staging.yml`, a `workflow_run` after CI passes for a push to `main`, deploys that commit to every
  Worker's `[env.staging]`.
- `deploy-production.yml` (**Deploy Production**, `workflow_dispatch`) ships exactly what staging runs (the
  `deployed/staging` tag) by default; a `ref` ships another commit.

**Only what changed.** Each environment remembers the commit it last deployed in full as the tag
`deployed/staging` or `deployed/production`. A deploy asks Turborepo which workspaces changed since then, with
everything depending on them (`ci-plan.mjs`, `PLAN_MODE=deploy`), and builds and deploys the Workers among them.
**all** redeploys every Worker (a first deploy, or a rollback).

**Order.** Three tiers, each waiting for the one before, and a failing tier stops the ones after it:

1. **Services and apis**: `liveplanner-api`. There is no migration step: the api has no D1, and each plan's
   object brings its own SQLite schema up to date on first use (`plan-schema.ts`).
2. **Sites and MCP**: `liveplanner-marketing`, `liveplanner-editor`, `liveplanner-help` and `liveplanner-mcp`, so
   a new editor never calls an api that lacks its routes and the mcp worker's binding to the api exists.
3. **Routers**: `liveplanner-router`, whose service bindings target the workers above.

`deploy-worker.yml` deploys each Worker: its build when it serves static assets (the help site from full history,
since its sitemap dates each article by its last commit), then `pnpm exec wrangler deploy`, with `--env staging` on
staging. A save that fails while old and new versions briefly serve side by side is retried on its own
([Per-tab storage](../006-project/per-tab-storage.md#retrying-a-failed-save)). A plan's schema only moves forward (a
later change adds a step to `plan-schema.ts`, never edits one), so a problem is fixed forward.

## Hosted profile

Some configuration is what **liveplanner.app** runs with, not what the software defaults to. Committed `[vars]`
would make it every environment's default (local development, previews); a value set only in the Cloudflare
dashboard would be wiped by the next `wrangler deploy`, which replaces a worker's plain vars with exactly the ones it
declares. So it has a seam of its own: the **hosted profile**.

- **What it holds.** `apps/api/hosted-vars.json`: `TELEMETRY_ENABLED = "true"`
  ([Telemetry](../017-telemetry/telemetry.md)), and per environment, under `environments.production` and
  `environments.staging`, `APP_BASE_URL` (the canonical public origin email and share links are built from,
  `https://www.liveplanner.app` in production, never the apex that redirects to it) and `TELEMETRY_URL`
  (liveworkspace's telemetry endpoint). An empty per-environment value is unset there.
- **Who gets it.** The deploy plan marks a Worker `hosted` when its app has `scripts/hosted-vars.mjs`, which only
  the api has; each liveplanner site's build reads the same file for its frontend mirror.
- **How it is applied.** On every deploy: a site's build exports the frontend mirror
  (`node scripts/hosted-vars.mjs build-env`, `NEXT_PUBLIC_TELEMETRY_ENABLED` among it) with its build id
  (`NEXT_PUBLIC_BUILD_ID`), and on staging the staging MCP origin (`NEXT_PUBLIC_MCP_ORIGIN`). The api deploy passes
  each var as `wrangler deploy --var NAME:VALUE` (`node scripts/hosted-vars.mjs flags`) plus `BUILD_ID`. Every
  command takes the environment as `--env staging` (none is production), so a deploy only ever applies its own
  environment's entries.
- **How it is checked.** After the api deploy, `node scripts/hosted-vars.mjs verify` reads the plain vars off every
  version serving traffic and fails the run on any hosted var that is missing or different, or that its environment
  leaves unset but the worker still holds. In CI, `apps/api/src/hosted-vars.test.ts` fails when the profile stops
  turning telemetry on, names a var the worker does not read, or when `wrangler.toml` commits a hosted-only var as a
  default.

## Credentials and secrets

The only credential the workflows hold is the repository secret **`CLOUDFLARE_API_TOKEN`**, a token for the
liveworkspace account with Workers Scripts and D1 edit rights ([docs/ci.md](../../../../docs/ci.md) "Deploys"). Every
`wrangler.toml` pins the account, so no account id is passed.

A deploy writes code and plain vars only. Each Worker's secrets (the accounts client values, `INDEX_KEY`,
`MEDIA_KEY`, `TELEMETRY_KEY`, `GUEST_ID_HMAC_SECRET` and the rest) are set on it with `wrangler secret put` (with
`--env staging` for staging) and survive every deploy. [Secrets policy](../002-project-scope/secrets-policy.md) holds
the full table. Email needs no secret: its `send_email` binding is the credential
([liveworkspace/docs/email.md](../../../../liveworkspace/docs/email.md)).

## Custom domain

Production lives at **`https://liveplanner.app`**. Only two workers have a hostname, and each declares its own in
its `wrangler.toml` as a Workers custom domain (`routes` with `custom_domain = true`):

| Worker                       | Hostnames                                |
| ---------------------------- | ---------------------------------------- |
| `liveplanner-router`         | `liveplanner.app`, `www.liveplanner.app` |
| `liveplanner-mcp`            | `mcp.liveplanner.app`                    |
| `liveplanner-router-staging` | `staging.liveplanner.app`                |
| `liveplanner-mcp-staging`    | `mcp-staging.liveplanner.app`            |

`wrangler deploy` attaches each one, and Cloudflare creates its DNS record and certificate, so no hostname is a
dashboard step. `www.liveplanner.app` is attached because it is the canonical origin links are built from
(`APP_BASE_URL`). The other workers have no hostname: they are reached only over the router's (and the mcp worker's)
service bindings. From the router ([Router app](router-app.md)):

- `/api/*` goes to the api worker (REST and WebSocket), except the platform's `/api/index/*`, Drive and previews
  paths, which go to liveworkspace.
- `/live/*` is the editor's `_next` assets (prefix stripped); the editor's page routes (`/project`, `/new`,
  `/form`, ...) are forwarded as they are.
- `/help/*` goes to the help centre (prefix stripped); `/telemetry` redirects to liveworkspace's dashboard.
- Everything else goes to marketing.

## Rollback

A rollback is **Deploy Production** with an older `ref`: a commit older than production's own redeploys every
Worker, as **all** does.
