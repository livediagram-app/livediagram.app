# Venue pieces: blueprint

Derived from [Venue pieces](../venue-pieces.md).

## Files

| File                                                                      | Role                                                                                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-venue.ts`                                   | `OFFICE_VENUE_ART`, `VENUE_TONES`, `POOL_FILL`, `POOL_FILL_DARK`, `swimmingPoolParts`                                  |
| `packages/document/src/office.ts`                                         | The kinds join `OfficeKind`, `OFFICE_KINDS`, `OFFICE_ART`; `swimming-pool` a sized kind; `stageParts`, `STAGE_TONES`   |
| `packages/document/src/colors.ts`                                         | `FLOOR_FILLS['swimming-pool']`: the water, light and dark                                                              |
| `packages/document/src/svg-render-faces.ts`                               | The grid pieces through `furnitureArt`; the pool through `sizedSvg(swimmingPoolParts)`                                 |
| `packages/document/src/shape-factory.ts`                                  | Default sizes; grid pieces wordless and aspect locked; the pool wordless and free                                      |
| `packages/avatar/src/office-geometry.ts`                                  | Footprints (`OFFICE_FOOTPRINT`), `POOL_DECK`, `poolDeck`, the pool's inset footprint, `stage-curtains` a wall piece    |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`                  | `NOUN` for the six grid pieces                                                                                         |
| `apps/editor/components/canvas/collab/SwimmingPoolView.tsx`               | The pool at its own size, with the Pond's `lh-ripple`                                                                  |
| `apps/editor/components/canvas/collab/RoomView.tsx`                       | `SizedPieceView` paints every part through `FurniturePartView`, so the stage's own colours (nosing, skirt, lamps) show |
| `apps/editor/components/canvas/PieceArt.tsx`                              | `hasPieceArt('swimming-pool')` and its case                                                                            |
| `apps/editor/components/palette/palette-tile-defs.tsx`                    | The seven tiles                                                                                                        |
| `apps/editor/components/palette/palette-icons-venue.tsx`                  | Their glyphs                                                                                                           |
| `apps/editor/lib/avatar-click-intent.ts`                                  | Every one `walk`                                                                                                       |
| `packages/templates/src/template-builders-*.ts`                           | The placements below                                                                                                   |
| `packages/template-previews/src/template-preview-25.tsx` (and 23, 24, 26) | `Curtains`, `Podium`, `SwimmingPool`, `CarPark` (preview 25) and the stage's new woods (`STAGE_TOP`, `STAGE_FRONT`)    |

## Domain and naming

| Term           | Identifier       | Meaning                                                      |
| -------------- | ---------------- | ------------------------------------------------------------ |
| Pillar         | `pillar`         | 48 × 152, body in the theme                                  |
| Column         | `column`         | 64 × 168, stone                                              |
| Car Park       | `car-park`       | 240 × 128, three bays 76 apart (`BAY_LINES` 4, 80, 156, 232) |
| Bike Rack      | `bike-rack`      | 136 × 80, two hoops                                          |
| Swimming Pool  | `swimming-pool`  | Sized, default 320 × 200, deck `poolDeck(w, h)`              |
| Stage Curtains | `stage-curtains` | 360 × 120, a wall piece                                      |
| Podium         | `podium`         | 56 × 88                                                      |

## Behaviour and state

- Footprints (fractions of the box): pillar `x 0..1, y 134..150 / 152`; column `x 4..60 / 64, y 148..164 / 168`; car
  park `x 0..1, y 44..124 / 128`; bike rack `x 4..132 / 136, y 52..76 / 80`; podium `x 8..48 / 56, y 74..86 / 88`.
- The pool's footprint is in px: the box inset by `poolDeck(w, h) = max(0, min(POOL_DECK, min(w, h) / 10))`,
  `POOL_DECK = 14`. `swimmingPoolParts` draws the water at exactly that inset.
- `isWallPieceShape('stage-curtains')`: no footprint, `elementUnderFeet` skips it.
- **Speaking from the Podium** (`packages/avatar/src/lectern.ts`, `lectern-seats.ts`). `podium` joins `FixedSeatKind`
  and `STANDING_SEAT_KINDS` (office-geometry.ts), so it is held, claimed, yielded, carried round and drawn standing
  by the seat code every seat uses (seat-claims.ts, chair-sitters.ts, useAvatarWalkArrivals followSeat), and keeps its
  footprint. `SEAT_VIEWS.podium` reads `LECTERN_SEATS` (front, 56 × 88, `u 0.5, v 20/88`, facing down),
  `LECTERN_SEATS_BACK` (56 × 88, `u 0.5, v 104/88`) and `LECTERN_SEATS_SIDE` (44 × 88, `u 58/44, v 80/88`); the
  other facings are `turnedSitterFacing('down', facing)`: Left at `'e'`, Up at `'s'`, Right at `'w'` (the side
  mirrored, `u` read as `1 − u`). Each spot is 18 px or more from the foot at the default size, over a Tall
  character's reach (15.6). `DEFAULT_SEATING_FACING.podium = 'n'`. Stored `rotation` is never read.
- `lecternSpot(el)` is `seatPoints(el)[0]`; `lecternArea(el)` is the box grown to take in `LECTERN_CATCH` (16 px)
  round the spot; `catchArea(el)` is that for a Podium and the box for every other piece. `elementUnderFeet` (walk.ts)
  no longer skips scenery that `seatsACharacter`, and tests a Podium's feet against `lecternArea` (worked out only for
  a Podium, so the per-frame test allocates nothing else); the chair arrival's `sitsOnEntry` takes `catchArea(el)`.
- `walkPointFor` (apps/editor/lib/avatar-click-intent.ts) sends a click anywhere on a Podium to `lecternSpot`.
- Taken: `seatOnArrival` and `seatToYield` stop a Podium's late comer at `lecternAside(spot, from)`: `LECTERN_ASIDE`
  (64 px) along x when the speaker faces up or down, along y when they face left or right, toward `from` (ties to +).
  Every other piece keeps `besideBox`.
- FurnitureView names it "Podium" empty and "Podium, <names> speaking" held.
- The voice's reach is the call's ([Proximity audio](../../012-collaboration/blueprints/proximity-audio.md) "Hearing"):
  `callLecterns`, `voiceReach`, `LECTERN_VOICE_REACH` in `packages/document/src/call-geometry.ts`.
- Stage drawing (`stageParts`): top panel; one `rail` path of plank lines (rows `min(8, max(1, round(top / 24)))`) and
  each row's joints every 104 px from `30 + STAGE_JOINT_OFFSETS[row % 8]`; a nosing panel 5 + 1 px at `top - 5` in
  `STAGE_TONES.nosing`; the skirt `face` in `STAGE_TONES.skirt`; lamps every `(w - 16) / floor((w - 16) / 40)` px,
  none within 8 px of the plate, as two `mark` paths (lamp, glint); the plate last.

## Interfaces and contracts

New `ShapeKind` members only; no fields. `createShape(kind)`: grid pieces `label: ''`, `aspectLocked: true`; the pool
`label: ''`, not locked.

## Data and persistence

No new fields. Older clients see an unknown kind as every new kind. `STAGE_FLOOR` changes from `#fbf7ef` to `#ecc98f`
and `STAGE_FLOOR_DARK` from `#3a3430` to `#4a3628`: a stage with no fill of its own draws in the new wood; a stored
fill is kept.

## Errors and edge cases

- A pool shrunk small keeps water (the deck is at most a tenth of the shorter side); below 24 px of breadth no lane
  stripes, below 200 px of length or 40 of breadth no floats, below 80 × 48 of water no ladder; size 0 draws nothing.
- A stage too narrow for a lamp beside its plate draws none; parts of no size are dropped.

## Security and trust

Editors only (`can.edit`, the palette). No op or field.

## Performance and limits

Grid pieces: 8 to 30 static parts each. The pool and the stage: a fixed handful of parts (at most 10 for the pool,
about 8 for the stage) however big; their paths grow with the size (one float per 12 px, one joint per 104 px), linear.
A 20000 × 8000 pool's parts build inside a 20 ms CPU budget (test).

## Presentation and UX

See the spec. Captions: Pillar, Column, Car Park, Bike Rack, Swimming Pool, Stage Curtains, Podium. Rooms' Floor group:
Fence, Stage, Stage Curtains, Podium, Office Pod, Rug, Pillar, Column. Garden: … Pond, Swimming Pool, Campfire, Car
Park, Bike Rack.

## Accessibility

FurnitureView names each (`Pillar`, `Column`, `Car park`, `Bike rack`, `Stage curtains`, `Podium`); the pool's view
is `role="img"` "Swimming pool". The ripple is still under reduced motion (`lh-social-anim`).

## Observability

`Element · Added · <Kind>` (`Pillar`, `Column`, `Car-park`, `Bike-rack`, `Swimming-pool`, `Stage-curtains`, `Podium`)
in `PALETTE_TELEMETRY_TYPES`.

## Testing

- `office-venue.test.ts` (document): grid pieces at their size, wordless, locked, parts in the grid, the mirrored
  drapes; the pool's water at the deck, its lanes, ladder and CPU budget.
- `office.test.ts`: the stage's boards, nosing, skirt, footlights clear of the plate, the plank cap.
- `venue-pieces.test.ts` (avatar): footprints, the pool's inset and a walk stopping at its rim, the curtains walked
  through, nobody seated but the Podium's speaker.
- `lectern.test.ts` (avatar): the spot and facing at 0, 90, 180 and 270 degrees, a stored rotation at any angle
  ignored, the spot clear of the foot, feet on the spot counted at the Podium, walking up to it, the free spot, the
  taken case's step aside and two arriving at once.
- The template aisle tests (`template-builders-spaces-more.test.ts`, `template-builders-campus.test.ts`) leave the
  Podium out (templates-by-mode.md "Every Space is roomy").
- `venue-views.test.tsx` (editor): names, the pool view, click intents.
- `palette-layouts.test.ts`, `palette-tile-defs.test.tsx`: the tiles and their order.
- `template-venue.test.ts` (templates): placements; `template-builders-spaces-more.test.ts` lets a Podium stand under
  Stage Curtains and nothing else.

## Template placements

- All-Hands Hall (room-relative): curtains `(STAGE_X - 10, 30)` at width `STAGE_W + 20`; podium `(STAGE_X + 290, 82)`.
- Training Room: podium `(STAGE_X + 270, 62)`.
- Expo Hall: curtains `(MID - 240, STAGE_Y - 36)` at 480; podium `(MID + 80, STAGE_Y + 30)`; pillars at x 668 and
  `W - 716`, y each booth row.
- Conference Venue Main Hall: curtains `(320, 14)` at 480; podium `(680, 80)`.
- Startup HQ: bike rack `(HQ_GATE - PATH / 2 - 190, 1222)`.
- Hotel Lobby: columns at x 700, 860, 1276, 1436, y 1010. Rooftop: the pool `(700, 120)` 600 × 200 replaces the pond.
- Beach Offsite: pool `(1400, 900)` 440 × 200; planters move to `(1300, 1080)` and `(1880, 960)`.
- Company Campus: car parks `(1430, 1200)` and `(1670, 1200)`; bike rack `(MID - PATH / 2 - 148, 1250)`; the tree by
  the pond moves to `(1010, 1090)`; the bottom-right tree and planter make room for the car parks.

## Constants and configuration

`POOL_DECK = 14`; `STAGE_PLANK = 24`, `STAGE_PLANKS_MAX = 8`, `STAGE_JOINT = 104`, `STAGE_JOINT_OFFSETS`,
`STAGE_NOSING = 5`, `STAGE_LAMP = 40`; the pool's `FLOAT_EVERY = 12`, `LANE_FROM = 200`.

## Defaults ledger

- Stage Curtains never block (a wall piece): a single-box footprint could only block the whole stage or none of it.
- The car park blocks across all its bays, the empty one too: one footprint box per piece.
- The pool's deck is travertine (`#d4c19c`), not white tile: it reads on both papers and is no light base on dark.
- Pillars and Columns join Rooms (structure), the pool and arrivals Garden (outdoors), no new category.
