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

- The DO holds the **live tab state** + a monotonic **op sequence** (`seq`). A
  client sends an element op; the DO applies it to its state, assigns `seq`, and
  rebroadcasts `{ op, seq }`. Optimistic clients reconcile their local state
  against the authoritative order (rebase their un-acked ops on top).
- **Catch-up / reconnect:** the DO keeps a bounded **op log** (last N ops) +
  periodic snapshot. A reconnecting or late-joining client sends its last-seen
  `seq`; the DO replays the delta (or ships a snapshot if the client is too far
  behind), instead of a full D1 re-hydrate every time.
- **Durability (decision 2):** the DO **flushes** its state to D1 debounced and
  on last-peer-disconnect. Cold-start rehydrates from D1. D1 stays the system of
  record; the DO's storage is a warm cache.
- **Convergence guarantee:** because every mutation passes through one
  single-threaded DO that assigns a total order, all peers end in the same
  state. Still last-writer-wins per field, but with no divergence.

**Where it lives:** `apps/api/src/diagram-room.ts` grows a state model + op
application (reusing the same `packages/diagram` apply functions from Level 0),
op-log storage in DO storage, and the flush-to-D1 path (reusing the existing tab
persistence in `apps/api/src/db/tabs.ts`). The client gains reconcile-on-seq
logic.

**Effort:** medium — real infra, but bounded (DOs are built for exactly this:
single-threaded, per-diagram, with storage). Builds directly on Level 0's op
format.

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
