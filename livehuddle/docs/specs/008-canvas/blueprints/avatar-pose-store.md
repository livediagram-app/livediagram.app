# Avatar pose store

Derived from [Canvas performance](../canvas-performance.md), the rule **Walking renders the characters,
not the canvas**. The same shape as the [Peer-motion store](peer-motion-store.md).

## Files

| File                                                      | Role                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `../packages/avatar/src/pose.ts`                          | `AvatarPose`, `NO_POSE`, `mergePose`, `poseFeet`, `posePlaced`                  |
| `../packages/avatar/src/hooks/useAvatarWalk.ts`           | Owns the `poseStore`; writes it from the loop; returns `placed`, `standingOnId` |
| `../packages/avatar/src/hooks/useAvatarPose.ts`           | `useAvatarPose(store, select, equal)`: a by-value slice of the pose             |
| `../packages/avatar/src/components/AvatarSelfWalker.tsx`  | Your character, subscribed to the whole pose                                    |
| `../packages/workbench/src/lib/state-store.ts`            | `joinStores(a, b)`: two stores read as one, for a slice over both               |
| `apps/editor/hooks/collab/usePeerRows.ts`                 | `peerAvatarRowsOf`, `readPeerAvatarRows`, `usePeerAvatarSlice`                  |
| `apps/editor/components/canvas/CanvasCharactersLayer.tsx` | Every character and what rides on them, subscribed to both stores               |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`       | Reads positions only as by-value facts                                          |
| `apps/editor/components/canvas/Canvas.tsx`                | Reads no position; mounts the characters layer                                  |

## Domain and naming

| Term       | Identifier   | Meaning                                                                                  |
| ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| Pose       | `AvatarPose` | `{ pos, facing, walking, lift, wave, stepFrame, pose }`: what the sprite draws per frame |
| Pose store | `poseStore`  | A `StateStore<AvatarPose>` made once per walk hook                                       |
| Placed     | `placed`     | In the mode with a position: the store's `pos` is not null                               |

## Behaviour and state

- The loop builds one patch per frame and merges it (`mergePose`): a patch that changes nothing hands back
  the same pose, so an idle character notifies nobody, as the old per-field `setState` bailed out.
- `pos` is null outside the mode; the remembered spot stays in the loop's ref and comes back on entry. A
  teleport while the mode is off moves the ref only.
- Leaving the mode drops the walk, hop, wave and reaction from the pose in the leave effect.
- `standingOnId` is a slice of the store (`elementUnderFeet` per store change, a new selector per board), so
  the host renders only when the element under the feet changes. The arrival effects (portal, chair, pad,
  drink, the Elevator's panel) key on it as before.
- `placed` is the slice that starts the standing publish and a Walk There asked for before the mode.
- Everything else reads the live position when it runs: `readPos()` (the shove's target, Walk There, a
  climb, a door press, sending a speech bubble, the pad arrival rule, the editor's Fit).
- The characters layer subscribes to the whole pose and the peer rows. It runs the call hook, the piece
  triggers (social pieces, piece moments, workday pieces), the table game scene, the pad arrivals and the
  Directory's who-is-where publish, and draws every character, the hearing ring, the talking bars, raised
  hands, call bubbles, pad beams and speech bubbles.
- `useCanvasAvatar` reads by value: the shut pods' key and seat holders (`usePeerAvatarSlice`), the stage
  you speak from (`useAvatarPose`), and who sits or stands on each piece (a slice of `joinStores(poseStore,
peers)` compared with `sameSitters`).
- `AvatarWalker` places its box with `transform: translate3d(...)` at `left: 0; top: 0`; a peer's glide
  transitions `transform`. The sprite is memoised on what it draws.

## Errors and edge cases

- The store is never written during render: the loop writes in an animation frame, the actions in handlers
  and effects.
- A peer leaving or joining is a new `peers` source: every slice selects again.

## Performance and limits

- What reads your feet as a fact for others' sake (who is where, the meeting pieces, the call's scene) reads
  `useCoarseMotion`'s feet ([Peer-motion store](peer-motion-store.md) "The coarse copy"): your feet at most every
  `COARSE_MOTION_MS`, and at once when you are placed or lifted, or cross into another room or onto a stage.
- Per walking frame: one pose notification. Renders: `AvatarSelfWalker` and the characters layer. The
  canvas, `useCanvasAvatar` and the element layer render 0 times, the centred camera's pan included: it
  writes the canvas's transform outside React ([Viewport store](viewport-store.md) "Inside the canvas").
- Measured by `useAvatarWalk.renders.test.tsx`: two seconds of walking (125 frames) rendered the walk's
  host 125 times before, and 5 times now (once per change of the element under the feet).

## Observability

- None: a walking frame is a hot path and is not logged.

## Testing

| Rule                                                      | Test                                         |
| --------------------------------------------------------- | -------------------------------------------- |
| A walk renders its host only when a fact under it changes | `useAvatarWalk.renders.test.tsx`             |
| An idle frame, and a patch of equal values, notify nobody | `pose.test.ts`                               |
| Joined stores notify for either and cache the pair        | `state-store.test.ts` (workbench)            |
| A peer's glide transitions the transform                  | `AvatarWalker.glide.test.tsx`                |
| Walking end to end                                        | `spaces-walk.spec.ts`, `viewer-walk.spec.ts` |

## Constants and configuration

- None new.

## Defaults ledger

- None.
