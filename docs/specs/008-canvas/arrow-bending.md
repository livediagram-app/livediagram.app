# Bending arrows and the double-press rule

Status: shipped

An arrow bends where you grab it. Pressing on the line and dragging reshapes the arrow at that
point, so there is no separate "+" target to find, and nothing sits in the middle of the line to be
hit by accident. A quick double-click anywhere on an arrow always edits its label, however fast it
is made.

## Terms

- **Line press**: a primary-button press on an arrow's hit band (not on a handle, not on its label).
- **Drag travel**: movement past the shared press tolerance (`isDragTravel`). Below it a press is a
  click.
- **Double-press**: two presses on the same element within the double-press window
  (`DOUBLE_PRESS_MS`) and close together. Detected by counting presses, not from the browser's
  `dblclick`, so touch and mouse behave the same.
- **Echo press**: a press that lands on a handle which only appeared because the previous press
  selected its element, and that together with that previous press forms a double-press.

## Drag to bend

A line press followed by drag travel bends the arrow. It works on an unselected arrow too: the press
selects it and the same drag bends it. A press without drag travel only selects. One drag is one
undo step.

- **Straight arrow**: becomes a curved arrow with one smooth bow that passes through the pointer,
  at the point along the line where it was grabbed. The bow is stored as `curveOffset`, the same
  field the curve handle writes.
- **Curved arrow with a single bow**: the bow reshapes so the curve passes through the pointer at
  the grabbed point.
- **Curved arrow with bend points** (`curvePoints`): grabbing a bend point's handle drags that point,
  as before. Grabbing the line elsewhere inserts a bend point where it was grabbed, in the segment
  it was grabbed on, and drags it.
- **Angled arrow**: the grabbed segment slides sideways, keeping its direction. When the grabbed
  segment touches an endpoint, a short connecting segment is inserted so the endpoint stays where it
  is. The result is stored as angled bend points (`curvePoints`).

The grabbed point is held a little way in from each end, so grabbing right beside an arrowhead does
not produce a violent bow.

The curve and elbow handles stay: they are the precise controls. The "+" add-point handles are
removed. Right-clicking a bend point still deletes it, and deleting the last one still reverts the
arrow to a straight line.

## Moving and scaling a free arrow

An arrow whose two ends are both free (attached to nothing) no longer moves by dragging its line,
because dragging the line bends it. When selected, a free arrow wears a box's selection: the same
brand ring round its drawn extent (padded clear of its endpoint grips), and the same corner and edge
handles.

- Dragging the ring moves the whole arrow. Its interior is not a drag target, so elements inside it
  stay clickable.
- Dragging a handle scales the arrow the way it would resize a box: the opposite corner or edge
  stays put, and the ends and bends stretch to follow. Shift on a corner keeps the proportions. An
  arrow never flips or collapses through itself.
- An axis with no extent (a perfectly horizontal or vertical arrow) shows no edge handles for it,
  since there is nothing to scale.
- Arrow keys still nudge a selected free arrow. Arrows with an attached end have no frame, as
  before, since they follow their elements.

## The double-press rule

A fast double-click on an element must mean "edit this element", never "operate whatever appeared
under the pointer after the first click". So:

- An echo press never starts its handle's gesture (no endpoint drag, no curve drag, no elbow drag, no
  move-frame drag). It is treated as the second press of a double-press on the element the handle
  belongs to, which opens that element's label editor where the element has one.
- The second press of any double-press never starts a drag, even if the pointer wobbles past the
  drag tolerance between the two presses.
- A handle that was already visible before the first press is not an echo target: a deliberate
  press on a handle of an already-selected arrow works immediately.

This applies to arrows and to the selection handles of boxed elements alike.
