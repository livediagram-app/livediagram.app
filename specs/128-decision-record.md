# 128 — Decision record

Status: **implemented**.

A card that states a decision, what drove it, when it was taken, and whether it
still stands.

## Why

Architecture diagrams are full of decisions and record none of them. The box
says "Postgres"; the reason it isn't DynamoDB lives in a doc that was written
once, linked from a Slack message, and is now wrong. Teams that write ADRs keep
them somewhere the diagram can't see; teams that don't lose the reasoning
entirely and re-litigate it every six months.

Putting the decision **on the diagram, beside the thing it decided** is the
whole idea. It is also the piece that makes a livediagram board a durable
artefact rather than a picture of a whiteboard.

## The element

A **shape kind**, `decision`. Its `label` is the decision **statement** ("Use
Cloudflare D1 for durable storage"), so it edits, formats, wraps and exports
like any other label — the same reasoning the record box uses for its title
(spec/120).

- **`ShapeElement.decisionStatus`** — `'proposed' | 'accepted' | 'rejected' |
'superseded'`. Absent = proposed, so a card dropped mid-discussion is honest
  about being mid-discussion.
- **`ShapeElement.decisionDate`** — an ISO `YYYY-MM-DD`. A date, not a
  timestamp: a decision is taken on a day, and a time-of-day invites a
  precision nobody has.
- **`ShapeElement.decisionDrivers`** — the short list of reasons. Bounded in
  `validate.ts`.

## The face

- A **status chip** in the top-right, colour-coded and always spelled out in
  words: proposed (slate), accepted (green), rejected (rose), superseded
  (amber).
- The statement as the label, given the room it needs — this is the sentence
  people read.
- Drivers as a compact bulleted list under it.
- The date in the footer, or nothing at all when unset. An undated decision
  card is common and fine; a card showing "no date" is noise.

The status tints **the chip only**, never the element's fill. The theme owns
the box (spec/29), and a card that turns green on accept fights every other
element on a themed board.

## Why not a record box

The record (spec/120) renders `name: Type` rows and would technically hold
this. It would lose all four things that make the card useful: a status that
renders as a chip and can be scanned across a board, a date that means a date,
drivers that read as reasons rather than fields, and the possibility of
anything later filtering or reporting on decision state. Structured meaning is
exactly what a freeform row list throws away.

## Deliberately not in scope

- **No supersession link.** "Superseded" is a status, not a pointer to the card
  that replaced it. An arrow between the two says it, the canvas already draws
  arrows, and a typed link would be a second relationship model for one status.
- **No approvals on the card.** Who signed off is a different feature with its
  own per-person state.
