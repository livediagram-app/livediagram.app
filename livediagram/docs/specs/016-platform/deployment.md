# Deployment

livediagram deploys from the liveworkspace monorepo's root `.github/` workflows to **Cloudflare Workers** in the liveworkspace Cloudflare account, which every `wrangler.toml` pins as `account_id` ([docs/ci.md](../../../../docs/ci.md) "Deploys"). The **production** deploy is **run by hand**: a green CI run never ships to production on its own.

There is a second environment, **staging**, which does deploy on its own: when CI passes for a push to `main`, that commit lands on staging. It runs the same reusable workflow against its own workers, Durable Objects and KV and liveworkspace's staging services. This spec covers what is livediagram's within that pipeline; [Staging environment](staging-environment.md) covers what staging changes and why.

## Apps and their Cloudflare Workers

| App              | Cloudflare Worker       | Type                                                                                                                                |
| ---------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apps/marketing` | `livediagram-marketing` | Static assets only (Next.js `output: 'export'`).                                                                                    |
| `apps/editor`    | `livediagram-editor`    | Static assets + a tiny path-rewrite worker.                                                                                         |
| `apps/help`      | `livediagram-help`      | Static assets only (help centre, [Help app](../018-help/help-app.md)).                                                              |
| `apps/community` | `livediagram-community` | Static assets plus a small worker for post metadata and the sitemap, bound to the api ([Community](../025-community/community.md)). |
| `apps/api`       | `livediagram-api`       | Worker (Durable Objects; no database or bucket of its own).                                                                         |
| `apps/mcp`       | `livediagram-mcp`       | Worker (OAuth + MCP tools; own host, [MCP server](../015-api/mcp-server.md)).                                                       |
| `apps/router`    | `livediagram-router`    | Worker (service bindings to marketing, editor, api, help and community).                                                            |

`apps/cli` is the npm CLI and deploys nowhere. Publishing is a manual step outside CI: the CLI goes to npm by hand, and the root `server.json` is listed on the official MCP Registry by hand ([MCP server §4.16](../015-api/mcp-server.md#416-registry-listing)). CI builds and packs the CLI on every run that reaches it (`npm pack --dry-run`, [docs/ci.md](../../../../docs/ci.md)).

The marketing worker serves files from `apps/marketing/out/` (`output: 'export'`). The editor worker serves files from `apps/editor/out/` plus a small worker (`apps/editor/src/worker.ts`) that rewrites every `/document/<id>` request to the single statically-built `/document/placeholder/` page; see [New document route](../007-editor/new-document-route.md). The help worker is static-assets-only too, served under `/help` ([55-help-app](../018-help/help-app.md)). The community worker serves its static export under `/community` with a small script (`apps/community/worker/index.ts`) that runs first for only the post page and the sitemap, reading from the api through an `API` service binding ([Community](../025-community/community.md) "Search engines"). The api worker holds the REST + WebSocket layer (see [11-api.md](../015-api/api.md)). The mcp worker exposes the AI tools over its own host `mcp.livediagram.app` (it binds to the api worker, not the router; see [62-mcp-server.md](../015-api/mcp-server.md)). The router holds **no application logic**: only `MARKETING`, `EDITOR`, `API`, `HELP` and `COMMUNITY` service bindings that forward requests to the right downstream worker, and `/telemetry` redirects to liveworkspace's dashboard ([Telemetry](../017-telemetry/telemetry.md)).

`wrangler.toml` for each app sits at the app root and is the source of truth for the worker's name, compatibility date, `[assets]`, `[[services]]`, Durable Object bindings and the account it deploys to (`account_id`, the liveworkspace account). Secrets **never** go in `wrangler.toml`: they are set on each worker with `wrangler secret put`. See [06-secrets-policy.md](../002-project-scope/secrets-policy.md).

## Toolchain

- **Node:** `>=22` (Wrangler 4 requires it). The root workflows pin Node 22.
- **pnpm:** `9.15.0`, one workspace and lockfile at the monorepo root, through `pnpm/action-setup` in the workflows.
- **Wrangler:** `^4.148.0` across the workspaces.
- **Asset size:** Workers Static Assets refuses any file over 25 MiB, and only at deploy. The editor's `build` ends with `scripts/asset-size-gate.mjs`, which fails the build on any file in `out/` over the limit, so CI catches it first. `@huggingface/transformers` stays on 3.x for this reason: 4.3.0 ships a 25.6 MiB onnxruntime wasm, and Dependabot ignores its majors.

## CI

The root `ci.yml` runs on every pull request and every push to `main`, and runs livediagram's group only when a change reaches `livediagram/` (or something every workspace leans on) ([docs/ci.md](../../../../docs/ci.md) "Only what changed"). For the livediagram group:

- **Checks**: lint and type check of the affected workspaces, and livediagram's own `format:check`.
- **Tests**: every affected workspace's suite once. Those with `test:coverage` run that, so their per-file thresholds are enforced; the rest run `test`. Coverage goes to Codecov under the `livediagram` flag.
- **Editor unit tests i/3**: `@livediagram/editor`'s suite (`apps/editor`) under coverage, a third of its files per job (`vitest run --coverage --shard=i/3`) ([Coverage report](../003-system-architecture/testing.md#coverage-report)). The root planner (`ci-plan.mjs`) keeps the editor out of the Tests job, so each suite runs exactly once, and derives the split from the manifests, so adding or removing a coverage script needs no CI edit.
- **Build**: the affected workspaces' builds, the CLI's `npm pack --dry-run` when the CLI is reached, and `staging:check`.
- **CI**: one job that fails when any of the above failed. It is the check `main` requires.

No job needs another's output: only the apps have a `build` script, and no workspace depends on an app, so checks and tests build nothing.

The two test steps run two packages at a time (`--concurrency=2`). Each package's Vitest already fills the runner's cores, and turbo's default fan-out on the 4-vCPU runner slowed the CPU-heavy `sticky-vision` suite about 70x, into timeouts.

CI is the gate you check before deploying to production, but it does **not** trigger that deploy: production is run by hand (see below). It **does** trigger the staging deploy, which runs when CI passes for a push to `main` ([Staging environment](staging-environment.md)).

`staging:check` runs `wrangler deploy --dry-run --env staging` for the three workers that carry bindings (api, mcp, router). Wrangler does not inherit bindings into a named environment, so a binding missing from an `[env.staging]` block, or a `service =` that lost its `-staging` suffix, pointing the staging router at **production**, is neither a type error nor a test failure. Without this step the first sign of either is a deploy.

The root `e2e.yml` runs livediagram's six smoke shards, its sites audit and its signed-in specs through `e2e-product.yml` when a change reaches the editor ([End-to-end tests](../003-system-architecture/e2e-smoke.md)).

The root `canvas-perf.yml` runs the canvas performance probe nightly against `main` ([Canvas performance](../008-canvas/canvas-performance.md)), skipping a night `main` has not moved. It never blocks anything: the budget table goes to the job summary, traces and screenshots to a 14-day artefact, and a miss opens or comments on one issue, **Canvas performance budget: livediagram**, which the first all-pass run closes. It needs no secrets, only `issues: write`.

CI runs no CodeQL scan ([docs/ci.md](../../../../docs/ci.md) says why).

**Testing** runs via [Vitest](https://vitest.dev). Workspaces opt in by adding `"test": "vitest run"` to their `package.json` scripts and `vitest` to their `devDependencies`; turbo then picks the task up automatically. Tests live next to the source they cover as `*.test.ts` files. Most workspaces are opted in (`pnpm turbo run test --dry` lists them); a workspace mirrors the pattern when it adds its first test.

### Runs on main are never cancelled

`ci.yml` and `e2e.yml` cancel a run only on a pull request, where a newer push makes the older run moot. On `main` every commit runs to the end, each in a concurrency group of its own (keyed by the commit), because a shared group keeps only one pending run and a burst of merges would still drop the middle ones. Cancelling there left most merges without a result (37 of 42 CI runs on `main` cancelled in the 11 hours to 2026-10-15), so a failure could not be pinned on its commit, and a pull request whose base had no finished run had no coverage to compare against in its [Coverage report](../003-system-architecture/testing.md#coverage-report).

The cost is runner time: a merge on `main` runs CI's jobs and E2E's for every group it reaches, so a burst of merges queues for runners alongside open pull requests' runs. Runs on `main` finishing out of order are handled by the staging deploy, which skips a commit `main` has moved past ([Staging environment](staging-environment.md)).

## Deploy

The root `deploy.yml` (reusable) deploys one environment, and two thin callers run it, so both environments run identical steps:

- `deploy-staging.yml` runs when CI passes for a push to `main`, and deploys that commit to every Worker's `[env.staging]`.
- `deploy-production.yml` is run by hand: **Deploy Production** in the Actions tab, or `gh workflow run deploy-production.yml`. By default it ships exactly what staging runs (the `deployed/staging` tag); a `ref` ships another commit.

**Only what changed.** Each environment remembers the commit it last deployed in full, as the tag `deployed/staging` or `deployed/production`. A deploy asks Turborepo which workspaces changed since then, with everything depending on them (`ci-plan.mjs`, `PLAN_MODE=deploy`), and builds and deploys the Workers among them. A livediagram Worker none of whose files or dependencies changed is left as it is. With no tag yet, with **all**, or on a rollback, every Worker deploys. The tag moves only when every Worker succeeded, so a failed one is retried by the next deploy.

**Order.** Three tiers, each waiting for the one before, and a failing tier stops the ones after it:

1. **Services and apis**: `livediagram-api`.
2. **Sites and MCP**: `livediagram-marketing`, `livediagram-editor`, `livediagram-help`, `livediagram-community` and `livediagram-mcp`, so a new editor never calls an api that lacks its routes, and the community's and mcp's bindings to the api exist.
3. **Routers**: `livediagram-router`, whose service bindings target the five workers above.

**One Worker** (the root `deploy-worker.yml`): a static site builds first (its `out/`, with `NEXT_PUBLIC_BUILD_ID`, the [stale-build](stale-builds.md) check, and the hosted build vars; on staging, the staging MCP origin too). Then `pnpm exec wrangler deploy`, with `--env staging` on staging and nothing on production; the api adds its hosted vars and `BUILD_ID` and checks them on the live deployment (see [Hosted profile](#hosted-profile)).

**What a deploy writes.** Code and plain vars. Secrets are set on each Worker with `wrangler secret put` and survive a deploy (see [Credentials and secrets](#credentials-and-secrets)).

### Old and new versions overlap

There is no database migration step: each Durable Object makes its own schema the first time it is used. The apps' workers deploy separately, so old and new versions briefly serve side by side. The deploy keeps that window short and recoverable:

- The api deploys a tier before the editor, so a new editor never calls an api that lacks its routes, and the router deploys last, after the five it binds.
- The editor serves its old address during the overlap ([Router app](router-app.md#legacy-editor-route)), and a save that fails in the window is retried on its own ([Per-tab storage](../006-document/per-tab-storage.md#retrying-a-failed-save)).

## Hosted profile

Some configuration is what **livediagram.app** runs with, not what the software defaults to. Committed `[vars]` would make it every fork's default; a value set only in the Cloudflare dashboard would be wiped by the next `wrangler deploy`, which replaces a worker's plain vars with exactly the ones it declares ([Staging environment](staging-environment.md) "Known sharp edge"). So it has a seam of its own: the **hosted profile**.

- **What it holds.** `apps/api/hosted-vars.json`: `TELEMETRY_ENABLED = "true"` and, per environment, `TELEMETRY_URL` ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)), `COMMUNITY_URL` ([Community](../025-community/community.md)), `INDEX_ORIGIN` and `MEDIA_URL`, liveworkspace's media service, which keeps the images and their caps ([Image element + per-owner gallery](../009-elements/images.md)). Its frontend mirrors, `NEXT_PUBLIC_TELEMETRY_ENABLED`, `NEXT_PUBLIC_TELEMETRY_URL` and `NEXT_PUBLIC_COMMUNITY_API`, are derived from it rather than stated twice. The per-environment vars sit under `environments.production` and `environments.staging`, with `APP_BASE_URL`: the canonical public origin that email, workbench and pairing links are built from (`https://www.livediagram.app` in production, never the apex that redirects to it, and its stand-in address while the zone is elsewhere, [Stand-in addresses](stand-in-addresses.md); [Workbench embeds](../013-workspace/workbench-embeds.md)). An empty per-environment value is unset there.
- **Who gets it.** Every monorepo deploy, production and staging: the deploy plan marks a Worker hosted when its app has `scripts/hosted-vars.mjs`, which only the api has, and each livediagram site's build reads the same file for its frontend mirrors. A deploy of the committed config alone (a fork's own `wrangler deploy`) applies nothing, so it is **telemetry-off and uncapped** until it opts in by declaring the vars in its own `[vars]`.
- **How it is applied.** On every deploy, not once: a site's build exports the frontend mirrors (`node scripts/hosted-vars.mjs build-env`), and the api deploy passes each var as `wrangler deploy --var NAME:VALUE` (`node scripts/hosted-vars.mjs flags`). Every command takes the environment as `--env staging` (none is production), so a deploy only ever applies its own environment's entries.
- **How it is checked.** After the api deploy, `node scripts/hosted-vars.mjs verify` reads the plain vars off every version serving traffic (`wrangler deployments status` + `wrangler versions view`) and fails the run on any hosted var that is missing or different, or that its environment leaves unset but the worker still holds. In CI, `apps/api/src/hosted-vars.test.ts` fails when the profile stops turning telemetry on, points an environment at another media service, names a var the worker does not read, or when `wrangler.toml` commits a hosted-only var as a default.

`AI_ALLOWED_ORIGINS` is deliberately **not** in the profile. It names livediagram.app's origins but fails closed, so a fork that forgets to change it gets an AI endpoint that refuses its own origin rather than one open to every page.

## Credentials and secrets

The only credential the workflows hold is the repository secret **`CLOUDFLARE_API_TOKEN`**, a token for the liveworkspace account ([docs/ci.md](../../../../docs/ci.md) "Deploys"). Every `wrangler.toml` pins the account, so no account id is passed.

A deploy writes code and plain vars only. Each Worker's secrets (`ACCOUNTS_URL`, `API_RESOURCE`, `ACCOUNTS_CLIENT_ID` and `ACCOUNTS_CLIENT_SECRET` on the api; `TELEMETRY_KEY` on the api **and** mcp, the same value on both; `COMMUNITY_KEY`, `MEDIA_KEY`, `DRIVE_KEY` and the model key, `GOOGLE_AI_STUDIO_API_KEY` / `AI_API_KEY`, on the api) are set on it with `wrangler secret put` (with `--env staging` for staging) and survive every deploy. A value rotates by putting the new one on the worker. [Secrets policy](../002-project-scope/secrets-policy.md) holds the full table.

## Custom domain

Production is **`https://www.livediagram.app`**. The `livediagram.app` zone is still on the previous Cloudflare account, so the router and mcp workers have no custom domain yet, and livediagram answers on their `workers.dev` addresses instead ([Stand-in addresses](stand-in-addresses.md)). When the zone moves, each declares its hostnames in its `wrangler.toml` as a Workers custom domain (`routes` with `custom_domain = true`), as liveplanner's do, and `wrangler deploy` attaches them.

From the router:

- `/api/*` → api worker (REST + WebSocket).
- `/live` and `/live/<anything>` → the editor (the router strips the `/live` prefix before forwarding).
- `/help` → help centre; `/community` → Community (both prefix-stripped).
- `/telemetry` → a 301 to liveworkspace's telemetry dashboard, `https://www.liveworkspace.app/telemetry?app=livediagram.app`.
- Everything else → marketing.

The other workers have no hostname: they are reached only over the router's (and the mcp worker's) service bindings, and at their `*.workers.dev` URLs for direct testing.

## Rollback

A rollback is **Deploy Production** with an older `ref`: a commit older than production's own redeploys every Worker, as **all** does.

## Out of scope

- Preview deploys for pull requests: one environment tracking `main` is all there is ([Staging environment](staging-environment.md) "What staging is not").
