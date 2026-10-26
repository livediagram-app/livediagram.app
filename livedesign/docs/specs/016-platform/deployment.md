# Deployment

All deployments run **via GitHub Actions** from the liveworkspace monorepo's root `.github/workflows/` to **Cloudflare Workers** on the liveworkspace account ([docs/ci.md](../../../../docs/ci.md) "Deploys"). The **production** deploy is **manually triggered**: a green CI run never ships to production on its own.

There is a second environment, **staging**, which does deploy on its own: every green CI run on `main` lands on `staging.livedesign.app`. It runs the same steps through the same reusable workflow, against its own workers and its own Durable Objects, R2 buckets and KV. This spec covers production; [Staging environment](staging-environment.md) covers what staging changes and why.

## Apps and their Cloudflare Workers

| App              | Cloudflare Worker      | Type                                                                          |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------- |
| `apps/marketing` | `livedesign-marketing` | Static assets only (Next.js `output: 'export'`).                              |
| `apps/live`      | `livedesign-live`      | Static assets + a tiny path-rewrite worker.                                   |
| `apps/help`      | `livedesign-help`      | Static assets only (help centre, [Help app](../018-help/help-app.md)).        |
| `apps/api`       | `livedesign-api`       | Worker (Durable Objects + R2; no database of its own).                        |
| `apps/mcp`       | `livedesign-mcp`       | Worker (OAuth + MCP tools; own host, [MCP server](../015-api/mcp-server.md)). |
| `apps/router`    | `livedesign-router`    | Worker (service bindings to the other five).                                  |

The marketing worker serves files from `apps/marketing/out/` (`output: 'export'`). The live worker serves files from `apps/live/out/` plus a small worker (`apps/live/src/worker.ts`) that rewrites every `/design/<id>` request to the single statically-built `/design/placeholder/` page ([New design route](../007-editor/new-design-route.md)). The help worker is static-assets-only too, served under `/help` ([Help app](../018-help/help-app.md)). The api worker holds the REST + WebSocket layer ([API](../015-api/api.md)). The mcp worker exposes the AI tools over its own host `mcp.livedesign.app` (it binds to the api worker, not the router; [MCP server](../015-api/mcp-server.md)). The router holds **no application logic**: only `MARKETING`, `LIVE`, `HELP` and `API` service bindings that forward requests to the right downstream worker.

`wrangler.toml` for each app sits at the app root and is the source of truth for the worker's name, compatibility date, `[assets]`, `[[services]]`, R2 buckets, Durable Object bindings and their `[[migrations]]` tags, the account it deploys to (`account_id`, the liveworkspace account) and its public hostnames (see [Custom domain](#custom-domain)). Secrets **never** go in `wrangler.toml` ([Secrets policy](../002-project-scope/secrets-policy.md)).

## Toolchain

- **Node:** `>=22` (Wrangler 4 requires it); the root workflows pin Node 22.
- **pnpm:** `9.15.0`, one workspace and lockfile at the monorepo root.
- **Wrangler:** `^4.148.0`, the same in every workspace.
- **Asset size:** Workers Static Assets refuses any file over 25 MiB, and only at deploy. The editor's `build` ends with `scripts/asset-size-gate.mjs`, which fails the build on any file in `out/` over the limit, so CI catches it first.

## CI

The monorepo's root `.github/workflows/ci.yml` runs on every pull request and every push to `main`
([docs/ci.md](../../../../docs/ci.md)). A `plan` job asks Turborepo which workspaces the change reaches (the ones it
touched and everything depending on them) and groups them by product, so livedesign's jobs run only when a change
reaches livedesign. For livedesign's group:

- **Checks**: lint, type check and the format check.
- **Tests**: every workspace's tests, then `test:coverage` for those with it (enforcing the per-file coverage
  thresholds), uploading coverage to Codecov.
- **Editor unit tests**: the editor's suite (`apps/live`) under coverage, sharded
  ([Coverage report](../003-system-architecture/testing.md#coverage-report)).
- **Build**: every app's build, the CLI package's dry run, and `staging:check`.

`staging:check` runs `wrangler deploy --dry-run --env staging` for the three workers that carry bindings (api, mcp,
router). Wrangler does not inherit bindings into a named environment, so a binding missing from an `[env.staging]`
block, or a `service =` that lost its `-staging` suffix (pointing the staging router at **production**), is neither a
type error nor a test failure. Without this step the first sign of either is a deploy.

End-to-end suites run from the root `e2e.yml` through `e2e-product.yml` ([End-to-end tests](../003-system-architecture/e2e-smoke.md)),
and the canvas performance probe from the root `canvas-perf.yml` ([Canvas performance](../008-canvas/canvas-performance.md)).
The `livedesign/.github/` folder is not used.

**Testing** runs via [Vitest](https://vitest.dev). Workspaces opt in by adding `"test": "vitest run"` to their `package.json` scripts and `vitest` to their `devDependencies`; turbo then picks the task up automatically. Tests live next to the source they cover as `*.test.ts` files.

### Runs on main are never cancelled

CI and E2E cancel a run only on a pull request, where a newer push makes the older run moot. On `main` every commit runs to the end, each in a concurrency group of its own (keyed by the commit), because a shared group keeps only one pending run and a burst of merges would drop the middle ones: a failure could then not be pinned on its commit, and a pull request whose base had no finished run would have no Codecov base to compare against, failing its [Coverage report](../003-system-architecture/testing.md#coverage-report).

The cost is runner time: a burst of merges queues for runners alongside open pull requests' runs. Runs on `main` finishing out of order are handled by the staging deploy, which deploys only `main`'s tip ([Staging environment](staging-environment.md)).

## Deploy

One reusable workflow, the root `deploy.yml`, deploys an environment; `deploy-staging.yml` and
`deploy-production.yml` call it, so both environments run identical steps.

- **Staging** deploys when CI passes for a push to `main`.
- **Production** is manual: **Deploy Production** in the Actions tab, or `gh workflow run deploy-production.yml`. By
  default it ships exactly what staging runs (the `deployed/staging` tag); a `ref` ships another commit, and one
  older than production's own (a rollback) redeploys every Worker.

**Only what changed.** The plan compares the commit with the environment's `deployed/<environment>` tag, asks
Turborepo which workspaces that reaches, and deploys only those with a `wrangler.toml`. With no tag, with **all**, or
on a rollback, every Worker deploys. The tag moves only when every tier succeeded, so a failed Worker is retried
next time.

**Order.** Three tiers, each waiting for the one before: the services and apis (`livedesign-api`), then the sites
and the MCP Worker (`livedesign-marketing`, `livedesign-live`, `livedesign-help`, `livedesign-mcp`, which bind to the
api), then the router in front (`livedesign-router`, which binds to all four). A failing tier stops the ones after it.

**One Worker** (the root `deploy-worker.yml`): a static site builds with its build id (`NEXT_PUBLIC_BUILD_ID`, the
[stale-build](stale-builds.md) check) and the hosted build vars; then `wrangler deploy` (with `--env staging` on
staging); the api adds its hosted vars and checks them on the live deployment (see [Hosted profile](#hosted-profile)).

**Secrets** are not written by a deploy: each Worker's were set on it with `wrangler secret put` (`--env staging`
for staging) and survive every deploy. The only CI credential is `CLOUDFLARE_API_TOKEN`; every `wrangler.toml` pins
the account. The worker secrets are listed in [Secrets policy](../002-project-scope/secrets-policy.md).

### Durable Object migrations

The api worker keeps no database of its own. Each design's content lives in its own `DesignRoom` Durable Object (its own SQLite, beside its realtime room) and photo tiles in R2 (previews are liveworkspace's media service's); where every design is filed, and who may open it, is liveworkspace's index. So there is no schema migration to run before a deploy.

The Durable Object classes themselves are declared through `[[migrations]]` tags in `apps/api/wrangler.toml` (and again under `[env.staging]`, since migrations are not inherited), and `wrangler deploy` applies a new tag itself. A new class is a new tag with `new_sqlite_classes`. Renaming or deleting a class is a new tag too (`renamed_classes`, `deleted_classes`), never an edit to an existing one: deleting a class deletes every object's storage, so it ships to **staging first**. Each object's own SQLite tables are made by the class's code on first use (`apps/api/src/design-room/design-schema.ts` for a design).

### Old and new workers side by side

The apps' workers deploy separately, so for a minute or so old and new versions serve side by side. The deploy keeps that window short and recoverable:

- The api deploys a tier before the sites, so a new editor never calls an api that lacks its routes, and the
  router deploys last, after the four it binds.
- A save that fails in the window is retried on its own
  ([Per-tab storage](../006-design/per-tab-storage.md#retrying-a-failed-save)).

## Hosted profile

Some configuration is what **livedesign.app** runs with, not what the software defaults to. Committed `[vars]` would make it every fork's default; a value set only in the Cloudflare dashboard would be wiped by the next `wrangler deploy`, which replaces a worker's plain vars with exactly the ones it declares ([Staging environment](staging-environment.md) "Known sharp edge"). So it has a seam of its own: the **hosted profile**.

- **What it holds.** `apps/api/hosted-vars.json`: `TELEMETRY_ENABLED = "true"` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), the photo store cap `PHOTO_MAX_BYTES_PER_TAB = "536870912"` (512 MB, [Photo store](../031-photo/photo-store.md) "Limits") and, per environment, `MEDIA_URL`, liveworkspace's media service, which keeps the images and their caps ([Image element + per-owner gallery](../009-elements/images.md)). Its frontend mirror, `NEXT_PUBLIC_TELEMETRY_ENABLED`, is derived from it rather than stated twice. A few vars are **per environment**, under `environments.production` and `environments.staging`, such as `MEDIA_URL` and `APP_BASE_URL`: the canonical public origin that email, workbench and pairing links are built from (`https://www.livedesign.app` in production, never the apex that redirects to it; [Workbench embeds](../013-workspace/workbench-embeds.md)). An empty per-environment value is unset there.
- **Who gets it.** Every monorepo deploy of the api, production and staging, applies it: the plan marks a product api as hosted when it has `scripts/hosted-vars.mjs`. A deploy of the committed config alone (`wrangler deploy` without the flags) applies nothing, so it is **telemetry-off and uncapped**.
- **How it is applied.** On every deploy, not once: a site's build exports the frontend mirror (`node scripts/hosted-vars.mjs build-env`), and the api deploy passes each var as `wrangler deploy --var NAME:VALUE` (`node scripts/hosted-vars.mjs flags`), with `BUILD_ID`. Every command takes the environment as `--env staging` (none is production), so a deploy only ever applies its own environment's entries.
- **How it is checked.** After the api deploy, `node scripts/hosted-vars.mjs verify` reads the plain vars off every version serving traffic (`wrangler deployments status` + `wrangler versions view`) and fails the run on any hosted var that is missing or different, or that its environment leaves unset but the worker still holds. In CI, `apps/api/src/hosted-vars.test.ts` fails when the profile stops turning telemetry on, stops pointing each environment at its own media service, stops capping the photo store (by the worker's own cap parser), names a var the worker does not read, or when `wrangler.toml` commits a hosted-only var as a default.

## First deploy

With no `deployed/<environment>` tag yet, every Worker deploys, tier by tier, so each router's service-binding
targets exist before the router does. Later deploys are idempotent updates.

## Custom domain

Production lives at **`https://livedesign.app`**. Only two workers have a hostname, and each declares its own in its `wrangler.toml` as a Workers custom domain (`routes` with `custom_domain = true`), as liveworkspace's workers declare theirs:

| Worker                      | Hostnames                              |
| --------------------------- | -------------------------------------- |
| `livedesign-router`         | `livedesign.app`, `www.livedesign.app` |
| `livedesign-mcp`            | `mcp.livedesign.app`                   |
| `livedesign-router-staging` | `staging.livedesign.app`               |
| `livedesign-mcp-staging`    | `mcp-staging.livedesign.app`           |

`wrangler deploy` attaches each one, and Cloudflare creates its DNS record and certificate, so no hostname is a dashboard step and none can be forgotten. `www.livedesign.app` is attached because it is the canonical origin links are built from (`APP_BASE_URL`, [Hosted profile](#hosted-profile)). Changing a hostname needs **Zone → Workers Routes → Edit** on `livedesign.app` for the deploy token; a deploy that leaves them as they are needs only the Workers permission. The other workers have no hostname: they are reached only over the router's (and the mcp worker's) service bindings. From the router:

- `https://livedesign.app/api/*` → api worker (REST + WebSocket).
- `https://livedesign.app/live` and `https://livedesign.app/live/<anything>` → live editor (the router strips the `/live` prefix before forwarding).
- `https://livedesign.app/help` → help centre (prefix-stripped); `https://livedesign.app/telemetry` redirects to liveworkspace's telemetry dashboard ([Router app](router-app.md)).
- Everything else → marketing.

The workers themselves remain reachable at their default `*.workers.dev` URLs for direct testing.

## Not covered here

- Preview deploys for pull requests: staging, tracking `main`, is the one other environment ([Staging environment](staging-environment.md) "What staging is not").
- Rollback beyond `deploy-production.yml` with an older `ref`: `wrangler rollback` from the dashboard or CLI.
