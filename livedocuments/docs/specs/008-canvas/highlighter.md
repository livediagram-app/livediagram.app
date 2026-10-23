# Highlighter

A wide, semi-transparent freehand marker stroke. livedocuments keeps and draws highlight strokes (a document brought over from livediagram, a stroke written through the API or MCP), but has **no tile to draw a new one**: the pens went with livediagram's Draw mode, and the Pages palette offers no pens ([Canvas and palette](canvas-and-palette.md)). A highlight deliberately drops a pencil's shape-recognition and close-to-fill behaviours.

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
- **Colour**: its own stored colour (livediagram's default was **marker yellow**, `#fde047`) regardless of theme; recolourable from the context menu's Colours category like any element. The theme's `elementStroke` is deliberately not used: a highlight keeps its own colour.

## Everything else is inherited

Selection, move/resize (non-scaling stroke keeps the marker width), rotation, lock, layers, duplicate, copy/paste, undo, realtime sync, and the eraser's bbox hit-testing all treat it as the freehand it is (the Eraser Panel's "Drawings only" filter covers marker strokes too). The element display name (`element-names.ts`) reads "Highlight" instead of "Sketch" when the pen field is present.

## Telemetry

A copy of a highlight stroke reports as `Element · Added · Highlighter` (`apps/editor/lib/element-telemetry.ts`). No setting or tile event remains.
