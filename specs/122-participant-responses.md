# 122 — Per-participant responses

Status: **implemented**.

A shared element field that records **one value per participant**, persistently.
The primitive under the estimate card ([spec/123](123-estimate-card.md)) and the
temperature check ([spec/124](124-temperature-check.md)).

## Why it needs to exist

Every collaborative thing on the canvas today is one of two shapes, and neither
is "what does each person think":

- **One value, one author, persisted** — rating (spec/52), progress (spec/46),
  checklist (spec/83), picker result (spec/107). Anyone can change it, and the
  element remembers only the last change.
- **Room-wide and ephemeral** — the timer and dot-vote (spec/39), the live poll
  (spec/88). Per-person, but scoped to a session and gone afterwards.

A planning-poker round and a temperature check are neither. They need each
person's own answer, kept apart from everyone else's, surviving a reload. That
is one field, so it is built once here rather than three times.

## The field

`ShapeElement.responses?: ParticipantResponse[]`, where a response is
`{ participantId, value, at }` — the participant id the room already identifies
people by (spec/04), the answer as a **string**, and when it was cast.

- **At most one response per participant**, enforced by `setResponse`: casting
  again REPLACES your earlier answer rather than stacking a second one. This is
  the whole contract, and it matches how `poll-answer` (spec/88) keys by sender.
- **A string, not a number**, because the consumers disagree about what an
  answer is: `'8'` and `'XL'` and `'?'` are all valid estimates. Consumers parse
  what they need (`responseStats` does the numeric read for the gauge).
- **An array, not a record**, matching `checklistItems` / `entityFields` /
  `pieSlices`, so it bounds in `validate.ts` with the same array clamp as the
  rest and round-trips through JSON export with no key-order surprise.

Helpers live in `packages/diagram/src/responses.ts` — a leaf module (types
only), for the same module-cycle reason `data-shapes.ts` is one.

`ShapeElement.responsesRevealed?: boolean` is the shared "values are out" flag.
The estimate card uses it; the temperature check deliberately does not.

## Rules it inherits, and the one it breaks

- **It syncs, it persists, it exports.** An ordinary element field, so it rides
  the granular `el` op (spec/75), lands in D1, and reaches late joiners. This is
  the deliberate opposite of the poll (spec/88): a poll is a pulse-check that
  should evaporate, an estimate is a record of what the team decided.
- **Edit-role only.** The room drops view-role mutations (spec/11), so casting
  is gated with no extra code, exactly like a dot-vote.
- **Casting does NOT push undo history.** Same call as `commitTabs` makes for a
  vote cast (spec/39). Undo is a personal control, and one person pressing
  Ctrl+Z should never retract another person's answer.

## Limit, stated plainly

`participantId` is in the element, so an answer is **not anonymous** — the
element knows who said 8. That is right for these two consumers (a team that
cannot see who estimated what cannot discuss the outlier) and wrong for a
brainstorm, which is why the idea box ([spec/125](125-idea-box.md)) does not use
this field and has nowhere to put an author at all.
