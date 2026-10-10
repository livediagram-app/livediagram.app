# Highlighter

A wide, semi-transparent freehand marker, picked from the palette's **Draw** category like the two pens. It is for calling attention to things during reviews and workshops (circling a region, underlining a label), not for sketching shapes, so it deliberately drops the Pencil's shape-recognition and close-to-fill behaviours.

## History

It started as a draw tile in the Draw category, then became a held **canvas tool** (a selection mode in the tool dropdown, with its own Highlighter Panel and a Mode Button that handed it out). It is a **Draw tile again**: what it makes is an element, a marker stroke, so it sits beside the other things that make strokes, and the selection modes go back to being ways of working on the canvas rather than ways of adding to it. The held behaviour, the Mode Button and the Highlighter Panel went with the mode; its Colour and Strength moved into the [Quick style panel](quick-style-panel.md), the way a whiteboard marker's do.

## Model

A highlighter stroke **is a `FreehandElement`** with one optional field:

```ts
pen?: 'highlighter'; // absent = ordinary pencil sketch
```

No new element type. The stroke reuses the freehand pipeline end to end: normalised `points`, RDP simplification, bbox, history, sync, layers, eraser, export. `closed` is always `false` for highlighter strokes (no auto-close, no fill). Wire validation (`packages/document/src/validate.ts`) accepts the optional literal. `penWidth?: number` (wire-validated 1..100) carries the stroke's width when it is not the default 14 px (Thin or Bold, an earlier Strength setting, imported highlighter ink).

## Visual treatment

Both renderers (the canvas `FreehandSvg` and the headless `svgFreehandShape` used by share thumbnails and the MCP render) apply the same recipe when `pen === 'highlighter'`:

- **Stroke width**: a wide round stroke (`penWidth ?? 14` px, `vector-effect: non-scaling-stroke`), ignoring the `strokeWidth` border presets (they only reach hairline widths).
- **Round caps + joins**, never dashed, never filled.
- **Translucency**: `stroke-opacity: 0.45` plus `mix-blend-mode: multiply`, so text and shapes underneath stay legible and overlapping strokes darken like a real marker. This is part of the pen recipe, independent of the user-facing `opacity` field, which still composes on top.
- **Colour**: created in the highlighter's current colour (default **marker yellow**, `#fde047`) regardless of theme; recolourable afterwards from the Quick style panel or the context menu's Colours category like any element. The theme's `elementStroke` is deliberately not used: highlighters are yellow until the user says otherwise.

## The tile

- `tools:highlighter` in the **Draw** category, third, after **Freehand** and **Shape Pen** (the three pens together, then Polygon, then Arrow and Line). Caption **Highlighter**, blurb "A wide translucent marker stroke", the highlighter-nib glyph.
- **One-shot, like Freehand.** Picking the tile arms the marker; the next drag lays one stroke, which is **selected** on release, and the tile puts itself down. The tile shows pressed while armed. Escape, the mode banner's Cancel or another tile disarms it.
- The stroke lands in the highlighter's current **Colour** and **Width** (see Settings).
- The **mode banner** reads **"Drag to highlight"**, the same banner every other one-shot arm wears.
- A gesture too short to be a stroke disarms, as for the pencil.
- No single-letter shortcut ([Canvas and palette](canvas-and-palette.md): only the common flowchart vocabulary gets letters). It is not a command-palette tool switch: like the pens, it is reached from the palette (and its search).
- `PendingDraw` carries `{ type: 'freehand'; variant: 'highlighter' }`. Commit path is the same sampling + simplification as the pencil, then always `createFreehand(points, false)` + `pen: 'highlighter'` + the current colour (and `penWidth` when the width is not Medium): no recognition branch, no auto-close. Recognition is the Shape Pen's job ([Two pens instead of a pen and a mode](two-pens.md)); the highlighter is a third variant of the same gesture.
- Cursor: a highlighter-nib glyph, distinct from the pencil nib. The live draw preview (`CanvasDrawPreview`) paints the in-flight polyline with the marker recipe in the current colour and width, so what you see while dragging is what commits.

## Settings: the Quick style panel

The highlighter's settings live in the [Quick style panel](quick-style-panel.md), as a whiteboard marker's do ([Draw mode](../023-draw-mode/draw-mode.md) "The quick style panel stays"). Two rows:

- **Highlighter colour**: five marker swatches, **Yellow** (`#fde047`, the default), **Green** (`#86efac`), **Pink** (`#f9a8d4`), **Blue** (`#93c5fd`), **Orange** (`#fdba74`). Fixed hexes, not theme colours: a highlight that changed colour with the theme would stop reading as one. The row ends with **More colours**, opening the [colour picker](../004-interface-design/colour-picker.md) with the soft standard colours, Custom colours and **Add a custom colour** (four coloured dots).
- **Highlighter width**: **Thin** (8 px), **Medium** (14 px, the default), **Bold** (22 px), each drawn as a preview of its band.

What the rows style, in the order the panel looks:

1. **Selected highlights.** With one or more unlocked highlight strokes selected, the rows restyle them (`strokeColor`, `penWidth`; Medium clears `penWidth`), one undo step per choice. A choice is marked only when every selected highlight shares it. In a mixed selection the rows sit above the rows for everything else and touch only the highlights; the caption counts what is styled. A stroke whose colour or width matches no option (recoloured from the context menu, imported) marks none.
2. **The armed tile, nothing selected.** Picking the tile clears the selection, so the panel shows the rows for the **next stroke**, captioned **Highlighter**: the highlighter's current colour and width, which every stroke then lands in. This is the only way to set them before drawing.

The current colour and width are **session-local editor state**, not a persisted preference: the highlighter resets to Yellow / Medium on a fresh load, like a real pen cup. Restyling a selected highlight does not change them; only choosing with the tile armed does. Nothing here is stored except on the strokes themselves.

**Width is a panel-only setting.** The context menu offers a highlight's colour (Colours) but not its width; the panel holds both, as it holds a whiteboard marker's width. This is a deliberate exception to the panel's "the menu stays complete" rule, scoped to the highlighter's two rows.

- Draw mode ([Draw mode](../023-draw-mode/draw-mode.md)) has no highlighter: a whiteboard's pens are its markers, and its dock replaces the palette.

## Not a selection mode

`'highlighter'` is not on the editor's `CanvasTool` union, not in the tool dropdown, and not a `SelectionMode` (`packages/document/src/selection-mode.ts`), so there is no Highlighter Mode Button.

A Mode Button saved while it was one still carries `mode: 'highlighter'`. The stored-element migration (`migrateLegacyModeButtons`, run by `migrateStoredElements` at every entry point) **drops the field**, so the button loads and reads as the default mode ([Selection Mode button](../009-elements/mode-button.md)) rather than failing validation and taking its tab with it.

## Popular

The tile is not in Diagram mode's Popular ([Editor modes](../007-editor/editor-modes.md#the-palette-per-mode)): Table kept the slot it took when the tile was first retired.

## Everything else is inherited

Selection, move/resize (non-scaling stroke keeps the marker width), rotation, lock, layers, duplicate, copy/paste, undo, realtime sync, and the eraser's bbox hit-testing all treat it as the freehand it is (the Eraser Panel's "Drawings only" filter covers marker strokes too). The element display name (`element-names.ts`) reads "Highlight" instead of "Sketch" when the pen field is present.

## Telemetry

Committing a stroke fires `track('Element', 'Added', 'Highlighter')`. Picking the tile fires the palette's own tile event like every Draw tile. There is no `Canvas·Used·Highlighter` any more: it is not a mode. A panel choice on selected highlights fires `Element·Changed·QuickStroke` (colour) or `Element·Changed·QuickStrokeWidth` (width), the panel's existing tokens; a choice for the next stroke is a setting, `UI·Changed·HighlighterColour` / `UI·Changed·HighlighterWidth`, charted as **Highlighter Settings** in the dashboard's Look & Feel stack.
