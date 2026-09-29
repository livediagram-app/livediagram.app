# System architecture

Follow the references below only as needed; never upfront.

- ./testing.md - when working on Testing: Vitest across the monorepo; shared config; co-located unit tests plus jsdom hook and component tests; per-workspace coverage shape
- ./source-layout.md - when working on Source layout: group `apps/live` components + hooks by domain: `apps/live` components + hooks grouped into domain subdirectories (canvas/dialogs/panels/…)
- ./e2e-smoke.md - when working on End-to-end tests: the post-merge Chromium Playwright suite (one spec file per browser-risky feature) driving the real editor build + api worker, with the pageErrors / expectNoPageErrors fixture
- ./react-state-and-effects.md - when writing a React component or hook: pure render, effects only for the outside world, useEffectEvent / useLatest / useFollowingDraft / useRelativeNow, every hooks lint rule an error, the React Compiler (Rust port, Turbopack)
