# End-to-end tests

A **Playwright** suite that drives the real editor in a real browser, against
the production build and the real api worker. It is the layer Vitest cannot
reach ([Testing](testing.md)): unit tests exercise pure helpers, and jsdom
tests render single hooks and components, but none of them runs the whole
editor with real layout, real pointer and keyboard input, the static export
and a round trip through the api and D1. Every regression chased by hand in
that layer (the "maximum update depth" pan-loop report, panel-gating bugs,
dialog behaviour, a board losing its kind on reload) is the reason a focused
test lives here.

## When it runs

The suite is a **per-PR merge gate**. **Every one of its jobs** (below) is a required status check
on `main` beside CI's jobs ([CI](testing.md#ci)), so a pull request whose change breaks a browser flow
cannot merge. A check is named after its job, so renaming a job or changing the shard count
updates the `main` ruleset's required checks in the same change; until then a pull request waits
on a check that never reports, or merges without one. A post-merge-only run let regressions land unseen and kept `main` red for
hours at a time while later pull requests inherited the failure.

The repository is public, so GitHub-hosted runners cost nothing; the price of the gate is the
run's wall time, which runs beside CI's jobs and **stays within 5 minutes**, so the gate never
holds back a merge for longer than CI itself does. The run needs no secret, no
Cloudflare account and no deployed environment: the stack is local to the runner
([The stack under test](#the-stack-under-test)), so a pull request from a fork runs it too.

The browser suite is its own workflow, `e2e.yml` (named **E2E Smoke**), triggered on:

- **`pull_request`**: every pull request, the gate;
- **push to `main`**: the merged result, since a pull request is tested against the `main` it
  was opened on; and
- **`workflow_dispatch`**: by hand against any branch; such a run is not attached to a pull
  request, so it never stands in for the required check.

A new run on the same ref cancels the one in flight (`concurrency`), so pushing again to a
pull request never queues two runs of the suite.

It runs **every** spec file in `apps/live/e2e/` (bar the opt-in Drive, perf and WebKit projects),
spread over parallel jobs so the wall time is the slowest job, not the sum:

| Job                 | Builds                                           | Runs                                                                      |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| **Smoke shard i/6** | live                                             | `test:e2e:smoke --shard=i/6`: a sixth of the `chromium` project's tests   |
| **Sites audit**     | live, help, telemetry, community, then marketing | `test:e2e:sites`: the `sites` project, `optical-audit-sites.spec.ts`      |
| **Signed-in specs** | live with Clerk stubbed (`build:clerk-stub`)     | the `clerk-stub` project ([Signed-in specs](#signed-in-specs-clerk-stub)) |

Only the sites audit opens help, telemetry, the Community and marketing, so only its job pays for their builds. Marketing builds after the
others, as `turbo.json` orders it: its licences page runs Next's analyzer in each other app on that
app's Turbopack cache, and beside the app's own build the two corrupt it.
Locally `test:e2e` runs the `chromium` and `sites` projects together, as one run.

Cost controls, all in `e2e.yml` and `playwright.config.ts`:

- **Chromium only** (`--project=chromium`); no Firefox / WebKit. A `webkit` project exists
  only when `E2E_WEBKIT=1` is set (after `playwright install webkit`) and runs just
  `import-images.spec.ts`, the image import pipeline's Safari path
  ([Import image pipeline](../020-import-export/import-image-pipeline.md)); CI never sets it.
- **Playwright's container image** (`mcr.microsoft.com/playwright:v<version>-noble`) runs the job:
  Chromium and its system libraries come with it, so no run downloads a browser or apt-installs its
  dependencies. The tag is the locked `@playwright/test` version; the workflow's first check fails,
  naming the tag to set, when a Playwright bump leaves the image behind.
- **Focused tests, not a matrix.** Each spec file proves what only a browser
  can show for one feature; breadth and edge cases stay in unit tests, where
  they are cheap.
- **Parallel everywhere** (`fullyParallel`): 4 workers in CI, one per vCPU of the GitHub runner,
  and Playwright's default locally. Tests stay independent because each opens a fresh browser
  context, so a fresh guest owner whose documents no other test sees.
- **Sharded** (`--shard=i/6`, the matrix in `e2e.yml`): Playwright splits the `chromium` project's
  tests evenly by count across six jobs; each boots its own stack, so shards share nothing.
- **Shards sized to the floor, not beyond.** Every shard pays about two minutes before its first
  test (container, install, the live build), and the Sites audit, which cannot be split, takes
  about 4.5 minutes. The shard count is the smallest that keeps the slowest shard within that
  floor: more shards finish no sooner, and each takes one of the account's 20 concurrent runner
  slots that every other pull request's run waits on. When the suite grows past the floor, the
  shard count grows with it.
- **No type check in the builds**: `e2e.yml` sets `BUILD_SKIP_TYPECHECK=1`, so `next build` skips its
  own type check (`typescriptConfig()` in `@livediagram/next-config`, shared by the five Next
  apps). CI's required Checks job already type-checks every app with `tsc --noEmit` against the
  same tsconfig; repeating it cost each live build about 40 seconds. Deploys leave it unset.
- **A warm build cache**: each job restores Turbopack's build cache (`.next/cache`) from the latest
  run on `main` before it builds, so it compiles only what changed
  (`.github/actions/next-cache-restore`, the one place its key is made). Only runs on `main` save it,
  keyed by version, lockfile and commit, one copy per set of builds (`live`, `live-clerk-stub`,
  `sites`); pull requests read it and never write their own, so they cannot evict it. Turbopack
  re-checks every input, so a cache from an older commit only ever saves work, and a lockfile change
  starts cold. Each restore logs `[next-cache] <name>: restored <key>` or a miss. A cache only ever
  saves time: every build runs through `scripts/next-build-cold-retry.sh`, which, when a build fails
  on a restored cache, warns, wipes it and builds once more from cold. Bumping the key's version
  discards every cache saved so far.
- **No dependency cache** in the e2e jobs: in the container its store path never matches a saved
  cache, so `setup-node`'s `cache: pnpm` only cost a 75-second save per job, while a cold
  `pnpm install` takes about 15 seconds.
- `retries: 1` in CI, a 30-second per-test timeout and a 10-minute job timeout (twice the budget),
  so a hung run fails fast instead of burning minutes.
- **Traces of first failures** in CI (`retain-on-first-failure`): a test that fails and then passes
  on retry still keeps the trace of its failing attempt, so a flaky test can be read rather than
  guessed at. Each invocation keeps its own artefacts (`test-results` and `playwright-report`, or
  their `-clerk-stub` twins), since a run clears its output folder when it starts. `e2e.yml`
  uploads them whenever any holds a trace, a timed-out run included, one artefact per job
  (`playwright-report-shard-i`, `playwright-report-sites`, `playwright-report-clerk-stub`). Locally a trace is kept for a
  retry only.
- **No waiting on what is not coming.** A helper waits for a thing only when the app owes it:
  `dismissQuickTour` returns at once unless /new's tour handoff flag is in sessionStorage
  (`lib/tour-pending.ts`), rather than sitting out a 5-second timeout after every reload or
  by-URL visit, which cost the suite minutes. `seedTab` returns once the seeded elements have
  finished popping in (`settledBox`), so a test never measures or drags a box that is still changing.
- **No model downloads.** The photo-import tests stub the handwriting reader
  and serve the boundary model's weights from the app itself; nothing pulls
  weights over the wire.

## The stack under test

The suite runs against the **real production build**, the live app's
`output: 'export'` static bundle plus the real api worker on local D1,
so it exercises exactly what ships, not a dev-only code path.
The stack serves whatever `apps/live/out` holds and never rebuilds it, so locally run
`pnpm --filter @livediagram/live build` first; an old `out/` fails audits for code that has since changed.

`scripts/e2e-stack.mjs` boots the stack Playwright's `webServer` waits on:

1. **api**: `wrangler dev --local` (`apps/api`) on a fixed port, with
   `db:migrate:local` applied to a fresh local D1 so persistence works.
   `TELEMETRY_ENABLED` unset (the suite asserts on the app, not the
   events pipe), and `AI_ALLOWED_ORIGINS` blanked with `--var` (production
   declares it in `[vars]`, which would refuse the localhost editor).
2. **live**: the static `apps/live/out` served by a minimal Node
   server that reproduces the three things the production router +
   live worker do (so clean routes and the document placeholder resolve
   identically to prod):
   - strip the `/live` `assetPrefix` so `/live/_next/*` resolves to
     `out/_next/*`;
   - rewrite every `/document/<id>` to the single placeholder
     `out/document/[id].html` ([Dedicated route for new-document creation](../007-editor/new-document-route.md): one HTML backs every document
     URL);
   - proxy `/api/*` to the api worker, WebSocket upgrades included (the realtime room), so the app is same-origin (no CORS
     surprises, mirroring the router);
   - serve `apps/help/out` under `/help/*`, `apps/telemetry/out` under `/telemetry/*` and `apps/community/out` under
     `/community/*`, their basePaths, as the router mounts them; a missing build answers a logged 404;
   - cache as production does ([Stale builds](../016-platform/stale-builds.md) "Caching rules"): every
     file goes out as Cloudflare's asset server sends it (`public, max-age=0, must-revalidate`, an
     ETag, 304 on a match), then through the router's rules, run from the router's own
     `apps/router/src/cache-policy.ts` (pages `no-store`, build assets immutable, a missing asset a
     plain-text 404). `E2E_CACHE_POLICY=off` serves without the router's rules, as production did
     before them;
   - simulate a deploy for the stale build specs: `POST /__e2e/deploy` swaps in a copy of the
     build whose chunk files all carry new names (every reference rewritten), and
     `POST /__e2e/assets-out-of-cache` serves build assets `no-store` until then, so the browser
     keeps a page but not its chunks. Both hold only for the browser context that asked (a cookie
     each, `e2e-deploy` and `e2e-assets-out-of-cache`, which `page.request` shares with its page):
     the suite runs in parallel, and the tests beside it keep the build they loaded.
3. **marketing**: `apps/marketing/out` on its own port (`E2E_MARKETING_PORT`, default `3013`),
   since marketing owns `/` in production.

The stack also runs the editor alone beside a running one (`E2E_LIVE_ONLY`,
`E2E_LIVE_PORT`, `E2E_API_PORT`) and can pose as a deployment without an AI
key (`E2E_NO_AI`) or with its AI budget spent (`E2E_AI_BUDGET_SPENT`); see
[Local development](../../development/local-development.md).

Locally the same `playwright.config.ts` sets `reuseExistingServer`, so a
developer with `pnpm dev` already running (live :3002 + api :8787) runs
`pnpm --filter @livediagram/live test:e2e` against that stack with no
extra boot.

## Signed-in specs (Clerk stub)

Clerk is a build-time switch ([Auth + guest access](../014-identity/auth-and-guest-access.md)), so the
guest-mode `out/` can never show a signed-in user. The specs in `apps/live/e2e/clerk-stub/` run
against a second export, `apps/live/.next/out-clerk-stub/` (inside `.next/`, so every ignore and
source scanner already skips it), built by `pnpm build:clerk-stub` with a
publishable key for a host that cannot resolve. Each spec installs a fake `window.Clerk`
(`e2e/clerk-stub/clerk-stub.ts`) before the page loads, which @clerk/react takes in place of
downloading clerk-js, so a chosen user (name, email, pictures) sits behind the real hooks with no
Clerk account, secret or network.

`pnpm --filter @livediagram/live test:e2e:clerk-stub` sets `E2E_CLERK_STUB=1`, which adds the
`clerk-stub` project and boots the stack with `E2E_LIVE_OUT=.next/out-clerk-stub` on its own ports
(live `:3015`, api `:8788`, marketing `:3016`), so a guest stack already up on `:3002` is never
reused for it. The stack also stands in for Clerk (`E2E_CLERK_JWKS=1`): it makes a signing key at
boot, serves its JWKS on `/e2e/jwks.json`, starts the api worker with `CLERK_JWKS_URL` pointing at
it, and mints a session token for any test account on `/e2e/token?sub=user_…`, which the fake
`window.Clerk` hands out. So a stub account is a real verified account to the api and the realtime
room, and two or three stub browsers can collaborate in one document. A test that changes an
account's synced settings takes a fresh id (`freshUserId`), since the stack's D1 outlives a test. `e2e.yml` builds and runs them in their own job, beside the smoke shards.

## No uncaught errors

The suite's standing assertion is that a flow produces **no uncaught
exception, unhandled rejection or `console.error`** on the page, the class the
pan-loop bug was in. The per-test UI checks are the vehicle that drives the
code paths; this is the alarm.

`apps/live/e2e/fixtures.ts` exports a `test` extended with a **`pageErrors`**
fixture, which collects every `pageerror` and `console.error` the page raises,
minus known benign noise (a favicon or manifest 404, dev-server Fast Refresh
chatter, Chromium's generic "Failed to load resource" line, and the blocked
model fetches of the photo tests). A test that takes `pageErrors` ends with
**`expectNoPageErrors(pageErrors)`**, which fails naming what leaked.

The same `test` sets the editor's debug flag (`livediagram:debug` = `*`) on its browser
context before any page loads, so the production build the suite drives writes its trace lines
([Console logging](console-logging.md)) and a spec may wait for one (`[drive-mirror] pass-end`).
A spec that opens its own context with `browser.newContext()` sets it there with
`enableDebugLogs(context)`.

## What the suite asserts

One spec file per feature, each linking the spec it proves:

| File                           | What only a browser can show                                                                                                                                                                                                                                                                                                                                                                  | Spec                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `smoke.spec.ts`                | `/new` renders the wizard; `/explorer` renders for a guest; create a blank diagram, add a shape, label it, and it survives a reload; a template-created event-storming board is still a board after a reload; a note dropped or moved between two notes stays between them; on a phone, the tab menu opens the Collaborate flyout in front of the menu                                        | this spec, [Event storming](../021-event-storming/event-storming.md), [Canvas accessibility](../004-interface-design/canvas-accessibility.md)          |
| `save-failure.spec.ts`         | an autosave refused as unauthenticated says so, then the next edit saves again                                                                                                                                                                                                                                                                                                                | [Per-tab storage](../006-document/per-tab-storage.md)                                                                                                  |
| `trash.spec.ts`                | delete, find it in Settings › Trash, restore it; the deleted card; permanent delete and Empty Trash; an open editor, or one refused its room, is told                                                                                                                                                                                                                                         | [Trash](../013-workspace/trash.md)                                                                                                                     |
| `realtime-peers.spec.ts`       | an owner and an edit-link visitor see each other, edit live, keep both people's edits across a reload, and the visitor's walking avatar shows                                                                                                                                                                                                                                                 | [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md), [Avatar mode](../008-canvas/avatar-mode.md)                      |
| `tab-scoped-share.spec.ts`     | a tab-scoped link opens its tab and nothing else; the owner is never scoped                                                                                                                                                                                                                                                                                                                   | [Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)                                                                                   |
| `presentation-mode.spec.ts`    | a seeded two-slide deck presents slide by slide, and leaving puts the view back exactly where it was                                                                                                                                                                                                                                                                                          | [Presentation mode](../012-collaboration/presentation-mode.md)                                                                                         |
| `event-storming.spec.ts`       | timeline lanes snap a dragged note without moving anything else; a dragged note takes the slot two events suggest; an ordinary diagram has no lanes; the next-note button; pasting notes into an open note; the armed note tile                                                                                                                                                               | [Event storming](../021-event-storming/event-storming.md)                                                                                              |
| `event-storming-lanes.spec.ts` | a dragged workshop note lands on a lane (Cmd/Ctrl leaves it free); arrow keys move a note a whole lane; duplicate and paste stagger along the lane; an older board is lined up once, with undo; a new board starts settled                                                                                                                                                                    | [Event storming](../021-event-storming/event-storming.md)                                                                                              |
| `photo-import.spec.ts`         | a wall photo becomes draft notes of the right kinds and places, with a stubbed reader: review overlay, drawn and edited boxes, Add as one undo step, Discard, a draft surviving a reload, zoom, pan and pinch keeping boxes on their stickies, ground-truth export, the no-paper and spent-budget paths                                                                                       | [Event storming](../021-event-storming/event-storming.md) (photo import)                                                                               |
| `photo-model.spec.ts`          | the boundary model runs in a Web Worker on weights the app serves; when it cannot load, the classical detector finds the notes alone; flat and photographed walls both survive the hybrid                                                                                                                                                                                                     | [Event storming](../021-event-storming/event-storming.md) (photo import)                                                                               |
| `import-images.spec.ts`        | an Excalidraw scene's images land in the gallery; a full gallery leaves placeholders; a PNG with an embedded scene imports; WebP is stored via the WASM encoder without canvas WebP                                                                                                                                                                                                           | [Import image pipeline](../020-import-export/import-image-pipeline.md), [Excalidraw import & export](../020-import-export/excalidraw-import-export.md) |
| `arrow-labels.spec.ts`         | a label sits on its broken-open line; double-clicks edit rather than bend; Shift+Enter and Enter; blank lines keep their height                                                                                                                                                                                                                                                               | [Arrow labels](../008-canvas/arrow-labels.md), [Arrow bending](../008-canvas/arrow-bending.md)                                                         |
| `arrow-rebind.spec.ts`         | arrows re-anchor live while dragging, keep a quarter point on the new side, and the Settings switch turns it off                                                                                                                                                                                                                                                                              | [Arrow anchors](../008-canvas/arrow-anchors.md)                                                                                                        |
| `grips-on-top.spec.ts`         | a selected element's resize handles and an arrow's end grips are the topmost thing at their centres, whatever the element's rotation, opacity or animation and whatever is drawn over it                                                                                                                                                                                                      | [Canvas and palette](../008-canvas/canvas-and-palette.md) (Resize)                                                                                     |
| `viewport-on-add.spec.ts`      | the first element dropped on an empty tab stays where it was dropped; a reloaded tab is framed on its content                                                                                                                                                                                                                                                                                 | [Canvas and palette](../008-canvas/canvas-and-palette.md)                                                                                              |
| `palette-drag.spec.ts`         | a tile in a category's More popover on the Toolbar strip drags onto the canvas, whatever its catalogue: a shape, and a line icon and a sticker found by their own catalogue's search                                                                                                                                                                                                          | [Palette drag ghost](../010-palette/palette-drag-ghost.md), [Toolbar layout](../007-editor/toolbar-layout.md)                                          |
| `quick-style-panel.spec.ts`    | one-click styles, the floating and toolbar docking, swatch targets, and custom swatch overrides                                                                                                                                                                                                                                                                                               | [Quick style panel](../008-canvas/quick-style-panel.md)                                                                                                |
| `multicolour-theme.spec.ts`    | Rainbow gives each limb of a mind map its own palette colour                                                                                                                                                                                                                                                                                                                                  | [Multi-colour themes](../011-theme/multicolour-themes.md)                                                                                              |
| `appearance.spec.ts`           | the appearance opens on the device setting and cycles, never writes to the document, tells Dark Reader to stand down, and is remembered before first paint                                                                                                                                                                                                                                    | [Live app](../007-editor/live-app.md)                                                                                                                  |
| `power-user-mode.spec.ts`      | the role pill toggles a read-only preview; Minimal chrome hides words; switching off restores untouched settings                                                                                                                                                                                                                                                                              | [Power user mode](../007-editor/power-user-mode.md)                                                                                                    |
| `settings-memory.spec.ts`      | Settings reopens on the last category and row, across a resize and deep inside a tall row                                                                                                                                                                                                                                                                                                     | [User preferences](../007-editor/user-preferences.md)                                                                                                  |
| `hints.spec.ts`                | a palette tile's tooltip after a 1 s hover, at once on focus, Escape, pointer onto it; hover cards                                                                                                                                                                                                                                                                                            | [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md)                                                         |
| `icon-weight.spec.ts`          | icons draw regular by default and bold once chosen, across a reload; chrome glyphs keep the house weight in on-screen px                                                                                                                                                                                                                                                                      | [Iconography](../004-interface-design/iconography.md)                                                                                                  |
| `scrollbars.spec.ts`           | every scrolling surface is in-theme, per colour scheme                                                                                                                                                                                                                                                                                                                                        | [Scrollbars](../004-interface-design/scrollbars.md)                                                                                                    |
| `motion-budget.spec.ts`        | every chrome animation (menus, dropdowns, context menu, Settings, Search) settles within 250ms, delay included; under reduced motion each is instant                                                                                                                                                                                                                                          | [Motion](../004-interface-design/motion.md)                                                                                                            |
| `contrast-audit.spec.ts`       | dark mode, on the wizard, the editor with its panels and dialogs, the Join dialog and the Explorer: every visible text node meets WCAG AA (4.5:1, or 3:1 for large text) against the background actually painted under it; no allow-list, and what cannot be measured honestly (glyphs under 6px, disabled controls, hidden text, filtered art, text over an image) is reported, never failed | [Colour scheme](../004-interface-design/color-scheme.md#accessibility)                                                                                 |
| `optical-audit.spec.ts`        | dark mode at 4x, on the wizard, the editor and its dialogs, the Join dialog and the Explorer: every glyph in a small painted shape sits within 0.5px of its centre and stacked actions share one baseline; each failure names the shape, the offset and why it was held to centring                                                                                                           | [Optical alignment](../004-interface-design/optical-alignment.md)                                                                                      |
| `optical-audit-sites.spec.ts`  | the same audit on the help centre, the telemetry dashboard, the Community and the marketing site                                                                                                                                                                                                                                                                                              | [Optical alignment](../004-interface-design/optical-alignment.md)                                                                                      |
| `optical-clip.spec.ts`         | a trimmed label that also truncates keeps its descenders, proven in pixels across the label's own columns                                                                                                                                                                                                                                                                                     | [Optical alignment blueprint](../004-interface-design/blueprints/optical-alignment.md)                                                                 |
| `shape-stroke-inside.spec.ts`  | every shape drawn to its box edge paints no stroke outside it, in pixels                                                                                                                                                                                                                                                                                                                      | [Canvas and palette](../008-canvas/canvas-and-palette.md)                                                                                              |

A new browser-risky feature adds one focused spec file here (or a case in the
file of the feature it extends), linked from its own spec; depth stays in unit
tests where it's cheap.

## Layout

- `apps/live/playwright.config.ts`: the `chromium` and `sites` projects (plus the opt-in ones),
  `webServer` → `scripts/e2e-stack.mjs`, `reuseExistingServer` locally.
- `apps/live/e2e/*.spec.ts`: the spec files above.
- `apps/live/e2e/fixtures.ts`: the `test` with its `pageErrors` fixture, `expectNoPageErrors`, and the
  shared flows (`startBlankDocument`, `startTemplateDocument`, `startEventStormingRow`, `seedTab`,
  `dismissQuickTour`, `openJustDraw`). `startTemplateDocument` exists because the blank helper skips the
  wizard's category step and so never exercises template creation.
- `apps/live/e2e/fixtures/`: drawn wall photos for the photo import; `audit-screens.ts`, `contrast.ts`,
  `optical.ts` and `optical-discover.ts`: the screens and measurements the dark-mode audits share.
- `scripts/e2e-stack.mjs`: the stack boot + static serve (live, help, telemetry, community, marketing).
- `.github/workflows/e2e.yml`: the sharded workflow, run on every pull request;
  `.github/actions/e2e-setup/`: the setup its jobs share (pnpm, Node, install, image check).
- `test:e2e`, `test:e2e:smoke`, `test:e2e:sites` and `test:e2e:clerk-stub` scripts in `apps/live/package.json`; `build:clerk-stub`
  (`apps/live/scripts/build-clerk-stub.mjs`) builds the export the latter runs against.
- `apps/live/e2e/clerk-stub/`: the fake `window.Clerk` and the signed-in specs.

Playwright is an `apps/live` dev dependency; it is **not** wired into
`pnpm test` / `turbo run test` (that stays the fast unit gate), so
`e2e.yml` is the only thing that runs it in CI.
