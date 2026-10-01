# UI scale blueprint

Derived from [UI scale](../ui-scale.md). Implementation detail only; the spec
owns every design decision.

## Domain and naming

| Term                      | Identifier                                                                |
| ------------------------- | ------------------------------------------------------------------------- |
| The master preference     | `UserPreferences.uiScale` (`apps/live/lib/user-preferences.ts`)           |
| A part                    | `UiScalePart`: `'panels'`, `'toolbar'`, `'cornerButtons'`                 |
| A part's preference       | `uiScalePanels`, `uiScaleToolbar`, `uiScaleCornerButtons`                 |
| The parts, in order       | `UI_SCALE_PARTS` (`{ id, key }`) in `apps/live/lib/ui-scale.ts`           |
| The factor in force       | "UI scale", `scale` in code; always the RESOLVED value                    |
| Every part's factor       | `UiScales`, from `resolveUiScales(prefs, { mobile })`                     |
| A slider's shown value    | `resolveUiScale(prefs)` (master), `resolveUiScalePart(prefs, part)`       |
| Writing                   | `withUiScalePatch(prefs, patch)` with `uiScalePatch` / `uiScalePartPatch` |
| Reading it in a component | `useUiScale(part)` (`apps/live/components/providers/ui-scale.tsx`)        |
| A scaled surface's style  | `uiScaleStyle(scale)` → `{ zoom }`, or `undefined` at 1                   |
| Screen px → surface px    | `toSurfacePx(px, scale)` = `px / scale`                                   |

"Screen px" are viewport pixels (`getBoundingClientRect`, `clientX`). "Surface
px" are the CSS pixels inside a zoomed surface, where every length (including
its own `left` / `top` / insets, and `vw` / `dvh`) is multiplied by the zoom
while percentages are not, and `offsetLeft` / `offsetTop` / `offsetWidth`
report surface px.

## Constants and configuration

In `apps/live/lib/ui-scale.ts`:

| Constant           | Value  | Provenance                                  |
| ------------------ | ------ | ------------------------------------------- |
| `UI_SCALE_MIN`     | `0.8`  | Spec: the floor for readable labels         |
| `UI_SCALE_MAX`     | `1.2`  | Spec: symmetric about 100% with the minimum |
| `UI_SCALE_STEP`    | `0.05` | Spec: 5% steps                              |
| `UI_SCALE_DEFAULT` | `1`    | Spec: missing key = 100%                    |

## Behaviour and state

Resolving one stored value: not a finite number → `UI_SCALE_DEFAULT`; else
clamp to `[UI_SCALE_MIN, UI_SCALE_MAX]`, snap to the nearest `UI_SCALE_STEP`,
round to 2 decimals (no `1.1500000000000001`).

`resolveUiScales(prefs, { mobile })`:

1. `mobile` true → every part `1` (`UNSCALED`).
2. Each part: its own key when present (resolved as above, so junk is 1, not
   the master), else the resolved master.

Writes go through a patch so the live preview can reuse it:

- `uiScalePatch(v)` is `{ uiScale: v }` plus every part key set to
  `undefined`; `uiScalePartPatch(part, v)` is `{ [part key]: v }`.
- `withUiScalePatch(prefs, patch)` spreads the patch and deletes the keys it
  set to `undefined`, so a cleared part is absent, not stored as null.

`UiScaleProvider` is mounted in `EditorView` beside `MinimalChromeProvider`,
fed `resolveUiScales({ ...userPreferences, ...preview }, { mobile })`, where
`preview` is the dragged slider's patch (see Interfaces). `useUiScale(part)`
returns `1` outside a provider, so the Explorer page and `/new` are
untouched. No pre-paint script: the editor reads the cached preferences
synchronously on its first render, before any scaled surface paints.

## Surfaces

Each scaled surface reads its part's scale with `useUiScale(part)`, spreads
`uiScaleStyle(scale)` into its ROOT's `style`, and converts every JS-computed
screen-px length it writes on that root or a descendant with `toSurfacePx`.
`panels`: `MovablePanel`, `QuickStylePanel`, `useDockPopovers`.
`toolbar`: `ToolbarPalette`, `ToolbarExplorerButton`.
`cornerButtons`: the cluster in `CanvasChrome`, `usePanelDock`.

- **`MovablePanel`** (both branches):
  - Free `position` stays stored in screen px; render `left` / `top` as
    `toSurfacePx(clampFree(position))`.
  - The lifted docked drag's `dockDragPos` (screen px) → `toSurfacePx`.
  - The legacy drag's start point reads `offsetLeft` / `offsetTop` (surface
    px) and multiplies by `scale` to get screen px.
  - `bodyMaxH` (screen px, measured) → `toSurfacePx` on the body's `maxHeight`.
  - Popover `popoverAnchor` offsets (screen px) → `toSurfacePx`, including
    the `maxHeight: calc(100% - Npx)` term's `N`. The arrow's `left` is inside
    the zoomed root, so its `arrowOffset` → `toSurfacePx` too.
  - Corner classes (`top-4 right-4` etc.) are insets on the zoomed root, so
    they would scale. While `scale !== 1` and a corner class applies,
    `cornerInsetStyle(defaultCorner, scale)` adds the same sides inline as
    `toSurfacePx(16)` (the `sm:` desktop insets; a phone is never scaled).
    A panel at rest in a docked corner stack is `relative` with no insets and
    needs nothing.
  - `stackBelowY` is the Palette's `offsetTop + offsetHeight`, surface px of
    the same scale as the panel that consumes it as `top`, so it is used as-is.
- **`QuickStylePanel`**: `spot.left` / `spot.top` / `spot.width` (screen px)
  → `toSurfacePx`.
- **`ToolbarPalette`**: zoom on the root, which is `inset-x-0` and still spans
  the canvas when zoomed, so the card stays centred; `top` is restated as
  `toSurfacePx(12)`. The More popover sits inside the zoomed root but does not
  scale: it spreads `uiUnscaleStyle(scale)` (`zoom: 1 / scale`, nothing at 1),
  so its effective zoom is 1 and `moreRight` (screen px), its `w-[26rem]` and
  its `max-h-[calc(100dvh-14rem)]` all apply as written.
- **`SnapWidth`**: divides measured widths by the element's
  `currentCSSZoom` (1 where unsupported), so it writes surface px.
- **The bottom-right cluster** (`[data-zoom-cluster]`): zoom on the root;
  `right` / `bottom` inline `toSurfacePx(16)` so it keeps its 16px corner gap.
- **`ToolbarExplorerButton`**: zoom on the root; its corner inset is restored
  the same way. Inline in the phone strip it takes no zoom of its own.

Popovers that MovablePanel anchors to a scaled button read the button's
`getBoundingClientRect` (screen px), so they line up at any scale.
`useDockPopovers` clamps the anchor against `POPOVER_WIDTH * scale` (the
panels' scale: the popover is a panel), so a scaled popover is tucked inside
the window rather than running off it.

What makes room for a scaled surface:

- `cornerBottomInset(corner, scale)` (`apps/live/lib/panel-layout.ts`):
  bottom-right is `16 + 44 × scale + 12` at the corner buttons' scale, the
  cluster's height scaled and the inset and gap not.
  `nearestSnapCorner(geom, extents, scale)` uses it, fed by `usePanelDock`'s
  `useUiScale('cornerButtons')`, so snap detection matches the landing.
- `toolbarTopClearancePx(scale)` in `CanvasChrome`: `12 + 46 × scale + 10` at
  the toolbar's scale, the top corners' offset while the strip spans them.
- `useStripCrowdsCorners` takes a `scaleKey` (`"<toolbar>/<panels>"`) and
  `useStripTileLimit` the toolbar's `scale`, as effect dependencies: they
  measure in screen px already, but a zoom change resizes no observed box.
  The tile limit's first-paint fallback reads `viewportWidth / scale`.
- `useQuickStylePlacement` needs nothing: releasing the slider is a captured
  `pointerup`, which re-measures it.

## Interfaces and contracts

- `uiScale`, `uiScalePanels`, `uiScaleToolbar`, `uiScaleCornerButtons`
  (optional numbers) join `UserPreferences`; unknown / malformed values never
  throw, they resolve per the rules above.
- Settings rows share `UI_SCALE_SLIDER`: `kind: 'slider'`, the range
  constants, a `format` of the rounded percentage, and the `desktopOnly` note.
  - The master: `key: 'uiScale'`, `read: resolveUiScale`,
    `write: withUiScalePatch(p, uiScalePatch(v))`.
  - Each part, from `uiScalePartRow(part, copy)`: `key: 'uiScale-<part>'`,
    `parent: 'uiScale'`, `read: resolveUiScalePart(p, part)`,
    `write: withUiScalePatch(p, uiScalePartPatch(part, v))`.
  - The default `1` is written as `1`, not a delete, matching `panelOpacity`.
- `SettingsSliderRow` gains `disabled` and `notice`, honoured from the row's
  `desktopOnly` like the toggle row.
- Live preview: `SettingsSliderRowSpec.preview?(value | null)`. The row calls
  it on every `change`, then commits and calls `preview(null)` on release
  (pointer-up or key-up), and calls `preview(null)` on unmount. Each UI scale
  row's `preview` hands its write patch to `setUiScalePreview`
  (`apps/live/lib/ui-scale-preview.ts`, a module store read through
  `useUiScalePreview()`); `EditorView` spreads it over the stored preferences
  while it is non-null.

## Data and persistence

Four optional numbers in the existing preferences JSON blob: no migration,
well under the 4 KB cap. Device-independent; synced through
`/api/preferences` like `panelOpacity`.

## Errors and edge cases

| Case                            | Handling                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `uiScale` is a string / NaN / ∞ | Resolves to 1                                                            |
| `uiScale` 3 or 0.2              | Clamped to 1.2 / 0.8                                                     |
| `uiScale` 1.13                  | Snaps to 1.15                                                            |
| A part key is junk              | That part resolves to 1, not to the master                               |
| Settings closes mid-drag        | The row's unmount ends the preview; the stored value stands              |
| Viewport crosses `sm:`          | `useIsMobileViewport` re-renders; every part flips                       |
| `currentCSSZoom` unsupported    | Treated as 1 (`SnapWidth` only; Chromium, Firefox and Safari 18 have it) |

## Security and trust

Client-only presentation; the values never reach the server beyond the
opaque preferences blob. No new trust boundary.

## Performance and limits

`zoom` is a layout property: a new scale re-lays-out only the scaled
surfaces. While a slider is dragged that happens once per 5% step (at most 8
across the range), and nothing is written until release. The drag handlers
divide by a number already in scope.

## Presentation and UX

Final copy is in the spec. The master row sits second in Appearance, after
Theme, with the three part rows nested beneath it.

## Accessibility

Each range input keeps its `aria-label` (the row label) and
`aria-describedby` footnote; the percentage beside it is the visible value.
Browser zoom still works on top of it.

## Web Experience

No effect on the marketing / help sites. In the editor, no layout shift at
load: the first render already carries the resolved scales.

## Observability

`UI` / `Changed` / `UiScale`, `UiScalePanels`, `UiScaleToolbar` and
`UiScaleCornerButtons`, each with an explanation in
`apps/telemetry/app/event-explanations.ts` and a row in the telemetry
dashboard's `APPEARANCE_SETTINGS` stack.

## Testing

| Spec rule                            | Test                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| Default 100%, range, step, junk      | `apps/live/lib/ui-scale.test.ts` `resolveUiScale`        |
| A part follows or overrides master   | `apps/live/lib/ui-scale.test.ts` `resolveUiScales`       |
| Master clears parts; part writes own | `apps/live/lib/ui-scale.test.ts` writing                 |
| Phone always 100%                    | `apps/live/lib/ui-scale.test.ts`                         |
| Slider row offers its default        | existing `settings-catalogue.test.ts` slider round-trips |
| Rows commit, preview, grey out       | `SettingsCategoryPane.ui-scale.test.tsx`                 |
| Panel keeps screen position          | `MovablePanel` test: `left` = `x / scale`, `zoom` set    |
| A panel reads only the panels part   | `MovablePanel` test, provider with differing parts       |
| Nothing outside the provider scales  | `useUiScale(part)` is 1 with no provider                 |
| Toolbar More popover stays unscaled  | `apps/live/lib/ui-scale.test.ts` `uiUnscaleStyle`        |
| Bottom-right clearance scales        | `apps/live/lib/panel-layout.test.ts`                     |

Verified in a real browser across the range: drag, corner snap, Toolbar More
popover, cluster popovers, live preview, and one part scaled alone.

## Defaults ledger

D13 and D14 in [DEFAULTS.md](DEFAULTS.md).
