# 80. Shift-drag duplicate

Status: shipped

## What

Holding **Shift** while dragging a selected element (or multi-selection /
group) duplicates it: the original visibly **stays in place** while a
**translucent ghost** of the set follows the cursor; release solidifies
the ghost at the drop point (still selected) with the original untouched
where the drag began. The Alt-drag convention from Figma and friends, on
Shift because Alt/Option drag is browser-reserved territory on several
platforms.

## Semantics

- **Live ghost, decided at release**: the first pointer-move with Shift
  held materialises a copy of the drag set back at its start position
  (the "original" the user sees staying put) and flips the dragged set
  into ghost rendering (0.45 opacity, multiplied over any per-layer
  opacity). Releasing Shift mid-drag dissolves the copy and restores a
  plain move; re-pressing re-materialises. The final keep/dissolve
  decision is made at pointer-up (Shift held + a real displacement keeps
  the copy). The drag itself stays a normal move throughout — same
  snapping, guides, frame sections.
- **Coexists with shift-click multi-select**: a shift press on an element
  that is NOT part of the selection stays the immediate toggle (add to
  the set, no drag). On a SELECTED element (single selection or a
  multi-select member) the toggle is deferred: the press starts a normal
  move drag, and only a release that never travelled (a true shift-click,
  within the 4 px engage threshold) applies the toggle. So shift-click
  still curates the selection, and shift-drag duplicates it.
- **What clones**: exactly the dragged set — the selection's members plus
  any follower arrows the move carried (a frame section's connectors),
  via the same `duplicateGroupedElements` machinery as the toolbar's
  Duplicate: fresh ids, groups remapped, internal connectors ride along,
  external pins stay pinned to the untouched outside elements.
- **One undo step**: the copies are materialised (and dissolved) through
  the gesture's own tick stream, so Cmd-Z removes both the move and the
  clones together, and Escape's cancel-to-checkpoint restore wipes them
  with the rest of the gesture.
- **Only real moves**: a shift-click that never moved, or a drag dropped
  back exactly onto its origin, duplicates nothing (the pointer-up
  dissolves the materialised copy).
- **Identity**: the elements at the DROP point keep their original ids
  (they are the dragged originals); the stationary set is the fresh-id
  clone. Visually indistinguishable; a plain move plus a copy left
  behind.
- Shift keeps its existing meaning on RESIZE drags (aspect constraint);
  this applies to move mode only. Element drags only, not arrow-endpoint
  drags (Shift there chains arrows, spec/09).

## Telemetry

`Element / Duplicated / ShiftDrag` (spec/22).

## Implementation

`useEditorDrag`'s pointer-move: for a `boxed` move gesture with
`shiftKey`, tick `duplicateGroupedElements(els, draggedIds, backDx,
backDy)` copies at the start position once (tracked in `dupCloneIdsRef`)
and expose the dragged ids as `shiftDupGhostIds`, which
`CanvasElementsLayer` renders at reduced opacity (multiplied over the
layer-band opacity, for boxed elements and follower arrows alike). Shift
release mid-drag filters the copies back out; pointer-up keeps or
dissolves them and clears the ghost state. Listed in the shortcuts
dialog beside the other drag modifiers.

## References

[spec/09](09-canvas-and-palette.md) (drag machinery, duplicate),
[spec/22](22-telemetry.md).
