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
  held swaps identities — the ORIGINAL elements park back at their start
  position (keeping their ids, so every arrow pinned to them stays
  attached to the stationary set), and a fresh CLONE set takes over the
  cursor, rendered as a translucent ghost (0.45 opacity, multiplied over
  any per-layer opacity). The selection follows the cursor set. Releasing
  Shift mid-drag dissolves the clones and hands the cursor back to the
  originals (a plain move); re-pressing re-materialises. The final
  keep/dissolve decision is made at pointer-up (Shift held + a real
  displacement keeps the clones, selected at the drop point). The drag
  itself stays a normal move throughout — same snapping, guides, frame
  sections.
- **Connections come along**: arrows linking the dragged set to the rest
  of the diagram (one end pinned to a dragged element, the other outside
  the set) are DUPLICATED onto the clone — the copy is wired the same way
  the original is (an incoming connector is drawn to both boxes after the
  drop). Internal both-ends-inside connectors ride along as before;
  group-pinned and on-arrow boundary connections stay with the original
  only.
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
- **Identity**: the STATIONARY set is the original (original ids, original
  arrow pins, untouched position); the elements at the drop point are the
  fresh-id clones. This is what keeps existing connections anchored to the
  original while the copy gets its own duplicated wiring.
- Shift keeps its existing meaning on RESIZE drags (aspect constraint);
  this applies to move mode only. Element drags only, not arrow-endpoint
  drags (Shift there chains arrows, spec/09).

## Telemetry

`Element / Duplicated / ShiftDrag` (spec/22).

## Implementation

`useEditorDrag`'s pointer-move: for a `boxed` move gesture with
`shiftKey`, build `duplicateGroupedElements(els, draggedIds, 0, 0)`
clones once (plus copies of boundary arrows, re-pinned via the returned
`idMap`), park the originals back at the start with
`translateBoxedSelection(..., 0, 0)`, and RE-KEY the live drag state to
the clone ids (same start bounds, so the dx/dy math continues
seamlessly); `dupSwapRef` holds the way back. The clone ids are exposed
as `shiftDupGhostIds`, which `CanvasElementsLayer` renders at reduced
opacity (multiplied over the layer-band opacity, for boxed elements and
arrows alike). Shift release mid-drag (or a no-move release) filters the
clones out, translates the originals to the cursor, and restores the
selection; a shift-drop just clears the swap bookkeeping. Everything
flows through the gesture's tick stream (one undo step; Escape's
cancel-to-checkpoint covers it). Listed in the shortcuts dialog beside
the other drag modifiers.

## References

[spec/09](09-canvas-and-palette.md) (drag machinery, duplicate),
[spec/22](22-telemetry.md).
