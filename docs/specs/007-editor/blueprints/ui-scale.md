# UI scale blueprint

Derived from [UI scale](../ui-scale.md). Implementation detail only; the spec
owns every design decision.

## Domain and naming

| Term                      | Identifier                                                         |
| ------------------------- | ------------------------------------------------------------------ |
| The preference            | `UserPreferences.uiScale` (`apps/live/lib/user-preferences.ts`)    |
| The factor in force       | "UI scale", `scale` in code; always the RESOLVED value             |
| Resolving a stored value  | `resolveUiScale(prefs, { mobile })` in `apps/live/lib/ui-scale.ts` |
| Reading it in a component | `useUiScale()` (`apps/live/components/providers/ui-scale.tsx`)     |
| A scaled surface's style  | `uiScaleStyle(scale)` → `{ zoom }`, or `undefined` at 1            |
| Screen px → surface px    | `toSurfacePx(px, scale)` = `px / scale`                            |

"Screen px" are viewport pixels (`getBoundingClientRect`, `clientX`). "Surface
px" are the CSS pixels inside a zoomed surface, where every length (including
its own `left` / `top` / insets, and `vw` / `dvh`) is multiplied by the zoom
while percentages are not, and `offsetLeft` / `offsetTop` / `offsetWidth`
report surface px.

## Constants and configuration

In `apps/live/lib/ui-scale.ts`:

| Constant           | Value  | Provenance                                      |
| ------------------ | ------ | ----------------------------------------------- |
| `UI_SCALE_MIN`     | `0.8`  | Spec: 10px labels stay ≥ 8px                    |
| `UI_SCALE_MAX`     | `1.5`  | Spec: the Palette + a corner stack fit a laptop |
| `UI_SCALE_STEP`    | `0.05` | Spec: 5% steps                                  |
| `UI_SCALE_DEFAULT` | `1`    | Spec: missing key = 100%                        |

## Behaviour and state

`resolveUiScale(prefs, { mobile })`:

1. `mobile` true → `UI_SCALE_DEFAULT`.
2. `prefs.uiScale` not a finite number → `UI_SCALE_DEFAULT`.
3. Clamp to `[UI_SCALE_MIN, UI_SCALE_MAX]`, snap to the nearest
   `UI_SCALE_STEP`, round to 2 decimals (no `1.1500000000000001`).

`UiScaleProvider` is mounted in `EditorView` beside `MinimalChromeProvider`,
fed `resolveUiScale(userPreferences, { mobile: useIsMobileViewport() })`.
`useUiScale()` returns `1` outside a provider, so the Explorer page and `/new`
are untouched. No pre-paint script: the editor reads the cached preferences
synchronously on its first render, before any scaled surface paints.

## Surfaces

Each scaled surface spreads `uiScaleStyle(scale)` into its ROOT's `style` and
converts every JS-computed screen-px length it writes on that root or a
descendant with `toSurfacePx`:

- **`MovablePanel`** (both branches):
  - Free `position` stays stored in screen px; render `left` / `top` as
    `toSurfacePx(clampFree(position))`.
  - The lifted docked drag's `dockDragPos` (screen px) → `toSurfacePx`.
  - The legacy drag's start point reads `offsetLeft` / `offsetTop` (surface
    px) and multiplies by `scale` to get screen px.
  - `bodyMaxH` (screen px, measured) → `toSurfacePx` on the body's `maxHeight`.
  - Popover `mobileDockAnchor` offsets (screen px) → `toSurfacePx`, including
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
- **`ToolbarPalette`**: zoom on an inner wrapper around the card and More
  popover (the root is `inset-x-0` full width and must not zoom). `moreRight`
  (screen px) → `toSurfacePx`; the popover's `max-h-[calc(100dvh-14rem)]`
  becomes inline `calc(100dvh / scale - 14rem)` so its screen bottom gap is
  `14rem × scale`.
- **`SnapWidth`**: divides measured widths by the element's
  `currentCSSZoom` (1 where unsupported), so it writes surface px.
- **The bottom-right cluster** (`[data-zoom-cluster]`): zoom on the root;
  `right` / `bottom` inline `toSurfacePx(16)` so it keeps its 16px corner gap.
- **`CanvasMobileDock`** (the Minimal button bar): zoom on the root; `top` /
  `right` inline `toSurfacePx(12)`.
- **`ToolbarExplorerButton`**: zoom on the root; its corner inset is restored
  the same way.

Popovers that MovablePanel anchors to a scaled button read the button's
`getBoundingClientRect` (screen px), so they line up at any scale.
`useCanvasMobileDock` clamps the anchor against `POPOVER_WIDTH * scale`, so a
scaled popover is tucked inside the window rather than running off it.

What makes room for a scaled surface:

- `cornerBottomInset(corner, scale)` (`apps/live/lib/panel-layout.ts`):
  bottom-right is `16 + 44 × scale + 12`, the cluster's height scaled and the
  inset and gap not. `nearestSnapCorner(geom, extents, scale)` uses it, fed
  by `usePanelDock`'s `useUiScale()`, so snap detection matches the landing.
- `toolbarTopClearancePx(scale)` in `CanvasChrome`: `12 + 46 × scale + 10`,
  the top corners' offset while the Toolbar strip spans them.
- `useStripCrowdsCorners` and `useStripTileLimit` take `scale` as an effect
  dependency: they measure in screen px already, but a zoom change resizes no
  observed box. The tile limit's first-paint fallback reads
  `viewportWidth / scale`.
- `useQuickStylePlacement` needs nothing: releasing the slider is a captured
  `pointerup`, which re-measures it.

## Interfaces and contracts

- `uiScale?: number` joins `UserPreferences`; unknown / malformed values never
  throw, they resolve per the rules above.
- Settings row: `kind: 'slider'`, `key: 'uiScale'`, `min` / `max` / `step`
  from the constants, `read: (p) => resolveUiScale(p, { mobile: false })`,
  `write: (p, v) => ({ ...p, uiScale: v })` (writes the default `1` as `1`,
  not a delete, matching `panelOpacity`), `format: v => \`${Math.round(v * 100)}%\``,
`desktopOnly: 'A phone always uses 100%.'`.
- `SettingsSliderRow` gains `disabled` and `notice`, honoured from the row's
  `desktopOnly` like the toggle row.

## Data and persistence

One new optional number in the existing preferences JSON blob: no migration,
well under the 4 KB cap. Device-independent; synced through
`/api/preferences` like `panelOpacity`.

## Errors and edge cases

| Case                            | Handling                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `uiScale` is a string / NaN / ∞ | Resolves to 1                                                            |
| `uiScale` 3 or 0.2              | Clamped to 1.5 / 0.8                                                     |
| `uiScale` 1.13                  | Snaps to 1.15                                                            |
| Viewport crosses `sm:`          | `useIsMobileViewport` re-renders; scale flips                            |
| `currentCSSZoom` unsupported    | Treated as 1 (`SnapWidth` only; Chromium, Firefox and Safari 18 have it) |

## Security and trust

Client-only presentation; the value never reaches the server beyond the
opaque preferences blob. No new trust boundary.

## Performance and limits

`zoom` is a layout property: committing a new scale re-lays-out only the
scaled surfaces once. Nothing reads it per frame; the drag handlers divide
by a number already in scope.

## Presentation and UX

Final copy is in the spec. The row sits second in Appearance, after Theme.

## Accessibility

The range input keeps its `aria-label` "UI Scale" and `aria-describedby`
footnote; the percentage beside it is the visible value. Browser zoom still
works on top of it.

## Web Experience

No effect on the marketing / help sites. In the editor, no layout shift at
load: the first render already carries the resolved scale.

## Observability

`UI` / `Changed` / `UiScale`, with an explanation in
`apps/telemetry/app/event-explanations.ts` and a row in the telemetry
dashboard's `APPEARANCE_SETTINGS` stack.

## Testing

| Spec rule                           | Test                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| Default 100%, range, step, junk     | `apps/live/lib/ui-scale.test.ts` `resolveUiScale` table  |
| Phone always 100%                   | `apps/live/lib/ui-scale.test.ts`                         |
| Slider row offers its default       | existing `settings-catalogue.test.ts` slider round-trips |
| Row is desktop only, greys out      | `SettingsSliderRow` disabled + notice test               |
| Panel keeps screen position         | `MovablePanel` test: `left` = `x / scale`, `zoom` set    |
| Nothing outside the provider scales | `useUiScale()` is 1 with no provider                     |

Verified in a real browser at 80%, 100% and 150%: drag, corner snap, Toolbar
More popover, cluster popovers.

## Defaults ledger

D13 and D14 in [DEFAULTS.md](DEFAULTS.md).
