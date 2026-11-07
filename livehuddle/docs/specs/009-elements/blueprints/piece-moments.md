# Piece moments blueprint

Derived from [Piece moments](../piece-moments.md).

## Files

| File                                                      | Role                                                                                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/piece-moments.ts`                        | `MOMENT_KINDS`, `hasMoment`, the reach (`inMomentReach`), the trigger (`createMomentTrigger`, pure), the store (`playMoment`, `usePieceMoment`) |
| `apps/editor/components/canvas/collab/usePieceMoments.ts` | Picks the moment pieces out of the board, feeds each step of your feet to the trigger, plays what it answers                                    |
| `apps/editor/components/canvas/collab/PieceMoments.tsx`   | `MomentSway` (rocks a tree's or a plant's whole drawing), `PieceMoment` (the leaves, butterflies, sparks, can, coin), `PondMoment`              |
| `apps/editor/app/piece-moments.css`                       | The one-shot keyframes; none under reduced motion                                                                                               |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`  | Wraps the drawing in `MomentSway` and draws `PieceMoment` over it, for a moment kind only                                                       |
| `apps/editor/components/canvas/collab/PondView.tsx`       | Draws `PondMoment` over the water                                                                                                               |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`       | Calls `usePieceMoments` beside `useSocialPieces`                                                                                                |

## Domain and naming

| Term        | Identifier                                | Meaning                                                                                                                                                              |
| ----------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moment kind | `MomentKind`, `MOMENT_KINDS`, `hasMoment` | `tree`, `outdoor-plant`, `plant`, `pond`, `fountain`, `fireplace`, `campfire`, `vending-machine`                                                                     |
| Sway kind   | `SWAY_KINDS`, `swaysOnMoment`             | The kinds whose whole drawing rocks: `tree`, `outdoor-plant`, `plant`                                                                                                |
| Reach       | `inMomentReach(feet, piece)`              | Whether your feet stand in: the piece's box from `MOMENT_TOP[kind]` of its height down, widened by `MOMENT_REACH` each side and below (and above, when the top is 0) |
| Moment      | `PieceMomentPlay`                         | `{ seq, side }`: a count that only grows, and the side you came from (Side)                                                                                          |
| Side        | `side`                                    | `-1` when your feet are left of the piece's middle, else `1`; a sway leans by `-side`, a pebble or coin comes from `side`                                            |
| Trigger     | `createMomentTrigger({ random, now })`    | The state between steps: the reaches your feet were in, each piece's last ask, each piece's misses, the last moment                                                  |

## Behaviour and state

- **Arrival**: `trigger.step(feet, pieces)` first drops from `near` (a reused Map of id to piece, a handful at most)
  every piece whose reach no longer holds the feet, then walks the pieces once: one whose reach holds the feet and is
  not in `near` is an arrival (added to `near`). Only the first arrival of a step is asked; the others are only marked
  near. No allocation per step, and no Map traffic while you are near nothing.
- **The ask** (an arrival): skipped (returns null) when `now - lastAsk[id] < MOMENT_PIECE_REST_MS` or
  `now - lastPlay < MOMENT_GAP_MS`; a skip does not count as an ask. Otherwise `lastAsk[id] = now`, and it plays
  when `misses[id] >= MOMENT_MAX_MISSES` or `random() < MOMENT_CHANCE`; a play sets `misses[id] = 0` and
  `lastPlay = now`, a refusal adds one to `misses[id]`.
- **Leaving Avatar mode or losing your feet**: `trigger.reset()` clears `near` (rests and misses are kept for the
  board's life), so walking back in is an arrival again.
- **Playing**: `usePieceMoments` calls `playMoment(id, side)` only when `prefersReducedMotion()` is false at that
  moment. `playMoment` bumps the piece's `seq` in a module store (`useSyncExternalStore`), so only that piece's views
  re-render.
- **Drawing**: `MomentSway` and `PieceMoment` read `usePieceMoment(id)` and remember the `seq` they mounted with; a
  `seq` above it draws the moment keyed by `seq` (a new moment remounts and replays its CSS), anything else draws
  nothing extra. So a tab switched back to never replays an old moment. Finished one-shot animations hold their last
  frame (`both`), which is invisible (opacity 0) or the resting pose, so nothing needs a timer to unmount.

## Interfaces and contracts

- `inMomentReach(feet: Point, piece: MomentPiece): boolean`, `MomentPiece = Box & { id, kind }`.
- `createMomentTrigger(opts?: { random?: () => number; now?: () => number }): { step(feet: Point, pieces: readonly MomentPiece[]): { id: string; side: -1 | 1 } | null; reset(): void }`.
- `playMoment(id: string, side: -1 | 1): void`; `usePieceMoment(id: string): PieceMomentPlay | null`;
  `resetPieceMoments(): void` (tests).

## Data and persistence

Nothing is stored or sent. The store lives in the module for the page's life; the trigger lives in the hook for the
board's life.

## Errors and edge cases

- A piece deleted mid-moment: its view unmounts; the store keeps a stale `seq` for its id, harmless.
- Two pieces' reaches overlapping: one step arriving at both asks only the first; the second is near and waits for the
  next arrival.
- A moment piece inside the placement preview: the preview's element id never plays, so it draws no moment.
- Standing still inside a reach: no new arrival, no ask.

## Security and trust

Local only: no input from anyone else reaches it.

## Performance and limits

- Per step: one `inside` test per moment piece, no allocation. Budget test: 1000 steps among 2000 moment pieces inside
  `cpuBudgetMs(60)` (`apps/editor/components/canvas/collab/usePieceMoments.perf.test.ts`).
- At rest: no loop, no timer, no rAF. A moment: one keyed SVG group of at most 8 nodes, one-shot CSS on transform and
  opacity, under 3 s.

## Presentation and UX

Coordinates are in each piece's drawing (`OFFICE_ART` grid). Durations: tree 2.6 s, outdoor plant 2.4 s, plant 2 s,
pond 2.2 s, fountain 1.8 s, fireplace and campfire 1.6 s, vending machine 1.4 s. Easing is ease-out or ease-in-out;
nothing is linear but a thrown arc's travel across.

## Accessibility

Decorative: every moment group is `aria-hidden`. Reduced motion (the OS setting or `:root.reduce-motion`): no moment
plays, and the CSS also sets `animation: none` and hides the moment groups, in case one was mounted before the switch.

## Observability

None: a moment is a decoration with no failure mode. No telemetry event (it is not an action the person takes).

## Testing

- `apps/editor/lib/piece-moments.test.ts`: the reach per kind, arrival only on entering, the chance, the third-time rule, both
  rests, reset, the store's seq and side.
- `apps/editor/components/canvas/collab/PieceMoments.test.tsx`: nothing drawn at mount, a moment drawn on a new seq, not replayed on remount, the
  sway class by side, every kind draws.
- `apps/editor/components/canvas/collab/usePieceMoments.test.ts`: plays on arrival in Avatar mode, nothing out of it, nothing under reduced motion.
- `apps/editor/components/canvas/collab/usePieceMoments.perf.test.ts`: the per-step budget.

## Constants and configuration

| Constant               | Value                                                                                                         | Why                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `MOMENT_REACH`         | 24 px                                                                                                         | The Arcade Machine's reach: "right next to it"                                            |
| `MOMENT_CHANCE`        | 0.5                                                                                                           | "Occasionally": one arrival in two                                                        |
| `MOMENT_MAX_MISSES`    | 2                                                                                                             | Two refusals in a row, then the third arrival plays                                       |
| `MOMENT_PIECE_REST_MS` | 20000                                                                                                         | One ask a piece per 20 s, so pacing beside it is not a slot machine                       |
| `MOMENT_GAP_MS`        | 4000                                                                                                          | No two moments within 4 s anywhere, so a walk through a wood stays calm                   |
| `MOMENT_TOP`           | tree 0.6, outdoor-plant 0.45, plant 0.5, pond 0, fountain 0.5, fireplace 0.7, campfire 0, vending-machine 0.7 | Where the reach starts down the box: the base of what stands up, all round what lies flat |

## Defaults ledger

D217 to D220 in [DEFAULTS.md](DEFAULTS.md).
