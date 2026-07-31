# 129 — Roll call

Status: **implemented**.

A card that freezes **who was in the room** at a moment, onto the board.

## Why

The presence stack shows who is here now, and forgets. Every session that
produces a record — a workshop, an incident review, a design review, a
decision (spec/128) — needs the attendance beside the output, and today the
board that holds the output can't hold the attendance.

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

The change log went the other way: migration `0013` (spec/12) **dropped** its
denormalised `participant_name` / `participant_color` and now joins to the live
participants table, so a rename shows through and a deleted participant
degrades to "Unknown".

A roll call is the opposite kind of record and takes the opposite decision. It
is minutes: a statement about a past moment. Someone who has since left the
team, been deleted, or changed their display name **was still in that room
under that name**, and a join that erased them would be wrong rather than
merely stale.

So the name and the presence colour are copied into the element at the moment
the roll is taken, and nothing later rewrites them.

## The face

- A header: the count ("7 present") and when it was taken, in the reader's
  locale.
- The people below in a wrapping grid — each participant's presence avatar
  (initials on their presence colour, the same `ParticipantAvatar` the presence
  stack and the picker use) with their name beside it.
- Before the first roll, an empty state with the **Take roll** press on it, so
  a freshly dropped card explains itself.

## Guests count

An unsigned guest is a participant (spec/04) and appears in the roll under
whatever name they are using, with no distinction drawn from a signed-in one.
Attendance is about who was in the room, and the board has never cared which
door they came through.
