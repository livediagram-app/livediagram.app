# Per-participant responses

Status: **implemented**.

A shared element field that records **one value per participant**, persistently.
The primitive under the temperature check ([Temperature check](temperature-check.md)).

## Why it needs to exist

Every collaborative thing on the canvas today is one of two shapes, and neither
is "what does each person think":

- **One value, one author, persisted** — rating ([Rating](../009-elements/rating.md)), progress ([Progress elements](../009-elements/progress.md)),
  checklist ([Checklist](../009-elements/checklist.md)), picker result ([Picker](picker.md)). Anyone can change it, and the
  element remembers only the last change.
- **Room-wide and ephemeral** — the timer and dot-vote ([Session tools (timer + voting)](session-tools.md)). Per-person, but scoped to a session and gone afterwards.

A temperature check is neither. It needs each person's own answer, kept apart
from everyone else's, surviving a reload. That is one field, built once here so
any later reading of the room reuses it.

## The field

`ShapeElement.responses?: ParticipantResponse[]`, where a response is
`{ participantId, value, at }` — the answer as a **string**, when it was cast,
and the id of who cast it (see below — it is NOT the owner id).

- **At most one response per participant**, enforced by `setResponse`: casting
  again REPLACES your earlier answer rather than stacking a second one. This is
  the whole contract.
- **A string, not a number**, so a consumer decides what an answer is and
  parses what it needs (`responseStats` does the numeric read for the gauge).
- **An array, not a record**, matching `checklistItems` / `entityFields` /
  `pieSlices`, so it bounds in `validate.ts` with the same array clamp as the
  rest and round-trips through JSON export with no key-order surprise.

Helpers live in `packages/project/src/responses.ts` — a leaf module (types
only), for the same module-cycle reason `data-shapes.ts` is one.

## `participantId` is the COLLAB KEY, not the owner id

This is the field's one real subtlety, and getting it wrong broke the first
consumer outright: everyone saw their own answer and nobody else's, in both directions.

There are three ids for a person in the editor, and only one of them can go
here:

| Id                                                                                    | Stable across reconnects? | Safe to publish? |
| ------------------------------------------------------------------------------------- | ------------------------- | ---------------- |
| **Owner id** (`X-Owner-Id`)                                                           | yes                       | **no**           |
| **Presence id** ([Public API and API tokens](../015-api/public-api-and-tokens.md) §6) | **no** — per socket       | yes              |
| **Collab key**                                                                        | yes                       | yes              |

The owner id is a credential: for a guest it is exactly what authenticates
their API calls, so writing it into a shared project hands it to every
co-viewer. The presence id is deliberately a fresh server-minted random per
socket, so peers never read an owner id off a roster — which also means it
matches nothing that was ever saved, and changes on every reconnect.

So the project gets a third id: **`liveplanner:v2:collab-key`**, a per-browser
random the client mints and keeps (`ensureCollabKey`). Stable like the owner
id, worthless like the presence id. It rides the roster as
`ParticipantPresence.key`, the **one claimed field** on it — relayed verbatim
rather than server-stamped, because it has to survive a reconnect to do its
job, and because it grants nothing (any edit-role peer can already write any id
straight into the project, so leaving it claimable adds no reach).

Both sides of the join go through **`participantKey(participant)`**, which
falls back to `id` for a peer on a client too old to publish a key: they render
in the roster and match no saved answer, which is what happened before the key
existed rather than a crash.

Two consequences worth stating:

- **Per browser, not per account.** The same person signed in on a laptop and a
  phone is two answers — and two presence entries, so the card stays
  self-consistent.
- **Answers written before this shipped don't match anybody.** They were keyed
  on owner ids, so they show with no avatar beside them, the same as an answer from
  somebody who has left.

### Who counts

A card that counts the room ("n/m answered") counts one entry per person who can answer
(`answeringKeys` in `apps/live/lib/identity.ts`): presence rows are deduped by
collab key, so your own second tab (same key, another socket) is one person,
and view-link guests (role `view`, who can't cast) and agent rows are left out.
Before this, a viewer or a second tab counted as somebody yet to answer.
Our own row counts by the same rule on our own screen: it carries our own level
(`selfInRoom`), as a peer's row carries the role the room stamped on it, so a
Viewer's screen leaves the Viewer out too rather than reading 3/5 where everyone
else reads 3/4.

## Rules it inherits, and the one it breaks

- **It syncs, it persists, it exports.** An ordinary element field, so it rides
  the granular `el` op ([Realtime conflict resolution](realtime-conflict-resolution.md)), lands in D1, and reaches late joiners.
- **Edit-role only.** The room drops view-role mutations ([API app](../015-api/api.md)), so casting
  is gated with no extra code, exactly like a dot-vote.
- **Casting does NOT push undo history.** It writes through the non-history
  `tickTabs`, the same call a vote cast makes ([Session tools (timer + voting)](session-tools.md)). Undo is a personal
  control, and one person pressing Ctrl+Z should never retract another
  person's answer. This was once claimed but not true: the writes went
  through the history-pushing `commitTabs` ([Collaboration race hardening](collab-race-hardening.md)).
- **An answer travels as a delta** ([Collaboration race hardening](collab-race-hardening.md)): one `el-delta` op per cast
  or withdraw, applied by the same `applyElementDelta` everywhere, so two
  people answering at once both land. A whole-element update from a peer
  keeps the receiver's `responses`, unless it starts a new round (a Clear).
- **Undo keeps everybody's answers.** Not pushing history is only half of
  it: a snapshot restored by undo predates answers cast since, so
  `responses` (and the other collaborative fields, [Collaboration race hardening](collab-race-hardening.md)) are re-grafted
  from the present onto it, exactly as comment threads are.

## Limit, stated plainly

`participantId` is in the element, so an answer is **not anonymous** — the
element knows who said 8. (Not anonymous to the ROOM, that is; the key is not
an owner id, so it identifies a browser in this session rather than an account
— see above.) That is right for a reading of the room (a team
that cannot see who answered what cannot discuss the outlier) and wrong for
anything that must be anonymous, which should not use this field.

## Each one looks like what it is

Every Behaviours element rendered as the same rounded rectangle with a title
and some controls, so a canvas of them read as one repeated component in
thirteen sizes. The thing each of them IS — a clipboard, a ballot box, a ticket
stub, a filed record — was carried entirely by the words on it.

The **paper kit** (`components/canvas/paper-kit.tsx`) is the shared set of
textures that fixes that. Its one rule: everything is built from
`tint(textColor, alpha)`, so a card is drawn in ITS OWN colour and the tab
theme still owns the palette ([Multi-colour (rainbow) themes](../011-theme/multicolour-themes.md)). A pink canvas stays a pink canvas. All
the distinction comes from **form** — a folded corner, a punched margin, a torn
edge, a rotated stamp — which survives any hue, any theme, and light or dark
mode, none of which a per-kind colour would.

| Element         | Object             | What draws it                                                                                      |
| --------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| Temperature     | (moved on)         | none: faces, bars and a mood meter ([Temperature check](temperature-check.md#the-face))            |
| Decision record | (moved on)         | none: a status badge and glow, drivers as reasons ([Decision record](decision-record.md#the-face)) |
| Comment panel   | a quoted remark    | none (the left-edge rail it had read as a stray bar and went)                                      |
| Picker          | a reel in a window | shaded at the lip, clear in the middle                                                             |
| Timer           | a dial             | minute ticks along the edge you read                                                               |
| Session button  | a tally sheet      | five-bar gate marks (not on a timer)                                                               |

**The kit is being retired, one element at a time.** A newer direction replaces it: a flat card lit
by the tab theme's accent, rounded rows, a composer at the foot, and motion that carries meaning (an
answer pops, a new entry settles in) instead of printed texture. Next to it the paper objects read as
skeuomorphic and dated, so elements move onto those parts (the accent scope, composer, rows and
motion) rather than growing new textures. The Temperature check and the Decision record have moved;
the rest follow. Until an element moves, its row above still describes it.

House rules for anything added to the kit: decorative, so `aria-hidden` and
`pointer-events-none` without exception (these sit over cards whose controls
must stay clickable); absolutely positioned, so a texture can never change the
layout it decorates; built from `tint`, never a Tailwind colour class; and no
animation — a canvas of moving textures is a canvas nobody can read.

`CollabPanel` takes the textures as **two** slots, `backdrop` and `overlay`,
because the layering is the effect: rules under the words read as a page they
are written on, the same rules over them read as a cage. `inset` reserves the
room a texture needs so a punched margin does not print through the title.

Lessons worth keeping:

- **A slot is only a slot if it is cut into something.** A slot drawn as a dark bar near a card's
  top edge read as a mislaid progress track; it needs a lid around it.
- **Do not put two ways of holding the same paper on one card.** A clipboard's jaw across the top
  AND a punched margin down the side read as a stray pill beside the holes.
- **A texture drawn outside the card is not drawn at all.** `overflow-hidden` clips anything that
  lies beyond the card's edge, so anything at an edge has to lie ACROSS it.
- **Small hardware does not survive the size these elements are used at.** At the size a card
  actually sits on a canvas a 5px loop and a 7px hole are not a mechanism, they are specks. The
  Session button's tally marks went this way: it is the smallest element in the family and there is
  no room on it for a texture that is not the label.

  The rule that falls out: a texture has to work at the element's DEFAULT size,
  not at the size you designed it, and it has to survive the card's own
  clipping. Big, soft shapes (a lid, a torn edge, a hatch, a screen) survive;
  fine mechanical detail and anything that depends on its own edges does not.

## The card scales to its box

A Collaborate card lays out ONCE at its kind's default size and is then scaled
uniformly onto the element's real box (`CollabScale` in `collab-chrome.tsx`),
rather than reflowing into it.

That is the difference between "the card gets bigger" and "the card gets more
padding". Resizing one is how a host makes it readable from the back of
the room; a fist-of-five stretched to fill a wide box still had 13px type and
6px bars, which is exactly what nobody can read from there.

Uniform scale on the smaller axis, so nothing distorts. Along the other axis
the inner box is stretched to the element (in design units) rather than
centred at the design size, so a card taller or wider than its default still
paints its backdrop edge to edge: a centred design box left a card's ruling
floating in a band mid-element with bare card above and below.
