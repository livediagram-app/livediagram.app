# Contributing

External contributions are welcome under the [MIT license](../../LICENSE). This doc covers the practical workflow; the conceptual rules live in [`AGENTS.md`](../../AGENTS.md) and [`docs/specs/`](../specs/).

## Before you write code: specs first

Every product decision, constraint, and rule lives in [`docs/specs/`](../specs/). New feature, scope change, or behaviour rule? **Write or update a spec first, code second.** This isn't paperwork: the spec is what makes the code's intent reviewable.

- Reference specs by filename in PR descriptions and commit messages.
- If specs and code disagree, that's a bug, and the spec usually wins. If the spec is wrong, fix it first.
- Specs are terse and unambiguous, not chatty.

Start by reading [`docs/specs/README.md`](../specs/README.md) for the category index.

## Setting up

See [Local development](local-development.md). The short version: clone, `pnpm install`, `pnpm dev`.

## Code style

- **TypeScript everywhere**. No untyped JavaScript outside generated bundles. Type-checking runs on **TypeScript 7**, the Go compiler; see [TypeScript](#typescript) below.
- **Tabs are spaces**: 2-space indent, Prettier-enforced.
- **No em dashes**. Use commas, colons, or parentheses. (The repo has a hard rule against em dashes in code, comments, commits, and copy.)
- **Reuse over duplication**. If two apps need the same thing (UI component, util, type, schema), it lives in [`packages/`](../../packages/), not copied into each app. Extract on first cross-app occurrence.
- **No secrets in source**. The repo is public. All secrets travel via env vars, `wrangler secret put`, or GitHub Actions secrets. See [`docs/specs/002-project-scope/secrets-policy.md`](../specs/002-project-scope/secrets-policy.md).
- **Comments explain WHY, not WHAT.** A comment that describes what the next line does is noise; a comment that explains a non-obvious constraint, a workaround for a specific bug, or a behaviour that would surprise a reader is gold.

## Before you commit

Always run:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

CI runs the same five steps on every push, plus `pnpm staging:check`. Failing any of them blocks the merge.

Adding or upgrading a dependency that ships to a browser or a worker can fail `pnpm build` with a named licences error. `LicenceTextMissing` means the package ships no licence file: add its upstream text to `packages/licences/texts/`, list it in `TEXT_SOURCES` with a pinned URL and checksum, and add an `OVERRIDES` entry for that exact version. `UnreviewedBinaryAsset` means a new `.wasm` or font: add an `EMBEDDED_WORKS` entry naming what is compiled into it. `LicenceNotAllowed` is a decision, not a fix: raise it. See [Third-party licences](../specs/002-project-scope/third-party-licences.md).

### Security alerts and `pnpm.overrides`

A Dependabot alert is fixed by upgrading the direct dependency that pulls the vulnerable package in. An entry in the root `package.json` `pnpm.overrides` is for when no upstream release fixes it; `package.json` holds no comments, so each such entry is listed here with its alert:

| Override          | Alert                                             | Why no upstream fix                                |
| ----------------- | ------------------------------------------------- | -------------------------------------------------- |
| `sharp` `^0.35.5` | GHSA-wq5f-xc86-pv6w (librsvg in sharp `< 0.35.5`) | `miniflare` 5.20261006.0-alpha pins `sharp` 0.35.4 |

Drop an entry once an upstream release makes it redundant.

### Merging to `main` deploys

A merge to `main` that passes CI **deploys automatically to staging** —
[staging.livedocuments.app](https://staging.livedocuments.app), a complete copy of the
platform with its own database ([Staging environment](../specs/016-platform/staging-environment.md)). Nobody
presses anything. Within a few minutes your change is running somewhere public, and any
D1 migration in it has been applied to a real remote database.

Production is **not** affected: that deploy stays manual (`Deploy Production` in the
Actions tab) and someone decides when to press it.

Two things follow for you as a contributor:

- **Check staging after your PR lands.** It is the cheapest place to notice that
  something works in tests but not in a browser.
- **If you touch a worker's bindings**, add the same change to its `[env.staging]` block
  in `wrangler.toml`. Wrangler does not inherit bindings into a named environment, so a
  binding added only at the top level is silently missing from staging. `pnpm
staging:check` catches it in CI.

### TypeScript

Every workspace that type-checks lists one TypeScript, **TypeScript 7**, the Go compiler: `"typescript": "^7.0.2"`. It type-checks this monorepo about **7x faster** than 6 did (21.4s to 2.9s cold, all fourteen projects). `pnpm typecheck` runs its `tsc`, and so does `next build`, which type-checks through the project's `tsc` rather than a compiler API.

TypeScript 7.0 ships no classic compiler API (`import ts from 'typescript'` finds nothing to call). Code that reads TypeScript source does it one of two ways:

- **Linting** is oxlint, which parses TypeScript itself ([Linting](../specs/003-system-architecture/linting.md)).
- **The repo's static guards** (the palette tests, the telemetry emitter scan, the optical guard) parse with `parseSourceFiles` from `@livedocuments/source-ast`, which asks TypeScript 7's native compiler through `typescript/unstable/sync` and hands back `typescript/unstable/ast` trees: the same nodes, `is*` guards and `SyntaxKind` the classic API had, with `node.forEachChild(visit)` in place of `ts.forEachChild(node, visit)` ([Source scanners](../specs/003-system-architecture/source-scanners.md)).

`apps/help/lib/typescript-version.test.ts` holds every workspace to the root manifest's `typescript` and rejects any alias to another TypeScript, so a second compiler cannot creep back in.

The one exception is `ts-json-schema-generator` (the api's OpenAPI schema generator), which bundles its own TypeScript 5.9 to read the api-schema types; it runs only in `pnpm --filter @livedocuments/api gen:openapi` and its drift test.

`pnpm build` is safe to run while a dev server is alive: every Next.js app's dev server goes through `scripts/next-dev.mjs`, which points dev at an isolated `.next-dev/` cache so a concurrent build's `.next/` can never corrupt it. The flip side is a rule for new apps: **a new Next.js app spreads `livedocumentsNextConfig()` from `@livedocuments/next-config` into its `next.config`**, which reads `NEXT_DISTDIR` for it, or the old build/dev cache race comes back.

## Tests

Tests live next to the code they cover, as `*.test.ts` / `*.test.tsx` files. The runner is [Vitest](https://vitest.dev) with the shared config in `@livedocuments/vitest-config`. See [`docs/specs/003-system-architecture/testing.md`](../specs/003-system-architecture/testing.md) for the testing contract.

`pnpm install` installs a pre-push hook (`.githooks/pre-push`) that runs format, lint, typecheck and tests for what your push changes, so a CI failure shows up on your machine first ([Before a push](../specs/003-system-architecture/testing.md#before-a-push)).

When you add a feature, add tests for the critical paths. When you fix a bug, add a test that would have caught it.

The bar isn't 100% line coverage; it's "the next regression on this code path fails CI before it ships."

### End-to-end tests

A [Playwright](https://playwright.dev) suite (`apps/editor/e2e`, [`docs/specs/003-system-architecture/e2e-smoke.md`](../specs/003-system-architecture/e2e-smoke.md)) drives the real editor build + api worker in a headless Chromium — the layer the Vitest unit tests can't reach. It runs on **every pull request** as required checks (the `E2E Smoke` workflow's jobs, `.github/workflows/e2e.yml`: six **Smoke shard** jobs, **Sites audit** and **Signed-in specs**), on push to `main`, and on demand: `gh workflow run e2e.yml --ref <branch>`.

Run it locally against a running `pnpm dev` stack (it reuses the servers on `:3302` / `:8987`):

```sh
pnpm --filter @livedocuments/editor test:e2e
```

Without a dev stack, it boots its own (`scripts/e2e-stack.mjs`) over the existing `apps/editor/out`, which it never rebuilds: run `pnpm --filter @livedocuments/editor build` first, or it exits naming the missing build.

The signed-in specs (`apps/editor/e2e/signed-in/`) need sign-in switched on, so they have their own build and run, on their own ports:

```sh
pnpm --filter @livedocuments/editor build:signed-in
pnpm --filter @livedocuments/editor test:e2e:signed-in
```

The armed guest-signature specs (`apps/editor/e2e/armed/`) run against the usual build, on their own stack with guest signature enforcement on (`:3317`):

```sh
pnpm --filter @livedocuments/editor test:e2e:armed
```

Those ports are defaults, not fixtures. Three environment variables move them, which is what you want when `:3302` is already taken (a second checkout, a worktree):

| Variable             | Default                 | What it moves                                                         |
| -------------------- | ----------------------- | --------------------------------------------------------------------- |
| `E2E_BASE_URL`       | `http://localhost:3302` | Where Playwright points, and the URL it waits on before starting      |
| `E2E_EDITOR_PORT`    | `3302`                  | The port `e2e-stack.mjs` serves the built editor app on               |
| `E2E_API_PORT`       | `8987`                  | The api worker's port, and the target its `/api/*` proxy forwards to  |
| `E2E_MARKETING_PORT` | `3313`                  | The port the stack serves the built marketing site on (optical audit) |

`E2E_API_PORT` is self-contained: it sets the worker's port and the proxy that reaches it together. The other two are **not**. Playwright waits on `E2E_BASE_URL` while the stack binds `E2E_EDITOR_PORT`, so moving the editor app means setting both. Set only one and the run hangs until the 180-second `webServer` timeout, with nothing said about why.

The optical audit also opens the help centre and the marketing site: build them (`pnpm --filter @livedocuments/help --filter @livedocuments/marketing build`), or point `E2E_HELP_URL` and `E2E_MARKETING_URL` at their dev servers. (The telemetry dashboard is liveworkspace's now, liveworkspace/docs/telemetry.md.)

Keep the suite tiny — add a focused smoke for a browser-risky change, not a broad suite; depth belongs in unit tests where it's cheap.

## PRs

- **One change per PR**. A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. If you find yourself touching unrelated files, split into separate PRs.
- **The PR title is the commit subject** (kept short). The PR description spells out the WHY, the trade-off, and the prior shape.
- **Reference the spec** if the change touches product behaviour.

## How the architecture stays honest

A few hard rules from [`AGENTS.md`](../../AGENTS.md) that constrain PRs:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes, no server-required image loader. Any server logic goes in the api worker.
- **Server logic lives in Cloudflare Workers**, not in Next.js. Frontends call those workers.
- **Database access goes through the api worker**, never from the browser.
- **Worker apps target the Cloudflare Workers runtime.** Prefer Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node-only APIs.
- **The router worker holds no business logic.** Only service bindings. If you're tempted to add logic, it belongs in whichever app the router forwards to.
- **New Next.js apps spread the shared config.** Dev servers run through `scripts/next-dev.mjs` with an isolated `.next-dev/`; a new app's `next.config` spreads `livedocumentsNextConfig()` (which reads `NEXT_DISTDIR`) or builds and dev race on `.next/` again, and `packages/next-config/apps-use-shared.test.js` lists the app.
- **Markup and parsed files go through a Trusted Types policy.** Every page enforces Trusted Types ([Trusted Types](../specs/016-platform/trusted-types.md)): `dangerouslySetInnerHTML` takes `trustedHtml(markup)` from `@livedocuments/ui`, and only for markup our own escaping builders made, and nothing parses with `DOMParser`. A new app puts the boot script first in its `<head>` and the header in its `public/_headers`; `packages/ui/src/trusted-types-sinks.test.ts` checks all of it.

## Reporting issues

Open a [GitHub issue](https://github.com/livedocuments-app/livedocuments.app/issues). For bugs include:

- What you expected vs what happened.
- The browser / OS if visible UI is involved.
- A document id, share code, or repro steps if applicable.
- Whether you're on the hosted livedocuments.app or a self-host.

For feature requests, link to (or propose) a spec entry. A new feature without a spec is hard to review meaningfully; one with a spec is straightforward.

## Code of conduct

Be kind, be specific, be honest. The maintainers will close issues and PRs that drift from those.
