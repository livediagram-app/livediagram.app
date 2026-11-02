# CI

The monorepo's checks live in the root `.github/`. GitHub reads workflows only from there, so the
`.github/` folders the products brought with them (`livediagram/.github/` and the others) are inert
here. Each product's own spec describes what its suites check (`docs/specs/016-platform/deployment.md` "CI" in each product).

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
`main` the commit before it. Everything runs when there is no base to compare with, or when the
change touches something every workspace leans on without turbo seeing it as theirs: `.github/`, the
root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.npmrc` or the
Prettier config and ignore file, or a product folder's own `package.json`, `tsconfig.base.json` or
Prettier files.

### Suites that read other workspaces

Some suites read files outside their own workspace from disk: the site's telemetry checks scan every
product's apps and packages, each help app's guards read its whole product, the shared marketing guards
read every marketing app, and livedesign's naming guard (`@livedesign/design`) reads all of `livedesign/`,
the apps that depend on it included. Turbo's package graph can't see those reads, so before 2026-10-31 a
pull request touching only `liveplanner/` never ran the site's suite: it passed, and `main` went red at
the next change that did reach the site.

Each such suite declares what it reads as `$TURBO_ROOT$/…` inputs on its `<workspace>#test` and
`<workspace>#test:coverage` tasks in `turbo.json`. That one declaration does two jobs: turbo's cache
hashes those files, so it never replays a stale pass, and the planner (`.github/scripts/ci-readers.mjs`)
adds the suite to a run whose changed files fall in them. **A new test that reads outside its
workspace adds its inputs there**, or it will pass on its pull request and fail on `main`.

Turbo's own cache (`.turbo/cache`) is kept between runs with GitHub's cache, saved on `main` only and
read by pull requests, so a workspace whose inputs haven't changed since `main`'s run replays its
result.

## Workflows

- **CI** (`ci.yml`), on every pull request and every push to `main`. Per group:
  - **Checks:** lint and type check of the affected workspaces, and a format check (each product's
    own `format:check`; the platform's Prettier over `packages/`, `liveworkspace/`, `docs/`,
    `.github/` and the root files).
  - **Speed budgets:** a change may not add `performance.now()` to a test (see [Speed budgets](#speed-budgets)).
  - **Tests:** every affected workspace's suite once. Those with `test:coverage` run that, so their
    per-file thresholds are enforced in CI; the rest run `test`. Coverage goes to Codecov, one flag
    per group, carried forward when a run doesn't reach that group (`codecov.yml`).
  - **Editor unit tests:** a product's editor, when reached, in three shards under coverage.
  - **Build:** the affected workspaces' builds (and what they build on), the CLI's `npm pack --dry-run`
    when the CLI is reached, and the staging wrangler config check.
  - **Coverage report** (pull requests only): writes the coverage report into the pull request's
    description (below). Not part of the CI check.
  - **CI:** one job that fails when any of the above failed, and passes when nothing needed to run.
    It's the check to require on `main`.
- **E2E** (`e2e.yml`, calling `e2e-product.yml` per product), on every pull request and push to
  `main`, for each product whose editor a change reaches: six smoke shards, the sites audit and the
  signed-in specs, in Playwright's container, with Turbopack's build cache restored from `main`.
  **E2E** is its one result check.
- **Canvas performance** (`canvas-perf.yml`): each product's probe, nightly against `main`. A miss
  opens or updates that product's issue, **Canvas performance budget: <product>**.
- **Lucide re-vendor** (`lucide-revendor.yml`): on pull requests that change `packages/icons/package.json`.
- **Dependency updates** (`dependabot.yml`): Dependabot, weekly, for the npm tree (one lockfile for every
  product) and the actions. Minor and patch bumps come grouped, dev apart from production; each major
  comes on its own. It carries the products' own rules, such as livediagram's hold on the
  `@huggingface/transformers` major.

- **Deploys** (`deploy-staging.yml` and `deploy-production.yml`, both calling `deploy.yml`, which calls
  `deploy-worker.yml` per Worker): see [Deploys](#deploys).

- **CodeQL** (`codeql.yml`): one Analyze job scans the whole repository (Actions and
  JavaScript/TypeScript) on every pull request, every push to `main` and weekly on Mondays, so newly
  released queries also run against an unchanged `main`. It is an advanced setup, so the repository's
  CodeQL default setup stays off, or GitHub rejects the upload. The `main` ruleset requires its results.

- **MCP Registry** (`mcp-registry.yml`): only by hand (`workflow_dispatch`), never on a push. It publishes the
  chosen product's `server.json` (livediagram, liveplanner, livedocuments or livedesign) to the official MCP
  Registry, signed in with the repository's GitHub OIDC token, which proves the `io.github.livediagram-app`
  namespace every product lists under; no secret. Each product's MCP spec, "Registry listing", says what the
  descriptor holds.

CI publishes no CLI: the CLIs' npm publishing happens outside CI. Each product's CLI builds and
packs on every run that reaches it (Build).

## Speed budgets

A test that holds code to a speed budget measures CPU time, with `cpuMsOf` / `cpuMsOfAsync` and
`cpuBudgetMs` from `@liveworkspace/vitest-config/cpu-time`, never `performance.now()`. CI's runners
are shared two-core machines running several suites at once: a wall-clock budget counts the time a
test waits for a core and failed at random on `main`, where CPU time barely moves under contention and
still catches a real regression. A test that seeds a large fixture sets its own timeout (seeding isn't
what it measures) and times only the work under test.

The Checks job's **Speed budgets use CPU time** step (`.github/scripts/cpu-budget-guard.mjs`, also in
the pre-push hook) fails a change that adds `performance.now()` to a test file. Older budgets are left
for a pass of their own. A line that truly needs the wall clock says why in a `wall-clock:` comment.

## Coverage report

Each pull request gets a coverage report in its description, below a `---` separator between two hidden
markers (`<!-- liveworkspace:coverage-report:start -->` and `…:end -->`). A description edit notifies no
one, where a comment emails every watcher. Each run replaces only that section and keeps the author's
text around it; an unchanged report writes nothing.

- **Where the numbers come from:** CI's own lcov files, not a coverage service, so it works on a
  private repository. The Tests job (`test:coverage` workspaces) and each editor shard keep their
  `lcov.info` files as artifacts, `coverage-<group>-tests` and `coverage-<group>-editor-<shard>`, for 30
  days. Codecov still receives its uploads, but the report doesn't depend on them.
- **What it shows:** patch coverage (the lines the pull request adds, from `git diff` against its
  base, matched to the lcov lines of the merge commit the run tested), and one row per product the
  run reached: `main`, the pull request and the change, plus how many lines aren't covered.
- **The base:** for each artifact the pull request's run kept, the newest run on `main` that kept the
  same one (a run on `main` keeps only the groups it reached), so a product is compared like with
  like. A product with no run on `main` within 30 days shows `n/a`.
- **How it runs:** the `coverage-report` job in `ci.yml`, after Tests and the editor shards,
  `.github/scripts/coverage-report.mjs`. It informs and never gates: it isn't part of the **CI** check
  and its failure never fails a pull request. `COVERAGE_REPORT_DRY_RUN=1` with `BASE_DIR` prints a
  report from local artifact folders; its pure parts are tested by `node --test
.github/scripts/*.test.mjs`, which the platform's Checks run.

## Before a push

A **pre-push hook** runs, for what a push changes, what CI's Checks and Tests jobs would fail on, so a
deterministic failure shows up on the machine in minutes rather than on CI later.

- `pnpm install` installs it: the root `prepare` script runs `scripts/git-hooks/install.mjs`, which
  points `core.hooksPath` at the tracked `.githooks/` (for every worktree of the repository). It skips,
  saying so, when `CI` is set or outside a git work tree.
- `.githooks/pre-push` runs `scripts/git-hooks/pre-push.mjs`. It takes the merge base with
  `origin/main`, asks CI's planner (`ci-plan.mjs`) which groups the change reaches, and runs each
  group's steps as `ci.yml` does: lint and type check, the format check, the speed-budget guard, `test`, `test:coverage`, then
  each reached editor's suite once (unsharded). It stops at the first failing step.
- It checks only a push of the checked-out `HEAD`; a push of any other commit, a tag or a deletion
  passes and is left to CI. Nothing changed since the merge base also passes.
- One run at a time on the machine: a push made while another's checks are running skips its own and
  says so, since parallel runs overload it.
- It finds `pnpm` (which turbo needs) through corepack shims in the temp directory when `pnpm` isn't on
  `PATH`. `git push --no-verify` skips it; CI still runs everything, E2E included.
- A change to something every workspace leans on (`.github/`, the root config) reaches everything, as
  on CI, so that push runs the whole repository's checks; turbo's cache replays what hasn't changed.

## Deploys

Every Worker deploys from here, to the liveworkspace Cloudflare account its `wrangler.toml` pins:
each product's api, sites, MCP and router, and the platform's services and site.

- **Staging** follows `main` (`deploy-staging.yml`): when CI passes for a push to `main`, the newest
  commit on `main` whose CI passed deploys to every Worker's `[env.staging]`, whichever run finished, so
  a steady stream of merges never holds staging back. A run is skipped only when staging already runs
  that commit or a newer one. Runs queue rather than cancel, so a deploy is never cut off halfway. It can also be run by hand, with **all** to redeploy every Worker. A run by hand skips the
  check for `main`'s tip and deploys the head of the branch it was started on, moving
  `deployed/staging` there, so production's default then ships that commit.
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

**Order.** Three tiers, each waiting for the one before: first each product's api and every
liveworkspace Worker but the site (with D1, migrations apply before the code: `wrangler d1 migrations
apply`), then the sites and MCP Workers, then the routers in front of them. Two exceptions
(`TIER_OF` in `ci-plan.mjs`): accounts deploys with the sites, once every Worker that checks its tokens
accepts the issuer it signs with, and liveworkspace's bare-domain redirect with the routers, once
`www.` answers. A failing tier stops the ones after it.

**What a deploy writes.** Code and plain vars: a static site's build (with its build id and its
product's hosted build vars, and on staging its product's staging MCP address), built from full history for a help site, whose sitemap dates each article by its last commit, and a product api's
hosted vars (`apps/api/hosted-vars.json`, checked on the live deployment afterwards). Secrets are not
written: each Worker's were set on it with `wrangler secret put` and survive a deploy. The only
credential is the repository secret **`CLOUDFLARE_API_TOKEN`**: a token for the liveworkspace account
with Workers Scripts and D1 edit rights.
