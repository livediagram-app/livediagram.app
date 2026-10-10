# Timeline rail

A **Timeline Rail** is a composite component: a horizontal line with evenly-
spaced points above it. It follows a reusable pattern for composite "rail"
components rather than being a one-off.

## Behaviour

- Drag it in from the palette (Build tab, beside the mind node, lane, frame
  and table). It drops as a line with **3 points** above it.
- Each point has an **editable label above it** (`railLabels`, index-aligned).
  Select the rail, then click a label to type; it commits on blur / Enter as one
  undo step.
- Adding a point is offered from the element's **standard quick-connect "+"**
  (an "Add Point" action), so the rail draws no competing on-canvas button.
  Points are evenly spaced and the rail **widens by one step** per point
  (constant spacing × point count), so it stays neat as it grows; capped at 12.
- A **Timeline** context-menu category (modelled on Progress) carries a
  **Points** stepper to set the count precisely, and to remove points (min 2).
- It's a normal boxed element otherwise: move / resize / rotate / select /
  lock / theme-colour all work. Its accent (stroke colour) tints the dots; the
  wrapper draws no box border.

## Model

Timeline Rail is a `ShapeKind` `'timeline-rail'` (like the progress elements),
not a new top-level element type, so it inherits all boxed-element behaviour
with no new render/copy/export branches to maintain.

- `ShapeElement.railCount?: number`: how many points (default
  `RAIL_DEFAULT_POINTS` = 3, clamped `RAIL_MIN_POINTS`..`RAIL_MAX_POINTS` =
  2..12). Constants + `isRailShape()` live in `@livediagram/document` (`src/data-shapes.ts`);
  `RAIL_POINT_STEP_PX` (120) is the per-point width step.
- Rendered by `RailView` (`apps/live/components/canvas/RailView.tsx`): an SVG line +
  dots-with-ticks sized to the element box (so resize never distorts the dots),
  plus one label per point, editable while the rail is selected. `element-variant.ts`
  gives the rail a borderless wrapper.
- Setters in `useDataShapeSetters.ts` (composed into `useElementStyle`):
  `setRailCountSelected(n)` (sets count + width), `addRailPointSelected()` (the
  quick-connect "Add Point") and `setRailLabelSelected(elementId, index, text)`
  (one point's label). The "Add Point" handler threads EditorCanvasHost → Canvas →
  CanvasElementsLayer → QuickConnectRing (`onAddRailPoint`), the same channel the
  table ring's structural adds use.
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `track('Element', 'Added', 'TimelineRail')` on create,
  `track('Element', 'Changed', 'TimelineRail')` on point changes.

## Extending with more composite components

The rail establishes the pattern for composite components: a dedicated
`ShapeKind` + a small state field on `ShapeElement` + a bespoke `*View` +
a borderless variant + an optional context-menu category. New ones (other rail
styles, etc.) follow the same five touch-points without a new element type.
