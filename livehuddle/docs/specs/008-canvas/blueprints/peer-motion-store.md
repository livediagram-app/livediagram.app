# Peer-motion store

Derived from [Canvas performance](../canvas-performance.md), the rule **A collaborator moving renders
what shows them, not the editor**. The same shape as the [Viewport store](viewport-store.md).

## Files

| File                                                      | Role                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/state-store.ts`            | `createStateStore(initial)`: one value outside React, a setState-shaped `set`                           |
| `apps/editor/lib/peer-motion.ts`                          | `createPeerMotion`, `PeerMotion`, `PeerRowsSource`, `CursorPos`, `PeerAvatar`                           |
| `apps/editor/app/document/[id]/usePresenceState.ts`       | Makes the store once; `setRemoteCursors` / `setRemoteAvatars` are its setters                           |
| `apps/editor/app/document/[id]/presence-coalescer.ts`     | Unchanged contract: writes both maps once a frame through those setters                                 |
| `apps/editor/app/document/[id]/usePresenceRows.ts`        | Builds `peerRows` by value; `participantsByTab` memoised                                                |
| `apps/editor/hooks/collab/usePeerRows.ts`                 | `usePeerCursorRows`, `usePeerAvatarRows`: subscribe and join with presence                              |
| `apps/editor/components/canvas/PeerCursors.tsx`           | The cursor layer: the element layer's only subscriber to cursors                                        |
| `apps/editor/components/canvas/CanvasCharactersLayer.tsx` | Subscribes to characters; draws them and runs the call hook ([Avatar pose store](avatar-pose-store.md)) |

## Domain and naming

| Term             | Identifier       | Meaning                                                                    |
| ---------------- | ---------------- | -------------------------------------------------------------------------- |
| Peer motion      | `PeerMotion`     | `{ cursors, avatars }`, two `StateStore`s of maps keyed by presence id     |
| Peer rows source | `PeerRowsSource` | `{ motion, livePresenceById, selfId, activeId, tabFocus }`, built by value |

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

## Errors and edge cases

- The store is never written during render: the coalescer writes in an animation frame, the roster's
  prune in a socket handler.
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

## Constants and configuration

- None new.

## Defaults ledger

- None.
