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
| livehuddle    | `livehuddle/`                 | `@livehuddle/editor`    |
| platform      | `packages/`, `liveworkspace/` |                         |

A group the change never reached runs no jobs. A product forked in-tree before its launch can be **held**
(`held: true` on its group in `ci-plan.mjs`): its group then runs only when a change touches its folder itself or
everything runs, never because a shared package it uses changed (its E2E the same way), and none of its Workers
deploy. None is held today: livehuddle was until its launch (Work Tracker #189), and now runs, tests, runs its E2E
and deploys like any product. Every product's nightly canvas probe runs, livehuddle's included. The base is the pull request's base, or for a push to
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

### Cache pruning

Every run on `main` saves its turbo and Next build caches under a key ending in its commit, and a
restore takes the newest of each family, so the older copies are never read again. They still count
against the repository's 10 GB of cache storage, and past it GitHub evicts the least recently used
caches of every family: on 2026-11-06 the repository held 10.65 GB, 6.04 GB of it superseded copies.
**Cache prune** (`cache-prune.yml`) runs `.github/scripts/cache-prune.mjs` whenever CI or E2E finishes
on `main`, and deletes every cache a newer one of the same family (key without its commit, on the same
ref) replaced. A key without a commit, such as setup-node's pnpm store, is never touched. It runs
`main`'s own script and checks out nothing else, so its `actions: write` never meets a pull request's
code.

## Runs on main

CI, E2E and CodeQL keep one run per branch. On a pull request, a newer push cancels the older run. On
`main`, a run that has started always finishes: a newer push waits behind it, and a still newer one
replaces the one waiting, so at most one run runs and one waits. A run started by hand is never
cancelled. So that the commits a replaced run skipped are still checked, a push to `main` plans against
the newest commit that workflow last passed on `main` (`.github/scripts/main-base.mjs`), not the commit
just before it, and with no such commit everything runs. A failure on `main` is therefore pinned on the
commits since the last green one. Until 2026-11-06 every commit on `main` ran to the end, and a burst of
merges kept jobs waiting a median 16 minutes for one of the free plan's 20 runners. For an hour after
that, a push to `main` cancelled the run in progress, and with merges landing faster than a run takes
no run on `main` finished, so staging never deployed; letting the running one finish ends that (each
product's `docs/specs/016-platform/deployment.md` "Runs on main cancel older ones").

## Fail fast

On a pull request, a commit that is already red stops spending runners. Over the 80 pull request
commits before 2026-11-06, 1,527 of their 9,248 CI and E2E runner minutes (17%) ran after one of
their jobs had already failed.

- **The step.** Every job of CI and E2E that checks out (Plan, Checks, Tests, the editor shards and
  Build in `ci.yml`; Plan in `e2e.yml`; each product's smoke build, smoke shards, sites audit and
  signed-in specs in `e2e-product.yml`) ends with **Cancel on failure**
  (`.github/actions/cancel-on-failure`), run only `if: failure() && github.event_name ==
'pull_request'`. It runs on the runner that just failed, so it starts at once; a job of its own
  would wait for everything it watched and then queue for a runner. It calls
  `.github/scripts/cancel-on-failure.mjs`, which lists the commit's unfinished pull request runs of
  `ci.yml` and `e2e.yml` (by the pull request's head commit) and cancels them. It never fails the job
  further, and on a fork's read-only token it logs and does nothing.
- **Never its own run.** Cancelling the run it is in would also stop that run's other jobs, but GitHub
  then records the failing job itself as `cancelled`, not `failure`: a probe on pull request #1356 (a
  job that failed a step and then cancelled its own run) came out `cancelled`, as did the run. That
  hides the red, so the step cancels only the other workflow: CI's failure cancels E2E, E2E's cancels
  CI. The failing workflow's other jobs run to the end, which also means each of them still reports
  its own failures.
- **The required checks stay red.** A cancelled run's **CI** or **E2E** gate still runs (`if:
always()`, seen in the probe) and fails on the `cancelled` jobs it needs, so a red pull request
  never looks mergeable.
- **Reruns.** `gh run rerun --failed` (and **Re-run failed jobs**) reruns a run's cancelled jobs as
  well as its failed ones (seen in the probe). A retry without a fix reruns the failed jobs of both
  workflows, the cancelled one included.
- **Only pull requests.** A push to `main`, a run by hand and the deploys always run to the end: the
  step's `if:`, the action's own `if:` and the script each check the event.
  `.github/scripts/cancel-on-failure.test.mjs` holds the step as the last of every such job, guarded
  to pull requests, with `actions: write` granted (the jobs' own `permissions`, and `e2e.yml`'s calls
  of `e2e-product.yml`, which can grant no more than its callers). Exempt: the **CI** and **E2E**
  gates, and the coverage report, whose failure never gates. A same-repository pull request's jobs
  already run code its author can push, and a fork's token stays read-only, so `actions: write` opens
  nothing new.
- **The trade-off.** A commit with two separate failures, one in each workflow, shows only the first
  until it runs again: in the sample 4 of 24 red commits had two, 3 of them from a breakage on `main`
  since fixed.

## Workflows

- **CI** (`ci.yml`), on every pull request and every push to `main`. Its Plan job also writes the
  [Drift report](#drift-report) between livediagram and livehuddle to the run's summary, as
  information. Per group:
  - **Checks:** lint and type check of the affected workspaces, and a format check (each product's
    own `format:check`; the platform's Prettier over `packages/`, `liveworkspace/`, `docs/`,
    `.github/` and the root files).
  - **Speed budgets:** a change may not add `performance.now()` to a test (see [Speed budgets](#speed-budgets)).
  - **Copies across products:** a change may not add a source file byte-identical in two or more products
    (see [Copies across products](#copies-across-products)).
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
  `main`, for each product whose editor a change reaches: one smoke build shared by the smoke shards (three for livediagram, whose smoke specs take about three minutes a shard; two for the others, whose shards take about a minute and a half on three), the sites audit and the
  signed-in specs, in Playwright's container, with Turbopack's build cache restored from `main`.
  **E2E** is its one result check.
- **Canvas performance** (`canvas-perf.yml`): each product's probe, nightly against `main`. A miss
  opens or updates that product's issue, **Canvas performance budget: <product>**.
- **Cache prune** (`cache-prune.yml`): after CI or E2E on `main`, deletes the superseded caches (see
  [Cache pruning](#cache-pruning)).
- **Lucide re-vendor** (`lucide-revendor.yml`): on pull requests that change `packages/icons/package.json`.
  One job installs (with `--ignore-scripts`) and regenerates under a read-only token; a second, which installs
  nothing, applies only the two generated files and holds the write token in its last step alone.
- **Dependency updates** (`dependabot.yml`): Dependabot, weekly, for the npm tree (one lockfile for every
  product) and the actions. Minor and patch bumps come grouped, dev apart from production; each major
  comes on its own. It carries the products' own rules, such as livediagram's hold on the
  `@huggingface/transformers` major.

- **Deploys** (`deploy-staging.yml` and `deploy-production.yml`, both calling `deploy.yml`, which calls
  `deploy-group.yml` once per group of Workers): see [Deploys](#deploys).

- **CodeQL** (`codeql.yml`): one Analyze job scans the whole repository (Actions and
  JavaScript/TypeScript) but its test code, on every pull request, every push to `main` and weekly on Mondays, so newly
  released queries also run against an unchanged `main`. It is an advanced setup, so the repository's
  CodeQL default setup stays off, or GitHub rejects the upload. The `main` ruleset requires its results.
  The job may run for 60 minutes: since the livehuddle fork a full analysis takes 21 to over 30, and a run
  cancelled at its limit leaves the PR's required CodeQL result missing until it runs again.
  `.github/codeql/codeql-config.yml` leaves out the unit tests and e2e specs (37% of the code it read,
  measured 2026-11-06): they never ship, and their alerts don't block a merge. It keeps the default
  query suite, which GitHub's incremental pull request analysis needs; that analysis is behind a GitHub
  feature flag not yet on for this repository (the log says `overlay database mode: none`), and the
  action turns it on by itself once it is. GitHub's separate Code Quality scan (a second CodeQL run of
  11 to 21 minutes on every push) was turned off on 2026-11-06 to free runners: the `main` ruleset no
  longer requires it.

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
for a pass of their own, and so is a copy of one: a line another product already has at the same path
(a fork, such as livehuddle's of livediagram) isn't new. A line that truly needs the wall clock says why
in a `wall-clock:` comment.

## Copies across products

The five products were forked from one another, and code two or more of them need belongs in `packages/`
as `@liveworkspace/*` ([structure.md](structure.md), "Getting there, safest first"). The Checks job's **No
new copies across products** step (`.github/scripts/duplicate-guard.mjs`, also the pre-push hook's first
step) lists the non-test source files (`.ts`, `.tsx`, `.js`, `.mjs` and the rest) that are byte-identical
in two or more of `livediagram/`, `liveplanner/`, `livedocuments/`, `livedesign/` and `livehuddle/`, and
compares them with the committed baseline, `.github/scripts/duplicate-baseline.txt` (the copies that
existed when it came in, one group per line). It leaves out generated files, each workspace's tool configs
(`oxlint.config.ts`, `vitest.config.ts` and the like, a few lines over the shared config packages that every
new package carries) and a product's thin binding, a file whose only statements are
`export … from '@liveworkspace/…'`, since that is how a move ends.

- **It fails** when a group appears that the baseline doesn't hold, or a baseline group gains a copy, and
  names the files: move the module to a package instead of copying it.
- **It also fails** when a baseline group no longer exists as listed: moved to `packages/`, changed in one
  product only, renamed or deleted. Run `node .github/scripts/duplicate-guard.mjs --update` and commit the
  smaller baseline, so it stays tight. A removal that deletes one copy of a group (a feature leaving a
  product) needs that `--update` too.
- **The baseline only shrinks:** `--update` refuses to write while there is a new group or a new copy.
- It reads blob hashes from the index (`git ls-files -s`) and opens one copy per identical group, to spot
  a binding: about 0.1 seconds on the whole repository (1,300 files in 450 groups). Its tests run with
  `node --test .github/scripts/*.test.mjs`.

## Drift report

livehuddle was forked in-tree from livediagram and both carry the meeting kit (Avatar mode, the Spaces,
the Timer, the quick vote, Bring Focus), so the two copies drift as each changes on its own. The rest
of Workshop mode leaves livehuddle with Work Tracker #423, and its files move to "only in livediagram"
as that card's parts land. The Plan job's **Drift report** step (`.github/scripts/drift-report.mjs`)
compares `livediagram/` and `livehuddle/` file by file, with the product names ignored (`livediagram`
and `livehuddle` in any case, in paths and contents, read as one word), and writes to the run's
summary how many files are identical, changed or in one product only, per app and package, with
`docs/specs` and the rest of `docs` as rows of their own. It reads only the files git tracks, each
once (about 11,000 files in about 0.4 seconds), and it informs and never gates: it always exits 0 and
the step has `continue-on-error`. The owner reads it to pick the next extraction to `packages/`
(livehuddle's [Build plan](../livehuddle/docs/specs/005-project-roadmap/build-plan.md#keeping-the-two-products-from-drifting));
both products' AGENTS.md list the features they share. Locally: `node .github/scripts/drift-report.mjs`.

## Coverage report

Each pull request gets a coverage report in its description, below a `---` separator between two hidden
markers (`<!-- liveworkspace:coverage-report:start -->` and `…:end -->`). A description edit notifies no
one, where a comment emails every watcher. Each run replaces only that section and keeps the author's
text around it; an unchanged report writes nothing.

- **Where the numbers come from:** CI's own lcov files, not a coverage service, so it works on any
  repository, public or private. The Tests job (`test:coverage` workspaces) and each editor shard keep their
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
  group's steps as `ci.yml` does: the copies guard (once), lint and type check, the format check, the speed-budget guard, `test`, `test:coverage`, then
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
  check for `main`'s tip and deploys the head of the branch it was started on, recording it as what
  staging runs, so production's default then ships that commit.
- **Production** is a manual gate (`deploy-production.yml`): run **Deploy Production** from the Actions
  tab, or `gh workflow run deploy-production.yml`. By default (**Deploy Staging Tip**) it ships
  exactly what staging runs; **Deploy Latest Main** ships `main`'s tip instead, to move faster than
  staging (`gh workflow run deploy-production.yml -f source='Deploy Latest Main'`). A `ref` ships
  another commit instead of either; one older than production's own (a rollback) redeploys every Worker, as
  **all** does. Required reviewers on the `production` environment, if set in the repository's
  settings, add a second gate before anything deploys.

**Only what changed.** Each environment remembers the commit it last deployed in full, as a GitHub
deployment of that commit to the `staging` or `production` environment with the task `record` and a
`success` status (`deploy-record.mjs`, which every reader goes through). A deploy asks Turborepo which workspaces changed since
then, with everything depending on them, using the plan CI uses (`ci-plan.mjs`, `PLAN_MODE=deploy`).
The Workers among them build and deploy, and the rest are left as they are; a held product's Workers (none today)
are never among them, even with **all**. A Worker none of whose
files or dependencies changed is never rebuilt or redeployed. A change to `.github/` or the Prettier
config alone deploys nothing. The record is written only when every Worker in the deploy succeeded, so a
failed one is retried by the next deploy. With no record yet, everything deploys.

- **Why a deployment, not a tag.** Until 2026-11-06 the record was the tag `deployed/<environment>`,
  force-pushed with the workflow's `GITHUB_TOKEN`. GitHub refuses that token a ref update it counts as
  changing a file under `.github/workflows/`, and the token can never hold the `workflows` permission:
  production's run of that day deployed its Workers, then went red at the tag. A deployment is not a
  ref, so it never meets that check; the record job needs only `deployments: write`.
- **Not the environment's own deployments.** The plan job names the environment (for its reviewers),
  so GitHub also records a deployment there, of the workflow's commit with the task `deploy`, marked a
  success once the plan finishes. That is neither the commit deployed nor proof the Workers deployed,
  so the readers take only `record` deployments: the newest one with a `success` status among its
  statuses (a newer deployment can mark it `inactive` afterwards).
- **The old tags.** A reader that finds no `record` deployment for an environment falls back to its
  `deployed/<environment>` tag, so the first deploy after the switch still plans from the right
  commit. Nothing moves the tags any more; once both environments have a record they are history.
- **A failed record is a warning, not a red run.** The Workers have deployed by then, so the record
  job never fails the run: it writes a warning and the summary says the record is missing. The next
  deploy then plans from the older record and redeploys a little more, which is safe. Reading the
  record is different: a deploy that can't read it stops before deploying anything.

**Order.** Three tiers, each waiting for the one before: first each product's api and every
liveworkspace Worker but the site (with D1, migrations apply before the code: `wrangler d1 migrations
apply`), then the sites and MCP Workers, then the routers in front of them. Two exceptions
(`TIER_OF` in `ci-plan.mjs`): accounts deploys with the sites, once every Worker that checks its tokens
accepts the issuer it signs with, and liveworkspace's bare-domain redirect with the routers, once
`www.` answers. A failing tier stops the ones after it.

**Jobs.** A tier's Workers deploy in a few jobs, not one each: the services and apis in one job, the
sites in one job per product (liveworkspace's site and accounts together), and the routers in one job.
The plan names each Worker's group (`deploy-group.mjs`), and each group's job checks out and installs
once, then deploys its Workers one after another (`node .github/scripts/deploy-group.mjs`). The plan and
the group jobs run the deploy workflows' own `.github/scripts` (from `github.workflow_sha`, the newest
main) over the commit being deployed, so a change to a workflow and its scripts together can't meet an
older commit's scripts: on 2026-11-04 the deploys of commits from before the grouped jobs planned no
groups and failed until main's CI caught up. Before
2026-11-04 every Worker had a job of its own: a production deploy was about 40 one-minute jobs, each
waiting for a runner behind pull requests' CI (a median 8.4 minutes, up to 25, measured that day), and
half of each job was the same checkout and install. Now a full deploy's Workers queue for a runner 8
times (1 job, then 6 side by side, then 1) instead of about 40, and each group's job has a limit sized from the
measured step times: 10 minutes, plus 6 per Worker that builds a site and 2 per other Worker, with 15
minutes for any one command.

- **Each Worker is visible.** Its output is a log group of its own, named for it, and the job's summary
  lists every Worker with its result, the step it failed at, and its time.
- **One failure doesn't hide the rest.** A Worker whose step fails stops there (a failing migration
  never deploys the code after it), and the group goes on with its other Workers. The job fails at the
  end when any Worker failed, which stops the tiers after it, as before, and leaves the record where it was.
- **A retry is safe.** Re-running a failed job deploys its whole group again, the Workers that
  succeeded included. That is harmless: `wrangler deploy` of the same commit puts up the same code and
  vars again, and `wrangler d1 migrations apply` skips the migrations already applied.

**What a deploy writes.** Code and plain vars: a static site's build (with its build id and its
product's hosted build vars, and on staging its product's staging MCP address), built from full history for a help site, whose sitemap dates each article by its last commit, and a product api's
hosted vars (`apps/api/hosted-vars.json`, checked on the live deployment afterwards). Secrets are not
written: each Worker's were set on it with `wrangler secret put` and survive a deploy. The only
credential is the repository secret **`CLOUDFLARE_API_TOKEN`**: a token for the liveworkspace account
with Workers Scripts and D1 edit rights.
