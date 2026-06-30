# 49 — Shape markers

A **marker** is a small status glyph shown inside a shape: a traffic-light dot
or a checkbox. It lets a user flag state at a glance (red/amber/green status, a
to-do that's done or not) without adding a separate element.

## Markers

Five markers, plus a **None** option that clears it:

- **Green circle**, **Orange circle**, **Red circle** — filled status dots.
- **Checkbox (unchecked)** — an empty box ("To do").
- **Checkbox (checked)** — a ticked box ("Done").

## Placement + size

- The marker sits **just to the left of the element's text**. When the shape
  has **no label**, it is **centred** in the shape. It composes with the
  existing inline icon (drag-an-icon-onto-a-shape) — the marker hugs the label;
  the icon keeps its chosen side.
- **Size** is a `TextSize` bucket: **Scale / Small / Medium / Large**. `Scale`
  (the default) tracks the element's text size, so the marker grows and shrinks
  with the label; the fixed buckets are small / medium / large dots.
- Progress shapes (bar / ring) draw their own centred percentage, so they don't
  show a marker.

## Managing markers

A **Markers** category in the single-shape right-click menu, in its own band
between **Border** and **Collaborate**:

```
Border
─────────
Markers
─────────
Collaborate
```

Inside it: an illustrated tile per option (None + the five markers, each a glyph
over its label) and, once a marker is chosen, a **Size** row (Scale / S / M / L)
mirroring the Text-size control. Shapes only; not offered for arrows / text /
images / tables, nor in the multi-selection menu.

## Implementation notes

- Data model: `ShapeElement.marker?: ShapeMarker` and
  `ShapeElement.markerSize?: TextSize` (`packages/diagram/src/shape-marker.ts`
  defines the `ShapeMarker` union + `SHAPE_MARKERS` order).
- The glyph is one component, `ShapeMarkerGlyph` (`apps/live/components/canvas/ShapeMarker.tsx`),
  shared by the canvas renderer and the context-menu tiles; the circles carry a
  fixed fill, the checkbox tints with the element's text colour.
- Rendering reuses the shape's icon+label flex layout (`ShapeInlineIconLayout`
  in `BoxedElementView.tsx`), generalised to draw an optional marker left of the
  label with or without an inline icon.
- Setters `setMarkerSelected` / `setMarkerSizeSelected` in
  `apps/live/hooks/canvas/useElementStyle.ts` apply to the selected shape(s) in one
  history step.
- Telemetry (spec/22): `track('Element', 'Changed', 'Marker' | 'MarkerSize')`.
- Image export (PNG / SVG / PDF) drawing the marker beside the label is a
  **follow-up** (`lib/export-tab.ts`): the export positions labels
  independently of the canvas flex layout, so faithfully placing the marker
  left of the wrapped label is its own change, tracked separately.
