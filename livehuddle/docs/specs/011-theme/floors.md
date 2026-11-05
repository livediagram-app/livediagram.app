# Floors

A Space is somewhere you walk around as an avatar, so its canvas is a **floor**: carpet, floorboards, tiles, a lawn.
The floors replace the diagram papers livehuddle forked from livediagram with (the dot grid, graph paper, ruled lines,
the animated backdrops), which are listed in [Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-diagram-canvas-patterns);
livediagram keeps them all.

## Why

The owner (2026-11-05): the canvas options "are all great for other apps. But I'd expect things like Concrete, Grass,
Mud, Carpet etc instead for this app." A Space's rooms, furniture and avatars sit on the canvas the way they sit on a
floor, and a dot grid or graph paper reads as a drawing board, not a place.

## The floors

Fifteen choices, in the Canvas panel's order ([Tab Style dialog](canvas-and-theme-dialog.md#canvas-panel)): **None**,
then the indoor floors, then the outdoor ones. Nine fill the first carousel page on a desktop (None and the eight
indoor floors), so a page reads as indoors or outdoors.

| Floor        | Stored id      | What it is                                                                |
| ------------ | -------------- | ------------------------------------------------------------------------- |
| None         | `blank`        | No floor: the canvas colour alone                                         |
| Carpet       | `carpet`       | Soft cut pile: flecks of a darker, a mid and a lighter yarn               |
| Carpet Tiles | `carpet-tiles` | Office carpet tiles, 48 px, the pile turned on every other tile           |
| Wood Floor   | `wood`         | Oak planks, 20 px wide, in staggered rows, two grain lines each           |
| Parquet      | `parquet`      | Basketweave blocks: squares of three, each square turned against the next |
| Tiles        | `tiles`        | Square ceramic tiles, 48 px, each a touch different, on fine grout        |
| Marble       | `marble`       | Book-matched slabs, 192 px, fine wandering veins over a softer cloud      |
| Terrazzo     | `terrazzo`     | Chips of stone, brick and sage set in a pale ground                       |
| Concrete     | `concrete`     | Polished slabs, 240 px, soft mottling and aggregate, saw-cut joints       |
| Decking      | `deck`         | Outdoor boards with gaps between them and screw heads over the joists     |
| Stone Paving | `paving`       | Flagstones of mixed sizes in coursed rows                                 |
| Cobbles      | `cobbles`      | Rounded cobblestones in running rows, each with a soft highlight          |
| Grass        | `grass`        | A lawn: short blades in three greens over lighter patches                 |
| Sand         | `sand`         | Wind-rippled sand, each ripple with a lit edge, and a scatter of grains   |
| Mud          | `mud`          | Bare trodden earth: darker and lighter patches, small pebbles, grit       |

Each picker tile is the floor drawn for real, its name beneath, and a hover card saying what it is for.

## How a floor looks

- **Its own colours.** A floor is a material, so it brings its colours (grass is green, oak is honey) rather than
  inking the tab's pattern colour. Every floor has a **light** and a **dark** version; the canvas colour under it
  decides which (a dark canvas, as a theme's dark half paints, takes the dark floor), so a floor follows each viewer's
  half ([Light and dark halves](light-and-dark.md)) with no setting of its own.
- **Quiet.** A floor is a floor, not a feature: its tones sit a few percent of lightness apart, a light floor stays
  light (no tone darker than the gaps between deck boards) and a dark floor dark, so furniture, avatars and text read
  on top of any of them (`apps/editor/lib/floor-tiles.test.ts` holds both to bounds).
- **Seamless at every zoom.** Each floor is one tile; anything that crosses a tile edge is drawn again on the far
  side, or the edge is a joint where a break belongs (a slab, a tile, a plank's end). The tile lives in world space like
  every backdrop ([Canvas and palette](../008-canvas/canvas-and-palette.md) "Canvas"): it pans and zooms with the
  pieces, so a desk stays on the same floorboard.
- **Strength** (the tab's `backgroundOpacity`, the Canvas panel's Strength slider) fades the floor into the canvas
  colour under it: 100% is the whole floor, 0% the plain canvas. The canvas colour itself stays solid.
- **Size** (`backgroundPatternScale`, 50% to 200%) scales the tile, as it scales every backdrop.
- **Still.** Nothing on a floor moves, so reduced motion has nothing to stop.

## Stored data

- A floor is stored in the tab's `backgroundPattern`, beside None (`blank`) and the seasonal looks' motifs
  ([Seasonal looks](canvas-and-theme-dialog.md#seasonal-looks)). livehuddle's `BackgroundPattern` type holds the
  floors as its own patterns, so `isBackgroundPattern` and the api's OpenAPI `BackgroundPattern` enum take them.
- **Retired patterns open on a floor.** A tab saved with a diagram pattern loads on the floor nearest it in feel,
  from one table (`RETIRED_PATTERN_FLOORS`, `packages/document/src/floors.ts`):

  | Stored pattern                       | Opens on     |
  | ------------------------------------ | ------------ |
  | Grid (dots)                          | Carpet Tiles |
  | Graph, Isometric                     | Tiles        |
  | Engineering                          | Concrete     |
  | Lines                                | Wood Floor   |
  | Stripes                              | Decking      |
  | Crosshatch                           | Carpet       |
  | Diagonal                             | Parquet      |
  | Waves                                | Sand         |
  | Bricks                               | Stone Paving |
  | Checkerboard                         | Marble       |
  | Hexagonal                            | Cobbles      |
  | Confetti                             | Terrazzo     |
  | Flow, Drift, Aurora, Ripple, Ribbons | None         |

  The load migration (`migrateStoredTab`) rewrites the stored id, so every entry point (the api's tab read and
  thumbnail, the offline store, a file import, a tab that arrives from a peer or an api write) reads the floor. The
  canvas, the picker, the Looks' matching and the image export read a pattern through the same table
  (`spacePattern`), so a retired id that arrives after load (a peer on an older build) still draws as its floor, never
  as an animated backdrop.

- **An unset pattern** reads as the theme's own pattern always did: the built-in themes still name the dot grid
  (`grid`) or None, so a tab with no pattern of its own draws Carpet Tiles, or nothing on a theme with no pattern.
- **The Spaces templates** each lay their Space on a fitting floor (`packages/templates/src/template-canvas-overrides.ts`):
  Virtual Office and Training Room on Carpet Tiles, Coworking Space on Wood Floor, Team Pod and Focus Library on Carpet,
  All-Hands Hall on Parquet, Rooftop Bar on Decking, Cafe on Terrazzo, Garden Retreat and City Park on Grass, Company
  Campus on Stone Paving, Conference Venue on Marble and Startup HQ on Concrete. Blank Space takes the theme's floor.

## Rendering

- Each floor is a small SVG tile in a CSS `background-image` data URI, built on first use and cached (two per floor
  at most, plus a faded copy per strength in use), so a pan or zoom frame changes only the background's size and
  position, as every static backdrop did. No raster images, no SVG filters, no per-frame script.
- The image export draws the same tile into its SVG `<pattern>` (and the PNG/PDF raster), in the half the tab's canvas
  colour is in.

## Share roles

The floor is a tab setting like any other: an **Editor** picks it (in the Tab Style dialog or through a look). A
**Participant** or **Viewer** never reaches the dialog and sees the floor the tab wears, in their own half.

## Telemetry

Picking a floor fires the Canvas event it always did: `track('Canvas', 'Changed', <floor>)`, the floor's id with its
first letter capitalised (`Carpet-tiles`, `Grass`; None is `Blank`). The type is the floor, never content.
