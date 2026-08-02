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

## The face

A speech bubble with its tail at the **bottom-left**, so the point marks the
spot rather than the middle of the bubble marking it.

- **Empty** pin shows `…` — zero comments is not a count, it is an invitation.
- With comments, it shows the **active count**.
- A **resolved** thread shows `✓` at 45% opacity. The pin stays on the board
  rather than disappearing: comments come back on unresolve, and a pin that
  vanished would take the reason for the conversation with it.

The generic comment badge is **suppressed** on a pin (`commentCount` forced to
0 in `BoxedElementView`): the pin is the badge, and two counts on one 40px
marker is one too many.

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
