# Corridor

A passage between rooms: a strip of floor with a wall down each long side and its ends open, so a floor plan can join
its rooms the way a real office does, and doors can go in its walls. Work Tracker #598.

## Why

Rooms laid side by side share walls, but an office is rarely only rooms: there is the hall you walk down to reach
them. Drawing one from four fences, or a long room with doors at both ends, is slow and never quite lines up. A
Corridor is that hall in one piece, straight, turning a corner or meeting another, with walls that block and ends you
walk out of.

## Where it lives

In the palette's **Rooms** category, after the Room and the Room Builder: the **Corridor** tile. Like the Room tile it
opens its types as presets ([Card presets](card.md#card-presets)); each places, drags and previews as a Room does.
Editors only (see [Share roles](#share-roles)).

## The element

A shape kind of its own, `corridor`, whose type is stored in `variant` (the field the
[Door types](room-builder.md#door-types) use; absent is the Straight, a value it does not take draws as the Straight).

| Type       | `variant` | Its arms                                                            | Size      |
| ---------- | --------- | ------------------------------------------------------------------- | --------- |
| Straight   | (none)    | One run, open at both ends                                          | 480 × 120 |
| Corner     | `corner`  | Two arms meeting in a corner, open at the top and at the right      | 360 × 360 |
| T-Junction | `tee`     | A run across the top, open at both ends, and an arm down the middle | 480 × 360 |
| Crossroads | `cross`   | Two runs crossing in the middle, open at all four ends              | 480 × 480 |

- **Its arms are 120 canvas px wide** wall to wall (`CORRIDOR_ARM`, the width two people pass in), whatever the
  box: a bigger Corner is longer arms, not wider ones. In a box narrower than that, an arm is as wide as the box allows.
  A Straight is its whole box: its walls run along the box's longer sides (top and bottom when it is wider than tall,
  left and right when taller), so dragging one tall makes it run up and down.
- **Walls** are the Room's: ROOM_WALL (10 canvas px) thick, their centre line half a wall in from the arm's edge, the
  corridor's stroke as their outline and the floor in the element's fill (a room's floor colours, warm on light paper,
  deep on dark). There is no back wall face: a corridor is seen from above.
- **Open ends**: an arm's end has no wall. A corridor ending against a room's wall where a [Door](room-builder.md#door)
  stands is how the two join; one ending in open floor simply opens onto it.
- **It turns** with the element's Rotation (the element menu's Rotation, and its handle): its walls, drawing and
  collision turn with it about its centre, at any angle, so a Corner faces any way and a Straight can run at 45
  degrees.
- **The floor**, not a destination: placed behind everything like a room and a rug (rooms, corridors and rugs paint
  as backdrops, the larger first), never rings, no label. Not aspect locked.
- **Dropped, then sized**, as a Room (`dropsAtOwnSize`): with its tile armed, the corridor follows the pointer at its
  type's size, and a click or a press drops it there; it keeps its resize handles.

## Walls block, doors cut them

- **The walls block walking** exactly as a Room's do ([Fence](fence.md#blocking) rules: the same reach and slide),
  from either side. The open ends do not.
- **Doors snap onto them.** A Door dropped or moved within 48 canvas px of a corridor's wall jumps onto it as it does
  onto a room's (centred on the wall's centre line, turned to its angle, in the corridor's floor colour), and cuts it:
  a character walks through an open Door in a corridor wall, and a closed one blocks it again. Moving or resizing a
  corridor carries the Doors standing on its walls, as a room does (`doorsFollowRooms`, `withAttachedDoors`).
- **Not a call of its own**: a corridor is open at its ends, so people in it hear the people near them as on open
  floor ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md)). Only a Room is private.

## Share roles

- **Editor**: places, moves, resizes, turns, recolours and deletes corridors, and the Doors in them.
- **Participant**: has no palette; walks the corridor like everyone, and opens and closes its unlocked Doors.
- **Viewer**: walks it like everyone; cannot swing a Door.

## Export and agents

- Export draws the floor and the walls as the canvas does, turned by the rotation.
- Agents and the CLI add one as `corridor` (optionally `variant=corner`), as any kind.

## Telemetry

- Placed: `Element · Added · Corridor`, whatever its type.

## Not in scope

- Corridors that join each other into one floor (two corridors meeting draw their own walls; place a Crossroads or
  a T-Junction for a junction).
- A corridor that is a call of its own.
- Changing a placed corridor's type from its element menu (place another type; a follow-up).
