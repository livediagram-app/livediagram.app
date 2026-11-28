# Office blueprint

Derived from [Office](../office.md).

## Files

| File                                                      | Role                                                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/document/src/office.ts`                         | Kinds, drinks, tones, the drawings (`OFFICE_ART`), footprints, the room's and stage's parts                |
| `packages/document/src/seating.ts`                        | The meeting table as seating: `FURNITURE_ART['meeting-table']`, seats with a facing each                   |
| `packages/document/src/shape-factory.ts`                  | Default sizes and fields (`roomDoor`, label, padding, aspect lock)                                         |
| `packages/document/src/validate-shape.ts`                 | `roomDoor` validation                                                                                      |
| `packages/document/src/colors.ts`                         | Skins (floor and rug fills), the room's `md` padding                                                       |
| `packages/document/src/svg-render-office-art.ts`          | Export: `furnitureArt` for the pieces, `roomSvg` for a room                                                |
| `packages/api-schema/src/room-messages.ts`                | `AvatarPresence.holding`                                                                                   |
| `apps/editor/components/canvas/collab/FurnitureView.tsx`  | Canvas drawing of every piece but the room; `MachineAnswer`                                                |
| `apps/editor/components/canvas/collab/RoomView.tsx`       | Canvas drawing of a room at its own size; `SizedPieceView`, shared with the stage                          |
| `apps/editor/components/canvas/collab/StageView.tsx`      | Canvas drawing of a stage at its own size                                                                  |
| `packages/avatar/src/collision.ts`                        | `fenceSegments`: fences, room walls and footprints                                                         |
| `packages/avatar/src/walk.ts`                             | `elementUnderFeet` skips floor and scenery                                                                 |
| `packages/avatar/src/hooks/useAvatarWalk.ts`              | `giveDrink`, the held drink, `onWalkIntoDrink`, presence `holding`                                         |
| `packages/avatar/src/components/avatar-sprite.tsx`        | `HeldCup`                                                                                                  |
| `apps/editor/components/canvas/useCanvasAvatar.tsx`       | Drink on arrival, the machine's answer, a table seat's facing                                              |
| `apps/editor/app/document/[id]/useElementHelpers.ts`      | A room, rug or stage goes in at the back; a drop selects every piece it placed                             |
| `apps/editor/lib/placed-selection.ts`                     | `placedSelection`: one piece alone, several as one multi-selection (also `useShapeDrawing`'s armed tap)    |
| `apps/editor/components/palette/CollabMenuSections.tsx`   | `RoomMenuSection`                                                                                          |
| `apps/editor/components/palette/RoomNameField.tsx`        | `RoomNameField`, `RoomNameMenuSection`, `ROOM_NAME_MAX`: the Room name field                               |
| `apps/editor/components/palette/RoomLookTiles.tsx`        | `RoomWallsTiles`, `RoomFloorTiles`, `WallsPicture`, `FloorPicture`: the large Walls and Floor tiles        |
| `apps/editor/components/palette/StageMenuSection.tsx`     | `StageMenuSection`: Who Can Speak, Show Cameras                                                            |
| `apps/editor/hooks/canvas/useDataShapeSetters.ts`         | `setRoomDoorSelected`, `setStageSelected`                                                                  |
| `apps/editor/components/palette/palette-tile-defs.tsx`    | The office tiles                                                                                           |
| `packages/document/src/office-garden.ts`                  | The pod, bar and garden drawings (`OFFICE_EXTRA_ART`), `gardenPathParts`, `grassParts`, `gardenFenceParts` |
| `packages/avatar/src/pod.ts`                              | `POD_SEATS`, `podWalls`, `podInterior`, `podClosed`, `closePods`                                           |
| `apps/editor/components/canvas/collab/GardenViews.tsx`    | Canvas drawing of a garden path, grass and a garden fence at their own size                                |
| `packages/document/src/call-geometry.ts`                  | `roomZones` takes a pod's interior as a call                                                               |
| `packages/document/src/tree-species.ts`                   | Tree species: `TREE_SPECIES_ART` (each species' drawing) and `treeArt(variant)`, the art a tree draws      |
| `packages/document/src/piece-variants.ts`                 | `TREE_VARIANTS` (`oak` first) in the stored variants, so a tree keeps its species and retypes in place     |
| `apps/editor/components/palette/palette-tree-presets.tsx` | `TREE_PRESET_TILES`: the Tree tile's species tiles and their glyphs (the tile's `variants`)                |
| `apps/editor/lib/real-3d/models/trees.ts`                 | Each species' 3D model, picked by the model context's `variant`                                            |

## Domain and naming

| Term         | Identifier                              | Meaning                                                                          |
| ------------ | --------------------------------------- | -------------------------------------------------------------------------------- |
| Office piece | `OfficeKind`, `OFFICE_KINDS`            | The eight kinds                                                                  |
| Floor piece  | `isFloorShape`                          | Room, rug, stage (and the Avatar Pad): at the back, never block, never rung      |
| Stage        | `stageParts`, `stageTop`, `STAGE_FRONT` | Its drawing, the top feet stand on, the front face's height                      |
| Doorway      | `RoomDoor` (`ShapeElement.roomDoor`)    | `'n' \| 'e' \| 's' \| 'w' \| 'none'`; absent = `'s'`                             |
| Wall         | `roomWalls(el)` → `WallSegment[]`       | Blocking lines, broken at the doorway                                            |
| Footprint    | `officeFootprint(el)`                   | The blocking box of a plant or bookshelf                                         |
| Drink        | `DrinkKind`, `drinkFrom(kind)`          | `'water'` (cooler), `'coffee'` (machine), `'juice'` (cabinet), `'soda'` (fridge) |
| Fixed seat   | `FixedSeatKind`, `seatsACharacter`      | A pod or a bar stool: seats that never turn, each with its sitter's facing       |
| Scenery      | `isSceneryShape`                        | Blocks with a footprint, never rung: plant, bookshelf, bar, outdoor plant, tree  |
| Pod door     | `podClosed(el, peersSeatedOn)`          | Both seats held: closed; the walk reads `podClosed` on the element               |
| Held drink   | `AvatarPresence.holding`                | The drink in a character's hand, or none                                         |
| Table seat   | `TableSeat`                             | `{ u, v, facing }`: a seat and its sitter's facing                               |

## Behaviour and state

- **Placing**: `placeBoxed` prepends a floor piece (`[el, ...before]`), appends anything else. A garden path and grass
  are floor pieces (`isFloorShape`).
- **The pod's door**: `useCanvasAvatar` hands the walk `closePods(elements, peers)`, which marks a pod
  `podClosed: true` while two peers sit in it (our own seat never counts for our own walls: sitting, we are not
  walking, and standing up opens it). `fenceSegments` adds `podWalls(el)`: its four walls, the front one broken at the
  doorway, unbroken while closed. `FurnitureView` draws the door slid shut while the pod's sitters (ours included)
  number two, with a CSS `transform` transition of `POD_DOOR_MS`, none under reduced motion.
- **A garden fence** blocks on `fenceLine` as a fence does; it is drawn by `gardenFenceParts`.
- **Blocking**: `fenceSegments(elements)` emits, in paint order, a fence's line, a room's `roomWalls`, and a
  footprint's four `boxEdges`. `fenceStep` blocks them all with `FENCE_REACH`.
- **Room walls**: back at `y + ROOM_BACK_FACE - ROOM_WALL / 2`, front at `y + h - ROOM_WALL / 2`, sides at
  `x + ROOM_WALL / 2` and `x + w - ROOM_WALL / 2`; the doorway's wall split at `roomDoorSpan(length, door)`:
  centred, `min(ROOM_DOOR_WIDTH, length - 2 · ROOM_WALL - 8)` wide, none if that is ≤ 0 or `door` is `'none'`.
- **A turned room** (office.md "A Room turns", Work Tracker 1454): `roomWalls` builds the walls above (or a Room Builder
  room's `outlineWalls`), then turns every end by `el.rotation` (clockwise degrees) about the box centre with
  `rotatePoint`; an upright room (rotation absent or a multiple of 360) skips the turn and returns the same lines as
  before. Every reader of `roomWalls` (`fenceSegments`, `wallsOf` / `wholeWalls` in room-builder.ts, the 3D walls) gets
  the turned lines, so the walk, a Door's snap, `doorsFollowRooms` on a turn and the 3D view agree. `roomZones`
  (`packages/document/src/call-geometry.ts`) gives a turned room a `polygon` (its interior's four corners, or its
  outline, turned the same way) and the polygon's bounds. `onFloorOf` (a Window's facing) turns the probe back into the
  room's frame. A turned room is left out of `snapRoomWalls` / `snapRoomWallsResize` (both as a target and as the moved
  room, `isBoxRoomId`) and of the duplicate's shared-wall step (`isBoxRoom` in duplicate-placement.ts).
- **Rooms line up** (office.md "Rooms line up"): `snapRoomWalls` / `snapRoomWallsResize`
  (`packages/document/src/room-snap.ts`) take, per axis, the nearest delta within `ROOM_WALL_SNAP_THRESHOLD` (80 canvas
  px) that puts a wall of the candidate on a `sharesWallsByBox` neighbour's wall line (left on its right wall
  `x + width - ROOM_WALL`, right on its left wall `x + ROOM_WALL`, top on its front wall `y + height - ROOM_BACK_FACE`,
  bottom on its back wall `y + ROOM_BACK_FACE`), an x target only when the y spans overlap and a y target only when the
  x spans overlap. Every caller lets a wall snap win its axis outright over `snapToAlignment` (threshold
  `ALIGN_SNAP_THRESHOLD`, 6): `resolveBoxedMove` and `resolveBoxedResize` (apps/editor/hooks/canvas/boxed-drag-resolve.ts,
  both skipped under `noSnap`), and `paletteDragSnapAt` with `room` (apps/editor/lib/palette-drag-snap.ts), which serves
  the palette drag (`usePaletteDragGuides`: `room` only for a preset whose box carries its walls,
  `roomVariantSharesWalls`; no snap while Cmd / Ctrl is held on the dragover, so the drop lands at the pointer) and
  `armedRoomSnap(at, elements, variant)`, which builds the preset's own box (`applyShapeVariant`) and is shared by the
  armed preview (`PlacementPreview`'s `landingOf`, skipped when the pointer event has Cmd / Ctrl) and the click's
  commit (`useShapeDrawing.commitDraw`, skipped when its `free` argument is set). `useCanvasDrawGesture` leaves an
  armed Room's press unsnapped (no `snapDrawStart`, no hover dot) and passes `free` (Cmd / Ctrl on the pointerup) to
  `onCommitDraw`.
- **Destinations**: `elementUnderFeet` skips `isFloorShape`, `plant` and `bookshelf`. A meeting table and the
  machines remain destinations.
- **Sitting at the table**: `seatPoints` (`@livehuddle/avatar/seats`) returns the six `MEETING_TABLE_SEATS` with
  their `facing` turned to the table's (`SEAT_VIEWS['meeting-table']`, [Turning furniture](furniture-facing.md));
  `Canvas.onWalkIntoChair` sits with `seatFor`, which takes `seat.facing`.
- **Drinks**: `arriveOn` calls `onWalkIntoDrink(el)` when `drinkFrom(el.shape)`. `Canvas` then calls
  `avatar.giveDrink(kind)`, calls `answerMachine` (`lib/machine-answer.ts`) for that element, and tracks the use. `giveDrink` sets
  `holdingRef`, sets `drink = { kind, seq + 1 }` and publishes an idle snapshot; an effect keyed on `drink` puts
  it down after `DRINK_HOLD_MS` (publishing again). Leaving the mode clears it.
- **The answer**: `MachineAnswer` animates three bubbles or drips with the Web Animations API on each bump, two
  iterations of `MACHINE_ANSWER_MS / 2`, skipped under reduced motion.
- **The cup**: `HeldCup` draws when `holding` and no reaction or wave is playing: at the right hand (front/back),
  the visible hand (profile), 70% opacity from behind; CSS `animate-avatar-sip` lifts it, `animate-avatar-steam`
  steams a coffee.

## Interfaces and contracts

```ts
export type OfficeKind = 'room' | 'meeting-table' | 'plant' | 'bookshelf' | 'water-cooler' | 'coffee-machine' | 'rug' | 'stage';
export type RoomDoor = 'n' | 'e' | 's' | 'w' | 'none';
export type DrinkKind = 'water' | 'coffee';
export function roomDoorSpan(length: number, door: RoomDoor): [number, number] | null;
export function roomParts(width: number, height: number, door: RoomDoor): FurniturePart[];
export type StageSpeakers = 'edit' | 'take-part';
export function stageParts(width: number, height: number): FurniturePart[];
export function stageTop(el: Box): Box;
export function roomWalls(el: Box & { roomDoor?: RoomDoor }): WallSegment[];
export function officeFootprint(el: Box & { shape: string }): Box | null;
// Every box that blocks (a car park's cars and kerb, venue-pieces.md); [] for a piece that does not block.
export function officeFootprints(el: Box & { shape: string }): Box[];
// AvatarPresence
holding?: 'water' | 'coffee' | null;
```

| Input                     | Handling                                     |
| ------------------------- | -------------------------------------------- |
| `roomDoor` absent         | `'s'`                                        |
| `roomDoor` off-vocabulary | `isValidElement` false (`validate-shape.ts`) |
| `stageSpeakers` absent    | `'edit'`                                     |
| `stageSpeakers` other     | `isValidElement` false                       |
| `stageCameras` not a bool | `isValidElement` false                       |
| `holding` anything else   | The receiver draws an empty hand             |

## Data and persistence

`roomDoor`, `stageSpeakers` and `stageCameras` are the stored fields (synced, exported, undoable). A held drink, the machine's answer, and seating
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
sits in the wall's face. Stage: drawn to its size like a room, top in its fill (`STAGE_FLOOR` unstyled) with two
plank rails, front face `STAGE_FRONT` tall shaded with the stroke, a plate centred on the face; label `sm`, centred at
the bottom so it sits on the plate. Menu: **Room** section, five tiles (Top, Right, Bottom, Left, None), hint text as shipped;
**Stage** section, two tiles (`STAGE_SPEAKER_LABELS`: Editors, Editors and Participants), a hint, and a Show Cameras
switch ([Meeting rooms and the stage blueprint](../../012-collaboration/blueprints/meeting-rooms-and-stage.md)).

Room settings (the dialog from the menu's **Room** row, and the Quick Style panel for one room):

- **Name** section first (`RoomNameMenuSection`, glyph `TextGlyph`), holding `RoomNameField`: the shared `TextInput`
  (`@liveworkspace/ui`, `compact`), visible label **Room name**, placeholder `Room`, `maxLength` `ROOM_NAME_MAX`. Its
  draft follows the stored label (`useFollowingDraft` keyed on id and label). Commit on blur and on Enter: when
  `draft.trim()` differs from the stored label, `onRename(room.id, draft)`, wired to the editor's `commitLabel` (one
  undoable step, the in-place rename's path). Escape puts the draft back to the stored label. Every key stops at the
  field, so the menu's and the canvas's keys never fire while typing.
- **Gate**: the host passes `onRenameRoom` only when `can.writeText(room)`; without it neither surface renders the
  field (`roomNameEditable(can, room)`).
- **Walls** and **Floor** tiles (`RoomLookTiles`): a button per choice, `aria-pressed` for the chosen one, a framed
  picture (`aspect-[4/3]`, `rounded-md`, a slate ring, the chosen one a 2 px brand ring) over its name (11 px,
  medium). Walls: a `grid-cols-3` row, so every tile is one size. Floor: `PagedCarousel` (`perPage` 3, `grid-cols-3`, `label` "Floor types",
  opening on the room's type). The floor picture is `FloorPicture`: the pattern of `FLOOR_TILES`
  over the room's fill (Floorboards drawn as offset planks), shown at the scale `FLOOR_SWATCH_LG_SCALE` gives each
  type so two or more repeats are visible. Floor colours stay small `MenuTile`s.

## Accessibility

`FurnitureView` and `RoomView` SVGs are `role="img"` with the piece's name ("Water cooler", "Room, Kitchen"); a
meeting table names its sitters and rings the chair each holds. Reduced motion stops the answer, the sip and the steam.

## Observability

Element add / change telemetry as every element; `Canvas · Used · WaterCooler | CoffeeMachine` per drink.

## Testing

| Rule                                                              | Test                                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Kinds, sizes, room defaults, doorway values                       | `packages/document/src/office.test.ts`                                |
| Walls, doorway span, room drawing                                 | same                                                                  |
| Footprints, table seats and facings                               | same                                                                  |
| Walls and footprints block; doorway passes                        | `apps/editor/lib/avatar-fence.test.ts`                                |
| A turned room's walls block where drawn; a Door in one passes     | `packages/avatar/src/collision.turned-room.test.ts`                   |
| A turned room's Doors turn with it; its call is its turned floor  | `packages/document/src/room-builder.test.ts`, `call-geometry.test.ts` |
| Floor and scenery never rung                                      | `apps/editor/lib/avatar-walk.test.ts`                                 |
| Drink held, refreshed, put down; on arrival                       | `apps/editor/hooks/canvas/useAvatarWalk.test.tsx`                     |
| Views draw; plant stays green; table pill                         | `apps/editor/components/canvas/collab/office-views.test.tsx`          |
| Room name: shown, commits on blur and Enter, Escape, Editors only | `apps/editor/components/palette/RoomNameField.test.tsx`               |
| Large Walls and Floor tiles set the room; carousel pages floors   | `RoomFloorMenuSection.test.tsx`, `SpaceQuickStylePanel.test.tsx`      |

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
| `POD_DOOR_MS`             | 600                                                     | Spec                                      |
| `GARDEN_PATH_FILL`        | `#e7dcc4`                                               | A warm sand on either paper               |
| `ROOM_NAME_MAX`           | 80 characters                                           | A plate's line; far past any real name    |

Custom-shaped rooms and doors: [Room Builder blueprint](room-builder.md).
