# 136 — The Comment Pin

A **Collaborate** element: a marker you drop anywhere on the board that opens a
comment thread.

## Why an element at all

Comments already work. Every element can carry a `commentThread` (spec/09), and
the popover, composer, resolve / unresolve, author badges, realtime plumbing
and persistence all run against that field.

What was missing was somewhere to attach a remark that is about a **place**
rather than about a shape: an empty patch of canvas, the gap between two
clusters, the spot where something should go. Without a pin, that remark has to
be hung on whichever shape happens to be nearest, which changes what it means.

## It reuses the existing wiring, entirely

The pin introduces **no comment machinery of its own**. It is an element whose
only job is to hold a `commentThread`, so:

- Clicking it calls the same `onOpenComments(element.id)` an ordinary element's
  comment badge calls, and opens the same popover.
- Comments are written through the same composer, stored in the same field,
  counted by the same `activeCommentCount`, and survive undo through the same
  `LIVE_ELEMENT_FIELDS` grafting that keeps `Cmd+Z` from eating a comment.
- Resolve / unresolve, author identity and the API redaction of `authorId` all
  apply unchanged.

`CommentPinFace` is therefore a glyph and a click handler. If it ever grows a
second way to store a comment, that is the bug.

## A panel, joined by an arrow

The element is a **card on the board**, not a marker.

- It shows the thread: a header with the count, the comments, a composer, and
  resolve / reopen.
- **It does not collapse.** A collapse-to-summary was built and then dropped: a
  panel you have deliberately put on the board is there to be READ, and folding
  it left an element whose whole purpose sat behind another click. "I don't
  want to see this right now" is already answered by the anchored popover —
  you simply don't add a panel.

**Attached with an ordinary arrow.** `Collaborate › Comment Panel` on any
element drops a panel clear to its right and pins a normal arrow from the
element to it. Not a bespoke link: the panel is _about_ the element, and
"about" is what an arrow already says on this canvas. A second kind of
connection would be a second thing to lay out, export and explain. It also
means the pair behaves like anything else — move the element and the arrow
follows; delete the arrow and the panel is a note that floated free.

### Why not the pin

The first version was a standalone marker: a dot with a leader line that opened
the ordinary anchored popover. It was replaced because a popover is **one
reader's transient view**. A panel connected to what it is about sits on the
board, in the export, and in everyone's session, which is what makes a remark
part of the diagram rather than a note somebody left.

It also means the shape is no longer self-painting: as a 40px bubble it drew
itself, and as a card it wants the fill, border and rounded corners every other
card gets.

## Registration notes

- **Self-painting** (`SELF_PAINTING_SHAPES`): the bubble is the element, so the
  wrapper draws no box behind it — a square framing a speech bubble reads as a
  shape somebody drew.
- **Excluded from `isSvgRenderedShape`**, which is allow-by-default: a new
  CSS-drawn kind left off that list renders as a transparent nothing.
- **Keeps its own colours** (the Behaviour set in `themes.ts`): a pin is board
  chrome, not a node in the diagram's colour scheme.
- **Aspect-locked and square by default**, 40×40. A stretched pin reads as a
  shape rather than a marker.
- **Not votable** (spec/39): a comment pin IS a remark, so a dot on one means
  nothing.
