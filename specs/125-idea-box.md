# 125 — Idea box

Status: **implemented**.

A box anyone can drop a card into **without their name going on it**, held
closed until the facilitator opens it.

## Why

Brainwriting, pre-mortems, retro round one and "what is nobody saying" all
depend on the same thing: an idea that cannot be traced to the person who had
it. A sticky note can't do this — the change log (spec/12) attributes every
element to its author by design, and the author's cursor was sitting on it as
they typed.

## Anonymity is structural

The element has **nowhere to put an author**. Not an author field left blank,
not an author field the UI hides: `ideaCards` is a list of strings and that is
the entire schema.

That matters because every other route to a name is one refactor away from
being reintroduced. The two that had to be closed deliberately:

- **The change log.** Adding a card commits the element WITHOUT a log entry,
  the same exception the high-frequency vote casts already take (spec/39). An
  entry saying "Priya edited Idea Box" beside six anonymous cards is a
  five-second deanonymisation.
- **The selection lock.** Adding a card does not select the element, so the
  spec/07 concurrent-selection highlight doesn't put a coloured ring and a name
  on the box at the moment somebody types into it.

### The limit, stated plainly

This is anonymity **against the other people in the room**, not against a
determined observer. The `el` op that carries the new card is rebroadcast with
the sender's participant id in the envelope (`from`), because the room adds it
to every frame — so a peer reading their own devtools can tell who submitted
what. Closing that would mean relaying idea submissions through a separate
unattributed path, which is a second sync route for one element.

The same honesty spec/88 applies to the poll's costs applies here: the feature
is worth having with this limit, and the limit is written down.

## The element

A **shape kind**, `idea-box`. Its `label` is the prompt ("What might go
wrong?").

- **`ShapeElement.ideaCards`** — the submissions, in submission order. Bounded
  in `validate.ts` like every other list field.
- **`ShapeElement.ideasRevealed`** — shared, false by default.

## Closed and open

**Closed**, the box shows the prompt, an **Add idea** field, and a count —
"6 ideas inside". Not the text, not even to the person who wrote one: a box
that shows you your own card tells the room what you wrote the moment someone
watches you type it.

**Open**, the cards render stacked inside the box in submission order, and the
Add field stays — an idea after the reveal is still an idea.

Opening is edit-role only and shared. There is no closing again: once the room
has read the cards, a re-closed box is theatre, and the flag exists to protect
the writing round, not to be a toggle.

## Getting the ideas onto the board

An open box's cards can be **scattered to sticky notes** in one action, which
is what a retro does next: the cards become ordinary elements that group, move,
theme and get dot-voted (spec/39) like anything else. They are created without
authorship, so the scatter doesn't undo the anonymity that was the point.
