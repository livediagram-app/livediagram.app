# Testing

How livediagram is tested below the browser: unit tests, and hook and component tests in jsdom. The goal is a fast, consistent, zero-config-per-file test setup that runs the same locally and in CI.

The whole editor in a real browser, against the production build and the api worker, is the separate Playwright suite in [End-to-end tests](e2e-smoke.md); it is a per-PR merge gate of its own.

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
  pure helpers: the document data model, the wire-format serializers, and the
  canvas geometry. Those are tested first.
- **Speed budgets are CPU time, not wall-clock.** A test asserting that work
  is fast (a linear scan, a converter, the sticky detector) measures it with
  `cpuMsOf` (or `cpuMsOfAsync`) from `@livediagram/vitest-config/cpu-time`, never
  `performance.now()`. Turbo runs every package's suite at once, and a
  wall-clock budget also counts the time a test waits for a core, which made
  those tests flake on a busy machine. CPU time still catches the regression
  the budget is for. The one exception is a test that asserts nothing WAITS
  (no sleep, no retry delay): only wall-clock time can see a wait.
- **A test never pays a cold module load.** When the code under test imports
  a module lazily (`await import(...)`), the test file also imports it
  statically, so its transform happens at collection, outside every test's
  timeout; a cold load inside the first test timed out on a busy CI runner
  and broke the rest of the file with it.
- **A test never waits out a real delay.** A retry pause, backoff or flush
  timer runs under `vi.useFakeTimers()`, settled with `vi.runAllTimersAsync()`.
- **A guard that scans source files filters by text before parsing.** It
  skips a file that lacks a token every violation needs, and parses each file
  once per test file, never once per test.
- **Tampering is done on bytes, not on encoded text.** A test that tampers
  with a base64 value decodes it, flips a bit, and re-encodes: the last
  base64 character carries padding bits, so editing the text can decode to the
  very same bytes.
- **Two D1 doubles in `apps/api`.** `src/test-d1.ts` records which SQL ran
  with which bindings, and has no schema. `src/test-sqlite-d1.ts` is a real
  in-memory SQLite (`node:sqlite`) with every migration applied and foreign
  keys on, as D1 has them. Use the second wherever the behaviour lives in the
  schema: cascades, primary-key collisions, `INSERT OR IGNORE` outcomes.
  A migration that rebuilds a table is tested the same way: stop short of it
  (`sqliteD1({}, { before: '0049' })`), seed rows under the old schema, run it
  with `applyMigration`, and compare every row. A rebuilt **parent** table
  cascades into its children on `DROP TABLE`, so this is the only test that
  can see that loss.

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
terminal, plus `html` + `lcov` for tooling). The `lcov` report names each file
from the repository root (`apps/live/lib/...`), so reports from different
workspaces never collide. Only first-party TypeScript source under `src/` and
`lib/` is counted; the editor (`apps/live`) also counts `app/`, `components/`
and `hooks/`, where most of its source lives. Fixtures beside the code
(`.drawio`, goldens, model weights) are never parsed as source. Test files and type-only `.d.ts` are
excluded. `index.ts` is intentionally **not** excluded — in this repo a
package's `index.ts` is its implementation (e.g. `@livediagram/document`), not
a barrel of re-exports.

There is no repo-wide percentage gate: the bar for most code is "logic has
tests," not a number.

One set of files is the exception, held at **100% statements, branches,
functions and lines** by per-glob thresholds in `apps/api/vitest.config.ts`:

| Files                                                                                                  | Why                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/auth/**`                                                                                          | Decides WHO a request is — Clerk verification, guest-id signatures, api tokens, the read/edit gates                                                           |
| `src/api-token-row.ts`, `src/db/api-tokens.ts`, `src/routes/tokens.ts`                                 | Mint, resolve and revoke the credentials that act as an account                                                                                               |
| `src/db/share.ts`, `src/db/shared.ts`, `src/db/ws-tickets.ts`                                          | Share links, the "shared with you" record, and the one-time realtime room tickets                                                                             |
| `src/routes/share.ts`, `src/routes/shared.ts`, `src/routes/document-share-routes.ts`                   | The only unauthenticated read path into a document, and the owner-only routes that grant it                                                                   |
| `src/image-refs/**`, `src/db/image-refs.ts`, `src/db/image-retention.ts`, `src/db/document-removal.ts` | Decide whether an uploaded image is still placed anywhere, and so whether the daily sweep may delete it ([Images](../009-elements/images.md#reference-index)) |

The rest of the worker fails visibly. These fail by serving the right response
to the **wrong person**, or by deleting a picture someone placed: an outcome no amount of production monitoring
notices, because nothing errors. The thresholds are per-glob rather than
per-directory-average, so a new module added under `src/auth/` is held to the
bar on the commit that introduces it instead of being averaged away by its
neighbours.

This is the first ratchet, not the last: extend the list when a module joins
the "decides who may see this" or "decides what may be deleted" set.

## CI

CI runs parallel jobs (`.github/workflows/ci.yml`): **Checks** runs lint →
format → typecheck; **Tests** runs **test** → **coverage thresholds**, each
suite exactly once (a workspace with `test:coverage` runs only that), for every
workspace but the editor; **Editor unit tests i/3** run the editor's suite
(`apps/live`, most of the repository's tests) under coverage, a third of its
files each (`vitest run --shard=i/3`); **Build** runs the build and the staging
config check. No CI change is needed to start running
tests; adding a `test` script to a workspace is enough for Turborepo to pick
it up.

Checks, Tests, every Editor unit tests job and Build are required status checks on `main`, with every E2E Smoke job
([End-to-end tests](e2e-smoke.md#when-it-runs)). Only runs started by the pull request count: a
`workflow_dispatch` run on the same commit is not attached to it.

Coverage is a separate step because it enforces the thresholds above — and
because running it at all keeps the coverage tooling exercised. It previously
did not run in CI, which is how a v4 coverage provider came to sit against a
v5 test runner with every check green: nothing invoked the broken path.

### Sizing the shards

A pull request waits for its slowest job, so splitting a suite further than the slowest job that cannot
be split (Checks, about 4 minutes) buys no time, while each extra job takes one of the account's 20
concurrent runner slots that every other run waits on. The editor's suite is split into the fewest
shards that finish inside Checks: three, at about 3 minutes each, of which about 30 seconds is
setup. The E2E suite sizes its shards the same way ([End-to-end tests](e2e-smoke.md#when-it-runs)).

### Coverage report

Tests and each Editor unit tests job upload their `lcov` reports to
[Codecov](https://app.codecov.io/gh/livediagram-app/livediagram.app), which merges the four uploads
of a commit into one report and comments it on the pull request (`codecov.yml`): a summary, the
coverage diff and one row per area (Editor, API, MCP, Help and marketing, Packages), never a list of
files, which an editor change would fill with hundreds. It informs; it never
gates: its statuses are informational, and the enforced bar stays the thresholds above. The upload
authenticates with GitHub's OIDC token (`id-token: write`), so no Codecov secret exists; a pull
request from a fork uploads tokenless. A failed upload logs its error and leaves the job green, so a
Codecov outage never holds back a merge.

The comment's layout and the project status come from `codecov.yml` only on a Codecov plan that
reads it: on the Team plan Codecov writes a fixed, patch-only comment whatever the file says, so the
`livediagram-app` organisation stays on a plan other than Team.

## Before a push

A **pre-push hook** runs what CI's Checks and Tests would fail on, for what the push changes, so
a deterministic failure surfaces in seconds on the machine rather than minutes later on CI.

- `pnpm install` installs it: the root `prepare` script runs `scripts/git-hooks/install.mjs`,
  which points `core.hooksPath` at the tracked `.githooks/` directory. It skips, saying so, when
  `CI` is set or outside a git work tree.
- `.githooks/pre-push` runs `scripts/git-hooks/pre-push.mjs`, which takes the files changed since
  the merge base with `origin/main` and runs, stopping at the first failure:
  1. `prettier --check` on the changed files Prettier formats;
  2. `turbo run lint typecheck test --affected`, against that merge base, for the workspaces the
     change touches and their dependants;
  3. the help app's suite whenever a changed file sits outside `apps/` and `packages/`, since
     its guards (repo paths and spec links in docs and code) read the whole repository and
     `--affected` assigns a root file to no workspace.
- Nothing changed since the merge base: it prints that and passes.
- The hook is a fast shift-left, not the gate: CI still runs everything, and the E2E suite stays
  in CI.

The help app's `test` and `test:coverage` tasks declare the repository's tracked text as turbo
inputs (`turbo.json`), so a docs-only change never replays a cached pass of those guards.

## What's tested now, what's ahead

- **Tested now.** Every bullet maps to `*.test.ts` / `*.test.tsx` files in the
  named workspace. This section records the SHAPE of coverage, not counts or
  filenames: `pnpm test` reports the counts, which change with every feature.
  A workspace that gains its first test file joins this list in the same change.
  - `packages/document`: the data model end to end: element
    factories + defaults, geometry / anchor / snap math, arrow path +
    avoidance + endpoint-spread + auto-rebind and crossing swaps, arrow labels,
    layer mutations, auto-layout (clusters, styles, lanes, crossings), mind maps,
    Mermaid import/export (flowchart, state, ER), graph authoring, freehand +
    shape recognition, rich text, tables, comments + mentions, element ops and
    deltas, sessions (Q&A, polls, quizzes), slide decks, tab kinds and the
    event-storming lanes + photo placement, names, themes, element shadows,
    the headless SVG renderer's fidelity and coverage, validation.
  - `apps/live`: the lib layer's helpers (api client + Offline Mode store,
    auto-align, canvas geometry + backgrounds, export/import,
    search, templates + theme catalogues, user preferences, telemetry policy,
    placement, help deep links, the photo-model worker's plumbing), the pure
    helpers behind hooks, and a large jsdom layer of hook and component tests
    (below). Cross-app guards: every `HELP_ARTICLES` deep link resolves to a
    real help page.
    Source guards read the class strings where a rule cannot fail a build:
    `dark-mode-coverage.test.ts` and `dark-palette.test.ts` (the dark palette's
    tokens, solid brand fills, brand text, identity colours;
    [Colour scheme](../004-interface-design/color-scheme.md)), every workspace's
    `optical-guard.test.ts` (no untrimmed text in a centring circle or pill;
    [Optical alignment](../004-interface-design/optical-alignment.md)), and every
    UI workspace's `motion-budget.test.ts` ([Motion](../004-interface-design/motion.md)).
  - `apps/api`: auth guards (Clerk, guest signatures, document access, tokens),
    every defensive D1 row mapper, the D1 modules against real SQLite
    (cascades, migrations), the `DocumentRoom` Durable Object's rules, ledger
    and multiplayer paths, every route family (documents, tabs, share, images,
    thumbnails, folders, teams, trash, timeline, activity, tokens, OAuth, unfurl,
    events, AI incl. the photo reader), the Timeline's writers and its catalogue
    against its spec, the image reference index, email lifecycle, the OpenAPI
    manifest ↔ dispatch drift guards, response helpers, MIME sniffing.
  - `packages/api-schema`: the wire contracts both sides share: the SHA-256
    contract (FIPS 180-4 vectors), the telemetry-event validator's closed
    vocabulary + type-pattern gate, request auth, image limits, trash and poll
    shapes, error telemetry and page views.
  - `packages/explorer-lens`: the Explorer filter lens, at 100 % coverage
    enforced by its config: the token grammar and every rejection, canonical
    form and chip writes, matching per dimension, suggestions and their marks,
    view-model copy, `?q=` and carry-over, the telemetry facets.
  - `packages/sticky-vision`: the classical sticky-note detector for the photo
    import ([Event storming](../021-event-storming/event-storming.md)): colour
    classification, contours, seams, necks and spill, the boundary-model hybrid,
    and a ground-truth set of photos scored against their truth.
  - `packages/sticky-model`: the learned boundary model's browser-safe parts
    and training helpers: cues, tiling, stride, resize, quantisation, decode and
    the wall / notes layout.
  - `packages/ui`: the shared primitives (Button, Tooltip, HoverCard, hints),
    appearance boot + store, SEO helpers, icons and glyph ink, optical centring,
    and the Timeline's cards, stacking, grouping, tones and categories, rendered
    in jsdom where they hold state.
  - `packages/icons`: the icon resolver, catalogues, markup builders, stroke
    weight, cap-band and ink centring, and the vendored Lucide set.
  - `packages/template-previews`: preview SVGs, their bounds and motion. The
    template builders themselves (`packages/templates`, which has no suite of
    its own) are covered from their callers: `apps/live`'s template and
    builder tests, `apps/marketing`'s gallery, and `apps/help`'s article guard.
  - `packages/tailwind-config`: the theme's budgets, motion and optical
    utilities, scrollbars.
  - `packages/eslint-config`: the custom rules (raw SVG, native `title`) and
    the TypeScript alias wiring.
  - `packages/telemetry-client`: the shared buffer / flush / beacon engine
    both apps emit through: batching, caps, opt-in gates, page-hide beacon,
    error-tracking caps.
  - `apps/mcp`: tool argument schemas (and the name cap through the real MCP
    SDK), tool registration + telemetry, graph input, element normalising, tab
    builders, the find-diagrams search, OAuth state handling, the request scope,
    and the api service-binding client.
  - `apps/router`: the dispatch table (prefix strips, clean live
    routes, origin fallback, 503) plus the drift guard that every top-level
    `apps/live/app` segment routes to the live worker rather than falling
    through to marketing's 404.
  - `apps/marketing`: the content registries (alternatives, landing beats,
    template gallery, feature anchors), brand and category icons, dark art.
  - `apps/telemetry`: the dashboard's event-vocab layer and maths:
    category grouping/ordering, row labels, colours, metric series and
    emitters, ranking rules, the CTA funnel, and the hover-card explanations'
    never-blank guarantee.
  - `apps/help`: the article registry's consistency with the
    filesystem (slugs ↔ `page.mdx`, per-category counts), the internal-link,
    UI-label, template and shortcut guards over article text, search and
    article telemetry, the schema.org JSON-LD builders, and the docs guards: every repo path quoted in
    `docs/` exists, and every blueprint DEFAULTS.md ledger id, COMPLETENESS.md section and README.md
    index entry is unique, so a merge that keeps both sides of one fails a test.

- **Hooks and components** in `apps/live` and `packages/ui` render in tests, and the
  environment is opted into **per file** rather than per workspace. A test
  that needs a document opens with a docblock:

  ```ts
  // @vitest-environment jsdom
  ```

  and renders through `@testing-library/react` (`renderHook` for a hook,
  `render` for a component, with `act` and `waitFor`). The majority of tests
  are pure logic and stay on `node`, which is both faster and honest about
  what they exercise; flipping the whole workspace to `jsdom` to serve the
  files that render would tax every other suite for nothing.

  This exists because real bugs could not be caught without it, both in the
  Timeline, whose state lives in hooks rather than in pure helpers:
  `useTimelineFeed.test.tsx` covers one scope's fetched-period cache leaking
  into another's ([Timeline](../013-workspace/timeline.md) §3.4), and `useTimelineControls.test.tsx` covers a
  Clear filters button that cleared only half the filters. Each fails if its
  fix is reverted.

  Both workspaces load the same setup file — `react-cleanup` out of
  `@livediagram/vitest-config`, one copy for the repo rather than one per
  workspace — which calls Testing Library's `cleanup` in an `afterEach`,
  guarded on `typeof document` so the DOM-less majority is untouched. Testing Library registers that itself only under
  `globals: true`, which this repo does not use, so a file that rendered
  without unmounting left a live React root behind; the scheduler then woke
  on a later macrotask, after Vitest had already torn the jsdom environment
  down, and raised `ReferenceError: window is not defined` as an unhandled
  error — a run that fails with every test passing, only on a machine slow
  enough to lose the race. `vitest.setup.test.tsx` in each workspace is the
  deterministic guard on that wiring. Files that must unmount **before**
  their own teardown (a hook whose window listeners would otherwise answer
  the next test) still call `cleanup()` themselves: after-hooks run in
  reverse registration order, so the setup's copy runs last.

  One resolver note, in `apps/live/vitest.config.ts`: `resolve.dedupe` lists
  `react` and `react-dom`. `packages/ui` peers React but carries its own copy
  for its own tests, so a hook test that renders a `@livediagram/ui` hook
  otherwise loads TWO Reacts and every `useState` throws "Cannot read
  properties of null". Next's bundler dedupes for real builds; the test
  resolver has to be told.

- **Ahead:**
  - Worker-runtime tests for `apps/api`: the current suites run under plain
    vitest in the `node` environment with fakes for `WebSocket` / Durable
    Object state, and D1 as either a recorder or in-memory SQLite (see
    Conventions); a future move to `@cloudflare/vitest-pool-workers` would
    let the D1 binding + Durable Object run in a real `workerd` runtime, but
    that's an aspiration, not the current setup.

Browser end-to-end tests are not part of this gate; they are specified in
[End-to-end tests](e2e-smoke.md).
