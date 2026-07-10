# 80. Shift-drag duplicate

Status: shipped

## What

Holding **Shift** while dragging a selected element (or multi-selection /
group) duplicates it: release leaves the dragged elements at the drop
point, still selected, and fresh clones re-fill the spot where the drag
began. Visually it reads as "drag a copy away from the original", the
Alt-drag convention from Figma and friends, on Shift because Alt/Option
drag is browser-reserved territory on several platforms.

## Semantics

- **Decided at release**: Shift held on the pointer-up duplicates; the
  drag itself is a normal move throughout (same snapping, guides, frame
  sections). Pressing or releasing Shift mid-drag therefore just changes
  what the release does, and there is nothing to cancel.
- **What clones**: exactly the dragged set — the selection's members plus
  any follower arrows the move carried (a frame section's connectors),
  via the same `duplicateGroupedElements` machinery as the toolbar's
  Duplicate: fresh ids, groups remapped, internal connectors ride along,
  external pins stay pinned to the untouched outside elements.
- **One undo step**: the clone commit joins the move gesture's checkpoint,
  so Cmd-Z removes both the move and the clones together.
- **Only real moves**: a shift-click that never moved, or a drag dropped
  back exactly onto its origin, duplicates nothing.
- Shift keeps its existing meaning on RESIZE drags (aspect constraint);
  this applies to move mode only. Element drags only, not arrow-endpoint
  drags (Shift there chains arrows, spec/09).

## Telemetry

`Element / Duplicated / ShiftDrag` (spec/22).

## Implementation

`useEditorDrag`'s pointer-up: for a `boxed` move gesture with `shiftKey`,
compute the primary's delta from `drag.startBounds`, and commit
`duplicateGroupedElements(els, draggedIds, -dx, -dy)` clones back at the
origin. Listed in the shortcuts dialog beside the other drag modifiers.

## References

[spec/09](09-canvas-and-palette.md) (drag machinery, duplicate),
[spec/22](22-telemetry.md).
