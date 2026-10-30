# Deployment

livedocuments deploys from the liveworkspace monorepo's root `.github/` workflows to **Cloudflare Workers** in the
liveworkspace Cloudflare account, which every `wrangler.toml` pins as `account_id`. Two environments run the same
deploy: **staging**, on every green CI run on `main`, at `staging.livedocuments.app`, and **production**, run by hand,
at `livedocuments.app`. The monorepo's [CI](../../../../docs/ci.md) holds the workflows for every product; this spec
covers what they do for livedocuments. [Staging environment](staging-environment.md) covers what staging changes.

## Apps and their Cloudflare Workers

| App              | Cloudflare Worker         | Type                                                                          |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------- |
| `apps/marketing` | `livedocuments-marketing` | Static assets only (Next.js `output: 'export'`).                              |
| `apps/editor`    | `livedocuments-editor`    | Static assets + a tiny path-rewrite worker.                                   |
| `apps/help`      | `livedocuments-help`      | Static assets only (help centre, [Help app](../018-help/help-app.md)).        |
| `apps/api`       | `livedocuments-api`       | Worker (Durable Objects; no database, no bucket).                             |
| `apps/mcp`       | `livedocuments-mcp`       | Worker (OAuth + MCP tools; own host, [MCP server](../015-api/mcp-server.md)). |
| `apps/router`    | `livedocuments-router`    | Worker (service bindings to the other four sites and the api).                |

`apps/cli` is published to npm, not deployed ([CLI](../015-api/cli.md)). Publishing is a manual step outside CI, and the
MCP Registry listing is manual too (by hand, or the root `mcp-registry.yml` workflow started by hand,
[MCP server](../015-api/mcp-server.md)); CI builds and packs the CLI on every run that reaches
it (`npm pack --dry-run`, [CI](../../../../docs/ci.md)).

The marketing worker serves files from `apps/marketing/out/`. The editor worker serves files from `apps/editor/out/`
plus a small worker (`apps/editor/src/worker.ts`) that rewrites every `/document/<id>` request to the single
statically-built `/document/placeholder/` page ([New document route](../007-editor/new-document-route.md)). The help
worker is static-assets-only too, served under `/help` ([Help app](../018-help/help-app.md)). The api worker holds the
REST + WebSocket layer ([API app](../015-api/api.md)). The mcp worker exposes the AI tools on its own host
`mcp.livedocuments.app` and binds the api worker, not the router ([MCP server](../015-api/mcp-server.md)). The router
holds **no application logic**: four service bindings, `MARKETING`, `EDITOR`, `HELP` and `API`, and the forwards to
liveworkspace (its pages, the index, Drive and every preview) ([Router app](router-app.md)).

`wrangler.toml` for each app sits at the app root and is the source of truth for the worker's name, compatibility
date, `[assets]`, `[[services]]`, Durable Object bindings, `account_id` and its public hostnames
([Custom domain](#custom-domain)). Secrets **never** go in `wrangler.toml`
([Secrets policy](../002-project-scope/secrets-policy.md)).

## Toolchain

- **Node:** `>=22` (Wrangler 4 requires it). The workflows pin Node 22.
- **pnpm:** `9.15.0`, through corepack locally and `pnpm/action-setup` in the workflows, from the monorepo root.
- **Wrangler:** `^4.148.0` across the workspaces.
- **Asset size:** Workers Static Assets refuses any file over 25 MiB, and only at deploy. The editor's `build` ends
  with `apps/editor/scripts/asset-size-gate.mjs`, which fails the build on any file in `out/` over the limit, so CI
  catches it first.

## CI

`ci.yml` at the monorepo root runs on every pull request and every push to `main`, and runs livedocuments's jobs only
when a change reaches `livedocuments/` (or something every workspace leans on). For livedocuments:

- **Checks:** lint and type check of the affected workspaces, and livedocuments's `format:check`.
- **Tests:** every affected workspace's suite once; those with `test:coverage` run that, so the per-file thresholds
  hold in CI. Coverage goes to Codecov under the `livedocuments` flag.
- **Editor unit tests:** `@livedocuments/editor`'s suite under coverage, in three shards
  ([Coverage report](../003-system-architecture/testing.md#coverage-report)).
- **Build:** the affected builds, the CLI's `npm pack --dry-run` when the CLI is reached, and `staging:check`.
- **CI:** one job that fails when any of the above failed; the check `main` requires.

`staging:check` runs `wrangler deploy --dry-run --env staging` for the three workers that carry bindings (api, mcp,
router). Wrangler does not inherit bindings into a named environment, so a binding missing from an `[env.staging]`
block, or a `service =` that lost its `-staging` suffix and points the staging router at **production**, is neither a
type error nor a test failure. Without this step the first sign of either is a deploy.

`e2e.yml` (calling `e2e-product.yml`) runs livedocuments's Playwright smoke shards, sites audit and signed-in specs
when a change reaches its editor ([E2E smoke](../003-system-architecture/e2e-smoke.md)). `canvas-perf.yml` runs its
canvas probe nightly against `main` and opens or updates **Canvas performance budget: livedocuments** on a miss
([Canvas performance](../008-canvas/canvas-performance.md)).

**Testing** runs via [Vitest](https://vitest.dev). A workspace opts in with `"test": "vitest run"` in its
`package.json` and `vitest` in its `devDependencies`; turbo picks the task up. Tests sit next to the source they cover
as `*.test.ts`.

## Deploy

`deploy.yml` (reusable) deploys one environment; `deploy-staging.yml` calls it after a green CI run for a push to
`main` (and only for `main`'s tip), and `deploy-production.yml` by hand, **Deploy Production** in the Actions tab or
`gh workflow run deploy-production.yml`. Production ships what staging runs unless given a `ref`.

- **Only what changed.** The deploy compares the commit with the environment's last full deploy (the
  `deployed/staging` or `deployed/production` tag), asks Turborepo which workspaces that reaches (`ci-plan.mjs`,
  `PLAN_MODE=deploy`) and deploys the ones with a `wrangler.toml`. A livedocuments Worker none of whose files or
  dependencies changed is left as it is.
- **Order.** Three tiers, each waiting for the one before: the apis (`livedocuments-api`), then the sites and MCP
  (`marketing`, `editor`, `help`, `mcp`), then the routers. So the editor never calls an api that lacks its routes, the
  mcp's binding to the api exists, and the router's four bindings exist when it deploys.
- **One Worker** (`deploy-worker.yml`): a static site builds first (its `out/`, with `NEXT_PUBLIC_BUILD_ID` and the
  hosted build vars); then `pnpm exec wrangler deploy`, with `--env staging` on staging and nothing on production. The
  api has no migration step: it has no D1, and each Durable Object makes its own schema on first use
  ([API app](../015-api/api.md) "Storage").
- **What a deploy writes.** Code and plain vars. Secrets are set on each Worker with `wrangler secret put` and survive
  a deploy ([Secrets policy](../002-project-scope/secrets-policy.md)).

Old and new versions briefly serve side by side while the tiers run. A Durable Object's schema change ships in its
code and applies on its next use, and a save that fails in the window is retried on its own
([Per-tab storage](../006-document/per-tab-storage.md#retrying-a-failed-save)). A problem after a deploy is fixed
forward, or rolled back by deploying an older `ref`, which redeploys every Worker.

## Hosted profile

Some configuration is what **livedocuments.app** runs with, not what the software defaults to. Committed `[vars]`
would make it every fork's default; a value set only in the Cloudflare dashboard would be wiped by the next
`wrangler deploy`, which replaces a worker's plain vars with exactly the ones it declares
([Staging environment](staging-environment.md) "Known sharp edge"). So it has a seam of its own: the **hosted
profile**.

- **What it holds.** `apps/api/hosted-vars.json`: `TELEMETRY_ENABLED = "true"` and, per environment,
  `TELEMETRY_URL` ([Telemetry](../017-telemetry/telemetry.md)) and `MEDIA_URL`, liveworkspace's media service, which
  keeps the images and their caps ([Images](../009-elements/images.md)). Its frontend mirror,
  `NEXT_PUBLIC_TELEMETRY_ENABLED`, is derived from it. Per-environment vars sit under `environments.production` and
  `environments.staging`, such as `APP_BASE_URL`, the canonical public origin links are built from
  (`https://www.livedocuments.app` in production, never the apex that redirects to it). An empty per-environment value
  is unset there.
- **How it is applied.** `deploy-worker.yml` applies it to a Worker that has `scripts/hosted-vars.mjs` (the api): the
  sites' builds take `node scripts/hosted-vars.mjs build-env`, and the api's deploy passes each var as
  `wrangler deploy --var NAME:VALUE` (`node scripts/hosted-vars.mjs flags`) with the environment's `--env`. A deploy
  run any other way, such as a fork's own `wrangler deploy`, takes the committed config alone: telemetry off, no caps.
- **How it is checked.** After the api deploy, `node scripts/hosted-vars.mjs verify` reads the plain vars off every
  version serving traffic and fails the run on any hosted var missing or different, or unset by its environment but
  still on the worker. In CI, `apps/api/src/hosted-vars.test.ts` fails when the profile stops turning telemetry on,
  names a var the worker does not read, or when `wrangler.toml` commits a hosted-only var as a default.

## Credentials

The workflows hold one credential, the repository secret **`CLOUDFLARE_API_TOKEN`**: a token for the liveworkspace
account with Workers Scripts edit rights (and Workers Routes edit on `livedocuments.app` to change a hostname).

The api's and mcp's secrets (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID`, `ACCOUNTS_CLIENT_SECRET`,
`INDEX_KEY`, `TELEMETRY_KEY`, `MEDIA_KEY` and the rest) are set on each Worker and environment with
`wrangler secret put`; [Secrets policy](../002-project-scope/secrets-policy.md) holds the full table.

## Custom domain

Only two workers have a hostname, each declared in its `wrangler.toml` as a Workers custom domain (`routes` with
`custom_domain = true`):

| Worker                         | Hostnames                                    |
| ------------------------------ | -------------------------------------------- |
| `livedocuments-router`         | `livedocuments.app`, `www.livedocuments.app` |
| `livedocuments-mcp`            | `mcp.livedocuments.app`                      |
| `livedocuments-router-staging` | `staging.livedocuments.app`                  |
| `livedocuments-mcp-staging`    | `mcp-staging.livedocuments.app`              |

`wrangler deploy` attaches each one, and Cloudflare creates its DNS record and certificate, so no hostname is a
dashboard step. `www.livedocuments.app` is attached because it is the canonical origin links are built from
(`APP_BASE_URL`). The other workers have no hostname: they are reached only over the router's (and the mcp worker's)
service bindings, and at their `*.workers.dev` URLs for direct testing. The router's paths are in
[Router app](router-app.md) "Routing table".

## Out of scope

- Preview deploys for pull requests: one environment tracking `main` is all there is
  ([Staging environment](staging-environment.md) "What staging is not").
