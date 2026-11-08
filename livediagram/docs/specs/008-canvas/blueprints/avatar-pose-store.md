# Avatar pose store

Derived from [Canvas performance](../canvas-performance.md), the rule **Walking renders your character,
not the canvas**. The same shape as the [Viewport store](viewport-store.md).

## Files

| File                                                     | Role                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `../packages/avatar/src/pose.ts`                         | `AvatarPose`, `NO_POSE`, `mergePose`, `poseFeet`, `posePlaced`                  |
| `../packages/avatar/src/hooks/useAvatarWalk.ts`          | Owns the `poseStore`; writes it from the loop; returns `placed`, `standingOnId` |
| `../packages/avatar/src/hooks/useAvatarPose.ts`          | `useAvatarPose(store, select, equal)`: a by-value slice of the pose             |
| `../packages/avatar/src/components/AvatarSelfWalker.tsx` | `AvatarSelfWalker`, `AvatarAtFeet`, `WithAvatarFeet`: readers that subscribe    |
| `apps/editor/components/canvas/Canvas.tsx`               | Reads no position; mounts the readers above                                     |

## Domain and naming

| Term       | Identifier   | Meaning                                                                                  |
| ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| Pose       | `AvatarPose` | `{ pos, facing, walking, lift, wave, stepFrame, pose }`: what the sprite draws per frame |
| Pose store | `poseStore`  | A `StateStore<AvatarPose>` made once per walk hook                                       |
| Placed     | `placed`     | In the mode with a position: the store's `pos` is not null                               |

## Behaviour and state

- The loop builds one patch per frame and merges it (`mergePose`): a patch that changes nothing hands back
  the same pose, so an idle character notifies nobody.
- `pos` is null outside the mode; the remembered spot stays in the loop's ref and comes back on entry.
- `standingOnId` is a slice of the store, so the canvas renders only when the element under the feet
  changes; the arrival effects key on it as before.
- Handlers read the live position when they run (`readPos()`): a click on a peer, a door, sending a
  speech bubble, the pad arrival rule, the editor's Fit.
- `AvatarSelfWalker` subscribes to the whole pose; `AvatarAtFeet` (the burst) and `WithAvatarFeet` (the
  speech composer, only while it is open) to the feet.
- `AvatarWalker` places its box with a `translate` transform at `left: 0; top: 0`; a peer's glide
  transitions `transform`. The sprite is memoised on what it draws.

## Errors and edge cases

- The store is never written during render: the loop writes in an animation frame, the actions in handlers
  and effects.

## Performance and limits

- Per walking frame: one pose notification; `AvatarSelfWalker` renders. The canvas and the element layer
  render 0 times unless the camera pans at an edge (a pan renders the canvas view, no element view) or
  the element under the feet changes. Peers' characters still come in as the canvas's props.
- Measured by `useAvatarWalk.renders.test.tsx`: two seconds of walking (125 frames) rendered the walk's
  host 125 times before, and 5 times now (once per change of the element under the feet).

## Observability

- None: a walking frame is a hot path and is not logged.

## Testing

| Rule                                                      | Test                             |
| --------------------------------------------------------- | -------------------------------- |
| A walk renders its host only when a fact under it changes | `useAvatarWalk.renders.test.tsx` |
| A patch of equal values hands back the same pose          | `pose.test.ts`                   |
| A peer's glide transitions the transform                  | `AvatarWalker.glide.test.tsx`    |

## Constants and configuration

- None new.

## Defaults ledger

- None.
