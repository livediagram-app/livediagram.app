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

## Each one looks like what it is

Every Behaviours element rendered as the same rounded rectangle with a title
and some controls, so a board of them read as one repeated component in
thirteen sizes. The thing each of them IS — a clipboard, a ballot box, a ticket
stub, a filed record — was carried entirely by the words on it.

The **paper kit** (`components/canvas/paper-kit.tsx`) is the shared set of
textures that fixes that. Its one rule: everything is built from
`tint(textColor, alpha)`, so a card is drawn in ITS OWN colour and the tab
theme still owns the palette (spec/29). A pink board stays a pink board. All
the distinction comes from **form** — a folded corner, a punched margin, a torn
edge, a rotated stamp — which survives any hue, any theme, and light or dark
mode, none of which a per-kind colour would.

| Element         | Object             | What draws it                                                  |
| --------------- | ------------------ | -------------------------------------------------------------- |
| Done check      | a ring-binder page | ruled, punched, wire loops through the holes                   |
| Idea box        | a posting box      | lid with a lip, slot sunk into it, corrugated body, taped shut |
| Estimate        | a hand of cards    | crosshatched backs face-down, a Shown stamp after the reveal   |
| Temperature     | an instrument      | the graduated plate a needle is read against                   |
| Agenda          | a folded programme | ruled, creased down the middle                                 |
| Decision record | a filed record     | photocopy screen, turned-up corner                             |
| Roll call       | a ticket stub      | perforated fold, torn bottom edge                              |
| Comment panel   | a quoted remark    | the rail down the left edge                                    |
| Picker          | a reel in a window | shaded at the lip, clear in the middle                         |
| Timer           | a dial             | minute ticks along the edge you read                           |
| Session button  | a tally sheet      | five-bar gate marks (not on a timer)                           |
| Reveal zone     | a scratch panel    | close diagonal hatching                                        |
| Reaction pad    | a floor pad        | concentric tread out from the middle                           |
| Mode button     | a keycap           | lit top, shaded skirt, a drop below it                         |

House rules for anything added to the kit: decorative, so `aria-hidden` and
`pointer-events-none` without exception (these sit over cards whose controls
must stay clickable); absolutely positioned, so a texture can never change the
layout it decorates; built from `tint`, never a Tailwind colour class; and no
animation — a board of thirteen moving textures is a board nobody can read.

`CollabPanel` takes the textures as **two** slots, `backdrop` and `overlay`,
because the layering is the effect: rules under the words read as a page they
are written on, the same rules over them read as a cage. `inset` reserves the
room a texture needs so a punched margin does not print through the title.

Three lessons are worth keeping:

- **A slot is only a slot if it is cut into something.** The idea box's mouth
  began as a dark bar near the top edge and read as a mislaid progress track.
  It needed the lid around it.
- **Do not put two ways of holding the same paper on one card.** The Done check
  had a clipboard's jaw across the top AND a punched margin down the side. The
  jaw read as a stray pill; the rings agree with the holes.
- **A texture drawn outside the card is not drawn at all.** `overflow-hidden`
  clipped every pixel of the first `TapeStrip`, so the seal never once
  appeared. Anything at an edge has to lie ACROSS it.

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
