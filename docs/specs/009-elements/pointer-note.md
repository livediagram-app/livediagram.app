# The pointer note

## What

A **Pointer note**: a short note joined by a leader line to a point it is about. The line's tip can attach to one of
the eight points of another element ([The badge](badge.md) "Attachment"), and then the note travels with that element,
so "stale here" keeps pointing at the right place when the diagram moves. A `shape: 'pointer-note'`.

## Why

An annotation that explains one spot of a diagram is today a sticky and a loose line: the line is not pinned to
anything, so the first time the node moves the note points at empty canvas. An arrow pins to anchors, but a note box
and an arrow are two elements to place, style and keep together, and an arrow ends in a head where an annotation wants
a quiet dot.

## The element

- **The note** is the element's box: a soft panel in the warm note colours (an amber border and a pale amber wash by
  default), its text the element's label, top-left aligned at the small size. Double-click edits it like any label,
  rich text included.
- **The leader** runs from the note's nearest edge point to the **tip**, a small solid dot in the border colour. Its
  line is the border colour at 1.5 px.
- **The tip** is stored relative to the note's top-left (`pointerTip: { x, y }`), so moving the note on its own moves
  the tip with it unless the tip is attached.
- **Size**: a new note is 180 × 64 with its tip 56 px below its bottom-left corner and 24 px to the left. The note is
  resized like any box; the tip keeps its place.
- **It does not rotate**: the tip is pinned to a point on the board, and turning the note would swing its leader off
  that point. The menu has no Rotation for it, the Rotate commands skip it, and a turn stored on one (by an agent) is
  drawn upright.

## Attaching the tip

While the note is selected its tip shows a **handle**. Dragging the handle moves the tip; letting go within 16 px of
one of another element's eight points attaches it there (`attachedTo` / `attachAt`, the badge's fields and hosts),
and letting go anywhere else leaves it free.

- **Attached**, the tip is held on its point: moving, resizing, rotating or laying out the host carries the note with
  it, keeping the note's place relative to the tip. Moving the note itself leaves the tip on its point and the leader
  re-runs.
- **Deleted, copied, duplicated** with its host, as an attached badge is; copying or deleting the note on its own does
  just that, and a pasted lone note is detached.
- A host that no longer exists (a peer deleted it) leaves the note where it is, its tip free.

The settling is the badge's: one pure step at the editor's commit point keeps the stored geometry true, so an export
or an API reader that knows nothing of attachment draws the note and its leader in the right place.

## Menu

A **Pointer Note** section (Tools flyout), closed until opened: **Detach** while the tip is attached. Colours, Border
(width, pattern) and the Text controls work as on any shape; the leader takes the border colour.

## Animation

A pointer note takes the **Shape** set for its box and the **Text** set for its words; the leader is part of the face,
so a motion such as Bounce carries it. With **Pulse**, the tip pulses too: a ring expands from the dot, drawing the eye
to the spot the note is about. CSS only; reduced motion and every export show the rest frame.

## Palette

| Mode       | Where                                     |
| ---------- | ----------------------------------------- |
| Diagram    | **Write**: Pointer Note, after Annotation |
| Illustrate | **Write**: Pointer Note                   |
| Plan       | none                                      |
| Facilitate | **Write**: Pointer Note                   |

## Share roles

| Role        | May                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------- |
| Editor      | Everything above                                                                         |
| Participant | Write a note's text, as on any element; cannot place, move, point, attach or restyle one |
| Viewer      | Look                                                                                     |

## Agents

The MCP server and the REST API take `pointer-note` with `label`, `pointerTip` and `attachedTo` / `attachAt`; an agent
sets the host and point and the editor places the note's tip on it when the board next loads.
