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

| Piece          | Default size | Walking                                                                                                         |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| Pillar         | 48 × 152     | Scenery: its base blocks, full width, so you walk round it                                                      |
| Column         | 64 × 168     | Scenery: its plinth blocks                                                                                      |
| Car Park       | 240 × 128    | Scenery: the two parked cars and the kerb block, so you can walk into the empty middle bay up to its kerb       |
| Bike Rack      | 136 × 80     | Scenery: the stands and the bikes locked to them block                                                          |
| Swimming Pool  | 320 × 200    | Scenery drawn to its size: the water blocks, so you stop at the rim and walk round on the deck                  |
| Stage Curtains | 360 × 120    | Hangs over a stage: each drape's hem blocks, never a destination (you walk between and in front of the drapes)  |
| Podium         | 56 × 88      | Its foot blocks; a click stands you at its speaker spot ([Speaking from the Podium](#speaking-from-the-podium)) |

- **Scenery** blocks as the [Plant](office.md#plant-bookshelf) does: a solid footprint, a character inside one walks
  out of it and never deeper in. The drawing above the footprint never blocks; a character in front of it is drawn in
  front of it. Walking up to one rings nothing.
- **The pool's rim**: the footprint is the water, the pool less its deck. The deck is a fixed band (14 px, or a tenth
  of the pool's shorter side when that is less), the same on the canvas and in the walk, however big the pool, so the
  water always stops a character exactly where its edge is drawn.
- **A piece's footprint can be several boxes** (Work Tracker #609): each blocks as one footprint does, and what lies
  between them is open floor. The Car Park blocks at its two cars and its kerb, each car's box running out to the
  piece's edge, so car parks side by side still join into one barrier at their cars and kerbs, while the empty middle
  bay is open from the front (from behind, from the far edge; on its side, from the side away from the kerb). Turned,
  each box turns with the drawing, as a single footprint does ([Turning furniture](furniture-facing.md)).
- **Stage Curtains** are never a destination: walked past and between, not to. A click on them walks you to the
  clicked point, so a click on the stage between the drapes still takes you onto the stage. Each drape blocks at its
  hem, where it meets the floor: a box under each side drape, the outer sixth of the width, so you walk round a drape
  and onto the stage between them, never through one. The pelmet across the top hangs overhead and blocks nothing.
- Nobody sits in any of them; none gives a drink. The Podium alone is a destination: you stand at it
  ([Speaking from the Podium](#speaking-from-the-podium)). Standing on a stage under its curtains, or behind its
  podium, is standing on the stage ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md)).

### Speaking from the Podium

Status: **approved** (owner, 2026-11-10: "the lectern should work like a desk when I click it: make me stand behind it
at the correct orientation so I can speak from it"; "From the lectern my audio should be 3 times further, but still
blocked by walls"). The Podium is held like a seat ([Chair](chair.md) "Sitting", "Occupancy is presence"), and its
one seat is stood at, as a Standing Desk's is ([Workday pieces](workday-pieces.md#how-each-one-walks)).

- **A click or a tap anywhere on it** walks you to its **speaker spot**, and arriving there stands you at it: your
  feet on the spot, facing the way the Podium's front faces (toward its audience), drawn standing, never seated.
  Steering into the spot with the arrow keys does the same, as walking into a chair does. A walk that only passes it
  on the way somewhere else walks on ([Chair](chair.md) "Only the chair you are going to").
- **The speaker spot is behind its front, at every facing** ([Turning furniture](furniture-facing.md)):

  | Podium faces  | Its front faces | Where the speaker stands                             | The speaker faces |
  | ------------- | --------------- | ---------------------------------------------------- | ----------------- |
  | Down (`'n'`)  | down the canvas | behind it, up the canvas, just above its sloping top | down              |
  | Up (`'s'`)    | up the canvas   | in front of it from the camera, just below its foot  | up                |
  | Left (`'e'`)  | left            | at its right, at its foot's depth, clear of the foot | left              |
  | Right (`'w'`) | right           | at its left (the side mirrored)                      | right             |

  The rule: the speaker faces the way the Podium's front faces, and stands on the other side of it. Furniture has no
  free rotation, so these four are every angle a Podium can stand at; a rotation stored on one before that rule is
  ignored, as its drawing ignores it. The spot is always clear of the foot that blocks, so standing there and walking
  off never starts you inside it.

- **Turned or moved while you stand at it**, it carries you with it, onto its new spot and facing its new way.
- **One speaker at a time.** Somebody already at it holds it, from presence alone, as a taken seat is held. Clicking a
  Podium somebody stands at walks you there and stops you **a step to the speaker's side**, beside them at the
  Podium's front line, on the side nearer where you came from. Two people who arrive at
  once settle it as a seat does: the earlier keeps it and the other steps aside the same way.
- **Everyone sees it.** Who stands at it, where and facing which way travel in the presence everyone already shares
  (your feet, your facing, the piece you hold and your claim on it), so every screen draws the speaker on the spot,
  facing the audience, and marks the Podium taken.
- **Leaving.** Any movement steps you away from it, as any movement stands you up from a chair: a click or tap
  elsewhere, or an arrow key. A press on the Podium you stand at keeps you there.
- **Your voice carries three times as far** ([Proximity audio](../012-collaboration/proximity-audio.md#hearing)):
  while you stand at a Podium, the people who hear you, and how loudly, are worked out as if every distance to you were
  a third of what it is. Walls block it exactly as before: nobody across a wall hears you. It ends the moment you step
  away. On a stage that lets you speak, the stage already reaches the whole tab and the Podium adds nothing; standing at
  it never makes you a stage speaker you were not (who may speak is the Stage's Who Can Speak).
- Its name for a screen reader says who is at it: "Podium, Ana speaking". Its element menu's facing line stays "Which
  way its front faces", since its speaker always faces that way.
- **Every Space is roomy** leaves it out: it stands on a stage, not in a row of seats
  ([Templates by mode](../007-editor/templates-by-mode.md)).

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
- **Turned** ([Turning furniture](furniture-facing.md)): from behind, the Car Park's kerb runs along its near edge and
  its cars are backed up to it, their tails toward you (rear window, red tail lights, a number plate), the blue car now
  on the left; the Bike Rack's stands are nearest you with the bikes beyond them, facing left. Turned to face left, the
  Car Park's tarmac runs down the canvas with the kerb down its right and its bays one above the other, each car side
  on with its nose to the left, and its bays block full length; the Bike Rack's pad runs down the canvas, its two
  stands one above the other seen from their end, each bike beside its stand coming toward you nose on.
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
  **Turned**: from behind, the speaker's side, its sloping top tipped toward you with the page of notes, the
  microphone beyond, and a plain back panel with a shelf; to face left, its side with the top sloping down to the
  right, a strip of the front panel and the edge of its emblem down the left, the microphone curving back over it.
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
- **Festival Field**: Stage Curtains as the backdrop of the open-air Main Stage.
- **Company Campus**: two Car Parks side by side (one row of six bays) to the right of the gate, and a Bike Rack the
  other side of the main path.
- **Startup HQ**: a Bike Rack by the gate.

The template previews draw each: the curtains, podium and the stage's wood in the event previews (All-Hands Hall, Expo Hall,
Conference Venue, Festival Field; the Training Room's podium), the columns in the Hotel's, the pillars in the Expo Hall's, the pool
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
- Curtains that open and close, or a podium that grants the stage (who may speak from a stage is its Who Can Speak;
  the Podium only carries your voice further).
- A round or kidney pool (the pool is a rectangle; the Pond is the free shape).
