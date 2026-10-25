# CI

The monorepo's checks live in the root `.github/`. GitHub reads workflows only from there, so the
`.github/` folders the products brought with them (`livediagram/.github/` and the others) are inert
here and kept only as a reference until the switch-over. Each product's own spec still describes what
its suites check (`docs/specs/016-platform/deployment.md` "CI" in each product).

## Only what changed

A run checks, tests and builds only what a change reaches. `.github/scripts/ci-plan.mjs` asks
Turborepo (`turbo ls --affected`) which workspaces the change touched, plus every workspace that
depends on one of them: a change to `packages/ui` reaches every product's editor, and a lockfile
change reaches the workspaces whose dependencies moved. It then groups them by product:

| Group         | Folders                       | Editor (sharded)        |
| ------------- | ----------------------------- | ----------------------- |
| livediagram   | `livediagram/`                | `@livediagram/editor`   |
| liveplanner   | `liveplanner/`                | `@liveplanner/editor`   |
| livedesign    | `livedesign/`                 | `@livedesign/live`      |
| livedocuments | `livedocuments/`              | `@livedocuments/editor` |
| platform      | `packages/`, `liveworkspace/` |                         |

A group the change never reached runs no jobs. The base is the pull request's base, or for a push to
`main` the commit before it. Everything runs when there is no base (a manual run, or a branch's first
push), or when the change touches something every workspace leans on without turbo seeing it as
theirs: `.github/`, the root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, a base `tsconfig`,
or the Prettier config.

Turbo's own cache (`.turbo/cache`) is kept between runs with GitHub's cache, saved on `main` only and
read by pull requests, so a workspace whose inputs haven't changed since `main`'s run replays its
result.

## Workflows

- **CI** (`ci.yml`), on every pull request and every push to `main`. Per group:
  - **Checks:** lint and type check of the affected workspaces, and a format check (each product's
    own `format:check`; the platform's Prettier over `packages/`, `liveworkspace/`, `docs/`,
    `.github/` and the root files).
  - **Tests:** every affected workspace's suite once. Those with `test:coverage` run that, so their
    per-file thresholds are enforced in CI; the rest run `test`. Coverage goes to Codecov, one flag
    per group, carried forward when a run doesn't reach that group (`codecov.yml`).
  - **Editor unit tests:** a product's editor, when reached, in three shards under coverage.
  - **Build:** the affected workspaces' builds (and what they build on), the CLI's `npm pack --dry-run`
    when the CLI is reached, and the staging wrangler config check.
  - **CI:** one job that fails when any of the above failed, and passes when nothing needed to run.
    It's the check to require on `main`.
- **E2E** (`e2e.yml`, calling `e2e-product.yml` per product), on every pull request and push to
  `main`, for each product whose editor a change reaches: six smoke shards, the sites audit and the
  signed-in specs, in Playwright's container, with Turbopack's build cache restored from `main`.
  **E2E** is its one result check.
- **Canvas performance** (`canvas-perf.yml`): each product's probe, nightly against `main`. A miss
  opens or updates that product's issue, **Canvas performance budget: <product>**.
- **Lucide re-vendor** (`lucide-revendor.yml`): on pull requests that change `packages/icons/package.json`.

Not carried over yet: CodeQL, which needs GitHub Advanced Security on this private repository (until then
GitHub refuses its upload; the workflow is in git history, removed in the commit "CI: CodeQL out until
Advanced Security is on"), the coverage report written into each pull request's description (it needs
Codecov set up for this repository, and its fixed upload count doesn't fit runs that upload only the
groups they reach), the CLI publishing and the MCP Registry listing.

## Deploys

Every Worker deploys from here, to the liveworkspace Cloudflare account its `wrangler.toml` pins:
each product's api, sites, MCP and router, and the platform's services, site and gateway.

- **Staging** follows `main` (`deploy-staging.yml`): when CI passes for a push to `main`, that commit
  deploys to every Worker's `[env.staging]`. A run for a commit `main` has already moved past is skipped,
  and the newer commit's run deploys both. Runs queue rather than cancel, so a deploy is never cut off
  halfway. It can also be run by hand, with **all** to redeploy every Worker.
- **Production** is a manual gate (`deploy-production.yml`): run **Deploy Production** from the Actions
  tab, or `gh workflow run deploy-production.yml`. By default it ships exactly what staging runs. A
  `ref` ships another commit; one older than production's own (a rollback) redeploys every Worker, as
  **all** does. Required reviewers on the `production` environment, if set in the repository's
  settings, add a second gate before anything deploys.

**Only what changed.** Each environment remembers the commit it last deployed in full, as the tag
`deployed/staging` or `deployed/production`. A deploy asks Turborepo which workspaces changed since
then, with everything depending on them, using the plan CI uses (`ci-plan.mjs`, `PLAN_MODE=deploy`).
The Workers among them build and deploy, and the rest are left as they are. A Worker none of whose
files or dependencies changed is never rebuilt or redeployed. A change to `.github/` or the Prettier
config alone deploys nothing. The tag moves only when every Worker in the deploy succeeded, so a
failed one is retried by the next deploy. With no tag yet, everything deploys.

**Order.** Three tiers, each waiting for the one before: the services and apis (with D1, migrations
apply before the code: `wrangler d1 migrations apply`), then the sites and MCP Workers, then the routers
and the gateway in front of them. A failing tier stops the ones after it.

**What a deploy writes.** Code and plain vars: a static site's build (with its build id and its
product's hosted build vars, and on staging its product's staging MCP address), built from full history for a help site, whose sitemap dates each article by its last commit, and a product api's
hosted vars (`apps/api/hosted-vars.json`, checked on the live deployment afterwards). Secrets are not
written: each Worker's were set on it with `wrangler secret put` and survive a deploy. The only
credential is the repository secret **`CLOUDFLARE_API_TOKEN`**: a token for the liveworkspace account
with Workers Scripts and D1 edit rights. livediagram.app itself, on its old account, still deploys from
its own repository until the migration's switch (docs/migration.md, step 7).
