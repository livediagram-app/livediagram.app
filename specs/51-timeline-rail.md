# 51 — Timeline rail

A **Timeline Rail** is a composite component: a horizontal line with evenly-
spaced points above it. It's the first of a planned family of composite "rail"
components, so it's built to a reusable pattern rather than as a one-off.

## Behaviour

- Drag it in from the palette (Tools tab, next to the progress elements). It
  drops as a line with **3 points** above it.
- When selected, a **"+" affordance at the right end** of the rail adds another
  point. Points are evenly spaced and the rail **widens by one step** per point
  (constant spacing × point count), so it stays neat as it grows; capped at 12.
- A **Timeline** context-menu category (modelled on Progress) carries a
  **Points** stepper to set the count precisely — and to remove points (min 2).
- It's a normal boxed element otherwise: move / resize / rotate / select /
  group / lock / theme-colour all work. Its accent (stroke colour) tints the
  dots; the wrapper draws no box border.

## Model

Timeline Rail is a `ShapeKind` `'timeline-rail'` (like the progress elements),
not a new top-level element type — so it inherits all boxed-element behaviour
with no new render/copy/export branches to maintain.

- `ShapeElement.railCount?: number` — how many points (default
  `RAIL_DEFAULT_POINTS` = 3, clamped `RAIL_MIN_POINTS`..`RAIL_MAX_POINTS` =
  2..12). Constants + `isRailShape()` live in `packages/diagram/src/index.ts`;
  `RAIL_POINT_STEP_PX` (120) is the per-point width step.
- Rendered by `RailView` (`apps/live/components/RailView.tsx`): an SVG line +
  dots-with-ticks sized to the element box (so resize never distorts the dots),
  plus the right-end "+" button when `interactive`. `element-variant.ts` gives
  the rail a borderless wrapper.
- Setters in `useElementStyle.ts`: `setRailCountSelected(n)` (sets count +
  width) and `addRailPointSelected()` (the canvas "+"). The "+" handler threads
  EditorView → Canvas → CanvasElementsLayer → BoxedElementView → RailView, the
  same channel the table's structural edits use.
- Telemetry (spec/22): `track('Element', 'Added', 'TimelineRail')` on create,
  `track('Element', 'Changed', 'TimelineRail')` on point changes.

## Extending with more composite components

The rail establishes the pattern for future composite components: a dedicated
`ShapeKind` + a small state field on `ShapeElement` + a bespoke `*View` +
a borderless variant + an optional context-menu category. New ones (other rail
styles, etc.) follow the same five touch-points without a new element type.
