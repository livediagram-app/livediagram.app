# 75 — Realtime conflict resolution

Make simultaneous multi-user editing **robust**: two people working the same tab
at the same time must not clobber each other. This is delivered in three levels
of increasing strength, each shippable on its own, culminating in a true CRDT.

## Where we are today

The realtime room (`apps/api/src/diagram-room.ts`) is a **stateless relay**: it
broadcasts ops between connected peers and tracks presence, but holds no diagram
state, persists no ops, and merges nothing. Its own header says it: _"Conflict
model: last-writer-wins. Ops are not persisted here."_

The conflict unit is a **whole tab**. The edit op
(`RoomOp` in `packages/api-schema/src/room-messages.ts`) is:

```ts
| { kind: 'tab'; tabId: string; tab: Tab }   // "receivers merge by id"
```

Editing anything on a tab broadcasts the tab's **entire element array**;
receivers **replace** their copy of that tab. So if A moves element X and B
moves element Y on the same tab within the sync window, whichever `tab` op lands
last overwrites the other's whole element set. The same last-writer-wins holds at
the D1 persistence layer (the last full-tab save wins).

One existing mitigation: the **selection lock** (spec/07) soft-locks an element
for peers while someone has it selected, which prevents most _same-element_
simultaneous edits. The gap this spec closes is _same-tab, different-element_
(and, at Level 2, genuinely _same-element_).

## Goal / non-goals

- **Goal:** concurrent edits to different elements on a tab always merge;
  convergence (everyone lands in the same state) is guaranteed; reconnecting or
  late-joining catches up cleanly; and — at the end — concurrent edits to the
  same element merge field-by-field with no central authority needed.
- **Non-goal:** changing the durability model. D1 stays the system of record at
  every level. The Durable Object holds _live_ state, never the only copy.
- **Non-goal:** breaking guest access or self-hosting. Every level keeps the
  friction-free guest path (spec/04) and degrades to today's behaviour for an
  older peer.

## Locked decisions

1. **Undo is local, not global.** Undo/redo affects the current user's own
   changes only — never rolls back a peer's edit. At Level 0 this is natural:
   undo applies the inverse of your own element ops locally and broadcasts them.
   At Level 2 the CRDT carries a **per-origin undo manager** (Yjs `UndoManager`
   scoped to this client's origin) so undo only touches changes this client
   authored. Global/session undo is explicitly out of scope.
2. **The Durable Object is the live authority; D1 is the system of record.**
   From Level 1 on, the DO owns the live tab state + an op sequence, and
   **flushes** to D1 (debounced + on last-peer-disconnect). D1 is never bypassed
   — a cold room rehydrates from D1, and the DO's storage is a cache, not the
   truth. This preserves REST reads, exports, and offline durability unchanged.
3. **The selection lock is a scaffold, removed at Level 2.** The spec/07
   selection lock (spec/07) stays through Levels 0 and 1 as a soft mitigation
   for same-element edits. Once the CRDT (Level 2) merges same-element edits
   field-by-field, the lock is no longer needed for correctness and is
   **removed** — peers may edit the same element at once and both changes
   survive. (Presence/selection _glow_ stays; only the edit-blocking lock goes.)

---

## Level 0 — element-level ops (the 80% win)

Replace the whole-tab op with granular, id-addressed element ops so different
elements merge instead of clobbering. The DO stays a dumb relay.

The wire adds two `RoomOp` variants (alongside the existing `tab` op, which
stays for back-compat — see Rollout); the element-op payload is a
`packages/diagram` type so it's shared and unit-tested off-socket:

```ts
// @livediagram/api-schema RoomOp
| { kind: 'el'; tabId: string; op: ElementOp }
| { kind: 'tab-meta'; tabId: string; patch: Partial<Omit<Tab, 'elements'>> }

// @livediagram/diagram ElementOp
type ElementOp =
  | { kind: 'add'; element: Element; at: number }      // insert at z-index
  | { kind: 'update'; element: Element }                // full replace by id
  | { kind: 'remove'; id: string }
  | { kind: 'reorder'; ids: string[] }                  // new full z-order
```

- **Derivation is free.** The editor already computes a before/after diff on
  every commit to emit the change log (`apps/live/lib/change-log.ts`). Level 0
  derives element ops from that **same before/after** via
  `diffToElementOps(before, after)` — added ids → `add`, removed ids →
  `remove`, changed elements → `update`, z-order moves → `reorder`. No new diff
  engine.
- **Apply by id.** Receivers call `applyElementOp(elements, op)`: replace the
  element with the matching id, insert/remove/reorder by id. An op for an
  unknown id (already deleted by a peer) is a safe no-op; a racing double-add
  degrades to an update.
- **`update` replaces the whole element** (simple + correct). Two peers editing
  the same element still last-writer-wins — the selection lock covers that, and
  **field-level merge of one element is deferred to the CRDT (Level 2)**.
- **Conflict surface shrinks to one element.** Still last-writer-wins _per
  element_ (both edit X → last `update` for X wins), but the common
  same-tab/different-element case now merges cleanly, and the selection lock
  already covers the same-element case.
- **Undo (decision 1):** the local undo stack replays inverse element ops and
  broadcasts them, so undoing your move of X doesn't disturb a peer's move of Y.

**Where it lives:** the wire types in `@livediagram/api-schema`; the emit side in
the editor's commit path (next to where the `tab` op is sent today); the apply
side in the room `onOp` handler that merges into the active tab. The DO is
untouched. Pure diff→ops and ops→tab functions live in `packages/diagram` so
they're unit-tested without a socket.

**Effort:** ~a week. Highest ROI, lowest risk. Ships independently.

---

## Level 1 — stateful, ordered Durable Object

Make the DO authoritative for _ordering_, so all peers converge and reconnect is
clean.

- **Ordering.** The DO assigns every **mutation** op a monotonic **`seq`**
  within an **`epoch`** (a random id minted per DO instantiation) and
  rebroadcasts `{ op, seq, epoch }`. Because every mutation passes through one
  single-threaded DO that assigns a total order, all peers converge. Ephemeral
  presence ops (cursor/select/laser/tab-focus) stay unordered — they carry no
  `seq` and relay from any role, exactly as before.
- **Catch-up / reconnect.** The DO keeps a bounded in-memory **op log**
  (`OP_LOG_LIMIT` recent ops). On reconnect a client sends `{ epoch, lastSeq }`;
  the DO replays the delta (`ops` after `lastSeq`, `resync: false`) or, when it
  can't bridge the gap — the client is behind the trimmed floor, or its epoch is
  from a previous DO instance — answers `resync: true` and the client
  re-hydrates from D1 (a full reload, the same recovery the editor's error
  boundary uses). A `RealtimeResync` telemetry ping makes that fallback visible.
- **Why in-memory (not DO storage).** The op log + `seq` + `epoch` live in
  memory, like the existing `opRates`. A hibernation wake resets them (new
  epoch, empty log); a client that stayed connected adopts the new epoch off the
  next op (it missed nothing — the socket stayed open), and a client that
  _reconnects_ across a wake finds its epoch stale and re-hydrates. So the reset
  only ever forces the safe path, never loses data — and no per-op storage write
  is paid.
- **Durability (decision 2).** The principle holds unchanged: **D1 is the system
  of record.** Persistence stays **client-driven** at this level (clients PUT
  tabs to D1 as today); the DO's op log is a warm _catch-up_ cache, not a second
  writer, so there's no double-write race against the REST saves. The stronger
  form of decision 2 — the DO itself **flushing** its state to D1 — folds into
  Level 2, where the persisted Yjs doc becomes the natural single authority the
  DO writes. Keeping the DO out of the D1 write path here is what makes Level 1
  shippable without touching the REST/export/guest durability paths.

**Where it lives:** `apps/api/src/diagram-room.ts` (seq/epoch/op-log + the
`sync` → `catchup` handler); `packages/api-schema/src/room-messages.ts` (`seq` /
`epoch` on the op frame, the `sync` + `catchup` frames); `apps/live/lib/api/room.ts`
(auto-reconnect with backoff, seq/epoch tracking, sync-on-reopen, catch-up
application); `useRoomConnection.ts` (`onResync` → reload + telemetry).

**Effort:** medium — real infra, but bounded. Builds directly on Level 0's op
format; no client-side op rebasing is needed because element ops already
commute (Level 0) and the DO relays in a single total order.

---

## Level 2 — CRDT (Yjs)

True concurrency: concurrent edits to the same element's different fields both
survive; moves resolve deterministically; offline edits merge on reconnect. No
central authority is needed for _convergence_ (the DO still relays + persists).

- **Model.** The diagram doc is a Yjs document: a `Y.Map` of tabs; each tab a
  `Y.Map` (`meta` + an `elements` `Y.Map<id, Y.Map<field, value>>`); z-order via
  a fractional-index (or `Y.Array` of ids). Element fields are `Y.Map` entries so
  two peers editing different fields of the same element both land.
- **Editor projects from the CRDT.** Today `useEditorState` + `commitTabs` are
  the source of truth. At Level 2 the **Yjs doc becomes the source of truth** and
  the editor state is a projection: every mutation writes into the Yjs doc; a doc
  observer produces the React state. This is the deep part — undo/redo, autosave,
  the change log, and every mutation path re-route through the doc. It is a
  **state-layer change**, staged behind a flag and landed tab-model-first.
- **Transport.** The DO relays Yjs updates (opaque binary) and persists the
  encoded doc to D1 (system of record, decision 2); Level 1's op log generalises
  to a Yjs update log. Awareness (cursors/selection/presence) rides the Yjs
  awareness protocol, replacing the ad-hoc cursor/select/laser ops.
- **Undo (decision 1):** a Yjs `UndoManager` scoped to this client's **origin**,
  so undo only reverts changes this client authored — never a peer's.
- **Selection lock removed (decision 3):** with field-level merge the spec/07
  edit lock is unnecessary and is removed; presence + selection glow stay.

**Effort:** the largest — it rewrites the state layer's source of truth. Land it
last, incrementally (types + doc model → transport → editor projection behind a
flag → cut over), keeping Levels 0–1 as the shipped behaviour until it's proven.

**Status — cut-over landed behind the `?yjs=1` flag (off by default).** The
whole Level 2 path is wired end-to-end but gated, so the shipped behaviour stays
Levels 0 + 1 until it's proven with two live clients. The pieces:

**Shared-seed architecture (the crux).** Peers must share ONE Yjs doc history —
if each client seeded its own doc from its D1 hydrate, the two docs would resolve
_whole-key_ last-writer-wins, not per-field, and the merge would be a lie. So the
**room holds the authoritative doc**: a joiner sends `ydoc-sync`, the room replies
`ydoc-state` with the encoded doc (or `null` → the first client seeds from its
hydrate and broadcasts that seed for the room + peers to adopt). Every commit
broadcasts a `ydoc` update the room merges into its doc and relays. This is where
decision 2's "DO holds live authority" concretely lands for Level 2; D1 stays the
system of record via the unchanged tab autosave (the doc is the live layer).

**Wired at the editor's two seams, not 30 hooks.** `useAutosave` commits the tabs
into the `YjsMirror` on each save (which broadcasts the delta); `useRoomConnection`
applies incoming `ydoc` / `ydoc-state` and projects back to `Tab[]`. So the
editor's existing `tabs` state stays the working copy and the doc mirrors it at
commit granularity — the observable Level 2 win (field-level same-element merge)
without a full state-layer rewrite. A per-origin `Y.UndoManager` lives on the
mirror (decision 1).

**Where it lives:** `packages/diagram/src/yjs-doc.ts` (doc model + `syncDiagram` +
transport); `apps/live/lib/yjs-mirror.ts` (the client doc + undo + broadcast/apply
glue) + `yjs-flag.ts`; `apps/api/src/diagram-room.ts` (authoritative doc +
`ydoc`/`ydoc-sync`/`ydoc-state`); the `ydoc*` frames in `room-messages.ts`. Unit
tests cover the doc model, `syncDiagram`, the `YjsMirror` (incl. concurrent
same-element field merge), and the DO's doc authority + seed.

**Still ahead (needs the live pass):** wiring the mirror's `UndoManager` to the
editor's undo/redo button; awareness for cursors/selection (still on the ad-hoc
presence ops); **removing the selection lock** (decision 3 — kept for now so the
flag is additive); the DO **flushing the doc to D1** (persistence is still via the
tab autosave; a cold room re-seeds from a joiner's hydrate); and diagram **rename**
sync (the doc models tabs, not the diagram name). None of these block the merge
behaviour the flag demonstrates; they're the polish + the decision-3 removal that
only make sense once two-client testing confirms the core.

The pure model pieces are in `packages/diagram/src/yjs-doc.ts` (imported via the
`@livediagram/diagram/yjs` subpath so the core bundle never pulls in Yjs unless
the flag path is used):

- **Doc model** — `ydoc.getArray('tabOrder')` + `ydoc.getMap('tabs')`, each tab a
  `Y.Map` of meta + an `elements` `Y.Map<id, Y.Map<field, value>>` + an `order`
  `Y.Array<id>`. Element fields are individual `Y.Map` entries — the field-level
  merge the Level 0 whole-element `update` can't give.
- **Projection** — `writeDiagram(doc, tabs)` (seed from a D1 hydrate) and
  `readDiagram(doc)` (the `Tab[]` a doc observer feeds React at cut-over).
- **Op bridge** — `applyElementOpToDoc(doc, tabId, op)` maps Level 0's `ElementOp`
  vocabulary into the doc field-by-field, so the same ops already on the wire
  drive the CRDT. `update` diffs field-by-field so a concurrent edit to an
  untouched field survives.
- **Transport primitives** — `encodeDiagramUpdate` / `applyDiagramUpdate` (the
  opaque binary the DO relays + persists).
- **Tested** — round-trip, z-order, per-op apply, `syncDiagram` (the local-commit
  path), and the headline merge: concurrent edits to different fields of the
  _same_ element converge with both changes intact; concurrent adds converge.

---

## Rollout, back-compat, sequencing

- **Ship in order 0 → 1 → 2**, each independently valuable. 0 removes the pain
  most sessions hit; 1 adds a convergence + reconnect guarantee; 2 is the moat.
- **Back-compat at every step.** The room wire format is
  optional-field/unknown-op tolerant (peers ignore ops they don't recognise), so
  new op kinds ship without breaking older clients. During Level 0 the `tab` op
  stays as a fallback (a client that can't produce a clean diff — e.g. a bulk
  paste — may still ship a whole `tab`; receivers handle both). Levels 1–2 keep a
  server-side path that accepts the old ops and re-expresses them.
- **Guest + self-host preserved.** No level adds a required SaaS call or a
  sign-in wall; the DO + D1 are the same Cloudflare primitives already in use.

## Telemetry (spec/22)

Reuse the closed vocabulary. Track convergence health, not content:

- `Element`/`Edited` already fires on edits; add a `type` distinguishing the
  transport where useful.
- New: a coarse `Error`/`Client`/`RealtimeResync` when a client has to fall back
  to a full snapshot (Level 1) or a doc reload (Level 2) — a signal that ordering
  or merge drifted, so regressions are visible.
- No element content or ids ever leave in telemetry (the `type` bound in
  spec/22 still applies).

## Implementation map

- `packages/api-schema/src/room-messages.ts` — new `RoomOp` element-op variants
  (Level 0), `seq` on the wire (Level 1).
- `packages/diagram` — pure `diffToElementOps(before, after)` and
  `applyElementOp(tab, op)` (Levels 0–1, unit-tested); the Yjs doc model +
  projection helpers (Level 2).
- `apps/live` — emit element ops on commit + apply in `onOp` (Level 0);
  reconcile-on-`seq` (Level 1); the Yjs-backed state layer behind a flag
  (Level 2).
- `apps/api/src/diagram-room.ts` — authoritative state + op log + flush-to-D1
  (Level 1); Yjs update relay + persistence (Level 2).
- `apps/api/src/db/tabs.ts` — reused as the D1 flush target (unchanged contract).

See also [spec/07](07-live-app.md) (selection lock),
[spec/11](11-api.md) (api + room), [spec/22](22-telemetry.md) (events),
[spec/04](04-auth-and-guest-access.md) (guest access).
