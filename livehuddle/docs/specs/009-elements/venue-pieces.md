# Venue pieces

Status: **approved** (owner, 2026-11-06; Work Tracker #541, #556, #557, #542, #512). The pieces that make a big Space
read as a venue rather than a room: **Pillars** and **Columns** that hold up a hall or a lobby, a **Car Park** and a
**Bike Rack** where people arrive at a campus, a **Swimming Pool** for a hotel or a beach, and **Stage Curtains** and a
**Podium** that pair with the [Stage](office.md#stage), whose own drawing is made stronger here too. They are
[Office](office.md) pieces in every way not said here: drawn upright from the room's camera, placed at a fixed size,
aspect locked, no settings `…`, no words on them, an Editor's to place, move and delete, and walked round by everyone
in [Avatar mode](../008-canvas/avatar-mode.md). The Swimming Pool alone is resizable, like the
[Pond](social-pieces.md#garden-umbrella-fountain-pond).

## Why

A Space as big as a hall, a hotel or a campus needs the things that make one recognisable at a glance: columns
down a lobby, cars parked by the gate, a pool on the hotel roof, a stage with its curtains and a lectern for whoever
speaks. Without them a large Space reads as a large empty floor. None needs a feature of its own: it is furniture,
drawn well, that walks like the rest.

## Where they live

| Category   | Tiles, in palette order                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **Rooms**  | Stage Curtains and Podium after the Stage; Pillar and Column after the Rug (all in the **Floor** group) |
| **Garden** | Swimming Pool after the Pond; Car Park and Bike Rack after the Campfire                                 |

Shape kinds: `pillar`, `column`, `car-park`, `bike-rack`, `swimming-pool`, `stage-curtains`, `podium`.

## How each one walks

| Piece          | Default size | Walking                                                                                             |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| Pillar         | 48 × 152     | Scenery: its base blocks, full width, so you walk round it                                          |
| Column         | 64 × 168     | Scenery: its plinth blocks                                                                          |
| Car Park       | 240 × 128    | Scenery: the bays block across the whole width (the parked cars), so a row of them is one barrier   |
| Bike Rack      | 136 × 80     | Scenery: the stands and the bikes locked to them block                                              |
| Swimming Pool  | 320 × 200    | Scenery drawn to its size: the water blocks, so you stop at the rim and walk round on the deck      |
| Stage Curtains | 360 × 120    | Hangs over a stage: never blocks, never a destination (you walk between and in front of the drapes) |
| Podium         | 56 × 88      | Scenery: its foot blocks; the speaker stands behind it                                              |

- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: a solid footprint, a character inside one walks
  out of it and never deeper in. The drawing above the footprint never blocks; a character in front of it is drawn in
  front of it. Walking up to one rings nothing.
- **The pool's rim**: the footprint is the water, the pool less its deck. The deck is a fixed band (14 px, or a tenth
  of the pool's shorter side when that is less), the same on the canvas and in the walk, however big the pool, so the
  water always stops a character exactly where its edge is drawn.
- **Stage Curtains** walk as a wall piece does (the [Notice Board](social-pieces.md#how-each-one-walks)): walked past,
  not to. A click on them walks you to the clicked point, so a click on the stage between the drapes still takes you
  onto the stage.
- Nobody sits in any of them; none gives a drink. Standing on a stage under its curtains, or behind its podium, is
  standing on the stage ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md)).

## The pieces

### Pillar, Column

- **Pillar**: a square modern pillar: a plain shaft with a lit face and a shaded side, a cap a little wider than the
  shaft and a plinth at its foot. Its body takes the theme (the piece's own colour, else a wash of its stroke), so it
  reads as plaster on light paper and soft grey on dark.
- **Column**: a classical stone column: a stepped square plinth, a round base, a fluted shaft that tapers a little, and
  a capital with a scroll at each corner under a square slab. Stone whatever the theme.
- Both are tall and narrow, so a row of them reads as structure from across a hall.

### Car Park, Bike Rack

- **Car Park**: a strip of tarmac with a kerb along its back and three bays marked in white: a red car parked in the
  left bay, a blue one in the right, nose to the viewer (bonnet, windscreen, headlights, a number plate, wheels), and
  the middle bay empty with its wheel stop. Placed side by side, car parks make a longer row.
- **Bike Rack**: a concrete pad with two steel hoop stands, a red bike and a teal bike each locked to one, side on
  (two wheels with spokes, a frame, a saddle and handlebars).
- Their colours are their own (tarmac, paint, steel), so they read the same on light and dark paper.

### Swimming Pool

- A rectangular pool drawn to its size, like the Pond: a pale tiled deck round it, the water in the element's fill (a
  pool blue, deep on dark paper), the inside of the back wall seen as a darker band, a lane line of red and white
  floats down the middle of a pool long enough for one (200 px along), two dark lane stripes on its floor along its
  long side, a steel ladder down the back wall at the right with its handrails over the coping, and a glint. A fixed handful of shapes however big.
- A faint ripple drifts across the water (CSS; still under reduced motion), as on the Pond.
- Resizable, not aspect locked. Its fill is the water, set like any fill.

### Stage Curtains, Podium

- **Stage Curtains**: a proscenium of deep red velvet: a pelmet across the top with a gold fringe, and a drape at each
  side gathered by a gold tie-back so it flares to the floor, open in the middle so the stage and whoever stands on it
  show through. Placed over a stage, the pelmet sits along its back and the drapes frame it; at its default size it
  pairs with the Stage's default (360 wide).
- **Podium**: a wooden lectern: a sloping top with a page of notes on it, a gooseneck microphone with a red light, and
  a front panel with a brass emblem, on a foot.
- Their colours are their own (velvet, gold, wood, brass).

### The stronger Stage

The [Stage](office.md#stage) is drawn as a stage at a glance, at any zoom a template opens at:

- **Boards**: its top in the element's fill (now a warm honey wood by default, deep brown on dark paper) laid in rows
  of boards about 24 px deep (at most eight rows, whatever its height), each row's butt joints at its own offset so
  the boards read as laid at random lengths, never as brickwork, faint enough that whoever stands on it reads first.
- **A front lip**: a darker nosing along the top's front edge, so the top reads as raised.
- **The front edge**: a deep stained-wood skirt, its face shaded with the stroke as before, with **footlights**: a row
  of small warm lamps along the lip, spaced evenly and kept clear of the name plate.
- **The name plate**: centred on the front edge as before, in the top's fill, so the stage's name keeps its contrast on
  either paper.
- The spotlight and the On Stage badge are unchanged. Only how a stage is drawn changes; nothing is stored, and a
  stage with its own fill keeps it.

## In the templates

- **All-Hands Hall**: Stage Curtains over the stage and a Podium on it, to the right of the middle.
- **Expo Hall**: Stage Curtains over the keynote stage, a Podium on it, and four Pillars on the open floor between the
  booths and the keynote seats.
- **Training Room**: a Podium on the stage.
- **Conference Venue**: Stage Curtains over the Main Hall's stage and a Podium on it.
- **Hotel and Suites**: four Columns in two pairs across the Lobby either side of the way in from the front door, past
  the reception; on the **Rooftop**, a Swimming Pool in place of the long water garden, with its planters.
- **Beach Offsite**: a Swimming Pool on the beach by the garden umbrellas.
- **Company Campus**: two Car Parks side by side (one row of six bays) to the right of the gate, and a Bike Rack the
  other side of the main path.
- **Startup HQ**: a Bike Rack by the gate.

The template previews draw each: the curtains, podium and the stage's wood in the event previews (All-Hands Hall, Expo Hall,
Conference Venue; the Training Room's podium), the columns in the Hotel's, the pillars in the Expo Hall's, the pool
in the Beach Offsite's, and the car park and bike rack in the Company Campus's.

## Share roles

- **Editor**: places, moves, recolours and deletes every piece, and resizes the Swimming Pool.
- **Participant**: has no palette, so it places none; walks round them like everyone.
- **Viewer**: walks round them like everyone (walking is presence, which a Viewer has).

Nothing here stores anything but the elements themselves: no state, no delta, no presence of their own.

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

Placing one: `Element · Added · <Kind>` (`Pillar`, `Column`, `Car-park`, `Bike-rack`, `Swimming-pool`,
`Stage-curtains`, `Podium`).

## Export

An export draws each piece's art exactly as the canvas does (the shared drawing table), in the paper's ink; the pool
draws to its size with its water in its fill; the Stage draws its boards, lip and footlights.

## Not in scope

- Swimming, a diving board, or a pool you walk into; cars that drive or arrive; parking a bike.
- Curtains that open and close, or a podium that grants the floor (who may speak is the Stage's Who Can Speak).
- A round or kidney pool (the pool is a rectangle; the Pond is the free shape).
