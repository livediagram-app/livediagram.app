# Contributing

External contributions are welcome under the [MIT license](../LICENSE). This doc covers the practical workflow; the conceptual rules live in [`CLAUDE.md`](../CLAUDE.md) and [`specs/`](../specs/).

## Before you write code: specs first

Every product decision, constraint, and rule lives in [`specs/`](../specs/). New feature, scope change, or behaviour rule? **Write or update a spec first, code second.** This isn't paperwork: the spec is what makes the code's intent reviewable.

- Reference specs by filename in PR descriptions and commit messages.
- If specs and code disagree, that's a bug, and the spec usually wins. If the spec is wrong, fix it first.
- Specs are terse and unambiguous, not chatty.

Start by reading [`specs/README.md`](../specs/README.md) for the index and the numeric read order.

## Setting up

See [Local development](local-development.md). The short version: clone, `pnpm install`, `pnpm dev`.

## Code style

- **TypeScript everywhere**. No untyped JavaScript outside generated bundles.
- **Tabs are spaces**: 2-space indent, Prettier-enforced.
- **No em dashes**. Use commas, colons, or parentheses. (The repo has a hard rule against em dashes in code, comments, commits, and copy.)
- **Reuse over duplication**. If two apps need the same thing (UI component, util, type, schema), it lives in [`packages/`](../packages/), not copied into each app. Extract on first cross-app occurrence.
- **No secrets in source**. The repo is public. All secrets travel via env vars, `wrangler secret put`, or GitHub Actions secrets. See [`specs/06`](../specs/06-secrets-policy.md).
- **Comments explain WHY, not WHAT.** A comment that describes what the next line does is noise; a comment that explains a non-obvious constraint, a workaround for a specific bug, or a behaviour that would surprise a reader is gold.

## Before you commit

Always run:

```sh
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build         # only if `pnpm dev` is NOT running
```

CI runs the same five steps on every push. Failing any of them blocks the merge.

The repo is configured so that `pnpm build` and `pnpm dev` can NOT run simultaneously on `apps/live` (they race on `.next/`). Stop the dev server before running `pnpm build`.

## Tests

Tests live next to the code they cover, as `*.test.ts` / `*.test.tsx` files. The runner is [Vitest](https://vitest.dev) with the shared config in `@livediagram/vitest-config`. See [`specs/18`](../specs/18-testing.md) for the testing contract.

When you add a feature, add tests for the critical paths. When you fix a bug, add a test that would have caught it.

The bar isn't 100% line coverage; it's "the next regression on this code path fails CI before it ships."

### End-to-end smoke tests

A small [Playwright](https://playwright.dev) smoke suite (`apps/live/e2e`, [`specs/72`](../specs/72-e2e-smoke.md)) drives the real editor build + api worker in a headless Chromium — the layer the Vitest unit tests can't reach. It is **deliberately off the per-PR gate** because a browser run costs real CI minutes; it runs on push to `main` and on demand (the `E2E Smoke` workflow, `.github/workflows/e2e.yml`).

Run it locally against a running `pnpm dev` stack (it reuses the servers on `:3002` / `:8787`):

```sh
pnpm --filter @livediagram/live test:e2e
```

Without a dev stack, it builds the live app and boots its own (`scripts/e2e-stack.mjs`). Keep the suite tiny — add a focused smoke for a browser-risky change, not a broad suite; depth belongs in unit tests where it's cheap.

## PRs

- **One change per PR**. A bug fix doesn't need surrounding cleanup; a one-shot operation doesn't need a helper. If you find yourself touching unrelated files, split into separate PRs.
- **The PR title is the commit subject** (kept short). The PR description spells out the WHY, the trade-off, and the prior shape.
- **Reference the spec** if the change touches product behaviour.

## How the architecture stays honest

A few hard rules from [`CLAUDE.md`](../CLAUDE.md) that constrain PRs:

- **Static-only frontends.** Next.js apps use `output: 'export'`. No SSR, no Node runtime, no Next.js API routes, no server-required image loader. Any server logic goes in the api worker.
- **Server logic lives in Cloudflare Workers**, not in Next.js. Frontends call those workers.
- **Database access goes through the api worker**, never from the browser.
- **Worker apps target the Cloudflare Workers runtime.** Prefer Web APIs (`fetch`, `Request`, `Response`, `crypto.subtle`) over Node-only APIs.
- **The router worker holds no business logic.** Only service bindings. If you're tempted to add logic, it belongs in whichever app the router forwards to.
- **No `pnpm build` while `next dev` is alive on `apps/live`.** They race on the `.next/` output directory.

## Reporting issues

Open a [GitHub issue](https://github.com/livediagram-app/monorepo/issues). For bugs include:

- What you expected vs what happened.
- The browser / OS if visible UI is involved.
- A diagram id, share code, or repro steps if applicable.
- Whether you're on the hosted livediagram.app or a self-host.

For feature requests, link to (or propose) a spec entry. A new feature without a spec is hard to review meaningfully; one with a spec is straightforward.

## Code of conduct

Be kind, be specific, be honest. The maintainers will close issues and PRs that drift from those.
