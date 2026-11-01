# The Fill tool: blueprint

Derived from [The Fill tool](../fill-tool.md) and the Fill rows of [Draw mode](../draw-mode.md).
Defaults applied where the spec is silent are ledgered in [DEFAULTS.md](DEFAULTS.md) as `Fn`.
livedesign builds the same tool on its logo pages from the same shared modules (livedesign
docs/specs/023-draw-mode/drawing-tools.md "The Fill tool").

Scope, by file:

| File                                                                  | Role                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/model-core/src/stroke-loop.ts` (monorepo root)              | `STROKE_LOOP_*`, `isStrokeLoop`, `closeStrokeLoop`, `insideLoop`, `loopFillPath` (pure)    |
| `packages/workbench/src/lib/fill-choice.ts` (monorepo root)           | The bucket's colour in this browser: `parseFillChoice`, `loadFillChoice`, `saveFillChoice` |
| `packages/document/src/stroke-loop-fill.ts`                           | `isOpenMarkerLoop`, `isFilledPenLoop`, `fillStrokeLoop`, `penLoopFillPath`                 |
| `packages/document/src/svg-render-shapes.ts`                          | Export: a filled loop's fill path under its ink                                            |
| `packages/document/src/whiteboard-stroke.ts`                          | The Stroke eraser touches a filled loop's fill                                             |
| `apps/editor/lib/paint-bucket.ts`                                     | `paintBucketTarget` (what a press fills) and `pourBucket` (the element after) (pure)       |
| `apps/editor/lib/draw-mode.ts`                                        | The `fill` intent, `isFillIntent`, `isHeldToolIntent`, its cursor and copy                 |
| `packages/workbench/src/hooks/canvas/useFillPress.ts` (monorepo root) | The press: release within the slop, pinch and cancel rules (shared with livedesign)        |
| `apps/editor/hooks/canvas/usePaintBucket.ts`                          | The press landing: gates, hint, one `commit`, telemetry                                    |
| `apps/editor/hooks/canvas/useWhiteboard.ts`                           | `fill`, `pickFill`, `setFill` on the dock model                                            |
| `apps/editor/components/canvas/whiteboard/DrawingToolsGroup.tsx`      | The Fill button (`FillToolIcon`, `@liveworkspace/ui`), between the divider and the Eraser  |
| `apps/editor/components/canvas/whiteboard/FillColourPicker.tsx`       | The one colour picker, set for a fill                                                      |
| `apps/editor/components/canvas/boxed-element-overlays.tsx`            | `FreehandSvg` draws a filled loop's fill under its ink                                     |
| `apps/editor/hooks/canvas/editor-shortcut-keys.ts`                    | `f` on a whiteboard                                                                        |

## Domain and naming

| Term              | Identifier                      | Meaning                                                                  |
| ----------------- | ------------------------------- | ------------------------------------------------------------------------ |
| Fill tool, bucket | `{ type: 'fill', fill }` intent | The paint bucket in hand; `fill` is `#rrggbb` or `transparent`           |
| Fill choice       | `FillChoice`                    | What this browser stored: a colour, `transparent`, or null (the default) |
| Marker loop       | `isOpenMarkerLoop(el)`          | An open marker stroke whose ends meet (`isStrokeLoop`)                   |
| Filled loop       | `isFilledPenLoop(el)`           | A marker stroke with `closed: true` and a visible `fillColor`            |
| Target            | `BucketTarget`                  | `fill` (set a fill), `loop` (close and fill), `locked`, `none`           |
| Press             | `beginFillPress`                | A pointer down and up within `FILL_PRESS_SLOP_PX`, one pointer           |

Banned synonyms: "flood fill" (nothing floods: one element is filled), "paint" for the action in
code (it is a fill or a pour), "Transparent" in copy (the picker's option is **No fill**).

## Behaviour and state

### `isStrokeLoop(points, penWidth)`

- `points.length >= STROKE_LOOP_MIN_POINTS` (4), else false.
- `gap = |first - last|`; `tolerance = max(16, 3 x penWidth, 0.15 x longer box side)`; false when
  `gap > tolerance`.
- Closed across the gap: `roundness = 4πA / P²` (shoelace area, perimeter including the gap)
  `>= STROKE_LOOP_MIN_ROUNDNESS` (0.1), else false. A circle is 1; a line out and back is 0.

### `paintBucketTarget(elements, p, inertIds)`

- Walks `elements` (paint order, bottom first, from `layerBands`) from the top. Skips ids in
  `inertIds` (hidden or locked layers).
- Per element a verdict: `through` (keep walking), `stop` (`none`), `fill` or `loop`.
  - `arrow`, `text`: through. Anything whose box (grown to its circumscribed circle when rotated)
    misses `p`: through, before any geometry is decoded.
  - `freehand`: a highlight is through; outside its polygon (even-odd) through; `closed` is fill;
    an open marker loop is loop; else through.
  - `path`: open is through; else even-odd over every contour sampled (`samplePath`), odd is fill.
  - `shape`: outside `pointInsideOutline` through; `supportsQuickSection(el, 'background')` fill,
    else stop (a chart, a Sankey).
  - Everything else (sticky, image, table, embed): stop.
- The first non-through element: `locked` when it is locked, else its verdict.

### `pourBucket(target, colour)`

- `loop`: `transparent` returns null; else `fillStrokeLoop(el, colour)`: points and pressures
  repacked through `closeStrokeLoop` (the first point appended when the gap is over 0.5 px, with
  the last pressure), `closed: true`, `fillColor`; every other field kept, the id included.
- `fill`: null when `fillColor` already equals `colour` (case-insensitive) and no `fillSwatch` or
  `colorPreset` is bound. A path takes `fillColor` and drops `fillSwatch`; a shape or stroke goes
  through `applyFillColorToEl` (a shape drops `colorPreset` and `fillSwatch`). Anything else null.

### `usePaintBucket.paintBucket(point)`

Order: the intent must be `fill`; `editsBlocked` refuses silently; the target; `none` or `locked`
shows its hint (`toast.info`) and reports `FillMissed`; `canRecolour(el)` false refuses silently;
`pourBucket` null changes nothing; else one `commit` mapping that id, then `FillLoop` or
`FillBucket`. Each refusal writes a `[fill]` debug line.

### `useFillPress.beginFillPress(e)`

- Takes `armed` (`isFillIntent(pendingDraw)`). Claims (returns true) only with the bucket armed, an `onPaintBucket`, and the main button; it
  runs first in `beginPendingDrawOrPolygon`, so no drawing gesture starts.
- Window capture listeners for `pointerdown`, `pointerup`, `pointercancel`. A second pointer marks
  the press pinched (seen by the window listener and again by the canvas's own handler, which is
  swallowed). Release of the press's pointer: nothing when pinched, `isPinchingRef` is set, or it
  moved `>= 6` screen px; else `onPaintBucket(pointerToCanvas(down point))`.
- The same pointer going down again restarts the press; putting the tool down or unmounting
  removes the listeners.

### The dock model

- `fill = choice ?? fillSwatches[1].color ?? fillSwatches[0].color ?? 'transparent'`, so the
  default follows the theme.
- `pickFill`: `setCanvasTool('select')`, `beginDraw({ type: 'fill', fill })`, telemetry.
- `setFill(next)`: no-op for the same colour; stores it; re-arms the intent when the bucket is in
  hand; telemetry.
- The intent is whiteboard-only (`isWhiteboardOnlyIntent`), so a diagram tab puts it down, and held
  (`isHeldToolIntent`), so it shows no one-shot banner; it is not `isHeldPenIntent`, so the
  finger-pans rule does not apply to it.

## Interfaces and contracts

- `isStrokeLoop(points: {x,y}[], penWidth: number): boolean`; `closeStrokeLoop(points, pressures?)`
  returns `{ points, pressures }`; `loopFillPath(points, fmt?)` returns `M .. L .. Z` or `''` under
  three points.
- `paintBucketTarget(elements, p, inertIds?) → BucketTarget`; `pourBucket(target, colour) →
Element | null`.
- `usePaintBucket({ pendingDraw, elements, layers, inertIds, editsBlocked, canRecolour, commit,
hint }) → { paintBucket }`; `CanvasProps.onPaintBucket?(point)`.
- Telemetry: `Draw·Selected·Fill`, `Draw·Changed·FillColour`, `Draw·Changed·FillMissed`,
  `Element·Changed·FillBucket`, `Element·Changed·FillLoop`, each explained on the dashboard.

## Data and persistence

- No new element field: a filled loop is a `freehand` with `closed` and `fillColor`, both already
  in the schema, synced and validated as any stroke. Older clients draw it as a closed pen stroke
  (its ink), and the fill once updated.
- The colour: `localStorage['livediagram:v2:whiteboard-fill']`, a lower-cased `#rrggbb` or
  `transparent`; anything else reads as null. Never on the document.

## Errors and edge cases

- A press on a stroke drawn with an old client and no `penWidth`: not a marker, so not a loop.
- A loop whose ends already touch (gap at most 0.5 px): closed without a new point.
- A rotated element: the box test grows to the circumscribed circle; `pointInsideOutline` handles
  the rotation for shapes.
- A press on a locked element: its hint; on a locked or hidden layer: not seen at all.
- A colour equal to the current one, or No fill on an open loop: no commit, no undo step.

## Security and trust

- Gated on the session's `can.recolour(el)` and `editsBlocked`. A Participant's room applies its
  ops through `applyParticipantOp`, which keeps `closed` and `fillColor` as stored on anything but
  a sticky, so a forged fill never lands (`participant-content.test.ts`).
- The stored colour is validated against `#rrggbb` before use; it never reaches markup unparsed.

## Performance and limits

- A press is one walk from the top; the box test runs before any decode, so only strokes under the
  pointer decode their points. Guarded: 5,000 marker strokes, a press inside the last, under
  `cpuBudgetMs(8)` per press (`paint-bucket.test.ts`).
- `isStrokeLoop` is linear in the stroke's points and runs only for the strokes under the press.
- Rendering adds one path per filled loop; nothing for any other stroke.

## Presentation and UX

- Dock order: Select, Markers 1 to 3, Text, Path tool, divider, **Fill**, Eraser.
- The button: `FillToolIcon` (`@liveworkspace/ui`, shared with livedesign): `lucidePaintBucket` scaled to 0.8 above a 3 px bar in the colour; No fill draws the
  no-colour chip (a rect with a slash).
- The flyout **Fill** holds `FillColourPicker`: `noColour('transparent', 'No fill')`, the theme's
  fills deduplicated (`themeOptions`), `standardGroup('soft', board, 'hex')`, document colours.
- Cursor: a tipping bucket glyph via `drawCursorFromGlyph`, hotspot the shared draw anchor.
- Hints: `FILL_MISSED_HINT`, `FILL_LOCKED_HINT` (spec copy).

## Accessibility

- The button is a toggle (`aria-pressed`) named Fill with `aria-keyshortcuts="F"`; the flyout is a
  group named Fill; the picker brings its own names and keyboard model.
- Hints are polite toasts.

## Web Experience

- Desktop, a 450 px window and a phone: the dock scrolls as it does; the press works by mouse, pen
  and finger; a pinch zooms.
- Export, thumbnails and previews draw the fill from `penLoopFillPath`, the canvas's own function.

## Observability

- Telemetry above; never the colour. `[fill]` debug lines for each refusal and each fill.

## Testing

- `stroke-loop.test.ts`: the gap rule, roundness, closing, inside, the fill path.
- `stroke-loop-fill.test.ts`: loop detection, fill conversion keeping identity, the fill path.
- `paint-bucket.test.ts`: every verdict, rotation, holes, pouring, and the CPU budget.
- `usePaintBucket.test.tsx`: commit, hints, every gate (roles via `editsBlocked`, `canRecolour`).
- `useFillPress.test.tsx`: release, slop, pinch, cancel, restart, tool put down.
- `useWhiteboard.test.tsx`, `WhiteboardDock.test.tsx`, `useEditorKeyboardShortcuts.dom.test.tsx`,
  `draw-mode.test.ts`, `whiteboard-tool.test.ts`, `freehand-svg.test.tsx`,
  `participant-content.test.ts`, `fill-choice.test.ts`.

## Constants and configuration

| Constant                     | Value                            | Where                  |
| ---------------------------- | -------------------------------- | ---------------------- |
| `STROKE_LOOP_MIN_POINTS`     | 4                                | model-core stroke-loop |
| `STROKE_LOOP_MIN_GAP_PX`     | 16                               | model-core stroke-loop |
| `STROKE_LOOP_GAP_PEN_WIDTHS` | 3                                | model-core stroke-loop |
| `STROKE_LOOP_GAP_RATIO`      | 0.15                             | model-core stroke-loop |
| `STROKE_LOOP_MIN_ROUNDNESS`  | 0.1                              | model-core stroke-loop |
| `FILL_PRESS_SLOP_PX`         | 6                                | workbench useFillPress |
| `FILL_CHOICE_KEY`            | `livediagram:v2:whiteboard-fill` | useWhiteboard          |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md) rows F1 to F6.
