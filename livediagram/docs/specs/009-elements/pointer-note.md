# The pointer note

## What

A **Pointer note**: a short note joined by a leader line to a point it is about. The line's tip can attach to one of
the points an arrow pins to on another element (its connector anchors), and then the note travels with that element,
so "stale here" keeps pointing at the right place when the diagram moves. A `shape: 'pointer-note'`.

## Why

An annotation that explains one spot of a diagram is today a sticky and a loose line: the line is not pinned to
anything, so the first time the node moves the note points at empty canvas. An arrow pins to anchors, but a note box
and an arrow are two elements to place, style and keep together, and an arrow ends in a head where an annotation wants
a quiet dot.

## The element

- **The note** is the element's box: a soft panel in the warm note colours (an amber border and a pale amber wash by
  default), its text the element’s label, centred both ways at the small size (owner, 2026-11-19; top-left until then). Double-click edits it like any label,
  rich text included.
- **The leader** runs from the note's nearest edge point to the **tip**, a small solid dot in the border colour. Its
  line is the border colour at 1.5 px.
- **The tip** is stored relative to the note's top-left (`pointerTip: { x, y }`), so moving the note on its own moves
  the tip with it unless the tip is attached.
- **Size**: a new note is 180 × 64 with its tip 56 px below its bottom-left corner and 24 px to the left. The note is
  resized like any box; the tip keeps its place.
- **It does not rotate**: the tip is pinned to a point on the board, and turning the note would swing its leader off
  that point. The menu has no Rotation for it (nor a multi-selection of only pointer notes), the Rotate commands skip
  it, and a turn written on one (by an agent, or an old copy) is dropped where elements enter, so its arrows,
  handles, hit tests and every export see it upright too.

## Attaching the tip

While the note is selected its tip shows a **handle**. Dragging the handle moves the tip; while it is near an element
that element shows the **same anchor dots an arrow shows** (the sixteen around a box, the compass eight on a circle or
diamond, on the shape's real outline), the one in reach highlighted. Letting go within 16 px of an anchor attaches the
tip there (`attachedTo` and `pointerAnchor`, an arrow end's anchor; `attachAt` keeps the nearest of the badge's eight
points for older readers), and letting go anywhere else leaves it free. (Owner, 2026-11-19: until then the tip took
only the badge's eight box points, which on a circle or diamond sit in empty space.)

- **Attached**, the tip is held on its point: moving, resizing, rotating or laying out the host carries the note with
  it, keeping the note's place relative to the tip. Moving the note itself keeps the tip on the host and moves it to
  the middle of the host's side facing the note when the move ends (a corner only where that side has no middle) (through the drag it holds its original point), as an arrow's end turns to face what it joins (owner,
  2026-11-19); the leader re-runs.
- **Deleted, copied, duplicated** with its host, as an attached badge is; copying or deleting the note on its own does
  just that, and a pasted lone note is detached.
- A host that no longer exists (a peer deleted it) leaves the note where it is, its tip free.
- A badge attached to a note follows the note where it lands: the notes settle first, so a note carried by its
  host never leaves its badge on the note's old point.

The settling is the badge's: one pure step at the editor's commit point keeps the stored geometry true, so an export
or an API reader that knows nothing of attachment draws the note and its leader in the right place.

## Menu

No section of its own (owner, 2026-11-19: the Pointer Note section and its Detach went): dragging the tip off its
host detaches it. Colours, Border (width, pattern) and the Text controls work as on any shape; the leader takes the
border colour.

## Animation

A pointer note takes the **Shape** set for its box and the **Text** set for its words; the leader is part of the face,
so a motion such as Bounce carries it. With **Pulse**, the tip pulses too: a ring expands from the dot, drawing the eye
to the spot the note is about. CSS only; reduced motion and every export show the rest frame.

## Palette

| Mode     | Where                                     |
| -------- | ----------------------------------------- |
| Diagram  | **Write**: Pointer Note, after Annotation |
| Workshop | **Write**: Pointer Note                   |

## Share roles

| Role        | May                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------- |
| Editor      | Everything above                                                                         |
| Participant | Write a note's text, as on any element; cannot place, move, point, attach or restyle one |
| Viewer      | Look                                                                                     |

## Agents

The MCP server and the REST API take `pointer-note` with `label`, `pointerTip` and `attachedTo` with `pointerAnchor`
(an anchor, as an arrow end's) or `attachAt` (a badge point); an agent sets the host and point and the editor places
the note's tip on it when the board next loads. `pointerAnchor` wins when both are set.
