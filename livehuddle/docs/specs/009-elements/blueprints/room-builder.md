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
