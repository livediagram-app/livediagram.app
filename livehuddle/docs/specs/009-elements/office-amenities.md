# Office amenities

Status: **approved** (owner, 2026-11-06; Work Tracker #534, #531, #532, #536, #530). The everyday kit every real
building has, so an office, a campus or a tower reads as a real place: a **Printer** and a **Copier**, a kitchenette
(a **Kitchen Counter**, a **Kitchen Sink**, a **Fridge**, a **Microwave** and a **Kettle**), a bank of **Lockers**, a
**Coat Rack** and an **Umbrella Stand** by the door, and a restroom (a **Toilet Cubicle**, a **Washbasin** with its
mirror, a **Hand Dryer** and a **Restroom** room preset with its door sign). They are [Office](office.md) pieces in
every way not said here: drawn upright from the room's camera, placed at a fixed size, aspect locked, no settings `…`,
no words on them, an Editor's to place, move and delete, and walked round by everyone in
[Avatar mode](../008-canvas/avatar-mode.md).

## Why

People recognise a place by its ordinary things. A team walking round a Space finds the printer queue, makes a tea in
the kitchen, drops a coat at the door and goes to wash their hands, the way they would in a building. None of it needs
a feature of its own: it is furniture, drawn well, that makes the rest believable.

## Where they live

All in **Perks** (`collab-amenities`), which splits into three named groups in the flyout, each ending on a divider
([Category flyout](../010-palette/palette-top-level-categories.md#the-space-categories)):

| Group        | Tiles, in order                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| **Office**   | Plant, Bookshelf, Printer, Copier, Lockers, Coat Rack, Umbrella Stand                                   |
| **Kitchen**  | Water Cooler, Coffee Machine, Vending Machine, Kitchen Counter, Kitchen Sink, Fridge, Microwave, Kettle |
| **Restroom** | Restroom (the room preset), Toilet Cubicle, Washbasin, Hand Dryer                                       |

Shape kinds: `printer`, `copier`, `kitchen-counter`, `kitchen-sink`, `fridge`, `microwave`, `kettle`, `lockers`,
`coat-rack`, `umbrella-stand`, `toilet-cubicle`, `washbasin`, `hand-dryer`. The Restroom is not a kind: it is a Room.

## How each one walks

| Piece           | Default size | Walking                                                                                  |
| --------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Printer         | 72 × 80      | Scenery: its cabinet blocks                                                              |
| Copier          | 104 × 128    | Scenery: its base (the paper trays' feet) blocks                                         |
| Lockers         | 136 × 132    | Scenery: the bottom fifth, full width, blocks, so it stands against a wall               |
| Coat Rack       | 56 × 128     | Scenery: its foot blocks; the coats above it never do                                    |
| Umbrella Stand  | 40 × 64      | Scenery: the stand blocks                                                                |
| Kitchen Counter | 112 × 88     | Scenery: the cabinets, the lower half full width, block; counters side by side join up   |
| Kitchen Sink    | 112 × 88     | Scenery, exactly as the Kitchen Counter, so a run of units is one barrier                |
| Fridge          | 72 × 136     | Scenery: its base blocks                                                                 |
| Microwave       | 60 × 40      | Stands on a counter: never blocks, never a destination (the counter under it blocks)     |
| Kettle          | 32 × 36      | Stands on a counter, as the Microwave                                                    |
| Toilet Cubicle  | 96 × 152     | Scenery: its floor (the lower two fifths, full width) blocks; cubicles side by side join |
| Washbasin       | 72 × 112     | Scenery: its pedestal blocks; the mirror above is on the wall                            |
| Hand Dryer      | 36 × 44      | Hangs on a wall: never blocks, never a destination                                       |

- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: a solid footprint, a character inside one walks
  out of it and never deeper in. The drawing above the footprint never blocks; a character in front of it is drawn in
  front of it. Walking up to one rings nothing.
- **Turned**, each blocks with the ground under its turned drawing: from behind where it does from the front; on its
  side the base along its length (a bank of Lockers blocks along the wall it stands against), and a Kitchen Counter's,
  a Kitchen Sink's and a Toilet Cubicle's whole length, so a run of them turned onto a side wall is one barrier.
- **On a counter**: the Microwave and the Kettle are drawn to stand on a Kitchen Counter's worktop when placed over
  its top edge (their base level with the worktop's middle). They have no footprint and are never what you stand on,
  exactly as a wall piece, so a click on one walks you to the clicked point, as a click on the counter does.
- A Microwave or a Kettle turned the same way as the counter under it stands on its worktop too: from behind its base
  is on the same line as from the front, and on its side its base is centred across the worktop (`counterSideX`),
  wherever it is placed along the run.
- **Wall pieces** (the Hand Dryer) are walked past, not to.
- Nobody sits in any of them; none gives a drink.

## The pieces

### Printer, Copier

- **Printer**: a desktop laser printer on a small two-drawer cabinet, a printed sheet in its output tray, a little
  status screen and a green light.
- **Copier**: a floor-standing copier: a scanner lid with a document feeder on top, a control panel with a lit blue
  touch screen, the body with a finished stack of copies in its output bay, and three paper trays with handles on
  small feet.
- Their bodies take the theme (the piece's own colour, else a wash of its stroke, as every office piece), so they sit
  pale on light paper and soft grey on dark; the paper is always white and the screens always lit.
- **Turned** ([Turning furniture](furniture-facing.md)): from behind, the Printer shows its plain back with vents and a
  socket, the sheet rising beyond it, and the Copier its plain back with a vent grille over its trays' backs. Turned to
  face left, the Printer's top is seen from above with the printed sheet in its tray, its screen and light on a strip
  down the left and its cabinet's two drawers below; the Copier's lid carries the originals, its control panel and
  lit screen are cheated toward you at the front, and its output bay and three trays run down the left on its feet.

### Lockers, Coat Rack, Umbrella Stand

- **Lockers**: a bank of four tall lockers in alternating blues, each door with vent slits, a number plate and a
  handle, on a plinth. For entrances, gyms and hot-desk floors.
- **Coat Rack**: a wooden coat stand on a cross foot, a navy coat and a camel coat on its hooks, a striped scarf and
  a hat on top.
- **Umbrella Stand**: a round stand with three furled umbrellas (red, navy and yellow), their hooked handles up.
- **Turned**: from behind, the Lockers are a plain back panel with the seams between the four lockers, on the plinth.
  Turned to face left they are narrow and long: the bank's top from above, its four lockers one above the other, a
  tall plain end panel nearest you, the plinth at the foot, and the four doors (alternating blues, vents, number plates,
  handles) one above the other down the left. Faced right against a left wall, the doors face into the room. The Coat
  Rack and the Umbrella Stand read the same from every side and do not turn.

### Kitchenette

A run of units along a wall, the way a small office kitchen is built.

- **Kitchen Counter**: base units in sage green with an oak worktop and a tiled splashback, two drawers over two
  cupboard doors, a plinth below.
- **Kitchen Sink**: the same unit with a steel sink set into the worktop, a swan-neck tap and a tea towel over the
  cupboard door. A Sink and a Counter placed side by side read as one run: the same height, the same worktop line.
- **Fridge**: a tall fridge-freezer, its freezer door over the fridge door, long handles, a child's drawing and two
  magnets on the door.
- **Microwave**: a microwave with a dark glass door and a control panel (a green clock and buttons).
- **Kettle**: a red electric kettle on its base, with a water window.
- The units' colours are their own (sage, oak, white tile, steel, red); the Fridge's, Microwave's and appliances' bodies
  take the theme.
- **Turned**: from behind, a Counter or a Sink shows its worktop at the same line as from the front and the carcass's
  plain back, the Sink's basin and tap beyond; the Fridge its plain back, the condenser's coil and the compressor; the
  Microwave its back with vent slits; the Kettle its handle on the left and no water window. Turned to face left, a
  Counter or a Sink is the unit's length down the canvas: the tiles against the wall on the right, the oak worktop the
  whole length, the drawers and doors cheated toward you down the left over the plinth, and nothing closing either end,
  so units turned the same way and placed end to end are one run down a wall with one worktop line. The Sink's basin
  is in the worktop with the tap reaching over it and the tea towel on the nearer door. The Fridge is tall and deep,
  its top seen from above, its side panel nearest you and its two doors with their handles down the left. The
  Microwave's top is seen from above with its door and controls down the left; the Kettle turns its handle toward you
  and its window to the left.

### Restroom

- **Toilet Cubicle**: a cubicle seen from the front: a head rail and two side panels, the door swung open against the
  right panel, and inside a white toilet under its cistern, a roll of paper on the left panel and a green Vacant
  indicator on the door. Placed side by side, cubicles make a row.
- **Washbasin**: a white wall-hung basin on a pedestal with a tap and a soap dispenser, under a framed mirror with a
  glint across its glass.
- **Hand Dryer**: a wall-mounted dryer with a grille, a nozzle under it and a green ready light.
- **Turned**: from behind, a Toilet Cubicle is its laminate back between its side panels under the head rail, and a
  Washbasin shows its mirror's plain back on its wire and the basin from behind. Turned to face left, a cubicle is seen
  from above: its tiled floor between the far and near partitions, the toilet under its cistern against the wall on the
  right, the paper on the far partition, the door open against the near one with its Vacant indicator and the head
  rail down the left over its open front; cubicles turned the same way and placed end to end make a row down a side
  wall. A Washbasin turned to face left has its mirror on the side wall to the right, seen edge on and cheated toward
  you so its glass still shows, the basin from above with the tap reaching over it, the soap pump nearest you and the
  pedestal below. The Hand Dryer hangs on the back wall and does not turn.

### The Restroom preset

The palette's **Restroom** tile places a whole restroom in one go, a [Room](office.md#room) furnished as one:

- A Room named **Restroom** at a room's default size (480 × 320), its [Door](room-builder.md#door) in the middle of the
  front wall as every new Room.
- Inside, along the back wall: two **Toilet Cubicles** side by side at the left, a **Hand Dryer** on the wall beside
  them and two **Washbasins** at the right, all clear of the doorway.
- Outside, beside the door on the corridor side: a [Room Sign](screen-and-room-sign.md#room-sign) that reads the
  room, **Restroom**, and shows Free or In Use (and has its Knock).
- Everything is ordinary elements: one change, so one undo takes the whole restroom away; the room is selected and each
  piece can be moved or deleted on its own. It is placed however a Room is (a tap or a press with the tile armed, or a
  drop from the palette) and lines up with other rooms as a Room does. The preset draws its cubicles, basins and sign in
  the room's stroke, so a themed room keeps its pieces in step.
- The armed tile's preview is the room alone (the room's default size), as the Room tile's.

## In the templates

- **Virtual Office**: the **Kitchen** gets a kitchenette along its back wall, either side of its door: a Fridge and a
  Counter with a Microwave and a Kettle on it, a Sink and the Coffee Machine; the Water Cooler and a plant move to the
  floor. **Reception** gets a Coat Rack and an Umbrella Stand by the door, **Desks** a Printer.
- **Co-working Tower**: **Hot Desks** (Ground Floor) gets a print corner (a Copier and a Printer) and a bank of
  Lockers along its front; the **Cafe** a Fridge; **Level 2** a **Restroom** (two cubicles, a hand dryer, two
  basins), its door onto the open floor, signed like every room there.

## Share roles

- **Editor**: places, moves, recolours and deletes every piece, and places the Restroom preset.
- **Participant**: has no palette, so it places none; walks round them like everyone.
- **Viewer**: walks round them like everyone (walking is presence, which a Viewer has).

Nothing here stores anything but the elements themselves: no state, no delta, no presence of their own.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Printer`, `Copier`, `Kitchen-counter`, `Kitchen-sink`, `Fridge`,
  `Microwave`, `Kettle`, `Lockers`, `Coat-rack`, `Umbrella-stand`, `Toilet-cubicle`, `Washbasin`, `Hand-dryer`).
- Placing the Restroom preset: `Element · Added · Room`, as any Room (the preset is a Room).

## Export

An export draws each piece's art exactly as the canvas does (the shared drawing table), in the paper's ink.

## Not in scope

- Printing, copying or a print queue; a drink or a snack from the kitchen (a tea from the Kettle is a follow-up,
  with a new held drink).
- Opening a locker, hanging your own coat, or an occupied cubicle (who is in one is presence the Room Sign already
  shows for the whole restroom).
- Room presets for other rooms (a Kitchen preset, a Meeting Room preset): the Restroom is the first.
