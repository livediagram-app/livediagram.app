# Collaboration race hardening

A room of people pressing the same cards at once must not lose, duplicate or
retract anybody's action. The dot-vote ([Session tools (timer + voting)](session-tools.md), "Casting a dot"), the temperature
check, the checklist and comment threads share the same hazards, and the transport underneath all of them. This spec
names the hazards and the design that answers each.

## How a press can be lost

Six shared hazards, each answered below. Most element bugs would be one of these showing through.

1. **A press ships the whole element, late.** An element change leaves the browser through the autosave (600 ms
   debounce, then the tab PUT, then the broadcast), as an `el` `update` op that replaces the whole element on every
   receiver ([Realtime conflict resolution](realtime-conflict-resolution.md)). Two presses on one card inside that
   window would overwrite each other, so per-participant fields travel as their own ops.
2. **Undo could withdraw a press.** A press written through the history-pushing `commitTabs` would let Ctrl+Z
   withdraw your own answer, and anyone else's that arrived since the snapshot, for the whole room
   ([Per-participant responses](participant-responses.md)).
3. **A stale save baseline re-broadcasts peers' work.** A baseline that does not follow applied remote ops makes the
   next local save diff against a pre-remote snapshot and re-send the peer's elements in the local, possibly stale,
   form (and every participant's first save after a vote starts re-send the whole dots map).
4. **A remote op must not cancel a local save.** An autosave that skipped its next run after a remote op would lose
   a local press made within the debounce, or swallow the next local change after a remote op that changed nothing.
5. **The store is last writer wins.** Every client PUTs whole tabs, and the api replaces the stored blob, so a reload
   or late joiner sees whichever save landed last. (Multi-writer fields merge, see
   [The store keeps multi-writer fields](#the-store-keeps-multi-writer-fields); element content is written again by
   the saver that may have landed last, see
   [A save that wrote over a peer's change writes again](#a-save-that-wrote-over-a-peers-change-writes-again).)
6. **Whole-tab fallbacks.** A cleared field (Clear Timer, Clear Vote) or a change of more than 20 elements travels as
   a whole `tab` op, which replaces every element on receivers, so it must not wipe their unsaved presses.

## The client keeps its own and its peers' work

- **Collaborative presses do not push undo** (hazard 2). Casting or
  withdrawing a response, clearing and the picker's roll all go through the
  non-history `tickTabs`, as the vote does.
- **Undo re-grafts every live collaborative field** (hazard 2). The fields a
  press writes (`responses`, `pickerResult`) join
  `commentThread` and `action` in `LIVE_ELEMENT_FIELDS`, so restoring a
  snapshot keeps their present values.
- **The save baseline follows remote ops** (hazards 3 and 4). Every applied
  remote op is also folded into `lastSavedTabsRef` through the same pure
  function the receiver uses (`applyRoomOpToTabs`). A save that was in
  flight re-folds the ops that arrived during it when it lands, so its
  success does not roll the baseline back. The save diff compares tab
  CONTENT when identity differs (a remote op makes a new tab object), so a
  remote-only change is not a local change, and nothing cancels a local save.
- **A vote has a round** ([Session tools (timer + voting)](session-tools.md)). `TabVote.round` is minted at Start and
  carried on every `vote` op. A dot for a different round, or for a vote
  that is not open, is dropped. Within one round the votes map only ever
  moves by deltas: a lifecycle patch (End, Reveal, the walkthrough) or a
  whole-tab op for the SAME round keeps the receiver's map, so it never
  erases dots still in flight.

## Per-participant fields travel as their own ops

The dot-vote pattern for every field many people write at once. A new room
op, `{ kind: 'el-delta', tabId, elementId, delta }` (a MUTATION: sequenced,
logged for catch-up, refused from a view-role sender), carries ONE change,
applied by the sender and every receiver through the same pure
`applyElementDelta` (`packages/project/src/element-deltas.ts`):

- `response`: one participant's answer set, or withdrawn with `null`, keyed
  by `participantKey` (the temperature check).
- `check`: one checklist row ticked or unticked. Rows have no ids, so the
  row is named by index AND text; a peer who moved or retitled rows gets the
  row with that text, or nothing. A tick is not undoable.
- `comment-add` / `comment-remove` / `comment-rekey` / `comment-resolve`:
  one change to a thread, by comment id, so a replay is a no-op. An add and a
  resolve may name a Sheet cell (`cell`), for that cell's thread
  ([Cell comments](../029-sheets/sheet.md#cell-comments)); a remove and a rekey
  find their comment in whichever thread holds it. The ledger keeps an add's
  cell and each cell's latest resolve.

Every delta is idempotent or order-free, so concurrent presses commute, and
a malformed frame is dropped rather than applied.

Two rules keep the whole-element path from undoing it:

- **Receivers keep their own copy of these fields.** An `el` add/update or
  an element inside a whole `tab` op is merged over the local element
  (`mergeIncomingElement`): everything else is taken, but answers,
  checklist ticks and the comment thread stay ours, because every change to
  them reached us as a delta. The sender's copy is a snapshot from their
  last save and can be missing somebody.
- **Senders don't restate them.** The autosave drops an `el` update whose
  only change is in those fields (`elementChangeIsDeltaOnly`).

**A round per card.** `ShapeElement.collabRound` is a random id minted by
Clear (Reset Answers). Answer deltas carry it; one naming another round is dropped, so a press from before
a clear can't land in the next round or re-open it. A whole-element update
with a DIFFERENT round replaces the answers (that is how a clear
reaches everyone). Undo re-grafts `collabRound` and the checklist ticks with
the other live fields.

Checklist rows are matched by index and text rather than given ids, so no schema change is needed.

## The store keeps multi-writer fields

The deltas make the room converge, but every client PUTs whole tabs, and a store that replaced the blob would hold
whichever save landed last: a save snapshotted before somebody's answer arrived would erase it from the store, and a
reload would show fewer marks than the room had seen.

**The room keeps a ledger.** For every `el-delta` and `vote` op it
sequences, the Durable Object records the change in a small per-element
ledger in its own storage (`packages/project/src/collab-ledger.ts`, pure;
the DO only stores it):

- answers: each participant's LATEST cast or withdraw in the element's
  current round;
- checklist ticks: each row's latest state, by index and text;
- dots: the round's votes map, rebuilt from its deltas (a round always
  starts empty, so the deltas are the whole map).

A delta for a new round replaces that element's answers (ticks
carry over, since rows have no round) and retires the round it replaced; a
`vote` op for a new vote round does the same to the dots. The entry keeps the
last `RETIRED_ROUNDS_MAX` (16) retired rounds, and an op naming one is late
and dropped: before, a late answer, dot or even a withdraw from the
previous round flipped the entry back to it and lost the current round's
answers or dots. One storage key per element, and
a ledger that would outgrow the storage value limit stops recording rather
than failing.

**A save is merged with it.** When a tab PUT arrives for a project with a
room carrying the room cursor its snapshot was taken at
(`X-Room-Cursor: <epoch>:<seq>`), the api reads the room's ledger for that tab
(`GET /ledger` on the DO stub, internal only) and merges into the incoming tab
only the entries sequenced after that cursor (`fetchRoomLedger` + `applyRoomLedger` in
`room-client.ts`, `mergeLedgerIntoTab` in `collab-ledger.ts`) before writing.
A save with no cursor (the unload beacon, an API token, the MCP server), or a
cursor from another epoch, isn't merged. Each ledger entry is re-applied through `applyElementDelta`, so
the merge is exactly what a peer receiving those deltas would do: answers
are re-set or withdrawn, ticks re-set, and votes replaced for the same round. A ledger for another round
than the incoming element's is ignored: the save carries a clear the
ledger hasn't seen a delta for yet.

If the room can't be reached, the save goes through unmerged, as before.
Every server-stored project has a room, since an agent is a second writer
even on a personal one ([Agent changesets](../024-agents/agent-changesets.md#rooms-for-personal-projects));
an agent's changesets merge into a save by their own rule, not through this ledger.

**Comments are in the ledger**, because the room stamps their authors: the api credits a comment new to the store
to the session that posted it, not to the saver.

Residual, stated plainly: the merge and the write are two steps, so two
saves whose merge and write interleave can still land the older merge
last. The window is the length of one write, not the 600 ms debounce,
and the next save from anybody repairs it.

## Cleared fields, view-role comments and votes

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
  like a peer's op. Editors see it at once and their next save keeps it, where a
  comment reaching the store only would be erased by the next editor save. The relayed
  comment carries no `authorId` (the author's owner id, which a tab GET
  redacts for everyone else); the author's own browser keeps it when it swaps
  its local comment id for the server's.
- **A session button can't start a vote over a running one.** Pressing a
  vote button mid-vote is a no-op, since a fresh vote would reset every dot on
  the canvas; ending the vote stays with the vote's own
  controls.
- **Votes are keyed by the collab key.** Dots, the budget and the host
  (`startedBy`) use `participantKey`, not the owner id, which is a guest's
  credential and which every dot op broadcast to the whole room.

## The loose ends

- **Comment author ids stay off the wire.** A comment's `authorId` is its
  author's owner id, a guest's credential. The store keeps it (delete-own needs it)
  and a tab GET redacts it for everyone but the author; element ops, whole-tab ops
  and comment deltas would carry it to every socket in the room. One
  definition, `opForTheWire`, strips it from any op, and it runs at the two
  choke points: the editor's socket `send` (room.ts) and the room's relay of
  every mutation, so neither a new send path nor an old client can leak one.
  The author's own local copy keeps it, which is what drives their delete
  button.
- **Comments are in the ledger, credited as posted.** The room stamps each
  comment an editor posts with the sending session's presence name and colour
  (the identity already on that person's cursor) (`stampCommentAuthor`). The ledger records adds, removes and the latest
  resolve, and a save merges the ones the saver hadn't seen, in the order the
  room took them. The api stamps every comment NEW to the store with the saver's identity, so a save that reached
  the store before the author's own would credit the author's comment to the saver. `rewriteCommentAuthors` credits
  such a comment
  with the name the room saw it posted under, leaves its author id empty, and
  lets the author's own save (the only copy carrying their id) claim it. A
  comment that already has an author id is never re-claimed.
- **Ops sent while the socket is down are held, not dropped.** The room
  client keeps an outbox of project ops (bounded at 500)
  and flushes it, in order, right after the reconnect's hello and sync.
  Cursors, selections and other presence ops are not held.

Residual, stated plainly: comment names are the sender's own choice, as on any participant record; a comment
carries the name of the session that posted it rather than of whoever saved first.

## A Plan board's set-up travels as deltas

A [Plan board](../026-plan/plan-board.md) keeps its whole set-up (title, columns, rows, card fields,
widgets, voting) in one element field, `planBoard`, and its column cogs and its menu's board rows edit it
WITHOUT selecting the board, so the selection lock never heads off a collision. Two people setting
up one board at once, say one renaming To do while the other renames Review, would each send a
whole-element `update`, each receiver would take the other's copy, and the two screens would end up holding
different boards (each with only the other's rename), while the store kept whichever save landed last. A
whole-element update is not last-writer-wins in room order on the sender's own screen, because the
room never sends a sender its own op back: it is last-writer-wins on every OTHER screen.

So the set-up moves the way the other multi-writer fields do:

- **A `board` delta carries the change, not the set-up.** `planBoardPatch(before, after)`
  (`packages/project/src/plan-board-patch.ts`) names only what changed: the top-level fields set
  or cleared, each column's changed fields (by column id), columns added (whole) and removed (by
  id), and the new column order when it moved. Applied through `applyPlanBoardPatch`, so edits to
  different fields, or to different columns, or a field and a column, commute: every peer lands on
  one board. A malformed patch, or one whose result is not a readable set-up
  (`normaliseBoardSetup`), is dropped.
- **Derived in the autosave, so every path sends it.** `tabBroadcastOps` emits one `el-delta` per
  board whose `planBoard` changed, beside the element ops, in the granular path and the bulk
  (whole-tab) path alike. A column cog, the Board and Cards flyouts, a widget added from the
  palette, and undo or redo all reach peers the same way.
- **The room has the delta before the save is written.** The ledger can only protect a change it
  holds when a peer's save reads it, so a save sends every op the ledger records (`el-delta`,
  `vote`) first, waits until the room confirms it sequenced each one, and only then PUTs; its
  element ops still follow the PUT. The other deltas meet this by going out at the press, 600 ms
  before any save. Sent after the PUT, as the board delta first was, two people saving at once
  could each write before either delta reached the room: the later write merged nothing and erased
  the earlier rename from the store, while both screens, converged by the deltas, never saved again.
  The confirmation is the `cursor` frame the room already sends the sender of each ordered op,
  carrying back the `ref` the client put on the op. A room that does not confirm within
  `ROOM_SEQUENCE_ACK_TIMEOUT_MS` (a socket down or a slow room) does not hold the save back; it is
  logged, and the save goes through as before. Peers therefore see a board change before the store holds
  it; a save that then fails sends the same delta again with its retry, and applying it twice
  lands on the same board.
- **A column move keeps a concurrent add.** The order names the columns the sender had; a column
  only the receiver has (added meanwhile by someone else) stays beside the column it followed.
- **Receivers keep their own set-up through a peer's whole-element copy** (`mergeIncomingElement`),
  as they keep answers and ticks, and the sender drops an element update whose only change was
  the set-up (`elementChangeIsDeltaOnly`). An agent's changeset is the exception: it is a writer
  with no deltas, so its copy of the set-up is taken.
- **The ledger records it.** For each board, the latest value of every top-level field and every
  column field, each column added or removed, and the latest order, each with the seq that set it.
  A save merges in only the entries the saver had not seen ([The store keeps multi-writer fields](#the-store-keeps-multi-writer-fields)), so the store keeps both renames.

Residual, stated plainly: two people changing the SAME field of the same column (both renaming To
do) in the same moment still each see the other's value, exactly as a same-element collision on
any shape does; the next change to that field from either side settles it.

## A Dashboard's layout travels as deltas

A [Dashboard tab](../026-plan/plan-tabs.md#dashboard-tab) keeps its whole layout (rows, slots, spans, heights, what
each slot shows, the background) in one tab field, `dashboard`, edited from handles and cogs that select nothing.
It used to travel whole in the `tab-meta` patch, which each receiver spread over its own tab, and the tab PUT stored
it whole too. So when one Editor pressed Arrow Down on a row's resize handle while another, at the same moment,
pressed Arrow Left on a divider, each screen ended up showing only the other's change, the store kept whichever save
landed last (one change lost for good), and the second Editor's Undo did nothing, since the peer's whole layout had
been folded into every one of their undo snapshots. (Found by a browser bug hunt; the owner chose this design.)

So the layout moves the way a board's set-up does:

- **A `dashboard-delta` op carries the change, not the layout.** `{ kind: 'dashboard-delta', tabId, patch }`, a
  mutation (sequenced, logged for catch-up, recorded in the ledger) that only an Editor may send: the room drops it
  from a Viewer's socket and from a Participant's, like every mutation that is not taking part, and from a tab-scoped
  session for any other tab. `dashboardPatch(before, after)` (`packages/project/src/dashboard-patch.ts`) names only
  what changed:
  - the layout's own fields set or cleared (`background`);
  - each row's changed fields, by row id (`height`, `fill`);
  - each slot's changed fields, by slot id: `span`, and what it shows: its `content` whole when it was filled,
    cleared or now shows another kind of thing, else each changed field of the content (`content.name`,
    `content.style`, `content.text`, and so on) on its own;
  - rows added (whole, with their slots) and removed (by id); slots added (whole, with the row they join) and
    removed (by id);
  - a row's slot ids in order, when a slot joined, left or moved within it; the row order, when a row moved or was
    added.
- **Applying one** (`applyDashboardPatch`), in this order:
  1. **A removal wins.** Removed rows and slots go first, and a change to a row or slot someone removed is dropped;
     a slot moved or added into a row someone removed goes with that row.
  2. **Placement.** A row's slot list puts the slots it names in that order, taking a slot out of whichever row it
     was in; a slot the list does not name but the row holds (one added there meanwhile by somebody else) stays
     beside the slot it followed. An added row arrives whole; an added slot joins its row where the row's list puts
     it, else at the row's right end. The row order follows its list the same way.
  3. **Fields by id.** Changes to different fields, rows or slots commute, so every screen lands on the same layout
     whatever order they arrive in.
  4. **Nothing is normalised in the apply.** Spans are kept as written and a read (`readDashboard`, which every
     screen, export and thumbnail draws through) fits them to twelve, so two screens holding the same fields draw the
     same layout. A row left with no slots is gone. A malformed patch is dropped whole.
- **The same field: the last writer wins, on every screen.** As with
  [Same-element edits](realtime-conflict-resolution.md#same-element-edits-converge): from a save's snapshot until the
  room confirms its delta, the fields the delta sets are **held** (`own-element-writes.ts`), and a peer's change to a
  held field, which reached this screen first and so was ordered first, is left out of the screen and the save
  baseline; the rest of that peer's patch applies. Every other screen applies both in room order, so all of them end
  on the later value. Two people pressing the same row's handle at once both see the later press.
- **Derived in the autosave, so every path sends it.** `tabBroadcastOps` emits one `dashboard-delta` for a tab whose
  layout changed, on the granular and the bulk (whole-tab) path alike: every handle, cog and drag, a slot filled from
  the palette, Duplicate, Clear and Remove, and undo or redo. A whole layout replaced in the editor (Start Over From a
  Layout, a Dashboard imported into its tab) is a patch too: the old rows removed, the new ones added, so a peer's
  change to an old row at that moment is dropped (a removal wins).
- **Whole values only where there is no layout to merge.** The `tab-meta` patch carries `dashboard` only when the
  tab gains one (Start Planning makes a Dashboard) or loses one (it becomes a Board or Sheet tab); a receiver takes
  that whole. A whole `tab` op from this editor (a bulk change) says `dashboardDeltas: true`, and a receiver that
  has a layout keeps its own through it, as it keeps a board's set-up.
- **The room has the delta before the save is written**, exactly as the board delta: a save sends its
  `dashboard-delta` first, waits for the room's confirmation, then PUTs, so a peer's save landing after it merges it
  from the ledger.
- **The ledger records it.** One entry per tab (`ledger:<tabId>:dash`, `packages/project/src/dashboard-ledger.ts`):
  the latest value of each layout, row and slot field, each row and slot added or removed, each row's latest slot
  list and the latest row order, each with the seq that set it. A save merges in only the entries the saver had not
  seen ([The store keeps multi-writer fields](#the-store-keeps-multi-writer-fields)), through the same apply, so the
  store keeps both people's changes. A row or slot removed keeps only the seq of its removal. A `content` set whole
  drops that slot's earlier per-field entries. At most 512 rows and slots are tracked per tab: past that the oldest
  removals are forgotten first, then new ones are not tracked (the save then carries itself, as before).
- **A whole layout from elsewhere is a reset.** An agent's `update_project` with a `dashboard` rebuilds the layout
  as one changeset ([Agent changesets](../024-agents/agent-changesets.md#what-the-room-does)). Its `changeset` op now
  carries the rebuilt layout (`dashboard`) when the layout changed, so every open editor takes it whole, on screen
  and in every undo and redo snapshot, where before an editor kept the old layout until a reload and its next save
  wrote that back. The ledger records it, and a `tab-meta` carrying a whole layout, as a **reset**: every earlier
  entry goes, and a save that had not seen it takes the reset layout plus every delta after it. A person's change
  to the old layout made before the rebuild is gone (the rebuild says it rebuilds); one made after it lands on the
  new layout wherever its rows and slots exist.
- **Undo takes back only your own change.** A peer's delta is applied to every undo and redo snapshot as well as to
  the screen ([Realtime conflict resolution](realtime-conflict-resolution.md#locked-decisions), "Undo is local"),
  field by field, so a restored snapshot already holds the peer's change and undo puts back only the fields you
  changed, as a delta like any other. A peer who changed the same field after you keeps their value through your
  undo.
- **Older editors and stored layouts.** The stored layout keeps its shape; nothing is added to it. An editor loaded
  before this change still sends whole layouts (`tab-meta` patches, `tab` ops without the flag), and receivers take
  those whole, as before. It does not know `dashboard-delta`, so until it reloads it shows a newer editor's layout
  changes only after a reload, and a save from it can write its older copy of the layout back (the same window the
  board delta had when it shipped).

Residual, stated plainly: two people restructuring the SAME row at the same instant (each adding, removing or moving
its slots) never lose or duplicate a slot, but in a rare interleaving the left-to-right order can differ between
their two screens until either changes that row again; the store keeps the room's order. A content field edited in
a slot whose content another person replaced whole at that instant can show on the first editor's screen only.

## Saves

A tab's writes are queued per tab (`tab-save-queue.ts`): a save holding Plan ledger changes waits up to
`ROOM_SEQUENCE_ACK_TIMEOUT_MS` for the room before its PUT. A newer save of the same tab overtaking it would leave the server with the older snapshot while the
client believed the newer one saved, so each save or delete of a tab starts only once that tab's previous one has settled, landed or
failed; different tabs never wait on each other.

### A save that wrote over a peer's change writes again

The store still keeps each tab as the last PUT wrote it, and a PUT carries the saver's whole tab. When two people edit one
tab at once, a save snapshotted before a peer's change reached the saver can land after the peer's own save, and the store
then holds the saver's older copy of the peer's elements. Every screen showed the peer's change (the room converged),
but a reload lost it, for good when nobody edited that tab again: in a two-person drag test it happened in five
runs out of nine.

So a save's window stays open `SAVE_RESAVE_GRACE_MS` (1.5 s) after it lands, and if a peer's element or layout change (`el`,
`tab`, `tab-meta` or `dashboard-delta`) to a tab it wrote arrived from its snapshot to the end of that window
(`tabsChangedByPeersSince`), the tab is written again with what is on screen. The peer's change is already in the
save baseline, so the second save sends no ops; it is the PUT alone. The grace covers a peer whose op left only after
their own write landed, a round trip behind ours. A failed write again stays queued for the retry. It stops by itself:
a write again sends nothing, so it starts no further one, and only a peer still editing keeps it going.

## Tab lists

A peer's `project-meta` op carries the tab list as of their last save. On screen it keeps what this editor has not
saved yet (`keepUnsavedTabChanges`, judged against the save baseline as it was before the op): a tab added here and
not yet saved stays, after the tab it followed, and a tab deleted here and not yet saved stays deleted. Replacing the
screen with the list would drop a new tab before its first save, and bring a deleted one back as an empty tab
whose next save empties the real tab for everyone. The baseline takes the list as it is.
