# Turning furniture

Status: **approved** (owner, 2026-11-07). Every piece of furniture with a front can face four ways, and turning it
turns everything about it: its drawing, its seats and the way its sitters face, what blocks walking, and its live
face. The Rotate buttons on the selection toolbar turn a placed piece; **Space** turns a piece while it is being
placed.

## Why

A Space is built along walls. A sofa against the left wall should face right into the room, and a bank of lockers on
a side wall should face across it rather than at the wall behind it. Until now only a chair, a desk and a sofa took a
facing, and only from the element menu; everything else faced the reader, and turning it with the ordinary rotation
spun the drawing on its side: legs in the air, a sitter facing the wrong way, a footprint that still blocked where the
piece used to stand.

## The camera

Every piece is drawn from **one camera**: the room's, looking down at the canvas from the front at about forty-five
degrees, the camera the Avatar-mode characters are drawn from. From it you see the tops of seats, desks and counters,
and the front face of anything that faces you; **gravity always points down the screen**, so legs stand on the
ground below the piece and its shadow falls under it. Turning a piece **never rotates its drawing**: each facing has
a drawing of its own.

| Facing        | Its front faces | What the room sees                                            |
| ------------- | --------------- | ------------------------------------------------------------- |
| Down (`'n'`)  | down the canvas | the **front**: the face a person uses, toward you             |
| Up (`'s'`)    | up the canvas   | the **back**: its back panel nearest you, the top beyond it   |
| Left (`'e'`)  | left            | the **side**: its depth across the canvas, its length down it |
| Right (`'w'`) | right           | the side, mirrored                                            |

- **`ShapeElement.chairFacing`** stores the facing for every piece that turns: `'n' | 'e' | 's' | 'w'`, where the
  piece's back is. The name is the chair's, where the field began; it is kept so stored documents and the API read
  unchanged. Absent means the piece's default facing (Down for all but the Desk, Standing Desk and Hot Desk, which
  are placed with their sitter facing up at the screen, as before).
- **A side view keeps the piece's footprint honest.** A bank of lockers turned to face left is narrow and long: its
  depth across the canvas, its four doors one above the other down it, its plinth at the foot. A sofa on its side is
  tall, its two cushions one above the other.
- A piece whose drawing reads the same from every side but whose seat has a direction (the **Bar Stool**) keeps its
  one drawing and turns its sitter.

## What turns

Every piece below takes a facing: its tile in the palette, its piece on the canvas, its seats and its footprint.

| Group (palette category) | Pieces                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Seats                    | Chair, Desk, Sofa, Meeting Table, Bench, Picnic Table, Hammock, Bean Bag, Reading Nook                            |
| The pod and the bar      | Office Pod, Bar, Bar Stool, Drinks Cabinet, Drinks Fridge                                                         |
| Office                   | Bookshelf, Printer, Copier, Lockers, Reception Desk, Hot Desk, Standing Desk, Phone Booth                         |
| Kitchen                  | Water Cooler, Coffee Machine, Vending Machine, Kitchen Counter, Kitchen Sink, Fridge, Microwave, Kettle           |
| Restroom                 | Toilet Cubicle, Washbasin                                                                                         |
| Play and rest            | Ping-Pong Table, Pool Table, Foosball Table, Jukebox, Arcade Machine, Fireplace, Nap Pod, Treadmill, Weight Bench |
| Venue and wayfinding     | Podium, Car Park, Bike Rack, Stairs, Suggestion Box, Rug                                                          |

**What does not turn**, and shows no Rotate buttons:

- **Pieces that read the same from every side**: Plant, Outdoor Plant, Tree, Campfire, Fountain, Garden Umbrella,
  Pillar, Column, Umbrella Stand, Coat Rack, Pet Bed.
- **Pieces that hang on the back wall**, the one wall the camera sees face on: Notice Board, World Clock, Dartboard,
  Calendar Wall, Team Photo Wall, Hand Dryer, Stage Curtains and the Elevator. On a side wall they would be seen edge
  on, their faces gone.
- **Signs read face on**: the Directory and the Signpost.
- **Pieces drawn to their size** keep their own controls: a Room's doorway, a Door's wall, a Fence's and Garden
  Fence's rotation, and the Stage, Grass, Garden Path, Pond and Swimming Pool, which are stretched rather than turned.

## A turn

A turn is a quarter turn clockwise (**Rotate Right**: Down, Left, Up, Right, Down) or anticlockwise (**Rotate
Left**), or a facing picked outright from the element menu.

- **The piece keeps its centre and its scale**; its box takes the turned drawing's proportions, so a quarter turn of
  a sofa or a bank of lockers changes its width and height and a chair turns in place.
- **Its seats turn with it.** Each seat sits on the same cushion in every drawing, and its sitter faces the way that
  seat faces once turned: a bench turned to face right seats its two sitters one above the other, facing right. The
  occupied rings and the name pill follow the seats.
- **Somebody sitting in it is carried round.** A piece turned (or moved) while somebody sits in it keeps them in
  their seat: their character moves to the seat's new place and faces its new way, and stays seated.
- **What blocks turns with it.** A scenery piece's footprint (its base, its plinth, its cabinets) is drawn per facing,
  so the lockers turned onto a side wall block along that wall and no longer across the room.
- **Its live face turns with it** ([Live faces](#live-faces)).
- **One turn is one change**: one undo step, one realtime element change, the same for everyone in the room.

## Turning a placed piece

- **Selection toolbar.** A selected piece that turns shows **Rotate Left** (↺) and **Rotate Right** (↻) in a group of
  their own, always in the same place: straight after More and Edit Text, before Duplicate. Each turns the piece a
  quarter turn. They are an Editor's; a Participant and a Viewer have no edit toolbar.
- **Several pieces at once.** The multi-selection toolbar shows the same pair whenever the selection holds a piece that
  turns. Each piece turns about its own centre; pieces that do not turn stay as they are.
- **Element menu.** Every piece that turns has a section titled for it (Sofa, Lockers) with four tiles, **Down**,
  **Left**, **Up** and **Right**, the current one pressed, and a line saying what the facing means: "Which way
  somebody sitting here faces" on a piece with seats, "Which way its front faces" on the rest.
- **Command palette.** **Rotate Left** and **Rotate Right** turn the selection, beside the other selection commands.
- **No free rotation.** Furniture has no Rotation category in its menu and no Rotate commands at an angle: a turn is
  the only way round, so a piece is always drawn upright. A rotation stored on a piece before this rule is ignored:
  the piece draws upright at its facing, and its box is unchanged.

## Turning while placing

- **Space** turns the piece being placed a quarter turn clockwise; **Shift+Space** turns it back. The preview under
  the pointer turns as the key is pressed and the piece lands the way it shows.
- It works **with the tile armed** (pressed, the piece following the pointer until a click places it) **and while
  dragging the tile** onto the canvas. A browser's own drag hears no keys, so the tile of a piece that turns is
  carried by the pointer instead: press, move and release over the canvas, exactly as a drag looks and feels, with the
  same preview, the same alignment snap and guides, and the same drop. Released over a panel, the palette or off the
  canvas, it places nothing; **Escape** puts it down. On a touch screen the tile drags as before and the piece is
  turned with its toolbar once placed.
- While a piece is being placed, Space turns it and does nothing else: it neither pans the canvas nor starts editing
  the selected element's label. With nothing being placed Space is the pan key and the label key, as before.
- The turn lasts while the tile stays armed (placing several sofas in a row faces each the same way) and is forgotten
  when the placing ends, so the next placing starts at the piece's default facing.

## Live faces

A piece's moving and pressable parts are drawn on the drawing the facing shows, on its own grid, so they stay on the
piece when it turns:

- **What is on top shows from every side**: a turned Ping-Pong Table plays its game on the turned table, its ends at
  the top and the bottom; a turned Treadmill runs its belt along its length; a Hot Desk's raised name card and a
  Reception Desk's bell sit on the desk top.
- **What is on the front shows where the front shows**: a Fireplace's flames, a Jukebox's lights and an Arcade
  Machine's screen show in the front view and, where the side drawing still shows them, in the side view; from the
  back they are out of sight.
- **A control stays reachable at every facing.** A piece's button (the Jukebox's Play / Mute, the Arcade Machine's
  Insert Coin, the Suggestion Box's Suggest) sits on the turned drawing, and in Avatar mode pressing the piece opens
  or uses it as before.
- **Ping-Pong at a turned table.** On a table turned onto its side the paddles move across the table, so a player
  moves theirs with **A** and **D** or **Arrow Left** and **Arrow Right**, and the pointer's or finger's position
  across the table moves it; those keys are then the paddle's and stand nobody up
  ([Social pieces](social-pieces.md#controls)).

## Share roles

- **Editor**: turns any piece that turns, from the toolbar, the element menu and the command palette, and while
  placing.
- **Participant**: has no palette and no edit toolbar, so turns nothing; sits in turned pieces like everyone.
- **Viewer**: as the Participant.

## Export and the API

- An export draws each piece at its facing, from the same drawing table the canvas paints.
- The API and agents set `chairFacing` on any piece that turns; on a piece that does not turn it is accepted and
  ignored (the piece draws at its one drawing), as it always was. A facing written without changing the box (an agent setting only the field) draws the turned drawing
  fitted whole and centred in the box it has, and its seats sit on the drawn cushions.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- A turn from the toolbar, the element menu or the command palette: `Element · Changed · <Kind>`, once per change.
- Placing a piece: `Element · Added · <Kind>`, as before, whatever its facing.

## Not in scope

- Turning by anything but a quarter: furniture stands square to the room.
- Wall pieces on side walls, and turning the pieces drawn to their size.
- Turning a piece by Space while moving it on the canvas: the toolbar turns a placed piece.
