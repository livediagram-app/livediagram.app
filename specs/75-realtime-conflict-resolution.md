# 75 — Realtime conflict resolution

Make simultaneous multi-user editing **robust**: two people working the same tab
at the same time must not clobber each other, and a dropped connection must
recover cleanly. Two mechanisms shipped for this. A third — a full field-level
CRDT for concurrent edits to the _same_ element — was scoped and **deliberately
dropped** (see the decision at the end); the selection lock already covers that
case.

## The problem it fixed

The realtime room (`apps/api/src/diagram-room.ts`) was a **stateless relay**: it
broadcast ops between peers and tracked presence, but held no diagram state and
merged nothing. The conflict unit was a **whole tab** — editing anything on a tab
broadcast the tab's entire element array and receivers **replaced** their copy.
So if A moved element X and B moved element Y on the same tab within the sync
window, whichever op landed last overwrote the other's whole element set. One
edit silently vanished.

The **selection lock** (spec/07) already soft-locks an element for peers while
someone has it selected, heading off most _same-element_ collisions. The gap was
_same-tab, different-element_ edits — the common case — plus messy recovery when
a socket dropped.

## What shipped

### Element-level ops

The whole-tab broadcast is replaced by granular, id-addressed element ops, so
different elements merge instead of clobbering. The room stays a relay.

- Wire (`packages/api-schema/src/room-messages.ts`): `{ kind: 'el'; tabId;
op: ElementOp }` and `{ kind: 'tab-meta'; tabId; patch }` alongside the kept
  `tab` op (back-compat fallback). `ElementOp` (add / update / remove / reorder)
  lives in `@livediagram/diagram` so it's shared and unit-tested off-socket.
- Derivation is free: the editor already diffs before/after on every commit for
  the change log; `diffToElementOps(before, after)` reuses that same diff. Apply
  is `applyElementOp(elements, op)` by id — an op for an already-removed id is a
  safe no-op.
- `update` replaces the whole element by id (simple + correct). Two peers editing
  the same element still last-writer-wins per element — which the selection lock
  covers.
- The emit side is `tabBroadcastOps` (in the autosave path); it falls back to a
  whole-`tab` op for a new tab, a bulk change, or when a meta field is _cleared_
  (a cleared field serialises to `undefined`, which JSON drops on the wire).

### Ordered room + reconnect catch-up

The room stamps every **mutation** op with a monotonic `seq` inside an `epoch`
(a random id minted per Durable Object instantiation) and rebroadcasts
`{ op, seq, epoch }`. Because every mutation passes through one single-threaded
DO that assigns a total order, all peers converge. Ephemeral presence ops
(cursor / select / laser / tab-focus) stay unordered.

- The DO keeps a bounded in-memory op log. On reconnect a client sends
  `{ epoch, lastSeq }`; the DO replays the delta or answers `resync: true` when
  it can't bridge the gap (behind the trimmed log floor, or a stale epoch), and
  the client re-hydrates from D1 — a full reload, the same recovery the editor's
  error boundary uses, with a `RealtimeResync` telemetry ping.
- The log + seq + epoch live in memory (like the existing rate-limit map). A
  hibernation wake resets them; a client that stayed connected adopts the new
  epoch off the next op, and a client that _reconnects_ across a wake finds its
  epoch stale and re-hydrates. So the reset only ever forces the safe path,
  never loses data.
- The client (`apps/live/lib/api/room.ts`) gained auto-reconnect with capped
  backoff + seq/epoch tracking.

**Durability is unchanged:** D1 stays the system of record. Persistence is
client-driven (clients PUT tabs to D1 as before); the op log is a warm catch-up
cache, not a second writer, so there's no double-write race.

## Locked decisions

1. **Undo is local, not global.** Undo/redo affects the current user's own
   changes only — never rolls back a peer's edit. Undo applies the inverse of
   your own element ops locally and broadcasts them.
2. **D1 is the system of record.** Persistence stays client-driven; the room
   holds only live ordering state (the op log), never the only copy. REST reads,
   exports, and offline durability are unchanged.
3. **The selection lock stays.** The spec/07 lock soft-locks a selected element
   for peers, which is what makes same-element concurrent editing a non-issue —
   and the reason the field-level CRDT below wasn't needed.

## Considered and dropped: a full field-level CRDT

A third mechanism was built out and then removed: a Yjs CRDT so two people
editing _different fields of the same element_ at the same instant (one moves a
box while another recolours it) would both survive, merged field-by-field.

It was dropped because the cost outweighed the benefit:

- **The benefit is narrow and mostly already covered.** The selection lock
  (decision 3) prevents two people grabbing the same element at once in the first
  place, so the case the CRDT uniquely rescues barely occurs. And it can't help
  when two people change the _same_ field — someone's value still has to win.
- **The cost is paid by everyone, always.** It pulled in a third-party CRDT
  library (~60 KB gzipped) that shipped in the editor bundle regardless of use,
  added a permanent second sync path to maintain alongside the element-op path,
  and turned the room from a stateless relay into a stateful service holding a
  live copy of the diagram in memory.
- **It was unverified.** It was never exercised with two live clients, so
  keeping it meant carrying risk that a future change flips it on and corrupts
  diagrams.

If same-element field-level merge ever becomes a real need, revisit it then —
verified end-to-end and turned on properly, not carried as dormant code.

## Implementation map

- `packages/diagram` — `element-ops.ts`: `ElementOp`, `diffToElementOps`,
  `applyElementOp` (pure, unit-tested).
- `packages/api-schema/src/room-messages.ts` — `el` / `tab-meta` ops; `seq` /
  `epoch` on the op frame; the `sync` + `catchup` frames.
- `apps/api/src/diagram-room.ts` — seq / epoch / bounded op log + the
  `sync` → `catchup` handler. Still a relay for op content; no diagram state
  persisted.
- `apps/live` — `tab-broadcast-ops.ts` (emit) + the room `onOp` handler (apply);
  `lib/api/room.ts` (auto-reconnect + seq/epoch tracking); `useRoomConnection`
  (`onResync` → reload + telemetry).

See also [spec/07](07-live-app.md) (selection lock),
[spec/11](11-api.md) (api + room), [spec/22](22-telemetry.md) (events),
[spec/04](04-auth-and-guest-access.md) (guest access).
