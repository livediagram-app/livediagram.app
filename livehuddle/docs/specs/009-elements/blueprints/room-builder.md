# Room Builder blueprint

Derived from [Room Builder and Door](../room-builder.md).

## Files

| File                                                       | Role                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `../packages/avatar/src/room-outline.ts`                   | Pure geometry: `snap45`, `outlineWalls` (a custom room's walls), `doorLine`, `cutByDoors`, `nearestWall`, `pointInPolygon` |
| `../packages/avatar/src/office-geometry.ts`                | `roomWalls` reads `roomOutline` when a room has one                                                                        |
| `../packages/avatar/src/collision.ts`                      | `fenceSegments` cuts room walls at every door on them                                                                      |
| `packages/document/src/room-builder.ts`                    | `createOutlinedRoom` (the tool's commit), `roomOutlinePoints`, `snapDoorToWall`, `snapMovedDoors`, `withAttachedDoors`     |
| `packages/document/src/validate-shape.ts`                  | `roomOutline` validation                                                                                                   |
| `packages/document/src/call-geometry.ts`                   | A custom room's zone is its outline (`CallZone.polygon`)                                                                   |
| `packages/document/src/svg-render-faces.ts`                | Export: a custom room's floor and walls, a door                                                                            |
| `apps/editor/lib/draw-mode.ts`                             | `PendingDraw` `{ type: 'room-walls' }` and its banner                                                                      |
| `apps/editor/components/canvas/useCanvasPolygonGesture.ts` | The click-to-place gesture, shared with the polygon; the 45-degree snap and closed-only finish in room mode                |
| `apps/editor/components/canvas/CanvasDrawPreview.tsx`      | The walls' preview at wall thickness                                                                                       |
| `apps/editor/hooks/canvas/useShapeDrawing.ts`              | `beginRoomWalls`, `commitRoomWalls`                                                                                        |
| `apps/editor/components/canvas/collab/RoomView.tsx`        | `OutlinedRoomView`, `DoorView`                                                                                             |
| `apps/editor/hooks/canvas/useBoxedDragHandlers.ts`         | Doors on a moved room's walls ride its drag                                                                                |
| `apps/editor/hooks/canvas/useEditorDrag.ts`                | A moved door snaps onto the nearest wall each frame                                                                        |
| `apps/editor/app/document/[id]/useElementCreation.ts`      | A dropped door snaps onto the nearest wall                                                                                 |

## Notes

- `roomOutline` corners are the walls' centre line as 0..1 fractions of the element box, which is the outline's
  bounds grown by `ROOM_WALL / 2`; a custom room is created `aspectLocked` so 45-degree walls stay 45 degrees.
- A door is "on" a wall when its centre is within 2 px of the wall's centre line and its rotation is parallel to it
  (mod 180, within 1 degree); only then does it cut the wall or ride the room.

## Door types, room and rug presets, the Corridor

Derived from [Door types](../room-builder.md#door-types), [Room presets](../office.md#room-presets),
[Rug types](../office.md#rug-types) and [Corridor](../corridor.md) (Work Tracker #543, #598, #599).

| File                                                              | Role                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `../packages/avatar/src/corridor.ts`                              | `corridorWalls(el)`: a corridor's walls in canvas px, turned by its rotation; `corridorShape`, `CORRIDOR_ARM`                        |
| `../packages/avatar/src/collision.ts`                             | `fenceSegments` adds a corridor's walls, cut by the doors on them                                                                    |
| `packages/document/src/piece-variants.ts`                         | `DOOR_VARIANTS`, `RUG_VARIANTS`, `CORRIDOR_VARIANTS`, `pieceVariant(el)` (the stored type, or the first), the sizes, `corridorPaths` |
| `packages/document/src/shape-variants.ts`                         | `applyShapeVariant` stores a door's, rug's or corridor's `variant` and its size; a room preset's size, name, outline                 |
| `packages/document/src/room-preset-shapes.ts`                     | `ROOM_PRESETS`, `roomAsPreset`, the point a shaped preset's Door snaps to (`roomPresetDoorAt`), `outlineNameAlign`                   |
| `packages/document/src/room-presets.ts`                           | `ROOM_PRESET_LAYOUTS`: each furnished preset's pieces; `roomPresetCompanions` places them, spread with the room                      |
| `packages/document/src/door-art.ts`                               | `doorArt(width, height, variant)`: each type's parts with their open and shut poses, for the canvas and the export                   |
| `packages/document/src/svg-render-doors.ts`                       | The export's `doorSvg` (over `doorArt`, padlock and shading) and `corridorSvg` (over `corridorPaths`)                                |
| `packages/document/src/rug-art.ts`                                | `rugParts(width, height, variant)`: each patterned rug drawn to its size, in `tint`, `sheen` and `dye` parts                         |
| `../packages/avatar/src/furniture-art.ts`                         | The `tint`, `sheen` and `dye` part roles and their opacities (`FURNITURE_WEAVE`), re-exported by `seating.ts`                        |
| `packages/document/src/room-builder.ts`                           | `wallsOf` and `doorOnRoom` read a corridor's walls, so doors snap onto it, ride it and follow its resize                             |
| `packages/document/src/validate-shape.ts`, `element-fields.ts`    | `variant` validated (`isPieceVariant`) and listed                                                                                    |
| `apps/editor/components/canvas/collab/RoomBuilderViews.tsx`       | `DoorView` draws `doorArt` with the padlock when locked; `CorridorView`                                                              |
| `apps/editor/components/canvas/PieceArt.tsx`, `FurnitureView.tsx` | A patterned rug draws `rugParts` at its own size; the weave roles paint unstroked                                                    |
| `apps/editor/components/palette/palette-floor-presets.tsx`        | The Room, Corridor, Door and Rug preset tiles and their glyphs                                                                       |
| `apps/editor/components/canvas/collab/PlacementPreview.tsx`       | The preview draws the armed or dragged preset (its `variant`)                                                                        |

Notes:

- `variant` is written only by `applyShapeVariant` for the kinds `storesVariant` names (door, rug, corridor), and
  only a value the kind takes; a room preset's variant is never stored (the preset is its size, name and outline).
- A door's parts carry `open` and `shut` poses (`rotate` about an origin, or a `dx` slide); the canvas sets the pose
  as a CSS transform under the 180 ms door transition (`.lh-door-leaf`, `.lh-door-swing`), the export bakes the current
  one in. Paints are data too: a revolving drum's floor is `pane` (the glass wash, unoutlined).
- A locked door's padlock parts carry `lock` and come last; both renderers draw them in a group turned back by the
  door's rotation about `doorLockCentre`, so it stands upright. `BoxedElementView` skips the canvas lock badge on a Door.
- `CategoryFlyoutSide` lifts the side panel against `[data-canvas-root]`'s bottom (`sideFloor`), at its settled height
  (the opening animation's scale divided out, `animationScale`), re-measured on `animationend`, resize and a
  ResizeObserver.
- The Long Table (office.md "Long Table") is the Meeting Table's `long` variant: `@liveworkspace/avatar/seats`
  `longTableLength(width, height, facing)` gives its length (across the box, or down it on its side) and
  `longTableSeatViews(length)` its seats in each drawing (`seatPoints` reads `variant`); `@liveworkspace/avatar/
furniture-art` `longTableArt(width, height, facing)` (re-exported by `office.ts`) draws its front, back and side on
  those grids, both cached by length, for `FurnitureView`, the export's `furnitureArt` and `turnPiece`.
- A corridor's arm is `min(CORRIDOR_ARM, the box's shorter side)`; its walls are polylines along each arm's sides at
  `ROOM_WALL / 2` in, stopping at the open ends; the drawing's walls are the same lines, stroked as a room's.
- The palette drag hands the preview its `variant` (`PaletteDragPreview.variant`), so a dragged preset previews at
  its own size and shape.

## Windows and glass walls

Derived from [Window](../room-builder.md#window), [Glass walls](../office.md#glass-walls) and the glass room bullet of
[Meeting rooms and the stage](../../012-collaboration/meeting-rooms-and-stage.md) (Work Tracker #538, #539).

| File                                                             | Role                                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/document/src/room-builder.ts`                          | `isWallPiece` (a Door or a Window); `snapDoorToWall` snaps either, turning a Window to face in (`facesInside`); `onRoomWall` for riding |
| `packages/document/src/window-art.ts`                            | `windowArt(width, height)`: frame, pane, mullion, sill and the light patch (`WINDOW_LIGHT`), for the canvas and the export              |
| `packages/document/src/glass-walls.ts`                           | `GLASS_ROOM_VARIANT`, `isGlassRoom`, `glassRoomArt(el)`: a glass room's floor, wall band, pane line, mullions, back face and glints     |
| `packages/document/src/piece-variants.ts`                        | `room: ['solid', 'glass']` in the stored variants, so `pieceVariant` reads a room's wall style                                          |
| `packages/document/src/room-preset-shapes.ts`, `room-presets.ts` | The Meeting Booth preset (`variant: 'glass'` on the room) and its table and plant                                                       |
| `packages/document/src/svg-render-doors.ts`                      | The export's `windowSvg` and `glassRoomSvg`                                                                                             |
| `apps/editor/components/canvas/collab/WindowView.tsx`            | `WindowView` (light patch by `useCanvasSurface`), `GlassRoomView`                                                                       |
| `apps/editor/components/palette/CollabMenuSections.tsx`          | `RoomWallsMenuSection`: Solid and Glass tiles, every room; `setRoomWallsSelected` in `useDataShapeSetters`                              |
| `apps/editor/components/canvas/collab/PlacementPreview.tsx`      | A Window previews snapped onto its wall as a Door does                                                                                  |

Notes:

- A Window is a placed office piece drawn to its size (`SIZED_OFFICE_KINDS`), no footprint and no door line: the
  collision (`fenceSegments`) and the path finder never see it, so its wall stays whole. `doorOnRoom` stays Doors only
  (a Walk There heads for a Door, never a Window); `withAttachedDoors`, `doorsFollowRooms` and `snapMovedDoors` take
  every wall piece.
- Facing in: after snapping to the wall's angle `a`, the point half a wall plus 4 px along the window's local +y
  (`(-sin a, cos a)`) is tested against the walled piece's floor (a rectangle's `roomInterior`, a custom room's outline,
  a corridor's floor turned by its rotation); outside, the window turns to `a + 180`. Either way it is parallel to the
  wall, so it still stands on it for riding.
- A glass room is any `room` with `variant: 'glass'`: `roomWalls`, `roomZones`, `roomInterior` and the api's hearing
  check read the shape, never the variant, so walking, pathing and calls are a room's. `applyShapeVariant` stores
  `glass` (it is a room variant `storesVariant` names); a room preset carrying `variant` stores it too.
