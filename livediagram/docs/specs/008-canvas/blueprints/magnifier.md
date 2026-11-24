# Magnifier: blueprint

Derived from [Magnifier](../magnifier.md). The spec decides; this file only adds engineering precision. Defaults
applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                                                         | Role                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packages/document/src/selection-mode.ts`                                                    | `'magnifier'` in `SELECTION_MODES` before `'isometric'`; `SELECTION_MODE_LABEL.magnifier`        |
| `packages/document/src/mode-glyphs.ts`                                                       | `MODE_GLYPHS.magnifier`: a lens with a plus and a handle                                         |
| `apps/editor/components/palette/palette.types.ts`                                            | `'magnifier'` in `CanvasTool`                                                                    |
| `apps/editor/components/palette/canvas-tool-options.tsx`                                     | The picker row: group 2 (Preview), before Isometric, shortcut `M`, off on an empty canvas        |
| `apps/editor/components/palette/palette-icons.tsx`                                           | `MagnifierIcon`, drawn from `MODE_GLYPHS`                                                        |
| `apps/editor/components/palette/tile-defs/behaviour-tiles.tsx`                               | `tools:mode-magnifier`, the Mode Button tile before Isometric's                                  |
| `apps/editor/components/palette/palette-layouts.ts`                                          | `'magnifier'` in `PARTICIPANT_CANVAS_TOOLS`                                                      |
| `apps/editor/lib/editor-commands.ts`                                                         | `tool:magnifier` ("Magnifier"), `needsContent`, not `mutates`                                    |
| `apps/editor/hooks/canvas/editor-shortcut-keys.ts`                                           | `m` in `VIEW_TOOL_KEYS`                                                                          |
| `apps/editor/hooks/canvas/useEditorKeyboardShortcuts.ts`                                     | Escape leaves Magnifier (Select, or Hand on a phone), as it leaves Isometric                     |
| `apps/editor/components/dialogs/shortcut-sections.ts`                                        | `M`: Magnifier in the shortcut sheet                                                             |
| `apps/editor/hooks/canvas/useCanvasTool.ts`                                                  | `Canvas·Used·Magnifier` on entering                                                              |
| `apps/editor/app/document/[id]/editor-state/useEditorTools.ts`                               | Empty-canvas guard; entering clears the selection                                                |
| `apps/editor/lib/canvas-chrome.ts`                                                           | `elementsInertTool('magnifier')`; `cursor-none` while in it                                      |
| `apps/editor/hooks/canvas/useCanvasSurfaceGestures.ts`                                       | Mouse drag pans; touch drag does not; no canvas menu, long press or double-tap zoom              |
| `apps/editor/lib/magnifier-config.ts`                                                        | `MagnifierConfig`, defaults, ranges, presets, `clampMagnifierConfig`, load / save                |
| `apps/editor/lib/magnifier-store.ts`                                                         | The one config store: `get`, `set(field, value)`, `subscribe`; persists; debounced telemetry     |
| `apps/editor/lib/magnifier-lens.ts`                                                          | Pure geometry (`lensPlacement`) and the wheel step (`wheelChange`)                               |
| `apps/editor/lib/magnifier-clone.ts`                                                         | `cloneCanvasLayer`: the drawn layer's copy, frames and videos stood in for                       |
| `apps/editor/hooks/canvas/useMagnifierLens.ts`                                               | Pointer, wheel and re-copy wiring; per-frame transform writes                                    |
| `apps/editor/components/canvas/MagnifierLens.tsx`                                            | The lens element: frame, stage, crosshair, value badge                                           |
| `apps/editor/components/canvas/MagnifierClusterButton.tsx`                                   | The mode's control in the bottom-right cluster                                                   |
| `apps/editor/components/canvas/MagnifierPopover.tsx`, `MagnifierHeroArt.tsx`                 | The settings popover and its header art                                                          |
| `apps/editor/hooks/canvas/useDockPopovers.ts`                                                | `'magnifier'` in `DockPanel`                                                                     |
| `apps/editor/components/canvas/CanvasCornerCluster.tsx`, `useCanvasChromePanels.tsx`, `CanvasChrome.tsx`, `Canvas.tsx` | Mount the button, the popover and the lens                                    |
| `apps/editor/lib/help-articles.ts`                                                           | `magnifier` → `selection-modes/magnifier`                                                        |
| `liveworkspace/apps/site/app/telemetry/livediagram/`                                         | `Magnifier` in the modes, `Magnifier*` in Mode Options, the event sentences                      |

## Domain and naming

| Term                | Identifier                                | Meaning                                                            |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| Magnifier           | `'magnifier'` (`CanvasTool`, `SelectionMode`) | The selection mode                                             |
| lens                | `MagnifierLens`, `[data-magnifier-lens]`  | The window on the cursor                                           |
| stage               | `[data-magnifier-stage]`                  | The lens's inner layer the copy sits in, scaled and moved          |
| copy                | `cloneCanvasLayer`                        | The deep copy of the drawn layer (`[data-canvas-content]`)         |
| magnification       | `MagnifierConfig.zoom`                    | The lens's scale over the canvas as drawn                          |
| size                | `MagnifierConfig.size`                    | The lens's side (square) or diameter (round), in screen px         |
| shape               | `MagnifierConfig.shape`: `'square' \| 'round'` | The lens's outline                                            |
| size preset         | `MagnifierSizePreset`                     | `'small' \| 'medium' \| 'large'`, or `'custom'` off them           |

## Behaviour and state

- **Lens visibility** (local to `useMagnifierLens`, never React state): `hidden` → `shown` on a pointer move (mouse,
  pen) whose target is `<main>` itself or inside the drawn layer; `shown` → `hidden` on a move onto anything else
  inside `<main>` (chrome), `pointerleave` of `<main>`, or a second touch. On touch: `shown` on `pointerdown` of a
  touch on the surface, follows `pointermove` of that pointer id, `hidden` on its `pointerup` / `pointercancel`.
- **Per move**: the latest point is stored; one `requestAnimationFrame` writes the lens's and the stage's
  `transform` and the copy's `transform` (read from the live layer's `style.transform`, so a pan is followed). No
  React update.
- **Copy**: made on mount (entering the mode) and again after `elements` changes, throttled to one per
  `MAGNIFIER_RECOPY_MS` (250ms, D132) with a trailing run; skipped while hidden (marked stale, made on the next show).
- **Config**: `magnifierStore` (module singleton). The lens and the cluster button subscribe with
  `useSyncExternalStore`; `Canvas` never does.
- **Wheel**: a `window` capture listener (`passive: false`) runs before the canvas's document-level one. While the lens
  is `shown` and the wheel event's target is inside `<main>` and not in `[data-floating-panel]`, and neither Ctrl nor
  Cmd is held: `preventDefault`, `stopPropagation`, then `wheelChange` → `magnifierStore.set`. Otherwise untouched.
- **Entering**: `pickCanvasTool('magnifier')` refuses on an empty tab, clears the selection, then
  `selectCanvasTool` tracks `Canvas·Used·Magnifier`.
- **Leaving**: any other tool; Escape → `'select'` (or `'pan'` when `isMobileViewportSync()`). The lens unmounts,
  removing its copy and listeners; the popover closes (`useCanvasChromePanels` effect).

Invariants:

- **I1**: no pointer move renders a React component.
- **I2**: the copy is never in the drawn layer and comes after it in document order, so `document.querySelector` of an
  element id and `url(#id)` references resolve to the original.
- **I3**: nothing the mode does writes to the document, the room or the synced preferences.

## Interfaces and contracts

```ts
export type MagnifierShape = 'square' | 'round';
export type MagnifierConfig = { zoom: number; size: number; shape: MagnifierShape };
export const DEFAULT_MAGNIFIER_CONFIG: MagnifierConfig; // { zoom: 2, size: 240, shape: 'square' }
export const MAGNIFIER_ZOOM_RANGE = { min: 1.5, max: 6, step: 0.5 };
export const MAGNIFIER_SIZE_RANGE = { min: 120, max: 480 };
export const MAGNIFIER_SIZES: readonly { id: 'small' | 'medium' | 'large'; label: string; px: number }[];
export function clampMagnifierConfig(raw: unknown): MagnifierConfig;
export function magnifierSizePreset(size: number): MagnifierSizePreset;
export function formatMagnification(zoom: number): string; // "2x", "2.5x"

export const magnifierStore: {
  get(): MagnifierConfig;
  set<K extends keyof MagnifierConfig>(field: K, value: MagnifierConfig[K]): void;
  subscribe(listener: () => void): () => void;
};

export function lensPlacement(input: {
  x: number; y: number; // pointer, relative to <main>
  size: number; zoom: number; touch: boolean;
  height: number; // <main>'s height, for the touch flip
}): { left: number; top: number; stageX: number; stageY: number };
export function wheelChange(config: MagnifierConfig, e: { deltaX: number; deltaY: number; shiftKey: boolean }):
  Partial<MagnifierConfig>;
export function cloneCanvasLayer(layer: HTMLElement): HTMLElement;
```

- `lensPlacement`: mouse: `left = x − size/2`, `top = y − size/2`. Touch: `left = x − size/2`,
  `top = y − size − TOUCH_LIFT_PX` (24, D133), or `y + TOUCH_LIFT_PX` when that is below 0. In both, the stage (the
  canvas at `zoom`, scaled about `<main>`'s origin) is moved so the canvas point under the pointer lands at the
  lens's centre: `stageX = size/2 − x·zoom`, `stageY = size/2 − y·zoom`.
- `wheelChange`: plain wheel → `zoom · exp(−deltaY / 400)`, clamped, rounded to 0.1. Shift → `size − d / 2` where
  `d = deltaY || deltaX` (a Shift wheel on some mice reports `deltaX`), clamped, rounded to whole px.
- `clampMagnifierConfig`: non-object → defaults; each field: zoom finite → clamped; size finite → clamped and rounded;
  shape not one of the two → `'square'`.

## Data and persistence

- `localStorage['livediagram:v2:magnifier-config']`, JSON `MagnifierConfig`, written on every `set` through
  `writeLocalStorageSafe`, read once at module load through `readLocalStorageSafe` and `clampMagnifierConfig`.
- Nothing in the document, the room, the api or the synced preferences. No migration: a missing key is the defaults.

## Errors and edge cases

| #   | Case                                          | Handling                                                                   |
| --- | --------------------------------------------- | -------------------------------------------------------------------------- |
| E1  | `localStorage` throws or holds junk           | Defaults; the write is skipped silently (`writeLocalStorageSafe`)          |
| E2  | The tab empties while in the mode             | The copy shows the empty canvas; the mode stays until left                 |
| E3  | An `<iframe>` or `<video>` in the layer       | A same-size `div` with the frame's classes and style stands in             |
| E4  | A `<canvas>` (a reaction burst)               | Copied blank; it is transient                                              |
| E5  | Pointer over a panel inside `<main>`          | Lens hidden, wheel untouched                                               |
| E6  | Ctrl / Cmd wheel, trackpad pinch              | Untouched: the canvas zooms                                                |
| E7  | Two fingers                                   | Lens hidden; the pinch handler runs                                        |
| E8  | Touch lens near the top                       | Flips below the finger                                                     |
| E9  | Tab switch while in the mode                  | `elements` changes → re-copy                                               |
| E10 | Isometric's `[data-iso]` not set              | The copy carries the layer's own attributes, so it matches what is drawn   |

## Security and trust

- The copy is the user's own rendered DOM, re-attached in the same document; no HTML is parsed (`cloneNode`, never
  `innerHTML`), so no trusted-types sink is reached. Frames are not copied, so no second load of embedded content.

## Performance and limits

- Pointer move: one stored point, at most one rAF; per frame three `style.transform` writes and one string read.
  CPU-time budget test: 2,000 moves over a 3,000-node layer stay under `cpuBudgetMs(60)`, with exactly one copy.
- Copy: `cloneNode(true)` of the layer, O(nodes). Throttled to 4/s; never during a hidden lens.
- Config changes from the wheel re-render only `MagnifierLens` (a frame with no React children in the stage) and the
  cluster button.
- Telemetry: one event per field per 800ms quiet window (`MAGNIFIER_TELEMETRY_DEBOUNCE_MS`, D134), flushed on
  page hide.

## Presentation and UX

- Lens: `position: absolute; left: 0; top: 0`, moved by `translate3d`; `width = height = size`; square
  `border-radius: 14px`, round `9999px`; `border: 3px solid white` (dark: slate-800), `box-shadow` ring of
  `rgba(15,23,42,.18)` 1px plus a `0 18px 40px -12px rgba(15,23,42,.45)` drop (D135); `overflow: hidden`;
  background: `<main>`'s computed background colour, read on show.
- Crosshair: two 10px hairlines in `rgba(15,23,42,.55)` with a white 1px halo at the lens's centre, which is the
  magnified pointer point on mouse and on touch alike.
- Value badge: bottom-centre pill, `formatMagnification(zoom)` or `"{size}px"`, shown 900ms after a wheel change.
- `z-index`: above the drawn layer, below the chrome (`z-[var(--z-canvas-overlay)]`, the Spotlight shroud's level).
- Cluster button: `ClusterStrip` of one `ClusterPopoverSegment`, icon `MagnifierIcon` at 18px, label "Magnifier
  settings", name `formatMagnification(zoom)` on a wide desktop, hover "Magnifier" / "Change the lens's
  magnification, size and shape."
- Popover: `MovablePanel` as a popover (`w-72`), title "Magnifier", hero `magnifierHeroArt`, help `magnifier`;
  Magnification `RangeSlider`-style input (1.5 to 6, step 0.5) with its value; Size segmented (Small, Medium,
  Large; "Custom · {size}px" note when off a preset); Shape segmented (Square, Round); hint line.

## Accessibility

- Lens: `aria-hidden`, `inert`, `pointer-events: none`; the copy is removed from the accessibility tree with it.
- Popover controls: a labelled `input type=range` (`aria-valuetext` "2x"), segmented groups as `role="radiogroup"`
  of `role="radio"` buttons with `aria-checked`, arrow keys move within; Escape closes.
- The picker row, the cluster button and the Mode Button tile carry names; `M` is listed in the shortcut sheet.
- Reduced motion: the badge appears and disappears without a transition.

## Web Experience

- No layout shift: the lens and the button are absolutely positioned. INP: the wheel and pointer handlers do no
  layout reads except one `getBoundingClientRect` of `<main>` per frame.

## Observability

- `Canvas·Used·Magnifier` on entering; `UI·Changed·MagnifierZoom|MagnifierSize|MagnifierShape` per settled change.
  No logs: the mode has no failure path beyond E1, which falls back silently by design.

## Testing

| Rule                                                     | Test                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Config clamps and defaults                               | `lib/magnifier-config.test.ts`                               |
| Store persists, notifies, debounces telemetry            | `lib/magnifier-store.test.ts`                                |
| Lens geometry and wheel step                             | `lib/magnifier-lens.test.ts`                                 |
| Copy stands in for frames and videos                     | `lib/magnifier-clone.test.ts`                                |
| No re-copy per move, budget on a large layer             | `hooks/canvas/useMagnifierLens.test.tsx`                     |
| Lens hides over chrome, touch follows the finger, wheel  | `hooks/canvas/useMagnifierLens.test.tsx`                     |
| Picker row before Isometric, in Preview                  | `components/palette/canvas-tool-options.test.tsx`            |
| Roles: Participant set, view key, read-only command      | `magnifier-roles.test.ts`                                    |
| Popover controls and cluster button                      | `components/canvas/MagnifierPopover.test.tsx`                |
| Mode glyph exists for every mode                         | `packages/document/src/svg-render-fidelity.test.ts` (existing) |

## Constants and configuration

| Constant                           | Value  | Range / provenance                        |
| ---------------------------------- | ------ | ----------------------------------------- |
| `DEFAULT_MAGNIFIER_CONFIG.zoom`    | 2      | Spec                                      |
| `MAGNIFIER_ZOOM_RANGE`             | 1.5–6, step 0.5 | Spec                             |
| `MAGNIFIER_SIZE_RANGE`             | 120–480 px | Spec                                  |
| `MAGNIFIER_SIZES`                  | 160 / 240 / 360 px | Spec                          |
| `MAGNIFIER_RECOPY_MS`              | 250    | D132                                      |
| `TOUCH_LIFT_PX`                    | 24     | D133                                      |
| `MAGNIFIER_TELEMETRY_DEBOUNCE_MS`  | 800    | D134, matches the canvas sliders          |
| `MAGNIFIER_BADGE_MS`               | 900    | D135                                      |
