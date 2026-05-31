# Testing

How livediagram is unit-tested. The goal is a fast, consistent, zero-config-per-file test setup that runs the same locally and in CI.

## Runner

**Vitest** is the single test runner across the monorepo. It is already the
ecosystem default for Vite/TS projects, runs TypeScript with no extra build
step, and has a Jest-compatible API so tests read conventionally.

There is **no per-app runner divergence** — every workspace that has tests uses
Vitest with the same shared config.

## Shared config: `@livediagram/vitest-config`

Per the repo's reuse-over-duplication rule, test configuration lives in one
place: `packages/vitest-config`. It sits alongside the other shared configs
(`eslint-config`, `prettier-config`, `tailwind-config`).

It exports:

- `baseConfig` — the shared Vitest defaults (node environment, coverage via
  `v8`, file-name conventions, `clearMocks`).
- `defineProject(overrides)` — merges the base with per-workspace overrides.

A workspace's `vitest.config.ts` is therefore one line in the common case:

```ts
import { defineProject } from '@livediagram/vitest-config';
export default defineProject();
```

…or, when a workspace needs something different (e.g. a DOM environment for
React component tests):

```ts
import { defineProject } from '@livediagram/vitest-config';
export default defineProject({ test: { environment: 'jsdom' } });
```

## Conventions

- **Test files live next to the code they test**, named `*.test.ts` /
  `*.test.tsx`. Co-location keeps the unit and its test in sync and makes
  coverage gaps obvious.
- **Import the source under test by relative path** (`./geometry`), not via the
  package's public entry, so a unit test exercises exactly one module.
- **No magic globals.** `describe` / `it` / `expect` are imported from
  `vitest`. This keeps test files lint-clean and explicit (`globals: false`).
- **Prefer pure-function tests.** The highest-value, lowest-cost units are the
  pure helpers: the diagram data model, the wire-format serializers, and the
  canvas geometry. Those are tested first.

## Scripts

Every testable workspace exposes:

| Script          | What it does                             |
| --------------- | ---------------------------------------- |
| `test`          | `vitest run` — single pass, CI mode      |
| `test:coverage` | `vitest run --coverage` — with v8 report |

Run from the repo root:

- `pnpm test` → `turbo run test` across all workspaces.
- `pnpm test:coverage` → `turbo run test:coverage`.

A single workspace: `pnpm --filter @livediagram/<name> test`.
Watch mode while developing: `pnpm --filter @livediagram/<name> exec vitest`.

## Coverage

Coverage uses the built-in **v8** provider. Reports are written to a
gitignored `coverage/` directory per workspace (`text` summary in the
terminal, plus `html` + `lcov` for tooling). Only first-party source
(`src/**`, `lib/**`) is counted; test files and type-only `.d.ts` are
excluded. `index.ts` is intentionally **not** excluded — in this repo a
package's `index.ts` is its implementation (e.g. `@livediagram/diagram`), not
a barrel of re-exports.

No hard coverage threshold is enforced yet — the bar today is "logic has
tests," not a percentage gate. A threshold can be added to `baseConfig`'s
`coverage.thresholds` once coverage stabilises.

## CI

CI already runs `pnpm test` in the lint → format → typecheck → **test** →
build sequence (`.github/workflows/ci.yml`). No CI change is needed to start
running tests; adding a `test` script to a workspace is enough for Turborepo to
pick it up.

## What's tested now, what's ahead

- **Tested now:**
  - `@livediagram/diagram` — diagram model helpers (`group.test.ts`,
    `arrow-path.test.ts`).
  - `apps/live` — canvas helpers (`lib/canvas.test.ts`), the change log
    (`lib/change-log.test.ts`), and the diagram-history hook
    (`hooks/useDiagramHistory.test.ts`).
- **Ahead:**
  - `@livediagram/api-schema` — the DTO serialize/deserialize wire format is
    pure and untested; a natural next target. Wire it to the shared config and
    add round-trip tests.
  - React component tests in `apps/live` — current hook/logic tests run fine
    under the `node` environment; component rendering would add `jsdom` +
    `@testing-library/react` and flip that workspace's environment to `jsdom`.
  - Cloudflare Worker tests for `apps/api` — uses
    `@cloudflare/vitest-pool-workers` so the D1 binding + Durable Object run in
    a real `workerd` runtime rather than being mocked.
  - End-to-end tests are out of scope for this spec (unit tests only).
