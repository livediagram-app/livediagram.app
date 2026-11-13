# @liveworkspace/workbench

The editor code the four editors share: `livediagram/apps/editor`, `liveplanner/apps/editor`,
`livedocuments/apps/editor` and `livedesign/apps/live`. It is step 4 of
[docs/structure.md](../../docs/structure.md), the editor shell carved out of each `apps/editor` one area
at a time.

## What belongs here

Editor code that reads the same in every editor and names no product:

- it imports only other workbench modules, the shared `@liveworkspace/*` packages and npm packages,
  never `@livediagram/*`, `@liveplanner/*`, `@livedocuments/*` or `@livedesign/*`, and never a file
  of an editor;
- its tests come with it, and run here.

The folders keep the editor's layout (`lib/…`, `hooks/ui/…`, `hooks/canvas/…`, `components/primitives/…`,
`components/canvas/…`, `components/tour/…` and so on), so a module's place here says where it came from.

A shared name from the design system is imported from `@liveworkspace/ui`, not through a product's
`@<product>/ui` (which re-exports it unchanged). A name a product's ui binds for itself (`SiteFooter`,
`IDENTITY_FILL`, `Brand`) is a product import, so a module using one stays in the editor. Comments
here are product-neutral: they cite a product spec by the path the products share
(`docs/specs/007-editor/editor-app.md`, `live-app.md` in livedesign) rather than one product's nouns.

Code that differs per product stays in the product. A module moves once it reads the same in every
editor that has it (two or more), and the product's part of it is handed in:

- **as props or arguments**, for a value or a callback (a label, a URL, what to do on click). Copy that
  differs only by the product's noun takes the noun (`noun="design"`), and the editor keeps a thin door
  at the old path that binds it (`components/chrome/NotFound.tsx`), so its callers and its words stay
  as they were;
- **as a small injected module** for anything wider: the workbench exports a `createX(config)` or a
  context, and each editor binds it once in a file of its own (`lib/x.ts` calling `createX` with its
  facts), the way `@liveworkspace/telemetry-client` and `@liveworkspace/help-registry` are bound;
- **as a binding**, for the few product facts that many modules read at run time (its telemetry, its
  storage keys, its api transport). See below.

Three larger modules are made per editor by a `createX(config)` or take the editor's nouns as config, each bound
once in the editor's file at the old path: the search panel's results (`lib/editor-search/build-search-results`,
bound in each `lib/search.ts`), the api client's core (`lib/api/core`'s `createApiCore`, bound in each
`lib/api/core.ts`, which keeps its function exports so an import cycle still finds them) and the start panel
(`components/start/StartPanel`'s `createStartPanel`, bound in each `components/start/StartPanel.tsx`).

Several chrome and canvas modules are made the same way, once per editor at module scope in its file at the old
path, so each is one stable component or hook and the editor's component tree is as it was: the style presets
(`components/palette/StylePresets`'s `createStylePresets`, around the editor's `SizeButton` and `ShapeGlyph`), the
context menu's tile grids (`components/palette/context-menu-tiles`'s `createContextMenuTiles` and `createFlowTiles`),
the movable panel (`components/primitives/MovablePanel`'s `createMovablePanel`, around its help-article link and
popover top clearance; its props in `MovablePanel.types`), the canvas's label renderers
(`components/canvas/element-label-views`'s `createLabelViews`, around the label typography and Text animation units),
the lazy per-tab load (`hooks/persistence/usePerTabLoad`'s `createPerTabLoad`, around the tab GET, `track` and
timing), the canvas backdrop (`lib/canvas-backgrounds`'s `createCanvasBackgrounds`, around the seasonal motifs) and
the Looks' lookup and match (`lib/tab-looks`'s `createTabLooks`, over the editor's own catalogue).

The canvas surface's press routing (`hooks/canvas/useCanvasSurfaceGestures`) is one hook that takes the editor's
arguments and a small module-scope options object: livedocuments, livedesign and liveplanner each bind it in their
`hooks/canvas/useCanvasSurfaceGestures.ts` (livedesign ignores a portal's press on `<main>`, liveplanner a press on
its board's cover); a tool an editor lacks never matches, so its branch never runs there. livediagram's (whiteboard
pen routing, Isometric orbits) and livehuddle's (Avatar mode walks) interleave too much of their own to share and stay
in those editors. Each Canvas focuses its surface on mount through `hooks/canvas/useFocusCanvasOnMount`.

The palette and chrome components the editors carried in the same words are made the same way, each bound once at
module scope in the editor's file at the old path, so its callers and its tree are as they were: the catalogue tabs
(`components/palette/StickerPickerTab`, `IconPickerTab`, `TechPickerTab`, around the editor's drag types, IconButton,
artwork and `PaletteCategoryBrowser`, typed in `category-browser-types`), the Tools rows and groups
(`PaletteToolRows`, `PaletteTileGroup`) and the strip's opener panel (`StripOpenerPanel`), typed on the editor's own
tiles, actions and pending draw; the mode panels (`components/panels/LaserPanel`, `SpotlightPanel`, `EraserPanel`,
around the editor's `ModePanel` and its placement props); the theme card and list
(`components/palette/theme-picker-cards`, `ThemeBrowser`), the colour popover (`components/colour/ColourPopover`,
around the editor's `ColourPicker`) and the animation tile (`components/palette/AnimationPreviewTile`, around its
`SizeButton`); the auth pages' cards (`components/chrome/auth-cards`, around the editor's Night Band frame and pitch,
with the return-path rules beside them in `auth-routes`), the deferred-auth provider
(`components/providers/auth-provider`, around the bridges the editor loads with `next/dynamic` itself), the settings
test pane, the palette chrome hook, the canvas's view readers, the drag ghost and the search panel's sources. The
Explorer's lazy load shares its loader (`components/panels/explorer-loader`) while each editor keeps its
`next/dynamic` call. Telemetry stays in the editors: a component whose events the editor's telemetry scan counts (the
Show Me tours, the strip's rail items, AreaErrorBoundary) is not moved.

The Export Tab dialog's frame, format grid and image-preview load (`components/dialogs/export-tab-dialog`'s
`exportTabDialogFrame` and `useExportPreviewImages`) are called by every editor's
`components/dialogs/ExportTabDialog.tsx`, which keeps its own formats, panels, telemetry and copy. The frame is a plain
function returning the editor's tree, not a component, so the dialog's tree is as it was; liveplanner draws no bitmaps
and keeps its own preview load. A tab export's file name (`lib/tab-export-name`) takes the editor's noun for its
fallback (livediagram, livehuddle, livedesign; livedocuments and liveplanner keep their own name rules). Each
`EditorView` reads its UI scales and guest sign-in nudge through `hooks/ui/useEditorUiScales` and
`hooks/ui/useSignInNudge` (given the editor's dismiss key, and whether zen mode hides it), and each `app/new/page.tsx`
its commit identity through `hooks/persistence/useResolveSelf`; livedocuments, livedesign and liveplanner also back out
of a restored `/new` through `hooks/ui/useBackOutOnRestore` (livediagram and livehuddle back out their own way).

Never by importing the product: a workbench module that needs `@<product>/…` is not ready to move.

## Bindings

`src/bindings.ts` holds what an editor tells the workbench once, at startup, rather than threading it
through props: each editor's `lib/workbench-bindings.ts` calls `configureWorkbench({ … })` with its
facts, and workbench code reads them through `workbench` (`workbench.track(…)`,
`workbench.debugKey`), never through the product's own module.

| Binding                    | What it is                                                                                              | Read by                                                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debugKey`                 | the localStorage key of the debug flag (`<product>:debug`)                                              | `lib/debug-log`                                                                                                                                                                                                                                                |
| `track`                    | the product's telemetry `track`, typed on the events workbench code sends                               | `lib/stale-build-navigation`, `components/chrome/NewVersionPrompt`, `hooks/canvas/useZoomControls`, `hooks/collab/useHideCursors`, the Format and Spotlight config hooks, `hooks/canvas/useDebouncedCanvasTelemetry`, `hooks/persistence/tab-folder-reporting` |
| `reloadGuardKey`           | the sessionStorage key of the one reload guard (`<product>:stale-chunk-reloads`)                        | `lib/reload-guard`                                                                                                                                                                                                                                             |
| `appRecoveryFlag`          | the window flag the app's chunk recovery sets (`__<product>ChunkRecovery`)                              | `lib/stale-build-navigation`                                                                                                                                                                                                                                   |
| `formatLogScope`           | the fingerprint of the stored format (`document-format`, `project-format`, …)                           | `lib/reload-when-saved`, `components/chrome/NewVersionPrompt`, `hooks/ui/useNewerEditorLive`                                                                                                                                                                   |
| `runningStaleBuild`        | whether this page runs an older build than the live one (the product's server-release)                  | `lib/stale-build-navigation`                                                                                                                                                                                                                                   |
| `readPreferences`          | the person's preferences, as far as workbench code reads them (`reduceMotion`, `notificationsEnabled`)  | `hooks/ui/useReduceMotion`, `hooks/ui/useToast`                                                                                                                                                                                                                |
| `api`                      | the product's api transport: `fetch`, `headers`, `expectOk`, `expectOkVoid`, `currentBearer`            | `lib/api/oauth`, `lib/api/tokens`, `lib/index-client`, `lib/explorer-teams-host`                                                                                                                                                                               |
| `zoomMax`                  | the canvas's zoom ceiling now (livedesign raises it for a photo page)                                   | `lib/double-tap-zoom`, `hooks/canvas/useZoomControls`                                                                                                                                                                                                          |
| `openSettingsEvent`        | the window event asking the host to open Settings (`<product>:open-settings`)                           | `lib/open-settings`, `hooks/ui/useOpenSettingsRequests`                                                                                                                                                                                                        |
| `panelPresenceEvent`       | the window event a panel sends as it arrives or leaves (`<product>:panel-presence`)                     | `lib/panel-presence`, livediagram's `hooks/ui/useQuickStylePlacement`                                                                                                                                                                                          |
| `panelLayoutEvent`         | the window event the panel layout sends as it is written (its `PANEL_LAYOUT_CHANGED_EVENT`)             | livediagram's `hooks/ui/useQuickStylePlacement`                                                                                                                                                                                                                |
| `startQueryKey`            | the sessionStorage key of the search handed to the next start (`<product>:v2:start-query`)              | `components/start/start-query`                                                                                                                                                                                                                                 |
| `localMoveDismissedPrefix` | the localStorage prefix of the move prompt's Not Now (`<product>:v2:local-move-dismissed:`)             | `lib/offline/local-move-dismissal`                                                                                                                                                                                                                             |
| `hideCursorsKey`           | the localStorage key of the Hide Participant Cursors switch (`<product>:v2:hide-cursors`)               | `hooks/collab/useHideCursors`                                                                                                                                                                                                                                  |
| `emptyCardDismissedKey`    | optional: the localStorage list of closed empty-tab cards (`<product>:v2:empty-card-dismissed`)         | `components/canvas/empty-card-dismissed`                                                                                                                                                                                                                       |
| `formatConfigKey`          | optional: the localStorage key of the Format panel's configuration (`<product>:v2:format-config`)       | `lib/format-config`                                                                                                                                                                                                                                            |
| `spotlightConfigKey`       | optional: the localStorage key of the Spotlight panel's configuration (`<product>:v2:spotlight-config`) | `lib/spotlight-config`                                                                                                                                                                                                                                         |

The rules:

- **Types stay precise.** `track` takes the narrow subset of events workbench code sends
  (`WorkbenchTelemetryCategory`, `WorkbenchTelemetryAction`), so a product's wider `track` binds as it
  is and typecheck fails if its vocabulary ever drops one. `readPreferences` answers the subset type
  it reads. No `any`. Where a module was the same but for a type or a constant every product
  shares, that moved here instead and the product re-exports it: `ApiError` (`lib/api/api-error`,
  re-exported by each `lib/api/core.ts`), `QuickConnectDirection` (`lib/quick-connect`) and the zoom
  bounds (`lib/zoom-range`, re-exported by each `lib/canvas.ts`); UI scale is typed on
  `UiScalePreferences`, the four keys it reads.
- **Configured before it is read.** The editor calls its `bindWorkbench()` at module scope in its
  root providers (`components/providers/AuthProvider.tsx`) and in `app/global-error.tsx`, the one
  page outside the root layout. Both evaluate before any component renders, and workbench code
  reads a binding only when it runs (an effect, a handler, a call), never at module scope, so a
  module-level singleton reads it lazily (`getToken: () => workbench.api.currentBearer()`).
- **Safe when unconfigured.** An optional binding is one only some editors run (livediagram, livedocuments and
  livedesign, not liveplanner); the others need not name it. Every binding has a typed default: `track` does nothing, the keys
  are `workbench:`-prefixed, `api` refuses with an error rather than sending an anonymous request.
  Tests run on the defaults unless they configure their own (`lib/testing/bindings` builds a full
  set from a few), and a development build warns once if workbench code reads a binding before
  `configureWorkbench`.
- **A product's facts stay the product's.** Its keys are constants in its `lib/workbench-keys.ts`
  (no imports, so its pre-boot scripts and e2e fixtures read them too); never change one in place,
  since people's saved flags live under it. A value only one component reads is a prop instead:
  `E2EAuthBridge` takes its `sessionKey` from the provider that mounts it. A drag type a product's
  drop targets match (`STICKER_DND_MIME`, `TECH_ICON_DND_MIME`) lives beside its `ICON_DND_MIME` in
  `lib/icons.ts`, so the shared catalogue modules carry none. A product difference becomes a binding value, never a
  dropped behaviour.
- **A fact one module reads is handed to that module.** Where a module differs from its copies only by one
  product fact, the editor keeps the fact and its file at the old path binds it, rather than a new global binding:
  `lib/laser-config` exports `laserConfigStorage(key)`, and each editor's `lib/laser-config.ts` re-exports the module
  and binds `loadLaserConfig` and `saveLaserConfig` under its own `<product>:v2:laser-config`, unchanged;
  `hooks/ui/useEditorAccent` exports `useEditorAccentStroke(accent)`, and each editor's `useEditorAccent(themeId)`
  hands it the stroke its own theme catalogue resolves; `lib/seasonal-looks` writes the looks as constants
  (`as const satisfies`), so each editor's `TabLook`, with its own id and pattern unions, takes them as they are and
  typecheck fails if one ever stops fitting. Hooks that send telemetry stay in the editors until the telemetry
  scan reads this package.

## Use

Every module is its own subpath, named after its path under `src/`, with no barrel:

```ts
import { createListeners } from '@liveworkspace/workbench/lib/listeners';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
```

`exports.test.ts` keeps the `exports` map in step with `src/` and keeps a barrel out, so an editor
bundles only the modules it imports.

Each editor lists the package in `transpilePackages`, and its global stylesheet scans it for classes:

```css
@source '../../../../packages/workbench/src';
```

## Guards

The editors' repo-scan guards (aria-label roles, label contrast, count badges, the palettes and so on)
read `packages/workbench/src` beside their own folders, because this code renders in every editor's
palette. The style guards that need no product (optical alignment, touch targets, the motion budget)
run here as well, in `style-guards.test.ts`.
