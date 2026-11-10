# Office amenities: blueprint

Derived from [Office amenities](../office-amenities.md).

## Files

| File                                                                               | Role                                                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `packages/document/src/office-workplace.ts`                                        | `OFFICE_WORKPLACE_ART`, `WORKPLACE_TONES`: printer, copier, lockers, coat rack, umbrella stand     |
| `packages/document/src/office-kitchen.ts`                                          | `OFFICE_KITCHEN_ART`, `KITCHEN_TONES`, `COUNTER_WORKTOP_Y`: the five kitchen pieces                |
| `packages/document/src/office-restroom.ts`                                         | `OFFICE_RESTROOM_ART`, `RESTROOM_TONES`: toilet cubicle, washbasin, hand dryer                     |
| `packages/document/src/room-presets.ts`                                            | `RESTROOM_VARIANT`, `RESTROOM_LAYOUT`, `roomPresetCompanions`                                      |
| `packages/document/src/shape-variants.ts`                                          | `applyShapeVariant(room, 'restroom')`: the room named Restroom                                     |
| `packages/document/src/room-builder.ts`                                            | `withDoorPiece(el, variant?)`: the Door, then the preset's companions                              |
| `packages/document/src/office.ts`                                                  | The kinds join `OfficeKind`, `OFFICE_KINDS` and `OFFICE_ART`                                       |
| `packages/avatar/src/office-geometry.ts`                                           | Footprints (`OFFICE_FOOTPRINT`), `isWallPieceShape` (hand dryer, microwave, kettle)                |
| `apps/editor/components/palette/tile-defs/amenity-tiles.tsx`                       | The tiles; `tools:umbrella-stand` and `tools:kettle` end their groups (`dividerAfter`)             |
| `apps/editor/components/palette/palette-icons-amenities.tsx`                       | The tiles' glyphs                                                                                  |
| `apps/editor/components/palette/category-flyout-groups.ts`                         | `GROUP_NAMES`: Office (`tools:plant`), Kitchen (`tools:water-cooler`), Restroom (`tools:restroom`) |
| `apps/editor/app/document/[id]/useElementHelpers.ts`                               | `addBoxedAt`'s `variant` option, handed to `withDoorPiece`                                         |
| `apps/editor/app/document/[id]/useElementCreation.ts`                              | A drop passes the tile's choice as the variant                                                     |
| `apps/editor/hooks/canvas/useShapeDrawing.ts`                                      | An armed tap passes `intent.variant`                                                               |
| `packages/templates/src/template-builders-office.ts`, `template-builders-tower.ts` | The templates' kitchenette, print corner, lockers, coat rack and Restroom                          |

## Domain and naming

| Term              | Identifier                                                 | Meaning                                                          |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| Kitchen unit      | `kitchen-counter`, `kitchen-sink`                          | 112 × 88, worktop top edge at `COUNTER_WORKTOP_Y` (14)           |
| Counter-top piece | `microwave`, `kettle` in `isWallPieceShape`                | Never blocks, never a destination; drawn standing on a worktop   |
| Restroom preset   | `RESTROOM_VARIANT` (`'restroom'`), the Room tile's variant | A Room named Restroom plus `roomPresetCompanions`                |
| Companions        | `roomPresetCompanions(room, variant)`                      | Cubicles, hand dryer, washbasins and a Room Sign, placed by room |

## Behaviour and state

- Footprints (`OFFICE_FOOTPRINT`, fractions of the box): printer `x 8..64 / 72, y 60..76 / 80`; copier
  `x 8..96 / 104, y 104..124 / 128`; lockers `x 0.03..0.97, y 0.8..0.96`; coat rack `x 14..42 / 56, y 114..126 / 128`;
  umbrella stand `x 6..34 / 40, y 50..62 / 64`; kitchen counter and sink `x 0..1, y 44..84 / 88`; fridge
  `x 4..68 / 72, y 108..132 / 136`; toilet cubicle `x 0..1, y 0.6..0.96`; washbasin `x 26..46 / 72, y 96..110 / 112`.
- `isWallPieceShape` adds `hand-dryer`, `microwave`, `kettle`: `elementUnderFeet` skips them, `officeFootprint` is null.
- Click intent (`avatar-click-intent.ts`): every one `walk`.
- Restroom layout (`RESTROOM_LAYOUT`, room-relative, for the 480 × 320 room): cubicles at `(16, 40)`, `(112, 40)`;
  hand dryer `(230, 64)`; washbasins `(290, 44)`, `(370, 44)`, below the room's name plate; the Room Sign 88 wide at
  `(room centre + 64, height + 10)`, below the front wall to the right of the Door. Companions carry the room's `strokeColor` when it has one.
- `withDoorPiece(el, 'restroom')` returns `[room, door, ...companions]`; any other variant (or none) is unchanged. The
  Room Sign comes last. Placing sets one commit, then one selection write: `placedSelection` of every piece.

## Interfaces and contracts

- `applyShapeVariant(createShape('room', x, y), 'restroom')` → the room with `label: 'Restroom'` (size unchanged).
- `addBoxedAt(x, y, make, { variant })`: `variant` reaches `withDoorPiece` only; nothing is stored on the element.

## Data and persistence

New `ShapeKind` members only; no new fields. Older clients see an unknown kind as every new kind (the shape-kind guard).

## Errors and edge cases

- A restroom room shrunk or moved later carries its pieces nowhere: they are separate elements (the Door rides; the rest
  do not, as any furniture).
- A dropped preset in a read-only session: blocked by `editsBlocked` before anything is built.

## Security and trust

Editors only (`can.edit`, the palette). No new op or field.

## Performance and limits

Static parts, 10 to 40 per drawing, painted by the shared furniture renderer; no loop, no per-frame work. The preset
adds seven elements in one commit.

## Presentation and UX

Drawings: see the spec. Perks' flyout shows the three named groups. Tile captions: Printer, Copier, Lockers, Coat
Rack, Umbrella Stand, Kitchen Counter, Kitchen Sink, Fridge, Microwave, Kettle, Restroom, Toilet Cubicle, Washbasin,
Hand Dryer.

## Accessibility

FurnitureView names each (`NOUN`: "Printer", "Copier", "Lockers", "Coat rack", "Umbrella stand", "Kitchen counter",
"Kitchen sink", "Fridge", "Microwave", "Kettle", "Toilet cubicle", "Washbasin", "Hand dryer").

## Observability

`Element · Added · <Kind>` per kind; the preset reports `Room`.

## Testing

- `office-amenities.test.ts` (document): every kind a grid piece at its own size, aspect locked, no label; parts inside
  the grid; counter and sink share the worktop line; the preset's companions inside the room and clear of its doorway.
- `amenity-pieces.test.ts` (avatar): footprints, wall pieces, nobody seated.
- `amenities-views.test.tsx` (editor): FurnitureView names each.
- `palette-layouts.test.ts`, `palette-tile-defs.test.tsx`, `category-flyout-groups.test.ts`: the tiles and groups.
- `template-amenities.test.ts` (templates): the kitchenette, the print corner and the Restroom in their templates.
- `template-builders-spaces-more.test.ts` "never stands one piece of furniture on another" lets a Microwave or a Kettle
  stand on a Kitchen Counter or Sink, and nothing else.

## Template placements

- Virtual Office Kitchen (`furnishRooms`, room-relative): Fridge `(20, 24)`; Counter `(96, 72)` with the Microwave at
  x 104 and the Kettle at x 170, both at `counterTopY(kind, 72)`; Sink `(312, 72)`; Coffee Machine `(432, 64)`; Water
  Cooler `(440, 196)`; plant `(30, 230)`. Reception: Coat Rack `(300, 176)`, Umbrella Stand `(362, 240)`. Desks: Printer
  `(392, 56)`.
- Co-working Tower Ground Floor: Hot Desks Copier `(232, 384)` and Printer `(352, 430)` right of the notice board,
  Lockers `(640, 392)`, all clear of the 96 px inside the door at 550; Cafe Fridge `(516, 24)`; Coat Rack and Umbrella
  Stand beside the entrance Directory.
- Co-working Tower Level 2: the Restroom room at `(1000, 700)`, 480 × 260, below the Quiet Room, its Door in the right
  wall at 210 (low, so the way in passes under the basins) with the sign towards the wall's start; cubicles `(16, 40)`
  and `(112, 40)`, hand dryer `(220, 64)`, basins `(264, 44)` and `(344, 44)`, a plant `(420, 40)`. The open floor's
  plant moves to `(900, 860)`, out of its way.

## Constants and configuration

`COUNTER_WORKTOP_Y = 14` (the worktop's top edge in a unit's grid); `RESTROOM_LAYOUT` above.

## Defaults ledger

- Perks holds all thirteen pieces in three named groups, rather than a new Kitchen or Restroom category (a category
  per room would double the Space bar).
- The preset reports `Room` in telemetry, as a Card preset reports `Card`.
