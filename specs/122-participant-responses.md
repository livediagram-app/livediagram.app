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
`{ participantId, value, at }` — the answer as a **string**, when it was cast,
and the id of who cast it (see below — it is NOT the owner id).

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

## `participantId` is the COLLAB KEY, not the owner id

This is the field's one real subtlety, and getting it wrong broke the done
check ([spec/137](137-done-check.md)) outright: everyone saw their own mark and
nobody else's, in both directions.

There are three ids for a person in the editor, and only one of them can go
here:

| Id                           | Stable across reconnects? | Safe to publish? |
| ---------------------------- | ------------------------- | ---------------- |
| **Owner id** (`X-Owner-Id`)  | yes                       | **no**           |
| **Presence id** (spec/61 §6) | **no** — per socket       | yes              |
| **Collab key**               | yes                       | yes              |

The owner id is a credential: for a guest it is exactly what authenticates
their API calls, so writing it into a shared diagram hands it to every
co-viewer. The presence id is deliberately a fresh server-minted random per
socket, so peers never read an owner id off a roster — which also means it
matches nothing that was ever saved, and changes on every reconnect.

So the document gets a third id: **`livediagram:v2:collab-key`**, a per-browser
random the client mints and keeps (`ensureCollabKey`). Stable like the owner
id, worthless like the presence id. It rides the roster as
`ParticipantPresence.key`, the **one claimed field** on it — relayed verbatim
rather than server-stamped, because it has to survive a reconnect to do its
job, and because it grants nothing (any edit-role peer can already write any id
straight into the document, so leaving it claimable adds no reach).

Both sides of the join go through **`participantKey(participant)`**, which
falls back to `id` for a peer on a client too old to publish a key: they render
in the roster and match no saved answer, which is what happened before the key
existed rather than a crash.

Two consequences worth stating:

- **Per browser, not per account.** The same person signed in on a laptop and a
  phone is two answers — and two presence entries, so the card stays
  self-consistent.
- **Answers written before this shipped don't match anybody.** They were keyed
  on owner ids. A done check is a round you reset anyway; an estimate card
  shows its old answers with no avatar beside them, the same as an answer from
  somebody who has left.

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
element knows who said 8. (Not anonymous to the ROOM, that is; the key is not
an owner id, so it identifies a browser in this session rather than an account
— see above.) That is right for these two consumers (a team that
cannot see who estimated what cannot discuss the outlier) and wrong for a
brainstorm, which is why the idea box ([spec/125](125-idea-box.md)) does not use
this field and has nowhere to put an author at all.

## The card scales to its box

A Collaborate card lays out ONCE at its kind's default size and is then scaled
uniformly onto the element's real box (`CollabScale` in `collab-chrome.tsx`),
rather than reflowing into it.

That is the difference between "the card gets bigger" and "the card gets more
padding". Resizing one is how a facilitator makes it readable from the back of
the room; a fist-of-five stretched to fill a wide box still had 13px type and
6px bars, which is exactly what nobody can read from there.

Uniform scale on the smaller axis, centred, so nothing distorts and a box with
a different aspect ratio to the default leaves even margins instead of pinning
to a corner.
