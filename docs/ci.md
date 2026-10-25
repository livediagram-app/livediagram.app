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
- **CodeQL** (`codeql.yml`): the whole repository, on every pull request, every push to `main` and
  weekly. It needs the repository's CodeQL default setup turned off.
- **Canvas performance** (`canvas-perf.yml`): each product's probe, nightly against `main`. A miss
  opens or updates that product's issue, **Canvas performance budget: <product>**.
- **Lucide re-vendor** (`lucide-revendor.yml`): on pull requests that change `packages/icons/package.json`.

Not carried over yet: the coverage report written into each pull request's description (it needs
Codecov set up for this repository, and its fixed upload count doesn't fit runs that upload only the
groups they reach), the CLI publishing and the MCP Registry listing.

## Deploys

The monorepo doesn't deploy. Moving the deploys here needs a choice per product of Cloudflare account,
GitHub environments and secrets, and livediagram.app keeps deploying from its own repository until
the migration's switch (docs/migration.md, step 7). When they move, they should use the same plan:
deploy only the Workers and sites a change reaches.
