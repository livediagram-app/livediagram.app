# 97 — Resync without reloading the page

Status: shipped

## What

A shared diagram sometimes reloaded itself with no user action, losing the
viewport, the selection, and the undo history (issue #28). Two independent
faults, both fixed here:

1. The realtime room minted a **new epoch on every hibernation wake**, so
   reconnecting clients were told to resync when nothing was actually wrong.
2. A resync was implemented as **`window.location.reload()`**, so the correction
   was far more destructive than the problem it corrected.

Live telemetry pointed straight at it: `RealtimeResync` was the single most
common client error.

## Fault 1 — the epoch didn't survive hibernation

Reconnect catch-up (spec/75, Level 1) is scoped by an `epoch` + a monotonic
`seq`. Both lived **in memory only** on the Durable Object, with a comment
arguing the reset was harmless because it "only ever forces a resync".

The reasoning was sound and the premise was wrong. The room uses the WebSocket
**Hibernation API** — hibernating is the normal, intended lifecycle, not an
exceptional event — and a wake re-runs the constructor, so
`epoch = crypto.randomUUID()` produced a room that no returning client could
recognise. Any reconnect after any wake fell through `sendCatchup`'s final
`else` and resynced. That is the "backgrounded tab" case in the issue: the tab
sleeps, the DO hibernates, the tab wakes, the socket reconnects, the page
reloads.

`epoch` and `seq` are now persisted to DO storage and restored in the
constructor under `blockConcurrencyWhile`, so no request can observe the
pre-restore values. A client that reconnects fully caught-up matches the epoch
**and** satisfies `lastSeq >= this.seq`, so it gets an empty delta.

Cost is one storage `put` per mutation op, un-awaited — the DO output gate
holds outbound messages until pending writes land, so a peer can never see an
op whose seq failed to persist. The original comment rejected this as "a
storage write per mutation for no correctness gain"; the gain isn't
correctness, it's not reloading the user's page, and the write is dwarfed by
the fan-out broadcast beside it.

**`opLog` stays in memory.** It's a replay buffer, not identity: a client that
fell behind across a wake genuinely did miss ops that can no longer be sent to
it. `floor` already reports an empty log honestly, so that client still
resyncs — correctly, and now only when it really must.

## Fault 2 — resync meant reloading

Even a legitimate resync only ever needs the **tab content** back. Everything
else the editor holds is either unaffected (viewport, selection, active tab,
undo stack) or re-established by the reconnect itself (presence, cursors). A
page reload threw all of it away, and with it any edit not yet autosaved —
exactly the worry the issue raised.

`useRoomResync` re-fetches the loaded tabs from D1 and merges them through
`applyRemoteTabs`, the same path a peer's edit takes, which preserves undo/redo
rather than clearing it.

Three details it has to get right:

- **It overwrites tabs that already hold content**, unlike `usePerTabLoad`'s
  merge (which skips a tab the user has touched). That guard exists to stop a
  lazy load clobbering local work; here the whole premise is that we missed ops,
  so the server's copy is the authoritative one.
- **`lastSavedTabsRef` moves with it.** Otherwise the next autosave tick diffs
  fresh server content against a stale baseline and PUTs the pre-resync tabs
  straight back over it.
- **Total fetch failure is a no-op.** If every request fails it's almost
  certainly the same outage that broke the socket, so local state is the better
  copy; `usePerTabLoad`'s retry path owns recovery from there.

Only tabs already in the loaded set are refetched — an unvisited placeholder
has nothing to correct and would just race its own lazy load.

## No toast

The recovery is silent. It's an internal correction the user didn't cause and
can't act on, and the content simply becoming current is the right outcome to
present. The `RealtimeResync` telemetry still fires, which is how we'd notice a
regression — and now the metric measures something real rather than counting
routine hibernation.

## Out of scope

- **Persisting `opLog`**, per above.
- **A CRDT for same-element concurrent edits** — still deliberately dropped
  (spec/75); the selection lock already prevents the case.
