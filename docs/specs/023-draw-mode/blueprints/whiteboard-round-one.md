# Draw mode, round one: blueprint

Derived from [Draw mode](../draw-mode.md), with [Editor modes](../../007-editor/editor-modes.md) (and
its [blueprint](../../007-editor/blueprints/editor-modes.md)) for how Draw mode is entered, left and
stored, [Highlighter](../../008-canvas/highlighter.md) for the held-tool pattern,
[Eraser panel](../../008-canvas/eraser-panel.md) for the erase gesture and
[Two pens instead of a pen and a mode](../../008-canvas/two-pens.md) for recognition. The spec decides;
this file adds engineering precision. Defaults applied where the spec is silent are ledgered in
[DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                              | Role                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/document/src/editor-mode.ts`                            | `EditorMode`; Draw mode is `mode === 'draw'` (editor-modes blueprint)     |
| `packages/document/src/whiteboard.ts`                             | Tokens, backgrounds, `WHITEBOARD_INKED_SHAPES`, `nearestBorderStroke`     |
| `packages/document/src/whiteboard-stroke.ts`                      | Stroke geometry: `strokeTouchesBrush`, `eraseStrokePart`                  |
| `packages/document/src/pen-stroke.ts`                             | The pen's ink: perfect-freehand options, outline path, centre line        |
| `packages/document/src/factories.ts`                              | `freehandGeometry`: a freehand's box and points, shared with the live ink |
| `apps/live/lib/live-stroke.ts`                                    | `LiveStroke`: one stroke's raw samples, pressures and subscribers         |
| `apps/live/components/canvas/useWhiteboardPenGesture.ts`          | The whiteboard pen gesture: capture, pressure, commit                     |
| `apps/live/components/canvas/whiteboard/LiveInk.tsx`              | The stroke being drawn, laid out as it lands, written to the DOM          |
| `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.tsx` | Live ink and recognised shape, inside the canvas's transformed layer      |
| `apps/live/lib/recognition-flip.ts`                               | Alt or the chip flips the stroke being drawn between ink and a shape      |
| `apps/live/components/canvas/whiteboard/RecognitionChip.tsx`      | The Make shape / Keep drawing chip at a held-still pen or finger          |
| `packages/document/src/svg-render-shapes.ts`                      | `svgFreehandShape` honours `penWidth` on every stroke                     |
| `packages/api-schema` + `apps/api/src/openapi`                    | `TabKind` enum regenerated; `Whiteboard` telemetry category               |
| `packages/templates/src/templates.ts`                             | `'whiteboard'` template, descriptor, category, pattern, `opensIn`         |
| `packages/templates/src/build-template.ts`                        | Whiteboard builds no elements                                             |
| `packages/template-previews/src/template-preview-5.tsx`           | Whiteboard preview tile                                                   |
| `apps/live/lib/whiteboard-prefs.ts`                               | Pens, widths, colours, recognition, eraser mode; parse / load / save      |
| `apps/live/lib/whiteboard-tool.ts`                                | Active-tool derivation, pen intent, shapes, pointer routing               |
| `apps/live/lib/pen-seen.ts`                                       | Session-scoped "a pen has been used" flag                                 |
| `apps/live/lib/stock-colour-projector.ts`                         | `createStockColourProjector`: stock colours by name over a list, cached   |
| `apps/live/lib/whiteboard-erase.ts`                               | `strokesTouched`, `shapesTouched`, `partialEraseStep`: one eraser step    |
| `packages/document/src/shape-hit.ts`                              | A shape's hit outline: `shapeHitOutline`, `shapeTouchesBrush`             |
| `packages/document/src/svg-path-outline.ts`                       | `svgPathSubpaths`: M L C A Z paths sampled into subpaths                  |
| `apps/live/components/canvas/ShapeHitOutline.tsx`                 | `outlineHit`, the invisible outline that picks an unselected shape        |
| `apps/live/lib/draw-mode.ts`                                      | `PendingDraw` whiteboard pen variant and arrow `ends`; `isHeldPenIntent`  |
| `apps/live/lib/draw-commit.ts`                                    | `buildDrawnArrow` takes `ends` and `unpainted`                            |
| `apps/live/hooks/canvas/commit-freehand.ts`                       | The whiteboard pen commit                                                 |
| `apps/live/hooks/canvas/useCanvasEraser.ts`                       | Whiteboard Stroke and Partial erase                                       |
| `apps/live/hooks/canvas/useWhiteboard.ts`                         | The dock's state and actions                                              |
| `apps/live/components/canvas/whiteboard/*`                        | The dock (layout: whiteboard-dock.md), flyouts, icons                     |
| `apps/telemetry/app/*`                                            | `Whiteboard` colour, description, sentences and the Whiteboards stack     |
| `apps/live/components/canvas/boxed-element-overlays.tsx`          | `FreehandSvg` honours `penWidth` on every stroke                          |
| `apps/live/lib/style-presets.ts`                                  | A border width clears a stroke's `penWidth`                               |
| `apps/live/lib/view-backdrop.ts`                                  | `resolveViewBackdrop`: the person's Draw pattern in Draw mode             |
| `apps/live/components/canvas/EditorCanvasHost.tsx`                | Ink projection; whiteboard props                                          |
| `apps/live/components/canvas/CanvasChrome.tsx` and friends        | Hidden chrome; the dock's mount                                           |
| `apps/live/hooks/canvas/useCanvasSurfaceGestures.ts`              | Pen versus touch; the eraser frame                                        |
| `apps/live/components/canvas/useCanvasDrawGesture.ts`             | Hands a whiteboard pen press to `useWhiteboardPenGesture`                 |
| `apps/live/components/palette/TemplatePicker*.tsx`                | Whiteboard quick-pick; no theme step                                      |
| `apps/help/app/canvas/draw-mode/page.mdx`                         | Help article, registered in `packages/help-registry`                      |

## Domain and naming

| Term             | Identifier                                       | Meaning                                                       |
| ---------------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Whiteboard       | A tab in Draw mode, `editorMode.mode === 'draw'` | A tab worked on for freehand whiteboarding                    |
| Board            | `WHITEBOARD_BOARD[appearance]`                   | The Default theme's canvas colour (off-white, dark canvas)    |
| Ink              | `PEN_INK` / `WHITEBOARD_INK`, by name `'ink'`    | The drawing colour; unpainted strokes and text draw in it     |
| Background       | `WhiteboardBackground` (`plain/dots/grid`)       | The person's Draw pattern, the synced `drawPattern`           |
| Pen              | `WhiteboardPen`                                  | Main, second or third: id, colour (`null` = ink), width in px |
| Pen width        | `WHITEBOARD_PEN_WIDTHS` (`fine/medium/bold`)     | 1, 1.5, 2.5 px, recorded as `penWidth`; stored by name        |
| Pen intent       | `PendingDraw` freehand `variant: 'whiteboard'`   | The held pen, with its colour, width and recognition          |
| Dock             | `WhiteboardDock`                                 | Top- or bottom-centre tool groups (whiteboard-dock.md)        |
| Dock tool        | `WhiteboardTool`                                 | `select/pen/eraser/sticky/text/shape`                         |
| Flyout           | `WhiteboardFlyout`                               | A dock button's settings, opened on the dock's board side     |
| Eraser mode      | `WhiteboardEraserMode` (`stroke/partial`)        | Whole-stroke or part-of-stroke erase                          |
| Pen seen         | `markPenSeen()`, `penSeen()`                     | A `pen` pointer has been used in this page session            |
| Whiteboard prefs | `WhiteboardPrefs`                                | Pens, active pen, recognition, eraser mode; device-local      |
| Live stroke      | `LiveStroke`                                     | The stroke being drawn: raw samples, pressures, subscribers   |
| Pointer kind     | `PenPointerKind` (`pen/mouse/touch`)             | Which `PEN_STREAMLINE` a stroke uses; a pen records pressure  |
| Pen ink          | `PenStroke`                                      | Points, pressures, width, streamline: perfect-freehand input  |
| Centre line      | `penStrokeCentreline(stroke)`                    | The streamlined points the outline is drawn around            |

Banned synonyms: "canvas kind" for tab kind, "marker" for a whiteboard pen (the highlighter is the
marker), "rubber", "eraser size" on a whiteboard, "theme" for the whiteboard look.

## Behaviour and state

### Mode

- Draw mode is the person's effective editor mode on a general tab
  ([editor-modes blueprint](../../007-editor/blueprints/editor-modes.md)): `useEditorState` derives
  `drawMode = editorMode.mode === 'draw'` and hands it to every gate below. A tab stored with
  `kind: 'whiteboard'` is migrated on read to a general tab that opens in Draw.

### Creation

- `templateCanvasOverrides('whiteboard')` returns `{ opensIn: 'draw', backgroundPattern: WHITEBOARD_DEFAULT_PATTERN }`
  (`'graph'`, Grid, the tab's Diagram pattern): every creation path (the /new wizard, Quick Start on a
  tab, the MCP worker) goes through it.
  `buildTemplate('whiteboard', …)` returns `[]`. Category: `design` (nominal, like Blank: the picker
  shows it only as a quick-pick) (D1).
- Quick Start overview: `Blank`, then `Whiteboard`, then the category cards.
- `onTemplateCommit('whiteboard')`: welcome wizard sets `themeId = 'brand'` and goes to the settings
  step; the in-editor templates flow calls `onPick('whiteboard', name, 'brand', …)` at once.
- `chooseTemplate` tracks `Draw / Created / NewTab` when `kind === 'whiteboard'` in the
  `templates` mode and releases the tab's pinned opening mode, so its maker enters Draw; the /new
  route tracks `Draw / Created / Template`.

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
    (`opensForTyping(intent, whiteboard)` in `draw-mode.ts`). A text box hugs its text:
    [text-boxes](text-boxes.md).
  - **Shapes**: toggle the shapes flyout; picking a shape arms its intent (one-shot) and closes it.
    The pinned and frequent slots and the Shapes search are [whiteboard-dock](whiteboard-dock.md)'s.
  - **Recognition**: flip `recognise`, re-arm the pen intent when a pen is held, track
    `RecognitionOn` / `RecognitionOff`.
  - **Undo / Redo**: the History group's `onUndo` / `onRedo`, unavailable by `canUndo` / `canRedo`.
  - **Settings**: toggle the Settings flyout (a press only); picking a background writes the person's
    synced `drawPattern` preference (never the tab) and tracks `Background<Name>`.
- Changing a pen's colour or width updates `pens[p]`, re-arms the intent when `p` is held, and tracks
  `Whiteboard / Changed / PenColour` or `PenWidth` (a pen is reported by its place, never its colour).
- **Entering Draw mode** (a new active tab in Draw mode, or a switch into it; editable, no Draw
  intent armed, tool `select` or `pan`) arms the active pen when the tab has no elements, and leaves
  `select` in hand when it has any (D2). The hook keys this on the pair of tab id and `drawMode`.
  On a switch a palette-armed intent is cancelled and a held eraser is put down.
- **Leaving Draw mode** cancels a Draw-only intent (pen, Path tool, dock shape) and, on a switch,
  puts a held eraser down.
- Only one flyout is open at a time; it closes on Escape (focus returns to its dock button), on an
  outside press, on a tool change and on a tab switch.

### Pen commit (`makeCommitFreehand`, `variant: 'whiteboard'`)

1. The points arrive as the live stroke's raw samples, with its `ink` (`pressures` for a pen,
   `streamline`; see [Pen ink](#pen-ink)), and are used as they are: never simplified. Fewer than 2
   points: keep the pen armed, commit nothing.
2. `recognise` and `recogniseBoardStroke({ points, pressures, width, streamline })` (its centre
   line, confidence >= 0.4):
   - `line` → arrow, `arrowEnds: 'none'`, the pen's colour (Ink by name for the main pen),
     `strokeWidth` = `nearestBorderStroke(width)`.
   - a shape kind → shape at the bbox, `fillColor: 'transparent'`, the pen's colour (Ink by name for the main pen) when
     set, `strokeWidth` = `nearestBorderStroke(width)`; track as the Shape Pen does.
3. Otherwise a freehand element: `createFreehand(points, false, pressures)` (raw samples, packed with
   the pressures when a pen drew it, docs/specs/006-document/stroke-points.md), `penWidth: width`, `streamline`, `strokeColor` = pen colour when set (the main pen
   records none). Track `Element / Added / Freehand`.
4. The pen stays armed; nothing is selected.

`nearestBorderStroke(px)`: the `BorderStroke` whose `BORDER_STROKE_PX` is nearest, ties to the
thicker (2 → `medium`, 4 → `thick`, 8 → `extra-thick`).

### Ink by name

There is no display projection: what Draw mode makes is written with its colours, so it looks the
same in Diagram mode and to every collaborator ([One look](../../007-editor/editor-modes.md#one-look)).

- `boardShape(el)` (`apps/live/lib/whiteboard-tool.ts`): a shape gets `penColour: 'ink'`,
  `penTextColour: 'ink'` and `fillColor: 'transparent'`; a path `penColour: 'ink'` and no fill; an
  arrow or line `penColour: 'ink'`. Applied by `useShapeDrawing` and the drawn-arrow builder in Draw
  mode, before `styleNewElement`.
- A pen stroke and a text box with no colour of their own draw in Ink in both modes; nothing is
  written for them.
- Every colour stored by name is drawn in its version for the canvas surface
  (`resolveStockColours(el, surface)`, `packages/document/src/stock-colours.ts`), through
  `createStockColourProjector` (`apps/live/lib/stock-colour-projector.ts`, a per-object cache, so an
  unchanged element keeps its identity) on the canvas, and in every export, thumbnail and image.

### Eraser in Draw mode

- Brush radius in screen px: `WHITEBOARD_ERASER_RADIUS_PX = { stroke: 10, partial: 16 }`; canvas
  radius = screen radius / zoom. The eraser ring shows it.
- The gesture carries a canvas frame captured on press: `{ left, top, zoom }` of the transformed
  wrapper, so a client point maps with `pointerToCanvas`.
- Each pointer sample erases along the segment from the previous sample to this one (a capsule), so a
  fast swipe cannot skip a stroke.
- **Stroke**: a `freehand` is touched when `strokeTouchesBrush(el, a, b, r)`; a `shape` when
  `shapeTouchesBrush(el, a, b, r)` (`shapesTouched`, see [Selecting](#selecting-on-a-whiteboard)), so
  a brush through an empty inside erases nothing; any other element (note, text, arrow by its hit band) when
  the DOM hit test (centre plus rings, as the Eraser panel's `eraserSamplePoints`) finds it. Touched
  elements are removed whole, arrows pinned to them cascade, as today.
- **Partial**: only `freehand` elements; each touched one is replaced by `eraseStrokePart(...)`
  inside the functional `tick`, so consecutive samples compose on the live list.
- Both: one `markCheckpoint` on the first change, one activity entry on release, locked elements and
  inert layers skipped.

### Stroke geometry (`whiteboard-stroke.ts`)

- `freehandAbsolutePoints(el)`: the decoded points (`freehandCanvasPoints`), `x + nx * width`,
  `y + ny * height`, rotated about the centre by
  `rotation` degrees clockwise when set.
- Ink half-width: a pen stroke's `penPressureWidth(penWidth, max(pressures))` over its decoded
  pressures (the middle pressure without them), else `BORDER_STROKE_PX[strokeWidth ?? DEFAULT_BORDER_STROKE]` (highlighter:
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
  6. Each run → `createFreehand(points, false, pressures?)` (a fresh packed block) with a fresh id, carrying `strokeColor`,
     `strokeWidth`, `strokeStyle`, `penWidth`, `pen`, `streamline`, `layerId`, `opacity`,
     `fillColor`, `locked` false, and its own interpolated pressures when the stroke had them. The longest run also carries `label`, `link`, `note`, `commentThread` and `action` (D3).

### Pen versus touch

- `whiteboardPointerRoute({ pointerType, penSeen, inking })` → `'ink' | 'pan'`: `'pan'` only for
  `pointerType === 'touch' && penSeen && inking`; else `'ink'`. `inking` is true for a held pen or the
  eraser (D4).
- Any `pointerdown` with `pointerType === 'pen'` on a whiteboard calls `markPenSeen()`. The flag is a
  module variable: it resets on reload.
- A `'pan'` route starts the ordinary canvas pan and stops the press there.
- A whiteboard stroke during which `isPinchingRef` became true is discarded on release.

### Hidden chrome

Gated on `drawMode` (the `editorMode` prop on `Canvas`, `useWhiteboard().whiteboard`):

- `panelEls.palette`, `ToolbarPalette`, `QuickStylePanel`, the Theme & canvas brush,
  `ThemeModeBanner`, `EmptyCanvasBanner`, the tool panels (`eraser`, `highlighter`, `format`): not
  rendered.
- The Explorer menu button leaves the strip for its corner on a phone (`menuInStrip` false).
- The draw-mode banner does not show for a held pen (`isHeldPenIntent`).
- The dock renders when `whiteboard && !readOnly && !chromeHidden`.

### Quick style panel on a whiteboard

- `EditorView` no longer hides `QuickStylePanel` on a whiteboard.
- `useQuickStyle` on a whiteboard maps its view through `onWhiteboard(view, selected, ink)`
  (`apps/live/lib/quick-style-whiteboard.ts`): slot 0 of stroke and text shows the board ink, slot 0
  of background shows `transparent`, and an unfilled shape reads as background slot 0. Edits and
  Clear styles skip `memory.recordEdit` / `memory.forget`.
- Marker rows (`apps/live/lib/quick-style-pen.ts`, `QuickPenRows.tsx`), titled **Marker colour** and
  **Marker width**, quick choices only (no picker in the panel): `view.pen` is
  `strokesPenStyle(selected, palette)` (pen strokes: `freehand` with `penWidth`, not a highlight,
  unlocked; captioned "Marker stroke" / "N marker strokes"), else `heldPenStyle(pen, palette)` when
  nothing is selected and `whiteboardDock.tool === 'pen'`. `PenPalette = { board, ink, custom }`:
  the viewer's appearance, its ink and `tabCustomColours(activeTab.elements)`.
  - Marker colour: Ink, then `PEN_COLOUR_NAMES` (Blue, Red, Orange, Green, Teal, Violet, Pink),
    each swatch `penColourCss(colour, board, ink)`, for the strokes and for Marker 2 or 3 in hand;
    Marker 1: Ink alone, so every pen has both rows.
  - **Custom colours** (`testId` `quick-style-marker-custom`), only when `custom` is not empty:
    `tabCustomColours` walks the tab's elements from the last (the most recently drawn) and takes
    the `#rrggbb` `strokeColor` of pen strokes, shapes and lines, lower-cased and deduplicated, at most
    `TAB_CUSTOM_COLOURS_MAX` (8). No Remove there: it reflects the tab.
  - Both colour rows are `QuickRadioRow` with `columns = QUICK_ROW_TARGETS.pen` (8): a grid of
    24 px columns, touching in compact and `space-between` in Floating, so a shorter row lines up
    under the full one.
  - A stroke's value is `strokeColor` (lower case) ?? `penColour` ?? Ink; `applyPenStyle` sets Ink by
    clearing both, a name as `penColour` (clearing `strokeColor`), a hex as `strokeColor` (clearing
    `penColour`). For the held pen Ink is `colour: null`.
    `setPenColour` / `setPenWidth` commit `applyPenStyle` over the strokes (`Element·Changed·QuickStroke`
    / `QuickStrokeWidth`) and `remember` the colour (a custom one moves to the front of Your colours),
    or call `updatePen` for the held pen (its own `Draw·Changed` tokens; `updatePen`
    remembers). Clear styles shows only when `targetIds` is non-empty. `QuickPenRows`
    shows `subject.name` as a caption unless `QuickStylePanel` has `powerUser` (from `isPowerUserMode`).
    Choosing the held pen's current value is a no-op.

### Marker colours

Spec: draw-mode.md "The colour picker". Pure data in `packages/document/src/pen-colours.ts` (a leaf
module: no value imports).

- Stock colours: Ink (`null`, `WHITEBOARD_INK`), then `PEN_COLOURS`, seven `{ id, label, hue,
chroma }` in OKLCH: blue (255, 0.18), red (25, 0.19), orange (50, 0.17), green (145, 0.16), teal
  (190, 0.12), violet (295, 0.19), pink (350, 0.18). `PenColourName` is the id; `PEN_COLOUR_NAMES`
  in that order.
- A version per board (`PEN_BOARDS` = `WHITEBOARD_BOARD`): lightness walks in from the board's far
  end (light: L = 0.05 + i · 0.0045; dark: L = 0.98 − i · 0.0045; i = 0..200) at the colour's chroma,
  reduced by 0.005 until inside sRGB, keeping the last colour at least `PEN_STOCK_CONTRAST` (6:1)
  on the board, so each is over the spec's 4.5:1 and the light board's version is darker than the
  dark board's. Built once at module load into a table; `penColourHex(name, board)` reads it.
- `penColourLabel` "Blue"; `isPenColourName`; `isCustomPenColour` (`#rrggbb`);
  `penColourCss(colour | null, board, ink)` (null is the ink, a name its version, a hex itself);
  `penContrast(hex, board)`; `penColourHardToSee(hex)` (the boards under `PEN_MIN_CONTRAST` = 3);
  `readablePenColour(hex)`: the same OKLCH hue and chroma at the nearest lightness (steps of 0.0025
  either way) at least 3:1 on both boards.
- Elements: `penColour?: PenColourName` on freehand, shape and arrow (a recognised shape or line keeps
  its pen's). Validated for every element type (`isPenColourName`), in the wire schema
  (`PenColourName` enum, `'ink'` included). `resolveStockColours(el, surface)` fills `strokeColor`
  (and `textColor` from `penTextColour`) with the name's version for the canvas surface when unset;
  the canvas projector (`createStockColourProjector`) and every export, thumbnail and image use it.
  An explicit `strokeColor` always wins. Partial erase pieces keep `penColour`.
- Commit (`commit-freehand.ts`): the pen's colour null (Ink) → nothing; a name → `penColour`; a hex
  → `strokeColor`.
- Marker prefs: `WhiteboardPen.colour: PenColour | null`. Defaults Ink, `blue`, `red`. Parsing
  keeps the ink (`null`, for any pen), a name or a hex (lower-cased); the seven old fixed hexes
  (`LEGACY_PEN_COLOURS`) read as their names; anything else or a missing colour, the pen's default;
  the main pen is always the ink. Existing strokes are untouched.
- Labels: `colourLabel` "Ink", "Blue", "Custom #ff6b00"; the pen button "Marker 2, blue, medium".
- Resolved colour everywhere the pen shows: the dock glyph (`DrawingToolsGroup`), the cursor
  (`useWhiteboardPenCursor`, the Settings cursor previews), the live ink and recognition preview
  (`WhiteboardPenPreview`), each through `penColourCss(colour, appearance, ink)`; the draw-intent
  default cursor uses the light version.
- Your colours (`apps/live/lib/pen-colour-memory.ts`, `usePenColourMemory`): user preferences
  `whiteboardYourColours`, custom hexes, at most `YOUR_COLOURS_MAX` (8), newest first, deduplicated,
  parsed on read. `rememberPenColour`: a custom hex → the front; Ink or a stock colour → unchanged.
  `forgetPenColour`: removes one (logged `[whiteboard] custom colour removed from Your colours`).
  Written off the freshest stored preferences, only when changed. `updatePen` remembers every colour
  change; the quick style panel remembers a stroke restyle.
- `ColourPicker` (`components/canvas/whiteboard/ColourPicker.tsx`), in the flyout of Markers 2 and 3
  above the Width row, 248 px wide (eight of Your colours and +): "Colours", the eight stock colours
  as 24 px buttons with 20 px chips, `aria-label` the colour's label, `aria-pressed` the colour in
  force (Ink for `null`); "Your colours", a button per custom hex ("Custom #ff6b00") and "Add a
  custom colour" (+), which toggles `CustomColourEditor` in place. `useSwatchRowKeys(count)`: roving
  tabindex per row (the colour in force, else the first); Left and Right (held at the ends), Home and
  End; focus moves, Enter or Space picks.
- Removing one of Your colours: right-click, a touch long-press (`useLongPress`), Shift+F10 or the
  context-menu key on its swatch opens `PortalMenu` below it with one `MenuActionRow` **Remove**
  (focused on open; Escape closes it back to the swatch). Its content is marked `data-flyout-child`,
  which `WhiteboardFlyout` counts as its own for outside presses. Remove calls
  `colourMemory.forget(hex)`; once Your colours no longer hold it, the focus goes to the swatch at its
  place, or + when it was the last. A marker set to it keeps it until changed.
- `CustomColourEditor`: a saturation and brightness square (`role="slider"`, pointer drag with
  capture, arrows 1%, Shift 10%, `aria-valuetext` "Saturation n%, brightness n%"), a hue range
  (0 to 359), a preview chip, a "Hex" field (valid `#rgb`/`#rrggbb` updates the square; Enter uses
  it), the eyedropper (`useEyeDropper`, only where supported) and **Use**. Opens on the custom colour
  in force, else `#3b82f6`. Below them, always, a 24 px warning line (`role="status"`,
  `text-amber-800` / `dark:text-amber-300`, at least 4.5:1 on the flyout), empty until
  `penColourHardToSee(hex)` is not: the warning icon, "Hard to see on the {light|dark} board." and a
  swatch "Use {readable}, readable on both boards" that applies it. `lib/hsv.ts`: `hsvToHex`,
  `hexToHsv`.
- Telemetry: `Draw·Changed·PenColour` on every marker colour change, never the colour.

### Shapes flyout hover, Settings flyout

- The Shapes button opens its flyout on `pointerenter` (not touch) as a hover flyout; leaving the
  button or the flyout schedules a close after `HOVER_CLOSE_MS` (250 ms, `useHoverClose`), cancelled
  by entering either. A press on a hover flyout makes it sticky. Its search field takes the focus
  even on a hover, the one exception ([whiteboard-dock](whiteboard-dock.md) "Flyouts").
- The Settings flyout (`hideTitle`, accessible name "Settings", opened by the cog on a press only)
  holds three headed sections, top to bottom: Background (Plain / Dots / Grid), Cursor (Crosshair
  - nib first, the default, then Dot) and Drawing (Basic / Shape recognition, `setRecognition(on)`).
    The dock has no recognition button.

### Tool style and board memory

- `useStyleMemory({ documentId, theme, board })`: `board = drawMode` scopes every kind as
  `board:<kind>` (`styleKindOf(el, board)`, `recordStyleEdit(..., board)`, `applyStyleMemory(..., board)`;
  `parseStyleMemory` accepts the prefix). `useQuickStyle` records and forgets on whiteboards too.
- `useShapeDrawing`'s dress on a whiteboard is `styleNewElement(boardShape(el))`.
- `lib/quick-style-tool.ts`: `toolPhantom(intent, theme)` (shape: `boardShape(createShape)`; arrow:
  `buildDrawnArrow(..., { ends, unpainted: true })`; text: `createText`; else null) and `toolCaption`.
  `useQuickStyle({ toolIntent: pendingDraw })`: on a whiteboard with nothing selected, the view is
  `quickStyleView([styleNewElement(phantom)])` through `onWhiteboard`, with `caption`; a choice runs
  `memory.recordEdit([phantom], [applied])` and bumps a version; Clear styles forgets `board:<kind>`.
- The panel shows `view.caption ?? view.pen.subject.name` above the rows unless `powerUser`.
- `useStyleMemory` returns `scope` (`<documentId>:board` or `<documentId>:diagram`); `useQuickStyle`'s
  phantom memo keys on it, so a document or editor mode switch with a tool still in hand re-dresses the
  phantom from the memory in front of the user.
- Leaving a whiteboard (`useWhiteboard`'s tab effect, `whiteboard` false) runs `cancelDraw()` when
  `isWhiteboardOnlyIntent(pendingDraw)` (`draw-mode.ts`): a whiteboard pen, the Path tool, or a
  shape / arrow intent with `board: true`. A diagram palette intent carried onto a board stays in hand
  and lands in the board's ink and memory (`useShapeDrawing` decides by the tab, not the intent).
- Audited, no board flag read late: every `styleNewElement` call site (`useShapeDrawing`,
  `commit-freehand`'s diagram recognition, `useArrowConnect`, `useBoxedDragHandlers` quick-connect,
  `useEditorDrag` chained arrows, `useElementCreation`, `usePathCommits`, `onDressPath`) and every
  `recordEdit` (`rememberingCommit` / `rememberingTickTabs`, `useStylePreview.onCommitted`,
  `useQuickStyle`) read the render-fresh memory; paste, duplicate, the format painter and peers'
  edits (`applyRemoteTabs`) never dress or record; a whiteboard stroke, recognised or not, takes its
  pen only. Tests: `useStyleMemory.board-scope.test.tsx`, `useWhiteboard.board-tools.test.tsx`.

### Selecting on a whiteboard

- `BoxedElementView`: `lineHit` = a pen stroke (`penWidth`, not a highlight) neither selected nor
  multi-selected; the wrapper gets `pointer-events: none` and `FreehandSvg` a transparent
  `[data-stroke-hit]` path of `strokeHitWidth(penWidth, zoom)` (`STROKE_HIT_SCREEN_PX` = 6 a side) with
  `pointer-events: stroke`.
- `BoxedElementView`: `shapeHit` = `outlineHit(element, { onWhiteboard, selected })`, true for a
  `pickedByOutline` shape on a whiteboard (`useCanvasPicksByOutline`, the still-canvas context) neither
  selected nor multi-selected. The wrapper gets `pointer-events: none` and renders `ShapeHitOutline`:
  an svg over the element's own box (stepped out by the wrapper's CSS `borderWidth`), one
  `[data-shape-hit="line"]` path of `hitOutlinePathData(lines)` at `strokeHitWidth(2 · halfWidth, zoom)`
  with `pointer-events: stroke`, and one `[data-shape-hit="fill"]` path per fill region with
  `pointer-events: fill`. Rotation comes from the wrapper.
- `packages/document/src/shape-hit.ts`, pure, local unrotated px:
  - `pickedByOutline(el)`: a `shape` whose kind is CSS-drawn (`square`, `circle`, `stadium`,
    `browser`, `page`) or in `SHAPE_GEOMETRY_KINDS`. Every other kind paints its own face and keeps
    its box, as notes, text boxes and images do.
  - `hasVisibleFill(el)`: `fillColor ?? defaultFillColor(el)` is not `transparent`, `none` or empty.
  - `shapeHitOutline(el)` (cached per element object): `{ lines, fills, halfWidth }`, `halfWidth` =
    `BORDER_STROKE_PX[strokeWidth] / 2`. Drawn kinds: every part of `shapeGeometry(kind, w / h)` placed
    by `boxFit` into `0 0 w h` (paths via `svgPathSubpaths`, rects with `rx`, ellipses and circles at
    `2 · PATH_ARC_SEGMENTS` points); fills are the closed lines of `main`, `outline` and `head` parts.
    CSS kinds: the border's centre line, inset `halfWidth`, radius `min(r, w / 2, h / 2) - halfWidth`
    (`r` = `BORDER_RADIUS_PX[borderRadius]`, default 8; stadium half the short side; circle an
    ellipse); the browser adds its chrome rule at `2 · halfWidth + BROWSER_CHROME.heightPx - 0.5`.
    Any other kind: its box, filled.
  - `shapeTouchesBrush(el, a, b, r)`: `a`, `b` unrotated about the centre into local px; true when a
    line lies within `r + halfWidth` of the segment, or `a` or `b` lies in a fill region. Skipped
    early beyond `OUTLINE_REACH_FACTOR` half diagonals of the centre.
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
  (`Draw·Changed·CursorDot | CursorCrosshair`), the Settings flyout's Cursor row, and
  `useWhiteboardPenCursor(pendingDraw, variant, zoom)` (strokePx = pen width x zoom) feeding the Canvas cursor style.

### Recognition preview

- Locking: when the dwell fires on a recognised shape, `LiveStroke.snapTo(shape)` records it with
  the pen's position (`grab`); `shaped()` is `adjustRecognised(shape, grab, lastSample)` (lib/recognition-preview:
  a line moves its end nearer `grab`, a box moves its corner nearer `grab` and keeps the opposite,
  flipping past it). `useRecognitionPreview` shows `shaped()` on every update once locked (the lock
  itself included), and the commit passes it as `ink.snapped`, which `whiteboardStroke` lands
  instead of re-reading the stroke.
- Shift: `adjustRecognised(shape, grab, pointer, ratio)`. With `ratio` (width over height) set, a
  box's moving corner, relative to the fixed corner, follows `|dx|` when `|dx| >= |dy| * ratio`
  (height `|dx| / ratio`) and `|dy|` otherwise (width `|dy| * ratio`), on the side it is on (the
  box's own side when lined up on that axis), even where the pen has not moved; a line's moving end
  goes to the nearest point on the nearest 45 degree ray from its fixed end (whole-step direction
  vectors, so axis snaps are exact). Without it, a pen that has not moved changes nothing.
- `shiftRatio(shape)`: for `kind === 'square'` (a rectangle) the nearest of `SHIFT_RECTANGLE_RATIOS`
  (`[1, 5 / 3, 3 / 5]`) by `|log(width / height) - log(ratio)|`, 1:1 winning a tie (the 1:1 / 5:3
  split sits at their geometric mean, about 1.29); zero height reads 5:3, zero width 3:5, both 1:1.
  Every other kind is 1.
- `LiveStroke.constrain(on)` returns whether Shift changed. Turning it on measures
  `shiftRatio` of the shape as shown (the free `adjustRecognised` at the last sample); `snapTo`
  with Shift already on measures the recognised shape; turning it off clears the ratio, and
  pressing again measures afresh. `shaped()` passes that ratio. `useWhiteboardPenGesture` seeds
  the flag from the press's `shiftKey` and sets it from every `pointermove`'s `shiftKey` before
  pushing the sample, notifying when either the sample or the flag changed; `pointerup` leaves it,
  so what lands is what the last move showed.

- `apps/live/lib/recognition-preview.ts`: `RECOGNITION_THRESHOLD` (0.4), `RECOGNITION_PREVIEW_DWELL_MS`
  (500), `RECOGNITION_PREVIEW_STILL_PX` (4 screen px), `recogniseBoardStroke(points)`,
  `stillSince(sample, from, count, anchor, zoom)` (samples `from` to `count - 1` by accessor).
  `commit-freehand`'s `whiteboardStroke` uses `recogniseBoardStroke`.
- `useRecognitionPreview(stroke, active, zoom, penWidth)` subscribes to the `LiveStroke` whatever
  `active` is, and returns `{ shape, chip }`: `shape` is `stroke.shaped()` on every update, so a
  lock or a break from anywhere (the dwell, Alt, the chip) shows at once. On each update it walks
  only the raw samples added since the last update; any sample farther than
  `RECOGNITION_PREVIEW_STILL_PX / zoom` from the anchor moves the anchor to the newest sample,
  drops the chip and restarts the dwell timer. The first update sets the anchor and starts the
  timer. The timer runs only when `active` or the stroke's pointer is `pen` or `touch`, and not for
  a locked mouse stroke. On firing, an unlocked stroke's `stroke.ink(penWidth)` (the centre line
  of the stroke release would land) is recognised once; with `active` and not `inkHeld()` a found
  shape locks (`snapTo`, `[whiteboard] recognition preview <kind>`). Then, for a `pen` or `touch`
  stroke, the chip is `keep` when locked, `make` when the reading found a shape, otherwise none
  (`[whiteboard] recognition chip <action>`); its `at` is the anchor. An update within the still
  radius while the chip shows turns it round after a flip: `make` on a locked stroke becomes
  `keep`; `keep` on an unlocked one becomes `make` if the ink reads as a shape, else none (D24).
  A new stroke or `stroke === null` clears everything.

### Alt and the chip (recognition for one stroke)

- `LiveStroke.unsnap()` drops the lock and the Shift ratio and sets `keepsInk()`, returning false
  when nothing was locked; `snapTo` clears `keepsInk()`. The samples never change, so the ink is
  exactly as drawn so far, reshaping drag included. `holdInk(on)` / `inkHeld()` carry Alt held.
- `flipRecognition(stroke, penWidth)`: `unsnap()` true gives `broken`; otherwise
  `recogniseBoardStroke(stroke.ink(penWidth))` locks a found shape with `snapTo` (grabbed at the
  last sample, as the dwell does) and gives `recognised`, or null (the stroke stays ink). It reads
  neither `recognise` nor `inkHeld()`: Alt with recognition on and no shape shown recognises at
  once too (D22). `flipStrokeRecognition(stroke, penWidth, via)` logs
  `[whiteboard] recognition flip by <via>: <recognised|broken|no shape>`, and on a flip tracks
  `Whiteboard` / `Toggled` / `RecogniseOnceKey` | `RecogniseOnceChip` | `BreakShapeKey` |
  `BreakShapeChip` and calls `notify()`.
- `useWhiteboardPenGesture`, while `penStroke` is set, listens on `window`: `keydown` with
  `key === 'Alt'` calls `preventDefault()` and marks the next Alt `keyup` to be swallowed; unless
  it is a repeat or the stroke is pinched it calls `holdInk(true)` and
  `flipStrokeRecognition(stroke, pen width, 'key')`. `keyup` Alt calls `holdInk(false)`, and so
  does `blur`. A `keyup` listener mounted for the hook's life calls `preventDefault()` on the Alt
  release that was marked, even after the lift, and clears the mark (D27). Other keys are ignored.
- The dwell never locks while `inkHeld()`, and after a break it waits for the pen to move beyond
  the still radius before it runs again (D23), so a chip tap is not undone half a second later.
- `WhiteboardPenPreview` renders `RecognitionChip` while `chip` is set, its `onFlip` calling
  `flipStrokeRecognition(stroke, pen.width, 'chip')`. `RecognitionChip` is a zero-size anchor at
  `translate(at.x px, at.y px) scale(1 / zoom)` (origin top left, `z-10`) holding a `button`
  whose bottom-right corner sits `RECOGNITION_CHIP_GAP_PX` (12) screen px above and before the
  tip (D25). The button carries `data-floating-panel`, so `onPointerDownCapture` on the canvas
  surface returns before the pen-seen pan, the path, spotlight, avatar and draw intercepts; its
  `pointerdown` calls `preventDefault()`, `stopPropagation()` and `onFlip()` (D26); a native
  `touchstart` listener stops propagation, so `useCanvasPinchZoom`'s document `touchstart` never
  sees a second touch and never sets `isPinchingRef`. The stroke's own listeners ignore the tap's
  other `pointerId`.
- Commit: `whiteboardStroke` lands `ink.snapped` when present; otherwise it recognises only when
  `pen.recognise && !ink.keepInk`; `snapped` and `keepInk` are stripped from the element.
- `WhiteboardPenPreview` renders `RecognisedShapePreview` (`components/canvas/whiteboard/BoardShapePreview.tsx`,
  beside `PenShapePreview`) while a shape is returned, and hides (never unmounts) `LiveInk`, whose
  sealed chunks live only in the DOM. `RecognisedShapePreview` draws in canvas px inside the
  transformed layer: a shape as an absolute box at its bbox (at least 16 px) with the nearest border
  width, a line as an overflowing svg at the pen's width.

### Shapes are plain ink

- A pen is a separate tool: pens do not set the colour of other tools. `whiteboardShapeIntent(id)`
  arms the flyout's intent with `board: true` (`PendingDraw` shape and arrow intents).
- `useShapeDrawing.commitDraw` on a whiteboard applies `boardShape(el)`: Ink by name and no fill
  ([Ink by name](#ink-by-name)), at the default width, then the tool's remembered Draw style.
- `CanvasDrawPreview` previews a board shape in the ink, solid and unfilled at the default border
  width (`PenShapePreview`). It draws no line or arrow, on any tab kind.
- A line or an arrow previews as the element it lands. `buildDressedDrawnArrow` (`lib/draw-commit.ts`)
  builds it for both `useShapeDrawing.commitDraw` and the preview, from the intent, the drag's two
  points, the board (`elements`, `theme`, `whiteboard`) and `styleNewElement`: `buildDrawnArrow`
  (unpainted in Draw mode), then `boardShape` in Draw mode, then `styleNewElement`.
- `drawnArrowAsShown` (`lib/drawn-arrow-preview.ts`) adds what the canvas does to a landed element:
  `resolveStockColours(arrow, surface)` (its Ink and stock colours for the canvas), and the constant id
  `DRAWN_ARROW_PREVIEW_ID` so its markers and pass-behind mask keep their ids through the drag.
  `EditorCanvasHost` hands it to `Canvas` as `previewDrawnArrow`, over the raw tab, its theme, the
  style memory and the canvas surface.
- `CanvasElementsLayer` renders `DrawnArrowPreview` while `drawDrag` is set and the intent is an
  arrow: after every element and before the remote cursors (where the commit appends it), in canvas
  coordinates. It is `ArrowView` with `isSelected` (the arrow lands selected, so its stroke is the
  width plus 0.5 over the brand halo), `readOnly` (no grips), no label, the layer's `elementIndex`
  (an empty map on a board with no arrow), `drawnElements` as occluders, and the shared
  `ArrowDefs` of its own when `hasArrows` is false. `[&_*]:!pointer-events-none` keeps its hit band
  from taking the pointer or its cursor.
- Under 16 px of travel (`isDrawTap`) the builder returns the tap placeholder, so the preview shows the
  160 px arrow a release would drop there.
- Tests: `lib/draw-commit.test.ts` (`buildDressedDrawnArrow`), `lib/drawn-arrow-preview.test.ts`,
  `components/canvas/DrawnArrowPreview.test.tsx`, and `CanvasDrawPreview.test.tsx` (no stand-in).
- A recognised shape is a pen stroke tidied up and keeps that pen's colour and weight
  (`commit-freehand.ts`).

### Pen strokes: exact thickness, no guides

- `FreehandSvg` draws a pen stroke (`isPenStroke`: `penWidth` set, not a highlighter) as
  `penStrokeSvg(el)`: the filled outline `d = penStrokePath(freehandPenStroke(el, { x, y }))` in
  canvas coordinates, `fill` = the stroke colour, `stroke="none"`, in an svg of class
  `FREEHAND_SVG_CLASS` with `viewBox = "x y max(w,1) max(h,1)"` (the element's own box on the
  board): canvas px, scaled by the canvas zoom in every engine, and the outline's numbers never
  depend on where the box is. Other strokes keep the 100-unit viewBox, the Catmull-Rom path and
  `non-scaling-stroke`.
- `svgFreehandShape` (the export twin) writes the same outline from `freehandPenStroke(el, { x, y })`
  with numbers rounded by `r2`: `<path d="…" fill="colour" stroke="none"/>`.
- `LiveInk` draws the in-flight pen stroke inside the canvas's transformed wrapper (`Canvas.tsx`,
  after the element layer, via `WhiteboardPenPreview`) as exactly the committed `FreehandSvg`: each
  update takes `freehandGeometry(points)` (what `createFreehand` gives), writes a `div.absolute` at
  its box and sets the svg's viewBox and path from
  `penStrokeSvg({ ...geometry, penWidth, pressures, streamline })`. The same function and layout in
  the same layer; the landed stroke's packed points are within `STROKE_POINT_MAX_ERROR` of the box
  of the raw samples (docs/specs/006-document/stroke-points.md), the only difference release makes.
- **Settled ink stays still** (spec "Ink the smoothing has settled never moves while drawing"). The
  tip is the stretch of the centre line from the last streamlined point to the pointer, with its end
  cap; perfect-freehand joins each point's sides along the average of its own and the next
  direction and the path curves through the midpoints of the outline, so the outline's curve into
  the last streamlined point turns with the tip too (the tip in pixels runs from the streamlined
  point before it). Behind that nothing moves, by three guards:
  - `freehandGeometry` puts the box on whole canvas px (`x = floor(minX − 1)`,
    `y = floor(minY − 1)`, `width = ceil(maxX + 1) − x`, `height = ceil(maxY + 1) − y`). Layout
    snaps a positioned box and its svg to the pixel grid; a fractional box that moved or grew with
    every sample re-rasterised the whole path at a new sub-pixel offset (the whole stroke shook).
  - `penStrokeSvg` draws in canvas coordinates, so the float numbers the rasteriser gets for
    settled ink are the same whether the box moved or not.
  - `penStrokeOutline` cancels perfect-freehand's end trim (below).
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
   commit `onCommitFreehand(points, false, { pressures?, streamline, snapped? | keepInk? })`:
   `snapped` is `shaped()` when the stroke is locked, otherwise `keepInk: true` when
   `keepsInk()` (broken out of a shape), otherwise neither.
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
- `penStrokeOutline` = `getStrokeOutlinePoints(untrimmed(getStrokePoints(input, options)), options)`:
  perfect-freehand's `getStroke` with its end trim cancelled. perfect-freehand leaves out of the
  outline every point closer than `END_NOISE_THRESHOLD` (3 canvas px) to the end of the line, so a
  slow stroke's settled points dropped out and came back as the end moved; `untrimmed` adds
  `PERFECT_FREEHAND_END_NOISE` to the last point's `runningLength` (read only by that trim and by
  tapers, which the pen has none of), so no earlier point is ever trimmed.
- `penStrokePath(stroke, fmt)` =
  `M p0 Q p0 mid(p0,p1) p1 mid(p1,p2) … pn mid(pn,p0) L p0 Z` (Excalidraw's getSvgPathFromStroke);
  no points: `''`.
- `penStrokeCentreline` = `getStrokePoints(input, options)`'s points: what recognition reads.
- `freehandPenStroke(el, origin = {0, 0})`: the decoded points (or the live ink's unpacked geometry)
  as `origin + (nx · max(width, 1), ny · max(height, 1))`, the decoded pressures, `width = penWidth`,
  `streamline = el.streamline ?? 0` (D11).
- `penStrokeSvg(el)`: `{ viewBox: "x y max(w,1) max(h,1)", d: penStrokePath(freehandPenStroke(el, { x, y })) }`.

**Render** (`LiveInk`, inside the canvas's transformed layer): see "Pen strokes" above; the whole
outline is rebuilt per update, as Excalidraw does.

### Keyboard

- `EditorKeyboardShortcutsDeps.whiteboard` (`{ pickSelect, pickPen, pickEraser }`, null off a whiteboard);
  `useEditorState` passes the dock's actions.
- On a whiteboard the listener consults only `WHITEBOARD_VIEW_KEYS` (V select, H hand, Z zen) and,
  for editors, `WHITEBOARD_EDIT_KEYS` (1, 2, 3 pens; E eraser; N note; T text; R, O, D, C, L, A the dock
  shapes via `pickShape(key)`, plain ink; S the Shapes flyout, [whiteboard-dock](whiteboard-dock.md)),
  then stops: the diagram tab's
  `VIEW_TOOL_KEYS` / `EDIT_KEYS` never run there. Type-to-edit and modifier shortcuts run first,
  unchanged.
- Escape: the narrow Escape listener also arms for a whiteboard eraser and calls `pickSelect`; a
  pen, note, text or shape intent is `pendingDraw` and is cancelled as on any tab, which reads as
  Select. Only with Select in hand does Escape clear the selection.
- `WHITEBOARD_TOOL_KEYS` gives each dock button and Shapes option its key: shown bottom-right (slate-500 / dark
  slate-400, 4.5:1) and in `aria-keyshortcuts`.

### Still canvas

- `CanvasStillProvider` (`apps/live/components/canvas/CanvasStillContext.tsx`), provided by `Canvas` with
  `still = editorMode === 'draw'`; `useBoxedElementAnimation` drops `animate-element-pop-in` when
  still. Author-set looping animations are untouched.
- On entering a whiteboard with `highlighter` or `format` held, the hook sets `select`, and arms the
  pen when the tab has no elements; `buildEditorCommands` with `whiteboard: true` drops `tool:highlighter` and `tool:format`.

## Interfaces and contracts

```ts
// packages/document
export const WHITEBOARD_BOARD: Readonly<Record<Appearance, string>>;
export const WHITEBOARD_INK: Readonly<Record<Appearance, string>>;
export type WhiteboardBackground = 'plain' | 'dots' | 'grid';
export const WHITEBOARD_BACKGROUNDS: readonly {
  id: WhiteboardBackground;
  label: string;
  pattern: BackgroundPattern;
}[];
export function whiteboardBackgroundOf(
  pattern: BackgroundPattern | undefined,
): WhiteboardBackground;
export const WHITEBOARD_INKED_SHAPES: ReadonlySet<string>;
export function strokeTouchesBrush(el: FreehandElement, a: Point, b: Point, r: number): boolean;
export function eraseStrokePart(
  el: FreehandElement,
  a: Point,
  b: Point,
  r: number,
  mintId: () => string,
): FreehandElement[] | null;
export function nearestBorderStroke(px: number): BorderStroke;
// FreehandElement gains `streamline?: number` (0 to 1); its pressures (one per point, 0 to 1) ride in
// `packedPoints` (docs/specs/006-document/stroke-points.md).
export type FreehandGeometry = Pick<FreehandElement, 'x' | 'y' | 'width' | 'height'> & {
  points: NormalisedPoint[];
};
export function freehandGeometry(rawPoints: readonly Point[]): FreehandGeometry; // createFreehand's box, whole px
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
  pressures?: ArrayLike<number>;
  width: number;
  streamline: number;
};
export function penStrokeOutline(stroke: PenStroke): Point[];
export function penStrokePath(stroke: PenStroke, fmt?: (n: number) => number): string;
export function penStrokeCentreline(stroke: PenStroke): Point[];
export function isPenStroke(el: FreehandElement): boolean;
export type PenStrokeSource = Pick<
  FreehandElement,
  'width' | 'height' | 'penWidth' | 'streamline'
> &
  (
    | Pick<FreehandElement, 'packedPoints'>
    | { points: readonly NormalisedPoint[]; pressures?: readonly number[] }
  );
export function freehandPenStroke(el: PenStrokeSource, origin?: Point): PenStroke;
export function penStrokeSvg(el: PenStrokeSource & Pick<FreehandElement, 'x' | 'y'>): {
  viewBox: string;
  d: string;
};
export const PERFECT_FREEHAND_END_NOISE: number;

// apps/live
export type WhiteboardPenId = 'main' | 'second' | 'third';
export type WhiteboardPen = {
  id: WhiteboardPenId;
  colour: string | null;
  width: number;
};
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
  snapTo(shape: RecognisedShape): void; // locks; clears keepsInk
  unsnap(): boolean; // false when not locked
  keepsInk(): boolean; // broken out and not locked since
  holdInk(on: boolean): void; // Alt held: the dwell does not lock
  inkHeld(): boolean;
  constrain(on: boolean): boolean; // Shift; true when it changed
  shaped(): RecognisedShape | null;
};
export function createLiveStroke(
  pointerType: string | undefined,
  pointerId: number | undefined,
): LiveStroke;
export function recogniseBoardStroke(stroke: PenStroke): RecognisedShape | null; // on its centre line
export type RecognitionChipState = { action: 'make' | 'keep'; at: Point }; // at: canvas px
export function useRecognitionPreview(
  stroke: LiveStroke | null,
  active: boolean,
  zoom: number,
  penWidth: number,
): { shape: RecognisedShape | null; chip: RecognitionChipState | null };
export function flipRecognition(
  stroke: LiveStroke,
  penWidth: number,
): 'recognised' | 'broken' | null;
export function flipStrokeRecognition(
  stroke: LiveStroke,
  penWidth: number,
  via: 'key' | 'chip',
): 'recognised' | 'broken' | null; // + notify, telemetry, log
// CanvasProps.onCommitFreehand(points, recogniseShapes, ink?: PenInk)
// PenInk = Pick<FreehandElement, 'streamline'> & { pressures?: number[]; snapped?: RecognisedShape; keepInk?: true }
export const FREEHAND_SVG_CLASS: string; // the svg a freehand stroke, live or landed, draws in
```

`PendingDraw` gains `{ type: 'freehand'; variant: 'whiteboard'; colour: PenColour | null; width: number; recognise: boolean }`
and `{ type: 'arrow'; ends?: ArrowEnds }`.

Parsing rejects: a non-object or unparseable prefs value → defaults; a pen whose id is unknown →
dropped and refilled from defaults; a colour that is neither a `PenColourName` nor a `#rrggbb` (an old
fixed colour reads as its name), or any colour on the main pen → the pen's default colour (the ink
is a valid colour for any pen); a width that is not a preset NAME (`fine`, `medium`, `bold`; widths are stored
by name so the px can be retuned) → Medium; an unknown `activePenId` or
`eraserMode` → default; `recognise` not a boolean → `false`.

## Data and persistence

| Field                                | Where                                                                            | Class        | Travels  |
| ------------------------------------ | -------------------------------------------------------------------------------- | ------------ | -------- |
| `Tab.opensIn = 'draw'`               | tab body (editor-modes blueprint)                                                | document     | yes      |
| `drawPattern`                        | user preferences blob (the person's Draw pattern)                                | synced       | per user |
| `FreehandElement.penWidth`           | element                                                                          | document     | yes      |
| `FreehandElement.packedPoints`       | element (points and a pen's pressures, docs/specs/006-document/stroke-points.md) | document     | yes      |
| `FreehandElement.streamline`         | element (0 to 1)                                                                 | document     | yes      |
| `FreehandElement.strokeColor`        | element (a custom colour)                                                        | document     | yes      |
| `penColour` (freehand, shape, arrow) | element (a named colour)                                                         | document     | yes      |
| Your colours                         | user preferences blob                                                            | synced       | per user |
| `WhiteboardPrefs`                    | `localStorage` `livediagram:v2:whiteboard-pens`                                  | device-local | never    |
| pen seen                             | module memory                                                                    | session      | never    |

A tab stored with `kind: 'whiteboard'` is migrated on read (`migrateWhiteboardKind`, the editor-modes
blueprint). `penWidth` validates 1 to 100; `penColour` is optional, and strokes drawn before it keep
their `strokeColor`.

## Errors and edge cases

- A tab opened in Diagram mode: the same elements in the same colours (one look); Draw mode's
  tools and rules are simply not in focus.
- A stock colour stored by name, on any tab, in any export or server-side render: drawn in its
  version for the canvas surface it sits on.
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
- Alt on ink that reads as no shape: nothing changes, nothing is tracked; the next press tries
  again. Alt with no stroke live: untouched, the browser's. Alt held as the key repeats: one flip.
- Alt released after the lift: that release is still kept from the browser, once (D27).
- The window losing focus with Alt down: `holdInk(false)`, so the dwell is never stuck off.
- A chip tap while the stroke is pinched or lifted: the chip has already left with the stroke.
- A chip tap when the ink no longer reads as a shape (reshaped past it): the chip left when the
  offer turned round to none, so there is no dead button.
- A pen stroke stored before pressures and streamline: drawn at the middle pressure with no
  streamline (D11). A preset border width chosen later drops `penWidth`, the pressures (the points
  are re-packed without them) and `streamline` together: the stroke becomes a plain freehand.

## Security and trust

Nothing crosses a trust boundary that did not before: prefs are local, the tab fields ride existing
validated saves (`validate.ts` bounds `penWidth`). Colours written by a pen come from a fixed list.

## Performance and limits

- Ink projection: O(n) per render of the element array, allocation only for changed or unpainted
  objects on first sight (cache).
- Eraser: per pointer sample, O(strokes) bbox rejects plus O(points) for the survivors; Partial
  densifies only touched strokes. A 2,000-stroke board stays within a frame on the samples tried.
- Dock: fixed-size buttons in four groups; see [whiteboard-dock](whiteboard-dock.md).
- Live stroke, per input event: one rect read, one sample pushed, and the whole outline rebuilt
  (`freehandGeometry`, perfect-freehand, the path string): O(samples), as Excalidraw does. No React
  render of the stroke. Measured with synthetic moves: Chromium p50 0.2 / 0.8 / 2.2 ms per event at
  300 / 1 000 / 3 000 samples (p95 0.5 / 0.9 / 3.1); WebKit about 1 ms per 1 000 (1 ms timer). A 5 s
  stroke at 120 Hz stays under 1 ms.

## Presentation and UX

- Dock: top centre (or bottom, by choice), four groups; placement, separators and copy in
  [whiteboard-dock](whiteboard-dock.md). Buttons 44 × 44 px on the editor's panel surface tokens.
- Pen buttons: a filled nib in the pen's colour (the main pen shows the ink colour), a thickness bar below
  scaled to its width.
- Flyouts sit above their button, never move the dock; clamp to the viewport horizontally (12 px
  margin, measured from layout width before paint, since the pop-in starts at `scale(0)`), placed
  with the `translate` property because the pop-in animation owns `transform`.
- Dock buttons and flyout options carry the house `Tooltip` (their accessible name).
- Copy: buttons "Select", "Marker 1", "Marker 2", "Marker 3" (2 and 3 adding their colour, e.g. "Marker 2, blue, medium"; `PEN_NAMES`), "Eraser", "Sticky note", "Text", "Shapes", "Shape recognition"; pen flyout "Colour" (second and third pens only), "Width" with "Fine", "Medium", "Bold"; eraser flyout
  "Stroke", "Partial" with hints "Remove whole strokes" / "Erase part of a stroke"; Settings flyout
  "Background" with "Plain", "Dots", "Grid"; Quick Start card "Whiteboard", "Free drawing without distractions"
- Recognition chip: a pill 44 px tall and at least 44 px wide, `px-4`, `text-sm` medium, full
  radius, `shadow-lg`; `bg-slate-900 text-white` in light, `bg-slate-100 text-slate-900` in dark
  (the dock hint's pair), so it stands off either board. Copy "Make shape" / "Keep drawing".

## Accessibility

- Each group a `role="toolbar"` ("Drawing tools", "Shapes", "History", "Settings"),
  `aria-orientation="horizontal"`; roving tabindex per group: one tab stop, ArrowLeft / ArrowRight
  move (wrapping), Home / End jump ([whiteboard-dock](whiteboard-dock.md)).
- Tool buttons carry `aria-pressed`; a pen's name includes its place, colour (second and third pens) and width ("Marker 3, red, medium");
  flyout openers carry `aria-expanded` and `aria-controls`.
- A flyout is a `role="group"` labelled by its title; opening moves focus to its selected control;
  Escape closes it and returns focus to the opener.
- Contrast: ink on board >= 4.5:1 per appearance, pen colours >= 3:1 on both boards (tests).
- Reduced motion: the dock and flyout animations use the app's `.reduce-motion` / media-query rule.
- Recognition chip: a `button` named by its visible text, a 44 x 44 px minimum target (WCAG 2.2
  2.5.8), text at least 4.5:1 on its fill; `tabIndex={-1}`, as it exists only while a pointer is
  held down and the keyboard has Alt for the same flip (D28). No animation.

## Web Experience

- Zero layout shift: the dock is `position: absolute` over the canvas, fixed button sizes, flyouts
  absolutely positioned on its board side; nothing in the page flow changes when a tool or flyout toggles.
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
- Recognition: `[whiteboard] recognition preview <kind>` (the dwell locked),
  `[whiteboard] recognition chip <make|keep>` (the chip offered) and
  `[whiteboard] recognition flip by <key|chip>: <recognised|broken|no shape>` (Alt or the chip).

## Testing

| Rule                                                                           | Test                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| A stored whiteboard opens in Draw                                              | `packages/document/src/legacy-whiteboard-tab.test.ts`                                    |
| Tokens meet contrast                                                           | `packages/document/src/whiteboard.test.ts`                                               |
| Stock colours drawn for the canvas                                             | `packages/document/src/stock-colours.test.ts`                                            |
| Stroke touch and partial split                                                 | `packages/document/src/whiteboard-stroke.test.ts`                                        |
| Pen ink: width at pressure, outline, centre line                               | `packages/document/src/pen-stroke.test.ts`                                               |
| Eight stock colours, each version 4.5:1 or more, darker on the light board     | `packages/document/src/pen-colours.test.ts`                                              |
| `penColour` validated; projected per board; kept by erase pieces               | `validate.test.ts`, `whiteboard.test.ts`, `whiteboard-stroke.test.ts`                    |
| Canvas and export draw the named colour for the canvas                         | `apps/live/lib/stock-colour-projector.test.ts`, `export-as-seen.test.ts`                 |
| Marker prefs: ink for any marker, names, custom hex, old colours read as names | `apps/live/lib/whiteboard-prefs.test.ts`                                                 |
| Commit records a name or a hex                                                 | `apps/live/hooks/canvas/commit-freehand.test.ts`                                         |
| Your colours newest first, eight, Remove, synced                               | `pen-colour-memory.test.ts`, `useWhiteboard.test.tsx`                                    |
| Picker: stock row, row keys, Your colours and Remove, custom, reserved warning | `components/canvas/whiteboard/ColourPicker.test.tsx`, `lib/hsv.test.ts`                  |
| Marker glyph and cursor in the resolved colour, ink included                   | `WhiteboardDock.test.tsx`, `useWhiteboardPenCursor.test.tsx`                             |
| Marker rows: eight stock colours, the tab's customs, Marker 1                  | `quick-style-pen.test.ts`, `useQuickStyle.test.tsx`, `QuickStylePanel.test.tsx`          |
| Swatch rows one line, never clipped, both layouts, both engines                | `e2e/quick-style-swatch-rows.spec.ts`                                                    |
| Settled ink unchanged as samples arrive (no trim)                              | `packages/document/src/pen-stroke.test.ts`                                               |
| Freehand box on whole canvas px, points round-trip                             | `packages/document/src/freehand.test.ts`                                                 |
| Pen stroke svg in canvas coordinates                                           | `apps/live/components/canvas/freehand-svg.test.tsx`                                      |
| Pressures and streamline validated                                             | `packages/document/src/validate.test.ts`                                                 |
| Export draws the pen outline                                                   | `packages/document/src/svg-render.test.ts`, `svg-render-shapes.test.ts`                  |
| Partial erase keeps pressures and streamline                                   | `packages/document/src/whiteboard-stroke.test.ts`                                        |
| Live stroke samples and pressures                                              | `apps/live/lib/live-stroke.test.ts`                                                      |
| Pen gesture: pressure, pointer, cancel, commit                                 | `apps/live/components/canvas/useWhiteboardPenGesture.test.tsx`                           |
| Live ink laid out as it lands, recognition preview                             | `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.test.tsx`                   |
| Break out of a shape, keep ink, hold ink                                       | `apps/live/lib/live-stroke.test.ts`                                                      |
| Alt or chip flip and its telemetry                                             | `apps/live/lib/recognition-flip.test.ts`                                                 |
| Dwell, flips and the chip's offer                                              | `apps/live/hooks/canvas/useRecognitionPreview.test.tsx`                                  |
| Alt mid-stroke: flip, hold, keys kept, what lands                              | `apps/live/components/canvas/useWhiteboardPenGesture.test.tsx`                           |
| Chip place, tap, keeps its presses to itself                                   | `apps/live/components/canvas/whiteboard/WhiteboardPenPreview.test.tsx`                   |
| Broken ink lands as ink; Alt's shape lands as shape                            | `apps/live/hooks/canvas/commit-freehand.test.ts`                                         |
| `penWidth` honoured on every stroke                                            | `svg-render-shapes` test                                                                 |
| Template kind, overrides, builder                                              | `packages/templates` tests                                                               |
| Prefs parse / defaults / pen colours contrast                                  | `apps/live/lib/whiteboard-prefs.test.ts`                                                 |
| Tool derivation, pen intent, pointer route, shapes                             | `apps/live/lib/whiteboard-tool.test.ts`                                                  |
| Pen commit (open, colour, width, held, recognition)                            | `apps/live/hooks/canvas/commit-freehand.test.ts`                                         |
| Border width clears `penWidth`                                                 | `apps/live/lib/style-presets.test.ts`                                                    |
| Backdrop on a whiteboard                                                       | `apps/live/lib/default-scheme.test.ts`                                                   |
| Dock a11y, keyboard, flyouts                                                   | `apps/live/components/canvas/whiteboard/WhiteboardDock.test.tsx`                         |
| Dock state, entering, telemetry                                                | `apps/live/hooks/canvas/useWhiteboard.test.tsx`, `e2e/whiteboard-opening-tool.spec.ts`   |
| Stock colour projection cache                                                  | `apps/live/lib/stock-colour-projector.test.ts`                                           |
| Eraser steps                                                                   | `apps/live/lib/whiteboard-erase.test.ts`                                                 |
| Shape outline: kinds, fill, radius, rotation, sweep                            | `packages/document/src/shape-hit.test.ts`, `svg-path-outline.test.ts`                    |
| Unselected whiteboard shape picked by its outline, 6 px a side                 | `apps/live/components/canvas/ShapeHitOutline.test.tsx`                                   |
| Pen versus touch on the canvas                                                 | `apps/live/hooks/canvas/useCanvasSurfaceGestures.whiteboard.test.tsx`                    |
| A pinch discards a whiteboard stroke                                           | `apps/live/components/canvas/useCanvasDrawGesture.whiteboard.test.tsx`                   |
| Line / arrow heads, no colour                                                  | `apps/live/lib/draw-commit.test.ts`                                                      |
| No theme step for a whiteboard                                                 | `apps/live/components/palette/template-picker-wizard.test.tsx`                           |
| Sticky and text open for typing                                                | `apps/live/lib/draw-mode.test.ts`                                                        |
| Telemetry vocabulary and dashboard                                             | `apps/live/lib/telemetry-coverage.test.ts`, `apps/telemetry/app/metric-emitters.test.ts` |
| End to end                                                                     | playwright-cli walkthrough, light / dark, desktop / narrow                               |

## Constants and configuration

| Constant                        | Value                            | Provenance       | Safe range      |
| ------------------------------- | -------------------------------- | ---------------- | --------------- |
| `WHITEBOARD_BOARD.light / dark` | `#fbfaf7` / `#0d121a`            | spec values      | contrast >= 4.5 |
| `WHITEBOARD_INK.light / dark`   | `#1c1917` / `#e2e8f0`            | spec values      | contrast >= 4.5 |
| `WHITEBOARD_PEN_WIDTHS`         | 1, 1.5, 2.5 px                   | spec             | 1 to 100        |
| `WHITEBOARD_ERASER_RADIUS_PX`   | stroke 10, partial 16            | D6               | 4 to 48         |
| `PATH_ARC_SEGMENTS`             | 16 per arc                       | anchor outlines  | 8 to 64         |
| `OUTLINE_REACH_FACTOR`          | 1.5 half diagonals               | speech bubble    | >= 1.4          |
| Partial densify step            | `max(r / 2, 1)` canvas px        | D7               |                 |
| Crossing bisection steps        | 12                               | D7               | 8 to 20         |
| Recognition threshold           | 0.4                              | Shape Pen        |                 |
| `RECOGNITION_CHIP_GAP_PX`       | 12 screen px                     | D25              | 8 to 24         |
| Storage key                     | `livediagram:v2:whiteboard-pens` | spec             |                 |
| `PEN_STREAMLINE`                | mouse 0.5, pen 0.2, touch 0.2    | Excalidraw       | 0 to 1          |
| `PEN_THINNING`                  | 0.6                              | Excalidraw       | 0 to 1          |
| `PEN_SMOOTHING`                 | 0.5                              | Excalidraw       | 0 to 1          |
| `PEN_MID_PRESSURE`              | 0.5                              | Pointer Events   | 0 to 1          |
| `PERFECT_FREEHAND_END_NOISE`    | 3                                | perfect-freehand | its value       |
| `PEN_STOCK_CONTRAST`            | 6                                | D29              | 4.5 to 7        |
| `PEN_MIN_CONTRAST`              | 3                                | WCAG 1.4.11      | 3               |
| `YOUR_COLOURS_MAX`              | 8                                | spec             | fixed           |
| `TAB_CUSTOM_COLOURS_MAX`        | 8                                | spec             | panel width     |
| Custom picker start             | `#3b82f6`                        | mock             | any hex         |
| perfect-freehand `size`         | `width / (2 · sin(π/4))`         | calibration      | derived         |
| perfect-freehand `easing`       | `t => sin(t · π / 2)`            | Excalidraw       |                 |

## Defaults ledger

See [DEFAULTS.md](DEFAULTS.md).
