# Highlighter

A wide, semi-transparent freehand marker, picked from the palette's **Draw** category like the two pens. It is for calling attention to things during reviews and workshops (circling a region, underlining a label), not for sketching shapes, so it deliberately drops the Pencil's shape-recognition and close-to-fill behaviours.

## History

It started as a draw tile in the Draw category, then became a held **canvas tool** (a selection mode in the tool dropdown, with its own Highlighter Panel and a Mode Button that handed it out). It is a **Draw tile again**: what it makes is an element, a marker stroke, so it sits beside the other things that make strokes, and the selection modes go back to being ways of working on the canvas rather than ways of adding to it. The panel, the held behaviour and the Mode Button went with the mode.

## Model

A highlighter stroke **is a `FreehandElement`** with one optional field:

```ts
pen?: 'highlighter'; // absent = ordinary pencil sketch
```

No new element type. The stroke reuses the freehand pipeline end to end: normalised `points`, RDP simplification, bbox, history, sync, layers, eraser, export. `closed` is always `false` for highlighter strokes (no auto-close, no fill). Wire validation (`packages/document/src/validate.ts`) accepts the optional literal. `penWidth?: number` (wire-validated 1..100) stays on the model for strokes drawn while the marker had a Strength setting, and for imported highlighter ink; the Draw tile never writes it.

## Visual treatment

Both renderers (the canvas `FreehandSvg` and the headless `svgFreehandShape` used by share thumbnails and the MCP render) apply the same recipe when `pen === 'highlighter'`:

- **Stroke width**: a wide round stroke (`penWidth ?? 14` px, `vector-effect: non-scaling-stroke`), ignoring the `strokeWidth` border presets (they only reach hairline widths).
- **Round caps + joins**, never dashed, never filled.
- **Translucency**: `stroke-opacity: 0.45` plus `mix-blend-mode: multiply`, so text and shapes underneath stay legible and overlapping strokes darken like a real marker. This is part of the pen recipe, independent of the user-facing `opacity` field, which still composes on top.
- **Colour**: always created **marker yellow** (`#fde047`) regardless of theme, at the default 14 px width; recolourable afterwards via the element context menu's Colours category like any element. The theme's `elementStroke` is deliberately not used: highlighters are yellow until the user says otherwise.

## The tile

- `tools:highlighter` in the **Draw** category, third, after **Freehand** and **Shape Pen** (the three pens together, then Polygon, then Arrow and Line). Caption **Highlighter**, blurb "A wide translucent marker stroke", the highlighter-nib glyph.
- **One-shot, like Freehand.** Picking the tile arms the marker; the next drag lays one stroke, which is **selected** on release, and the tile puts itself down. The tile shows pressed while armed. Escape, the mode banner's Cancel or another tile disarms it.
- The **mode banner** reads **"Drag to highlight"**, the same banner every other one-shot arm wears.
- A gesture too short to be a stroke disarms, as for the pencil.
- No single-letter shortcut ([Canvas and palette](canvas-and-palette.md): only the common flowchart vocabulary gets letters). It is not a command-palette tool switch: like the pens, it is reached from the palette (and its search).
- `PendingDraw` carries `{ type: 'freehand'; variant: 'highlighter' }`. Commit path is the same sampling + simplification as the pencil, then always `createFreehand(points, false)` + `pen: 'highlighter'` + the yellow stroke colour: no recognition branch, no auto-close. Recognition is the Shape Pen's job ([Two pens instead of a pen and a mode](two-pens.md)); the highlighter is a third variant of the same gesture.
- Cursor: a highlighter-nib glyph, distinct from the pencil nib. The live draw preview (`CanvasDrawPreview`) paints the in-flight polyline with the marker recipe, so what you see while dragging is what commits.
- Draw mode ([Draw mode](../023-draw-mode/draw-mode.md)) has no highlighter: a whiteboard's pens are its markers, and its dock replaces the palette.

## Not a selection mode

`'highlighter'` is not on the editor's `CanvasTool` union, not in the tool dropdown, and not a `SelectionMode` (`packages/document/src/selection-mode.ts`), so there is no Highlighter Mode Button.

A Mode Button saved while it was one still carries `mode: 'highlighter'`. The stored-element migration (`migrateLegacyModeButtons`, run by `migrateStoredElements` at every entry point) **drops the field**, so the button loads and reads as the default mode ([Selection Mode button](../009-elements/mode-button.md)) rather than failing validation and taking its tab with it.

## Favourites

The tile can be favourited like any other ([Palette Favourites](../010-palette/palette-favourites.md)). It is not in the default list: Table kept the slot it took when the tile was first retired.

## Everything else is inherited

Selection, move/resize (non-scaling stroke keeps the marker width), rotation, lock, layers, duplicate, copy/paste, undo, realtime sync, and the eraser's bbox hit-testing all treat it as the freehand it is (the Eraser Panel's "Drawings only" filter covers marker strokes too). The element display name (`element-names.ts`) reads "Highlight" instead of "Sketch" when the pen field is present.

## Telemetry

Committing a stroke fires `track('Element', 'Added', 'Highlighter')`. Picking the tile fires the palette's own tile event like every Draw tile. There is no `Canvas·Used·Highlighter` any more: it is not a mode.
