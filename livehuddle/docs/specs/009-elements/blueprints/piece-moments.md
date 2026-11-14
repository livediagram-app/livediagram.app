# Piece moments blueprint

Derived from [Piece moments](../piece-moments.md).

## Files

| File                                                              | Role                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/editor/lib/piece-moments.ts`                                | `MOMENT_KINDS`, `hasMoment`, the reach (`inMomentReach`), the durations, the trigger (`createMomentTrigger`, pure), the store     |
| `apps/editor/lib/piece-moment-motions.ts`                         | Pure data: which of a piece's own front parts move in its moment (`PART_MOTIONS`), and the whole-drawing motion (`wholeMotionOf`) |
| `apps/editor/components/canvas/collab/usePieceMoments.ts`         | Picks the moment pieces out of the board, feeds each step of your feet to the trigger, plays every piece it answers               |
| `apps/editor/components/canvas/collab/PieceMoments.tsx`           | `MomentDrawing` (the keyed wrapper that moves the drawing and its parts), `PieceMoment` (the drawn-over parts), `PondMoment`      |
| `apps/editor/components/canvas/collab/moment-kit.tsx`             | The shared drawn-over parts: falling, thrown and splashing bits, the sparkle, and `useFreshMoment`                                |
| `apps/editor/components/canvas/collab/OfficeMoments.tsx`          | The drawn-over parts of the static office, amenity, venue and team pieces, and `PoolMoment`                                       |
| `apps/editor/components/canvas/collab/office-moment-drawings.tsx` | The small drawings those moments are made of: a ring, drips, a breeze, a dart, steam, a sparrow and the rest                      |
| `apps/editor/components/canvas/collab/WalkUpMoments.tsx`          | The walk-up answers the pieces' own views play: `NoteSwing`, `LonePin`, `TickingHand`, `PageLift`, `WindowMoment`                 |
| `apps/editor/components/canvas/collab/SocialFaces.tsx`            | The Notice Board's face swings a note or wobbles a pin; the World Clock's face ticks its hands                                    |
| `apps/editor/components/canvas/collab/TeamFaces.tsx`              | The Calendar Wall's face lifts its page                                                                                           |
| `apps/editor/components/canvas/collab/WindowView.tsx`             | Draws `WindowMoment` over the window and its light                                                                                |
| `apps/editor/app/piece-moments.css`                               | The garden and fire keyframes; reduced motion for every moment                                                                    |
| `apps/editor/app/piece-moments-office.css`                        | The office, amenity, venue and team keyframes                                                                                     |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`          | Wraps the drawing in `MomentDrawing`, wraps each moving part, and draws `PieceMoment` over it, for a moment kind only             |
| `apps/editor/components/canvas/collab/PondView.tsx`               | Draws `PondMoment` over the water                                                                                                 |
| `apps/editor/components/canvas/collab/SwimmingPoolView.tsx`       | Draws `PoolMoment` over the water                                                                                                 |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`               | Calls `usePieceMoments` beside `useSocialPieces`                                                                                  |

## Domain and naming

| Term           | Identifier                                | Meaning                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Moment kind    | `MomentKind`, `MOMENT_KINDS`, `hasMoment` | Every static piece of the spec's table (35 kinds) and the six interactive pieces with a walk-up answer (41 kinds)                                                                                                                      |
| Walk-up answer | (a moment kind)                           | An interactive piece's moment: `hammock`, `notice-board`, `world-clock`, `calendar-wall`, `suggestion-box`, `window`                                                                                                                   |
| Face kind      | `playsOnFace`                             | A walk-up kind whose live face plays its moment (`notice-board`, `world-clock`, `calendar-wall`): its art keeps still at every facing and nothing is drawn over it                                                                     |
| Sway kind      | `SWAY_KINDS`, `swaysOnMoment`             | The kinds that look the same from every side and play at every facing: `tree`, `outdoor-plant`, `plant`                                                                                                                                |
| Reach          | `inMomentReach(feet, piece)`              | Whether your feet stand in: the piece's box from `MOMENT_TOP[kind]` of its height down to `MOMENT_BELOW[kind]` below it, widened by `MOMENT_REACH` each side (and above, at 0); a Window's is its light's side (`windowReach`)         |
| Moment         | `PieceMomentPlay`                         | `{ seq, side }`: a count that only grows, and the side you came from (Side)                                                                                                                                                            |
| Side           | `side`                                    | `-1` when your feet are before the piece's middle along its axis `(ux, uy)` (left of it, or along a turned Window's wall), else `1`; a swing leans by `-side`, a thrown thing comes from `side`, the nearest of two parts is on `side` |
| Trigger        | `createMomentTrigger({ now })`            | The state between steps: the reaches your feet were in (`near`), and when each piece's last moment ends (`playingUntil`)                                                                                                               |
| Part motion    | `PartMotion`, `PART_MOTIONS`              | One of the piece's own front parts (by index in its front drawing) moving in its moment: a motion class, a delay, a pivot, a side                                                                                                      |
| Whole motion   | `wholeMotionOf(kind, front)`              | The class that moves the whole drawing: `sway`, `rustle`, `thunk`, `rattle`, `hum`, or `nudge` for a turned piece                                                                                                                      |
| Drawn-over     | `PieceMoment`, `PoolMoment`, `PondMoment` | New things a moment draws over the art (leaves, steam, a dart, a duck), removed by nothing: they end invisible                                                                                                                         |
| Moment length  | `MOMENT_MS[kind]`                         | How long a kind's moment plays, its longest part's delay plus duration, rounded up                                                                                                                                                     |

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
- **Turned**: a piece that is not a sway kind or a face kind and shows its back or side plays the whole-drawing
  `nudge` and no part motion or drawn-over part (those are drawn on the front).
- **A Window's reach**: `momentPiece` takes the element's `rotation`; for a `window` it turns the rectangle from the
  wall's centre line to `height / 2 + WALL_REACH` into the room (local +y) and `width / 2 + MOMENT_REACH` each way
  along it (local x) clockwise about the window's middle, and keeps the box around it. `(ux, uy)` is the window's own
  +x turned the same way, rounded to 1e-9 so a quarter turn is exact. Every other kind has `(1, 0)`.
- **Face kinds**: `NoticeBoardFace`, `WorldClockFace` and `CalendarWallFace` read `useFreshMoment(element.id)`; a fresh
  play re-renders that face only. The Notice Board wraps note `swingingNote(side, shown)` (0 on your left or when one
  note shows, else 1) in `NoteSwing` about its pin, or with no notes draws `LonePin` at the cork's top corner on your
  side (`x + 22` or `x + w - 18`, `y + 16`). The World Clock wraps each dial's minute hand in `TickingHand` about its
  centre, delayed by `waveDelay(cx, side, width)`. The Calendar Wall draws `PageLift` at the sheet's bottom corner away
  from you (the near one is under your character), `(200, 160)` from the left or `(0, 160)` from the right.
- **The Window**: `WindowView` draws `WindowMoment`, which reads `useFreshMoment(id)` and draws, keyed by the play, a
  second wash of the light (`lh-moment-pulse`, peak 1) and a glint clipped to the pane, sweeping `pane.w + 8` px from
  your end.

## Interfaces and contracts

- `inMomentReach(feet: Point, piece: MomentPiece): boolean`, `MomentPiece = Box & { id, kind, left, top, right, bottom, cx, cy, ux, uy }`,
  each reach box worked out once by `momentPiece(piece: Box & { id, kind, rotation? }): MomentPiece` when the board
  changes.
- `playsOnFace(kind: string): boolean`; `swingingNote(side, shown: number): number`.
- `NoteSwing({ play, x, y, children })`, `LonePin({ play, x, y })`, `TickingHand({ play, cx, cy, width, children })`,
  `PageLift({ play, x, y })`, `WindowMoment({ id, light, gradient, pane })`.
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
- A Window off any wall (placed freely, unturned): its reach is below it, where its light falls.
- A Window at an angle that is not a quarter turn (a custom room's slanted wall): the box around the turned reach,
  a little larger at the corners than the floor its light falls on.
- A Notice Board with one note: that note swings from either side. With none: the lone pin, which ends invisible.
- A World Clock before its first minute is read (`now` 0): it draws no hands, so nothing ticks.
- Someone sitting in the Hammock: the sitter is drawn by the characters' layer and keeps still; the ring under the
  sling keeps still too (it is drawn at `ringUnder`, outside the moving parts).
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
  (`apps/editor/components/canvas/collab/usePieceMoments.perf.test.ts`). Measured on 2026-11-07, 1000 steps, best
  of 7: 0.46 ms among 200 pieces, 1.46 ms among 500 and 7.63 ms among 2000, against 2.25, 5.43 and 26.13 ms for the
  trigger it replaces, because each reach box is worked out once by `momentPiece`.
- At rest: no loop, no timer, no rAF, and no wrapper node (the part wrappers mount only while a moment plays). A
  moment: one keyed SVG group of at most 12 drawn-over nodes plus at most 12 wrapped parts, one-shot CSS on transform
  and opacity, under 3 s.

## Presentation and UX

Coordinates are in each piece's front drawing (`OFFICE_ART` grid). Easing is ease-out or ease-in-out; nothing is
linear but a thrown thing's travel across. A swing peaks at its `--swing` and damps through four swings to rest.

| Kind            | Moves (parts of the front drawing)                                                | Drawn over                                                     | Length |
| --------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Tree            | Whole drawing sways 3.6 degrees from its base                                     | Five 12 px leaves falling, one yellow                          | 2.8 s  |
| Outdoor Plant   | Whole drawing rustles                                                             | Two butterflies                                                | 2.7 s  |
| Plant           | Whole drawing rustles                                                             | One leaf                                                       | 2 s    |
| Pond            | Nothing                                                                           | Pebble, splash, two rings                                      | 2.4 s  |
| Fountain        | Nothing                                                                           | Coin, glint, ring                                              | 2.1 s  |
| Fireplace       | Nothing                                                                           | Flare, six sparks, glow                                        | 1.8 s  |
| Campfire        | Nothing                                                                           | Flare, six sparks, glow                                        | 1.8 s  |
| Vending Machine | Nothing                                                                           | A can, the display blink                                       | 1.5 s  |
| Bookshelf       | The middle and bottom shelves' 18 books hop 3 px, tipping, in a wave from you     | Nothing                                                        | 1.4 s  |
| Bar             | The three glasses hop 4 px in turn from you                                       | A sparkle over each glass                                      | 1.7 s  |
| Garden Umbrella | Canopy, fringe and finial swing 4 degrees on the pole top (60, 40)                | Two breeze strokes across from your side                       | 1.9 s  |
| Pool Table      | Cue ball rolls 63 px into the rack and draws back; the six rack balls jostle      | Nothing                                                        | 1.9 s  |
| Foosball Table  | The ball shoots 66 px into the far goal and is back at centre; the figures jiggle | A flash in the goal mouth                                      | 1.7 s  |
| Dartboard       | Whole drawing thunks (a 0.8 px shudder) as the dart lands                         | A dart flying in from your side to (41, 48)                    | 1.7 s  |
| Printer         | The paper stack dips 1.5 px; the light winks twice                                | A 26 x 18 page sliding out of the slot (clipped to it)         | 1.9 s  |
| Copier          | The display's two lines wink                                                      | A light bar sweeping under the lid; a copy onto the top tray   | 2 s    |
| Lockers         | Whole drawing rattles                                                             | A folded note falling from the nearest locker's vent           | 2.5 s  |
| Coat Rack       | Coats and scarf swing 4 degrees on the hooks (28, 22); the hat hops 2 px          | Nothing                                                        | 1.9 s  |
| Umbrella Stand  | Each umbrella swings 6 degrees on its foot, in a wave from you                    | A raindrop down the stand and a ring on the floor              | 2.7 s  |
| Kitchen Counter | The nearest cupboard door, its panel line and handle, opens to 60 % and shuts     | Nothing                                                        | 1.3 s  |
| Kitchen Sink    | The tea towel swings 5 degrees on the door (78, 33)                               | Three drops from the tap, a ring each                          | 2.8 s  |
| Fridge          | The photo and the note on the door swing on their magnets                         | Three puffs of cold air from the door seal                     | 1.8 s  |
| Microwave       | The display winks                                                                 | A warm glow over the window; a sparkle at the corner           | 1.8 s  |
| Kettle          | The lid jiggles 1.5 px                                                            | Three puffs of steam from the spout                            | 1.9 s  |
| Toilet Cubicle  | The cistern button dips 1 px                                                      | Two blue rings swirling in to the bowl's middle                | 1.5 s  |
| Washbasin       | Nothing                                                                           | Two drops from the tap, a ring; a light band across the glass  | 2.4 s  |
| Hand Dryer      | Whole drawing hums; the light winks                                               | Three lines of air down from the nozzle                        | 1.3 s  |
| Car Park        | Nothing                                                                           | Two flashes of the nearest car's headlights                    | 1.3 s  |
| Bike Rack       | The nearest bike's front-wheel spokes spin one and a half turns and slow          | A sparkle at its bell                                          | 1.7 s  |
| Swimming Pool   | Nothing (drawn to size)                                                           | A rubber duck bobbing on your side, two rings                  | 2.5 s  |
| Hammock         | Ropes, sling, band and spreader bars swing 4 degrees on (76, 16), 1.8 s           | Nothing                                                        | 1.9 s  |
| Notice Board    | The top note on your side swings 6 degrees on its pin, 1.6 s (on its face)        | On bare cork: a red pin pops in at your corner, wobbles, fades | 1.7 s  |
| World Clock     | Each minute hand ticks once round in 12 steps, 1.2 s, a wave from you (its face)  | Nothing                                                        | 1.7 s  |
| Calendar Wall   | Nothing                                                                           | A 28 px dog-ear curling up at the far bottom corner, 1.3 s     | 1.4 s  |
| Suggestion Box  | The note in the slot and its writing rise 5 px and sink back, 1.1 s               | The bulb's glow (r 9, peak 0.75) and a sparkle beside it       | 1.5 s  |
| Window          | Nothing                                                                           | The light's second wash (1.6 s); a glint across the pane       | 1.7 s  |
| Stage Curtains  | Each drape, with its tie-back and tassel, swings 2 degrees from the rail          | Nothing                                                        | 1.9 s  |
| Podium          | The microphone bobs; its red light winks                                          | Three sound rings out of the microphone                        | 2.0 s  |
| Team Photo Wall | Nothing                                                                           | A camera flash over the board; a sparkle on the plate          | 1.1 s  |
| Pillar          | Nothing                                                                           | A band of light down the shaft (clipped to it)                 | 1.5 s  |
| Column          | Nothing                                                                           | A sparrow landing on the capital, hopping and flying off       | 2.5 s  |

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

- `apps/editor/lib/piece-moments.test.ts`: the reach per kind (wall and counter pieces, the hung walk-up pieces, a
  Window unturned, a quarter and a half turn), your side along a turned Window, every arrival plays, no
  restart mid-play, the next arrival after it ends plays, two pieces on one step both play, reset, the store's seq and
  side, every kind's length under 3 s.
- `apps/editor/lib/piece-moment-motions.test.ts`: every part motion names a real part of the kind's front drawing (its
  tag and fill), only moment kinds have motions, the moves-only and face kinds, the whole motion per facing (none for
  a face kind).
- `apps/editor/components/canvas/collab/PieceMoments.test.tsx`: nothing drawn at mount, a moment drawn on a new seq,
  not replayed on remount, the sway class by side, every kind plays something (the face kinds and the Window drawn
  through `PieceArt`), the nearest part moves, a turned piece nudges, the Hammock's and the Suggestion Box's parts, the
  note on your side or the lone pin, the clock hands' wave, the page's corner, the window's glint direction, a turned
  face piece playing on its face.
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
| `CURL`          | 28 px (WalkUpMoments.tsx)                                                                                 | The Calendar Wall's dog-ear: big enough to read at 100 %, inside the bottom row's cell    |

## Defaults ledger

D217, D219 to D220, D231 to D233 and D235 in [DEFAULTS.md](DEFAULTS.md) (D218, the chance, is retired).
