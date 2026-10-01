# Shape markers

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
- Self-drawing shapes (`isSelfDrawingShape`: progress, charts, rating, code
  block, checklist and the rest) draw their own content, so they don't show a
  marker.

## Managing markers

A **Markers** category in the element menu's **Text** flyout, beside Typography
and Alignment ([Canvas and palette](../008-canvas/canvas-and-palette.md)). Like
the other Text categories it shows only once the shape has text, or while its
text is being typed.

Inside it: an illustrated tile per option (None + the five markers, each a glyph
over its label) and a **Size** row (Scale / S / M / L) mirroring the Text-size
control. The Size row always renders, dimmed and inert until a marker is set
([Menu flyouts must not resize under the pointer](../004-interface-design/flyout-height-stability.md)).
Hovering a tile or a size previews it on the canvas; a click commits. Shapes
only; not offered for arrows / text / images / tables, nor on a shape kind where
a marker would never show (`supportsMarkers` in `@livediagram/document`): the
self-drawing kinds, which have no label, and the kinds with their own face
(the Behaviour and Collaborate elements such as the Temperature check, the Q&A
board and the Idea box), whose label is a title the face draws. The same
reasoning, and the same list, as the Text alignment gate. The multi-selection
menu offers markers too, for every marker-capable shape in the selection with
text.

## Implementation notes

- Data model: `ShapeElement.marker?: ShapeMarker` and
  `ShapeElement.markerSize?: TextSize` (`packages/document/src/shape-marker.ts`
  defines the `ShapeMarker` union + `SHAPE_MARKERS` order).
- The glyph is one component, `ShapeMarkerGlyph` (`apps/live/components/canvas/ShapeMarker.tsx`),
  shared by the canvas renderer and the context-menu tiles; the circles carry a
  fixed fill, the checkbox tints with the element's text colour.
- Rendering reuses the shape's icon+label flex layout (`ShapeInlineIconLayout`
  in `apps/live/components/canvas/shape-inline-icon-layout.tsx`), generalised to draw an optional marker left of the
  label with or without an inline icon.
- Setters `setMarkerSelected` / `setMarkerSizeSelected` in
  `apps/live/hooks/canvas/useShapeStyleSetters.ts` (exposed through `useElementStyle.ts`)
  and the menu's `commitMarker` / `commitMarkerSize` (`useStylePreview.ts`) apply to
  the selected shape(s) in one history step.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `track('Element', 'Changed', 'Marker' | 'MarkerSize')`.
- Image export (PNG / SVG / PDF) drawing the marker beside the label is a
  **follow-up** (`lib/export-tab.ts`): the export positions labels
  independently of the canvas flex layout, so faithfully placing the marker
  left of the wrapped label is its own change, tracked separately.
