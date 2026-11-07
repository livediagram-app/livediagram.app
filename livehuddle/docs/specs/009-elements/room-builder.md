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

Both in the palette's **Rooms** group, beside the Room, the Corridor, the Rug and the Fence: the **Room Builder** tool
tile and the **Door** tile. The Door tile opens its [door types](#door-types) as presets, the way the Card tile opens
its ([Card presets](card.md#card-presets)). Editors only (see [Share roles](#share-roles)).

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
- **It snaps onto walls.** Dropped from the palette, or moved, a door within 48 canvas px of a wall (a Room's, a
  custom room's or a [Corridor](corridor.md)'s, at any angle) jumps onto it: centred on the wall's centre line, turned to the wall's angle (so on a
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
- **It rides its room.** Moving a room carries the doors standing on its walls with it, and resizing one carries
  them too: each door keeps its place along its wall as a fraction of the wall's length (a door in the middle of a
  wall stays in the middle), clamped clear of the wall's ends when the wall shrinks, turning with the wall. Which
  doors ride is derived at the time, not stored: a door rides the room whose wall it stands on, so doors from before
  this rule follow too. The resize and the doors it carries are one change, one undo (`doorsFollowRooms`).
- Any number of doors per room, on any wall. A new Room comes with one, in the middle of its front wall
  ([Office](office.md) "Room"); it is an ordinary Door, so it is selected, slid along the walls and deleted like
  any other. An older Room's own doorway (`roomDoor`) keeps working, and a Door on its wall is a second way in.
- A Walk There to a rectangular Room with no built-in doorway heads for its first Door, as a custom room's does.
- Not a destination: standing in a doorway never rings it.

### Door types

One Door tile, four types. On the Toolbar strip and in the Rooms flyout the tile is an opener (its glyph with a caret)
whose side panel lists them, one card each; each places, drags and previews exactly as the Door tile did, and every
type is the same `door` element with the same rules (it snaps onto walls, cuts its wall, rides its room, opens and
closes, and a closed one blocks walking). Only its drawing and its width differ.

| Type           | `variant`   | Width | Drawn                                                                                 |
| -------------- | ----------- | ----- | ------------------------------------------------------------------------------------- |
| Door           | (none)      | 96    | One leaf on a hinge, standing open with its swing arc; shut, it lies across the gap    |
| Double Door    | `double`    | 144   | Two leaves hinged at the jambs, each with its arc; shut, they meet in the middle      |
| Sliding Door   | `sliding`   | 120   | Two glass panels on a track; open, they slide into the wall either side of the gap    |
| Revolving Door | `revolving` | 96    | A glass drum with four wings; open, the wings stand at 45 degrees; shut, they square up and seal the wall line |

- **The field** is `ShapeElement.variant?: string`, the type of a piece within its kind. It is general: a
  [Rug](office.md#rug-types) and a [Corridor](corridor.md) keep theirs in it too, and so will the windows and glass
  walls that follow. Absent is a kind's first type (the Door here); a value its kind does not take draws as the first
  type, so an unknown value never breaks a drawing. It is written once, when the piece is placed from its preset, and
  travels with copies, templates and exports like any field. Validation: lowercase letters and hyphens, 1 to 32
  characters.
- **Its height stays 24** (the wall's band); a Revolving Door's drum is drawn past its box, across the wall, as its
  swing arc is. The box is what selects it, so a click on the drum's middle selects it.
- **Opening and closing animate** as the leaf does: a sliding panel slides, a revolving door's wings turn, over 180 ms
  with the canvas easing, and jump there under reduced motion.
- **Export** draws each type as the canvas does, shut or open.

### Locked doors

A Door locked with the element's Lock (the element menu's Lock, `locked`) shows it: a small padlock on its jamb, in its
stroke, on every type, and its leaves or panels drawn a shade darker. Unlocked, no padlock. The rule it shows is the
one below: a Participant cannot swing a locked door, so a locked shut door is a door only an Editor opens; a locked
open one stays open.

### Opening and closing

A Door is open or closed, and anyone taking part can swing it.

- **The state** is `ShapeElement.doorClosed?: boolean` on the door: absent (or false) is open, so every door placed
  before this, and every new one, starts open and nobody is shut in. It is stored on the tab like any field, so
  everyone in the room sees the same door, live, and it travels with copies, templates and exports.
- **A closed door blocks walking** exactly like the wall it stands in: it no longer cuts its wall, so a character
  slides along it. An open door lets characters through, as before. A closed door not on a wall blocks nothing (it
  blocked nothing open either).
- **In Avatar mode, click a door you are next to** to open or close it. Next to it means your feet within
  `DOOR_REACH` (48 canvas px) of the door's opening, on either side (`isNextToDoor`). Clicking a door you are not
  next to walks you to its near side; click again there to swing it. Nothing swings on its own when you arrive.
- **It swings, drawn.** Open, the leaf stands at a right angle to the wall with its swing arc; closed, the leaf lies
  across the opening, flush with the wall, and the arc is gone. The leaf turns between the two over 180 ms with the
  canvas motion stylesheet's easing, and jumps straight there under reduced motion.
- **Undo**: a swing is one change on the swinger's history, like any edit. Telemetry: `Canvas · Used · Door`.
- **Share roles**: an Editor and a Participant open and close any door that is not locked (a Participant changes
  `doorClosed` and nothing else about a door, by the participant content rule); a Viewer walks through open doors
  but cannot swing one. A locked door stays as it is for a Participant.
- For the click policy: `toggleDoor(doorId)` (the editor's, from `useDoorToggle`) swings a door and returns whether
  it did; `isNextToDoor(feet, door)` (in `@livehuddle/document`) says whether a character can reach it.

## Share roles

- **Editor**: arms the Room Builder, draws rooms, places, moves and deletes doors; opens and closes them.
- **Participant**: has no palette, so places neither; always walking, it walks through open doors like everyone, and
  opens and closes doors that are not locked.
- **Viewer**: walks through open doors like everyone (walking is presence); cannot open or close one.

## Telemetry

- A room drawn with the tool: `Element · Added · CustomRoom`. A door placed: `Element · Added · Door`, whatever its
  type (the type is not a new event).

## Not in scope

- Doors that open only for some people (a lock is the element's Lock, an Editor's; see [Locked doors](#locked-doors)).
- Changing a placed door's type from its element menu (place another type instead; a follow-up).
- Editing a custom room's corners after it is drawn (redraw it; corner editing is a follow-up).
- Walls that are not part of a closed room (the Fence draws those).
