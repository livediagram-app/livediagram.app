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

- **TypeScript everywhere**. No untyped JavaScript outside generated bundles. Type-checking runs on **TypeScript 7**, the Go compiler — see [Two TypeScripts](#two-typescripts) below for why `package.json` names two of them.
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

### Merging to `main` deploys

A merge to `main` that passes CI **deploys automatically to staging** —
[staging.livediagram.app](https://staging.livediagram.app), a complete copy of the
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

### Two TypeScripts

Every workspace lists two TypeScript entries, and they are not a mistake:

```jsonc
{
  "@typescript/native": "npm:typescript@^7.0.2", // the `tsc` binary
  "typescript": "npm:@typescript/typescript6@^6.0.2", // the compiler API, plus `tsc6`
}
```

TypeScript 7 is the Go compiler. It type-checks this monorepo about **7x faster** than 6 did (21.4s to 2.9s cold, all fourteen projects), so `pnpm typecheck` runs 7 and `tsc` on your PATH inside a workspace _is_ 7.

What 7.0 does not ship is a programmatic API; that lands in 7.1. Tools that import the compiler rather than shell out to it — typescript-eslint, Next.js, Prettier's TypeScript parser — therefore still need 6. The alias pair is Microsoft's documented answer: `typescript` keeps resolving to the 6.0 API for those tools, while `@typescript/native` supplies 7's `tsc`. Run `tsc6` if you ever need to compare the two compilers on the same file.

`packages/eslint-config/typescript-aliases.test.ts` holds every workspace to the root manifest's pair: a new package that lists a plain `typescript` type-checks on 6 without anyone noticing, and draws a Dependabot major bump that cannot install.

Two consequences worth knowing before they bite you:

- **`packages/eslint-config` declares the 6.0 alias as a real dependency.** Without it, `auto-install-peers` resolves typescript-eslint's `typescript` peer against the 7.0 copy and every lint run dies with `typescript-eslint does not support TS 7.0`.
- **Editors are a separate choice.** VS Code needs the TypeScript 7 extension for the fast language server; anything that embeds the compiler in its own language service (MDX tooling, Volar-based plugins) stays on 6 until 7.1. The CLI is the source of truth either way — CI runs 7.

Both aliases get dropped for a plain `typescript@7.x` once 7.1 ships an API and typescript-eslint adopts it.

`pnpm build` is safe to run while a dev server is alive: every Next.js app's dev server goes through `scripts/next-dev.mjs`, which points dev at an isolated `.next-dev/` cache so a concurrent build's `.next/` can never corrupt it. The flip side is a rule for new apps: **a new Next.js app must copy the `NEXT_DISTDIR` read into its `next.config`** (see any existing app's config), or the old build/dev cache race comes back.

## Tests

Tests live next to the code they cover, as `*.test.ts` / `*.test.tsx` files. The runner is [Vitest](https://vitest.dev) with the shared config in `@livediagram/vitest-config`. See [`docs/specs/003-system-architecture/testing.md`](../specs/003-system-architecture/testing.md) for the testing contract.

When you add a feature, add tests for the critical paths. When you fix a bug, add a test that would have caught it.

The bar isn't 100% line coverage; it's "the next regression on this code path fails CI before it ships."

### End-to-end smoke tests

A small [Playwright](https://playwright.dev) smoke suite (`apps/live/e2e`, [`docs/specs/003-system-architecture/e2e-smoke.md`](../specs/003-system-architecture/e2e-smoke.md)) drives the real editor build + api worker in a headless Chromium — the layer the Vitest unit tests can't reach. It is **deliberately off the per-PR gate** because a browser run costs real CI minutes; it runs on push to `main` and on demand (the `E2E Smoke` workflow, `.github/workflows/e2e.yml`).

Run it locally against a running `pnpm dev` stack (it reuses the servers on `:3002` / `:8787`):

```sh
pnpm --filter @livediagram/live test:e2e
```

Without a dev stack, it builds the live app and boots its own (`scripts/e2e-stack.mjs`).

Those ports are defaults, not fixtures. Three environment variables move them, which is what you want when `:3002` is already taken (a second checkout, a worktree):

| Variable        | Default                 | What it moves                                                        |
| --------------- | ----------------------- | -------------------------------------------------------------------- |
| `E2E_BASE_URL`  | `http://localhost:3002` | Where Playwright points, and the URL it waits on before starting     |
| `E2E_LIVE_PORT` | `3002`                  | The port `e2e-stack.mjs` serves the built live app on                |
| `E2E_API_PORT`  | `8787`                  | The api worker's port, and the target its `/api/*` proxy forwards to |

`E2E_API_PORT` is self-contained: it sets the worker's port and the proxy that reaches it together. The other two are **not**. Playwright waits on `E2E_BASE_URL` while the stack binds `E2E_LIVE_PORT`, so moving the live app means setting both. Set only one and the run hangs until the 180-second `webServer` timeout, with nothing said about why.

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
- **New Next.js apps must adopt the `NEXT_DISTDIR` dev-cache isolation.** Dev servers run through `scripts/next-dev.mjs` with an isolated `.next-dev/`; a new app's `next.config` must read `NEXT_DISTDIR` the same way or builds and dev race on `.next/` again.

## Reporting issues

Open a [GitHub issue](https://github.com/livediagram-app/livediagram.app/issues). For bugs include:

- What you expected vs what happened.
- The browser / OS if visible UI is involved.
- A diagram id, share code, or repro steps if applicable.
- Whether you're on the hosted livediagram.app or a self-host.

For feature requests, link to (or propose) a spec entry. A new feature without a spec is hard to review meaningfully; one with a spec is straightforward.

## Code of conduct

Be kind, be specific, be honest. The maintainers will close issues and PRs that drift from those.
