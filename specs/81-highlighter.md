# 81 — Highlighter

A wide, semi-transparent freehand marker, held from the palette's tool dropdown like the Eraser. It is for calling attention to things during reviews and workshops (circling a region, underlining a label), not for sketching shapes, so it deliberately drops the Pencil's shape-recognition and close-to-fill behaviours.

It started as a **draw tile** in the palette's Draw category — pick the tile, draw one stroke, the tool puts itself down. That was a one-shot arm wearing a mode's clothes: nobody highlights one thing. You highlight a passage, then the label beside it, then the box below, and every pass meant going back to the palette. It is a **canvas tool** now (a held mode), which is what it always behaved like in the user's head.

## Model

A highlighter stroke **is a `FreehandElement`** with one new optional field:

```ts
pen?: 'highlighter'; // absent = ordinary pencil sketch
```

No new element type. The stroke reuses the freehand pipeline end to end: normalised `points`, RDP simplification, bbox, history, sync, layers, eraser, export. `closed` is always `false` for highlighter strokes (no auto-close, no fill). Wire validation (`packages/diagram/src/validate.ts`) accepts the optional literal.

## Visual treatment

Both renderers (the canvas `FreehandSvg` and the headless `svgFreehandShape` used by share thumbnails and the MCP render) apply the same recipe when `pen === 'highlighter'`:

- **Stroke width**: a wide round stroke (`penWidth ?? 14` px, `vector-effect: non-scaling-stroke`), ignoring the `strokeWidth` border presets (they only reach hairline widths). `penWidth?: number` is the model's second optional pen field (wire-validated 1..100), written at draw time from the panel's Strength setting.
- **Round caps + joins**, never dashed, never filled.
- **Translucency**: `stroke-opacity: 0.45` plus `mix-blend-mode: multiply`, so text and shapes underneath stay legible and overlapping strokes darken like a real marker. This is part of the pen recipe, independent of the user-facing `opacity` field, which still composes on top.
- **Colour**: created with the panel's current colour (default `#fde047`, marker yellow) regardless of theme; recolourable afterwards via the element context menu's Colours category like any element. The theme's `elementStroke` is deliberately not used — highlighters are yellow until the user says otherwise.

## The tool

- It lives in the palette's **canvas-tool dropdown**, in the **Edit** group (group 0) beside Select, Hand, Eraser and Format — `'highlighter'` on the editor's `CanvasTool` union, built in `canvas-tool-options.tsx`.
- **It is the one tool in that dropdown that stays live on an empty canvas.** Everything from the Eraser down acts on existing content, so it disables with nothing to act on; the highlighter MAKES content, so an empty board is a fine place to start.
- **It is held.** Entering the tool arms the freehand-marker gesture, **every committed stroke re-arms it**, and leaving the tool drops it (and only it — the marker's own intent, so putting the tool down never cancels a draw armed from the palette while holding it). A stray tap on the canvas no longer disarms anything.
- **Strokes are not auto-selected after drawing.** The old one-shot selected the stroke it had just committed, which was helpful when the tool was over; on a held marker it means the next drag drags the thing you just drew instead of highlighting.
- Each pass is its own undo, as it always was.
- No single-letter shortcut (spec/09: only the common flowchart vocabulary gets letters). It is reachable from the command palette as `tool:highlighter` like every other tool (spec/70).
- The gesture underneath is unchanged: `PendingDraw` still carries `{ type: 'freehand'; variant: 'highlighter' }`, so the mode is expressed by keeping that intent armed for as long as the tool is selected. Commit path is the same sampling + simplification as the pencil, then always `createFreehand(points, false)` + the pen fields — no recognition branch, no auto-close. Recognition is the Shape Pen's job (spec/115); the highlighter is a third variant of the same gesture.
- Cursor: a highlighter-nib glyph, distinct from the pencil nib.
- **No mode banner.** The top banner belongs to a one-shot arm ("you picked a square, now drag one out", with a Cancel because the intent is transient). A held mode does not need telling you it is on every time you look up — and the banner sat across the top of the canvas, covering the toolbar you were trying to highlight next to. `TopCenterChrome` excludes the marker intent explicitly.

## The Highlighter Panel

The marker's two settings live in a dockable **Highlighter Panel** (`components/panels/HighlighterPanel.tsx`), mounted only while the tool is held — the **sixth tool panel**, on the same terms as the Avatar, Laser (spec/111), Spotlight (spec/112), Eraser (spec/113) and Format (spec/117) ones, and a participant in panel docking (spec/63) with its own `'highlighter'` panel id. Both settings apply to the NEXT strokes:

- **Colour** — five marker swatches: Yellow (default), Green, Pink, Blue, Orange.
- **Strength** — three presets: Thin (8), Medium (14, default), Bold (22).

Above them sits a **live preview**: a real stroke at the chosen colour and width, laid over bars standing in for a line of text. "Bold" is a number until you see how much of a sentence it covers.

The vocabulary is data in `apps/live/lib/highlighter-config.ts` (`HIGHLIGHTER_COLORS`, `HIGHLIGHTER_WIDTHS`, plus id↔px helpers), read by both the panel and the commit path — the same shape the other tool panels' configs take, rather than living inside the one component that happened to draw them first.

Both settings are **session-local editor state** (`useShapeDrawing`), deliberately not a persisted preference: the marker resets to yellow / medium on a fresh load, like a real pen cup. Nothing here is stored on the diagram or sent to the api. The live draw preview (`CanvasDrawPreview`) paints the in-flight polyline with the same colour and width, so what you see while dragging is what commits.

This replaced a pair of popovers hanging off the mode banner. That was the right home while the highlighter was an arm — the banner was the only thing on screen that knew the arm existed — and the wrong one the moment it became a mode, because a mode's settings belong wherever every other mode keeps theirs.

## Palette

- The `tools:highlighter` **draw tile is gone**. The Draw category now holds four tiles: Freehand, Shape Pen, Polygon, Arrow.
- A **Highlighter Mode Button** joins the Selection Mode tiles in the Behaviour section (`tools:mode-highlighter`, spec/103): drop one on the canvas and whoever presses it is handed the marker. `'highlighter'` is a `SelectionMode` in `packages/diagram/src/selection-mode.ts` for exactly this, so a saved button can carry it.
- The **default Favourites** list (spec/78) swapped the Highlighter's slot for `tools:table` — there is no tile to favourite any more, and Table kept the grid at twelve rather than leaving a ragged row. Anyone who had favourited the old id loses it silently on read, which is the existing behaviour for a retired tile.

## Everything else is inherited

Selection, move/resize (non-scaling stroke keeps the marker width), rotation, lock, layers, duplicate, copy/paste, undo, realtime sync, and the eraser's bbox hit-testing all treat it as the freehand it is (the Eraser Panel's "Drawings only" filter covers marker strokes too). The element display name (`element-names.ts`) reads "Highlight" instead of "Sketch" when the pen field is present.

## Telemetry

Committing a stroke fires `track('Element', 'Added', 'Highlighter')` — the type slot is free-form, so no schema change. Picking the tool fires `Canvas·Used·Highlighter` through the shared tool setter (`useCanvasTool`), the same as every other mode, so a press on a Highlighter Mode Button reports as the mode it hands out rather than a separate event.
