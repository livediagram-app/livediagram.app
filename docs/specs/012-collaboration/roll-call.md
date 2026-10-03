# Roll call

Status: **implemented**.

A card that freezes **who was in the room** at a moment, onto the canvas.

## Why

The presence stack shows who is here now, and forgets. Every session that
produces a record — a workshop, an incident review, a design review, a
decision ([Decision record](decision-record.md)) — needs the attendance beside the output, and today the
canvas that holds the output can't hold the attendance.

## Take, don't track

The element does **not** render live presence. Pressing **Take roll** copies
the presence list into the element, and that copy is what it shows forever.

That is the entire feature. A card that tracked presence would be empty five
minutes after the session, which is precisely when anyone reads it.

- **`ShapeElement.rollCall`** — `{ name, color, at }[]`, plus the moment the
  roll was taken. Bounded in `validate.ts`.
- Taking a roll again **replaces** the list. Latecomers are the normal reason,
  and a merge would quietly turn "who was here" into "who has ever been here",
  which is a different and less useful question.

## Names are copied, deliberately

The since-removed change log went the other way: migration `0013` **dropped** its
denormalised `participant_name` / `participant_color` and joined to the live
participants table, so a rename showed through and a deleted participant
degraded to "Unknown".

A roll call is the opposite kind of record and takes the opposite decision. It
is minutes: a statement about a past moment. Someone who has since left the
team, been deleted, or changed their display name **was still in that room
under that name**, and a join that erased them would be wrong rather than
merely stale.

So the name and the presence colour are copied into the element at the moment
the roll is taken, and nothing later rewrites them.

## The face

Built in the behaviour elements' current direction ([Participant responses](participant-responses.md): the paper kit is being retired; the [Q&A board](qa-board.md) set the look), in the tab theme's accent. It replaced a two-column list on a perforated "ticket stub" with a torn
bottom edge.

- A **header block**: the count large ("7 present"), an overlapping stack of
  the first few avatars (and "+3" past them), and when it was taken as a pill
  (the time, and the date when it isn't today, in the reader's locale).
- The people below as **rounded chips**, each the participant's presence avatar
  (initials on their presence colour) and their name, in a wrapping grid. When
  a roll is taken while the card is on screen they cascade in.
- **Take roll** at the foot as the accent bar; once taken, **Take again**.
- Before the first roll, the shared invitation ("Nobody recorded yet", "Take
  the roll to freeze who is here into the document").

## Guests count

An unsigned guest is a participant ([Auth + guest access](../014-identity/auth-and-guest-access.md)) and appears in the roll under
whatever name they are using, with no distinction drawn from a signed-in one.
Attendance is about who was in the room, and the canvas has never cared which
door they came through.
