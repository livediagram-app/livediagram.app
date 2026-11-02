# Office

Seven pieces that turn a canvas into a **virtual office** people walk around in [Avatar mode](../008-canvas/avatar-mode.md):
a **Room**, a **Meeting Table**, a **Plant**, a **Bookshelf**, a **Water Cooler**, a **Coffee Machine** and a **Rug**.
With the [Chair, Desk and Sofa](chair.md), the [Fence](fence.md) and [speech bubbles](../008-canvas/avatar-mode.md#speech-bubbles),
a team can lay out reception, desks, a meeting room, a kitchen and a lounge, then sit, talk and grab a coffee together.

## Why

Avatar mode gave people a body on the canvas, and the chair, desk, sofa and fence gave it furniture and edges. An
office needs places: rooms with doors to walk through, a table to meet round, the water cooler people drift to,
and enough plants and shelves that it feels like somewhere. Each piece is ordinary canvas content an author
places, so an office is drawn with the same tools as a diagram.

## Where they live

Shape kinds in the palette's **Collaborate** category under **Navigate**, after the chair, desk, sofa and fence:
`room`, `meeting-table`, `plant`, `bookshelf`, `water-cooler`, `coffee-machine`,
`rug`. Every one is drawn from the room's camera like the furniture ([Chair](chair.md#facing)): upright, legs and
pots on the ground, a contact shadow below. Each is an ordinary element otherwise: move, resize, group, lock, copy,
theme, export. None has a settings `…`; a room's one setting and a table's are in the element menu.

## Room

Four walls round a floor, with a doorway, and the room's name on its back wall.

- **Drawn as a room seen from the front and above**: the floor in the element's fill, the back wall along the top
  showing its face (so it reads as a wall standing up, not a line), the side walls as bars, the front wall a low
  bar you see the top of. Walls are a fixed thickness however big the room, so a big room is a big floor, not
  thick walls.
- **The doorway** is a gap in one wall, centred, 96 canvas px wide (narrower if the wall is short), which leaves a character 72 px to walk through once the wall ends keep their reach, with a mat
  across it. `ShapeElement.roomDoor`: `'n' | 'e' | 's' | 'w' | 'none'`, the wall it is in; absent means the front
  wall (`'s'`). **None** makes a closed room you reach only through a [Portal](portal-element.md). Set from the
  element menu's **Room** section: Top, Right, Bottom, Left, None.
- **The name** is the element's label, on a plate at the left of the back wall: "Kitchen", "Meeting Room 2". A new
  room is called **Room**.
- **The walls block** walking exactly as a [Fence](fence.md#blocking) does: same reach, same slide along them, from
  either side; the doorway does not. A character inside a closed room stays inside until it takes a portal.
- **It is the floor, not a destination**: standing in a room never rings it as the element you are on, and it is
  placed **behind everything** on the tab, so furniture dropped in it stands on its floor. Not aspect locked: a
  room is any shape of rectangle. Default 480 × 320.

## Meeting Table

A table with six chairs round it, every seat facing the table.

- Drawn upright from the room's camera: two chairs beyond the table (their sitters face you), two in front (their
  backs to you), one at each end in profile, and the table top between them with its front edge toward you.
- **Six seats.** A character walking into it sits on the seat **nearest where it arrived**, facing the table: the
  far chairs face down, the near chairs up, the left end right, the right end left. Two people may share a seat,
  as with any chair.
- Who is sitting is presence, as for every seat: the table shows the sitters' names in a pill above it. It does not
  ring one chair, because which seat a peer took is not in their presence.
- It does not turn (it reads the same from every side). Aspect locked. Default 232 × 168.

## Plant, Bookshelf

Scenery that **blocks**: a character walks round them, not through.

- **Plant**: a potted plant, leaves above a pot. Default 56 × 88. Its **footprint** (the pot, at the bottom of the
  drawing) blocks.
- **Bookshelf**: shelves of coloured book spines. Default 120 × 132. Its footprint (the bottom quarter, full width)
  blocks, so it stands against a wall and you walk along in front of it.
- A footprint blocks as a fence round its edge does (same reach, same slide). The upper part of the drawing never
  blocks: it is what stands up from the floor, and a character in front of it is drawn in front of it.
- Neither is a destination: walking up to one does not ring it.

## Water Cooler, Coffee Machine

Walk up to one and your character **gets a drink**.

- **Water Cooler**: a blue water bottle on a white cooler with a tap. Default 56 × 112.
- **Coffee Machine**: a coffee machine with a carafe, on a little counter. Default 72 × 96.
- **Using it**: walking a character onto it (the same arrival as a chair or a portal) gives it a cup, **water** or
  **coffee**, held in its hand for **60 seconds**. Every 8 seconds it takes a sip (the arm lifts the cup for a
  moment). A coffee steams. Using it again, or the other machine, swaps or refreshes the cup. Sitting keeps the
  cup: coffee at your desk.
- The machine **answers** on your screen: bubbles rise in the cooler's bottle, the coffee machine drips into the
  carafe, for a second and a half.
- **Everyone sees your cup**: what you hold rides your avatar presence (`holding: 'water' | 'coffee'`), like
  sitting. Nothing is written to the document; leaving the mode puts the cup down.
- Neither blocks, so you can walk right up to it; standing on it is standing in front of it.

## Rug

A floor rug: an oval with a border, in the element's fill. Decoration that never blocks and is never a destination;
placed **behind everything** like a room, so it lies on the floor under the furniture. Rooms and rugs paint as
backdrops, the larger first, however they arrive (placed, drawn to size, pasted, written by an agent): a rug lies on its
room's floor, and a room never covers what stands in it. Default 200 × 120.

## Share roles

- **Editor**: places, moves, renames, recolours and deletes every piece; sets a room's doorway.
- **Participant**: the participant palette does not offer them; walks, sits and drinks like everyone.
- **Viewer**: walks, sits and drinks like everyone (all of it is presence, which a Viewer has).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Room`, `Meeting-table`, `Plant`, `Bookshelf`, `Water-cooler`,
  `Coffee-machine`, `Rug`: a hyphenated kind keeps its hyphen, as every element's token does).
- A room's doorway changed: `Element · Changed · Room`.
- Getting a drink: `Canvas · Used · WaterCooler` or `CoffeeMachine`. Never who, never how often in a session.

## Not in scope

- Doors that open and close, or that lock.
- Light switches, day and night, or sound.
- Tables of other sizes (a four- or eight-seater). Chairs round any table do this today.
- Anyone else using your drink, handing a cup over, or drinks that run out.
