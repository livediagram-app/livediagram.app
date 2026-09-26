# 151 — Q&A board

Status: **implemented**.

A Slido-style list on the canvas. Anyone in the session adds a note, everyone
else upvotes the ones they want to talk about, the list keeps itself sorted so
the most-wanted note is always on top, and the facilitator pulls one up for
discussion and folds it away when the room is done with it.

## Why

A workshop's question queue is the one collaborative object the board could
not hold. Sticky notes plus the dot vote (spec/39) come close, but they are the
wrong shape in three ways:

- **The order is the point.** A dot vote is counted at the end; a Q&A list is
  read top-down continuously, while people are still voting. Stickies don't
  sort themselves.
- **The audience isn't editing.** The people asking questions are usually on a
  view link (spec/13). Every other document write needs edit rights.
- **It has a lifecycle.** A note goes from asked, to being discussed, to done,
  and a done note should get out of the way without being deleted: the record
  of what the room covered is part of the output.

## The element

A **shape kind**, `qa-board`, in the Collaborate family (spec/122). Its `label`
is the prompt ("Questions for the panel").

- **`ShapeElement.qaNotes?: QaNote[]`** — every note, in submission order. The
  sort is a view, never stored, so two clients can't disagree about it.
- **`ShapeElement.qaRev?: number`** — a counter the server bumps on every board
  write. See [Consistency](#consistency).

```ts
type QaNote = {
  id: string;
  text: string;
  at: number; // submitted
  author?: { name: string; color: string }; // absent = anonymous
  voters: string[]; // voter ids, see below
  state?: 'discussing' | 'done';
  doneAt?: number;
};
```

Bounds (`validate.ts`): 200 notes, 280 characters per note, 1000 voters per
note.

## What each person can do

| Action                      | Who                                             |
| --------------------------- | ----------------------------------------------- |
| Add a note                  | Anyone in the session, **including view links** |
| Upvote / withdraw an upvote | Anyone in the session, including view links     |
| Pick the note to discuss    | The facilitator, else any editor                |
| Mark done / reopen          | The facilitator, else any editor                |
| Remove a note (moderation)  | The facilitator, else any editor                |
| Empty the board             | The facilitator, else any editor                |

"The facilitator, else any editor" is spec/149's rule: while somebody holds the
baton the controls are theirs; when nobody does, any editor can run the board.
Like the timer and the dot vote it is a **client-side** rule (who is driving,
not who is allowed); the server enforces edit rights on those actions, not the
baton, because the REST path can't see which socket holds it.

### Authorship is the author's choice

Named by default, with an **Anonymous** toggle beside the field. A named note
gets the author's name and colour stamped **by the server** from their
participant record (the same anti-impersonation rule comments take, spec/12),
never read from the request. An anonymous note has no `author` at all, and like
the Idea box (spec/125) nothing about the write goes to the change log. The
wire-level limit spec/125 states applies here too: this is anonymity against
the room, not against someone reading the api's logs.

### One vote per person per note, enforced by the server

A voter id is `sha256("livediagram:qa-vote:v1:" + ownerId + ":" + elementId)`,
truncated to 16 hex characters and computed **by the server** from the
authenticated caller (`X-Owner-Id` or the Clerk `sub`). So:

- **It can't be forged.** A client never says who it is voting as; claiming a
  second vote means holding a second owner id.
- **It publishes nothing.** The owner id is a credential (spec/122), and a
  one-way hash of it salted with the board's id can't be turned back into one,
  nor correlated across two boards.
- **The client can still tell which notes it voted for.** It knows its own
  owner id, so it computes the same hash locally (`qaVoterId`, shared by both
  sides in `@livediagram/diagram`).

Votes are **set, not toggled**, on the wire (`{ type: 'vote', on: true }`) so a
retried request can't flip a vote back off. Pressing your own upvote again
withdraws it. Done notes take no votes: their counts freeze when they're closed.

The honest limit is the same one every per-browser identity here has: a guest
who clears their browser storage is a new person.

## How it syncs

The board is the one element whose state the **server owns**. Every action,
from every role, goes through one endpoint:

`POST /api/diagrams/<id>/tabs/<tabId>/qa` with `{ elementId, action }`.

- Participant actions (`add`, `vote`) pass `gateRead`; the rest need
  `gateEdit`. Same shape as the comment endpoint, which is the precedent for a
  view-role write (spec/11).
- The route checks access and derives the actor (voter id, server-stamped
  author), then hands the write to **the diagram's room** (`POST
https://room/qa` on the Durable Object).
- The room runs board writes **one at a time**, through an in-memory promise
  queue (`DiagramRoom.handleQaWrite`). A Durable Object only serialises the
  synchronous part of a handler: while one write awaits D1, the runtime starts
  the next request, so without the queue two read-modify-writes of the same
  row would race. Worker requests run in parallel isolates, so the room is the
  only place every write for one diagram meets.
- Each queued step applies the action with the shared pure reducer
  `applyQaAction`, bumps `qaRev`, and writes the tab with a **compare-and-swap**
  on the stored JSON (`UPDATE … WHERE data = <what we read>`,
  `qa-board-write.ts`). The CAS is the second line of defence, against the
  row's other writers: an editor's tab autosave, and a tab linked into a second
  diagram (spec/17), whose room queues separately. A lost race re-reads.
- Still inside the step, the room broadcasts
  `{ kind: 'qa', tabId, elementId, notes, rev }` as a **system op**, so no
  client can forge one, and peers receive states in rev order. Unlike
  `share-revoked` it is **sequenced into the catch-up log**, so a peer that
  reconnects within the log window replays it (spec/75).
- The response returns the same `{ notes, rev }`.

### Not repeating the dot vote's bug

The dot vote (spec/39) once lost votes because a peer's write carried a
snapshot from before another person's vote and **replaced** it. The board
closes each route that could do that:

- **Clients never send board state, only intents** ("vote on n1"). The server
  applies each intent to the row as it stands, so two votes compose instead of
  the later one erasing the earlier.
- **Board writes can't race each other** (the room queue), and can't be lost
  to an autosave (the CAS re-read).
- **Stale whole-element copies can't roll the board back** (`qaRev`, below),
  on peers or in D1.

`diagram-room-qa.test.ts` fires 40 simultaneous votes at a fake D1 that
yields on every read and write, the worst interleaving there is, and asserts
all 40 land with revs 1 to 40 broadcast in order. It fails if the queue is
removed.

Clients apply the action **optimistically** with the same reducer, so a vote
lands under the finger. Pending actions sit in a small queue and are
re-applied on top of every authoritative state that arrives, so two quick
votes don't flicker while the first round-trip is in flight. A failed request
drops its pending action and the board falls back to the server's state.

An **offline diagram** (spec/76) has no server, so the reducer runs locally and
the ordinary tab save persists it. The voter id is computed the same way.

### Consistency

Three other paths carry a whole element and could roll the board back: the tab
autosave (`PUT /tabs/<id>`), the `el` op and the `tab` op. Each keeps the
board's notes from **whichever copy has the higher `qaRev`**
(`preferNewerQa`), and on a tie keeps what it already has. So:

- An editor moving the board while votes land can't erase them, on peers or in
  D1.
- An optimistic local change (same rev, extra note) never leaks out through an
  autosave; the server's broadcast is the only thing that raises the rev.
- If an autosave's read-then-write does interleave with a board write in D1,
  the next autosave from any editor carries the higher rev back and heals it.

## The face

The goal is a queue the room _watches_, not a form it fills in.

- **The spotlight.** The note being discussed lifts out of the list into a
  lit card at the top: a pulsing "Now discussing" rail, the note large, the
  author, the vote count. The facilitator gets **Done** and **Done, next** on
  it, which closes this note and spotlights the current top note in one press.
- **The live list.** Each row is a vote pill and the note. The pill is the
  control: press to upvote, press again to withdraw. Your own votes are filled
  in the board's accent; others' are outlined. A thin heat bar under each note
  shows its share of the top note's votes, so the shape of the queue reads
  from across a room.
- **It moves.** When a vote changes the ranking, rows slide to their new place
  (FLIP), and a row that climbs gets a brief glow. The top note wears a small
  crown-rank badge. Motion is off under `prefers-reduced-motion`.
- **Adding.** A field at the foot with the Anonymous toggle, Enter to post. A
  freshly posted note drops in with a short settle animation.
- **Done notes** collapse into a folded "Discussed · N" drawer below the live
  list, most recent first, counts frozen, struck through lightly. The
  facilitator can reopen one from there.
- **Facilitator hover actions** on every row: Discuss, Done, Remove.
- **Empty state** invites the first note rather than explaining the element.

The board scales like every Collaborate card (spec/122): it is laid out at its
default size (360 × 460) and scaled to the box, so resizing it is how a
facilitator makes it readable from the back.

## Export and render

`qaNotes` is an ordinary element field, so it rides JSON export and import.
The static SVG render (thumbnails, PNG export) draws the prompt and the
ranked rows that fit, each with its vote count, spotlit note first, so an
exported board still says what the room asked and what it wanted most.

## Telemetry

`Element / Changed / Qa-board` on each action, alongside the standard add from
the palette. No note text, ever.
