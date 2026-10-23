# System architecture

Follow the references below only as needed; never upfront.

- ../015-api/api.md#storage - when touching where a plan's content is stored or read: one SQLite-backed Durable Object per plan (`PlanRoom`) holds tabs, cards, sheets and changesets; the worker routes every content request to it by RPC; D1 keeps only non-content data and the cross-plan index the plan's outbox pushes
- ./domain-language.md - when naming or adding anything that distinguishes projects or tabs: mode (how a tab is worked on), kind (what a tab is: the general tab or a Plan tab) and template (what a project was made from); design decisions, never interchangeable; and This Browser, the one name for a project saved only in this browser
- ./testing.md - when working on Testing: Vitest across the monorepo; shared config; co-located unit tests plus jsdom hook and component tests; per-workspace coverage shape
- ./source-layout.md - when working on Source layout: group `apps/editor` components + hooks by domain: `apps/editor` components + hooks grouped into domain subdirectories (canvas/dialogs/panels/…)
- ./e2e-smoke.md - when working on End-to-end tests: the post-merge Chromium Playwright suite (one spec file per browser-risky feature) driving the real editor build + api worker, with the pageErrors / expectNoPageErrors fixture
- ./console-logging.md - when adding or changing a console line in the editor: trace lines through `debugLog` (on in development, off in production unless the `liveplanner:debug` flag names their scope), warnings and errors always shown; the E2E fixture sets the flag
- ./linting.md - when adding or changing a lint rule, a workspace's lint setup or a disable directive: oxlint with one shared config, every rule an error, the React hooks rules native, the repo's own rules as a JS plugin, only `oxlint-disable` directives count
- ./source-scanners.md - when a test or guard reads TypeScript source: parse with `parseSourceFiles` from `@liveplanner/source-ast` (TypeScript 7's native compiler) and walk `typescript/unstable/ast` trees
- ./react-state-and-effects.md - when writing a React component or hook: pure render, effects only for the outside world, useEffectEvent / useLatest / useFollowingDraft / useRelativeNow, every hooks lint rule an error, the React Compiler (Rust port, Turbopack)
- ./blueprints/README.md - when implementing browser-only rendering, a View Transition from state, a Fragment ref or the React Compiler's reach: engineering detail derived from the specs
