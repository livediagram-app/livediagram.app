# Furniture art style

Status: **approved** (owner, 2026-11-17). Every piece of a Space, in the flat plan, in the 3D view and in an export,
is drawn in **one shaded illustration style**: real materials lit from above, soft contact shadows, and each edge in a
deeper shade of its own material. The characters are out of scope here; they get their own redesign.

## Why

Pieces were drawn as flat colour inside one dark outline, and the seating was a translucent wash of the theme's
stroke. Chairs and sofas read as grey placeholders beside a colourful jukebox or fireplace, the floor showed through
appliances, and nothing looked like the thing it is. The owner asked for one cohesive, more realistic style, the same
in 2D and 3D, with nothing taken away: every piece keeps its drawings, facings, seats, live faces and walk-up moments.

## Light

- **Light falls from above the room's camera.** A top surface is lit at its far edge and turns a touch darker toward
  the floor. A face toward the room sits in shade, deepening toward the floor.
- **Edges are the material's own.** Wood is edged in dark wood, fabric in dark fabric, plaster in grey plaster, never
  one ink for everything. The edge is finer than before, so pieces stay crisp when small.
- **Shadows are soft.** A piece's contact shadow fades out from its centre instead of being a flat ellipse.
- **Highlights catch the light.** A thin glint runs along the lit edge of cushions, desk tops and table tops.

## Materials

What a piece is made of keeps its colour whatever the theme; the theme still colours lines, screens and patterns.

- **Seating is upholstered.** A Chair, Desk, Sofa and Meeting Table (and its Long Table) are upholstered in their
  kind's fabric: a soft blue for a Chair and a Sofa, charcoal for an office chair at a Desk and round a Meeting
  Table. A piece's own fill recolours its upholstery and never its wood or metal.
- **Frames are wood and steel.** A Chair has a wooden frame and legs; a Desk a wooden top on steel legs; a Sofa
  wooden feet and a throw pillow; a Meeting Table a wooden top, notebooks at each place and a jug of water.
- **Machines are appliance white, shelves are wood.** A piece with no fill of its own takes its kind's material:
  wood for a Bookshelf, Drinks Cabinet, World Clock and Notice Board, stone for a Pillar and Column, concrete for an
  Outdoor Plant's planter, and a solid appliance white for everything else, so the floor never shows through.
- **Colours are natural.** The fixed palettes are tuned from bright primaries toward natural tones: leaf greens,
  terracotta, oak and walnut. Each piece keeps its hue.

## Rooms

- **Walls are plaster** with a darker edge, a shaded face on the back wall and a wooden skirting at its foot. A Room
  Builder room and a Corridor have the same plaster walls.
- **Floors are boards.** A room's floor stays the element's fill, with the faint seams of hardwood boards laid over
  it: a line between each row and the boards' ends staggered, and a soft shadow at the back wall's foot.
- **The 3D view matches.** Standing walls are the same plaster with the same skirting; on a dark canvas they are the
  same walls in evening light.

## What stays the same

- Every drawing's facings, grid, seats, occupied ring and part order, so sitting, rings, name pills, moments and
  turning work as before (furniture-facing.md, chair.md, piece-moments.md).
- The export draws exactly what the canvas draws.

## Performance

Each drawing writes one gradient per material it uses (three or four for most pieces), not one per part, and a room's
floor boards are a single path however big the room. Measured walking in 3D through the Virtual Office (1440p, 144 Hz):
681 frames, p50 6.9 ms, p95 8.6 ms, none over 20 ms, the same as before the change.

## Out of scope

- The characters (a separate redesign).
- Per-theme material palettes: materials are the same on light and dark paper, as real objects are.
