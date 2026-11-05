# Room Builder and Door

Draw a room of any shape, wall by wall, and put doors in any of its walls. The [Office](office.md) Room is a
rectangle with one centred doorway; an office plan needs an L-shaped open plan, a corner kitchen cut at 45 degrees,
a reception with a slanted front. The **Room Builder** draws those rooms the way the Polygon tool draws a polygon,
and a **Door** turns any stretch of wall into a way through.

## Why

A virtual office is only as believable as its floor plan, and real floor plans are rarely four rectangles. Building
rooms from walls lets a team lay out the space they actually have (or the one they wish they had) in a minute,
and doors that go anywhere on any wall decide how people walk between rooms rather than the room deciding for them.

## Where they live

Both in the palette's **Rooms** group, beside the Room, the Rug and the Fence: the **Room Builder** tool tile and
the **Door** tile. Editors only (see [Share roles](#share-roles)).

## The Room Builder tool

A click-to-place tool, armed from its tile like any drawing tool (`PendingDraw` `{ type: 'room-walls' }`).

- **Click** places a corner. After the first, the walls placed so far and a rubber-band wall from the last corner
  to the pointer are previewed at the room's real wall thickness.
- **Every wall snaps to 45 degrees.** A corner is placed along the nearest of the eight directions (0, 45, 90, ...
  315 degrees) from the previous corner, at the pointer's distance along it. Holding **Cmd / Ctrl** places the
  corner freely, the same override every snap on the canvas uses ([Snap override](../008-canvas/snap-override.md)).
- **Closing the room**: a click on the first corner (within 12 screen px, a ring shows on it when in range),
  a double-click, or **Enter** closes the room with a wall from the last corner back to the first. That closing wall
  is the one wall that need not be at 45 degrees (it joins two corners already placed); place the last corner so it
  lines up when you want it square.
- **Backspace** removes the last corner. **Escape** clears the corners placed (staying armed); a second Escape
  disarms the tool.
- A room needs **three corners**; finishing with fewer is a cancel, never a degenerate room.
- **On touch**, a tap places a corner and a tap on the first corner closes the room, as the Polygon tool's taps do.
- Banner: "Click to place corners, click the start to close" ("Tap to place corners" on a phone).

The tool commits one Room element, selects it and goes back to the tool it came from, one history entry.

## The custom room

A room drawn with the tool **is a Room** (`shape: 'room'`), with one extra field:

```ts
roomOutline?: { x: number; y: number }[]; // the walls' centre line, corners as fractions (0..1) of the box
```

- The element's box is the outline's bounds grown by half a wall on every side, so the walls sit inside it as they
  do on a rectangular room. The corners are stored as fractions of that box, so moving the room moves its walls.
- **Aspect locked**: a custom room resizes in proportion, which keeps every 45-degree wall at 45 degrees.
- **Drawn like the Room**: the floor (the outline's polygon) in the element's fill, the walls a fixed 10 canvas px
  thick along the outline with the room's stroke as their outline, mitred at the corners. A custom room has no back
  wall face (it has no "back"); its name is the element's label, at the top left like a Room's.
- **No built-in doorway**: `roomDoor` does not apply and the element menu's doorway tiles are not shown for it.
  Doors are [Door](#door) pieces.
- **Walls block walking** exactly as a Room's do ([Fence](fence.md#blocking) rules: same reach, the character slides
  along a wall, a 45-degree one included), broken only where a Door stands.
- **A call of its own** like a Room ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md)):
  a character is in it when its feet are strictly inside the outline.
- Old documents have no `roomOutline` and draw, walk and call exactly as before. An outline with fewer than three
  corners, or a corner outside 0..1, makes the element invalid.

## Door

A doorway with a door in it, placed on any wall.

- **A shape kind of its own**, `door`, 96 x 24 canvas px (the Room's doorway width), drawn as a gap in the wall
  with a jamb at each end, a door leaf standing open and its swing arc. Its rotation is the wall's angle.
- **It snaps onto walls.** Dropped from the palette, or moved, a door within 48 canvas px of a wall (a Room's or a
  custom room's, at any angle) jumps onto it: centred on the wall's centre line, turned to the wall's angle (so on a
  45-degree wall it stands at 45 degrees), and slides along the wall as you drag. Away from every wall it stands free
  and does nothing until it is put on one. Cmd / Ctrl while dragging places it freely, as every snap.
- **You see where it lands before you place it.** While the Door tile is armed (tapped, waiting for a click on the
  canvas) or dragged from the palette, a translucent door follows the pointer over the canvas, at its real size and
  zoom, already snapped: near a wall it sits on the wall at the wall's angle and slides along it as the pointer
  moves, outlined in the brand colour, exactly where a click or a drop would put it; away from every wall it shows
  dimmed with a dashed outline, standing free. It replaces the generic palette drag footprint for the Door, and it
  is only a preview (nothing is written until the click or the drop). (`PlacementPreview`, the preview every placed piece has: [Palette drag ghost](../010-palette/palette-drag-ghost.md) "Placed pieces preview themselves".)
- **It cuts the wall.** A character walks through a door on a wall: the wall's collision is broken across the
  door's width (the door's ends keep the wall's reach, as a Room's doorway does). A door that is not on a wall
  blocks nothing.
- **It rides its room.** Moving a room carries the doors standing on its walls with it.
- Any number of doors per room, on any wall. A Room's own doorway (`roomDoor`) keeps working; a Door on a
  rectangular Room's wall is a second way in.
- Not a destination: standing in a doorway never rings it.

## Share roles

- **Editor**: arms the Room Builder, draws rooms, places, moves and deletes doors.
- **Participant**: the participant palette does not offer either; walks through doors like everyone.
- **Viewer**: walks through doors like everyone (walking is presence).

## Telemetry

- A room drawn with the tool: `Element · Added · CustomRoom`. A door placed: `Element · Added · Door`.

## Not in scope

- Doors that open and close, or lock (the door is always open).
- Editing a custom room's corners after it is drawn (redraw it; corner editing is a follow-up).
- Walls that are not part of a closed room (the Fence draws those).
