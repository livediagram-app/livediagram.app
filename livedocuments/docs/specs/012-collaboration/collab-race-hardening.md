# Collaboration race hardening

Status: **implemented** (phases 1 to 5).

A room of people pressing the same elements at once must not lose, duplicate or
retract anybody's action. A review of every element several people write at once found
the same failure in checklist ticks and comment threads, plus a handful of transport bugs underneath
both. This spec records what the review found and the order it is
being fixed in.

## Why presses were lost

Six shared causes. Most element bugs are one of these showing through.

1. **A press ships the whole element, late.** An element change only leaves
   the browser through the autosave (600 ms debounce, then the PUT, then
   the broadcast), as an `el` `update` op that replaces the whole element on
   every receiver ([Realtime conflict resolution](realtime-conflict-resolution.md)). Two presses on one element inside that window
   overwrite each other.
2. **Collaborative presses pushed undo history.** `useCollabElements` wrote
   through `commitTabs`, which pushes an undo step, although a press several people make must not be undoable. Ctrl+Z withdrew your own
   tick and anyone else's that had arrived since the snapshot, for the whole room.
3. **The save baseline ignored remote ops.** `lastSavedTabsRef` was not
   updated when a peer's op was applied, so the next local save diffed
   against a pre-remote snapshot and re-broadcast the peer's elements in the
   local, possibly stale, form.
4. **A remote op cancelled the pending local save.** The autosave skipped
   one run whenever `remoteUpdateRef` was set. A peer's op arriving within
   600 ms of a local press cancelled the press's save and broadcast
   outright; a remote op that changed nothing left the flag set and
   swallowed the next local change instead.
5. **The store is last writer wins.** Every client PUTs whole tabs, and the api
   replaces the stored blob, so a reload or late joiner sees whichever save
   landed last. (Multi-writer fields merge since phase 3; element content is
   written again by the saver that may have landed last, see
   [A save that wrote over a peer's change writes again](#a-save-that-wrote-over-a-peers-change-writes-again).)
6. **Whole-tab fallbacks.** A cleared tab field (a reset background) or a
   change of more than 20 elements travels as a whole `tab` op, which
   replaces every element on receivers, wiping their unsaved presses.

## Phase 1 (shipped): stop the client losing its own and its peers' work

- **Collaborative presses do not push undo** (cause 2). Ticking a checklist
  row and changing a comment thread go through the non-history `tickTabs`.
- **Undo re-grafts every live collaborative field** (cause 2). `commentThread`,
  `action` and the checklist ticks are in `LIVE_ELEMENT_FIELDS`, so restoring a
  snapshot keeps their present values.
- **The save baseline follows remote ops** (causes 3 and 4). Every applied
  remote op is also folded into `lastSavedTabsRef` through the same pure
  function the receiver uses (`applyRoomOpToTabs`). A save that was in
  flight re-folds the ops that arrived during it when it lands, so its
  success does not roll the baseline back. The save diff compares tab
  CONTENT when identity differs (a remote op makes a new tab object), so a
  remote-only change is not a local change and the `remoteUpdateRef` skip is
  gone from the autosave. Nothing cancels a local save any more.

## Phase 2 (shipped): per-participant fields travel as their own ops

For every field many people write at once, a room
op, `{ kind: 'el-delta', tabId, elementId, delta }` (a MUTATION: sequenced,
logged for catch-up, refused from a view-role sender), carries ONE change,
applied by the sender and every receiver through the same pure
`applyElementDelta` (`packages/document/src/element-deltas.ts`):

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
  (`mergeIncomingElement`): everything else is taken, but checklist ticks and the comment thread stay ours, because every change to
  them reached us as a delta. The sender's copy is a snapshot from their
  last save and can be missing somebody.
- **Senders don't restate them.** The autosave drops an `el` update whose
  only change is in those fields (`elementChangeIsDeltaOnly`).

Checklist rows are matched by index and text rather than given ids (no schema change).

Still open until phase 4: a view-role comment goes through its REST
endpoint, not a delta (the room drops view-role mutations), so editors still
don't see it live.

## Phase 3 (shipped): the store stops overwriting multi-writer fields

Phase 2 made the room converge, but every client still PUT whole tabs and
the api replaced the stored blob, so the store held whichever save landed last. A
save snapshotted before somebody's tick arrived erased it from the store, and a
reload showed fewer marks than the room had seen.

**The room keeps a ledger.** For every `el-delta` op it
sequences, the Durable Object records the change in a small per-element
ledger in its own storage (`packages/document/src/collab-ledger.ts`, pure;
the DO only stores it):

- checklist ticks: each row's latest state, by index and text;
- comments: adds, removes and each thread's latest resolve (since phase 5).

One storage key per element, and
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
the merge is exactly what a peer receiving those deltas would do: ticks are re-set and
comments the snapshot is missing are added.

If the room can't be reached, the save goes through unmerged, as before.
Every server-stored document has a room, since an agent is a second writer
even on a personal one ([Agent changesets](../024-agents/agent-changesets.md#rooms-for-personal-documents));
an agent's changesets merge into a save by their own rule, not through this ledger.

**Comments joined the ledger in phase 5**, once the room stamped their
authors; at first they were left out, because the api credits every comment
new to the store to the saver and a merged comment would have been credited wrongly.

Residual, stated plainly: the merge and the store's write are two steps, so two
saves whose merge and write interleave can still land the older merge
last. The window is the length of one store write, not the 600 ms debounce,
and the next save from anybody repairs it.

## Phase 4 (shipped): the rest

- **A cleared tab field travels by name.** A `tab-meta` op carries a
  `clear` list of the fields the sender removed, and receivers delete them.
  A reset background used to fall back to a
  whole-`tab` op, which replaced every element on every receiver and wiped
  their unsaved presses. Whole-tab ops remain only for a new tab and a bulk
  change.
- **A view-role comment reaches the room.** The comment endpoints (the only
  write a view-role visitor has) now hand the room the same `comment-add` /
  `comment-remove` delta an editor's comment sends, through an internal
  `POST /mutation` on the Durable Object, which sequences, logs and records it
  like a peer's op. Editors see it at once and their next save keeps it; it
  used to reach the store only, and the next editor save erased it. The relayed
  comment carries no `authorId` (the author's owner id, which a tab GET
  redacts for everyone else); the author's own browser keeps it when it swaps
  its local comment id for the server's.

## Phase 5 (shipped): the loose ends

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
  room took them. Crediting was wrong before this in a way that predates the
  branch: the api stamps every comment NEW to the store with the saver's identity, so
  a save that reached the store before the author's own credited the author's
  comment to the saver. `rewriteCommentAuthors` now credits such a comment
  with the name the room saw it posted under, leaves its author id empty, and
  lets the author's own save (the only copy carrying their id) claim it. A
  comment that already has an author id is never re-claimed.
- **Ops sent while the socket is down are held, not dropped.** The room
  client keeps an outbox of document ops (bounded at 500)
  and flushes it, in order, right after the reconnect's hello and sync.
  Cursors, selections and other presence ops are not held.

Residual, stated plainly: comment names are the sender's own choice, as they
are on the participant record the api used before; what changed is that a
comment now carries the name of the session that posted it rather than of
whoever saved first.

## Saves

A save sends every op the ledger records first and waits, up to `ROOM_SEQUENCE_ACK_TIMEOUT_MS`, until the room
confirms it sequenced each one (the `cursor` frame the room sends the sender of each ordered op, carrying back the op's
`ref`), and only then PUTs, so a peer's save always finds the change in the ledger. A room that does not confirm in
time does not hold the save back; it is logged, and the save goes through.

A tab's writes are queued per tab (`tab-save-queue.ts`): a save waiting on the room, and a newer save of the same tab used to overtake it, so
the server kept the older snapshot while the client believed the newer one saved and peers received the older
element ops last. Each save or delete of a tab now starts only once that tab's previous one has settled, landed or
failed; different tabs never wait on each other.

### A save that wrote over a peer's change writes again

The document's store (its Durable Object's SQLite) keeps each tab as the last PUT wrote it, and a PUT carries the saver's whole tab. When two people edit one
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
