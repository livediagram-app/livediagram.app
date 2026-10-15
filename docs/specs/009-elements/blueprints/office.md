# Office blueprint

Derived from [Office](../office.md).

## Files

| File                                                   | Role                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `packages/document/src/office.ts`                      | Kinds, drinks, tones, the drawings (`OFFICE_ART`), footprints, the room's parts and walls |
| `packages/document/src/seating.ts`                     | The meeting table as seating: `FURNITURE_ART['meeting-table']`, seats with a facing each  |
| `packages/document/src/shape-factory.ts`               | Default sizes and fields (`roomDoor`, label, padding, aspect lock)                        |
| `packages/document/src/validate-shape.ts`              | `roomDoor` validation                                                                     |
| `packages/document/src/colors.ts`                      | Skins (floor and rug fills), the room's `md` padding                                      |
| `packages/document/src/svg-render-faces.ts`            | Export: `furnitureArt` for the pieces, `roomSvg` for a room                               |
| `packages/api-schema/src/room-messages.ts`             | `AvatarPresence.holding`                                                                  |
| `apps/live/components/canvas/collab/FurnitureView.tsx` | Canvas drawing of every piece but the room; `MachineAnswer`                               |
| `apps/live/components/canvas/collab/RoomView.tsx`      | Canvas drawing of a room at its own size                                                  |
| `apps/live/lib/avatar-fence.ts`                        | `fenceSegments`: fences, room walls and footprints                                        |
| `apps/live/lib/avatar-walk.ts`                         | `elementUnderFeet` skips floor and scenery                                                |
| `apps/live/hooks/canvas/useAvatarWalk.ts`              | `giveDrink`, the held drink, `onWalkIntoDrink`, presence `holding`                        |
| `apps/live/components/canvas/avatar-sprite.tsx`        | `HeldCup`                                                                                 |
| `apps/live/components/canvas/Canvas.tsx`               | Drink on arrival, the machine's answer, a table seat's facing                             |
| `apps/live/app/document/[id]/useElementHelpers.ts`     | A room or rug goes in at the back                                                         |
| `apps/live/components/palette/CollabMenuSections.tsx`  | `RoomMenuSection`                                                                         |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`        | `setRoomDoorSelected`                                                                     |
| `apps/live/components/palette/palette-tile-defs.tsx`   | Seven Navigate tiles                                                                      |

## Domain and naming

| Term         | Identifier                           | Meaning                                                   |
| ------------ | ------------------------------------ | --------------------------------------------------------- |
| Office piece | `OfficeKind`, `OFFICE_KINDS`         | The seven kinds                                           |
| Floor piece  | `isFloorShape`                       | Room and rug: placed at the back, never block, never rung |
| Doorway      | `RoomDoor` (`ShapeElement.roomDoor`) | `'n' \| 'e' \| 's' \| 'w' \| 'none'`; absent = `'s'`      |
| Wall         | `roomWalls(el)` → `WallSegment[]`    | Blocking lines, broken at the doorway                     |
| Footprint    | `officeFootprint(el)`                | The blocking box of a plant or bookshelf                  |
| Drink        | `DrinkKind`, `drinkFrom(kind)`       | `'water'` (cooler), `'coffee'` (machine)                  |
| Held drink   | `AvatarPresence.holding`             | The drink in a character's hand, or none                  |
| Table seat   | `TableSeat`                          | `{ u, v, facing }`: a seat and its sitter's facing        |

## Behaviour and state

- **Placing**: `placeBoxed` prepends a floor piece (`[el, ...before]`), appends anything else.
- **Blocking**: `fenceSegments(elements)` emits, in paint order, a fence's line, a room's `roomWalls`, and a
  footprint's four `boxEdges`. `fenceStep` blocks them all with `FENCE_REACH`.
- **Room walls**: back at `y + ROOM_BACK_FACE - ROOM_WALL / 2`, front at `y + h - ROOM_WALL / 2`, sides at
  `x + ROOM_WALL / 2` and `x + w - ROOM_WALL / 2`; the doorway's wall split at `roomDoorSpan(length, door)`:
  centred, `min(ROOM_DOOR_WIDTH, length - 2 · ROOM_WALL - 8)` wide, none if that is ≤ 0 or `door` is `'none'`.
- **Destinations**: `elementUnderFeet` skips `isFloorShape`, `plant` and `bookshelf`. A meeting table and the
  machines remain destinations.
- **Sitting at the table**: `seatPoints` returns the six `tableSeats` with their `facing`; `Canvas.onWalkIntoChair`
  sits with `seat.facing ?? CHAIR_SITTER_FACING[seatingFacing(el)]`. `turnedSeatingBox` never turns a table.
- **Drinks**: `arriveOn` calls `onWalkIntoDrink(el)` when `drinkFrom(el.shape)`. `Canvas` then calls
  `avatar.giveDrink(kind)`, bumps `machineAnswer` for that element, and tracks the use. `giveDrink` sets
  `holdingRef`, sets `drink = { kind, seq + 1 }` and publishes an idle snapshot; an effect keyed on `drink` puts
  it down after `DRINK_HOLD_MS` (publishing again). Leaving the mode clears it.
- **The answer**: `MachineAnswer` animates three bubbles or drips with the Web Animations API on each bump, two
  iterations of `MACHINE_ANSWER_MS / 2`, skipped under reduced motion.
- **The cup**: `HeldCup` draws when `holding` and no reaction or wave is playing: at the right hand (front/back),
  the visible hand (profile), 70% opacity from behind; CSS `animate-avatar-sip` lifts it, `animate-avatar-steam`
  steams a coffee.

## Interfaces and contracts

```ts
export type OfficeKind = 'room' | 'meeting-table' | 'plant' | 'bookshelf' | 'water-cooler' | 'coffee-machine' | 'rug';
export type RoomDoor = 'n' | 'e' | 's' | 'w' | 'none';
export type DrinkKind = 'water' | 'coffee';
export function roomDoorSpan(length: number, door: RoomDoor): [number, number] | null;
export function roomParts(width: number, height: number, door: RoomDoor): FurniturePart[];
export function roomWalls(el: Box & { roomDoor?: RoomDoor }): WallSegment[];
export function officeFootprint(el: Box & { shape: string }): Box | null;
// AvatarPresence
holding?: 'water' | 'coffee' | null;
```

| Input                     | Handling                                     |
| ------------------------- | -------------------------------------------- |
| `roomDoor` absent         | `'s'`                                        |
| `roomDoor` off-vocabulary | `isValidElement` false (`validate-shape.ts`) |
| `holding` anything else   | The receiver draws an empty hand             |

## Data and persistence

`roomDoor` is the only stored field (synced, exported, undoable). A held drink, the machine's answer, and seating
are presence or local, never stored.

## Errors and edge cases

| #   | Case                           | Handling                                             |
| --- | ------------------------------ | ---------------------------------------------------- |
| E1  | Wall shorter than a doorway    | Narrower doorway; none when nothing is left (D209)   |
| E2  | Character inside a closed room | Stays inside until a portal (walls from either side) |
| E3  | Room rotated as an element     | Walls use the unrotated box (as a chair's arrival)   |
| E4  | Drink taken twice              | Swaps or refreshes; the minute restarts              |
| E5  | Reaction or flag mid-drink     | Cup hidden for the performance, back after           |
| E6  | Peer on an older build         | No `holding`: empty hand; walls still block for you  |

## Security and trust

A forged `holding` draws a cup on the forger's own character; the receiver accepts only the two drinks. Nothing
reaches the document.

## Performance and limits

`fenceSegments` is memoised per change to the elements; a room adds at most 5 segments and a footprint 4, so a
large office (20 rooms, 40 plants) is 260 segments, each step tested in O(segments) (measured with fences:
4.3 µs per step at 1,000). The answer animation runs only on a drink; the cup's loops are CSS.

## Presentation and UX

Drawings as in [Office](../office.md), from `OFFICE_ART` (grids: plant 56 × 88, bookshelf 120 × 132, cooler
56 × 112, coffee machine 72 × 96, rug 200 × 120, meeting table 232 × 168), outlines in the theme stroke, fixed
`OFFICE_TONES` for leaves, pots, water, coffee and spines. Room: floor in its fill, walls `ROOM_WALL` thick, back
wall face `ROOM_BACK_FACE` tall shaded with the stroke, mat in the doorway; label `sm`, top left, `md` padding so it
sits in the wall's face. Menu: **Room** section, five tiles (Top, Right, Bottom, Left, None), hint text as shipped.

## Accessibility

`FurnitureView` and `RoomView` SVGs are `role="img"` with the piece's name ("Water cooler", "Room, Kitchen"); a
meeting table names its sitters. Reduced motion stops the answer, the sip and the steam.

## Observability

Element add / change telemetry as every element; `Canvas · Used · WaterCooler | CoffeeMachine` per drink.

## Testing

| Rule                                        | Test                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| Kinds, sizes, room defaults, doorway values | `packages/document/src/office.test.ts`                     |
| Walls, doorway span, room drawing           | same                                                       |
| Footprints, table seats and facings         | same                                                       |
| Walls and footprints block; doorway passes  | `apps/live/lib/avatar-fence.test.ts`                       |
| Floor and scenery never rung                | `apps/live/lib/avatar-walk.test.ts`                        |
| Drink held, refreshed, put down; on arrival | `apps/live/hooks/canvas/useAvatarWalk.test.tsx`            |
| Views draw; plant stays green; table pill   | `apps/live/components/canvas/collab/office-views.test.tsx` |

## Constants and configuration

| Constant                  | Value                                                   | Provenance                                |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `ROOM_WALL`               | 10 canvas px                                            | D208                                      |
| `ROOM_BACK_FACE`          | 36 canvas px                                            | Holds an `sm` label at `md` padding       |
| `ROOM_DOOR_WIDTH`         | 96 canvas px                                            | 72 px clear after the walls' reach (D209) |
| `DRINK_HOLD_MS`           | 60 000                                                  | Spec                                      |
| `DRINK_SIP_EVERY_MS`      | 8 000                                                   | Spec (the CSS loop's period)              |
| `MACHINE_ANSWER_MS`       | 1 500                                                   | Spec                                      |
| `ROOM_FLOOR` / `RUG_FILL` | `#f5f0e6` / `#fde68a` light; `#292524` / `#713f12` dark | D210                                      |
