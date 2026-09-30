# Whiteboard, round one: blueprint

Derived from [Whiteboard](../whiteboard.md), with [Event storming](../../021-event-storming/event-storming.md)
as the tab-kind precedent, [Highlighter](../../008-canvas/highlighter.md) for the held-tool pattern,
[Eraser panel](../../008-canvas/eraser-panel.md) for the erase gesture and
[Two pens instead of a pen and a mode](../../008-canvas/two-pens.md) for recognition. The spec decides;
this file adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                              | Role                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/document/src/tab-kind.ts`                               | `TabKind` gains `'whiteboard'`; `tabKindOf` reads it                      |
| `packages/document/src/whiteboard.ts`                             | Tokens, backgrounds, `isWhiteboardTab`, `inkWhiteboardElement`            |
| `packages/document/src/whiteboard-stroke.ts`                      | Stroke geometry: `strokeTouchesBrush`, `eraseStrokePart`                  |
| `packages/document/src/pen-stroke.ts`                             | The pen's ink: perfect-freehand options, outline path, centre line        |
| `packages/document/src/factories.ts`                              | `freehandGeometry`: a freehand's box and points, shared with the live ink |
| `apps/live/lib/live-stroke.ts`                                    | `LiveStroke`: one stroke's raw samples, pressures and subscribers         |
| `apps/live/components/canvas/useWhiteboardPenGesture.ts`          | The whiteboard pen gesture: capture, pressure, commit                     |
| `apps/live/components/canvas/whiteboard/LiveInk.tsx`              | The stroke being drawn, laid out as it lands, written to the DOM          |
| `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.tsx` | Live ink and recognised shape, inside the canvas's transformed layer      |
| `packages/document/src/svg-render-shapes.ts`                      | `svgFreehandShape` honours `penWidth` on every stroke                     |
| `packages/api-schema` + `apps/api/src/openapi`                    | `TabKind` enum regenerated; `Whiteboard` telemetry category               |
| `packages/templates/src/templates.ts`                             | `'whiteboard'` kind, descriptor, category, pattern, overrides             |
| `packages/templates/src/build-template.ts`                        | Whiteboard builds no elements                                             |
| `packages/template-previews/src/template-preview-5.tsx`           | Whiteboard preview tile                                                   |
| `apps/live/lib/whiteboard-prefs.ts`                               | Pens, widths, colours, recognition, eraser mode; parse / load / save      |
| `apps/live/lib/whiteboard-tool.ts`                                | Active-tool derivation, pen intent, shapes, pointer routing               |
| `apps/live/lib/pen-seen.ts`                                       | Session-scoped "a pen has been used" flag                                 |
| `apps/live/lib/whiteboard-ink.ts`                                 | `createInkProjector`: the ink projection over a list, cached per element  |
| `apps/live/lib/whiteboard-erase.ts`                               | `strokesTouched`, `partialEraseStep`: one pure eraser step                |
| `apps/live/lib/draw-mode.ts`                                      | `PendingDraw` whiteboard pen variant and arrow `ends`; `isHeldPenIntent`  |
| `apps/live/lib/draw-commit.ts`                                    | `buildDrawnArrow` takes `ends` and `unpainted`                            |
| `apps/live/hooks/canvas/commit-freehand.ts`                       | The whiteboard pen commit                                                 |
| `apps/live/hooks/canvas/useCanvasEraser.ts`                       | Whiteboard Stroke and Partial erase                                       |
| `apps/live/hooks/canvas/useWhiteboard.ts`                         | The dock's state and actions                                              |
| `apps/live/components/canvas/whiteboard/*`                        | `WhiteboardDock`, `WhiteboardFlyout`, dock icons                          |
| `apps/telemetry/app/*`                                            | `Whiteboard` colour, description, sentences and the Whiteboards stack     |
| `apps/live/components/canvas/boxed-element-overlays.tsx`          | `FreehandSvg` honours `penWidth` on every stroke                          |
| `apps/live/lib/style-presets.ts`                                  | A border width clears a stroke's `penWidth`                               |
| `apps/live/lib/themes.ts`                                         | `resolveTabBackdrop` paints the board on a whiteboard                     |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                | Ink projection; whiteboard props                                          |
| `apps/live/components/canvas/CanvasChrome.tsx` and friends        | Hidden chrome; the dock's mount                                           |
| `apps/live/hooks/canvas/useCanvasSurfaceGestures.ts`              | Pen versus touch; the eraser frame                                        |
| `apps/live/components/canvas/useCanvasDrawGesture.ts`             | Hands a whiteboard pen press to `useWhiteboardPenGesture`                 |
| `apps/live/components/palette/TemplatePicker*.tsx`                | Whiteboard quick-pick; no theme step                                      |
| `apps/help/app/canvas/whiteboards/page.mdx`                       | Help article, registered in `packages/help-registry`                      |

## Domain and naming

| Term             | Identifier                                     | Meaning                                                       |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Whiteboard       | `kind: 'whiteboard'`, `isWhiteboardTab(tab)`   | A tab presented for freehand whiteboarding                    |
| Board            | `WHITEBOARD_BOARD[appearance]`                 | The canvas colour of a whiteboard                             |
| Ink              | `WHITEBOARD_INK[appearance]`                   | The colour of every unpainted element on a whiteboard         |
| Pattern          | `WHITEBOARD_PATTERN[appearance]`               | The colour of the dots and grid lines                         |
| Background       | `WhiteboardBackground` (`plain/dots/grid`)     | A board's pattern, stored as `backgroundPattern`              |
| Pen              | `WhiteboardPen`                                | Main, second or third: id, colour (`null` = ink), width in px |
| Pen width        | `WhiteboardPenWidth` (`fine/medium/bold`)      | 1, 1.5, 2.5 px, recorded as `penWidth`; stored by name        |
| Pen intent       | `PendingDraw` freehand `variant: 'whiteboard'` | The held pen, with its colour, width and recognition          |
| Dock             | `WhiteboardDock`                               | The floating bottom-centre toolbar                            |
| Dock tool        | `WhiteboardTool`                               | `select/pen/eraser/sticky/text/shape`                         |
| Flyout           | `WhiteboardFlyout`                             | A dock button's settings, opened above the dock               |
| Eraser mode      | `WhiteboardEraserMode` (`stroke/partial`)      | Whole-stroke or part-of-stroke erase                          |
| Ink projection   | `inkWhiteboardElement(el, ink)`                | Display-only colours for unpainted elements                   |
| Pen seen         | `markPenSeen()`, `penSeen()`                   | A `pen` pointer has been used in this page session            |
| Whiteboard prefs | `WhiteboardPrefs`                              | Pens, active pen, recognition, eraser mode; device-local      |
| Live stroke      | `LiveStroke`                                   | The stroke being drawn: raw samples, pressures, subscribers   |
| Pointer kind     | `PenPointerKind` (`pen/mouse/touch`)           | Which `PEN_STREAMLINE` a stroke uses; a pen records pressure  |
| Pen ink          | `PenStroke`                                    | Points, pressures, width, streamline: perfect-freehand input  |
| Centre line      | `penStrokeCentreline(stroke)`                  | The streamlined points the outline is drawn around            |

Banned synonyms: "canvas kind" for tab kind, "marker" for a whiteboard pen (the highlighter is the
marker), "rubber", "eraser size" on a whiteboard, "theme" for the whiteboard look.

## Behaviour and state

### Kind

- `TabKind = 'diagram' | 'event-storming' | 'whiteboard'`. `tabKindOf(tab)` returns `'whiteboard'`
  exactly when `tab.kind === 'whiteboard'`. `stampTabKind` is unchanged: a whiteboard always carries
  its kind explicitly, set by `templateCanvasOverrides('whiteboard')`.
- `isWhiteboardTab(tab)` is `tabKindOf(tab) === 'whiteboard'`.

### Creation

- `templateCanvasOverrides('whiteboard')` returns `{ kind: 'whiteboard', backgroundPattern: 'blank' }`.
  `buildTemplate('whiteboard', …)` returns `[]`. Category: `design` (nominal, like Blank: the picker
  shows it only as a quick-pick) (D1).
- Quick Start overview: `Blank`, then `Whiteboard`, then the category cards.
- `onTemplateCommit('whiteboard')`: welcome wizard sets `themeId = 'brand'` and goes to the settings
  step; the in-editor templates flow calls `onPick('whiteboard', name, 'brand', …)` at once.
- `chooseTemplate` tracks `Whiteboard / Created / NewTab` when `kind === 'whiteboard'` in the
  `templates` mode; the /new route tracks `Whiteboard / Created / Template`.

### Dock state

- `WhiteboardPrefs = { pens: WhiteboardPen[3], activePenId, recognise: boolean, eraserMode }`,
  defaults `DEFAULT_WHITEBOARD_PREFS` (the main, second and third pens (ink, blue, red) at Medium; only the second and third adjust colour,
  `penAdjustsColour`; `activePenId: 'main'`;
  `recognise: false`; `eraserMode: 'stroke'`).
- `activeWhiteboardTool(canvasTool, pendingDraw)`:
  - `canvasTool === 'eraser'` → `eraser` (a stray `highlighter` reads as `select`);
  - `pendingDraw` freehand `variant: 'whiteboard'` → `pen`;
  - `pendingDraw.type` `sticky` → `sticky`, `text` → `text`, `shape` or `arrow` → `shape`;
  - otherwise `select`.
- Transitions (the dock's actions, `useWhiteboard`):
  - **Select**: `setCanvasTool('select')`, `cancelDraw()`.
  - **Pen p**: when `p` is already the active pen and the tool is `pen`, toggle its flyout; else set
    `activePenId = p`, leave eraser / highlighter (`setCanvasTool('select')`), arm
    `whiteboardPenIntent(p, recognise)`, track `Whiteboard / Selected / penTelemetryType(p)`.
  - **Eraser**: when active, toggle its flyout; else `cancelDraw()`, `selectCanvasTool('eraser')`.
  - **Sticky / Text**: `setCanvasTool('select')`, arm `{ type: 'sticky' }` / `{ type: 'text' }`
    (one-shot: after placing, the tool reads `select`). Both open for typing on drop
    (`opensForTyping(intent, whiteboard)` in `draw-mode.ts`).
  - **Shapes**: toggle the shapes flyout; picking a shape arms its intent (one-shot) and closes it.
  - **Recognition**: flip `recognise`, re-arm the pen intent when a pen is held, track
    `RecognitionOn` / `RecognitionOff`.
  - **Undo / Redo**: `onUndo` / `onRedo`, disabled by `canUndo` / `canRedo`.
  - **More**: toggle the More flyout; picking a background writes `backgroundPattern` through the
    ordinary tab-canvas setter (undoable, synced) and tracks `Background<Name>`.
- Changing a pen's colour or width updates `pens[p]`, re-arms the intent when `p` is held, and tracks
  `Whiteboard / Changed / PenColour` or `PenWidth` (a pen is reported by its place, never its colour).
- **Entering a whiteboard tab** (a new active tab, or the open tab turning into a whiteboard through
  Quick Start; editable, no intent armed, tool `select` or `pan`) arms the active pen (D2). The hook
  keys this on the pair of tab id and kind.
- **Leaving a whiteboard tab** cancels a whiteboard pen intent.
- Only one flyout is open at a time; it closes on Escape (focus returns to its dock button), on an
  outside press, on a tool change and on a tab switch.

### Pen commit (`makeCommitFreehand`, `variant: 'whiteboard'`)

1. The points arrive as the live stroke's raw samples, with its `ink` (`pressures` for a pen,
   `streamline`; see [Pen ink](#pen-ink)), and are used as they are: never simplified. Fewer than 2
   points: keep the pen armed, commit nothing.
2. `recognise` and `recogniseBoardStroke({ points, pressures, width, streamline })` (its centre
   line, confidence >= 0.4):
   - `line` → arrow, `arrowEnds: 'none'`, `strokeColor` = pen colour when set, `strokeWidth` =
     `nearestBorderStroke(width)`, no `strokeColor` for Ink.
   - a shape kind → shape at the bbox, `fillColor: 'transparent'`, `strokeColor` = pen colour when
     set, `strokeWidth` = `nearestBorderStroke(width)`; track as the Shape Pen does.
3. Otherwise a freehand element: `createFreehand(points, false)` (raw samples), `penWidth: width`,
   `pressures` when a pen drew it, `streamline`, `strokeColor` = pen colour when set (the main pen
   records none). Track `Element / Added / Freehand`.
4. The pen stays armed; nothing is selected.

`nearestBorderStroke(px)`: the `BorderStroke` whose `BORDER_STROKE_PX` is nearest, ties to the
thicker (2 → `medium`, 4 → `thick`, 8 → `extra-thick`).

### Ink projection

`inkWhiteboardElement(el, ink)` returns `el` itself when nothing is unpainted, else a copy with:

| Element                                     | Filled in                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `freehand`, `pen !== 'highlighter'`         | `strokeColor ?? ink`, `fillColor ?? 'transparent'`                     |
| `text`                                      | `textColor ?? ink`                                                     |
| `shape` of `square/circle/triangle/diamond` | `strokeColor ?? ink`, `fillColor ?? 'transparent'`, `textColor ?? ink` |
| `arrow`                                     | `strokeColor ?? ink`                                                   |
| anything else                               | unchanged                                                              |

The canvas host maps the displayed elements through it with a per-object cache
(`WeakMap<Element, Element>` per ink), so an unchanged element keeps its identity between renders.

### Eraser on a whiteboard

- Brush radius in screen px: `WHITEBOARD_ERASER_RADIUS_PX = { stroke: 10, partial: 16 }`; canvas
  radius = screen radius / zoom. The eraser ring shows it.
- The gesture carries a canvas frame captured on press: `{ left, top, zoom }` of the transformed
  wrapper, so a client point maps with `pointerToCanvas`.
- Each pointer sample erases along the segment from the previous sample to this one (a capsule), so a
  fast swipe cannot skip a stroke.
- **Stroke**: a `freehand` is touched when `strokeTouchesBrush(el, a, b, r)`; any other element when
  the DOM hit test (centre plus rings, as the Eraser panel's `eraserSamplePoints`) finds it. Touched
  elements are removed whole, arrows pinned to them cascade, as today.
- **Partial**: only `freehand` elements; each touched one is replaced by `eraseStrokePart(...)`
  inside the functional `tick`, so consecutive samples compose on the live list.
- Both: one `markCheckpoint` on the first change, one activity entry on release, locked elements and
  inert layers skipped.

### Stroke geometry (`whiteboard-stroke.ts`)

- `freehandAbsolutePoints(el)`: `x + nx * width`, `y + ny * height`, rotated about the centre by
  `rotation` degrees clockwise when set.
- Ink half-width: a pen stroke's `penPressureWidth(penWidth, max(pressures))` (the middle pressure
  without pressures), else `BORDER_STROKE_PX[strokeWidth ?? DEFAULT_BORDER_STROKE]` (highlighter:
  `penWidth ?? 14`), halved.
- `strokeTouchesBrush(el, a, b, r)`: true when any polyline segment lies within `r + halfWidth` of
  segment `ab` (segment-to-segment distance); a bbox reject first.
- `eraseStrokePart(el, a, b, r, mintId)`:
  1. Densify the polyline so no segment exceeds `max(r / 2, 1)`; a pen stroke's pressures are
     interpolated with its points (crossings too).
  2. Mark each point inside when its distance to `ab` <= `r + halfWidth`.
  3. None inside → `null` (untouched). All inside → `[]`.
  4. Split into runs of outside points; at each inside/outside boundary insert the crossing point,
     found by bisection (12 steps) on the segment. A closed stroke's first and last runs join.
  5. Drop runs with fewer than 2 points or a length under 1 canvas px.
  6. Each run → `createFreehand(points, false)` with a fresh id, carrying `strokeColor`,
     `strokeWidth`, `strokeStyle`, `penWidth`, `pen`, `streamline`, `layerId`, `opacity`,
     `fillColor`, `locked` false, and its own `pressures` when the stroke had them. The longest run also carries `label`, `link`, `note`, `commentThread` and `action` (D3).

### Pen versus touch

- `whiteboardPointerRoute({ pointerType, penSeen, inking })` → `'ink' | 'pan'`: `'pan'` only for
  `pointerType === 'touch' && penSeen && inking`; else `'ink'`. `inking` is true for a held pen or the
  eraser (D4).
- Any `pointerdown` with `pointerType === 'pen'` on a whiteboard calls `markPenSeen()`. The flag is a
  module variable: it resets on reload.
- A `'pan'` route starts the ordinary canvas pan and stops the press there.
- A whiteboard stroke during which `isPinchingRef` became true is discarded on release.

### Hidden chrome

Gated on `whiteboard = isWhiteboardTab(activeTab)`:

- `panelEls.palette`, `ToolbarPalette`, `QuickStylePanel`, the Theme & canvas brush,
  `ThemeModeBanner`, `EmptyCanvasBanner`, the tool panels (`eraser`, `highlighter`, `format`), the
  mobile dock's buttons for those panels: not rendered.
- The Explorer menu button leaves the strip for its corner on a phone (`menuInStrip` false).
- The draw-mode banner does not show for a held pen (`isHeldPenIntent`).
- The dock renders when `whiteboard && !readOnly && !chromeHidden`.

### Quick style panel on a whiteboard

- `EditorView` no longer hides `QuickStylePanel` on a whiteboard.
- `useQuickStyle` on a whiteboard maps its view through `onWhiteboard(view, selected, ink)`
  (`apps/live/lib/quick-style-whiteboard.ts`): slot 0 of stroke and text shows the board ink, slot 0
  of background shows `transparent`, and an unfilled shape reads as background slot 0. Edits and
  Clear styles skip `memory.recordEdit` / `memory.forget`.
- Pen rows (`apps/live/lib/quick-style-pen.ts`, `QuickPenRows.tsx`): `view.pen` is
  `strokesPenStyle(selected, ink)` (pen strokes: `freehand` with `penWidth`, not a highlight, unlocked),
  else `heldPenStyle(pen, ink)` (Marker 1's colour row is the single Ink option, so every pen has
  both rows) when nothing is selected and `whiteboardDock.tool === 'pen'`.
  `setPenColour` / `setPenWidth` commit `applyPenStyle` over the strokes (`Element·Changed·QuickStroke`
  / `QuickStrokeWidth`) or call `updatePen` for the held pen (its own `Whiteboard·Changed` tokens).
  Ink is `INK_CHOICE` and clears `strokeColor`. Clear styles shows only when `targetIds` is non-empty. `QuickPenRows`
  shows `subject.name` as a caption unless `QuickStylePanel` has `powerUser` (from `isPowerUserMode`).
  Choosing the held pen's current value is a no-op.

### Shapes flyout hover, More flyout

- The Shapes button opens its flyout on `pointerenter` (not touch) as a hover flyout; leaving the
  button or the flyout schedules a close after `HOVER_CLOSE_MS` (250 ms, `useHoverClose`), cancelled
  by entering either. A press on a hover flyout makes it sticky. A hover flyout passes
  `takeFocus={false}` so it never moves the keyboard focus.
- The More flyout (`hideTitle`, accessible name "More") holds two headed sections: Background
  (Plain / Dots / Grid) and Drawing (Basic / Shape recognition, `setRecognition(on)`). The dock has
  no recognition button.

### Tool style and board memory

- `useStyleMemory({ documentId, theme, board })`: `board = isWhiteboardTab(activeTab)` scopes every kind as
  `board:<kind>` (`styleKindOf(el, board)`, `recordStyleEdit(..., board)`, `applyStyleMemory(..., board)`;
  `parseStyleMemory` accepts the prefix). `useQuickStyle` records and forgets on whiteboards too.
- `useShapeDrawing`'s dress on a whiteboard is `styleNewElement(boardShape(el))`.
- `lib/quick-style-tool.ts`: `toolPhantom(intent, theme)` (shape: `boardShape(createShape)`; arrow:
  `buildDrawnArrow(..., { ends, unpainted: true })`; text: `createText`; else null) and `toolCaption`.
  `useQuickStyle({ toolIntent: pendingDraw })`: on a whiteboard with nothing selected, the view is
  `quickStyleView([styleNewElement(phantom)])` through `onWhiteboard`, with `caption`; a choice runs
  `memory.recordEdit([phantom], [applied])` and bumps a version; Clear styles forgets `board:<kind>`.
- The panel shows `view.caption ?? view.pen.subject.name` above the rows unless `powerUser`.

### Selecting on a whiteboard

- `BoxedElementView`: `lineHit` = a pen stroke (`penWidth`, not a highlight) neither selected nor
  multi-selected; the wrapper gets `pointer-events: none` and `FreehandSvg` a transparent
  `[data-stroke-hit]` path of `strokeHitWidth(penWidth, zoom)` (`STROKE_HIT_SCREEN_PX` = 6 a side) with
  `pointer-events: stroke`.
- `useCanvasSurfaceGestures.onPointerDownCapture`: on a whiteboard, Select, Shift, primary button, no
  draw intent or held Space, a press on the canvas that is not inside `[data-canvas-handle]` (resize
  handles) starts an `additive` marquee with `clickTarget` = the pressed `[data-element-id]`.
  `useCanvasPanAndMarquee`: a sub-4 px additive marquee toggles `clickTarget` (`onShiftSelect`) or does
  nothing; a real one unions `currentSelection()` with its hits.
- `[data-pen-in-hand]` on the canvas wrapper while a whiteboard pen is held; `globals.css` makes every
  descendant inherit the pen cursor.
- `lib/whiteboard-pen-cursor.ts`: `PEN_CURSOR_VARIANTS` (`dot`, `nib-crosshair`), `DEFAULT_PEN_CURSOR`,
  `penCursorSvg(variant, colour, appearance, strokePx)` (dot `max(strokePx, PEN_CURSOR_DOT_MIN_PX = 6)`
  across, capped under `PEN_CURSOR_MAX_PX = 128`, rimmed 1.5 px outside in `WHITEBOARD_BOARD[appearance]`, hotspot
  a whole pixel at its centre; the
  crosshair + nib black with a white outline on light, white with no outline on dark, its dot rimmed in
  the inverse), `penCursor`. `WhiteboardPrefs.cursor` (parsed, default `nib-crosshair`), `setCursor`
  (`Whiteboard·Changed·CursorDot | CursorCrosshair`), the More flyout's Cursor row, and
  `useWhiteboardPenCursor(pendingDraw, variant, zoom)` (strokePx = pen width x zoom) feeding the Canvas cursor style.

### Recognition preview

- Locking: when the dwell fires on a recognised shape, `LiveStroke.snapTo(shape)` records it with
  the pen's position (`grab`); `shaped()` is `adjustRecognised(shape, grab, lastSample)` (lib/recognition-preview:
  a line moves its end nearer `grab`, a box moves its corner nearer `grab` and keeps the opposite,
  flipping past it). `useRecognitionPreview` shows `shaped()` on every update once locked, and the
  commit passes it as `ink.snapped`, which `whiteboardStroke` lands instead of re-reading the stroke.

- `apps/live/lib/recognition-preview.ts`: `RECOGNITION_THRESHOLD` (0.4), `RECOGNITION_PREVIEW_DWELL_MS`
  (500), `RECOGNITION_PREVIEW_STILL_PX` (4 screen px), `recogniseBoardStroke(points)`,
  `stillSince(sample, from, count, anchor, zoom)` (samples `from` to `count - 1` by accessor).
  `commit-freehand`'s `whiteboardStroke` uses `recogniseBoardStroke`.
- `useRecognitionPreview(stroke, active, zoom, penWidth)` subscribes to the `LiveStroke`. On each update it
  walks only the raw samples added since the last update; any sample farther than
  `RECOGNITION_PREVIEW_STILL_PX / zoom` from the anchor moves the anchor to the newest sample, drops
  a shown preview and restarts the dwell timer. The first update sets the anchor and starts the
  timer. On firing it recognises `stroke.ink(penWidth)` (the centre line of the stroke release would
  land) and shows the shape when one is found. A new stroke or `stroke === null` clears everything. Logs
  `[whiteboard] recognition preview <kind>`.
- `WhiteboardPenPreview` renders `RecognisedShapePreview` (`components/canvas/whiteboard/BoardShapePreview.tsx`,
  beside `PenShapePreview`) while a shape is returned, and hides (never unmounts) `LiveInk`, whose
  sealed chunks live only in the DOM. `RecognisedShapePreview` draws in canvas px inside the
  transformed layer: a shape as an absolute box at its bbox (at least 16 px) with the nearest border
  width, a line as an overflowing svg at the pen's width.

### Shapes are plain ink

- A pen is a separate tool: pens do not set the colour of other tools. `whiteboardShapeIntent(id)`
  arms the flyout's intent with `board: true` (`PendingDraw` shape and arrow intents).
- `useShapeDrawing.commitDraw` on a whiteboard applies `boardShape(el)`: a shape gets
  `fillColor: 'transparent'` and nothing else, so it draws in the ink at the default width; a line or
  arrow is left unpainted. Style memory is skipped.
- `CanvasDrawPreview` previews a board shape in the ink: a line at the default arrow width × zoom, a
  shape solid and unfilled at the default border width (`PenShapePreview`).
- A recognised shape is a pen stroke tidied up and keeps that pen's colour and weight
  (`commit-freehand.ts`).

### Pen strokes: exact thickness, no guides

- `FreehandSvg` draws a pen stroke (`isPenStroke`: `penWidth` set, not a highlighter) as the filled
  outline `penStrokePath(freehandPenStroke(el))`, `fill` = the stroke colour, `stroke="none"`, in
  an svg of class `FREEHAND_SVG_CLASS` with a viewBox the size of the element: canvas px, scaled by
  the canvas zoom in every engine. Other strokes keep the 100-unit viewBox, the Catmull-Rom path and
  `non-scaling-stroke`.
- `svgFreehandShape` (the export twin) writes the same outline from `freehandPenStroke(el, { x, y })`
  with numbers rounded by `r2`: `<path d="…" fill="colour" stroke="none"/>`.
- `LiveInk` draws the in-flight pen stroke inside the canvas's transformed wrapper (`Canvas.tsx`,
  after the element layer, via `WhiteboardPenPreview`) as exactly the committed `FreehandSvg`: each
  update takes `freehandGeometry(points)` (what `createFreehand` gives), writes a `div.absolute` at
  its box and an svg of class `FREEHAND_SVG_CLASS` with its viewBox, and sets the path to
  `penStrokePath(freehandPenStroke({ ...geometry, penWidth, pressures, streamline }))`. The same input,
  function and layout in the same layer: release changes no pixel.
- `isWhiteboardPenIntent(intent)` (`draw-mode.ts`): `useCanvasDrawGesture` starts the stroke at the
  raw pointer (no `snapDrawStart`) and shows no pre-press dot; `computeDrawGuides` returns no hover
  or stroke guides.
- Proven in the browser (Chromium and WebKit, DPR 2, dark and light): the blue ink centroid and ink
  area of a horizontal line, a vertical line and a curve, screenshot just before and just after
  pointerup, are identical at 100% and zoomed in (212% and 448%); sampled outlines of the live and
  landed stroke coincide (Hausdorff 0); a Fine, Medium and Bold mouse line measures 1.000, 1.502 to
  1.505 and 2.502 to 2.505 px of ink; a Chromium pen (CDP force) swells from 1.00 px at force 0.21 to
  2.00 px at 0.92 (1.04 and 1.97 expected). A fixed full-screen overlay had shifted lines by up to
  0.8 CSS px on release.

### Pen ink

The whiteboard pen only (`variant: 'whiteboard'`); the highlighter and the diagram pencil keep the
RDP commit (`simplifyPenStroke`) and the Catmull-Rom path. The recipe is Excalidraw's freedraw
(`getFreedrawOutlinePoints`, `getSvgPathFromStroke`), with perfect-freehand 1.2.3 (MIT).

**Capture** (`useWhiteboardPenGesture`, called by `useCanvasDrawGesture`):

1. `beginPendingDrawGesture` with a whiteboard pen intent calls `beginWhiteboardStroke(e, point)`:
   the pointer kind is `penPointerKind(e.pointerType)` (`pen`, `touch`, anything else `mouse`), the
   pointer id is `e.pointerId`; the first sample is the press point with `e.pressure`. `penStroke`
   state is set once; no React state changes again until release.
2. Window `pointermove` from the stroke's pointer (any pointer when the id is unknown): one sample
   per event (D12), converted with the wrapper rect and zoom of that event, pushed with
   `e.pressure`; then `notify()`. While `isPinchingRef` is true the stroke is marked pinched and
   nothing is sampled.
3. `pointerup` from the stroke's pointer: clear `penStroke`; unless pinched
   (`[whiteboard] stroke discarded: pinch`), push the lift position with the last pressure (D13) and
   commit `onCommitFreehand(points, false, { pressures?, streamline })`.
4. `pointercancel` from the stroke's pointer: clear `penStroke`, commit nothing
   (`[whiteboard] stroke discarded: cancel`). The pen intent leaving mid-stroke (Escape, another
   tool) does the same (`[whiteboard] stroke discarded: pen put down`).
5. Every committed stroke logs `[whiteboard] stroke <pointer> samples=<n> pressure=<yes|no>` at
   `console.debug`.

**Samples** (`createLiveStroke(pointerType, pointerId)`): raw canvas px, append-only; a sample
exactly equal to the previous one is dropped (Excalidraw drops only exact duplicates). A `pen`
records a pressure per sample, clamped to 0 to 1 (not finite: 0.5; absent: the previous one); any
other pointer records none (D10, D14). `streamline = PEN_STREAMLINE[pointer]`.

**Outline** (`pen-stroke.ts`), for `PenStroke = { points, pressures?, width, streamline }`:

- Input: `[x, y, pressures[i] ?? 0.5]` per point, the pressure always explicit (perfect-freehand
  would give a pressureless first point 0.25, thinning the start).
- Options: `size = penStrokeSize(width) = width / (2 · sin(π/4))`, `thinning: 0.6`,
  `smoothing: 0.5`, `streamline`, `easing: t => sin(t·π/2)`, `simulatePressure: false`,
  `last: true`. perfect-freehand's radius at pressure p is `size · easing(0.5 − 0.6 · (0.5 − p))`,
  so the width is exactly `width` at p = 0.5 (`penPressureWidth(width, p)`), 0.437× at 0 and
  1.345× at 1.
- `penStrokeOutline` = `getStroke(input, options)`; `penStrokePath(stroke, fmt)` =
  `M p0 Q p0 mid(p0,p1) p1 mid(p1,p2) … pn mid(pn,p0) L p0 Z` (Excalidraw's getSvgPathFromStroke);
  no points: `''`.
- `penStrokeCentreline` = `getStrokePoints(input, options)`'s points: what recognition reads.
- `freehandPenStroke(el, origin = {0, 0})`: points `origin + (nx · max(width, 1), ny · max(height,
1))`, `pressures`, `width = penWidth`, `streamline = el.streamline ?? 0` (D11).

**Render** (`LiveInk`, inside the canvas's transformed layer): see "Pen strokes" above; the whole
outline is rebuilt per update, as Excalidraw does.

### Keyboard

- `EditorKeyboardShortcutsDeps.whiteboard` (`{ pickSelect, pickPen, pickEraser }`, null off a whiteboard);
  `useEditorState` passes the dock's actions.
- On a whiteboard the listener consults only `WHITEBOARD_VIEW_KEYS` (V select, H hand, Z zen) and,
  for editors, `WHITEBOARD_EDIT_KEYS` (1, 2, 3 pens; E eraser; N note; T text; R, O, D, C, L, A the dock
  shapes via `pickShape`, plain ink), then stops: the diagram tab's
  `VIEW_TOOL_KEYS` / `EDIT_KEYS` never run there. Type-to-edit and modifier shortcuts run first,
  unchanged.
- Escape: the narrow Escape listener also arms for a whiteboard eraser and calls `pickSelect`; a
  pen, note, text or shape intent is `pendingDraw` and is cancelled as on any tab, which reads as
  Select. Only with Select in hand does Escape clear the selection.
- `WHITEBOARD_TOOL_KEYS` gives each dock button and Shapes option its key: shown bottom-right (slate-500 / dark
  slate-400, 4.5:1) and in `aria-keyshortcuts`.

### Still canvas

- `CanvasStillProvider` (`apps/live/components/canvas/CanvasStillContext.tsx`), provided by `Canvas` with
  `still = isWhiteboardTab(tab)`; `useBoxedElementAnimation` drops `animate-element-pop-in` when
  still. Author-set looping animations are untouched.
- On entering a whiteboard with `highlighter` or `format` held, the hook sets `select` and arms the
  pen; `buildEditorCommands` with `whiteboard: true` drops `tool:highlighter` and `tool:format`.

## Interfaces and contracts

```ts
// packages/document
export type TabKind = 'diagram' | 'event-storming' | 'whiteboard';
export function isWhiteboardTab(tab: { kind?: string } | undefined): boolean;
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>>;
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>>;
export const WHITEBOARD_PATTERN: Readonly<Record<Appearance, string>>;
export type WhiteboardBackground = 'plain' | 'dots' | 'grid';
export const WHITEBOARD_BACKGROUNDS: readonly {
  id: WhiteboardBackground;
  label: string;
  pattern: BackgroundPattern;
}[];
export function whiteboardBackgroundOf(
  pattern: BackgroundPattern | undefined,
): WhiteboardBackground;
export function inkWhiteboardElement<T extends Element>(el: T, ink: string): T;
export function strokeTouchesBrush(el: FreehandElement, a: Point, b: Point, r: number): boolean;
export function eraseStrokePart(
  el: FreehandElement,
  a: Point,
  b: Point,
  r: number,
  mintId: () => string,
): FreehandElement[] | null;
export function nearestBorderStroke(px: number): BorderStroke;
// FreehandElement gains `pressures?: number[]` (one per point, 0 to 1) and `streamline?: number` (0 to 1).
export type FreehandGeometry = Pick<FreehandElement, 'x' | 'y' | 'width' | 'height' | 'points'>;
export function freehandGeometry(rawPoints: readonly Point[]): FreehandGeometry; // createFreehand's box
export type PenPointerKind = 'pen' | 'mouse' | 'touch';
export const PEN_STREAMLINE: Readonly<Record<PenPointerKind, number>>;
export const PEN_THINNING: number;
export const PEN_SMOOTHING: number;
export const PEN_MID_PRESSURE: number;
export function penPointerKind(pointerType: string | undefined): PenPointerKind;
export function penStrokeSize(width: number): number;
export function penPressureWidth(width: number, pressure: number): number;
export type PenStroke = {
  points: readonly Point[];
  pressures?: readonly number[];
  width: number;
  streamline: number;
};
export function penStrokeOutline(stroke: PenStroke): Point[];
export function penStrokePath(stroke: PenStroke, fmt?: (n: number) => number): string;
export function penStrokeCentreline(stroke: PenStroke): Point[];
export function isPenStroke(el: FreehandElement): boolean;
export type PenStrokeSource = Pick<
  FreehandElement,
  'points' | 'width' | 'height' | 'pressures' | 'penWidth' | 'streamline'
>;
export function freehandPenStroke(el: PenStrokeSource, origin?: Point): PenStroke;

// apps/live
export type WhiteboardPenId = 'main' | 'second' | 'third';
export type WhiteboardPen = { id: WhiteboardPenId; colour: string | null; width: number };
export type WhiteboardEraserMode = 'stroke' | 'partial';
export type WhiteboardPrefs = {
  pens: WhiteboardPen[];
  activePenId: WhiteboardPenId;
  recognise: boolean;
  eraserMode: WhiteboardEraserMode;
};
export function parseWhiteboardPrefs(raw: unknown): WhiteboardPrefs;
export function loadWhiteboardPrefs(): WhiteboardPrefs;
export function saveWhiteboardPrefs(prefs: WhiteboardPrefs): void;
export type WhiteboardTool = 'select' | 'pen' | 'eraser' | 'sticky' | 'text' | 'shape';
export function activeWhiteboardTool(
  canvasTool: CanvasTool,
  pendingDraw: PendingDraw | null,
): WhiteboardTool;
export function whiteboardPenIntent(pen: WhiteboardPen, recognise: boolean): PendingDraw;
export function whiteboardPointerRoute(i: {
  pointerType: string;
  penSeen: boolean;
  inking: boolean;
}): 'ink' | 'pan';
export type LiveStroke = {
  readonly pointer: PenPointerKind;
  readonly pointerId: number | undefined;
  readonly streamline: number;
  readonly points: readonly Point[]; // raw samples, canvas px
  readonly pressures: readonly number[] | null; // a pen's, one per sample
  push(x: number, y: number, pressure?: number): boolean; // false for an exact repeat
  ink(width: number): PenStroke;
  subscribe(listener: () => void): () => void;
  notify(): void;
};
export function createLiveStroke(
  pointerType: string | undefined,
  pointerId: number | undefined,
): LiveStroke;
export function recogniseBoardStroke(stroke: PenStroke): RecognisedShape | null; // on its centre line
export function useRecognitionPreview(
  stroke: LiveStroke | null,
  active: boolean,
  zoom: number,
  penWidth: number,
): RecognisedShape | null;
// CanvasProps.onCommitFreehand(points, recogniseShapes, ink?: Pick<FreehandElement, 'pressures' | 'streamline'>)
export const FREEHAND_SVG_CLASS: string; // the svg a freehand stroke, live or landed, draws in
```

`PendingDraw` gains `{ type: 'freehand'; variant: 'whiteboard'; colour: string | null; width: number; recognise: boolean }`
and `{ type: 'arrow'; ends?: ArrowEnds }`.

Parsing rejects: a non-object or unparseable prefs value → defaults; a pen whose id is unknown →
dropped and refilled from defaults; a colour that is not in `WHITEBOARD_PEN_COLOURS`, or any colour on
the main pen → the pen's default colour; a width that is not a preset NAME (`fine`, `medium`, `bold`; widths are stored
by name so the px can be retuned) → Medium; an unknown `activePenId` or
`eraserMode` → default; `recognise` not a boolean → `false`.

## Data and persistence

| Field                         | Where                                           | Class        | Travels |
| ----------------------------- | ----------------------------------------------- | ------------ | ------- |
| `Tab.kind = 'whiteboard'`     | tab body (D1, IndexedDB)                        | document     | yes     |
| `Tab.backgroundPattern`       | tab body                                        | document     | yes     |
| `FreehandElement.penWidth`    | element                                         | document     | yes     |
| `FreehandElement.pressures`   | element (a pen's; one per point, 0 to 1)        | document     | yes     |
| `FreehandElement.streamline`  | element (0 to 1)                                | document     | yes     |
| `FreehandElement.strokeColor` | element (coloured pens)                         | document     | yes     |
| `WhiteboardPrefs`             | `localStorage` `livediagram:v2:whiteboard-pens` | device-local | never   |
| pen seen                      | module memory                                   | session      | never   |

No migration: `kind` is an existing optional string field; `penWidth` already exists and validates
1 to 100. Older readers show a whiteboard as an ordinary tab with the same elements.

## Errors and edge cases

- A whiteboard opened by a build without the kind: ordinary tab, elements intact (no fork).
- An unpainted stroke exported or opened on a diagram tab (paste): ordinary default colours.
- Pen armed while the tab becomes locked or read-only: commits refuse as today (`editsBlocked`).
- Tab switch mid-stroke: the gesture commits to the tab it started on via the functional commit, as today.
- Partial erase that removes everything: the element is removed. A 1-point remnant is dropped.
- Rotated stroke under Partial: rotation baked into the pieces, which carry no rotation.
- Storage unavailable: prefs fall back to defaults (`readLocalStorageSafe`), nothing throws.
- Narrow viewport: the dock scrolls horizontally; flyouts clamp to the viewport.
- A pen stroke's pointer is cancelled by the browser: the stroke is discarded and logged.
- Another pointer's move or release during a stroke: ignored by the stroke.
- Zoom or pan mid-stroke (wheel): samples convert with the zoom and rect of their event, so ink stays
  under the pen; `LiveInk` moves and zooms with the canvas layer.
- A sample exactly repeating the previous one: dropped; nothing else is dropped.
- A tap (one sample): nothing is committed and the pen stays armed.
- A pen held still: no new samples; the stroke already ends where the pen is (`last: true`).
- A pen stroke stored before pressures and streamline: drawn at the middle pressure with no
  streamline (D11). A preset border width chosen later drops `penWidth`, `pressures` and
  `streamline` together: the stroke becomes a plain freehand.

## Security and trust

Nothing crosses a trust boundary that did not before: prefs are local, the tab fields ride existing
validated saves (`validate.ts` bounds `penWidth`). Colours written by a pen come from a fixed list.

## Performance and limits

- Ink projection: O(n) per render of the element array, allocation only for changed or unpainted
  objects on first sight (cache).
- Eraser: per pointer sample, O(strokes) bbox rejects plus O(points) for the survivors; Partial
  densifies only touched strokes. A 2,000-stroke board stays within a frame on the samples tried.
- Dock: 14 fixed-size buttons, no measurement, no layout effect.
- Live stroke, per input event: one rect read, one sample pushed, and the whole outline rebuilt
  (`freehandGeometry`, perfect-freehand, the path string): O(samples), as Excalidraw does. No React
  render of the stroke. Measured with synthetic moves: Chromium p50 0.2 / 0.8 / 2.2 ms per event at
  300 / 1 000 / 3 000 samples (p95 0.5 / 0.9 / 3.1); WebKit about 1 ms per 1 000 (1 ms timer). A 5 s
  stroke at 120 Hz stays under 1 ms.

## Presentation and UX

- Dock: bottom centre, `bottom-4` from 1500 px wide, lifted above the bottom-right cluster below it; buttons
  44 × 44 px; rounded panel with the editor's panel surface tokens; separators between groups
  (select | pens | eraser | sticky, text, shapes | recognition | undo, redo | more).
- Pen buttons: a filled nib in the pen's colour (the main pen shows the ink colour), a thickness bar below
  scaled to its width.
- Flyouts sit above their button, never move the dock; clamp to the viewport horizontally (12 px
  margin, measured from layout width before paint, since the pop-in starts at `scale(0)`), placed
  with the `translate` property because the pop-in animation owns `transform`.
- Dock buttons and flyout options carry the house `Tooltip` (their accessible name).
- Copy: toolbar label "Whiteboard tools"; buttons "Select", "Marker 1", "Marker 2", "Marker 3" (2 and 3 adding their colour, e.g. "Marker 2, blue, medium"; `PEN_NAMES`), "Eraser", "Sticky note", "Text", "Shapes", "Shape recognition",
  "Undo", "Redo", "More"; pen flyout "Colour" (second and third pens only), "Width" with "Fine", "Medium", "Bold"; eraser flyout
  "Stroke", "Partial" with hints "Remove whole strokes" / "Erase part of a stroke"; More flyout
  "Background" with "Plain", "Dots", "Grid"; Quick Start card "Whiteboard", "A plain board to draw on
  with pens, stickies and shapes."

## Accessibility

- `role="toolbar"`, `aria-label="Whiteboard tools"`, `aria-orientation="horizontal"`; roving
  tabindex: one tab stop, ArrowLeft / ArrowRight move (wrapping), Home / End jump.
- Tool buttons carry `aria-pressed`; a pen's name includes its place, colour (second and third pens) and width ("Marker 3, red, medium");
  flyout openers carry `aria-expanded` and `aria-controls`.
- A flyout is a `role="group"` labelled by its title; opening moves focus to its selected control;
  Escape closes it and returns focus to the opener.
- Contrast: ink on board >= 4.5:1 per appearance, pen colours >= 3:1 on both boards (tests).
- Reduced motion: the dock and flyout animations use the app's `.reduce-motion` / media-query rule.

## Web Experience

- Zero layout shift: the dock is `position: absolute` over the canvas, fixed button sizes, flyouts
  absolutely positioned above it; nothing in the page flow changes when a tool or flyout toggles.
- INP: dock handlers set state only; erase work is per sample and bbox-filtered.
- LCP: no new asset on first paint; the dock renders with the canvas.

## Observability

- Telemetry per the spec's table (`Whiteboard` category); `Created` / `Import` is reserved for the
  Microsoft Whiteboard import and not yet emitted. The dashboard charts the four pairs in a
  Whiteboards stack headed by Whiteboards Created.
- Parse fallbacks log once: `console.warn('[whiteboard] prefs reset: <reason>')`.
- Discarded pinch strokes: `console.debug('[whiteboard] stroke discarded: pinch')`; cancelled ones:
  `[whiteboard] stroke discarded: cancel`. A pen put down mid-stroke: `[whiteboard] stroke discarded: pen put down`.
- Every committed pen stroke: `[whiteboard] stroke <pointer> samples=<n> pressure=<yes|no>`.

## Testing

| Rule                                                | Test                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Kind reads and stamps                               | `packages/document/src/tab-kind.test.ts`                                                 |
| Tokens meet contrast                                | `packages/document/src/whiteboard.test.ts`                                               |
| Ink projection table                                | `packages/document/src/whiteboard.test.ts`                                               |
| Stroke touch and partial split                      | `packages/document/src/whiteboard-stroke.test.ts`                                        |
| Pen ink: width at pressure, outline, centre line    | `packages/document/src/pen-stroke.test.ts`                                               |
| Pressures and streamline validated                  | `packages/document/src/validate.test.ts`                                                 |
| Export draws the pen outline                        | `packages/document/src/svg-render.test.ts`, `svg-render-shapes.test.ts`                  |
| Partial erase keeps pressures and streamline        | `packages/document/src/whiteboard-stroke.test.ts`                                        |
| Live stroke samples and pressures                   | `apps/live/lib/live-stroke.test.ts`                                                      |
| Pen gesture: pressure, pointer, cancel, commit      | `apps/live/components/canvas/useWhiteboardPenGesture.test.tsx`                           |
| Live ink laid out as it lands, recognition preview  | `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.test.tsx`                   |
| `penWidth` honoured on every stroke                 | `svg-render-shapes` test                                                                 |
| Template kind, overrides, builder                   | `packages/templates` tests                                                               |
| Prefs parse / defaults / pen colours contrast       | `apps/live/lib/whiteboard-prefs.test.ts`                                                 |
| Tool derivation, pen intent, pointer route, shapes  | `apps/live/lib/whiteboard-tool.test.ts`                                                  |
| Pen commit (open, colour, width, held, recognition) | `apps/live/hooks/canvas/commit-freehand.test.ts`                                         |
| Border width clears `penWidth`                      | `apps/live/lib/style-presets.test.ts`                                                    |
| Backdrop on a whiteboard                            | `apps/live/lib/default-scheme.test.ts`                                                   |
| Dock a11y, keyboard, flyouts                        | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`                         |
| Dock state, entering, telemetry                     | `apps/live/hooks/canvas/useWhiteboard.test.tsx`                                          |
| Ink projection cache                                | `apps/live/lib/whiteboard-ink.test.ts`                                                   |
| Eraser steps                                        | `apps/live/lib/whiteboard-erase.test.ts`                                                 |
| Pen versus touch on the canvas                      | `apps/live/hooks/canvas/useCanvasSurfaceGestures.whiteboard.test.tsx`                    |
| A pinch discards a whiteboard stroke                | `apps/live/components/canvas/useCanvasDrawGesture.whiteboard.test.tsx`                   |
| Line / arrow heads, no colour                       | `apps/live/lib/draw-commit.test.ts`                                                      |
| No theme step for a whiteboard                      | `apps/live/components/palette/template-picker-wizard.test.tsx`                           |
| Sticky and text open for typing                     | `apps/live/lib/draw-mode.test.ts`                                                        |
| Telemetry vocabulary and dashboard                  | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry/app/metric-emitters.test.ts` |
| End to end                                          | playwright-cli walkthrough, light / dark, desktop / narrow                               |

## Constants and configuration

| Constant                          | Value                            | Provenance      | Safe range      |
| --------------------------------- | -------------------------------- | --------------- | --------------- |
| `WHITEBOARD_BOARD.light / dark`   | `#fbfaf7` / `#0d121a`            | spec values     | contrast >= 4.5 |
| `WHITEBOARD_INK.light / dark`     | `#1c1917` / `#e2e8f0`            | spec values     | contrast >= 4.5 |
| `WHITEBOARD_PATTERN.light / dark` | `#d6d3cb` / `#1c2735`            | D5, spec (dark) | faint, visible  |
| `WHITEBOARD_PEN_WIDTHS`           | 1, 1.5, 2.5 px                   | spec            | 1 to 100        |
| `WHITEBOARD_ERASER_RADIUS_PX`     | stroke 10, partial 16            | D6              | 4 to 48         |
| Partial densify step              | `max(r / 2, 1)` canvas px        | D7              |                 |
| Crossing bisection steps          | 12                               | D7              | 8 to 20         |
| Recognition threshold             | 0.4                              | Shape Pen       |                 |
| Storage key                       | `livediagram:v2:whiteboard-pens` | spec            |                 |
| `PEN_STREAMLINE`                  | mouse 0.5, pen 0.2, touch 0.2    | Excalidraw      | 0 to 1          |
| `PEN_THINNING`                    | 0.6                              | Excalidraw      | 0 to 1          |
| `PEN_SMOOTHING`                   | 0.5                              | Excalidraw      | 0 to 1          |
| `PEN_MID_PRESSURE`                | 0.5                              | Pointer Events  | 0 to 1          |
| perfect-freehand `size`           | `width / (2 · sin(π/4))`         | calibration     | derived         |
| perfect-freehand `easing`         | `t => sin(t · π / 2)`            | Excalidraw      |                 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
