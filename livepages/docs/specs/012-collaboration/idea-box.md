# Idea box

Status: **implemented**.

A box anyone can drop a card into **without their name going on it**, held
closed until the facilitator opens it.

## Why

Brainwriting, pre-mortems, retro round one and "what is nobody saying" all
depend on the same thing: an idea that cannot be traced to the person who had
it. A sticky note can't do this — the author's cursor was sitting on it as
they typed.

## Anonymity is structural

The element has **nowhere to put an author**. Not an author field left blank,
not an author field the UI hides: `ideaCards` is a list of strings, and its
companion `ideaCardIds` is a list of random ids minted by whichever browser
posted each card (see [Posting at once](#posting-at-once)). An id is a fresh
random UUID per card, so it names the card, never the person: nothing about
it ties two cards to one poster.

That matters because every other route to a name is one refactor away from
being reintroduced. The two that had to be closed deliberately:

- **The change log** (since removed with the Activity panel, 2026-10-03, which
  closes this leak for good). Adding a card committed the element WITHOUT a log
  entry: an entry saying "Priya edited Idea Box" beside six anonymous cards is a
  five-second deanonymisation.
- **The selection lock.** Adding a card does not select the element, so the
  [Live app](../007-editor/live-app.md) concurrent-selection highlight doesn't put a coloured ring and a name
  on the box at the moment somebody types into it.

### The limit, stated plainly

This is anonymity **against the other people in the room**, not against a
determined observer. The `el` op that carries the new card is rebroadcast with
the sender's participant id in the envelope (`from`), because the room adds it
to every frame — so a peer reading their own devtools can tell who submitted
what. Closing that would mean relaying idea submissions through a separate
unattributed path, which is a second sync route for one element.

The same honesty [Live poll (ephemeral pulse-check)](live-poll.md) applies to the poll's costs applies here: the feature
is worth having with this limit, and the limit is written down.

## The element

A **shape kind**, `idea-box`. Its `label` is the prompt ("What might go
wrong?"). It arrives at 340x420, tall enough for its empty state above the
composer, and like the Q&A board it reflows: resizing makes room for more ideas
rather than bigger ones.

- **`ShapeElement.ideaCards`** — the submissions, in submission order. Bounded
  in `validate.ts` like every other list field.
- **`ShapeElement.ideaCardIds`**: each card's id, by position: `ideaCardIds[i]`
  names `ideaCards[i]`. Optional and back-compatible: a box from before ids,
  a card a template or a poll capture put in, or one the room's ledger
  restored has no id (the entry is missing or `''`), and is still a card.
  Same bound as `ideaCards`; each id at most 64 characters.
- **`ShapeElement.ideasRevealed`** — shared, false by default.

## Posting at once

Two people posting in the same second both land: a card travels as one
`idea` delta ([Collaboration race hardening](collab-race-hardening.md)), with no author on the wire either, and a peer's
whole-element update never replaces the box's cards unless it empties the
box (a new round). A full box (`IDEA_MAX_CARDS`, 300) refuses the next card at
the press, and the composer says so: at the cap its field reads **Box is full**
and is off, and a post refused because the box filled meanwhile (as this
viewer's copy shows it) keeps its draft rather than throwing the text away.

**Racing for the last card.** Two posts can both pass the press check when the
box holds 299: each poster's own copy takes their card at once. The room
decides between them by its order: it numbers every delta it relays, answers
each sender with the number its own delta took (the `cursor` frame), and every
browser applies the room's deltas in that order, so in every copy but the
second poster's the first card is the 300th and the second is refused on
apply. The second poster's copy settles the same way:

- A browser holds its own idea posts as **pending** from the press until the
  room answers that post's cursor.
- A peer's card that reaches a full box while one of this browser's own posts
  to it is pending was numbered before that post (the room relays the peer's
  card before it reads, numbers and answers the later one, and a socket keeps
  its frames in order). So the peer's card goes in and this browser's newest
  pending card comes out, found by its id: the box ends exactly as every other
  copy has it.
- The poster is told, as on the [Q&A board](qa-board.md): the toast says
  **The box filled up before your idea landed.**, and the draft goes back in
  the composer (unless something new was typed there meanwhile), where the
  full box now reads **Box is full** with the field off.
- A post the room answered, or one that never reached it (no live room, a
  dropped socket, no answer within the room's acknowledgement timeout), stops
  being pending and is never taken back: a peer's card that reaches a full box
  after that was numbered later, and is the one refused.
- A pending card that leaves the box any other way (the box was emptied for a
  new round, or deleted) is not a refusal and says nothing.

The ledger and the D1 copy agree: the room's ledger records ideas in the same
order, and a save merged with it appends the first card and refuses the second
at the cap. An Editor whose copy still held the refused card when it saved
saves again once the card comes out, and the merge restores the peer's card.

Share roles: an Editor and a Participant post, and either may be the poster
whose card comes out; a Viewer cannot post, so never has a pending card.

## Closed and open

**Closed**, the box shows the prompt, a count, and the composer. Not the text,
not even to the person who wrote one: a box that shows you your own card tells
the room what you wrote the moment someone watches you type it.

**Open**, the ideas render as rows in submission order, and the composer stays:
an idea after the reveal is still an idea.

## The look

Built from the [Q&A board](qa-board.md)'s parts, so the two read as one family,
not two eras ([Participant responses](participant-responses.md): the paper kit is being retired). It
replaced a cardboard carton (a lid with a lip, a slot, a corrugated body, and a
blank card drawn caught in the slot whenever the box held anything). That card
was the worst of it: it appeared the moment an idea went in, looked like a
sticky note, and could not be read or restyled, because it was a drawing with
nothing written on it.

- **Accent.** The tab theme's accent, from the element's themed stroke, with
  the ink that reads on it, exactly as the Q&A board does (one shared accent
  scope). An unstyled box follows light and dark with the rest of the canvas.
- **The composer is at the foot**, where people add from, as on the Q&A
  board, and it is the same composer: a rounded field with a send button in
  the accent. Where the Q&A board has an Anonymous switch, the idea box shows a
  fixed **Anonymous** chip: there is nothing to switch, and saying so at the
  point of writing is the reassurance the element exists to give. Enter posts;
  a counter appears near the limit.
- **Closed** is a sealed panel, not an object: a lock in the accent, the count
  large ("6 ideas sealed"), and "Hidden from everyone until the box is opened".
  When an idea lands the count pops and lifts a +1, the Q&A board's vote
  motion, so the room sees the box fill without seeing a word.
- **Empty**, the Q&A board's empty state, shared: faint rows that breathe,
  and spaced well below them a small invitation, a sparkle in the accent over
  a title ("Nothing in the box yet") and a softer hint kept to a readable
  measure ("Be the first to add an idea. Nobody's name is stored with it.").
  The Q&A board reads "No notes yet" over its own hint.
- **Open**, each idea is a card drawn exactly as a Q&A note is, minus the
  vote: where the note has its vote pill, the idea has a tile of the same size
  carrying its number (submission order), not a control; the text at the same
  weight and clamp; and a meta line with the anonymous mask where a note names
  its author. Ideas added after the box first painted slide in.
- **The facilitator's one action sits above the rows** as the Q&A board's
  dashed accent bar: **Open the box (6)** while closed, **Scatter to sticky
  notes** once open. Empty the Box stays in the `…` menu.
- All of it is layout and `tint()` of the element's own colours, so it holds
  on any theme and in either appearance, and every motion collapses under
  reduced motion.

Opening is edit-role only and shared. There is no closing again: once the room
has read the cards, a re-closed box is theatre, and the flag exists to protect
the writing round, not to be a toggle.

## Getting the ideas onto the canvas

An open box's cards can be **scattered to sticky notes** in one action, which
is what a retro does next: the cards become ordinary elements that group, move,
theme and get dot-voted ([Session tools (timer + voting)](session-tools.md)) like anything else. They are created without
authorship, so the scatter doesn't undo the anonymity that was the point.
