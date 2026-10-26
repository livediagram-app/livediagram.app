# Resync without reloading the page

## What

A shared document never reloads itself. Two rules keep it that way:

1. The realtime room keeps its **epoch across a hibernation wake**, so a reconnecting client is told to resync only
   when it really missed ops.
2. A resync **re-fetches the tab content** and merges it in place; it never calls `window.location.reload()`, which
   would lose the viewport, the selection, the undo history and any edit not yet saved.

## The epoch survives hibernation

Reconnect catch-up ([Realtime conflict resolution](realtime-conflict-resolution.md)) is scoped by an `epoch` and a
monotonic `seq`. The room uses the WebSocket **Hibernation API**: hibernating is the normal lifecycle, and a wake
re-runs the constructor, so an epoch minted there (`crypto.randomUUID()`) would be one no returning client could
recognise, and every reconnect after every wake would fall through `sendCatchup`'s final `else` and resync.

So `epoch` and `seq` are persisted to DO storage and restored in the constructor under `blockConcurrencyWhile`, and no
request can observe the pre-restore values. A client that reconnects fully caught up matches the epoch **and**
satisfies `lastSeq >= this.seq`, so it gets an empty delta.

The cost is one storage `put` per mutation op, un-awaited: the DO output gate holds outbound messages until pending
writes land, so a peer can never see an op whose seq failed to persist. The write is dwarfed by the fan-out broadcast
beside it, and the gain is never reloading anyone's page.

**`opLog` stays in memory.** It is a replay buffer, not identity: a client that fell behind across a wake did miss ops
that can no longer be sent to it. `floor` reports an empty log honestly, so that client resyncs, and only then.

## A resync merges, it does not reload

Even a legitimate resync only ever needs the **tab content** back. Everything
else the editor holds is either unaffected (viewport, selection, active tab,
undo stack) or re-established by the reconnect itself (presence, cursors). A
page reload would throw all of it away, and with it any edit not yet autosaved.

`useRoomResync` re-fetches the loaded tabs from the server and merges them through
`applyRemoteTabs`, the same path a peer's edit takes, which preserves undo/redo
rather than clearing it.

Three details it has to get right:

- **It replaces tabs that already hold content**, unlike `usePerTabLoad`'s
  merge (which skips a tab the user has touched). That guard exists to stop a
  lazy load clobbering local work; here the whole premise is that we missed ops,
  so the server's copy is the base.
- **Unsaved edits go back on top** (`rebaseLocalEdits`). What was edited here and
  not yet saved (offline, or inside the debounce) is not on the server, so each
  element changed, added or deleted since the last save, judged against the save
  baseline by content, is applied to the fetched copy, as is each tab field
  changed here. The next save then sends exactly those edits. A reconnect after
  offline work keeps it.
- **`lastSavedTabsRef` moves with it.** Otherwise the next autosave tick diffs
  fresh server content against a stale baseline and PUTs the pre-resync tabs
  straight back over it.
- **Total fetch failure is a no-op.** If every request fails it's almost
  certainly the same outage that broke the socket, so local state is the better
  copy; `usePerTabLoad`'s retry path owns recovery from there.

Only tabs already in the loaded set are refetched: an unvisited placeholder
has nothing to correct and would just race its own lazy load.

## No toast

The recovery is silent. It's an internal correction the user didn't cause and
can't act on, and the content simply becoming current is the right outcome to
present. The `RealtimeResync` telemetry fires, which is how a regression shows, and it counts real resyncs rather than
routine hibernation.

## Out of scope

- **Persisting `opLog`**, per above.
- **A CRDT for same-element concurrent edits**: deliberately not built
  ([Realtime conflict resolution](realtime-conflict-resolution.md)); the advisory selection lock makes the case rare, and it stays last-writer-wins.
