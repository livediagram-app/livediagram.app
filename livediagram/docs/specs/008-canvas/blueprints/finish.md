# Finish: blueprint

Derived from [Finish](../finish.md). Defaults in [DEFAULTS.md](DEFAULTS.md) (D-finish rows).

## Domain and naming

| Term (spec)       | Identifier                                                        | Never                          |
| ----------------- | ----------------------------------------------------------------- | ------------------------------ |
| finish            | `Finish` (`'flexible' \| 'professional' \| 'sketch' \| 'marker'`) | tone, look, style, render mode |
| a tab's finish    | `Tab.finish?: Finish`                                             |                                |
| an element's own  | `finish?: Finish` on shape, arrow, text, sticky, table elements   |                                |
| drawn finish      | `resolveFinish(own, tab)`                                         | effective finish               |
| Follow Tab        | the element's `finish` key absent                                 | inherit, default               |
| hand-drawn stroke | a **sketch stroke** (`sketchStrokes`)                             | rough path                     |
| pencil hatching   | **hatching** (`sketchHatching`)                                   | hachure (in code), fill lines  |
| hand-drawn finish | `HandDrawnFinish` (`'sketch' \| 'marker'`), `isHandDrawn`         | rough finish                   |
| marker stroke     | a **marker stroke** (`markerStrokes`), dealt into two **layers**  | felt line                      |
| colouring in      | **colouring** (`markerColouring`), its rows the **streaks**       | scribble, fill strokes         |
| ink pooling       | crossings between the two layers drawn darker                     | blending, overlap glow         |

"Tone" stays the colour picker's strong / soft term ([Domain language](../../003-system-architecture/domain-language.md)).

## Interfaces and contracts

### `packages/document/src/finish.ts`

```ts
export type Finish = 'flexible' | 'professional' | 'sketch' | 'marker';
export const FINISHES: readonly Finish[] = ['flexible', 'professional', 'sketch', 'marker'];
export type HandDrawnFinish = 'sketch' | 'marker';
export function isHandDrawn(finish: Finish): finish is HandDrawnFinish;
export function finishDrawsBodyByHand(finish: Finish, type: string): boolean;
// sketch → true; marker → type !== 'sticky' (a sticky stays paper with its peel); else false
export const DEFAULT_FINISH: Finish = 'flexible';
export function isFinish(v: unknown): v is Finish;
export function resolveFinish(own: Finish | undefined, tab: Finish | undefined): Finish;
// own ?? tab ?? DEFAULT_FINISH; a stored value that is not a Finish reads as absent.

export const PROFESSIONAL_CORNER_PX = 0;
export const PROFESSIONAL_FONT_ID = 'inter';
export const SKETCH_FONT_ID = 'caveat';
export const MARKER_FONT_ID = 'permanent-marker';
export const MARKER_LINE_PX = 3;
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
export function finishArrowWidthPx(own: number | undefined, finish: Finish): number;
// marker and (own unset or ≤ 1) → MARKER_LINE_PX; else own ?? (professional ? 1 : 2); ArrowView and svgArrow
export function finishIconWeight(own: IconWeight | undefined, finish: Finish): IconWeight;
// own ?? (professional ? 'thin' : marker ? 'bold' : DEFAULT_ICON_WEIGHT)
export function finishDrawsDefaultShadow(finish: Finish): boolean; // finish !== 'professional'
export function finishFontId(
  own: string | undefined,
  tab: string | undefined,
  finish: Finish,
): string | undefined;
// own ?? tab ?? (sketch ? SKETCH_FONT_ID : marker ? MARKER_FONT_ID : professional ? PROFESSIONAL_FONT_ID : undefined)
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

export const sketchSeed: (id: string) => number; // fnv1aString (string-hash.ts): FNV-1a 32-bit of the id
export const sketchRandom: (seed: number) => () => number; // seededRandom (seeded-random.ts): mulberry32, [0, 1)
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

### `packages/document/src/marker.ts` (pure geometry, no DOM)

Marker draws the outlines `sketch.ts` builds (`SketchOutline`, exported for it, with `sketchPoint` for path text),
with its own pen. Seeded from `sketchSeed(id)` through `sketchRandom`, each function on its own stream
(`seed ^ constant`), so Marker and Sketch never share a wobble.

```ts
export type MarkerLayers = [string, string];
export function markerStrokes(
  outline: SketchOutline,
  seed: number,
  opts?: { pinEnds?: boolean },
): MarkerLayers;
export function trimOutline(outline: SketchOutline, startPx: number, endPx: number): SketchOutline;
export function markerArrowHead(
  tip: Pt,
  dir: Pt,
  lengthPx: number,
  seed: number,
  closed: boolean,
): string;
export function markerColouring(area: Pt[], seed: number): { streaks: MarkerLayers; nibPx: number };
```

- **Lines.** One stroke per straight segment: the start lands early by `0..MARKER_LEAD_IN_PX`, the end runs past by
  `(0.35..1) * MARKER_OVERSHOOT_PX`, both scaled by `min(1, len / 30)`; ends jitter by `min(MARKER_JITTER_PX,
len * 0.04)`; the bow is `±min(len * MARKER_BOW_SHARE, MARKER_BOW_MAX_PX)`. Emitted as `M s Q c e`.
- **Gestures.** A line followed by an open curve (a rounded corner) is one stroke: the line ends exactly on its
  corner (no overshoot) and the corner's spline carries on from the line's actual end. A rounded rectangle is four
  strokes, not eight.
- **Curves.** Samples drift by `MARKER_CURVE_JITTER_PX`, set every fourth sample and eased between; a Catmull-Rom
  spline. A closed curve starts at a random sample, goes once round, then on for `round(n * MARKER_LOOP_OVERLAP)`
  more samples (at least 1): that stretch is a stroke of its own, the **overlap**.
- **Layers.** Strokes alternate layers by index (0, 1, 0, 1, ...), so adjacent strokes cross between layers. A closed
  curve's overlap goes in the layer its stroke is not in (layer 1 for a lone loop).
- **Pinned ends** (`pinEnds`): the outline's first start and last end stay exactly where they are (no lead-in,
  jitter or overshoot); an arrow meets its boxes and its heads.
- **Trim.** `trimOutline` cuts the first segment's start and the last segment's end back along themselves by the
  given lengths: a line moves its end point; an open curve drops samples and interpolates the cut. A line not longer
  than 1.5 times its cut, a curve the cut would empty, and a closed curve are left whole.
- **Heads.** Base at `tip - dir * L`; open (line): half-width `L / 2`, one stroke `w1 → tip → w2` with a ±0.8 px bow
  on each arm; closed (triangle, hollow): half-width `0.42 L`, `M w1 L tip L w2 Z`. Corners jitter by
  `min(0.8, L * 0.05)`, the tip by half that.
- **Colouring.** The area is turned by `MARKER_COLOUR_ANGLE_DEG ± 6°` (seeded per element) and scanned in rows `nib`
  wide: `nib = clamp(max(MARKER_COLOUR_NIB_PX, extent / (MARKER_COLOUR_MAX_ROWS * MARKER_COLOUR_STEP)), 2, extent)`,
  `rows = ceil((extent - nib) / (nib * MARKER_COLOUR_STEP)) + 1`, spread evenly so the first and last rows' edges
  touch the area's extremes. A row runs where its centre line and both its edges (`±0.96 * nib / 2`) are all inside
  the area (the intersection of the three scan spans), so a row never leaves a convex or concave area; each end is
  pulled in by `nib / 2` (its round cap) plus `0..MARKER_COLOUR_RAGGED_PX`. Rows alternate direction and layer; a
  span too short for a stroke draws a dab. An area under 2 px across draws nothing (`nibPx` 0).
- Every output is deterministic for the same input and seed; numbers are written in tenths (`sketchPoint`).

### `packages/document/src/marker-element.ts` and `hand-drawn.ts`

- `markerElementPaint(el, fill, backdrop)` returns `{ drawing: MarkerDrawing, strokePx, dash }` or null:
  - `MarkerDrawing = { pen: 'marker'; ink: MarkerLayers; details: string; solid: string; streaks: MarkerLayers;
nibPx: number }`.
  - table: its frame at `MARKER_TABLE_FRAME_PX` (2.5), no fill layers; sticky, comment pin, text, images and
    self-painting kinds: null.
  - shape: `strokePx` is `MARKER_LINE_PX` when `strokeWidth` is unset or `thin`, else `BORDER_STROKE_PX[strokeWidth]`; dash and corner as
    Flexible's; outlines from `handDrawnOutlines(el, strokePx / 2, radiusPx)` (`sketch-element.ts`, shared with
    Sketch: shape-table parts fitted to the box, or the box kind's outline as its `main` part). Detail parts go to
    `details`; others to `ink` when `strokePx > 0`; filled roles (`FILLED_ROLES`, `shape-hit.ts`) add `solid`, and
    `markerColouring` streaks when `finishHatches(el, fill, backdrop)`; `nibPx` is the broadest part's.
- `markerArrow(id, pathD, o)`: heads for `MARKER_HEAD_SHAPES` (triangle, hollow triangle, line) at length
  `ARROWHEAD_SIZE_PX[size] * min(strokePx, MARKER_HEAD_SCALE_MAX_PX)`, tip `0.1 L` past the end; the line is
  `markerStrokes(outline, seed, { pinEnds: true })`, trimmed by `0.9 L` at a hollow head's end; `oneLayer` joins
  both layers into the first (a flow runs); `headFill` for a triangle.
- `sketchElement`'s `SketchDrawing` carries `pen: 'pencil'`.
- `hand-drawn.ts`: `handDrawnElementPaint(el, finish, fill, backdrop): HandDrawnPaint | null` (null unless
  `finishDrawsBodyByHand`; Marker's or Sketch's paint by finish) and `handDrawnArrow(finish, id, pathD,
{ strokePx, headSize, headShape, startHead, endHead, flowing }): HandDrawnArrow | null` (`{ line, lineOver,
heads, sketchedHeads, headFill, inkOpacity }`; Sketch: `lineOver` empty, `headFill` false, `inkOpacity` 1, one
  pass while `flowing`; Marker: `inkOpacity` `MARKER_INK_OPACITY`). The canvas and the export call only these two.

### `packages/document/src/sketch-element.ts` and `sketch-backdrop.ts`

- `sketchElement(el, { strokePx, radiusPx, fill, backdrop })` returns the `SketchDrawing` layers (`strokes`,
  `details`, `hatch`, `solid`); `sketchElementPaint(el, finish, fill, backdrop)` resolves stroke, dash and radius as an
  unsketched element in the same finish; `sketchArrow(id, pathD, options)` returns the sketched line and, for
  `SKETCHED_HEAD_SHAPES` (triangle, hollow triangle, line), the heads.
- `sketchBackdropIds(elements, tabFinish): Set<string>`: candidates are elements where `finishHatchesKind` holds and
  the resolved finish is hand-drawn, Sketch or Marker (none: an empty set, no further work). Boxed centres are collected with their drawing
  order and sorted by x; per candidate a binary search finds the first centre at or right of its left edge and scans
  until past its right edge; a later element's centre inside its box makes it a backdrop. O(n log n + hits). A
  backdrop draws `solid`, never `hatch`.

### Canvas (`apps/editor`)

- `components/canvas/CanvasFinishContext.tsx`: `CanvasFinishProvider` (the active tab's finish, re-provided by each
  `Canvas` for its own tab), `useTabFinish()` and `useElementFinish(own): Finish`, a context like
  `CanvasSurfaceContext` so memoised element views re-render on a tab finish change.
- `describeVariant(..., surface, finish)`: Professional drops `shadow-sm` and the sticky peel and uses the
  Professional corner / stroke fallbacks; Sketch makes the wrapper's background transparent and its border none for
  CSS shapes and stickies and drops the peel. Marker does the same through `finishDrawsBodyByHand`, except a sticky,
  which keeps its paper and peel.
- `lib/sketch-backdrop-store.ts`: `usePublishSketchBackdrops(tabId, drawnElements, tabFinish)` (called by
  `CanvasElementsLayer`) publishes `sketchBackdropIds` per tab; `useIsSketchBackdrop(id)` is a per-id
  `useSyncExternalStore` read, so only views whose flag flips re-render.
- `components/canvas/SketchOverlay.tsx`: `useSketchPaint(element, finish, fill, backdrop)` memoised on the fields it
  reads (never position) and `SketchOverlay`, an absolutely positioned `<svg viewBox="0 0 w h">` drawing solid, hatch,
  strokes then details. `BoxedElementView` mounts it for every sketched boxed element (shapes, stickies, tables);
  `ShapeContentRouter` skips its silhouette overlay when `isHandDrawn(finish)`. `useSketchPaint` reads
  `handDrawnElementPaint`; for a `pen: 'marker'` drawing `SketchOverlay` draws (`data-finish="marker"`) the solid fill,
  each streak layer (stroke colour, `MARKER_STREAK_OPACITY`, `nibPx` wide), each ink layer (stroke colour,
  `MARKER_INK_OPACITY`, `strokePx`, the dash) and the details (`MARKER_DETAIL_PX`, the ink opacity), each its own
  `<path>` so crossings pool.
- `components/canvas/arrow-finish.ts`: `useArrowFinish(arrow, pathD)` returns the base width
  (`finishArrowWidthPx`) and the memoised `handDrawnArrow` (`flowing` while a flow runs). Under Marker `ArrowView`
  sets `strokeOpacity` to the ink opacity on the line, draws `lineOver` as a second path (same stroke, dash and
  mask), and fills a `headFill` head in the head colour at the ink opacity. `ArrowView` draws the
  sketched line in place of `pathD`, sketched heads in place of markers (in `arrowheadColor` when set); the
  selection halo and the hit band keep `pathD`.
- Lettering: `CanvasElementsLayer`, `text-hug-measure` and `useTextStyleSetters` resolve fonts with `elementFontId`.
- Mind connectors: `deriveArrowViewFrame(arrow, index, finish)` / `arrowViewGeometry(..., finish)` (finish from
  `resolveFinish(el.finish, tabFinish)` in `CanvasElementsLayer` and `previewArrowGeometry`) draw through
  `finishArrowEnds` (`packages/document/src/mind-connector-route.ts`, blueprint in
  [Mind node](../../009-elements/blueprints/mind-node.md)); a routed frame has no curve, elbow or anchor handles,
  and `beginArrowBend` refuses a routed connector.
- New arrows: `applyCollisionAvoidance(els, arrowId, tabFinish)` gives an untouched arrow
  `arrowStyle: finishNewArrowStyle(finish)` under Professional and skips the curve when `finishCurvesNewArrows` is
  false.
- Palette: `components/palette/palette-tile-finish.ts` `paletteFinishClass(finish, action?)` (Sketch for every tile;
  Professional and Marker for every tile but `tech-icon` and `sticker`); `IconButton` adds the class to the glyph wrapper from
  `useTabFinish()` when given the tile's `finishAction`, and `StickerPickerTab` wraps each sticker's art in it. `app/globals.css`: `.palette-finish-professional` (mitre joins, 1 px
  strokes, `rx: 0`) and `.palette-finish-sketch` (`filter: url(#lvd-sketch-tile)`) and `.palette-finish-marker` (round caps and joins, 2.75 px strokes at 0.88 (the default glyph line is close to 2.25, so 2.25 barely showed)
  opacity).
  `components/canvas/SketchFilterDefs.tsx` renders that filter once in `EditorView`: two `feTurbulence` +
  `feDisplacementMap` passes (seeds 7 and 23, base frequency 0.12 and 0.1, scale 3), merged.

- Faces (spec "Every other face is drawn by hand too"): `finishSplitsFace(el)` (`finish.ts`) names the elements
  whose face is split: every shape kind outside `SKETCHED_BY_BODY` (the plain boxes whose sketched body is their
  whole drawing, the sequence diagram, icons and stickers), a plain box with an inline icon, tables, link cards,
  video and annotations. `BoxedElementView` wraps everything it draws over the body (accent edge to
  `ElementFaceRouter`) in `components/canvas/SketchFace.tsx` when the resolved finish is Sketch (never Marker) and the predicate
  holds. `SketchFace` renders an empty `[data-sketch-ink]` div (`aria-hidden`, `inert`) then a
  `[data-sketch-words]` div holding the face, both `absolute inset-0`, no z-index. In a layout effect it fills the
  ink div with `sketchInkCopy(live)` (a `cloneNode` with `img, video, iframe, canvas, [data-sketch-skip]` removed and
  every `id` stripped), and re-takes it from a `MutationObserver` on the live div, `SKETCH_INK_SETTLE_MS` after the
  last change, never later than `SKETCH_INK_MAX_WAIT_MS` after the first. `app/sketch-face.css` hides the live
  layer's backgrounds, borders, shadows (not on `:focus-visible`) and SVG shapes (`opacity: 0`), and gives the ink
  layer `filter: url(#lvd-sketch-face)`, `pointer-events: none`, transparent text fill and hidden SVG text.
- `SketchFilterDefs` also renders `SKETCH_FACE_FILTER` (`svg-render-sketch.ts`): one `feTurbulence` (octaves 1,
  seed 7, base frequency 0.12) and one `feDisplacementMap` (scale 3) over a 5% margin.
- WebKit (spec "In WebKit"): `../packages/workbench/src/lib/live-filter-cost.ts` `liveFiltersRedrawOnRepaint()` is true when `window` has
  `GestureEvent` (WebKit's own; `navigator.vendor` is not used, since jsdom answers Apple too). When it holds,
  `BoxedElementView` passes `active={false}` to `SketchFace` (the face draws whole), and `ShapeContentRouter` wraps
  icon and sticker art in `components/canvas/SketchArtPicture.tsx` instead of the `filter: url(#lvd-sketch-tile)`
  div. `SketchArtPicture` renders an empty `[data-sketch-art-picture]` div (`aria-hidden`, `inert`, no pointer
  events) then a hider div holding the live art, all `absolute inset-0` in a `relative h-full w-full` box (the box
  the filtered div was). In a layout effect `sketchArtPictureCopy(live)` clones the art and swaps each top-level
  `<svg>` for a `<span>` carrying the drawing's class and style (`display: block`, `position: relative`) that holds an
  `<img>` (`alt=""`, a `data:image/svg+xml` URL of `sketchArtPictureMarkup(svg)`). The markup is the drawing at
  its `clientWidth` x `clientHeight` (fill and stroke resolved from computed style wherever a class, `var(...)` or
  `currentColor` set them; `color` from the drawing; ids and classes stripped) inside
  `<g filter="url(#lvd-sketch-art)">` and `svgSketchArtFilter()` (`svg-render-sketch.ts`, the export's filter, so
  the picture wobbles as the export does; its units are the picture's, so the scale changes only sharpness), in a
  viewBox past the drawing by `SKETCH_ART_PICTURE_MARGIN` on each side. The image is laid out `scale` times the
  margin-padded box (`left`/`top` at minus the margin, `width`/`height` at `(1 + 2 x margin) x scale x 100%`) and
  shrunk by `transform: scale(1 / scale)` from its top left, because a filter in a picture runs at one pixel per
  laid-out pixel. `scale = sketchArtRasterScale(longest side, devicePixelRatio x canvas zoom)`: the ceiling of the
  screen pixels per CSS pixel, at most `SKETCH_ART_PICTURE_MAX_SCALE` and what keeps the padded side within
  `SKETCH_ART_PICTURE_MAX_PX`, at least 1. The copy is re-taken through `watchUntilSettled(live, take, { resize: true })`
  and replaces the pictures only when its markup changed; the hider is `visibility: hidden` while pictures show.
  Art with a running animation (`getAnimations({ subtree: true })`) or a drawing with no size yet gets no copy: the
  live art shows, unwobbled.
- `components/canvas/settle-watch.ts`: `watchUntilSettled(live, take, { resize })`, the settle wait `SketchFace` and
  `SketchArtPicture` share (a `MutationObserver` on the subtree, and a `ResizeObserver` after its first report when
  `resize` is set), with `SKETCH_INK_SETTLE_MS` and `SKETCH_INK_MAX_WAIT_MS`.
- Lettering of faces: the `BoxedElementView` wrapper sets `fontFamily` to the element's resolved stack when there is
  one, so words a face writes itself inherit it.

### Exports (`packages/document/src/svg-render*.ts`)

`svgArrow` resolves its ends and drawn arrow through `finishArrowEnds(arrow, elements, finish)`, so a Professional
mind connector exports on the same bracket as the canvas. `renderElementsToSvg` resolves each element's finish from `tab.finish`; `svgBoxed` and `svgArrow` take it and draw
the same strokes, hatching and heads from `sketch.ts`, and the Professional fallbacks from `finish.ts`
(`svg-render-sketch.ts` places a sketched body: `svgSketchedBody` calls `handDrawnElementPaint` when
`isHandDrawn(finish)` and writes `svgMarkerDrawing` for a marker drawing, the canvas overlay's layers in a
`data-finish="marker"` group). `svgArrow` takes its width from `finishArrowWidthPx` and its line from
`handDrawnArrow` (a still: `flowing` false); a marker line writes `stroke-opacity`, its `lineOver` as a second path,
and a `headFill` head with `fill` and `fill-opacity`. Every caller that loops `svgBoxed` (`renderElementsToSvg`,
`export-tab.ts` PNG and SVG, `Minimap`, `useLayerThumbnails`, `useSlideThumbnails`) computes `sketchBackdropIds`
once and passes `sketchBackdrop` per element; `boxedNeedsSvgRaster` sends every non-Flexible element down the SVG
raster path so PNG matches SVG.

`svgBoxed` wraps `svgBoxedFace`: it sets the element's `exportFontFamily` on its outer `<g>`, and when the element is
sketched, `finishSplitsFace` holds, passes the group's inner markup to `svgSketchFace`:
a `data-finish="sketch"` body is lifted out and kept where it was (first for a box, last for a table); the ink copy
(every `<text>`, `<image>` and `<foreignObject>` removed) goes in `<g filter="url(#lvd-sketch-face)">`; the words
copy (every `rect`, `circle`, `ellipse`, `path`, `line`, `polyline`, `polygon` and `use` given
`visibility="hidden"`, `clipPath`, `mask`, `defs`, `pattern` and `marker` blocks left whole) follows when the face
has words or photos.
`svgSketchArtDefs` emits the art filter when an icon or sticker is sketched and the face filter when a split face
is. `svgChecklistShape` and `svgLegendShape` letter in the element's face.

### Faces in their finish (spec "Faces", "Faces: frames and shapes")

- `finish.ts`: `faceFinishOf(el, finish)` (the finish a face's own parts follow: undefined for Flexible, a face that
  is only its label, or Professional on an element whose own corner wins), `finishFaceShadows(finish)` (Flexible and
  Sketch), `finishFaceCornerPx(px, finish)`, `FACTORY_CORNERS` (each kind's created corner) and
  `finishOwnCorner(el, finish)` (a factory corner reads as unset under Professional), read by every body-corner site
  (`BoxedElementView`, `element-variant`, `svg-render-border`, `sketch-element`).
- `face-finish.ts`: `isPillRect` (`FACE_PILL_SLACK_PX`), `faceAttrs`.
- `marker-face.ts`: `markerFacePart(shape, paint, face, seed, index)` describes a part (`rect`, `ellipse`, `path`,
  `polygon`, `polyline`) and returns its marker `<g data-marker-part>` or null; `facePartRole` names it `frame`,
  `shape` or `line` from `MARKER_FACE_FRAME_MIN_PX` (40), `MARKER_FACE_SHAPE_MIN_PX` (24), `MARKER_FACE_DISC_MIN_PX`
  (14), `MARKER_FACE_SHAPE_THIN_PX` (6), `MARKER_FACE_BACKDROP_SHARE` (0.6, rectangles only),
  `MARKER_FACE_BODY_SLACK_PX` (6, the face's own box: coloured in when filled), a pill or a dashed line is null.
  Colour: a line its stroke; a part with no line a deeper shade of its fill (`markerFrameInk`,
  `MARKER_FACE_FRAME_INK_SHIFT` 0.45) streaked at `MARKER_FACE_STREAK_OPACITY` (0.2); a frame `markerFrameInk` at
  `MARKER_FACE_FRAME_PX` (2.5). `handDrawnInk(stroke, fill)` draws a line under `HAND_DRAWN_INK_MIN_CONTRAST` (1.8)
  in `markerFrameInk`, used by every hand-drawn body (`SketchOverlay`, `svgSketchedBody`). At most
  `MARKER_FACE_MAX_PARTS` (120) parts; `MARKER_FACE_RULE_MIN_PX` (2.5) admits an SVG `<line>`.
- Export: `svg-render-face-finish.ts` `svgProfessionalFace(markup)` (rect corners off unless a pill or
  `data-finish-keep`, `stroke-width="2"` to 1) and `svgMarkerFace(markup, id, face)` (clips, definitions,
  foreignObjects and the marker body held; each part kept with its line removed, its marker after it, in its own
  transform), called by `svgBoxed` by `faceFinishOf`.
- Canvas: the wrapper carries `data-face-finish` and `FaceFinishProvider` (`useFaceFinish`, `useFaceShadow` for
  inline shadows); `app/face-finish.css` squares (`border-radius`, SVG `rect` `rx`/`ry` but `[data-finish-pill]`),
  flattens (`--tw-shadow`, hover `--tw-translate-y`) and thins (`border-2`, `stroke-width="2"`) under Professional and
  hides each redrawn part's own line under Marker (`[data-marker-drawn]`, `[data-marker-rules]`).
  `useFaceFinishPass(rootRef, finish, id)` re-takes on settle (`watchUntilSettled` with `ignore` for its own
  changes, `resize`, and once fonts load): Professional marks SVG pills `data-finish-pill`; Marker draws each
  positioned bordered HTML box (and the face's own box) as an `<svg data-marker-ink>` inside it, each SVG part as a
  `<g data-marker-ink>` after it, and a `[data-marker-grid]` (a table)'s cell borders joined into whole rules.
- `drawn-outline-finish.ts`: `isPolygonOutline`, `polygonStrokePx`, `handDrawnPolygonPaint`, `handDrawnPathPaint`
  (line and shading only; a combined path is never shaded), `imageCornerPx`, `handDrawnImagePaint` (an edge round
  the picture), reached through `handDrawnElementPaint`. Marker's sticky is a colouring drawing over its paper.

- Sketch's face shading: `sketchFacePart` (marker-face.ts) hatches a face's shapes (`SKETCH_FACE_HATCH_OPACITY` 0.4,
  `SKETCH_FACE_HATCH_PX` 1.5 at most, scaled by the fill's chroma) through the same pass (`pen` `'pencil'`), and
  `svgMarkerFace(..., 'pencil')` before `svgSketchFace` in the export. Sketch hides a live face's fills, so the pass
  sets `data-sketch-measure` (sketch-face.css stands down) while it reads them.
- Marks a face may set: `data-marker-shape` (a part drawn as a shape whatever its size or roundness: a progress bar's
  track and fill, a mood bar), `data-marker-fill` (its colour when painted with a gradient), `data-marker-grid` (a
  table: cell borders joined into whole rules, `data-marker-rules` hiding the pieces). An inset hairline ring
  (`box-shadow: c 0 0 0 Npx inset`) counts as a frame's line (`data-marker-drawn="ring"` drops it).
- The face's own box (`MARKER_FACE_BODY_SLACK_PX`) is coloured in once, its ink at `z-index: -1` in a box the pass
  isolates (`data-marker-isolated`), and never when the element's body is already drawn by hand (`FaceBox.bodyDrawn`,
  a `svg[data-finish]` body) or the surface is a page (`useFaceFinishPass(..., { page: true })`).
- Stickers: `sticker-markup.ts` marks the shadow `data-sticker-shadow` and the emoji art `data-finish-keep`;
  `faceFinishOf` returns Professional and Marker for a sticker (Sketch wobbles it whole); face-finish.css and
  `svgProfessionalFace` / `svgMarkerFace` drop the shadow.

### Menus and dialog

- `components/palette/FinishSection.tsx`: a `MenuAccordionSection` titled **Finish** holding `OptionRows`
  (`kind="single"`, label "Drawn As") with rows `follow-tab`, `flexible`, `professional`, `sketch`, `marker`: a glyph, the
  `FINISH_LABELS` name and the `FINISH_DETAILS` line. Hover previews through `OptionRows`' `onPreview` /
  `onPreviewEnd` (mouse only); click commits. Mounted by `ElementColourBorderSections` (the Style flyout, arrows
  included) when `supportsFinish(target)`, and by `MultiStyleSections` for the first finish-taking member;
  `resolveOwnFinish(el)` picks the checked row.
- `components/primitives/OptionRows.tsx`: optional `onPreview(id)` / `onPreviewEnd()`.
- `lib/style-presets.ts`: `applyFinishToEl(el, finish | null)` (null deletes the key; other types unchanged).
- `useStylePreview`: `previewFinish`, `commitFinish` (`'Finish'` telemetry type), plumbed through `useEditorState`,
  `EditorContextMenuHost` and `EditorContextMenu.types.ts` as `onPreviewFinish` / `onCommitFinish`.
- `CanvasThemeDialog`: `CanvasThemeTab` gains `'finish'`; `components/dialogs/FinishTab.tsx` (four tiles, two columns, four from `sm`) with help link `choosingAFinish` (`canvas/finish`); `useTabCanvas.setTabFinish` commits
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
- Stroke width none (`'none'`): Sketch draws the fill and its shading only; Marker its fill and colouring only.
- A shape thinner than the colouring nib (after the slant): no row fits inside, so it draws its solid fill uncoloured
  rather than spill a row past its outline.
- A hollow marker head on a line no longer than 1.5 times the cut: the line is left whole.
- An arrow's first and last points under Marker never move (pinned), so it meets its boxes exactly.
- Transparent fill: no fill and no hatching.
- Huge shapes (20000 px): hatching capped at `SKETCH_HATCH_MAX_LINES`, curve samples capped at 64; Marker's colouring
  widens its nib to keep at most `MARKER_COLOUR_MAX_ROWS` rows.
- Degenerate arrow (length < 0.5): drawn unsketched.
- Unknown path commands in `outlineOfPath`: the rest of the path is ignored and the outline so far is used.
- A face with no ink (words only): the export draws no filtered group; a face with no words or photos draws no words
  copy. A face whose ink copy is taken before it mounts its content gets it on the next settle.
- Duplicate definitions: the ink copy carries no ids, so the live face's `url(#...)` references resolve to its own;
  the export's two copies repeat identical gradient definitions, which resolve to the first.
- A face that animates in CSS: the copy carries the same classes, so its ink animates too (restarted at each copy).
- Hover and press tints on a face's controls are not drawn (the ink is a still copy); focus rings are.
- WebKit: a face is drawn whole, unwobbled. Icon or sticker art that animates, or whose drawing has no size yet, shows
  live and unwobbled until a settle finds it still and sized. A zoom changes no attribute in the art, so a picture
  keeps the raster scale it was taken at until its art next changes or resizes; zoomed past that, it softens.
- A browser without `ResizeObserver`: a resized icon's picture follows its next change instead.

## Security and trust

Cosmetic fields only; no user content reaches the geometry beyond numbers. Participant ops cannot carry `finish`
(not in `PARTICIPANT_STICKY_FIELDS`), locked by `participant-content.leak.test.ts`.

## Performance and limits

- Budget: one element's strokes + hatching ≤ 0.2 ms at 400 x 300 (measured 0.055 ms rect, 0.063 ms ellipse); ≤ 2 ms at
  20000 x 20000 (measured 0.23 ms rect, 0.30 ms ellipse). Path numbers are written in tenths through integer
  formatting, which tripled the speed (fractional number-to-string was the hot spot). Measured in
  `sketch.perf.test.ts`.
- Marker: held to the same budgets in `marker.perf.test.ts`. Measured side by side with Sketch in one process on a
  heavily loaded machine (load average ~105, so absolute numbers are inflated): 400 x 300 square 0.140 ms against
  Sketch's 0.108, circle 0.150 / 0.142, cloud 0.208 / 0.196, cylinder 0.261 / 0.231; 20000 x 20000 square 0.398 /
  0.465, circle 0.624 / 0.742 (the row cap makes Marker cheaper at the largest size). A marker body is five paths at
  most (solid, two streak layers, two ink layers) plus details; `stroke-opacity` creates no compositing layer, so
  there is no filter or group-opacity cost.
- Backdrops: `sketchBackdropIds` on 2,000 overlapping sketched shapes measured 0.70 ms (budget 25 ms in
  `sketch-backdrop.test.ts`); it returns at once when nothing on the tab is sketched.
- Views memoise geometry on size / kind / stroke, never position, so a drag recomputes nothing for moved shapes; the
  backdrop store re-renders only the views whose flag flips.
- Palette tiles: one shared filter definition, applied by class; no per-tile geometry.
- Faces (measured on a static build, headless Chromium, 1600 x 1000, a Sketch tab of 200 charts, Sankeys, pyramids
  and hubs plus one 2400 x 1600 Sankey, zooming and panning): copying all 201 faces' ink 6-14 ms once; the two-pass
  art filter on faces gave zoom tasks of 51-89 ms (budget: none over 50 ms, canvas-performance.md), the one-pass face
  filter none (Flexible: none); frames p95 33 ms against 16.7 ms on Flexible, raster work off the main thread. A
  pan costs nothing. A zoom restyles 80 of those faces every frame (14,800 mutations); the settle wait copies each
  once after the gesture rather than once a frame. Re-measure on a GPU-backed browser before raising the filter's
  cost.
- WebKit (measured on a static build, Playwright WebKit at 390 x 844 and device scale 3, the Cloud Architecture
  template, three Hand-tool pans): before, a Sketch pan's frames were p50 220-260 ms, p90 310-404 ms (Flexible: 14 /
  15-20 ms), the GPU process 4.3-6.1 s of CPU against 0.2 s. Turning the filters off took it to Flexible's; flat
  noise (no `feTurbulence`) still left 113-160 ms p90, and promoting the filtered parts or the world to their own
  layers made it worse (hitches to 940 ms). With pictures and whole faces: p50 14 ms, p90 19-20 ms, GPU 0.3-0.4 s,
  matching Flexible in the same runs. Chromium at the same size showed no difference between the finishes, before or
  after. Each picture is one decode per settle; at most `SKETCH_ART_PICTURE_MAX_PX` squared pixels.

## Presentation and UX

- Menu rows: a glyph (a link for Follow Tab, a rounded square for Flexible, a crisp square for Professional, a wobbly
  square for Sketch, a bold square with crossing corners and a stroke of colouring for Marker), the name, and the line
  "As the tab is", "Soft and rounded", "Square and fine", "Drawn by hand", "Bold felt-tip".
- Looks: **Workshop** (Sand, soft grid) is drawn in Marker, its lettering Marker's own Permanent Marker.
  The checked row is the element's own finish (Follow Tab when it has none).
- Finish panel: tiles of glyph over name, then a "Preview" heading over the sample diagram; heading "Finish", line "How lines, corners and lettering are drawn on this
  tab." (no apply button: a pick applies to the whole tab).

## Accessibility

The menu rows are `OptionRows`: menu item radios inside the menu (its own keys move between them), each with
`aria-checked`. The dialog tiles are `SizeButton`s with `aria-pressed`; the panel is reached from the dialog's
**Fine-tune** row named Finish, with a **Back** control to the home. Hover preview never fires for touch. No motion.

A sketched face's ink copy is `aria-hidden` and `inert`, so assistive tech and the keyboard reach the live face only,
once. The live face keeps its words at full contrast (the ink is behind them in the same colours it had) and keeps
its focus rings (`:focus-visible` is exempt from the shadow reset).

## Web Experience

No new network requests except the Caveat or Permanent Marker stylesheet, loaded on demand by the existing font loader when a sketched
element first needs it; no layout shift (overlays are absolutely positioned inside fixed-size boxes).

## Observability

Telemetry rows per the spec. `outlineOfPath` logs `console.debug('[sketch] unsupported path command', cmd)` once
per command letter.

## Testing

| Rule                                                         | Test                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| resolve order, unknown values, Professional fallbacks, font  | `packages/document/src/finish.test.ts`                                                                       |
| determinism, seeds differ, outlines, hatching bounds/caps    | `packages/document/src/sketch.test.ts`                                                                       |
| budgets                                                      | `packages/document/src/sketch.perf.test.ts`                                                                  |
| export draws sketch strokes / hatching / Professional radius | `packages/document/src/svg-render-finish.test.ts`                                                            |
| variant drops shadow / peel / border per finish              | `apps/editor/components/canvas/element-variant.test.ts`                                                      |
| menu rows commit, preview, Follow Tab clears                 | `apps/editor/components/palette/FinishSection.test.tsx`                                                      |
| backdrops: what sits on a shape, order, finish, speed        | `packages/document/src/sketch-backdrop.test.ts`                                                              |
| Professional new arrows angled; avoidance per finish         | `apps/editor/hooks/canvas/arrow-avoidance-apply.test.ts`                                                     |
| which palette tiles take the finish                          | `apps/editor/components/palette/palette-tile-finish.test.ts`                                                 |
| applyFinishToEl                                              | `apps/editor/lib/style-presets.test.ts`                                                                      |
| preview draws each finish, stable, in the tab's font         | `apps/editor/lib/finish-preview.test.ts`                                                                     |
| dialog tab sets, previews, Apply to All clears               | `apps/editor/components/dialogs/CanvasThemeDialog.test.tsx`, `apps/editor/hooks/canvas/useTabCanvas.test.ts` |
| Participant cannot write `finish`                            | `packages/document/src/participant-content.leak.test.ts`                                                     |
| which elements split their face                              | `packages/document/src/finish.test.ts`                                                                       |
| Marker: finish rules, font, widths, icon weight, sticky      | `packages/document/src/finish.test.ts`                                                                       |
| Marker: strokes, layers, gestures, pins, trim, heads, rows   | `packages/document/src/marker.test.ts`                                                                       |
| Marker: budgets                                              | `packages/document/src/marker.perf.test.ts`                                                                  |
| one door to both pens; Marker in the export; backdrops       | `packages/document/src/hand-drawn.test.ts`                                                                   |
| export split, body placement, defs, fonts                    | `packages/document/src/svg-render-sketch.test.ts`                                                            |
| ink copy, settle and longest wait, single render             | `apps/editor/components/canvas/SketchFace.test.tsx`                                                          |
| face split per finish, element font on the wrapper           | `apps/editor/components/canvas/BoxedElementView.sketch-face.test.tsx`                                        |
| WebKit: faces whole, icons as pictures, elsewhere unchanged  | `apps/editor/components/canvas/BoxedElementView.sketch-face.test.tsx`                                        |
| WebKit is told by `GestureEvent`                             | `../packages/workbench/src/lib/live-filter-cost.test.ts`                                                     |
| pictures: markup, colours, ids, scale, margin, settle, reuse | `apps/editor/components/canvas/SketchArtPicture.test.tsx`                                                    |

## Constants and configuration

| Constant                        | Value            | Provenance                                                             | Safe range              |
| ------------------------------- | ---------------- | ---------------------------------------------------------------------- | ----------------------- |
| `PROFESSIONAL_CORNER_PX`        | 0                | square, the clearest break from Flexible (user feedback)               | 0 to 4                  |
| `PROFESSIONAL_FONT_ID`          | inter            | the catalogue's neutral sans                                           | any sans font id        |
| `SKETCH_JITTER_PX`              | 1.5              | rough.js roughness 1 reads at ~1-2 px                                  | 0.5 to 3                |
| `SKETCH_OVERSHOOT_PX`           | 2                | visible corner crossings without stray tails                           | 0 to 4                  |
| `SKETCH_BOW_SHARE`              | 0.02             | a visible bow on long edges (tuned by eye)                             | 0 to 0.03               |
| `SKETCH_BOW_MAX_PX`             | 5                | stops long edges from looking bent                                     | 1 to 8                  |
| `SKETCH_CURVE_STEP_PX`          | 20               | smooth under the spline, half the string work of 14                    | 12 to 28                |
| `SKETCH_CURVE_JITTER_PX`        | 2                | eased wander reads like a hand at 2 px (tuned by eye)                  | 1 to 3                  |
| `SKETCH_HATCH_ANGLE_DEG`        | -41              | rough.js default hachure angle                                         | -60 to -30              |
| `SKETCH_HATCH_MAX_LINES`        | 300              | caps cost on huge shapes                                               | 100 to 600              |
| `SKETCH_HATCH_OPACITY`          | 0.15             | shading that reads without distracting (softened from 0.3 on feedback) | 0.1 to 0.45             |
| `SKETCH_FONT_ID`                | caveat           | the catalogue's handwriting font                                       | any handwriting font id |
| `MARKER_FONT_ID`                | permanent-marker | the catalogue's marker font                                            | any marker font id      |
| `MARKER_LINE_PX`                | 3                | a felt-tip nib: bolder than Flexible's 2, finer than Thick's 4         | 2.5 to 3.5              |
| `MARKER_JITTER_PX`              | 0.8              | a quick, steady line (tuned by eye against Sketch's 1.5)               | 0.4 to 1.5              |
| `MARKER_OVERSHOOT_PX`           | 3.5              | corners visibly cross, as a fast stroke does                           | 2 to 5                  |
| `MARKER_LEAD_IN_PX`             | 1.5              | the nib lands a little early                                           | 0 to 3                  |
| `MARKER_BOW_SHARE`              | 0.012            | flatter than a pencil (tuned by eye)                                   | 0 to 0.02               |
| `MARKER_BOW_MAX_PX`             | 3                | long edges stay straight-looking                                       | 1 to 5                  |
| `MARKER_CURVE_JITTER_PX`        | 1.2              | curves drift less than Sketch's                                        | 0.6 to 2                |
| `MARKER_LOOP_OVERLAP`           | 0.1              | a closed curve's visible overlap                                       | 0.05 to 0.2             |
| `MARKER_INK_OPACITY`            | 0.86             | crossings pool visibly, a lone line stays strong                       | 0.8 to 0.92             |
| `MARKER_DETAIL_PX`              | 1.2              | chrome reads as ink beside the nib                                     | 0.8 to 1.5              |
| `MARKER_COLOUR_NIB_PX`          | 12               | a broad colouring nib at 100% zoom                                     | 8 to 16                 |
| `MARKER_COLOUR_STEP`            | 0.74             | rows overlap by a quarter: visible streaks, no gaps                    | 0.6 to 0.85             |
| `MARKER_COLOUR_ANGLE_DEG`       | -22              | a right-hander's slant, ±6° per element                                | -35 to -10              |
| `MARKER_COLOUR_RAGGED_PX`       | 5                | row ends show inside the outline                                       | 0 to 8                  |
| `MARKER_COLOUR_MAX_ROWS`        | 200              | caps cost on huge shapes                                               | 100 to 400              |
| `MARKER_STREAK_OPACITY`         | 0.07             | one row a tint, two a streak, labels unaffected                        | 0.04 to 0.12            |
| `MARKER_TABLE_FRAME_PX`         | 2.5              | reads as marker over the grid's own rules                              | 2 to 3                  |
| `MARKER_HEAD_SCALE_MAX_PX`      | 2.5              | a 3 px line's head would swamp it (15 px long, not 18, at medium)      | 2 to 3                  |
| `SKETCH_FACE_FILTER.scale`      | 3                | matches the icons' wobble; past 4 small rules break up                 | 2 to 4                  |
| `SKETCH_FACE_FILTER.numOctaves` | 1                | two passes broke the zoom budget on a 200-chart board (measured)       | 1                       |
| `SKETCH_INK_SETTLE_MS`          | 120              | past a zoom frame or a keystroke, quicker than the eye follows         | 80 to 200               |
| `SKETCH_INK_MAX_WAIT_MS`        | 1000             | a face that never settles still follows within a second                | 500 to 2000             |
| `SKETCH_ART_PICTURE_MARGIN`     | 0.15             | the art filter's own region, so a wobbled edge is never clipped        | 0.1 to 0.2              |
| `SKETCH_ART_PICTURE_MAX_SCALE`  | 4                | covers a 3x phone screen at 100% zoom with room to zoom in             | 2 to 4                  |
| `SKETCH_ART_PICTURE_MAX_PX`     | 1024             | a big sticker's picture stays about 4 MB of pixels                     | 512 to 2048             |

## Assets and external resources

Caveat and Permanent Marker are already in the font catalogue (`../packages/model-core/src/fonts.ts`, Google Fonts, OFL
and Apache 2.0). No new asset.
