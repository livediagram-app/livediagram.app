# Collaboration race hardening

A room of people pressing the same cards at once must not lose, duplicate or retract anybody's action. This holds
for every element used during collaboration: the dot vote ([Session tools (timer + voting)](session-tools.md),
"Casting a dot"), the done check, estimate, temperature, idea box, checklist and comment threads, and the transport
underneath all of them. This spec names the ways a press can be lost and the rule that closes each.

## How a press can be lost

Six shared causes; an element that loses a press shows one of these. Each is closed by a rule below.

1. **A press ships the whole element, late.** An element change only leaves
   the browser through the autosave (600 ms debounce, then the tab PUT, then
   the broadcast), as an `el` `update` op that replaces the whole element on
   every receiver ([Realtime conflict resolution](realtime-conflict-resolution.md)). Two presses on one card inside that window
   overwrite each other.
2. **Collaborative presses pushed undo history.** `useCollabElements` wrote
   through `commitTabs`, which pushes an undo step, although [Per-participant responses](participant-responses.md) said it
   must not. Undo re-grafted only comment threads, actions, the timer and the
   vote, so Ctrl+Z withdrew your own answer and anyone else's that had
   arrived since the snapshot, for the whole room.
3. **The save baseline ignored remote ops.** `lastSavedTabsRef` was not
   updated when a peer's op was applied, so the next local save diffed
   against a pre-remote snapshot and re-broadcast the peer's elements in the
   local, possibly stale, form. It also made every participant's first save
   after a vote started re-send the whole dots map.
4. **A remote op cancelling the pending local save.** An autosave that skipped
   a run after any remote op would let a peer's op arriving within 600 ms of a
   local press cancel the press's save and broadcast outright.
5. **The store is last writer wins.** Every client PUTs whole tabs, and the api
   replaces the stored blob, so a reload or late joiner sees whichever save
   landed last. (Multi-writer fields merge, see [The store does not overwrite multi-writer fields](#the-store-does-not-overwrite-multi-writer-fields); element content is
   written again by the saver that may have landed last, see
   [A save that wrote over a peer's change writes again](#a-save-that-wrote-over-a-peers-change-writes-again).)
6. **Whole-tab fallbacks.** A cleared field (Clear Timer, Clear Vote) or a
   change of more than 20 elements travels as a whole `tab` op, which
   replaces every element on receivers, wiping their unsaved presses.

## The client keeps its own and its peers' work

- **Collaborative presses do not push undo** (causes 2). Casting or
  withdrawing a response, revealing, clearing, adding an idea, taking the
  roll, pressing an agenda row and the picker's roll all go through the
  non-history `tickTabs`, as the vote does. Scatter still commits: it
  creates stickies, which is authoring.
- **Undo re-grafts every live collaborative field** (cause 2). The fields a
  press writes (`responses`, `responsesRevealed`, `ideaCards`,
  `ideasRevealed`, `rollCall`, `agendaCurrent`, `pickerResult`) join
  `commentThread` and `action` in `LIVE_ELEMENT_FIELDS`, so restoring a
  snapshot keeps their present values.
- **The save baseline follows remote ops** (causes 3 and 4). Every applied
  remote op is also folded into `lastSavedTabsRef` through the same pure
  function the receiver uses (`applyRoomOpToTabs`). A save that was in
  flight re-folds the ops that arrived during it when it lands, so its
  success does not roll the baseline back. The save diff compares tab
  CONTENT when identity differs (a remote op makes a new tab object), so a
  remote-only change is not a local change. Nothing cancels a local save.
- **A vote has a round** ([Session tools (timer + voting)](session-tools.md)). `TabVote.round` is minted at Start and
  carried on every `vote` op. A dot for a different round, or for a vote
  that is not open, is dropped. Within one round the votes map only ever
  moves by deltas: a lifecycle patch (End, Reveal, the walkthrough) or a
  whole-tab op for the SAME round keeps the receiver's map, so it can no
  longer erase dots still in flight.

## Per-participant fields travel as their own ops

The dot-vote pattern for every field many people write at once. A new room
op, `{ kind: 'el-delta', tabId, elementId, delta }` (a MUTATION: sequenced,
logged for catch-up, refused from a view-role sender), carries ONE change,
applied by the sender and every receiver through the same pure
`applyElementDelta` (`packages/document/src/element-deltas.ts`):

- `response`: one participant's answer set, or withdrawn with `null`, keyed
  by `participantKey` (done check, estimate, temperature).
- `idea`: one anonymous card appended, with the random `id` its poster
  minted for it (`ideaCardIds`). No author, still ([Idea box](idea-box.md)). The box
  refuses a card past `IDEA_MAX_CARDS`, at the press and on apply, so a
  full box never fails the tab's validation on save; a card whose id
  the box already holds is a replay, and a no-op. Two posts racing for the
  last card settle in the room's order ([Idea box](idea-box.md) "Racing for the last card").
- `check`: one checklist row ticked or unticked. Rows have no ids, so the
  row is named by index AND text; a peer who moved or retitled rows gets the
  row with that text, or nothing. A tick is not undoable.
- `comment-add` / `comment-remove` / `comment-rekey` / `comment-resolve`:
  one change to a thread, by comment id, so a replay is a no-op. A remove and a rekey
  find their comment in whichever thread holds it. (An add naming a Sheet cell, `cell`, was Plan's and is
  refused now; a stored ledger entry that still carries one is read and ignored.)

Every delta is idempotent or order-free, so concurrent presses commute, and
a malformed frame is dropped rather than applied.

Two rules keep the whole-element path from undoing it:

- **Receivers keep their own copy of these fields.** An `el` add/update or
  an element inside a whole `tab` op is merged over the local element
  (`mergeIncomingElement`): everything else is taken, but answers, ideas,
  checklist ticks and the comment thread stay ours, because every change to
  them reached us as a delta. The sender's copy is a snapshot from their
  last save and can be missing somebody.
- **Senders don't restate them.** The autosave drops an `el` update whose
  only change is in those fields (`elementChangeIsDeltaOnly`).

**A round per card.** `ShapeElement.collabRound` is a random id minted by
Clear (estimate, done check) and by emptying an idea box. Answer and idea
deltas carry it; one naming another round is dropped, so a press from before
a clear can't land in the next round or re-open it. A whole-element update
with a DIFFERENT round replaces the answers and ideas (that is how a clear
reaches everyone). Undo re-grafts `collabRound` and the checklist ticks with
the other live fields.

Decisions against the plan above: checklist rows are matched by index and
text rather than given ids (no schema change). Idea cards carry ids
(`ideaCardIds`, beside the plain string list), so a poster's card can be taken back
after losing the race for the last card.

## The store does not overwrite multi-writer fields

The room converges, but every client PUTs whole tabs, so a store that replaced the blob would hold whichever save
landed last: a save snapshotted before somebody's answer arrived would erase it from the store, and a
reload showed fewer marks than the room had seen.

**The room keeps a ledger.** For every `el-delta` and `vote` op it
sequences, the Durable Object records the change in a small per-element
ledger in its own storage (`packages/document/src/collab-ledger.ts`, pure;
the DO only stores it):

- answers: each participant's LATEST cast or withdraw in the element's
  current round;
- ideas: the cards posted this round, in order;
- checklist ticks: each row's latest state, by index and text;
- dots: the round's votes map, rebuilt from its deltas (a round always
  starts empty, so the deltas are the whole map).

A delta for a new round replaces that element's answers and ideas (ticks
carry over, since rows have no round) and retires the round it replaced; a
`vote` op for a new vote round does the same to the dots. The entry keeps the
last `RETIRED_ROUNDS_MAX` (16) retired rounds, and an op naming one is late
and dropped: before, a late answer, idea, dot or even a withdraw from the
previous round flipped the entry back to it and lost the current round's
answers or dots. One storage key per element, and
a ledger that would outgrow the storage value limit stops recording rather
than failing.

**A save is merged with it.** When a tab PUT arrives for a document with a
room carrying the room cursor its snapshot was taken at
(`X-Room-Cursor: <epoch>:<seq>`), the api reads the room's ledger for that tab
(`GET /ledger` on the DO stub, internal only) and merges into the incoming tab
only the entries sequenced after that cursor (`fetchRoomLedger` + `applyRoomLedger` in
`room-client.ts`, `mergeLedgerIntoTab` in `collab-ledger.ts`) before writing.
A save with no cursor (the unload beacon, an API token, the MCP server), or a
cursor from another epoch, isn't merged. Each ledger entry is re-applied through `applyElementDelta`, so
the merge is exactly what a peer receiving those deltas would do: answers
are re-set or withdrawn, ticks re-set, votes replaced for the same round,
and ideas the snapshot is missing appended (per text, as many copies as
the ledger holds, since cards have no ids). A ledger for another round
than the incoming element's is ignored: the save carries a clear the
ledger hasn't seen a delta for yet.

If the room can't be reached, the save goes through unmerged, as before.
Every server-stored document has a room, since an agent is a second writer
even on a personal one ([Agent changesets](../024-agents/agent-changesets.md#rooms-for-personal-documents));
an agent's changesets merge into a save by their own rule, not through this ledger.

**Comments are in the ledger**: the room stamps their authors, so a merged comment is credited to its author, not
to the saver.

Residual, stated plainly: the merge and the write are two steps, so two
saves whose merge and write interleave can still land the older merge
last. The window is the length of one write, not the 600 ms debounce,
and the next save from anybody repairs it.

## Cleared fields, view-role comments and session buttons

- **A cleared tab field travels by name.** A `tab-meta` op carries a
  `clear` list of the fields the sender removed, and receivers delete them.
  Clear Timer and Clear Vote (and a reset background) never fall back to a
  whole-`tab` op, which would replace every element on every receiver and wipe
  their unsaved presses. Whole-tab ops are only for a new tab and a bulk
  change.
- **A view-role comment reaches the room.** The comment endpoints (the only
  write a view-role visitor has) hand the room the same `comment-add` /
  `comment-remove` delta an editor's comment sends, through an internal
  `POST /mutation` on the Durable Object, which sequences, logs and records it
  like a peer's op. Editors see it at once and their next save keeps it. The relayed
  comment carries no `authorId` (the author's owner id, which a tab GET
  redacts for everyone else); the author's own browser keeps it when it swaps
  its local comment id for the server's.
- **The idea box refuses a card past `IDEA_MAX_CARDS`** at the press.
- **A session button can't start a vote over a running one.** Pressing a
  vote button mid-vote is a no-op, so it never resets every dot on the
  canvas; ending the vote stays with the vote's own controls.
- **The live poll survives a socket.** The room keeps the running poll and
  every answer (`live-poll` in its storage) and replays them to each session
  on hello, so a late joiner, a refresh and a reconnecting host all catch up.
  Answers are keyed by the answerer's collab key (`poll-answer.key`), so a
  re-answer after a reconnect replaces the first instead of counting twice. A
  poll records its starter's key (`LivePoll.hostKey`), so the host can still
  end it after a refresh. Two polls started at once converge: the room and
  every client keep the newer start (`pollSupersedes`, then id), so the
  starter of the loser switches rather than answering the other poll alone.
- **Votes are keyed by the collab key.** Dots, the budget and the host
  (`startedBy`) use `participantKey`, not the owner id, which is a guest's
  credential and which every dot op broadcast to the whole room.

## Author ids, reconnects and the other edges

- **Comment author ids stay off the wire.** A comment's `authorId` is its
  author's owner id, a guest's credential. The store keeps it (delete-own needs it)
  and a tab GET redacts it for everyone but the author, but every element op,
  whole-tab op and comment delta carried it to every socket in the room. One
  definition, `opForTheWire`, strips it from any op, and it runs at the two
  choke points: the editor's socket `send` (room.ts) and the room's relay of
  every mutation, so neither a new send path nor an old client can leak one.
  The author's own local copy keeps it, which is what drives their delete
  button.
- **Comments are in the ledger, credited as posted.** The room stamps each
  comment an editor posts with the sending session's presence name and colour
  (the identity already on that person's cursor) (`stampCommentAuthor`). The ledger records adds, removes and the latest
  resolve, and a save merges the ones the saver hadn't seen, in the order the
  room took them. The api stamps every comment new to the stored tab with the saver's identity, so a save that
  reaches the store before the author's own would credit the author's comment to the saver;
  `rewriteCommentAuthors` credits such a comment
  with the name the room saw it posted under, leaves its author id empty, and
  lets the author's own save (the only copy carrying their id) claim it. A
  comment that already has an author id is never re-claimed.
- **Ops sent while the socket is down are held, not dropped.** The room
  client keeps an outbox of document ops and poll answers (bounded at 500)
  and flushes it, in order, right after the reconnect's hello and sync.
  Cursors, selections and other presence ops are not held.

Residual, stated plainly: comment names are the sender's own choice; a comment carries the name of the session that
posted it rather than of whoever saved first.

## The room has a save's deltas before the save is written

The ledger can only protect a change it holds when a peer's save reads it, so a save sends every op the ledger
records (`el-delta`, `vote`) first, waits until the room confirms it sequenced each one, and only then PUTs; its
element ops still follow the PUT. Most deltas meet this by going out at the press, 600 ms before any save. Sent after
the PUT, two people saving at once could each write before either delta reached the room: the later write merged
nothing and erased the earlier change from the store, while both screens, converged by the deltas, never saved again.

- The confirmation is the `cursor` frame the room already sends the sender of each ordered op, carrying back the
  `ref` the client put on the op.
- A room that does not confirm within `ROOM_SEQUENCE_ACK_TIMEOUT_MS` (a socket down or a slow room) does not hold
  the save back; it is logged (`[room] op not confirmed in time`), and the save goes through as before.
- Peers therefore see a change before the store holds it; a save that then fails sends the same delta again with its
  retry, and applying a delta twice lands on the same tab.

## Saves

A tab's writes are queued per tab (`tab-save-queue.ts`): a save holding ledger changes waits up to
`ROOM_SEQUENCE_ACK_TIMEOUT_MS` for the room before its PUT, and a newer save of the same tab overtaking it would
leave the server with the older snapshot while the client believed the newer one saved. So each save or delete of a
tab starts only once that tab's previous one has settled, landed or failed; different tabs never wait on each other.

### A save that wrote over a peer's change writes again

The store still keeps each tab as the last PUT wrote it, and a PUT carries the saver's whole tab. When two people edit one
tab at once, a save snapshotted before a peer's change reached the saver can land after the peer's own save, and the store
then holds the saver's older copy of the peer's elements. Every screen showed the peer's change (the room converged),
but a reload lost it, for good when nobody edited that tab again: in a two-person drag test it happened in five
runs out of nine.

So a save's window stays open `SAVE_RESAVE_GRACE_MS` (1.5 s) after it lands, and if a peer's element change (`el`,
`tab` or `tab-meta`) to a tab it wrote arrived from its snapshot to the end of that window
(`tabsChangedByPeersSince`), the tab is written again with what is on screen. The peer's change is already in the
save baseline, so the second save sends no ops; it is the PUT alone. The grace covers a peer whose op left only after
their own write landed, a round trip behind ours. A failed write again stays queued for the retry. It stops by itself:
a write again sends nothing, so it starts no further one, and only a peer still editing keeps it going.

## Tab lists

A peer's `document-meta` op carries the tab list as of their last save. On screen it keeps what this editor has not
saved yet (`keepUnsavedTabChanges`, judged against the save baseline as it was before the op): a tab added here and
not yet saved stays, after the tab it followed, and a tab deleted here and not yet saved stays deleted. Replacing the
screen with the list dropped a new tab before its first save, and brought a deleted one back as an empty placeholder
whose next save emptied the real tab for everyone. The baseline takes the list as it is.
