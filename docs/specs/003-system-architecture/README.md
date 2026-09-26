# System architecture

Follow the references below only as needed; never upfront.

- ./testing.md - when working on Testing: Vitest across the monorepo; shared config; co-located unit tests
- ./source-layout.md - when working on Source layout: group `apps/live` components + hooks by domain: `apps/live` components + hooks grouped into domain subdirectories (canvas/dialogs/panels/…)
- ./e2e-smoke.md - when working on End-to-end smoke tests: A small Chromium Playwright smoke suite driving the real editor build + api worker: /new + /explorer render, a create→edit→reload round-trip, and a zero-uncaught-error sweep. Off the per-PR gate (its own `e2e.yml`, push-to-main + manual), browser cached, chromium-only
