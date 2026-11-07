# Turning furniture

Status: **approved** (owner, 2026-11-07, the same rules as livehuddle's Turning furniture, for livediagram's pieces).
Every piece of furniture with a front can face four ways, and turning it turns everything about it: its drawing, its
seats and the way its sitters face, what blocks walking, and its machine's answer. The Rotate buttons on the selection
toolbar turn a placed piece; **Space** turns a piece while it is being placed.

## Why

A virtual office ([Office](office.md)) is built along walls. A sofa against the left wall should face right into the
room, and a bookshelf on a side wall should face across it rather than at the wall behind it. Until now only a chair, a
desk and a sofa took a facing, and only from the element menu; everything else faced the reader, and turning it with
the ordinary rotation spun the drawing on its side: legs in the air, a sitter facing the wrong way, a footprint that
still blocked where the piece used to stand.

## The camera

Every piece is drawn from **one camera**: the room's, looking down at the canvas from the front at about forty-five
degrees, the camera the Avatar-mode characters are drawn from ([Chair](chair.md#facing)). From it you see the tops of
seats, desks and tables, and the front face of anything that faces you; **gravity always points down the screen**, so
legs stand on the ground below the piece and its shadow falls under it. Turning a piece **never rotates its drawing**:
each facing has a drawing of its own.

| Facing        | Its front faces | What the room sees                                            |
| ------------- | --------------- | ------------------------------------------------------------- |
| Down (`'n'`)  | down the canvas | the **front**: the face a person uses, toward you             |
| Up (`'s'`)    | up the canvas   | the **back**: its back panel nearest you, the top beyond it   |
| Left (`'e'`)  | left            | the **side**: its depth across the canvas, its length down it |
| Right (`'w'`) | right           | the side, mirrored                                            |

- **`ShapeElement.chairFacing`** stores the facing for every piece that turns: `'n' | 'e' | 's' | 'w'`, where the
  piece's back is. The name is the chair's, where the field began; it is kept so stored documents and the API read
  unchanged. Absent means the piece's default facing (Down for all but the Desk, which is placed with its sitter facing
  up at the screen, as before).
- **A side view keeps the piece's footprint honest.** A bookshelf turned to face left is narrow and long: its depth
  across the canvas, its books end on down it, its base at the foot. A sofa on its side is tall, its two cushions one
  above the other.

## What turns

Every piece below takes a facing: its piece on the canvas, its seats and its footprint.

| Group                        | Pieces                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| Seats ([Chair](chair.md))    | Chair, Desk, Sofa                                           |
| Office ([Office](office.md)) | Meeting Table, Bookshelf, Water Cooler, Coffee Machine, Rug |

The Bookshelf, Water Cooler, Coffee Machine, Rug and Meeting Table have back and side drawings of their own
([Office](office.md) says what each shows); the Chair, Desk and Sofa already had theirs.

**What does not turn**, and shows no Rotate buttons:

- **The Plant**, which reads the same from every side: it keeps its one drawing, and its pot blocks as before.
- **The Room**, which is drawn to its size and keeps its own control: its doorway, set from its menu's **Room**
  section ([Office](office.md#room)).
- **The Fence** is not furniture: it keeps the ordinary rotation ([Fence](fence.md)).

## A turn

A turn is a quarter turn clockwise (**Rotate Right**: Down, Left, Up, Right, Down) or anticlockwise (**Rotate
Left**), or a facing picked outright from the element menu.

- **The piece keeps its centre and its scale**; its box takes the turned drawing's proportions, so a quarter turn of a
  sofa or a bookshelf changes its width and height and a chair turns in place.
- **Its seats turn with it.** Each seat sits on the same cushion in every drawing, and its sitter faces the way that
  seat faces once turned: a meeting table turned to face left seats the two who sat beyond it down its right, facing
  left. The occupied rings and the name pill follow the seats. The seats and footprints are the shared avatar
  package's (`@liveworkspace/avatar`), the same ones livehuddle turns.
- **Somebody sitting in it is carried round.** A piece turned (or moved) while somebody sits in it keeps them in their
  seat: their character moves to the seat's new place and faces its new way, and stays seated.
- **What blocks turns with it.** A bookshelf's footprint (its base) is drawn per facing, so the shelf turned onto a
  side wall blocks along that wall and no longer across the room.
- **Its machine's answer turns with it.** A Water Cooler's bubbles rise in its bottle from every side; a Coffee
  Machine's drip shows wherever its carafe shows (not from behind) ([Office](office.md#water-cooler-coffee-machine)).
- **One turn is one change**: one undo step, one realtime element change, the same for everyone on the tab.
- **A locked piece does not turn**: its Rotate buttons show disabled, "Locked. Unlock it to turn."

## Turning a placed piece

- **Selection toolbar.** A selected piece that turns shows **Rotate Left** (↺) and **Rotate Right** (↻) in a group of
  their own, always in the same place: straight after More and Edit Text, before Duplicate. Each turns the piece a
  quarter turn. They are an Editor's; a Participant and a Viewer have no edit toolbar.
- **Several pieces at once.** The multi-selection toolbar shows the same pair whenever the selection holds a piece that
  turns. Each piece turns about its own centre; pieces that do not turn stay as they are.
- **Element menu.** Every piece that turns has a section titled for it (Sofa, Bookshelf) with four tiles, **Down**,
  **Left**, **Up** and **Right**, the current one pressed, and a line saying what the facing means: "Which way somebody
  sitting here faces" on a piece with seats (the Chair, Desk, Sofa and Meeting Table), "Which way its front faces.
  Rotate Left and Rotate Right on the toolbar turn it a quarter." on the rest.
- **Command palette.** **Rotate Left** and **Rotate Right** turn the selection when it holds a piece that turns, beside
  the other selection commands ([Canvas and palette](../008-canvas/canvas-and-palette.md#search-panel)).
- **No free rotation.** Furniture has no Rotation category in its menu and no Rotate commands at an angle
  (`supportsRotation` is false for it): a turn is the only way round, so a piece is always drawn upright. A rotation
  stored on a piece before this rule is ignored: the piece draws upright at its facing, and its box is unchanged.

## Turning while placing

- **Space** turns the piece being placed a quarter turn clockwise; **Shift+Space** turns it back. The piece lands the
  way it was turned.
- It works **with the tile armed** (pressed, a tap or click on the canvas placing it) **and while dragging the tile**
  onto the canvas. livediagram has no preview of the piece under the pointer while a tile is armed, so an armed turn
  shows when the piece lands. While a tile is dragged, its canvas ghost (the dashed footprint,
  [Palette drag ghost](../010-palette/palette-drag-ghost.md)) takes the turned piece's size as the key is pressed.
- **A browser's own drag hears no keys**, so the tile of a piece that turns is carried by the pointer instead (mouse
  or pen): press, move and release over the canvas, exactly as a drag looks and feels, with the same ghost, the same
  alignment snap and guides, the copy cursor, and the same drop. Released over a panel, the palette or off the
  canvas, it places nothing; **Escape** puts it down. On a touch screen the tile drags as before and the piece is
  turned with its toolbar once placed.
- While a piece is being placed, Space turns it and does nothing else: it neither pans the canvas nor starts editing
  the selected element's label. With nothing being placed Space is the pan key and the label key, as before.
- The turn lasts while the tile stays armed (placing several sofas in a row faces each the same way) and is forgotten
  when the placing ends, so the next placing starts at the piece's default facing.

## Share roles

- **Editor**: turns any piece that turns, from the toolbar, the element menu and the command palette, and while
  placing.
- **Participant**: the participant palette offers no furniture and there is no edit toolbar, so turns nothing; sits in
  turned pieces like everyone.
- **Viewer**: as the Participant.

## Export and the API

- An export draws each piece at its facing, from the same drawing table the canvas paints (`svg-render-faces.ts`).
- The API and agents set `chairFacing` on any piece that turns (the element format lists it for each turning kind);
  on a piece that does not turn it is accepted and ignored (the piece draws at its one drawing), as it always was. A
  facing written without changing the box (an agent setting only the field) draws the turned drawing fitted whole and
  centred in the box it has, and its seats sit on the drawn cushions.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- A turn from the toolbar, the element menu or the command palette: `Element · Changed · <Kind>`, once per change, the
  kind as the editor's shape token names it (`Sofa`, `Meeting-table`).
- Placing a piece: `Element · Added · <Kind>`, as before, whatever its facing.

## Not in scope

- Turning by anything but a quarter: furniture stands square to the room.
- Turning the Plant or the Room.
- Turning a piece by Space while moving it on the canvas: the toolbar turns a placed piece.
- A preview of the piece under the pointer while its tile is armed.
