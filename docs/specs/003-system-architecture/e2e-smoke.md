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

## Why it's separate from CI's unit gate

Browser E2E costs real CI minutes (a browser download + a running
stack), so it is **deliberately not on the per-PR critical path**. The
`ci.yml` gate (lint / format / typecheck / test / build) stays fast and
runs on every PR and push. The browser suite is its own workflow,
`e2e.yml` (named **E2E Smoke**), triggered on:

- **push to `main`**: a post-merge run, so a regression that slipped
  a green unit gate is caught within one merge; and
- **`workflow_dispatch`**: run it by hand against a branch before merge
  when a change is browser-risky.

It runs **every** spec file in `apps/live/e2e/` (`test:e2e` is
`playwright test --project=chromium`, with no filter).

Cost controls, all in `e2e.yml` and `playwright.config.ts`:

- **Chromium only** (`--project=chromium`); no Firefox / WebKit. A `webkit` project exists
  only when `E2E_WEBKIT=1` is set (after `playwright install webkit`) and runs just
  `import-images.spec.ts`, the image import pipeline's Safari path
  ([Import image pipeline](../020-import-export/import-image-pipeline.md)); CI never sets it.
- **Browser binary cached** on `~/.cache/ms-playwright` keyed by the
  Playwright version, so the ~120 MB download happens once per version
  bump, not per run.
- **Focused tests, not a matrix.** Each spec file proves what only a browser
  can show for one feature; breadth and edge cases stay in unit tests, where
  they are cheap.
- `workers: 1` and `retries: 1` in CI, a 30-second per-test timeout and a
  15-minute job timeout, so a hung run fails fast instead of burning minutes.
- `fullyParallel` locally for authoring speed.
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
   live worker do (so clean routes and the diagram placeholder resolve
   identically to prod):
   - strip the `/live` `assetPrefix` so `/live/_next/*` resolves to
     `out/_next/*`;
   - rewrite every `/diagram/<id>` to the single placeholder
     `out/diagram/[id].html` ([Dedicated route for new-diagram creation](../007-editor/new-document-route.md): one HTML backs every diagram
     URL);
   - proxy `/api/*` to the api worker, WebSocket upgrades included (the realtime room), so the app is same-origin (no CORS
     surprises, mirroring the router);
   - serve `apps/help/out` under `/help/*` and `apps/telemetry/out` under `/telemetry/*`, their
     basePaths, as the router mounts them; a missing build answers a logged 404.
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
| `viewport-on-add.spec.ts`      | the first element dropped on an empty tab stays where it was dropped; a reloaded tab is framed on its content                                                                                                                                                                                                                                                                                 | [Canvas and palette](../008-canvas/canvas-and-palette.md)                                                                                              |
| `palette-drag.spec.ts`         | a row found by searching the Toolbar strip's More popover drags onto the canvas, whatever its catalogue                                                                                                                                                                                                                                                                                       | [Palette drag ghost](../010-palette/palette-drag-ghost.md), [Toolbar layout](../007-editor/toolbar-layout.md)                                          |
| `quick-style-panel.spec.ts`    | one-click styles, the floating and toolbar docking, swatch targets, and custom swatch overrides                                                                                                                                                                                                                                                                                               | [Quick style panel](../008-canvas/quick-style-panel.md)                                                                                                |
| `multicolour-theme.spec.ts`    | Rainbow gives each limb of a mind map its own palette colour                                                                                                                                                                                                                                                                                                                                  | [Multi-colour themes](../011-theme/multicolour-themes.md)                                                                                              |
| `appearance.spec.ts`           | the appearance opens on the device setting and cycles, never writes to the diagram, tells Dark Reader to stand down, and is remembered before first paint                                                                                                                                                                                                                                     | [Live app](../007-editor/live-app.md)                                                                                                                  |
| `power-user-mode.spec.ts`      | the role pill toggles a read-only preview; Minimal chrome hides words; switching off restores untouched settings                                                                                                                                                                                                                                                                              | [Power user mode](../007-editor/power-user-mode.md)                                                                                                    |
| `settings-memory.spec.ts`      | Settings reopens on the last category and row, across a resize and deep inside a tall row                                                                                                                                                                                                                                                                                                     | [User preferences](../007-editor/user-preferences.md)                                                                                                  |
| `hints.spec.ts`                | a palette tile's tooltip after a 1 s hover, at once on focus, Escape, pointer onto it; hover cards                                                                                                                                                                                                                                                                                            | [Tooltips, hover cards and popovers](../004-interface-design/tooltips-hover-cards-popovers.md)                                                         |
| `icon-weight.spec.ts`          | icons draw regular by default and bold once chosen, across a reload; chrome glyphs keep the house weight in on-screen px                                                                                                                                                                                                                                                                      | [Iconography](../004-interface-design/iconography.md)                                                                                                  |
| `scrollbars.spec.ts`           | every scrolling surface is in-theme, per colour scheme                                                                                                                                                                                                                                                                                                                                        | [Scrollbars](../004-interface-design/scrollbars.md)                                                                                                    |
| `motion-budget.spec.ts`        | every chrome animation (menus, dropdowns, context menu, Settings, Search) settles within 250ms, delay included; under reduced motion each is instant                                                                                                                                                                                                                                          | [Motion](../004-interface-design/motion.md)                                                                                                            |
| `contrast-audit.spec.ts`       | dark mode, on the wizard, the editor with its panels and dialogs, the Join dialog and the Explorer: every visible text node meets WCAG AA (4.5:1, or 3:1 for large text) against the background actually painted under it; no allow-list, and what cannot be measured honestly (glyphs under 6px, disabled controls, hidden text, filtered art, text over an image) is reported, never failed | [Colour scheme](../004-interface-design/color-scheme.md#accessibility)                                                                                 |
| `optical-audit.spec.ts`        | dark mode at 4x, on the wizard, the editor and its dialogs, the Join dialog and the Explorer: every glyph in a small painted shape sits within 0.5px of its centre and stacked actions share one baseline; each failure names the shape, the offset and why it was held to centring                                                                                                           | [Optical alignment](../004-interface-design/optical-alignment.md)                                                                                      |
| `optical-audit-sites.spec.ts`  | the same audit on the help centre, the telemetry dashboard and the marketing site                                                                                                                                                                                                                                                                                                             | [Optical alignment](../004-interface-design/optical-alignment.md)                                                                                      |
| `optical-clip.spec.ts`         | a trimmed label that also truncates keeps its descenders, proven in pixels                                                                                                                                                                                                                                                                                                                    | [Optical alignment blueprint](../004-interface-design/blueprints/optical-alignment.md)                                                                 |

A new browser-risky feature adds one focused spec file here (or a case in the
file of the feature it extends), linked from its own spec; depth stays in unit
tests where it's cheap.

## Layout

- `apps/live/playwright.config.ts`: chromium project (plus the opt-in webkit one), `webServer` →
  `scripts/e2e-stack.mjs`, `reuseExistingServer` locally.
- `apps/live/e2e/*.spec.ts`: the spec files above.
- `apps/live/e2e/fixtures.ts`: the `test` with its `pageErrors` fixture, `expectNoPageErrors`, and the
  shared flows (`startBlankDiagram`, `startTemplateDiagram`, `startEventStormingRow`, `seedTab`,
  `dismissQuickTour`, `openJustDraw`). `startTemplateDiagram` exists because the blank helper skips the
  wizard's category step and so never exercises template creation.
- `apps/live/e2e/fixtures/`: drawn wall photos for the photo import; `audit-screens.ts`, `contrast.ts`,
  `optical.ts` and `optical-discover.ts`: the screens and measurements the dark-mode audits share.
- `scripts/e2e-stack.mjs`: the stack boot + static serve (live, help, telemetry, marketing).
- `.github/workflows/e2e.yml`: the cost-controlled workflow.
- `test:e2e` script in `apps/live/package.json`.

Playwright is an `apps/live` dev dependency; it is **not** wired into
`pnpm test` / `turbo run test` (that stays the fast unit gate), so
`e2e.yml` is the only thing that runs it in CI.
