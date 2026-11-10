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
  depends on them (pinned to them, or routed behind them). Nothing else is redrawn while it lasts:
  not the canvas, and not the layer that holds the elements, only each previewed element itself,
  and not even that for what only moves ("Moves ride an offset").
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

## A dragged element keeps its look

An element looks exactly the same while it is dragged as at rest: the same fill, outline, words, header band and
opacity, in every theme, finish and appearance. Only the selection's own chrome (its outline and grips) shows that it is
in hand.

- **The canvas draws each element as seen**, not as stored: a theme's colours in the viewer's light or dark half
  ([Light and dark](../011-theme/light-and-dark.md)), stock colours for the canvas, a label re-inked against what is
  behind it. A gesture works on the stored elements, so the preview carries the stored colours.
- **So the preview is drawn as the canvas draws the element at rest**: each element the gesture changes takes its look
  from the element as drawn, and only what the gesture changed (its place, its size, its ends, or a colour the gesture
  itself set) from the preview. One rule, in the shared preview the element layer, the selection chrome and every other
  reader draw from (`@liveworkspace/workbench/lib/drag-look`), so no reader can draw a dragged element another way.
- **An element the gesture adds** (a Shift-drag copy, a quick-connect arrow) has no look at rest yet: it is drawn
  through the canvas's own projection, as it will be once dropped. A Shift-drag copy is still translucent while in hand
  ([Shift-drag duplicate](shift-drag-duplicate.md)): that is the copy, not the element dragged.
- **A move that only shifts elements then differs from the drawn board in position alone**, so it rides its offset
  ("Moves ride an offset") in every theme, instead of redrawing each themed element on every frame.
- **The document is unchanged by it**: what the release writes is the stored elements the gesture made, never the
  colours a viewer's half drew them in.
- **Before:** a light theme on a dark screen (or a dark theme on a light one) drew every dragged element in its stored,
  other-half colours until it was dropped: an indigo entity on a dark canvas turned pale indigo, and back, on every
  drag. Elements drawn as stored (the Default theme, stickies) never showed it, which is why it looked fixed.

## Moves ride an offset

A move only shifts elements, so drawing it needs no element drawn again: a moved element looks as
the document has it, somewhere else.

- **An element the preview only translates rides an offset.** A box whose only change is its
  position, by any amount, keeps the drawing the document gave it, and the page shifts it by that
  amount (a CSS `translate`, written straight to its nodes, outside React). So does an arrow whose
  ends both move by the same amount: pinned to elements riding the same offset, or free ends the
  gesture shifted. The element's grips, which sit in the grips layer above every element, ride the
  same offset. A frame of a move then renders no element view at all, however many it moves.
- **Each element rides its own offset**, so a collaborator's drag and ours, moving different
  elements by different amounts at once, both ride.
- **Only the arrows between the moved and the unmoved re-route**: an arrow with one end on a moved
  element and the other not, an arrow that stays put but that a moved box crosses where it was or
  where it went, and an arrow riding on one of those, are drawn from the preview frame by frame, as
  before. Nothing else is redrawn.
- **What rides is drawn as it was**, so its gaps where an unmoved box crosses it, and an arrow
  label's place, catch up on release, not frame by frame. The gaps between moved elements move with
  them, as they should.
- **A stack's children do not ride**: they glide when their stack reflows, and a glide would replay
  as the offset is dropped; they are drawn from the preview, as before.
- **The offset is dropped as the document changes**: on release, in the same paint as the elements
  drawn at their new place, so nothing jumps back; on a cancel, before the next paint. An element
  that stops only translating mid-gesture (a resize, a rebind turning an arrow end) leaves the offset
  and is drawn from the preview.
- **Offsets are kept to a thousandth of a pixel**, so the elements of one move share one offset
  exactly (each is its new place less its old one, which floating point makes differ in the last
  bits), and an arrow between two of them rides with them instead of re-routing.
- **The same as livediagram's**: the offset is written by the workbench's ride writer and found by
  its ride rules (`@liveworkspace/workbench`), so the two editors ride alike.

## A very large move rides as one layer

Shifting each element costs the page a restyle and repaint of every node it shifts, which is what a
whole-board drag of thousands of elements spends its frame on. So a very large move shifts the
elements' layer instead.

- **The layer that holds the elements carries the offset most of them share**, when at least 200
  of them share it and they are more than half of what the layer holds. It moves as one
  transform, the way a pan moves the canvas, so a frame of the move restyles the layer and what
  does not share the offset, not every element. It is not promoted to a compositor layer of its
  own: that split everything overlapping it into layers that were laid out again on every frame,
  and drew the elements' text without sub-pixel smoothing, so the drag would not look the same.
- **The layer always has a box of its own**, the canvas's, whether or not it carries a move: picking
  the move up and putting it down changes only its transform, so it lays out none of the elements
  again. The box takes no press of its own: a press between the elements reaches the canvas, and
  the canvas's cursor shows there, as before; the elements take presses as they always did, and
  none while the canvas is inert (Spotlight).
- **What does not share it is held where it should be**: an element that does not move, an arrow
  that re-routes, a stack's child, or one riding another offset (a collaborator's) is shifted back
  by the difference, so it is drawn exactly where it was drawn before.
- **Nothing else changes**: every element stays in its place in the layer, so paint order holds;
  the grips layer's grips are carried the same way.
- **The offset goes as it does for a smaller move**: dropped on release in the same paint as the
  elements drawn at their new place, and on a cancel before the next paint.
- **Below that size each element rides its own offset**, as above: few nodes are written anyway.
- **Collaborators see a very large move on release**, as before: a gesture changing more than 200
  elements sends no patches ("Live movement for collaborators"), and the editor does not send
  livediagram's one-offset ride.

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

- Snapping, alignment guides, the Shift constraints,
  Shift-duplicate and the aspect lock behave as they do; they work from the preview instead of a
  written document.
- Keyboard nudges are not gestures: each writes the document at once, as today.

## Observability

- `[drag-preview] begin` / `commit` / `cancel` (debug) with the gesture and element count.
- `[drag-preview] ride` (debug) with how many elements ride an offset, and how many layers carry
  it, when that number changes.
- `[drag-preview] peer ignored` (debug) for a preview dropped because its sender may only view.
- `[drag-preview] peer expired` (debug) for a peer preview that went silent.

## Non-goals

- Smoothing or interpolating a peer's movement between messages.
- Showing who is dragging beyond what the cursor and selection presence already show.
