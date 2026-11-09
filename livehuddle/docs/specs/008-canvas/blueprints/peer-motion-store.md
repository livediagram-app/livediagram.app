# Peer-motion store

Derived from [Canvas performance](../canvas-performance.md), the rule **A collaborator moving renders
what shows them, not the editor**. The same shape as the [Viewport store](viewport-store.md).

## Files

| File                                                      | Role                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/state-store.ts`            | `createStateStore(initial)`: one value outside React, a setState-shaped `set`                           |
| `apps/editor/lib/peer-motion.ts`                          | `createPeerMotion`, `PeerMotion`, `PeerRowsSource`, `CursorPos`, `PeerAvatar`                           |
| `apps/editor/app/document/[id]/usePresenceState.ts`       | Makes the store once; `setRemoteCursors` / `setRemoteAvatars` are its setters                           |
| `apps/editor/app/document/[id]/presence-coalescer.ts`     | Writes both maps once a frame through those setters; on a timer while the page is hidden                |
| `apps/editor/app/document/[id]/usePresenceRows.ts`        | Builds `peerRows` by value; `participantsByTab` memoised                                                |
| `apps/editor/hooks/collab/usePeerRows.ts`                 | `usePeerCursorRows`, `usePeerAvatarRows`: subscribe and join with presence                              |
| `apps/editor/components/canvas/PeerCursors.tsx`           | The cursor layer: the element layer's only subscriber to cursors                                        |
| `apps/editor/components/canvas/CanvasCharactersLayer.tsx` | Subscribes to characters; draws them and runs the call hook ([Avatar pose store](avatar-pose-store.md)) |
| `apps/editor/lib/coarse-store.ts`                         | `coarseStore(source, { intervalMs, factsOf })`, `COARSE_MOTION_MS`: the coarse copy of a moving store   |
| `apps/editor/hooks/collab/useCoarseMotion.ts`             | `useCoarseMotion`, `peerFacts`, `feetFacts`: the coarse copy's reader                                   |
| `apps/editor/lib/calls/call-places.ts`                    | `callPlacesOf(elements)` (rooms and stages, cached per board), `placeOf(at, places)`                    |

## Domain and naming

| Term             | Identifier       | Meaning                                                                                               |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Peer motion      | `PeerMotion`     | `{ cursors, avatars }`, two `StateStore`s of maps keyed by presence id                                |
| Peer rows source | `PeerRowsSource` | `{ motion, livePresenceById, selfId, activeId, tabFocus }`, built by value                            |
| Coarse copy      | `coarseStore`    | A read-only store over a moving one that notifies at most once an interval, and at once on a new fact |
| Facts            | `factsOf`        | A string naming the discrete facts of a snapshot; a change of it publishes at once                    |
| Place            | `placeOf`        | The room a point stands in and the stage it stands on, as `room/stage` (empty for the open floor)     |

## Behaviour and state

- `createStateStore(initial)` holds one value; `set` takes a value or an updater, and a result that is
  the same value (`Object.is`) notifies nobody.
- `usePresenceState` makes one `PeerMotion` per editor (`useState(createPeerMotion)`) and returns it with
  its two setters as `setRemoteCursors` and `setRemoteAvatars`, so the room connection, the coalescer
  and the roster's prune keep their shape. It no longer returns `remoteCursors` or `remoteAvatars`.
- `usePresenceRows` never reads the maps. It returns `peerRows`, memoised on the store, the presence by
  id, our id, the active tab and the tab focus, and no longer `remoteCursorRows` / `remoteAvatarRows`.
- `participantsByTab` is memoised on what it reads, keyed on the tabs' ids rather than the tabs, so an
  edit does not rebuild it.
- The editor context carries `peerRows`; `EditorCanvasHost` passes it to the canvas as `peers`.
- `usePeerCursorRows(peers)` and `usePeerAvatarRows(peers)` subscribe with `useStoreSlice` and run the
  same builders as before (`buildRemoteCursorRows`, `buildRemoteAvatarRows`), memoised on the snapshot
  and `peers`.
- `CanvasCharactersLayer` calls `usePeerAvatarRows` and hands the rows to `useCanvasCall`, the peers'
  `AvatarWalker`s and the speech layer. `CanvasView` reads no row: `useCanvasAvatar` takes by-value slices
  (`usePeerAvatarSlice`) and `useCanvasSurfaceGestures` reads the rows when a press runs
  (`readPeerAvatarRows`). `CanvasElementsLayer` renders `PeerCursors`, which alone subscribes to cursors.

### The coarse copy

Derived from the rule's sentence on what follows everyone's positions as a fact ([Canvas performance](../canvas-performance.md)
"Walking renders the characters, not the canvas").

- `coarseStore(source, { intervalMs, factsOf })` returns `{ get, subscribe }`. It holds a `published` snapshot and its
  facts. While nobody subscribes, `get()` returns `source.get()` and adopts it as published. The first subscriber
  subscribes it to `source`; the last unsubscribe unsubscribes it and clears its timer.
- On each source notification, with `next = source.get()`: the same as published, nothing. Facts differ from the
  published facts: publish at once. Otherwise, `intervalMs` or more since the last publish: publish at once (inside the
  source's notification, so React renders it with the frame that caused it). Otherwise the change is held, and a
  trailing timer is (re)armed for `intervalMs`: a walk that stops publishes its last position at most `intervalMs`
  after its last step, and a walk that goes on never fires the timer.
- Publishing clears the timer, records the time (`Date.now()`), and notifies every subscriber.
- `useCoarseMotion(peers, poseStore, places)` subscribes to one `coarseStore(joinStores(peers.motion.avatars,
poseStore))` (memoised on the two stores and the places) whose facts are `peerFacts` and `feetFacts` joined, and
  returns `{ remoteAvatars, feet }`: `peerAvatarRowsOf(peers, avatars)`, the same rows array the frame-rate readers
  built for that snapshot, and the pose's feet. `peerFacts` names, per entry, its id, tab, `seatedOn`, seat index and
  `placeOf` its feet; `feetFacts` is whether you are placed and `placeOf` your feet.
- `callPlacesOf(elements)` is `{ zones: roomZones(elements), stages: callStages(elements, zones) }`, cached in a
  `WeakMap` by the elements array, so the layer, the call hook and the facts share one per board.
- `CanvasCharactersLayer` reads both coarse copies and hands them to what reads positions as facts:
  `useTableGameScene` (peers), `useWayfindingPeople` (peers, your feet), `useAvatarPadArrivals` (peers), and
  `useCanvasCall`'s `coarse` (to `useMeetingPieces` and `useProximityCall`). The characters, the hearing ring, the
  talking bars, raised hands, call bubbles and speech bubbles keep the frame-rate rows and feet. The pieces you alone
  walk up to (`useSocialPieces`, `usePieceMoments`, `useWorkdayPieces`), the Timer's earshot and the Reception bell
  keep your frame-rate feet: they read one point.

## Errors and edge cases

- A coarse copy subscribed after its source moved adopts the source's value on its first `get()`, so a reader never
  starts stale.
- A peer joining, leaving, changing tab, sitting, standing, or crossing a wall or a stage's edge changes the facts and
  publishes at once; only a step within the same place waits.
- The store is never written during render: the coalescer writes in an animation frame, the roster's
  prune in a socket handler.
- A hidden page gets no animation frames, so while it is hidden the coalescer writes on a `HIDDEN_FLUSH_MS` (250 ms)
  timer instead, which the browser runs about once a second there; a frame already asked for when the page hides is
  swapped for the timer. Otherwise someone who walked up while the tab was hidden never reached the call's scene
  ([Proximity audio](../../012-collaboration/proximity-audio.md#someone-who-arrives-later)).
- A prune that removes nobody returns the same map, so it notifies nobody.
- A peer who leaves drops out of the rows at once: `livePresenceById` changes, so `peerRows` does, and
  the subscribers rebuild their rows on the next render.

## Performance and limits

- Per presence frame: at most two notifications (cursors, characters). Renders: `PeerCursors` for a
  cursor frame; the characters layer for a character frame (the canvas view only when a by-value fact,
  such as who sits where, changes). The editor root, the chrome and every other
  reader of the editor context render 0 times.
- Measured by the render counter in `peer-motion.perf.test.tsx`: 30 peers by 60 frames rendered the root
  and a context reader 60 times each before, and 0 times now; the layers render 60 times each.

- The coarse copy, measured by `CanvasCharactersLayer.perf.test.tsx` (50 peers and you walking every frame for one
  second at 60 frames a second, an office with a room, a Screen and a Room Sign, everyone walking in a straight line
  so a few cross a wall each second): the call's scene, who is where, the meeting pieces and the game scene went from
  60 a second each to 13 (10 for the interval, the rest for the frames somebody crossed a wall); costume parses from
  6,000 a second to 0; room tests (`zoneAt`) from 6,240 to 4,569 (the facts test every walker each frame, a box test
  per room). The layer still renders 60 times: it draws the characters. The test fails above 10 + crossing frames + 1.
- The peers' and your own facts share one coarse copy (`joinStores`), so the call's scene has one cadence, not two
  (two copies fed it 21 times a second in the same bench); each side's facts are kept per snapshot.
- `factsOf` runs on every source notification: linear in walkers, one `placeOf` each (a box test per room and stage).

## Observability

- None: a presence frame is a hot path and is not logged.

## Testing

| Rule                                                          | Test                                    |
| ------------------------------------------------------------- | --------------------------------------- |
| A same-value set notifies nobody; updaters; unsubscribe       | `state-store.test.ts` (workbench)       |
| The root and its context readers render 0 times for movement  | `peer-motion.perf.test.tsx`             |
| A leave still updates the tab lists and drops the peer's rows | `peer-motion.perf.test.tsx`             |
| Rows are joined with presence on the active tab               | `usePresenceRows.test.tsx`              |
| The coalescer's buffering                                     | `presence-coalescer.test.ts`, unchanged |
| The coarse copy: interval, facts at once, trailing, lazy      | `coarse-store.test.ts`                  |
| Facts: tab, seat, room and stage changes; a step is no fact   | `useCoarseMotion.test.tsx`              |
| 50 walkers: the call, pieces and games about 10 a second      | `CanvasCharactersLayer.perf.test.tsx`   |

## Constants and configuration

| Constant           | Value | Why                                                                                                     |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------- |
| `COARSE_MOTION_MS` | 100   | 10 a second: under the call's 120 ms glide, and a sign or a list a tenth of a second late reads at once |

## Defaults ledger

- The coarse copy's clock is `Date.now()` (the spec names no clock; tests fake it with the timers).
