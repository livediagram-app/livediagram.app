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
tile and the **Door** tile, with the [Window](#window) tile after the Door. The Door tile opens its [door types](#door-types) as presets, the way the Card tile opens
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
- **It rides its room.** Moving a room (a drag, or an arrow-key nudge) carries the doors standing on its walls with
  it, resizing one (a drag of its handles, a typed size, Reset Aspect Ratio) and turning one (its Rotation, [Office](office.md) "A Room turns") carry them too: each door keeps its place along its wall as a fraction of the wall's length (a door in the middle of a
  wall stays in the middle), clamped clear of the wall's ends when the wall shrinks, turning with the wall. Which
  doors ride is derived at the time, not stored: a door rides the room whose wall it stands on, so doors from before
  this rule follow too. The resize and the doors it carries are one change, one undo (`doorsFollowRooms`).
- **A duplicate slides along the wall.** Duplicating a Door on a wall puts the copy on the same wall, beside the
  original with a 24 px gap (the side with room first, then a step further out), snapped as every Door is; it
  never lands on the original or another Door or Window on that wall. A wall with no clear stretch keeps the copy
  beside the original's spot, snapped onto the nearest wall ([Canvas and palette](../008-canvas/canvas-and-palette.md)
  "Duplicate"). A Window duplicates the same way.
- **A duplicated room brings its doors.** Duplicating a Room or a Corridor on its own copies the Doors and Windows
  on its walls with it, on the same walls of the copy ([Canvas and palette](../008-canvas/canvas-and-palette.md)
  "Duplicate", Work Tracker 1452), in the same Undo step.
- Any number of doors per room, on any wall. A new Room comes with one, in the middle of its front wall
  ([Office](office.md) "Room"); it is an ordinary Door, so it is selected, slid along the walls and deleted like
  any other. An older Room's own doorway (`roomDoor`) keeps working, and a Door on its wall is a second way in.
- A Walk There to a rectangular Room with no built-in doorway heads for its first Door, as a custom room's does.
- Not a destination: standing in a doorway never rings it.

### Door types

One Door tile, four types. On the Toolbar strip and in the Rooms flyout the tile is an opener (its glyph with a caret)
whose side panel lists them, one card each; each places, drags and previews exactly as the Door tile did, and every
type is the same `door` element with the same rules (it snaps onto walls, cuts its wall, rides its room and
[opens on its own](#opening-on-their-own)). Its drawing, its 3D model and its width differ.

| Type           | `variant`   | Width | Drawn in the plan                                     | In 3D ([3D view](../008-canvas/3d-view.md) "Doorways")                                                                                      |
| -------------- | ----------- | ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Door           | (none)      | 96    | One leaf on a hinge, standing open with its swing arc | A panelled wooden leaf with a brass handle (a glass leaf with a bar handle in a glass wall) that swings open on its hinge                   |
| Double Door    | `double`    | 144   | Two leaves hinged at the jambs, each with its arc     | Two wooden leaves, each glazed above a raised panel, that swing apart from the middle                                                       |
| Sliding Door   | `sliding`   | 120   | Two glass panels on a track                           | Two framed glass panels under a metal track that part from the middle and slide into the wall either side                                   |
| Revolving Door | `revolving` | 96    | A glass drum with four wings, standing at 45 degrees  | A glass drum under a metal canopy, four glass wings on a post that turn while anyone passes and come to rest squared, sealing the wall line |

- **The field** is `ShapeElement.variant?: string`, the type of a piece within its kind. It is general: a
  [Rug](office.md#rug-types) and a [Corridor](corridor.md) keep theirs in it too, and so will the windows and glass
  walls that follow. Absent is a kind's first type (the Door here); a value its kind does not take draws as the first
  type, so an unknown value never breaks a drawing. It is written when the piece is placed from its preset, and
  changed in place from the element menu's **Type** ([A piece's type](office.md#a-pieces-type)), and travels with
  copies, templates and exports like any field. Validation: lowercase letters and hyphens, 1 to 32
  characters.
- **Its height stays 24** (the wall's band); a Revolving Door's drum is drawn past its box, across the wall, as its
  swing arc is. The box is what selects it, so a click on the drum's middle selects it.
- **Export** draws each type as the canvas does, in every format: its leaf and dashed swing arc reach past its box, and the PNG (and the PDF's raster fallback) takes them in as the SVG and PDF draw them.

### Locked doors

A Door no longer locks: livehuddle has no element lock ([Element and Tab Locking](../002-project-scope/not-in-livehuddle.md#element-and-tab-locking)),
so no door draws a padlock or darker leaves. A door stored with `locked: true` loads as an ordinary door.

### Opening on their own

A Door opens itself for whoever walks through it and closes behind them; nobody opens or shuts one by hand (the
owner, 2026-11-27: "doors should automatically open and close as I go through them, not get me stuck, I also
shouldn't be able to manually open and close them anymore").

- **Always a way through.** A Door on a wall always cuts it: a character walks through any Door and is never stopped
  by one, and a walk's route goes through a doorway as through any gap ([Avatar mode](../008-canvas/avatar-mode.md)
  "Finding the way"). The door's ends keep the wall's reach, so the way through is the door's width less a
  character's reach at each end, wide enough for every Size.
- **Nothing is stored.** A door has no open or shut field. The `doorClosed` flag doors carried while they were swung
  by hand is dropped when a tab loads or arrives (`dropRetiredDoorSwing`, run with the stored-tab migration as
  `locked` is), so a door saved shut loads as an ordinary door and nobody is shut in. An op from an older client
  that still carries it loses it the same way.
- **It opens as someone comes near.** In the [3D view](../008-canvas/3d-view.md) a door stands shut and opens as
  any character (yours, a peer's, the Receptionist's) comes within `DOOR_OPEN_REACH` (80 canvas px) of its opening,
  on either side, and closes once nobody has been that near for `DOOR_CLOSE_DELAY_MS` (600 ms). It opens over 350 ms
  and closes over 500 ms, eased, so a door is open before a walking character reaches it; under reduced motion it
  jumps. Each type moves its own way (the table above). It is each viewer's own drawing, worked out every frame from
  the characters that viewer sees: nothing is written to the tab or sent, so there is no undo step and no
  telemetry.
- **The board's own drawing** (an export, a thumbnail, the palette) draws a door as an architect's plan does, its leaf standing open with its swing arc (each type
  as the table draws it), whoever is near.
- **No hand control.** A click on a door in Avatar mode walks you there like a click on any floor piece; no role
  opens or shuts a door, so the share roles have no door row.

### On a back wall

A rectangular Room (solid or glass) draws its back wall as a tall band: its top and the face standing up from the
floor, the room's name on it. A Door's own gap is only a wall's thickness, so on that wall it left most of the band
standing across the doorway, and an open door did not look open (Work Tracker 1042). There:

- **The band breaks** from its top to the floor across the door's width, as an older room's own top doorway does:
  you see through the doorway, with the leaf standing open into the room and its swing arc. A glass room's face and
  pane break the same way.
- **The room draws the doorway** (`backWallDoors` in `@livehuddle/document`, worked out once per board: which Doors
  stand on each room's back wall line, and where), so the Door draws only its open leaf and swing there, no gap or
  jambs of its own. The side and front walls, and a Room Builder room's walls (all one
  thickness), are unchanged: the Door's own gap opens them. The canvas and the image export draw it the same; the
  3D view cuts the standing wall at the doorway and stands the door's own model in it.

## Window

A window in a wall: light comes in, people do not. Work Tracker #538.

- **A shape kind of its own**, `window`, 120 x 24 canvas px, one type. It sits in the palette's **Rooms** Build group
  after the Door, a placed piece like the Door (dropped at its own size, no resize handles). Editors only.
- **It goes on a wall exactly as a Door does**, through the same wall code: dropped or moved within 48 canvas px of a
  Room's, a custom room's or a Corridor's wall it snaps onto it (centred on the wall's centre line, turned to the
  wall's angle, slid along the wall as you drag, clear of the wall's ends, in its room's floor colour); Cmd / Ctrl
  places it freely; the placement preview shows where it lands, on the wall in the brand outline or free and dashed.
  It **rides its room** (a moved room carries it, a resized one keeps it at its fraction along its wall, turning with
  the wall, one undo with the resize), derived at the time as a Door's is (`doorsFollowRooms`, `withAttachedDoors`).
- **It faces in.** On a wall, a window is turned so its light falls inside the room (or the corridor): the snap turns
  it to the wall's angle, and half a turn more when the inside lies the other way. Away from every wall it stands free,
  its light falling below it.
- **It still blocks walking.** A window never cuts its wall: the wall's collision runs straight through it, so a
  character slides along a window as along the wall, and walking, the path finder and a Walk There are unchanged. A
  window not on a wall blocks nothing (as a free Door). It is not a destination, never swings, and a click on it in
  Avatar mode walks you there like any floor piece.
- **Drawn** in the wall's band: a frame in the room's floor colour outlined in its stroke, a pane of glass (the stroke's
  glass wash) with a mullion across its middle, and a sill on the inside face. On the inside, a **patch of light** falls
  on the floor: a soft trapezoid as wide as the pane where it meets the wall, spreading a little and fading to nothing
  about as deep as the window is wide (drawn past the window's box, as a Revolving Door's drum is; the box is what
  selects it). On light paper it is warm sunlight; on dark paper a cool moonlight, fainter (DEFAULTS.md D228). The
  patch is translucent over the floor and never blocks or selects. A window paints with the floors, after its room and
  rugs but under the furniture, so its light lies on the floor beneath a sofa or desk whichever was placed first
  ([Layers](../006-document/layers.md#stacking)).
- **Calls**: a window changes nothing. A room with windows keeps its call inside exactly as before
  ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md)).
- **Export** draws the frame, pane and light patch as the canvas does, in the export's paper.
- **Share roles**: an Editor places, moves and deletes windows; a Participant and a Viewer see them and walk past them.
- Telemetry: `Element · Added · Window`.

## Share roles

- **Editor**: arms the Room Builder, draws rooms, places, moves and deletes doors and windows; opens and closes doors.
- **Participant**: has no palette, so places neither; always walking, it walks through open doors like everyone, and
  opens and closes any door.
- **Viewer**: walks through open doors like everyone (walking is presence); cannot open or close one.

## Telemetry

- A room drawn with the tool: `Element · Added · CustomRoom`. A door placed: `Element · Added · Door`, whatever its
  type (the type is not a new event).

## Not in scope

- Doors that open only for some people, or that lock ([Locked doors](#locked-doors)).
- Window types (a bay, a skylight) and windows that open; a window you can climb through.
- Changing a placed door's type from its element menu (place another type instead; a follow-up).
- Editing a custom room's corners after it is drawn (redraw it; corner editing is a follow-up).
- Walls that are not part of a closed room (the Fence draws those).
