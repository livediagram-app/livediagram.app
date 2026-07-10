# 77. Arrow collision avoidance at draw time

Status: shipped

## What

When the user finishes DRAWING a new arrow, the editor checks whether the
default straight line would look wrong and, if so, gives the arrow a gentle
curve instead:

- **Crossing (or grazing) an unrelated element.** The straight chord passes
  through another element's box, or within a small clearance margin of it.
  The arrow bows around the obstacle, on whichever side needs the smaller
  bow.
- **Running flush along its own elements.** Both ends pinned so the chord
  hugs the connected boxes' edges (two stacked elements joined along one
  side). The arrow bows outward, away from the boxes.

The result is an ordinary curved arrow: `arrowStyle: 'curved'` plus a
`curveOffset`, exactly what dragging the curve handle produces. The user can
adjust the bow or straighten it with the existing controls; nothing about
the arrow is special afterwards.

## When it applies (and when it doesn't)

- Only at the END of an interactive draw gesture (quick-connect plus drag,
  quick-connect click-to-place, shift-chained arrows). One shot: arrows are
  never re-routed afterwards, so a bow never fights the user's later edits.
- Only for a NEW arrow's head placement. Repositioning an existing arrow's
  endpoint never triggers it.
- Only when the arrow is still style-untouched (no `arrowStyle`,
  `curveOffset`, or `curvePoints`). Anything the user or the creation flow
  chose wins.
- Never for imports, templates, AI authoring, or auto layout: those paths
  own their geometry (spec/62, spec/73).

## How (packages/diagram/src/arrow-avoidance.ts)

`collisionAvoidingCurveOffset(from, to, obstacles)` samples the REAL curve
the renderer would draw (the quadratic with control `chord midpoint +
offset`, see arrow-path.ts) against every obstacle box inflated by a 14 px
clearance margin:

- The arrow's own endpoint elements are obstacles too (that is what makes
  the flush case bow), except samples within 26 px of their own endpoint,
  since the curve necessarily starts on the element's boundary.
- Obstacles that contain an endpoint (an arrow drawn out of overlapping
  elements, or members inside a frame) are unclearable and ignored.
- If the straight chord is clear, the arrow stays straight (`null`).
- Otherwise both perpendicular sides are searched in 8 px steps up to a
  280 px control offset (a ~140 px visual bow); the smaller clearing offset
  wins. If neither side clears, the arrow stays straight: a huge bow reads
  worse than the crossing.

The apply side (`apps/live/hooks/canvas/arrow-avoidance-apply.ts`) is a pure
elements map run through the gesture's own `commit`, so the bow lands inside
the same undo step as the draw: one Cmd-Z removes the arrow, not the bow.

## References

[spec/09](09-canvas-mvp.md) (arrows + curve handles),
[spec/50](50-arrow-to-arrow.md) (arrow-to-arrow connections),
[spec/62](62-mcp-server.md) / [spec/73](73-mermaid.md) (authoring paths that
own their geometry).
