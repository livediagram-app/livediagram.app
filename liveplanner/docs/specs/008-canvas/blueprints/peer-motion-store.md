# Peer-motion store

Derived from [Canvas performance](../canvas-performance.md), the rule **A collaborator moving renders
what shows them, not the editor**. The same shape as the [Viewport store](viewport-store.md).

## Files

| File                                                 | Role                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `../packages/workbench/src/lib/state-store.ts`       | `createStateStore(initial)`: one value outside React, a setState-shaped `set` |
| `apps/editor/lib/peer-motion.ts`                     | `createPeerMotion`, `PeerMotion`, `PeerRowsSource`, `CursorPos`               |
| `apps/editor/app/project/[id]/usePresenceState.ts`   | Makes the store once; `setRemoteCursors` is its setter                        |
| `apps/editor/app/project/[id]/presence-coalescer.ts` | Unchanged contract: writes the cursors once a frame through that setter       |
| `apps/editor/app/project/[id]/usePresenceRows.ts`    | Builds `peerRows` by value; `participantsByTab` memoised                      |
| `apps/editor/hooks/collab/usePeerRows.ts`            | `usePeerCursorRows`: subscribes and joins with presence                       |
| `apps/editor/components/canvas/PeerCursors.tsx`      | The cursor layer: the only subscriber to cursors                              |

## Domain and naming

| Term             | Identifier       | Meaning                                                                         |
| ---------------- | ---------------- | ------------------------------------------------------------------------------- |
| Peer motion      | `PeerMotion`     | `{ cursors }`, a `StateStore` of a map keyed by presence id                     |
| Peer rows source | `PeerRowsSource` | `{ motion, livePresenceById, selfId, activeId, cursorsHidden }`, built by value |

## Behaviour and state

- `createStateStore(initial)` holds one value; `set` takes a value or an updater, and a result that is
  the same value (`Object.is`) notifies nobody.
- `usePresenceState` makes one `PeerMotion` per editor (`useState(createPeerMotion)`) and returns it with
  its setter as `setRemoteCursors`, so the room connection, the coalescer and the roster's prune keep
  their shape. It no longer returns `remoteCursors`.
- `usePresenceRows` never reads the map. It returns `peerRows`, memoised on the store, the presence by
  id, our id, the active tab and whether a vote hides cursors, and no longer `remoteCursorRows`.
- `participantsByTab` is memoised on what it reads, keyed on the tabs' ids rather than the tabs, so an
  edit does not rebuild it.
- The editor context carries `peerRows`; `EditorCanvasHost` passes it to the canvas as `peers`, and
  `CanvasElementsLayer` renders `PeerCursors`, which calls `usePeerCursorRows`: `useStoreSlice` over the
  cursors, then `buildRemoteCursorRows`, or none while a vote hides cursors.

## Errors and edge cases

- The store is never written during render: the coalescer writes in an animation frame, the roster's
  prune in a socket handler.
- A prune that removes nobody returns the same map, so it notifies nobody.
- A peer who leaves drops out of the rows at once: `livePresenceById` changes, so `peerRows` does.

## Performance and limits

- Per presence frame: one notification. Renders: `PeerCursors` only. The editor root, the chrome and
  every other reader of the editor context render 0 times.
- Measured by the render counter in `peer-motion.perf.test.tsx`: 30 peers by 60 frames rendered the root
  and a context reader 60 times each before, and 0 times now; the cursor layer renders 60 times.

## Observability

- None: a presence frame is a hot path and is not logged.

## Testing

| Rule                                                          | Test                                    |
| ------------------------------------------------------------- | --------------------------------------- |
| A same-value set notifies nobody; updaters; unsubscribe       | `state-store.test.ts` (workbench)       |
| The root and its context readers render 0 times for movement  | `peer-motion.perf.test.tsx`             |
| A leave still updates the tab lists and drops the peer's rows | `peer-motion.perf.test.tsx`             |
| A hide-cursors vote withholds cursors                         | `usePresenceRows.test.tsx`              |
| The coalescer's buffering                                     | `presence-coalescer.test.ts`, unchanged |

## Constants and configuration

- None new.

## Defaults ledger

- None.
