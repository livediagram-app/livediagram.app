# System architecture

Follow the references below only as needed; never upfront.

- ./domain-language.md - when naming or adding anything that distinguishes documents or tabs: mode (Pages, the one mode), kind (the general tab) and template (what a document was made from), never interchangeable; and This Browser, the one name for a document saved only in this browser
- ./testing.md - when working on Testing: Vitest across the monorepo; shared config; co-located unit tests plus jsdom hook and component tests; per-workspace coverage shape
- ./source-layout.md - when working on Source layout: group `apps/editor` components + hooks by domain: `apps/editor` components + hooks grouped into domain subdirectories (canvas/dialogs/panels/…)
- ./e2e-smoke.md - when working on End-to-end tests: the post-merge Chromium Playwright suite (one spec file per browser-risky feature) driving the real editor build + api worker, with the pageErrors / expectNoPageErrors fixture
- ./console-logging.md - when adding or changing a console line in the editor: trace lines through `debugLog` (on in development, off in production unless the `livedocuments:debug` flag names their scope), warnings and errors always shown; the E2E fixture sets the flag
- ./linting.md - when adding or changing a lint rule, a workspace's lint setup or a disable directive: oxlint with one shared config, every rule an error, the React hooks rules native, the repo's own rules as a JS plugin, only `oxlint-disable` directives count
- ./source-scanners.md - when a test or guard reads TypeScript source: parse with `parseSourceFiles` from `@livedocuments/source-ast` (TypeScript 7's native compiler) and walk `typescript/unstable/ast` trees
- ./react-state-and-effects.md - when writing a React component or hook: pure render, effects only for the outside world, useEffectEvent / useLatest / useFollowingDraft / useRelativeNow, every hooks lint rule an error, the React Compiler (Rust port, Turbopack)
- ./blueprints/README.md - when implementing browser-only rendering, a View Transition from state, a Fragment ref or the React Compiler's reach: engineering detail derived from the specs
