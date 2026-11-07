# Piece moments blueprint

Derived from [Piece moments](../piece-moments.md).

## Files

| File                                                        | Role                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/piece-moments.ts`                          | `MOMENT_KINDS`, `hasMoment`, the reach (`inMomentReach`), the durations, the trigger (`createMomentTrigger`, pure), the store     |
| `apps/editor/lib/piece-moment-motions.ts`                   | Pure data: which of a piece's own front parts move in its moment (`PART_MOTIONS`), and the whole-drawing motion (`wholeMotionOf`) |
| `apps/editor/components/canvas/collab/usePieceMoments.ts`   | Picks the moment pieces out of the board, feeds each step of your feet to the trigger, plays every piece it answers               |
| `apps/editor/components/canvas/collab/PieceMoments.tsx`     | `MomentDrawing` (the keyed wrapper that moves the drawing and its parts), `PieceMoment` (the drawn-over parts), `PondMoment`      |
| `apps/editor/components/canvas/collab/OfficeMoments.tsx`    | The drawn-over parts of the static office, amenity, venue and team pieces, and `PoolMoment`                                       |
| `apps/editor/app/piece-moments.css`                         | The garden and fire keyframes; reduced motion for every moment                                                                    |
| `apps/editor/app/piece-moments-office.css`                  | The office, amenity, venue and team keyframes                                                                                     |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`    | Wraps the drawing in `MomentDrawing`, wraps each moving part, and draws `PieceMoment` over it, for a moment kind only             |
| `apps/editor/components/canvas/collab/PondView.tsx`         | Draws `PondMoment` over the water                                                                                                 |
| `apps/editor/components/canvas/collab/SwimmingPoolView.tsx` | Draws `PoolMoment` over the water                                                                                                 |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`         | Calls `usePieceMoments` beside `useSocialPieces`                                                                                  |

## Domain and naming

| Term          | Identifier                                | Meaning                                                                                                                                                                        |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Moment kind   | `MomentKind`, `MOMENT_KINDS`, `hasMoment` | Every static piece of the spec's table (35 kinds)                                                                                                                              |
| Sway kind     | `SWAY_KINDS`, `swaysOnMoment`             | The kinds that look the same from every side and play at every facing: `tree`, `outdoor-plant`, `plant`                                                                        |
| Reach         | `inMomentReach(feet, piece)`              | Whether your feet stand in: the piece's box from `MOMENT_TOP[kind]` of its height down to `MOMENT_BELOW[kind]` below it, widened by `MOMENT_REACH` each side (and above, at 0) |
| Moment        | `PieceMomentPlay`                         | `{ seq, side }`: a count that only grows, and the side you came from (Side)                                                                                                    |
| Side          | `side`                                    | `-1` when your feet are left of the piece's middle, else `1`; a swing leans by `-side`, a thrown thing comes from `side`, the nearest of two parts is on `side`                |
| Trigger       | `createMomentTrigger({ now })`            | The state between steps: the reaches your feet were in (`near`), and when each piece's last moment ends (`playingUntil`)                                                       |
| Part motion   | `PartMotion`, `PART_MOTIONS`              | One of the piece's own front parts (by index in its front drawing) moving in its moment: a motion class, a delay, a pivot, a side                                              |
| Whole motion  | `wholeMotionOf(kind, front)`              | The class that moves the whole drawing: `sway`, `rustle`, `thunk`, `rattle`, `hum`, or `nudge` for a turned piece                                                              |
| Drawn-over    | `PieceMoment`, `PoolMoment`, `PondMoment` | New things a moment draws over the art (leaves, steam, a dart, a duck), removed by nothing: they end invisible                                                                 |
| Moment length | `MOMENT_MS[kind]`                         | How long a kind's moment plays, its longest part's delay plus duration, rounded up                                                                                             |

## Behaviour and state

- **Arrival**: `trigger.step(feet, pieces)` first drops from `near` (a reused Map of id to piece, a handful at most)
  every piece whose reach no longer holds the feet, then walks the pieces once: one whose reach holds the feet and is
  not in `near` is an arrival (added to `near`).
- **Every arrival plays** unless that piece is still playing: `now() < playingUntil[id]` skips it (it stays near, so
  standing there asks nothing more). Otherwise `playingUntil[id] = now() + MOMENT_MS[kind]` and it is a hit.
- **Every hit of a step plays**: `step` returns the hits of this step in one array the trigger reuses (cleared at the
  start of each step), so a step builds nothing; an empty array when nothing arrived.
- **Leaving Avatar mode or losing your feet**: `trigger.reset()` clears `near` (`playingUntil` is kept, so a moment
  mid-play is not restarted by a reset), so walking back in is an arrival again.
- **Playing**: `usePieceMoments` calls `playMoment(id, side)` for each hit, only when `prefersReducedMotion()` is false
  at that moment. `playMoment` bumps the piece's `seq` in a module store (`useSyncExternalStore`), so only that piece's
  views re-render.
- **Drawing**: `MomentDrawing` and `PieceMoment` read `usePieceMoment(id)` and remember the `seq` they mounted with; a
  `seq` above it draws the moment keyed by `seq` (a new moment remounts and replays its CSS), anything else draws
  nothing extra. So a tab switched back to never replays an old moment. `MomentDrawing` hands the fresh play to its
  children, and FurnitureView wraps each part named in `PART_MOTIONS[kind]` (front drawing only, and only for a part
  whose `side` is the play's, when it has one) in a `<g>` carrying the motion's class and custom properties. Finished
  one-shot animations hold their last frame (`both`), which is invisible (opacity 0) or the resting pose, so nothing
  needs a timer to unmount.
- **Turned**: a piece that is not a sway kind and shows its back or side plays the whole-drawing `nudge` and no part
  motion or drawn-over part (those are drawn on the front).

## Interfaces and contracts

- `inMomentReach(feet: Point, piece: MomentPiece): boolean`, `MomentPiece = Box & { id, kind }`.
- `createMomentTrigger(opts?: { now?: () => number }): { step(feet: Point, pieces: readonly MomentPiece[]): readonly MomentHit[]; reset(): void }`, `MomentHit = { id: string; side: -1 | 1 }`.
- `playMoment(id: string, side: -1 | 1): void`; `usePieceMoment(id: string): PieceMomentPlay | null`;
  `resetPieceMoments(): void` (tests).
- `PartMotion = { part: number; motion: PartMotionName; delay?: number; pivot?: readonly [x, y]; side?: Side; vars?: Record<string, string> }`;
  `partMotionsOf(kind: string): readonly PartMotion[]`; `partMotionStyle(m, side, width): CSSProperties`.
- `MomentDrawing({ kind, id, front, children: (play: PieceMomentPlay | null) => ReactNode })`.

## Data and persistence

Nothing is stored or sent. The store lives in the module for the page's life; the trigger lives in the hook for the
board's life.

## Errors and edge cases

- A piece deleted mid-moment: its view unmounts; the store keeps a stale `seq` for its id, harmless; `playingUntil`
  keeps one number for it, harmless.
- Two pieces' reaches overlapping: one step arriving at both plays both.
- Walking out and back in mid-moment: still playing, so nothing restarts; the arrival after it ends plays.
- A moment piece inside the placement preview: the preview's element id never plays, so it draws no moment.
- Standing still inside a reach: no new arrival, nothing played.
- A part index in `PART_MOTIONS` that the art no longer has: `piece-moment-motions.test.ts` holds every index against
  the front drawing's part (its tag and fill), so an art change that moves a part fails the test, not the screen.
- A wrapped part keeps its own paint: the wrapper `<g>` only adds a transform or opacity.

## Security and trust

Local only: no input from anyone else reaches it.

## Performance and limits

- Per step: one `inside` test per moment piece, no allocation (the hit array is reused). Budget test: 1000 steps among
  2000 moment pieces of every kind, with the pieces packed so each step arrives somewhere, inside `cpuBudgetMs(120)`
  (`apps/editor/components/canvas/collab/usePieceMoments.perf.test.ts`).
- At rest: no loop, no timer, no rAF, and no wrapper node (the part wrappers mount only while a moment plays). A
  moment: one keyed SVG group of at most 12 drawn-over nodes plus at most 12 wrapped parts, one-shot CSS on transform
  and opacity, under 3 s.

## Presentation and UX

Coordinates are in each piece's front drawing (`OFFICE_ART` grid). Easing is ease-out or ease-in-out; nothing is
linear but a thrown thing's travel across. A swing peaks at its `--swing` and damps through four swings to rest.

| Kind            | Moves (parts of the front drawing)                                                | Drawn over                                                    | Length |
| --------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| Tree            | Whole drawing sways 3.6 degrees from its base                                     | Five 12 px leaves falling, one yellow                         | 2.8 s  |
| Outdoor Plant   | Whole drawing rustles                                                             | Two butterflies                                               | 2.7 s  |
| Plant           | Whole drawing rustles                                                             | One leaf                                                      | 2 s    |
| Pond            | Nothing                                                                           | Pebble, splash, two rings                                     | 2.4 s  |
| Fountain        | Nothing                                                                           | Coin, glint, ring                                             | 2.1 s  |
| Fireplace       | Nothing                                                                           | Flare, six sparks, glow                                       | 1.8 s  |
| Campfire        | Nothing                                                                           | Flare, six sparks, glow                                       | 1.8 s  |
| Vending Machine | Nothing                                                                           | A can, the display blink                                      | 1.5 s  |
| Bookshelf       | The middle and bottom shelves' 18 books hop 3 px, tipping, in a wave from you     | Nothing                                                       | 1.4 s  |
| Bar             | The three glasses hop 4 px in turn from you                                       | A sparkle over each glass                                     | 1.7 s  |
| Garden Umbrella | Canopy, fringe and finial swing 4 degrees on the pole top (60, 40)                | Two breeze strokes across from your side                      | 1.9 s  |
| Pool Table      | Cue ball rolls 63 px into the rack and draws back; the six rack balls jostle      | Nothing                                                       | 1.9 s  |
| Foosball Table  | The ball shoots 66 px into the far goal and is back at centre; the figures jiggle | A flash in the goal mouth                                     | 1.7 s  |
| Dartboard       | Whole drawing thunks (a 0.8 px shudder) as the dart lands                         | A dart flying in from your side to (41, 48)                   | 1.7 s  |
| Printer         | The paper stack dips 1.5 px; the light winks twice                                | A 26 x 18 page sliding out of the slot (clipped to it)        | 1.9 s  |
| Copier          | The display's two lines wink                                                      | A light bar sweeping under the lid; a copy onto the top tray  | 2 s    |
| Lockers         | Whole drawing rattles                                                             | A folded note falling from the nearest locker's vent          | 2.5 s  |
| Coat Rack       | Coats and scarf swing 4 degrees on the hooks (28, 22); the hat hops 2 px          | Nothing                                                       | 1.9 s  |
| Umbrella Stand  | Each umbrella swings 6 degrees on its foot, in a wave from you                    | A raindrop down the stand and a ring on the floor             | 1.7 s  |
| Kitchen Counter | The nearest cupboard door, its panel line and handle, opens to 60 % and shuts     | Nothing                                                       | 1.3 s  |
| Kitchen Sink    | The tea towel swings 5 degrees on the door (78, 33)                               | Three drops from the tap, a ring each                         | 1.9 s  |
| Fridge          | The photo and the note on the door swing on their magnets                         | Three puffs of cold air from the door seal                    | 1.8 s  |
| Microwave       | The display winks                                                                 | A warm glow over the window; a sparkle at the corner          | 1.8 s  |
| Kettle          | The lid jiggles 1.5 px                                                            | Three puffs of steam from the spout                           | 1.9 s  |
| Toilet Cubicle  | The cistern button dips 1 px                                                      | Two blue rings swirling in to the bowl's middle               | 1.5 s  |
| Washbasin       | Nothing                                                                           | Two drops from the tap, a ring; a light band across the glass | 1.7 s  |
| Hand Dryer      | Whole drawing hums; the light winks                                               | Three lines of air down from the nozzle                       | 1.3 s  |
| Car Park        | Nothing                                                                           | Two flashes of the nearest car's headlights                   | 1.3 s  |
| Bike Rack       | The nearest bike's front-wheel spokes spin one and a half turns and slow          | A sparkle at its bell                                         | 1.7 s  |
| Swimming Pool   | Nothing (drawn to size)                                                           | A rubber duck bobbing on your side, two rings                 | 2.5 s  |
| Stage Curtains  | Each drape, with its tie-back and tassel, swings 2 degrees from the rail          | Nothing                                                       | 1.9 s  |
| Podium          | The microphone bobs; its red light winks                                          | Three sound rings out of the microphone                       | 1.7 s  |
| Team Photo Wall | Nothing                                                                           | A camera flash over the board; a sparkle on the plate         | 1.1 s  |
| Pillar          | Nothing                                                                           | A band of light down the shaft (clipped to it)                | 1.5 s  |
| Column          | Nothing                                                                           | A sparrow landing on the capital, hopping and flying off      | 2.5 s  |

A stoked fire's flare and glow are `SOCIAL_TONES.flame` on light paper and `DARK_FLARE` (`#fcd34d`, a light amber) on
dark paper, where the orange read brown over the soot. Steam and cold air are `#cbd5e1` on light paper and `#e2e8f0`
on dark, where white would vanish into light paper.

## Accessibility

Decorative: every drawn-over group is `aria-hidden`, and a wrapped part adds no role. Reduced motion (the OS setting
or `:root.reduce-motion`): no moment plays, and the CSS also sets `animation: none` on every `.lh-moment` (a wrapped
part then rests where it is drawn) and hides the drawn-over groups, in case one was mounted before the switch.

## Observability

None: a moment is a decoration with no failure mode. No telemetry event (it is not an action the person takes).

## Testing

- `apps/editor/lib/piece-moments.test.ts`: the reach per kind (wall and counter pieces too), every arrival plays, no
  restart mid-play, the next arrival after it ends plays, two pieces on one step both play, reset, the store's seq and
  side, every kind's length under 3 s.
- `apps/editor/lib/piece-moment-motions.test.ts`: every part motion names a real part of the kind's front drawing (its
  tag and fill), only moment kinds have motions, the whole motion per facing.
- `apps/editor/components/canvas/collab/PieceMoments.test.tsx`: nothing drawn at mount, a moment drawn on a new seq,
  not replayed on remount, the sway class by side, every kind plays something, the nearest part moves, a turned piece
  nudges.
- `apps/editor/components/canvas/collab/usePieceMoments.test.ts`: plays on every arrival in Avatar mode, two at once,
  nothing out of it, nothing under reduced motion.
- `apps/editor/components/canvas/collab/usePieceMoments.perf.test.ts`: the per-step budget.

## Constants and configuration

| Constant        | Value                                                                                                     | Why                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `MOMENT_REACH`  | 24 px                                                                                                     | The Arcade Machine's reach: "right next to it"                                            |
| `WALL_REACH`    | 56 px                                                                                                     | A wall piece's reach below: the floor in front of a room's back wall                      |
| `COUNTER_REACH` | 96 px                                                                                                     | A counter piece's reach below: a counter's 88 px body, then the floor in front of it      |
| `MOMENT_TOP`    | Per kind, 0 (all round what lies flat) to 0.85 (the foot of what stands tall); see `lib/piece-moments.ts` | Where the reach starts down the box: the base of what stands up, all round what lies flat |
| `MOMENT_MS`     | Per kind, 1100 to 2800 ms; the Presentation table's lengths                                               | The still-playing guard: how long a moment runs                                           |

## Defaults ledger

D217, D219 to D220 and D231 to D233 in [DEFAULTS.md](DEFAULTS.md) (D218, the chance, is retired).
