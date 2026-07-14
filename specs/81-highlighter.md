# 81 — Highlighter

A wide, semi-transparent freehand marker that sits beside the Pencil in the palette's Tools section. It is for calling attention to things during reviews and workshops (circling a region, underlining a label), not for sketching shapes, so it deliberately drops the Pencil's shape-recognition and close-to-fill behaviours.

## Model

A highlighter stroke **is a `FreehandElement`** with one new optional field:

```ts
pen?: 'highlighter'; // absent = ordinary pencil sketch
```

No new element type. The stroke reuses the freehand pipeline end to end: normalised `points`, RDP simplification, bbox, history, sync, layers, eraser, export. `closed` is always `false` for highlighter strokes (no auto-close, no fill). Wire validation (`packages/diagram/src/validate.ts`) accepts the optional literal.

## Visual treatment

Both renderers (the canvas `FreehandSvg` and the headless `svgFreehandShape` used by share thumbnails and the MCP render) apply the same recipe when `pen === 'highlighter'`:

- **Stroke width**: a fixed wide stroke (14px, `vector-effect: non-scaling-stroke`), ignoring the `strokeWidth` border presets (they only reach hairline widths).
- **Round caps + joins**, never dashed, never filled.
- **Translucency**: `stroke-opacity: 0.45` plus `mix-blend-mode: multiply`, so text and shapes underneath stay legible and overlapping strokes darken like a real marker. This is part of the pen recipe, independent of the user-facing `opacity` field, which still composes on top.
- **Colour**: created with `strokeColor: '#fde047'` (marker yellow) regardless of theme; recolourable afterwards via the element context menu's Colours category like any element. The theme's `elementStroke` is deliberately not used — highlighters are yellow until the user says otherwise.

The live draw preview (`CanvasDrawPreview`) paints the in-flight polyline with the same wide translucent yellow treatment so what you see while dragging is what commits.

## Palette + gesture

- New tile `tools:highlighter` in the shared tile catalogue (`palette-tile-defs.tsx`), Tools section, directly after the Pencil. Like every catalogue tile it is favouritable (spec/78). No single-letter shortcut (spec/09: only the common flowchart vocabulary gets letters).
- Arming reuses the freehand intent with a payload: `PendingDraw` gains `{ type: 'freehand'; variant?: 'highlighter' }`. The tile arms the variant; the Pencil tile keeps arming the bare intent.
- Banner copy: "Drag to highlight". The shape-recognition toggle does **not** render for the highlighter variant (recognition never runs on commit, whatever the `recogniseShapes` preference says).
- Cursor: a highlighter-nib glyph, distinct from the pencil nib.
- Commit path: same sampling + simplification as the pencil, then always `createFreehand(points, false)` + the pen field — no recognition branch, no auto-close.

## Everything else is inherited

Selection, move/resize (non-scaling stroke keeps the marker width), rotation, lock, layers, duplicate, copy/paste, undo, realtime sync, and the eraser's bbox hit-testing all treat it as the freehand it is. The element display name (`element-names.ts`) reads "Highlight" instead of "Sketch" when the pen field is present.

## Telemetry

Commit fires `track('Element', 'Added', 'Highlighter')` — the type slot is free-form, so no schema change.
