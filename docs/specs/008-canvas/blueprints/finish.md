# Finish: blueprint

Derived from [Finish](../finish.md). Defaults in [DEFAULTS.md](DEFAULTS.md) (D-finish rows).

## Domain and naming

| Term (spec)       | Identifier                                                      | Never                          |
| ----------------- | --------------------------------------------------------------- | ------------------------------ |
| finish            | `Finish` (`'flexible' \| 'professional' \| 'sketch'`)           | tone, look, style, render mode |
| a tab's finish    | `Tab.finish?: Finish`                                           |                                |
| an element's own  | `finish?: Finish` on shape, arrow, text, sticky, table elements |                                |
| drawn finish      | `resolveFinish(own, tab)`                                       | effective finish               |
| Follow Tab        | the element's `finish` key absent                               | inherit, default               |
| hand-drawn stroke | a **sketch stroke** (`sketchStrokes`)                           | rough path                     |
| pencil hatching   | **hatching** (`sketchHatching`)                                 | hachure (in code), fill lines  |

"Tone" stays the colour picker's strong / soft term ([Domain language](../../003-system-architecture/domain-language.md)).

## Interfaces and contracts

### `packages/document/src/finish.ts`

```ts
export type Finish = 'flexible' | 'professional' | 'sketch';
export const FINISHES: readonly Finish[] = ['flexible', 'professional', 'sketch'];
export const DEFAULT_FINISH: Finish = 'flexible';
export function isFinish(v: unknown): v is Finish;
export function resolveFinish(own: Finish | undefined, tab: Finish | undefined): Finish;
// own ?? tab ?? DEFAULT_FINISH; a stored value that is not a Finish reads as absent.

export const PROFESSIONAL_CORNER_PX = 0;
export const PROFESSIONAL_FONT_ID = 'inter';
export const SKETCH_FONT_ID = 'caveat';
export const FINISH_ELEMENT_TYPES: ReadonlySet<Element['type']>; // shape, arrow, text, sticky, table
export function supportsFinish(el: { type: string }): boolean;

export function finishCornerFallbackPx(kindDefaultPx: number, finish: Finish): number;
// professional → min(PROFESSIONAL_CORNER_PX, kindDefaultPx); else kindDefaultPx
export function finishBorderStroke(own: BorderStroke | undefined, finish: Finish): BorderStroke;
// own ?? (professional ? 'thin' : DEFAULT_BORDER_STROKE)
export function finishArrowThickness(
  own: ArrowThickness,
  isOwnSet: boolean,
  finish: Finish,
): ArrowThickness;
// set → own; professional → 'thin'; else own (the resolved default)
export function finishDrawsDefaultShadow(finish: Finish): boolean; // finish !== 'professional'
export function finishFontId(
  own: string | undefined,
  tab: string | undefined,
  finish: Finish,
): string | undefined;
// own ?? (sketch ? SKETCH_FONT_ID : tab ?? (professional ? PROFESSIONAL_FONT_ID : undefined))
export function elementFontId(el, tabFont, tabFinish): string | undefined; // finishFontId over resolveFinish
export function finishCurvesNewArrows(finish: Finish): boolean; // finish !== 'professional'
export function finishNewArrowStyle(finish: Finish): ArrowStyle | undefined; // professional → 'angled'
export function finishHatchesKind(element: Element): boolean;
// a shape of a plain box kind or a drawn silhouette; not a frame, lane or self-painting kind
export function finishHatches(element: Element, fill: string, backdrop?: boolean): boolean;
// finishHatchesKind, not a backdrop, fill not transparent
```

### `packages/document/src/sketch.ts` (pure geometry, no DOM)

```ts
type Pt = { x: number; y: number };
export type SketchSegment =
  { kind: 'line'; from: Pt; to: Pt } | { kind: 'curve'; points: Pt[]; closed: boolean };
export type SketchOutline = { segments: SketchSegment[]; area: Pt[] | null };
// area: the closed polygon hatching fills; null for an open outline (an arrow, a limb).

export function sketchSeed(id: string): number; // FNV-1a 32-bit of the id
export function sketchRandom(seed: number): () => number; // mulberry32, [0, 1)
export function outlineOfRect(x, y, w, h, radius): SketchOutline; // 4 lines + 4 corner arcs when radius > 0
export function outlineOfEllipse(cx, cy, rx, ry): SketchOutline; // one closed curve
export function outlineOfPolygon(points: Pt[]): SketchOutline; // lines
export function outlineOfPath(d: string): SketchOutline; // M L H V Q C A Z, absolute and relative
export function outlineOfPart(part: ShapePart): SketchOutline; // a fitted shape-table part
export function sketchStrokes(outline: SketchOutline, seed: number, passes?: 1 | 2): string; // path d
export function sketchHatching(area: Pt[], seed: number, strokePx: number): string; // path d
export function sketchArrowHead(tip: Pt, dir: Pt, lengthPx: number, seed: number): string; // two strokes
export function pathEndTangents(
  d: string,
): { start: { at: Pt; dir: Pt }; end: { at: Pt; dir: Pt } } | null;
```

- **Lines.** For a segment of length `len`: each end jitters by up to `min(SKETCH_JITTER_PX, len * 0.05)` on both
  axes, overshoots along the line by `0..SKETCH_OVERSHOOT_PX`, and the line bows through a quadratic control point
  offset from the midpoint perpendicular by `±min(len * SKETCH_BOW_SHARE, SKETCH_BOW_MAX_PX)`. Emitted as
  `M a Q c b`.
- **Curves.** Sampled every `SKETCH_CURVE_STEP_PX` (min 8, max 64 samples); the samples drift by up to
  `SKETCH_CURVE_JITTER_PX`, set at every fourth sample and eased between (a low-frequency wander, not a buzz); drawn as a Catmull-Rom spline (cubic `C`). A closed curve starts at a random sample and
  runs one sample past its start, so the two ends overlap like a pen lifted late.
- **Passes.** Two passes by default, each from its own stream (`seed`, `seed + 1`), concatenated into one `d`.
- **Hatching.** Lines at `SKETCH_HATCH_ANGLE_DEG` across the area, `gap = clamp(4 * strokePx, 6, 12)` apart,
  widened so no more than `SKETCH_HATCH_MAX_LINES` lines are drawn; the area is rotated, scanned with horizontal
  lines (even-odd pairs of edge crossings), each piece rotated back and drawn as a one-pass sketch line. Drawn over
  the solid fill in the stroke colour at `SKETCH_HATCH_OPACITY` (0.15) and `max(1, strokePx / 2)` wide; every
  filled element keeps its `solid` layer, so text contrast never depends on the canvas behind.
- **Arrowhead.** Two one-pass sketch lines from `tip` back to `tip - dir * L ± normal * L / 2`.
- Every output is deterministic for the same input and seed; numbers are rounded to 2 decimals.

### Canvas (`apps/live`)

### `packages/document/src/sketch-element.ts` and `sketch-backdrop.ts`

- `sketchElement(el, { strokePx, radiusPx, fill, backdrop })` returns the `SketchDrawing` layers (`strokes`,
  `details`, `hatch`, `solid`); `sketchElementPaint(el, finish, fill, backdrop)` resolves stroke, dash and radius as an
  unsketched element in the same finish; `sketchArrow(id, pathD, options)` returns the sketched line and, for
  `SKETCHED_HEAD_SHAPES` (triangle, hollow triangle, line), the heads.
- `sketchBackdropIds(elements, tabFinish): Set<string>`: candidates are elements where `finishHatchesKind` holds and
  the resolved finish is Sketch (none: an empty set, no further work). Boxed centres are collected with their drawing
  order and sorted by x; per candidate a binary search finds the first centre at or right of its left edge and scans
  until past its right edge; a later element's centre inside its box makes it a backdrop. O(n log n + hits). A
  backdrop draws `solid`, never `hatch`.

### Canvas (`apps/live`)

- `components/canvas/CanvasFinishContext.tsx`: `CanvasFinishProvider` (the active tab's finish, re-provided by each
  `Canvas` for its own tab), `useTabFinish()` and `useElementFinish(own): Finish`, a context like
  `CanvasSurfaceContext` so memoised element views re-render on a tab finish change.
- `describeVariant(..., surface, finish)`: Professional drops `shadow-sm` and the sticky peel and uses the
  Professional corner / stroke fallbacks; Sketch makes the wrapper's background transparent and its border none for
  CSS shapes and stickies and drops the peel.
- `lib/sketch-backdrop-store.ts`: `usePublishSketchBackdrops(tabId, drawnElements, tabFinish)` (called by
  `CanvasElementsLayer`) publishes `sketchBackdropIds` per tab; `useIsSketchBackdrop(id)` is a per-id
  `useSyncExternalStore` read, so only views whose flag flips re-render.
- `components/canvas/SketchOverlay.tsx`: `useSketchPaint(element, finish, fill, backdrop)` memoised on the fields it
  reads (never position) and `SketchOverlay`, an absolutely positioned `<svg viewBox="0 0 w h">` drawing solid, hatch,
  strokes then details. `BoxedElementView` mounts it for every sketched boxed element (shapes, stickies, tables);
  `ShapeContentRouter` skips its silhouette overlay when sketched.
- `components/canvas/arrow-finish.ts`: `useArrowFinish(arrow, pathD)` returns the base width (Thin under
  Professional when unset) and the memoised `sketchArrow` (one pass while a flow runs). `ArrowView` draws the
  sketched line in place of `pathD`, sketched heads in place of markers (in `arrowheadColor` when set); the
  selection halo and the hit band keep `pathD`.
- Lettering: `CanvasElementsLayer`, `text-hug-measure` and `useTextStyleSetters` resolve fonts with `elementFontId`.
- New arrows: `applyCollisionAvoidance(els, arrowId, tabFinish)` gives an untouched arrow
  `arrowStyle: finishNewArrowStyle(finish)` under Professional and skips the curve when `finishCurvesNewArrows` is
  false.
- Palette: `components/palette/palette-tile-finish.ts` `paletteFinishClass(finish, action?)` (Sketch for every tile;
  Professional for every tile but `tech-icon` and `sticker`); `IconButton` adds the class to the glyph wrapper from
  `useTabFinish()` when given the tile's `finishAction`, and `StickerPickerTab` wraps each sticker's art in it. `app/globals.css`: `.palette-finish-professional` (mitre joins, 1 px
  strokes, `rx: 0`) and `.palette-finish-sketch` (`filter: url(#lvd-sketch-tile)`).
  `components/canvas/SketchFilterDefs.tsx` renders that filter once in `EditorView`: two `feTurbulence` +
  `feDisplacementMap` passes (seeds 7 and 23, base frequency 0.12 and 0.1, scale 3), merged.

### Exports (`packages/document/src/svg-render*.ts`)

`renderElementsToSvg` resolves each element's finish from `tab.finish`; `svgBoxed` and `svgArrow` take it and draw
the same strokes, hatching and heads from `sketch.ts`, and the Professional fallbacks from `finish.ts`
(`svg-render-sketch.ts` places a sketched body). Every caller that loops `svgBoxed` (`renderElementsToSvg`,
`export-tab.ts` PNG and SVG, `Minimap`, `useLayerThumbnails`, `useSlideThumbnails`) computes `sketchBackdropIds`
once and passes `sketchBackdrop` per element; `boxedNeedsSvgRaster` sends every non-Flexible element down the SVG
raster path so PNG matches SVG.

### Menus and dialog

- `components/palette/FinishSection.tsx`: a `MenuAccordionSection` titled **Finish** holding `OptionRows`
  (`kind="single"`, label "Drawn As") with rows `follow-tab`, `flexible`, `professional`, `sketch`: a glyph, the
  `FINISH_LABELS` name and the `FINISH_DETAILS` line. Hover previews through `OptionRows`' `onPreview` /
  `onPreviewEnd` (mouse only); click commits. Mounted by `ElementColourBorderSections` (the Style flyout, arrows
  included) when `supportsFinish(target)`, and by `MultiStyleSections` for the first finish-taking member;
  `resolveOwnFinish(el)` picks the checked row.
- `components/plan/OptionRows.tsx`: optional `onPreview(id)` / `onPreviewEnd()`.
- `lib/style-presets.ts`: `applyFinishToEl(el, finish | null)` (null deletes the key; other types unchanged).
- `useStylePreview`: `previewFinish`, `commitFinish` (`'Finish'` telemetry type), plumbed through `useEditorState`,
  `EditorContextMenuHost` and `EditorContextMenu.types.ts` as `onPreviewFinish` / `onCommitFinish`.
- `CanvasThemeDialog`: `CanvasThemeTab` gains `'finish'`; `components/dialogs/FinishTab.tsx` (three tiles) with help link `choosingAFinish` (`canvas/finish`); `useTabCanvas.setTabFinish` commits
  `withTabFinish` (`lib/tab-style-transforms.ts`): the tab's finish, every element's own cleared, one `commit`.
- Preview: `lib/finish-preview.ts` `finishPreviewSvg(finish, { background, theme, font })` renders
  `FINISH_PREVIEW_ELEMENTS` (fixed ids `finish-preview-*`: a 180 x 70 square "Plan the work", a 130 x 100 diamond
  "Ready?", a pinned arrow e → w, a 110 x 100 sticky "Ship it") through `renderElementsToSvg` (padding 16).
  `FinishTab`'s `FinishPreview` memoises it on finish, background, theme and font and inlines it
  (`role="img"`, `aria-label` naming the finish). The background is the tab's own, else the surface default
  (`DARK_CANVAS_BACKGROUND_COLOR` / `DEFAULT_BACKGROUND_COLOR`), passed as `canvasBackground` from `EditorModals`.

### Agents

`packages/agent-verbs/src/mcp/schema.ts`: `finishField = z.enum(FINISHES).optional()` on `create_document` and
`add_tab`, passed through like `theme`; `finish` added to the element format allowlists for shape, arrow, text,
sticky and table.

## Behaviour and state

- State lives only in `Tab.finish` and element `finish`; no session state. Unset keys are deleted, never stored as
  `'flexible'` by Follow Tab, but Flexible is stored when picked (it then overrides a Sketch tab).
- Preview: hover sets a preview finish on the selection through the existing preview path; leave restores.

## Data and persistence

- Both fields are optional, cosmetic and unvalidated beyond `isFinish` at read time (`resolveFinish` treats an
  unknown value as absent), like `theme` and `font`. No migration: absence is Flexible.
- `tab-meta` already carries any tab key; element ops carry any listed element field (`ELEMENT_FIELD_NAMES`).
- Duplicate, copy / paste, import and the format painter carry `finish` (format painter: the Effects group).

## Errors and edge cases

- Zero or negative size: no outline is drawn (overlay returns null), same as `BoxBorderOverlay`.
- Stroke width none (`'none'`): Sketch draws the fill and its shading only.
- Transparent fill: no fill and no hatching.
- Huge shapes (20000 px): hatching capped at `SKETCH_HATCH_MAX_LINES`, curve samples capped at 64.
- Degenerate arrow (length < 0.5): drawn unsketched.
- Unknown path commands in `outlineOfPath`: the rest of the path is ignored and the outline so far is used.

## Security and trust

Cosmetic fields only; no user content reaches the geometry beyond numbers. Participant ops cannot carry `finish`
(not in `PARTICIPANT_STICKY_FIELDS`), locked by `participant-content.leak.test.ts`.

## Performance and limits

- Budget: one element's strokes + hatching ≤ 0.2 ms at 400 x 300 (measured 0.055 ms rect, 0.063 ms ellipse); ≤ 2 ms at
  20000 x 20000 (measured 0.23 ms rect, 0.30 ms ellipse). Path numbers are written in tenths through integer
  formatting, which tripled the speed (fractional number-to-string was the hot spot). Measured in
  `sketch.perf.test.ts`.
- Backdrops: `sketchBackdropIds` on 2,000 overlapping sketched shapes measured 0.70 ms (budget 25 ms in
  `sketch-backdrop.test.ts`); it returns at once when nothing on the tab is sketched.
- Views memoise geometry on size / kind / stroke, never position, so a drag recomputes nothing for moved shapes; the
  backdrop store re-renders only the views whose flag flips.
- Palette tiles: one shared filter definition, applied by class; no per-tile geometry.

## Presentation and UX

- Menu rows: a glyph (a link for Follow Tab, a rounded square for Flexible, a crisp square for Professional, a wobbly
  square for Sketch), the name, and the line "As the tab is", "Soft and rounded", "Square and fine", "Drawn by hand".
  The checked row is the element's own finish (Follow Tab when it has none).
- Finish panel: tiles of glyph over name, then a "Preview" heading over the sample diagram; heading "Finish", line "How lines, corners and lettering are drawn on this
  tab." (no apply button: a pick applies to the whole tab).

## Accessibility

The menu rows are `OptionRows`: menu item radios inside the menu (its own keys move between them), each with
`aria-checked`. The dialog tiles are `SizeButton`s with `aria-pressed`; the panel is reached from the dialog's
**Fine-tune** row named Finish, with a **Back** control to the home. Hover preview never fires for touch. No motion.

## Web Experience

No new network requests except the Caveat stylesheet, loaded on demand by the existing font loader when a sketched
element first needs it; no layout shift (overlays are absolutely positioned inside fixed-size boxes).

## Observability

Telemetry rows per the spec. `outlineOfPath` logs `console.debug('[sketch] unsupported path command', cmd)` once
per command letter.

## Testing

| Rule                                                         | Test                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| resolve order, unknown values, Professional fallbacks, font  | `packages/document/src/finish.test.ts`                                                                   |
| determinism, seeds differ, outlines, hatching bounds/caps    | `packages/document/src/sketch.test.ts`                                                                   |
| budgets                                                      | `packages/document/src/sketch.perf.test.ts`                                                              |
| export draws sketch strokes / hatching / Professional radius | `packages/document/src/svg-render-finish.test.ts`                                                        |
| variant drops shadow / peel / border per finish              | `apps/live/components/canvas/element-variant.test.ts`                                                    |
| menu rows commit, preview, Follow Tab clears                 | `apps/live/components/palette/FinishSection.test.tsx`                                                    |
| backdrops: what sits on a shape, order, finish, speed        | `packages/document/src/sketch-backdrop.test.ts`                                                          |
| Professional new arrows angled; avoidance per finish         | `apps/live/hooks/canvas/arrow-avoidance-apply.test.ts`                                                   |
| which palette tiles take the finish                          | `apps/live/components/palette/palette-tile-finish.test.ts`                                               |
| applyFinishToEl                                              | `apps/live/lib/style-presets.test.ts`                                                                    |
| preview draws each finish, stable, in the tab's font         | `apps/live/lib/finish-preview.test.ts`                                                                   |
| dialog tab sets, previews, Apply to All clears               | `apps/live/components/dialogs/CanvasThemeDialog.test.tsx`, `apps/live/hooks/canvas/useTabCanvas.test.ts` |
| Participant cannot write `finish`                            | `packages/document/src/participant-content.leak.test.ts`                                                 |

## Constants and configuration

| Constant                 | Value  | Provenance                                                             | Safe range              |
| ------------------------ | ------ | ---------------------------------------------------------------------- | ----------------------- |
| `PROFESSIONAL_CORNER_PX` | 0      | square, the clearest break from Flexible (user feedback)               | 0 to 4                  |
| `PROFESSIONAL_FONT_ID`   | inter  | the catalogue's neutral sans                                           | any sans font id        |
| `SKETCH_JITTER_PX`       | 1.5    | rough.js roughness 1 reads at ~1-2 px                                  | 0.5 to 3                |
| `SKETCH_OVERSHOOT_PX`    | 2      | visible corner crossings without stray tails                           | 0 to 4                  |
| `SKETCH_BOW_SHARE`       | 0.02   | a visible bow on long edges (tuned by eye)                             | 0 to 0.03               |
| `SKETCH_BOW_MAX_PX`      | 5      | stops long edges from looking bent                                     | 1 to 8                  |
| `SKETCH_CURVE_STEP_PX`   | 20     | smooth under the spline, half the string work of 14                    | 12 to 28                |
| `SKETCH_CURVE_JITTER_PX` | 2      | eased wander reads like a hand at 2 px (tuned by eye)                  | 1 to 3                  |
| `SKETCH_HATCH_ANGLE_DEG` | -41    | rough.js default hachure angle                                         | -60 to -30              |
| `SKETCH_HATCH_MAX_LINES` | 300    | caps cost on huge shapes                                               | 100 to 600              |
| `SKETCH_HATCH_OPACITY`   | 0.15   | shading that reads without distracting (softened from 0.3 on feedback) | 0.1 to 0.45             |
| `SKETCH_FONT_ID`         | caveat | the catalogue's handwriting font                                       | any handwriting font id |

## Assets and external resources

Caveat is already in the font catalogue (`packages/document/src/fonts.ts`, Google Fonts, OFL). No new asset.
