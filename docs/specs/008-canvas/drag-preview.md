# Drag preview

While someone moves, resizes or reshapes elements, the canvas shows the elements where the pointer
puts them without changing the document. The document changes once, when the gesture ends. Everyone
else in the room sees the movement live, as a preview, and the real change when it lands. This keeps
a drag's cost to what it moves, whatever the size of the board
([Canvas performance](canvas-performance.md)).

## The preview

- **A gesture draws from a preview, not the document.** A move, a resize or an arrow reshape (a
  bend, a curve, an elbow, an end, a label) keeps the gesture's elements as they would be after it,
  in a preview beside the document. The canvas draws an element from the preview when it has one,
  else from the document. Nothing in the document changes until the gesture ends.
- **It covers what the gesture changes:** the dragged elements, and every arrow whose drawing
  depends on them (pinned to them, or routed behind them). Nothing else is redrawn while it lasts.
- **Everything derived from the board stays as it was** while the preview lasts: the element index,
  the element grid, the arrow labels of arrows the drag does not touch, the Map (which already holds
  its drawing through a gesture, [Minimap](minimap.md)), the selection chrome (already hidden while
  the selection moves). Alignment guides and snapping read the document, which is the board
  without the dragged elements' movement, as they do today.
- **On release the preview becomes the document in one change**: one undo step, one autosave,
  one set of element ops to the room, as a drag makes today.
- **What the release adds is part of that change.** A freshly drawn arrow's collision bow
  ([Arrow collision avoidance](arrow-collision-avoidance.md)) is applied to the preview before it
  is written, not written after it: a later write through `commit` starts from the document as
  last rendered, before the release has landed, and put a quick-connect arrow's end back at its
  start.
- **A cancelled gesture leaves the document untouched**: Escape, the browser cancelling the
  pointer, or the canvas going away drops the preview, and nothing is written.

## Live movement for collaborators

- **The dragger's preview goes to the room as presence**: ephemeral, unordered, never logged or
  replayed, like a cursor. At most one message every 33 ms (the cursor's rate), carrying the tab,
  and for each previewed element only what the gesture changes (position and size for a box; the
  changed geometry for an arrow). A last message says the preview has ended, and whether the
  gesture landed or was cancelled.
- **A collaborator draws a peer's preview the same way** the dragger draws their own: those elements
  from the preview, the rest of each element as the collaborator has it, nothing written. A
  cancelled gesture's preview ends on its end message; a landed one is kept until the peer's real
  change arrives (which follows the release by the autosave's wait), so the elements never jump back
  to where they started. Either way it also ends when the peer leaves, or after 2 s without a
  message. In every case the
  canvas falls back to the document.
- **Only an editor's preview is drawn.** The room relays a preview only from an editor, and a
  collaborator draws one only from an editor: other presence travels from any role, and a preview
  must never let a viewer make others' elements appear to move.
- **Two people dragging the same element** each see their own preview. Whoever releases last wins,
  as two edits to one element do today ([Realtime conflict
  resolution](../012-collaboration/realtime-conflict-resolution.md)).
- **A real change arriving mid-gesture** for an element being dragged updates the document beneath
  the preview; the release then writes the dragged result over it, as today.

## What does not change

- Snapping, alignment guides, the Shift constraints, lanes, the insert-between preview,
  Shift-duplicate and the aspect lock behave as they do; they work from the preview instead of a
  written document.
- Keyboard nudges are not gestures: each writes the document at once, as today.

## Observability

- `[drag-preview] begin` / `commit` / `cancel` (debug) with the gesture and element count.
- `[drag-preview] peer ignored` (debug) for a preview dropped because its sender may only view.
- `[drag-preview] peer expired` (debug) for a peer preview that went silent.

## Non-goals

- Smoothing or interpolating a peer's movement between messages.
- Showing who is dragging beyond what the cursor and selection presence already show.
