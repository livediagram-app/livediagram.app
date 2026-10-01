# The Comment Panel

A **Collaborate** element: a card on the canvas carrying a whole comment thread —
its count, the comments, a composer, and resolve / reopen — read where it sits
rather than opened.

(Filed as 136-comment-pin.md, and the shape kind is still `comment-pin`, from
the marker this started as. "Why not the pin" below has the reason it changed;
the id stays so saved documents keep loading.)

## Why an element at all

Comments already work. Every element can carry a `commentThread` ([Canvas and palette](../008-canvas/canvas-and-palette.md)), and
the popover, composer, resolve / unresolve, author badges, realtime plumbing
and persistence all run against that field.

What was missing was somewhere to attach a remark that is about a **place**
rather than about a shape: an empty patch of canvas, the gap between two
clusters, the spot where something should go. Without one, that remark has to
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

`CommentPanelFace` is therefore a glyph and a click handler. If it ever grows a
second way to store a comment, that is the bug.

## A panel, joined by an arrow

The element is a **card on the canvas**, not a marker.

- It shows the thread: a header, the comments, a composer, and resolve /
  reopen.

### The look

Built from the same parts as the modern Collaborate cards (the Q&A board, the
Idea box; [Idea box](idea-box.md) "The look"): the tab theme's **accent**
(`CollabAccentScope`), the shared `CollabPanel` frame and the shared composer.
It carries **no `…`**: it has no settings of its own, every act is on the card,
and right-click opens the ordinary element menu.

- **Header**: the element's label, or **Comments** when it has none. Its
  top-right slot holds the thread's other act: a **Resolve** chip (a check in
  the accent) once there is a thread, or a green **Resolved** chip once
  resolved. No count: the bubbles already show how many there are.
- **The thread reads as a conversation.** Each comment is a bubble under its
  author's initial (in their identity colour) and name, with the relative
  time. Your own comments sit on the right in an accent-tinted bubble;
  everyone else's sit on the left in a neutral one. Consecutive comments by
  the same author group under one name. A comment that arrives while the card
  is on screen settles in (the Q&A board's enter motion), and the thread keeps
  the newest in view. Your own comments carry a small delete on hover.
- **Empty**: a speech-bubble glyph in a soft accent disc, **Start the
  Conversation**, and "Replies stay on the canvas for everyone to read."
- **Composer**: the shared rounded field with the round accent send button
  (Enter sends).
- **Resolved**: the thread softens, the composer gives way to a dashed accent
  bar, **Reopen Thread**, and the header shows the green **Resolved** chip.
- **Read-only** surfaces show the thread with no composer and no resolve.
- **Export** draws the header (with **Resolved** once resolved) and the newest
  comments as bubbles with their authors (`svg-render-faces.ts`), so the card reads the same in a PNG.
- **It does not collapse.** A collapse-to-summary was built and then dropped: a
  panel you have deliberately put on the canvas is there to be READ, and folding
  it left an element whose whole purpose sat behind another click. "I don't
  want to see this right now" is already answered by the anchored popover —
  you simply don't add a panel.

**Attached with an ordinary arrow.** A panel that is _about_ an element is
joined to it with a normal pinned arrow, drawn the way any arrow is: "about"
is what an arrow already says on this canvas. Not a bespoke link: a second
kind of connection would be a second thing to lay out, export and explain.
It also means the pair behaves like anything else — move the element and the
arrow follows; delete the arrow and the panel is a note that floated free.
The panel is added from the palette's Collaborate category only. The
element menu's Collaborate section once offered a `Comment Panel` tile that
dropped the panel and the arrow in one go; it was removed, since a second
way in from every element's menu was one more tile to read past on the way
to the thread (the menu keeps `Add Comment`, the anchored popover).

### Why not the pin

The first version was a standalone marker: a dot with a leader line that opened
the ordinary anchored popover. It was replaced because a popover is **one
reader's transient view**. A panel connected to what it is about sits on the
canvas, in the export, and in everyone's session, which is what makes a remark
part of the document rather than a note somebody left.

It also means the shape is no longer self-painting: as a 40px bubble it drew
itself, and as a card it wants the fill, border and rounded corners every other
card gets.

## Registration notes

- **Self-painting** (`SELF_PAINTING_SHAPES`): the bubble is the element, so the
  wrapper draws no box behind it — a square framing a speech bubble reads as a
  shape somebody drew.
- **Excluded from `isSvgRenderedShape`**, which is allow-by-default: a new
  CSS-drawn kind left off that list renders as a transparent nothing.
- **Keeps its own colours** (the Behaviour set in `themes.ts`): a pin is canvas
  chrome, not a node in the tab's theme.
- **Aspect-locked and square by default**, 40×40. A stretched pin reads as a
  shape rather than a marker.
- **Not votable** ([Session tools (timer + voting)](session-tools.md)): a comment pin IS a remark, so a dot on one means
  nothing.
