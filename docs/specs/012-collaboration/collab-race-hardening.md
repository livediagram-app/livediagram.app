# Collaboration race hardening

Status: **implemented** (phases 1 to 5).

A room of people pressing the same cards at once must not lose, duplicate or
retract anybody's action. The dot-vote was fixed for this first ([Session tools (timer + voting)](session-tools.md),
"Casting a dot"). A review of every element used during collaboration found
the same failure in the done check, estimate, temperature, idea box,
checklist and comment threads, plus a handful of transport bugs underneath
all of them. This spec records what the review found and the order it is
being fixed in.

## Why presses were lost

Six shared causes. Most element bugs are one of these showing through.

1. **A press ships the whole element, late.** An element change only leaves
   the browser through the autosave (600 ms debounce, then the D1 PUT, then
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
4. **A remote op cancelled the pending local save.** The autosave skipped
   one run whenever `remoteUpdateRef` was set. A peer's op arriving within
   600 ms of a local press cancelled the press's save and broadcast
   outright; a remote op that changed nothing left the flag set and
   swallowed the next local change instead.
5. **D1 is last writer wins.** Every client PUTs whole tabs, and the api
   replaces the stored blob, so a reload or late joiner sees whichever save
   landed last.
6. **Whole-tab fallbacks.** A cleared field (Clear Timer, Clear Vote) or a
   change of more than 20 elements travels as a whole `tab` op, which
   replaces every element on receivers, wiping their unsaved presses.

## Phase 1 (shipped): stop the client losing its own and its peers' work

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
  remote-only change is not a local change and the `remoteUpdateRef` skip is
  gone from the autosave. Nothing cancels a local save any more.
- **A vote has a round** ([Session tools (timer + voting)](session-tools.md)). `TabVote.round` is minted at Start and
  carried on every `vote` op. A dot for a different round, or for a vote
  that is not open, is dropped. Within one round the votes map only ever
  moves by deltas: a lifecycle patch (End, Reveal, the walkthrough) or a
  whole-tab op for the SAME round keeps the receiver's map, so it can no
  longer erase dots still in flight.

## Phase 2 (shipped): per-participant fields travel as their own ops

The dot-vote pattern for every field many people write at once. A new room
op, `{ kind: 'el-delta', tabId, elementId, delta }` (a MUTATION: sequenced,
logged for catch-up, refused from a view-role sender), carries ONE change,
applied by the sender and every receiver through the same pure
`applyElementDelta` (`packages/diagram/src/element-deltas.ts`):

- `response`: one participant's answer set, or withdrawn with `null`, keyed
  by `participantKey` (done check, estimate, temperature).
- `idea`: one anonymous card appended. No author, still ([Idea box](idea-box.md)). The box
  refuses a card past `IDEA_MAX_CARDS`, at the press and on apply, so a
  full box can no longer fail the tab's validation on save.
- `check`: one checklist row ticked or unticked. Rows have no ids, so the
  row is named by index AND text; a peer who moved or retitled rows gets the
  row with that text, or nothing. A tick is no longer undoable.
- `comment-add` / `comment-remove` / `comment-rekey` / `comment-resolve`:
  one change to a thread, by comment id, so a replay is a no-op.

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

Decisions against the plan above: idea cards did not get ids (the round and
the keep-ours merge make them unnecessary, and the field stays a plain
string list), and checklist rows are matched by index and text rather than
given ids, for the same reason: no schema change.

Still open until phase 4: a view-role comment goes through its REST
endpoint, not a delta (the room drops view-role mutations), so editors still
don't see it live.

## Phase 3 (shipped): D1 stops overwriting multi-writer fields

Phase 2 made the room converge, but every client still PUT whole tabs and
the api replaced the stored blob, so D1 held whichever save landed last. A
save snapshotted before somebody's answer arrived erased it from D1, and a
reload showed fewer marks than the room had seen.

**The room keeps a ledger.** For every `el-delta` and `vote` op it
sequences, the Durable Object records the change in a small per-element
ledger in its own storage (`packages/diagram/src/collab-ledger.ts`, pure;
the DO only stores it):

- answers: each participant's LATEST cast or withdraw in the element's
  current round;
- ideas: the cards posted this round, in order;
- checklist ticks: each row's latest state, by index and text;
- dots: the round's votes map, rebuilt from its deltas (a round always
  starts empty, so the deltas are the whole map).

A delta for a new round replaces that element's answers and ideas (ticks
carry over, since rows have no round). One storage key per element, and
a ledger that would outgrow the storage value limit stops recording rather
than failing.

**A save is merged with it.** When a tab PUT arrives for a diagram with a
room (shared, or in a team), the api asks the room to merge its ledger into
the incoming tab (`POST /merge-tab` on the DO stub, internal only) before
writing. Each ledger entry is re-applied through `applyElementDelta`, so
the merge is exactly what a peer receiving those deltas would do: answers
are re-set or withdrawn, ticks re-set, votes replaced for the same round,
and ideas the snapshot is missing appended (per text, as many copies as
the ledger holds, since cards have no ids). A ledger for another round
than the incoming element's is ignored: the save carries a clear the
ledger hasn't seen a delta for yet.

If the room can't be reached, the save goes through unmerged, as before.
A diagram with no room (never shared, not in a team) has one writer and
isn't merged.

**Comments joined the ledger in phase 5**, once the room stamped their
authors; at first they were left out, because the api credits every comment
new to D1 to the saver and a merged comment would have been credited wrongly.

Residual, stated plainly: the merge and the D1 write are two steps, so two
saves whose merge and write interleave can still land the older merge
last. The window is the length of one D1 write, not the 600 ms debounce,
and the next save from anybody repairs it.

## Phase 4 (shipped): the rest

- **A cleared tab field travels by name.** A `tab-meta` op carries a
  `clear` list of the fields the sender removed, and receivers delete them.
  Clear Timer and Clear Vote (and a reset background) used to fall back to a
  whole-`tab` op, which replaced every element on every receiver and wiped
  their unsaved presses. Whole-tab ops remain only for a new tab and a bulk
  change.
- **A view-role comment reaches the room.** The comment endpoints (the only
  write a view-role visitor has) now hand the room the same `comment-add` /
  `comment-remove` delta an editor's comment sends, through an internal
  `POST /mutation` on the Durable Object, which sequences, logs and records it
  like a peer's op. Editors see it at once and their next save keeps it; it
  used to reach D1 only, and the next editor save erased it. The relayed
  comment carries no `authorId` (the author's owner id, which a tab GET
  redacts for everyone else); the author's own browser keeps it when it swaps
  its local comment id for the server's.
- **The idea box refuses a card past `IDEA_MAX_CARDS`** at the press
  (shipped with phase 2).
- **A session button can't start a vote over a running one.** Pressing a
  vote button mid-vote used to start a fresh vote, which reset every dot on
  the board. It is now a no-op; ending the vote stays with the vote's own
  controls.
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

## Phase 5 (shipped): the loose ends

- **Comment author ids stay off the wire.** A comment's `authorId` is its
  author's owner id, a guest's credential. D1 keeps it (delete-own needs it)
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
  room took them. Crediting was wrong before this in a way that predates the
  branch: the api stamps every comment NEW to D1 with the saver's identity, so
  a save that reached D1 before the author's own credited the author's
  comment to the saver. `rewriteCommentAuthors` now credits such a comment
  with the name the room saw it posted under, leaves its author id empty, and
  lets the author's own save (the only copy carrying their id) claim it. A
  comment that already has an author id is never re-claimed.
- **Ops sent while the socket is down are held, not dropped.** The room
  client keeps an outbox of document ops and poll answers (bounded at 500)
  and flushes it, in order, right after the reconnect's hello and sync.
  Cursors, selections and other presence ops are not held.

Residual, stated plainly: comment names are the sender's own choice, as they
are on the participant record the api used before; what changed is that a
comment now carries the name of the session that posted it rather than of
whoever saved first.
