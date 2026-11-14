# Duplicate placement

Derived from [Canvas and palette](../canvas-and-palette.md) "Duplicate" and [Room Builder](../../009-elements/room-builder.md)
"Door" ("A duplicate slides along the wall"). Work Tracker 636.

## Domain and naming

- **Original**: the selected element (or the multi-selection) being duplicated; its id is in `sourceIds`.
- **Copy**: the duplicate, the original's fields under a fresh id (`freshCopyFields`), before it is placed.
- **Spot**: a candidate position for the copy, a move `{ dx, dy }` from the original's box.
- **Free**: a spot where the copy's box intersects (`rectsIntersect`, exclusive) no obstacle.
- **Obstacle**: every boxed element on the tab except the containers.
- **Container**: an element that is not an original and whose box holds the original's box wholly (its Room, a zone,
  grass, a floor). The innermost container (the smallest box) gives the **floor**: a rectangular Room's floor inside
  its walls (`ROOM_WALL` each side and front, `ROOM_BACK_FACE` at the back), anything else its box.
- **Wall piece**: a Door or a Window (`isWallPiece`).

## Behaviour and state

`apps/editor/lib/duplicate-placement.ts`, pure, called by `useElementDuplication`:

1. `placeDuplicate(source, copy, elements)` for a single selection:
   - A source that is not boxed (a retired arrow) returns the copy unchanged; the hook never copies one anyway.
   - A wall piece goes to step 3.
   - Anything else takes `duplicateOffset(sourceBox, elements, {source.id}, isBoxRoom(source))`.
2. `duplicateOffset(box, elements, sourceIds, room)`:
   - Sorts the elements into obstacles and containers in one pass, keeping the innermost container's floor.
   - Builds `DUPLICATE_SPOT_STEPS` rings of four spots in the order right, below, left, above: ring k moves
     `k * (box.width + gapX)` across or `k * (box.height + gapY)` down. `gapX = gapY = DUPLICATE_GAP`; for a Room,
     `gapX = -ROOM_WALL` and `gapY = -ROOM_BACK_FACE`, so the copy's wall stands on the original's (the shared-wall
     targets of `snapRoomWalls`).
   - A Room's spot is tested with its box inset by `ROOM_WALL` across and `ROOM_BACK_FACE` down, so a wall shared
     with the original or a neighbour does not count as covering it.
   - Picks the first free spot on the floor; else the first free spot; else the first spot (right, ring 1).
3. A wall piece: when it stands on a wall (`wallUnder`), tries `DUPLICATE_SPOT_STEPS` steps of
   `source.width + DUPLICATE_GAP` along the wall's direction, the + side then the - side each step, snapping each with
   `snapDoorToWall`; takes the first that is on a wall and whose centre stands farther than half the two widths from
   every other wall piece (the original included). Otherwise (standing free, or no clear stretch) it is placed by
   `duplicateOffset` as a box and snapped with `snapDoorToWall`, which leaves it free when no wall is within
   `DOOR_SNAP_REACH`.
4. `groupDuplicateOffset(elements, ids)` for a multi-selection: the union of the originals' `elementBounds`, placed by
   `duplicateOffset` (never as a Room); `{ DUPLICATE_GAP, DUPLICATE_GAP }` when none of the ids is on the tab. The hook
   moves every copy by it through `duplicateElements`, then `snapMovedDoors` over the copies: a wall piece riding a
   copied Room is already on that Room's wall (a no-op), one whose Room stayed behind snaps onto a wall in reach.
5. The hook commits the copies (one undo step) and selects them, as before.

## Errors and edge cases

- Nothing free within the rings: the copy lands right of the original, overlapping what is there (visible, never on
  the original itself).
- A piece inside a full Room: the floor has no free spot, so the nearest free spot off it wins.
- A Door on a wall too short for a second: no stretch is clear, so it falls back to a box spot and the nearest wall.
- A rotated element is placed by its unrotated box, as every box test on the canvas is.

## Performance and limits

- One pass to sort the tab, then at most `4 * DUPLICATE_SPOT_STEPS` spots each tested against the obstacles: O(16 n).
  A wall piece adds at most `2 * DUPLICATE_SPOT_STEPS` wall snaps, each linear in the walls. It runs once per
  Duplicate press, never per frame.
- Measured: 5,000 pieces with every spot taken, under the 50 ms CPU budget (`duplicate-placement.test.ts`).

## Observability

- No new events: `trackDuplicated` fires as before with the placed copies.

## Testing

| Rule                                                                                | Test                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| A large piece's copy lands beside it, clear of it                                   | `lib/duplicate-placement.test.ts`                       |
| Right, below, left, above, then a step further out; the right anyway with none free | `lib/duplicate-placement.test.ts`                       |
| Containers never block; a Room's floor is preferred                                 | `lib/duplicate-placement.test.ts`                       |
| A Room shares the original's wall                                                   | `lib/duplicate-placement.test.ts`                       |
| A Door or a Window slides along its wall, clear of other wall pieces; a free one    | `lib/duplicate-placement.test.ts`                       |
| A multi-selection moves as one group; a Door left without its Room snaps            | `hooks/canvas/useElementDuplication.test.tsx`           |
| The copy is selected                                                                | `hooks/canvas/useElementDuplication.test.tsx`           |
| Budget on 5,000 pieces                                                              | `lib/duplicate-placement.test.ts` "duplicateOffset budget" |

## Constants and configuration

| Constant               | Value                | Provenance / safe range                                                |
| ---------------------- | -------------------- | ---------------------------------------------------------------------- |
| `DUPLICATE_GAP`        | `PASTE_OFFSET` (24)  | The gap livediagram's library inserts leave (D129); 8 to 48            |
| `DUPLICATE_SPOT_STEPS` | 4                    | Four rings of four spots (D130); 2 to 8, each ring adds four scans     |

## Defaults ledger

Rows D129 to D131 in [DEFAULTS.md](DEFAULTS.md).
