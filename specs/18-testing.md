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
  filename — counts below are as of 2026-07-14):
  - `packages/diagram` (36 suites): the data model end to end — element
    factories + defaults, geometry / anchor / snap math, arrow path +
    avoidance + endpoint-spread + rebind stability, group + layer mutations,
    auto-layout (clusters + styles), Mermaid import/export (flowchart, state,
    ER), graph authoring, freehand + shape recognition, rich text, tables,
    comments, session tools, the headless SVG renderer, validation.
  - `apps/live` (93 suites): the lib layer's helpers (api client, auto-align,
    canvas geometry + backgrounds, change-log, export/import-tab, search,
    templates + theme catalogues, user preferences, telemetry policy,
    draw-commit + quick-add placement, offline store, help deep links, and
    more), pure helpers behind hooks (history, favourites, panel layout),
    pure component-adjacent logic (template previews + bounds, placement,
    auth-shared), and the cross-app guard that every `HELP_ARTICLES` deep
    link resolves to a real help page.
  - `apps/api` (45 suites): auth guards (Clerk, diagram access, tokens),
    every defensive D1 row mapper, the `DiagramRoom` Durable Object's
    security-critical paths, route handlers (diagrams, share, images,
    thumbnails, folders, teams, unfurl, events, ai), the OpenAPI
    manifest ↔ dispatch drift guards, email lifecycle, response helpers,
    MIME sniffing.
  - `packages/api-schema` (2 suites): the SHA-256 wire-format contract
    (FIPS 180-4 vectors) and the telemetry-event validator's closed
    vocabulary + type-pattern gate — both moved here from `apps/api`
    once the package got its own harness, so they sit next to the code
    they pin.
  - `apps/mcp` (5 suites): tool argument schemas, tab builders, the
    find-diagrams search, OAuth state handling, and the api service-binding
    client.
  - `apps/router` (1 suite): the dispatch table (prefix strips, clean live
    routes, origin fallback, 503) plus the drift guard that every top-level
    `apps/live/app` segment routes to the live worker rather than falling
    through to marketing's 404.
  - `packages/telemetry-client` (1 suite): the shared buffer / flush /
    beacon engine both apps emit through — batching, caps, opt-in gates,
    page-hide beacon, error-tracking caps.
  - `packages/icons` (1 suite): the icon resolver.
  - `apps/marketing/lib` (3 suites): the metadata + content registries:
    alternatives list + slug map, legal revision date, subpage metadata
    generator.
  - `apps/help` (3 suites): the article registry's consistency with the
    filesystem (slugs ↔ `page.mdx`, per-category `articleCount`), the
    registry query / href helpers, the internal-link guard (every
    `/help/...` cross-link in an article resolves to a real page), and the
    schema.org JSON-LD builders.

- **Ahead:**
  - React component + hook bodies in `apps/live`: current hook tests target
    the pure helpers next to a hook (e.g. `historyCommit` from
    `useDiagramHistory.ts`); the hook bodies themselves (with `useState` /
    `useEffect`) need `jsdom` + `@testing-library/react`, which would mean
    flipping the live workspace's environment to `jsdom` and pulling in the
    deps. None of that is in place today.
  - Worker-runtime tests for `apps/api`: the current suites run under plain
    vitest in the `node` environment with fakes for `WebSocket` / Durable
    Object state; a future move to `@cloudflare/vitest-pool-workers` would
    let the D1 binding + Durable Object run in a real `workerd` runtime, but
    that's an aspiration, not the current setup.
  - End-to-end tests are out of scope for this spec (unit tests only).
