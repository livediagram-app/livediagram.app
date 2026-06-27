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

- **Tested now** (each bullet maps to one or more `*.test.ts` files in the
  named workspace; the inventory grew well past the original list as features
  landed, so this section captures the SHAPE of coverage rather than every
  filename):
  - `packages/diagram`: the diagram data model: arrow path geometry, group /
    ungroup mutations, colour derivation, default value helpers, element
    factories, geometry / anchor math, snap-to-element math, border presets.
    Eight suites total, the package's logic is comprehensively covered.
  - `apps/live/lib`: every helper in the lib layer that callers reach for,
    including api client headers, auto-align, canvas geometry + backgrounds,
    change-log mutations, clamp-to-viewport, dedupe, duplicate-diagram,
    export-tab, format painter, identity, import-tab, laser buffer, local
    identity, relative-time formatting, responsive breakpoint math, search
    filters, template builders + the template catalogue, theme catalogue,
    image upload validation, user preferences (the spec/20 flag set). Around
    20 suites.
  - `apps/live/hooks`: only the pure helpers behind `useDiagramHistory` today
    (the `history*` functions exported from the hook file). Hook bodies need
    `jsdom`, see "Ahead" below.
  - `apps/live/components`: pure-logic helpers next to components, currently
    `auth-shared.test.ts` (the auth UI's shared error message normaliser).
    Components themselves are not tested for the same `jsdom` reason.
  - `apps/api/src`: owner / share-code role guards (`auth/clerk`,
    `auth/diagram-access`), every defensive row mapper that crosses D1 (the
    `*-row.ts` modules: change-log, share-link, tab; plus the body parser in
    `change-log-body`), the `DiagramRoom` Durable Object's security-critical
    paths (broadcast fan-out, hello-frame role forcing, op echo guards),
    response helpers, image MIME sniffing + stripping, comments mutation
    helpers, the share-code generator, the SHA-256 wire-format contract from
    `@livediagram/api-schema`, the telemetry-event validator. Around 14
    suites.
  - `apps/marketing/lib`: the metadata + content registries: alternatives
    list + slug map, legal revision date, subpage metadata generator. Three
    suites.
  - `apps/help`: the hand-maintained article registry's consistency with the
    filesystem (every registered article has a `page.mdx` and vice versa, plus
    each category's `articleCount`), the registry query / href helpers
    (`searchArticles`, `getArticlesByCategory`, ...), and the schema.org
    JSON-LD builders (`articleJsonLd` / `webSiteJsonLd`). Two suites.

- **Ahead:**
  - React component + hook bodies in `apps/live`: current hook tests target
    the pure helpers next to a hook (e.g. `historyCommit` from
    `useDiagramHistory.ts`); the hook bodies themselves (with `useState` /
    `useEffect`) need `jsdom` + `@testing-library/react`, which would mean
    flipping the live workspace's environment to `jsdom` and pulling in the
    deps. None of that is in place today.
  - Direct tests inside `@livediagram/api-schema`: the wire-format DTOs +
    `sha256Hex` live there but the package has no vitest harness yet (the
    SHA-256 contract IS pinned, just from `apps/api/src/sha256.test.ts` where
    vitest is already wired up). Adding a harness in the schema package would
    let DTO round-trip / type-guard tests sit next to the types they cover.
  - Worker-runtime tests for `apps/api`: the current suites run under plain
    vitest in the `node` environment with fakes for `WebSocket` / Durable
    Object state; a future move to `@cloudflare/vitest-pool-workers` would
    let the D1 binding + Durable Object run in a real `workerd` runtime, but
    that's an aspiration, not the current setup.
  - End-to-end tests are out of scope for this spec (unit tests only).
