# End-to-end smoke tests

A tiny **Playwright** smoke suite that drives the real editor in a real
browser — the layer the 1,000+ Vitest unit tests can't reach (they only
exercise pure helpers; no hook body or component ever renders). Every
recent regression we chased by hand — the "maximum update depth"
pan-loop report, panel-gating bugs, dialog behaviour — lived here.

## Why it's separate from CI's unit gate

Browser E2E costs real CI minutes (a browser download + a running
stack), so it is **deliberately not on the per-PR critical path**. The
`ci.yml` gate (lint / format / typecheck / test / build) stays fast and
runs on every PR and push as before. The smoke suite is its own
workflow, `e2e.yml`, triggered on:

- **push to `main`** — a post-merge smoke, so a regression that slipped
  a green unit gate is caught within one merge; and
- **`workflow_dispatch`** — run it by hand against a branch before merge
  when a change is browser-risky.

Cost controls, all in `e2e.yml`:

- **Chromium only** (`--project=chromium`); no Firefox / WebKit.
- **Browser binary cached** on `~/.cache/ms-playwright` keyed by the
  Playwright version, so the ~120 MB download happens once per version
  bump, not per run.
- A **handful of tests**, not a matrix. This is a smoke alarm, not an
  exhaustive suite — it answers "does the app boot and take input
  without crashing", not "is every feature correct".
- `workers: 1` in CI + short per-test timeout so a hung run fails fast
  instead of burning minutes.
- `fullyParallel` locally for authoring speed.

## The stack under test

The suite runs against the **real production build** — the live app's
`output: 'export'` static bundle plus the real api worker on local D1 —
so it exercises exactly what ships, not a dev-only code path.

`scripts/e2e-stack.mjs` boots the two-process stack Playwright's
`webServer` waits on:

1. **api** — `wrangler dev --local` (`apps/api`) on a fixed port, with
   `db:migrate:local` applied to a fresh local D1 so persistence works.
   `TELEMETRY_ENABLED` unset (the suite asserts on the app, not the
   events pipe).
2. **live** — the static `apps/live/out` served by a minimal Node
   server that reproduces the three things the production router +
   live worker do (so clean routes and the diagram placeholder resolve
   identically to prod):
   - strip the `/live` `assetPrefix` so `/live/_next/*` resolves to
     `out/_next/*`;
   - rewrite every `/diagram/<id>` to the single placeholder
     `out/diagram/[id].html` (spec/14 — one HTML backs every diagram
     URL);
   - proxy `/api/*` to the api worker so the app is same-origin (no CORS
     surprises, mirroring the router).

Locally the same `playwright.config.ts` sets `reuseExistingServer`, so a
developer with `pnpm dev` already running (live :3002 + api :8787) runs
`pnpm --filter @livediagram/live test:e2e` against that stack with no
extra boot.

## What the smoke suite asserts

Kept small and backend-honest. Every test also fails on **any uncaught
exception or unhandled promise rejection** surfaced to the page (the
class the pan-loop bug was in) via a shared console/​pageerror listener —
that assertion is the point of the suite, the per-test UI checks are the
vehicle that exercises code paths.

1. **`/new` renders** the template-picker wizard (heading + Quick Start
   grid) — the guest entry point, all client-rendered.
2. **`/explorer` renders** its shell (the sidebar sections) as a guest.
3. **Create → edit → persist**: from `/new`, start a blank diagram, add
   a shape from the palette, type a label, and assert it lands on the
   canvas and survives a reload (the round-trip through the api + D1
   that no unit test covers).
4. **Reduced-motion / no-console-error sweep** across the above — a
   dedicated assertion that the three flows produced zero uncaught
   errors.

New browser-risky features should add one focused smoke here, not a
broad suite; depth stays in unit tests where it's cheap.

## Layout

- `apps/live/playwright.config.ts` — chromium project, `webServer` →
  `scripts/e2e-stack.mjs`, `reuseExistingServer` locally.
- `apps/live/e2e/*.spec.ts` — the specs above; a shared `expectNoErrors`
  fixture installs the console/pageerror listener.
- `scripts/e2e-stack.mjs` — the two-process boot + static serve.
- `.github/workflows/e2e.yml` — the cost-controlled workflow.
- `test:e2e` script in `apps/live/package.json`.

Playwright is an `apps/live` dev dependency; it is **not** wired into
`pnpm test` / `turbo run test` (that stays the fast unit gate), so
`e2e.yml` is the only thing that runs it in CI.
