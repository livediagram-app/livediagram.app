# Realtime conflict resolution

Make simultaneous multi-user editing **robust**: two people working the same tab
at the same time must not clobber each other, and a dropped connection must
recover cleanly. Two mechanisms shipped for this. A third — a full field-level
CRDT for concurrent edits to the _same_ element — was scoped and **deliberately
dropped** (see the decision at the end). Same-element collisions therefore
remain last-writer-wins; the advisory selection lock makes them rare, it does
not prevent them.

## The problem it fixed

The realtime room (`apps/api/src/document-room/document-room.ts`) was a **stateless relay**: it
broadcast ops between peers and tracked presence, but held no document state and
merged nothing. The conflict unit was a **whole tab** — editing anything on a tab
broadcast the tab's entire element array and receivers **replaced** their copy.
So if A moved element X and B moved element Y on the same tab within the sync
window, whichever op landed last overwrote the other's whole element set. One
edit silently vanished.

The **selection lock** ([Editor app](../007-editor/editor-app.md)) already soft-locks an element for peers while
someone has it selected, heading off most _same-element_ collisions. The gap was
_same-tab, different-element_ edits — the common case — plus messy recovery when
a socket dropped.

## What shipped

### Element-level ops

The whole-tab broadcast is replaced by granular, id-addressed element ops, so
different elements merge instead of clobbering. The room orders element ops and
relays them; it does not merge them.

- Wire (`packages/api-schema/src/room-messages.ts`): `{ kind: 'el'; tabId;
op: ElementOp }` and `{ kind: 'tab-meta'; tabId; patch }` alongside the kept
  `tab` op (back-compat fallback). `ElementOp` (add / update / remove / reorder)
  lives in `@livediagram/document` so it's shared and unit-tested off-socket.
- Derivation is free: `diffToElementOps(before, after)` diffs the tab's
  elements before and after each commit. Apply
  is `applyElementOp(elements, op)` by id — an op for an already-removed id is a
  safe no-op.
- `update` replaces the whole element by id (simple + correct). Two peers editing
  the same element are still last-writer-wins per element, in room order, on every screen
  ([Same-element edits converge](#same-element-edits-converge)). The
  selection lock makes that rare; it is advisory and client-only, so it does not
  prevent it. Only the multi-writer fields (answers, ideas, checklist ticks,
  comments, dots) survive a same-element collision, because they travel as
  `el-delta` / `vote` deltas and receivers keep their own copy of them
  ([Collaboration race hardening](collab-race-hardening.md)).
- The emit side is `tabBroadcastOps` (in the autosave path); it falls back to a
  whole-`tab` op for a new tab or a bulk change. A meta field that was
  _cleared_ serialises to `undefined`, which JSON drops on the wire, so it
  travels by name in the `tab-meta` op's `clear` list. It used to force a
  whole-`tab` op too, and Clear Timer / Clear Vote then replaced every element
  on every receiver ([Collaboration race hardening](collab-race-hardening.md)).

### Same-element edits converge

Last-writer-wins in room order holds on every screen, including the writer's own. A save derives its element ops at
its snapshot, writes the tab, then sends them, so the room orders them after any peer op it already had. A peer's
`update` or `patch` of an element this editor is writing, arriving before the room confirms our op, was therefore
ordered first, and our op replaces it on every other screen. So it is not applied here: from the snapshot until the
room confirms the element ops (they go through `sequence`, its `ref` echoed in the `cursor` frame), the elements a
save writes are **held** (`own-element-writes.ts`), and a peer's update of a held element is left out of the screen
and the save baseline alike. A peer's `remove` is never held back (our later update of a removed element is a no-op
everywhere), and a hold ends when the room confirms, when the write fails (the retry still carries the change, since
the skipped op never reached the baseline) or when the room cannot say (a closed socket, the confirm timeout).

Before this, two people dragging one element at once each ended up seeing the other's position, and stayed that way
until a reload (`realtime-same-element.spec.ts` locks it).

### Live drags

A drag writes nothing until it ends; while it lasts, the dragger's preview travels as presence (a
`drag-preview` op: unordered, never logged or replayed) and collaborators draw it without writing
it. The real change follows on release as ordinary element ops ([Drag preview](../008-canvas/drag-preview.md)).

### Ordered room + reconnect catch-up

The room stamps every **mutation** op with a monotonic `seq` inside an `epoch`
(a random id minted when the room is first created, then kept in its storage)
and rebroadcasts
`{ op, seq, epoch }`. Because every mutation passes through one single-threaded
DO that assigns a total order, all peers converge. Ephemeral presence ops
(cursor / select / laser / tab-focus) stay unordered.

**Which an op is has one definition.** `PRESENCE_OP_KINDS`,
`MUTATION_OP_KINDS` and `SYSTEM_OP_KINDS` live in `@livediagram/api-schema`
beside the room message types, because the classification decides three things
at once — an op's ordering, its role gate ([API app](../015-api/api.md) drops non-presence ops from a
view-role sender), and whether a client may originate it at all. The wire payload
itself stays `unknown`, so this shares the vocabulary without coupling the room
to the editor's op shapes.

It used to live in the room worker while the editor kept its own list of the
kinds it sends and handles, in another app, with nothing comparing them — and
the mutation branch is the FALL-THROUGH, so a presence kind nobody classified
became a logged, ordered, replayed mutation. That is how `viewport` ([Follow-me viewport](follow-me-viewport.md))
shipped: published on every pan at 10 Hz, roughly 26 seconds of one person
scrolling filled all 256 log slots with camera positions and pushed the replay
floor past every real mutation, so the next peer whose socket blipped was told to
`resync` and re-hydrate every tab. A view-only visitor also could not be
followed, since the role gate drops non-presence ops. Two tests now bracket it:
the room's suite compares the presence and mutation lists directly (a mutation
kind in the presence set hands read-only visitors a write path), and
`room-op-vocabulary.test.ts` in the editor checks the third list — every kind the
editor actually sends or handles — against the schema, which is the direction
that let `viewport` through.

- The DO keeps a bounded in-memory op log. On reconnect a client sends
  `{ epoch, lastSeq }`; the DO replays the delta or answers `resync: true` when
  it can't bridge the gap (behind the trimmed log floor, or a stale epoch), and
  the client re-fetches its loaded tabs from D1 in place (`useRoomResync`), with
  a `RealtimeResync` telemetry ping ([Resync without reloading the page](resync-without-reload.md)).
- `epoch` and `seq` are persisted in Durable Object storage and restored on
  every wake, so hibernation does not strand a reconnecting client. The op log
  lives in memory only: a client that fell behind across a wake finds the log
  empty and re-fetches, which is the safe path and never loses data.
- The client (`apps/editor/lib/api/room.ts`) gained auto-reconnect with capped
  backoff + seq/epoch tracking. The backoff's six attempts span about 30
  seconds; once they are used up the client waits for the browser to come back
  online or the tab to be shown again and starts a fresh round then, so an
  outage longer than the attempts (a laptop asleep, wifi gone a while) does not
  end live collaboration for the rest of the session.
- **The cursor must include the client's own ops.** The relay skips the
  sender, so a client used to learn seqs only from other people's ops: a
  reconnect asked for its own ops back, and a session that had heard nothing
  asked for the whole log. Re-applying ops is harmless for element ops (by id),
  but a dot vote ([Session tools (timer + voting)](session-tools.md)) is a delta, so every replayed dot counted twice. The
  room now sends a `{ kind: 'cursor', epoch, seq }` frame on `hello` and to the
  sender of each ordered op, and the client folds it into its cursor (ignoring
  a different epoch, which the `sync` / `catchup` exchange reconciles). An op
  frame may carry a `ref` (a positive integer the client picks); the room echoes
  it on that op's `cursor` frame, which is how a save knows the room has
  sequenced the deltas it sent before writing ([Collaboration race hardening](collab-race-hardening.md) phase 6).
- **A whole-`tab` op keeps the receiver's dots.** It carries the sender's votes
  map as of their autosave, without dots still in flight, so the receiver keeps
  its own map unless the round itself changed (`mergeRemoteTab`).
- **The save baseline follows remote ops** ([Collaboration race hardening](collab-race-hardening.md)). `lastSavedTabsRef` is
  the "before" for both the D1 save diff and the broadcast diff, so it must
  hold what peers already have. Every applied remote op is folded into it
  through the same pure `applyRoomOpToTabs` the receiver uses, and a save
  that lands re-folds any op that arrived while it was in flight. The save
  diff compares tab content when identity differs, so a remote-only change
  is not mistaken for a local one. This replaced a `remoteUpdateRef` flag
  that skipped the autosave's next run: a peer's op arriving within the
  600 ms debounce cancelled the local save outright, and the stale baseline
  made the next save re-broadcast peers' elements in their older form.

**D1 stays the system of record.** Tab content is persisted by clients (each
editor PUTs its whole copy of a changed tab); the op log is a warm catch-up
cache, not a second writer. Two later additions put the room on the
persistence path without making it hold the document: the tab PUT merges the
room's collaboration ledger in before writing
([Collaboration race hardening](collab-race-hardening.md) phase 3), and Q&A board writes are performed
by the room itself, one at a time ([Q&A board](qa-board.md)).

### A malformed op

The room relays an Editor's op as it was sent and keeps it in the catch-up log, so every receiver checks a
document-changing op's envelope before applying it (`roomOpIsWellFormed`, `room-op-shape.ts`): a `tab` carries a
tab with its elements, an `el` an element op (an add or update an element with an id and a type, a remove an id, a
reorder a list, a patch an id and its fields), an `el-delta` an element id and a delta, a `changeset` a list of
element ops if any, a `vote` an element and a voter, a `tab-meta` a patch, an `article` a flow, a `document-meta`
a name and a list of tabs with ids and names; each but `document-meta` names its tab. One that does not is dropped
and logged (`[room] malformed op dropped`), so it can no longer stop every editor in the room, or each one that
reconnects, from rendering. What an element or a patch holds is the stored-element migrations' to settle; a kind
this build does not apply passes, to be ignored as before.

### Keepalive

A socket can die without a close event: a laptop asleep, a NAT or proxy that dropped an idle
connection. It then reads as open while nothing arrives, so collaborators' changes stop reaching
the editor until a reload, and nothing says so. The client therefore checks its socket:

- After 20 seconds with nothing heard (`ROOM_KEEPALIVE_IDLE_MS`, `apps/editor/lib/api/room.ts`) it
  sends the bare text `ping` (`ROOM_PING` in `room-messages.ts`). Any traffic resets the clock, so
  a busy room sends none.
- The room answers `pong` through the runtime's `setWebSocketAutoResponse`, which never wakes a
  hibernating room, so a keepalive costs the room nothing.
- A ping with no answer at all within 10 seconds (`ROOM_KEEPALIVE_TIMEOUT_MS`) ends the socket as a
  drop, and the reconnect and catch-up above take over. Only an unanswered ping counts, never
  silence alone: a background tab whose timers the browser slows to once a minute is never dropped
  for being quiet.
- `ping` and `pong` are plain text, never JSON, so neither side's message handler reads them as ops.

## Locked decisions

1. **Undo is local, not global.** Undo/redo affects the current user's own
   changes only — never rolls back a peer's edit. Every peer op (and every
   agent changeset) is applied to each undo and redo snapshot as well as to
   what is on screen, so a restored snapshot already holds the peer's change:
   undoing takes back your own edits alone, never a collaborator's element or a
   tab they added, and the resulting element ops are broadcast as yours. A
   resync's re-read content replaces only what is on screen.
2. **D1 is the system of record.** The room holds ordering and collaboration
   state (epoch + seq, the op log, the collaboration ledger, the live poll, the
   facilitator baton), never a copy of the document. REST reads, exports, and
   offline durability read D1.
3. **The selection lock stays advisory.** The [Editor app](../007-editor/editor-app.md) lock soft-locks a
   selected element for peers on the client. It makes same-element concurrent
   editing rare, not impossible: the room does not enforce it between people.
   Such collisions stay last-writer-wins over the whole element, which is the
   cost accepted in dropping the field-level CRDT below. An agent is the
   exception: a changeset targeting an element a person holds is refused
   ([Agent changesets](../024-agents/agent-changesets.md#held-elements)), so
   people outrank agents.

## Considered and dropped: a full field-level CRDT

A third mechanism was built out and then removed: a Yjs CRDT so two people
editing _different fields of the same element_ at the same instant (one moves a
box while another recolours it) would both survive, merged field-by-field.

It was dropped because the cost outweighed the benefit:

- **The benefit is narrow.** The selection lock (decision 3) makes two people
  grabbing the same element at once rare, though it does not prevent it, and the
  fields many people write at once already merge as deltas. So the case the CRDT
  uniquely rescues is uncommon. And it can't help when two people change the
  _same_ field — someone's value still has to win.
- **The cost is paid by everyone, always.** It pulled in a third-party CRDT
  library (~60 KB gzipped) that shipped in the editor bundle regardless of use,
  added a permanent second sync path to maintain alongside the element-op path,
  and made the room hold a live copy of the whole document in memory: a second
  copy beside D1, which the room otherwise never holds.
- **It was unverified.** It was never exercised with two live clients, so
  keeping it meant carrying risk that a future change flips it on and corrupts
  documents.

If same-element field-level merge ever becomes a real need, revisit it then —
verified end-to-end and turned on properly, not carried as dormant code.

## Implementation map

- `packages/document` — `element-ops.ts`: `ElementOp`, `diffToElementOps`,
  `applyElementOp` (pure, unit-tested).
- `packages/api-schema/src/room-messages.ts` — `el` / `tab-meta` ops; `seq` /
  `epoch` on the op frame; the `sync` + `catchup` frames.
- `packages/api-schema/src/room-messages.ts` — `PRESENCE_OP_KINDS` /
  `MUTATION_OP_KINDS` / `SYSTEM_OP_KINDS`, the one classification of every op.
- `packages/document` — `element-deltas.ts` (`applyElementDelta`,
  `mergeIncomingElement`), `collab-ledger.ts` (the ledger's entries and the
  save merge), `comments.ts` (`opForTheWire`, `stampCommentAuthor`).
- `apps/api/src/document-room/document-room.ts` — the role / class gate, seq + epoch
  (persisted as `order-state`), the bounded in-memory op log and the
  `sync` → `catchup` handler (`resolveCatchup` in `document-room-rules.ts`). It
  rewrites comment authors in every mutation it relays and keeps collaboration
  state in Durable Object storage: the per-element ledger
  (`room-ledger-store.ts`), the live poll (`room-live-poll.ts`) and the
  facilitator baton (`facilitator.ts`). It writes D1 for Q&A boards
  (`handleQaWrite` → `qa-board-write.ts`). The full description is
  [API app → Realtime model](../015-api/api.md#realtime-model).
- `apps/api/src/room-client.ts` — the worker's calls into the room: the ledger
  merge on a tab PUT (`fetchRoomLedger` + `applyRoomLedger`, driven by `X-Room-Cursor`), the
  view-role comment relay (`relayElementDelta`) and share-link broadcasts.
- `apps/editor` — `tab-broadcast-ops.ts` (emit), `tab-save-flow.ts` (a save's
  ledger deltas sequenced before its PUT, its element ops after) + the room
  `onOp` handler (apply); `lib/api/room.ts` (auto-reconnect, seq/epoch
  tracking, the outbox, `sequence` and its `ref`);
  `useRoomConnection` (`onResync` → `useRoomResync`, an in-place re-fetch, +
  telemetry).

See also [Editor app](../007-editor/editor-app.md) (selection lock),
[API app](../015-api/api.md) (api + room), [Telemetry + public transparency dashboard](../017-telemetry/telemetry.md) (events),
[Auth + guest access](../014-identity/auth-and-guest-access.md) (guest access).
