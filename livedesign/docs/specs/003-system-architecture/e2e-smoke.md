# End-to-end tests

A **Playwright** suite that drives the real editor in a real browser, against
the production build and the real api worker. It is the layer Vitest cannot
reach ([Testing](testing.md)): unit tests exercise pure helpers, and jsdom
tests render single hooks and components, but none of them runs the whole
editor with real layout, real pointer and keyboard input, the static export
and a round trip through the api and its Durable Objects. Every regression chased by hand in
that layer (the "maximum update depth" pan-loop report, panel-gating bugs,
dialog behaviour, a board losing its kind on reload) is the reason a focused
test lives here.

## When it runs

The suite is a **per-PR merge gate**. It runs from the monorepo's root `e2e.yml` (named **E2E**), which calls
`e2e-product.yml` for livedesign whenever a change reaches its editor, `@livedesign/live` ([docs/ci.md](../../../../docs/ci.md)).
The workflow's one result job, **E2E**, is a required check on `main` beside **CI** ([CI](testing.md#ci)), so a pull
request whose change breaks a browser flow cannot merge, and a renamed job or a new shard count needs no ruleset
change. A post-merge-only run let regressions land unseen and kept `main` red for hours at a time while later pull
requests inherited the failure.

The price of the gate is the run's wall time, which runs beside CI's jobs and **stays within 5 minutes**, so the
gate never holds back a merge for longer than CI itself does. The run needs no secret, no Cloudflare account and no
deployed environment: the stack is local to the runner ([The stack under test](#the-stack-under-test)), so every
pull request runs it.

`e2e.yml` runs on:

- **`pull_request`**: every pull request, the gate;
- **push to `main`**: the merged result, since a pull request is tested against the `main` it
  was opened on; and
- **`workflow_dispatch`**: by hand against any branch; such a run is not attached to a pull
  request, so it never stands in for the required check.

A new push to a pull request cancels its run in flight (`concurrency`); on `main` every commit's run goes to the end.

It runs **every** spec file in `apps/live/e2e/` (bar the opt-in perf and WebKit projects),
spread over parallel jobs so the wall time is the slowest job, not the sum:

| Job                 | Builds                                   | Runs                                                                                                    |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Smoke shard i/6** | live                                     | `test:e2e:smoke --shard=i/6`: a sixth of the `chromium` project's tests                                 |
| **Sites audit**     | live, help, then marketing               | `test:e2e:sites`: the `sites` project, `optical-audit-sites.spec.ts` and `marketing-header-fit.spec.ts` |
| **Signed-in specs** | live with sign-in on (`build:signed-in`) | the `signed-in` project ([Signed-in specs](#signed-in-specs))                                           |

Only the sites audit opens help and marketing, so only its job pays for their builds. Marketing builds after the
others, as `turbo.json` orders it: its licences page runs Next's analyzer in each other app on that
app's Turbopack cache, and beside the app's own build the two corrupt it.
Locally `test:e2e` runs the `chromium` and `sites` projects together, as one run.

Cost controls, all in `e2e-product.yml` and `playwright.config.ts`:

- **Chromium only** (`--project=chromium`); no Firefox / WebKit. A `webkit` project exists
  only when `E2E_WEBKIT=1` is set (after `playwright install webkit`) and runs just
  `quick-style-swatch-rows.spec.ts`, whose swatch rows fit or wrap by the engine's layout; CI
  never sets it.
- **Playwright's container image** (`mcr.microsoft.com/playwright:v<version>-noble`) runs the job:
  Chromium and its system libraries come with it, so no run downloads a browser or apt-installs its
  dependencies. The tag is the locked `@playwright/test` version; the workflow's first check fails,
  naming the tag to set, when a Playwright bump leaves the image behind.
- **Focused tests, not a matrix.** Each spec file proves what only a browser
  can show for one feature; breadth and edge cases stay in unit tests, where
  they are cheap.
- **Parallel everywhere** (`fullyParallel`): 4 workers in CI, one per vCPU of the GitHub runner,
  and Playwright's default locally. Tests stay independent because each opens a fresh browser
  context, so a fresh guest owner whose designs no other test sees.
- **Guests are liveworkspace guests**, as in production
  ([Auth + guest access](../014-identity/auth-and-guest-access.md) "Guests"). The stack's accounts
  stand-in answers the guest handoff with a guest token, and a spec seeds through one: `mintGuest` +
  `ownerHeaders` (its token as the Bearer) for Playwright requests, `adoptGuest` to put it where the
  page keeps it, and `designHeaders` to add the index's grant on a design as `X-Index-Grant`
  (`apps/live/e2e/fixtures.ts`).
- **A guest's `/new` is This Browser**, as in production ([Save Locations](../006-design/save-locations.md#the-default-depends-on-who-is-creating)),
  and the index holds no item for it, so its grant request answers 404. A spec that needs its new design on the
  server (it seeds it through the api with `seedTab`, watches the api's saves, or shares it) opens `/new` through
  `serverNewUrl`, which keeps the page's adopted guest (or adopts a minted one) and adds a `?folder=` of theirs, the
  placement that makes `/new` create on livedesign whoever is creating. `openStartBlank` and `startBlankDesign` do
  it for every caller; a spec that means the guest's own create opens `/new` itself. `e2e/server-new.test.ts` holds
  every spec that seeds through the api to it.
- **Sharded** (`--shard=i/6`, the matrix in `e2e-product.yml`): Playwright splits the `chromium` project's
  tests evenly by count across six jobs; each boots its own stack, so shards share nothing.
- **Shards sized to the floor, not beyond.** Every shard pays about two minutes before its first
  test (container, install, the live build), and the Sites audit, which cannot be split, takes
  about 4.5 minutes. The shard count is the smallest that keeps the slowest shard within that
  floor: more shards finish no sooner, and each takes one of the account's 20 concurrent runner
  slots that every other pull request's run waits on. When the suite grows past the floor, the
  shard count grows with it.
- **No type check in the builds**: `e2e-product.yml` sets `BUILD_SKIP_TYPECHECK=1`, so `next build` skips its
  own type check (`typescriptConfig()` in `@liveworkspace/next-config`, shared by the five Next
  apps). CI's Checks job already type-checks every app with `tsc --noEmit` against the
  same tsconfig; repeating it cost each live build about 40 seconds. Deploys leave it unset.
- **A warm build cache**: each job restores Turbopack's build cache (`.next/cache`) from the latest
  run on `main` before it builds, so it compiles only what changed
  (`.github/actions/next-cache-restore`, the one place its key is made). Only runs on `main` save it,
  keyed by version, lockfile and commit, one copy per set of builds (`livedesign-live`,
  `livedesign-live-signed-in`, `livedesign-sites`); pull requests read it and never write their own, so they cannot evict it. Turbopack
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
  their `-signed-in` twins), since a run clears its output folder when it starts. `e2e-product.yml`
  uploads them whenever any holds a trace, a timed-out run included, one artefact per job
  (`livedesign-playwright-report-shard-i`, `livedesign-playwright-report-sites`, `livedesign-playwright-report-signed-in`). Locally a trace is kept for a
  retry only.
- **No waiting on what is not coming.** A helper waits for a thing only when the app owes it:
  `dismissQuickTour` does nothing, since no tour offers itself (kept so the specs that call it need not change). `seedTab` returns once the seeded elements have
  finished popping in (`settledBox`), so a test never measures or drags a box that is still changing.

## The stack under test

The suite runs against the **real production build**, the live app's
`output: 'export'` static bundle plus the real api worker with its Durable Objects in local storage,
so it exercises exactly what ships, not a dev-only code path.
The stack serves whatever `apps/live/out` holds and never rebuilds it, so locally run
`pnpm --filter @livedesign/live build` first; an old `out/` fails audits for code that has since changed.

`scripts/e2e-stack.mjs` boots the stack Playwright's `webServer` waits on:

1. **api**: `wrangler dev --local` (`apps/api`) on a fixed port. Each design's
   and each person's Durable Object keeps its own SQLite in wrangler's local
   storage, so persistence works with no setup step.
   `TELEMETRY_ENABLED` unset (the suite asserts on the app, not the
   events pipe).
2. **live**: the static `apps/live/out` served by a minimal Node
   server that reproduces the three things the production router +
   live worker do (so clean routes and the design placeholder resolve
   identically to prod):
   - strip the `/live` `assetPrefix` so `/live/_next/*` resolves to
     `out/_next/*`;
   - rewrite every `/design/<id>` to the single placeholder
     `out/design/[id].html` ([Dedicated route for new-design creation](../007-editor/new-design-route.md): one HTML backs every design
     URL);
   - proxy `/api/*` to the api worker, WebSocket upgrades included (the realtime room), so the app is same-origin (no CORS
     surprises, mirroring the router);
   - serve `apps/help/out` under `/help/*`, its basePath, as the router mounts it (the telemetry dashboard is liveworkspace's, a page of `../liveworkspace/apps/site`); a missing build answers a logged 404;
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
3. **marketing**: `apps/marketing/out` on its own port (`E2E_MARKETING_PORT`, default `3413`),
   since marketing owns `/` in production.

The stack also runs the editor alone beside a running one (`E2E_LIVE_ONLY`,
`E2E_LIVE_PORT`, `E2E_API_PORT`); see
[Local development](../../development/local-development.md).

Locally the same `playwright.config.ts` sets `reuseExistingServer`, so a
developer with `pnpm dev` already running (live :3402 + api :8989) runs
`pnpm --filter @livedesign/live test:e2e` against that stack with no
extra boot.

## Signed-in specs

Sign-in is a build-time switch ([Auth + guest access](../014-identity/auth-and-guest-access.md)), so the
guest-mode `out/` can never show a signed-in user. The specs in `apps/live/e2e/signed-in/` run
against a second export, `apps/live/.next/out-signed-in/` (inside `.next/`, so every ignore and
source scanner already skips it), built by `pnpm build:signed-in` with sign-in on and
`NEXT_PUBLIC_E2E_AUTH=1`, which swaps the accounts bridge for the test-only `E2EAuthBridge`. Each
spec puts a session in `localStorage` (`installSession` in `e2e/signed-in/session.ts`) before the
page loads, so a chosen user (name, email) is signed in with no accounts Worker, secret or network.

`pnpm --filter @livedesign/live test:e2e:signed-in` sets `E2E_SIGNED_IN=1`, which adds the
`signed-in` project and boots the stack with `E2E_LIVE_OUT=.next/out-signed-in` on its own ports
(live `:3415`, api `:8415`, marketing `:3416`), so a guest stack already up on `:3402` is never
reused for it. The stack also stands in for the accounts Worker (`E2E_ACCOUNTS_STUB=1`): it makes a
signing key at boot, serves its JWKS on the issuer's own path (`/e2e/accounts/api/auth/jwks`),
starts the api worker with `ACCOUNTS_URL` and `API_RESOURCE` pointing at it, and mints an access
token with that issuer and audience for any test account on `/e2e/token?sub=user_…`, which
`installSession` hands the bridge. API tokens are the liveworkspace account's too: a spec seeds one at
`POST /e2e/accounts/__seed/token` (its `secret` is the `lwt_…` an agent sends), and the api checks it through the
account API's `tokens/verify` as in production. Display names are the account's profiles: the api writes and reads them
through the account API's `profiles/write` and `profiles/read`, so an agent's changes and comments carry the name the
person set (`packages/auth-client/src/e2e-token-stand-in.ts` answers both, shared by every app's stack). So a stub account is a real verified account to the api and the
realtime room, and two or three stub browsers can collaborate in one design. A test that changes an
account's synced settings takes a fresh id (`freshUserId`), since the stack outlives a test. `e2e-product.yml` builds and runs them in their own job, beside the smoke shards.

The sign-in round trip itself (`/api/auth/*` against the accounts Worker) is covered by the api's unit
tests (`apps/api/src/routes/auth.test.ts`), not here.

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
**`expectNoPageErrors(pageErrors)`**, which fails naming what leaked. A Trusted Types violation is one of them:
the page logs `[trusted-types] violation` as an error ([Trusted Types](../016-platform/trusted-types.md)).

The same `test` sets the editor's debug flag (`livedesign:debug` = `*`) on its browser
context before any page loads, so the production build the suite drives writes its trace lines
([Console logging](console-logging.md)) and a spec may wait for one (`[arrow-rebind] trigger`).
A spec that opens its own context with `browser.newContext()` sets it there with
`enableDebugLogs(context)`.

## What the suite asserts

One spec file per feature, each linking the spec it proves:

| File                              | What only a browser can show                                                                                                                                                                                                                                                                                                                                                 | Spec                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `smoke.spec.ts`                   | `/new` makes a design and opens on its start, with no apps menu in the header; `/explorer` renders for a guest; create a blank design, add a shape, label it, and it survives a reload                                                                                                                                                                                       | this spec, [Canvas accessibility](../004-interface-design/canvas-accessibility.md)                            |
| `save-failure.spec.ts`            | an autosave refused as unauthenticated says so, then the next edit saves again                                                                                                                                                                                                                                                                                               | [Per-tab storage](../006-design/per-tab-storage.md)                                                           |
| `realtime-peers.spec.ts`          | an owner and an edit-link visitor see each other, edit live, keep both people's edits across a reload                                                                                                                                                                                                                                                                        | [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)                          |
| `realtime-same-element.spec.ts`   | two peers dragging the same element at once end on the same position on both screens                                                                                                                                                                                                                                                                                         | [Realtime conflict resolution](../012-collaboration/realtime-conflict-resolution.md)                          |
| `tab-scoped-share.spec.ts`        | a tab-scoped link opens its tab and nothing else; the owner is never scoped                                                                                                                                                                                                                                                                                                  | [Tab-scoped share links](../013-workspace/tab-scoped-share-links.md)                                          |
| `arrow-labels.spec.ts`            | a label sits on its broken-open line; double-clicks edit rather than bend; Shift+Enter and Enter; blank lines keep their height                                                                                                                                                                                                                                              | [Arrow labels](../008-canvas/arrow-labels.md), [Arrow bending](../008-canvas/arrow-bending.md)                |
| `arrow-rebind.spec.ts`            | arrows re-anchor live while dragging, keep a quarter point on the new side, and the Settings switch turns it off                                                                                                                                                                                                                                                             | [Arrow anchors](../008-canvas/arrow-anchors.md)                                                               |
| `grips-on-top.spec.ts`            | a selected element's resize handles and an arrow's end grips are the topmost thing at their centres, whatever the element's rotation, opacity or animation and whatever is drawn over it                                                                                                                                                                                     | [Canvas and palette](../008-canvas/canvas-and-palette.md) (Resize)                                            |
| `viewport-on-add.spec.ts`         | the first element dropped on an empty tab stays where it was dropped; a reloaded tab is framed on its content                                                                                                                                                                                                                                                                | [Canvas and palette](../008-canvas/canvas-and-palette.md)                                                     |
| `palette-drag.spec.ts`            | a tile in a category's More popover on the Toolbar strip drags onto the canvas, whatever its catalogue: a shape, and a line icon and a sticker found by their own catalogue's search                                                                                                                                                                                         | [Palette drag ghost](../010-palette/palette-drag-ghost.md), [Toolbar layout](../007-editor/toolbar-layout.md) |
| `quick-style-panel.spec.ts`       | one-click styles, the left-edge placement, swatch targets, and custom swatch overrides                                                                                                                                                                                                                                                                                       | [Quick style panel](../008-canvas/quick-style-panel.md)                                                       |
| `multicolour-theme.spec.ts`       | a multi-colour theme gives its elements their palette colours                                                                                                                                                                                                                                                                                                                | [Multi-colour themes](../011-theme/multicolour-themes.md)                                                     |
| `appearance.spec.ts`              | the appearance opens on the device setting and cycles, never writes to the design, tells Dark Reader to stand down, and is remembered before first paint                                                                                                                                                                                                                     | [Live app](../007-editor/live-app.md)                                                                         |
| `power-user-mode.spec.ts`         | the role pill toggles a read-only preview; Minimal chrome hides words; switching off restores untouched settings                                                                                                                                                                                                                                                             | [Power user mode](../007-editor/power-user-mode.md)                                                           |
| `settings-memory.spec.ts`         | Settings reopens on the last category and row, across a resize and deep inside a tall row                                                                                                                                                                                                                                                                                    | [User preferences](../007-editor/user-preferences.md)                                                         |
| `hints.spec.ts`                   | a palette tile's tooltip after a 500 ms hover, at once on focus, Escape, pointer onto it; hover cards                                                                                                                                                                                                                                                                        | [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md)                |
| `icon-weight.spec.ts`             | icons draw regular by default and bold once chosen, across a reload; chrome glyphs keep the house weight in on-screen px                                                                                                                                                                                                                                                     | [Iconography](../004-interface-design/iconography.md)                                                         |
| `scrollbars.spec.ts`              | every scrolling surface is in-theme, per colour scheme                                                                                                                                                                                                                                                                                                                       | [Scrollbars](../004-interface-design/scrollbars.md)                                                           |
| `motion-budget.spec.ts`           | every chrome animation (menus, dropdowns, context menu, Settings, Search) settles within 250ms, delay included; under reduced motion each is instant                                                                                                                                                                                                                         | [Motion](../004-interface-design/motion.md)                                                                   |
| `contrast-audit.spec.ts`          | dark mode, on `/new`, the editor with its panels and dialogs, and the Join dialog: every visible text node meets WCAG AA (4.5:1, or 3:1 for large text) against the background actually painted under it; no allow-list, and what cannot be measured honestly (glyphs under 6px, disabled controls, hidden text, filtered art, text over an image) is reported, never failed | [Colour scheme](../004-interface-design/color-scheme.md#accessibility)                                        |
| `optical-audit.spec.ts`           | dark mode at 4x, on `/new`, the editor with its default panels and with a shape selected, Settings, Share and the Join dialog: every glyph in a small painted shape sits within 0.5px of its centre and stacked actions share one baseline; each failure names the shape, the offset and why it was held to centring                                                         | [Optical alignment](../004-interface-design/optical-alignment.md)                                             |
| `optical-audit-sites.spec.ts`     | the same audit on the help centre and the marketing site                                                                                                                                                                                                                                                                                                                     | [Optical alignment](../004-interface-design/optical-alignment.md)                                             |
| `marketing-header-fit.spec.ts`    | the marketing header fits a 320, 360, 390 and 430px phone: no sideways scroll, the CTA keeps its 16px gutter (in the `sites` project, which builds marketing)                                                                                                                                                                                                                | [Marketing site](../019-marketing/marketing-site.md)                                                          |
| `optical-clip.spec.ts`            | a trimmed label that also truncates keeps its descenders, proven in pixels across the label's own columns                                                                                                                                                                                                                                                                    | [Optical alignment blueprint](../004-interface-design/blueprints/optical-alignment.md)                        |
| `shape-stroke-inside.spec.ts`     | every shape drawn to its box edge paints no stroke outside it, in pixels                                                                                                                                                                                                                                                                                                     | [Canvas and palette](../008-canvas/canvas-and-palette.md)                                                     |
| `explorer.spec.ts`                | the shared Explorer at `/explorer`, through `/api/index` on this origin: make, rename, open, find in Recent, star and file a design ([One Explorer](../../../../liveworkspace/docs/specs/004-index/one-explorer.md))                                                                                                                                                         |
| `legacy-offline-store.spec.ts`    | offline designs saved in the older IndexedDB store move to `designs` and stay listed and openable ([Offline mode](../006-design/offline-mode.md))                                                                                                                                                                                                                            |
| `select-clicks.spec.ts`           | only Shift adds to a selection; a plain click on a member selects it alone; a drag still moves and a double-click still edits                                                                                                                                                                                                                                                |
| `selection-chrome.spec.ts`        | the selection chrome follows the selection store through select, select-all, a free arrow, delete and undo ([Canvas performance](../008-canvas/canvas-performance.md))                                                                                                                                                                                                       |
| `canvas-still.spec.ts`            | a still canvas with a selection asks for no animation frames, counted not timed ([Canvas performance](../008-canvas/canvas-performance.md))                                                                                                                                                                                                                                  |
| `chrome-drift.spec.ts`            | editing a label past the canvas's edge never scrolls the canvas or moves the corner chrome                                                                                                                                                                                                                                                                                   |
| `drag-preview.spec.ts`            | a drag moves the box and its pinned arrow on screen and writes once, on release; Escape puts it back; one undo ([Drag preview](../008-canvas/drag-preview.md))                                                                                                                                                                                                               |
| `drag-live.spec.ts`               | a collaborator sees a box move while it is dragged, before anything is saved, and land where it was released                                                                                                                                                                                                                                                                 |
| `quick-style-swatch-rows.spec.ts` | a swatch row never wraps and is never clipped ([Quick style panel](../008-canvas/quick-style-panel.md))                                                                                                                                                                                                                                                                      |
| `menu-keyboard.spec.ts`           | command and control menus by keyboard alone ([Menus](../004-interface-design/menus.md))                                                                                                                                                                                                                                                                                      |
| `optical-snap.spec.ts`            | the browser paints text baselines where the optical audit's snap guard says ([Optical alignment](../004-interface-design/optical-alignment.md))                                                                                                                                                                                                                              |
| `photo-gpu-parity.spec.ts`        | the photo compositor draws on the GPU what the export draws on the CPU ([Photo engine](../031-photo/blueprints/photo-engine.md))                                                                                                                                                                                                                                             |
| `new-version-prompt.spec.ts`      | a newer server's format number offers a reload, only once the edits are saved ([New version prompt](../016-platform/new-version-prompt.md))                                                                                                                                                                                                                                  |
| `stale-builds.spec.ts`            | after a simulated deploy, missing chunks and a newer build id recover with a reload ([Stale builds](../016-platform/stale-builds.md))                                                                                                                                                                                                                                        |
| `stale-html.spec.ts`              | back to a cached Explorer page after a deploy loads the current build ([Stale builds](../016-platform/stale-builds.md))                                                                                                                                                                                                                                                      |
| `workbench-embed.spec.ts`         | opt-in (`E2E_WORKBENCH=1`): a fake workbench frames the editor through pairing and a ticket ([Workbench embeds](../013-workspace/workbench-embeds.md))                                                                                                                                                                                                                       |
| `workbench-workspace.spec.ts`     | opt-in (`E2E_WORKBENCH=1`): the workspace scope's own approval, and the Explorer in the frame                                                                                                                                                                                                                                                                                |

A new browser-risky feature adds one focused spec file here (or a case in the
file of the feature it extends), linked from its own spec; depth stays in unit
tests where it's cheap.

## Layout

- `apps/live/playwright.config.ts`: the `chromium` and `sites` projects (plus the opt-in ones),
  `webServer` → `scripts/e2e-stack.mjs`, `reuseExistingServer` locally.
- `apps/live/e2e/*.spec.ts`: the spec files above. Playwright collects only `.spec.ts` (`testMatch`); a
  `.test.ts` beside them is a Vitest unit test of a pure helper (`optical-snap.test.ts`, `perf/*.test.ts`),
  which `vitest.config.ts` runs and Playwright never loads.
- `apps/live/e2e/fixtures.ts`: the `test` with its `pageErrors` fixture, `expectNoPageErrors`, and the
  shared flows (`openStartBlank`, `startBlankDesign`, `seedTab`, `dismissQuickTour`).
- `apps/live/e2e/fixtures/`: `audit-screens.ts`, `contrast.ts`, `optical.ts` and `optical-discover.ts`: the screens and measurements the dark-mode audits share.
- `scripts/e2e-stack.mjs`: the stack boot + static serve (live, help, marketing).
- The root `.github/workflows/e2e.yml` and `e2e-product.yml`: the sharded workflow, run on every pull request;
  the root `.github/actions/e2e-setup/`: the setup its jobs share (pnpm, Node, install, image check).
- `test:e2e`, `test:e2e:smoke`, `test:e2e:sites` and `test:e2e:signed-in` scripts in `apps/live/package.json`; `build:signed-in`
  (`apps/live/scripts/build-signed-in.mjs`) builds the export the latter runs against.
- `apps/live/e2e/signed-in/`: the session helper and the signed-in specs.

Playwright is an `apps/live` dev dependency; it is **not** wired into
`pnpm test` / `turbo run test` (that stays the fast unit gate), so
the E2E workflow is the only thing that runs it in CI.
