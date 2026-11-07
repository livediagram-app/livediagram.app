# Office

Pieces that turn a canvas into a **virtual office** people walk around in [Avatar mode](../008-canvas/avatar-mode.md):
a **Room**, a **Meeting Table**, a **Plant**, a **Bookshelf**, a **Water Cooler**, a **Coffee Machine**, a **Rug** and
a **Stage**; an **Office Pod** for two; a bar (a **Bar**, a **Bar Stool**, a **Drinks Cabinet** and a **Drinks
Fridge**); and a garden (an **Outdoor Plant**, a **Tree**, a **Garden Path**, **Grass** and a **Garden Fence**).
With the [Chair, Desk and Sofa](chair.md), the [Fence](fence.md) and [speech bubbles](../008-canvas/avatar-mode.md#speech-bubbles),
a team can lay out reception, desks, a meeting room, a kitchen and a lounge, then sit, talk and grab a coffee together.
The [Social pieces](social-pieces.md) add a Notice Board, a World Clock, a Play corner (Jukebox, Ping-Pong Table,
Pool Table, Foosball Table, Arcade Machine, Dartboard, Fireplace), a Vending Machine, a Bean Bag and a Reading Nook,
and outdoor seating, a Fountain, a Pond and a Campfire for the garden.
The [Office amenities](office-amenities.md) add a Printer, a Copier, Lockers, a Coat Rack and an Umbrella Stand, a
kitchenette (Kitchen Counter, Kitchen Sink, Fridge, Microwave, Kettle) and a restroom (Toilet Cubicle, Washbasin, Hand
Dryer, and a Restroom room preset).
The [Venue pieces](venue-pieces.md) add Pillars and Columns, a Car Park and a Bike Rack, a Swimming Pool, and Stage
Curtains and a Podium for the Stage.
A meeting room gets a [Screen and a Room Sign](screen-and-room-sign.md) (the **Meet** category), and a busy room
or a closed pod can be [knocked on](../012-collaboration/knock.md).

## Why

Avatar mode gave people a body on the canvas, and the chair, desk, sofa and fence gave it furniture and edges. An
office needs places: rooms with doors to walk through, a table to meet round, the water cooler people drift to,
and enough plants and shelves that it feels like somewhere. Each piece is ordinary canvas content an author
places, so an office is drawn with the same tools as a diagram.

## Where they live

Shape kinds spread over three of the palette's Space categories ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)): `room`, `stage` and `rug` in **Rooms**
(with the fence), `meeting-table` in **Seats** (with the chair, desk and sofa), and `plant`, `bookshelf`,
`water-cooler` and `coffee-machine` in **Perks** (the Stage's tile from Work Tracker #319 part 4), where the
[Office amenities](office-amenities.md#where-they-live) group them under Office, Kitchen and Restroom. `office-pod`
joins **Seats**; `bar`, `bar-stool`, `drinks-cabinet` and `drinks-fridge` are **Play**'s **Bar** group (Bar
was a category of its own until 2026-11-06), and `outdoor-plant`, `tree`, `garden-path`, `grass` and `garden-fence` are
**Garden**'s **Plants** and **Paths and Fences** groups
([Groups in a flyout](../010-palette/palette-top-level-categories.md#groups-in-a-flyout)).
Every one is drawn from the room's camera like the furniture ([Chair](chair.md#facing)): upright, legs and
pots on the ground, a contact shadow below. Each is an ordinary element otherwise: move, resize, group, lock, copy,
theme, export. None has a settings `…`; a room's one setting, a stage's two and a table's are in the element menu.

## Room

Four walls round a floor, with a doorway, and the room's name on its back wall.

- **Drawn as a room seen from the front and above**: the floor in the element's fill, the back wall along the top
  showing its face (so it reads as a wall standing up, not a line), the side walls as bars, the front wall a low
  bar you see the top of. Walls are a fixed thickness however big the room, so a big room is a big floor, not
  thick walls.
- **The doorway is a Door.** A new Room comes with a [Door](room-builder.md#door) piece standing in the middle of
  its front wall: an element of its own on top of the room, so a click selects it (not the room under it), a drag
  slides it along the walls (onto any wall of the room, snapping as every Door does), and Delete removes it like any
  piece. The room itself stores `roomDoor: 'none'` and draws no gap of its own; the Door cuts the wall. Adding the
  room and its Door is one change: one undo takes both away. Every way a Room is added does this: a tap or a draw
  with the tile armed, a drop from the palette, and a template's rooms (`roomWithDoorPiece` in
  `@livehuddle/document`, which also stands a Door where a template asked for a doorway on another wall). Delete
  the Door for a closed room you reach only through a [Portal](portal-element.md); add more Doors for more ways in.
- **Older rooms keep their built-in doorway.** A room stored before this (`ShapeElement.roomDoor`: `'n' | 'e' |
's' | 'w'`, absent meaning the front wall `'s'`) still draws, walks and calls exactly as it did: a centred gap in
  that wall, 96 canvas px wide (narrower if the wall is short), leaving a character 72 px to walk through once the
  wall ends keep their reach, with a mat across it. Nothing is migrated: the stored room is left as it is, so an
  older client reading a new Space and a new client reading an old one both see the walls they expect (converting
  on load or on first edit would rewrite rooms nobody touched, and a half-converted room would have two doorways
  or none). Such a room's element menu still has the **Room** section (Top, Right, Bottom, Left, None) for its
  built-in doorway; a room with no built-in doorway (`'none'`, every new one) shows no such section, since its
  doors are Door pieces.
- **The name** is the element's label, on a plate at the left of the back wall: "Kitchen", "Meeting Room 2". A new
  room is called **Room**.
- **The walls block** walking exactly as a [Fence](fence.md#blocking) does: same reach, same slide along them, from
  either side; a Door (or an older room's built-in doorway) does not. A character inside a room with no door stays
  inside until it takes a portal.
- **It is private** while calls are on: everyone inside hears the people near them inside, by distance, and
  nobody outside hears them; the walls block sound as they block walking, and the doorway's threshold is the line
  of the walls ([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md#rooms-are-calls-part-1-built)).
- **Any shape, any doors**: the [Room Builder](room-builder.md) draws a room of any outline wall by wall, snapped
  to 45 degrees, and a [Door](room-builder.md#door) put on any wall of any room is another way through it.
- **It is the floor, not a destination**: standing in a room never rings it as the element you are on, and it is
  placed **behind everything** on the tab, so furniture dropped in it stands on its floor. Not aspect locked: a
  room is any shape of rectangle. Default 480 × 320.
- **Dropped, then sized.** A Room is added like a placed piece: with its tile armed, the room itself follows the
  pointer at its default size, and a click (or a press-and-drag, which places it where the press began) drops it
  there; there is no draw-to-size box (`dropsAtOwnSize`). Unlike a placed piece it keeps its resize handles, so it
  is sized after it lands. The [Room Builder](room-builder.md) keeps its own wall-by-wall gesture.
- **Rooms line up.** Moving, resizing, dragging in from the palette or placing an armed Room snaps it to its
  neighbours like any element (edges and centres, with the alignment guides), and also **wall to wall**: within the
  same snap distance, a room beside another lands on the other's wall line, so the two **share one wall** instead of
  standing two walls back to back (box edge to box edge leaves a double wall). Side by side the rooms overlap by a
  wall's thickness; one below another stands its back wall face on the other's front wall line. The guide is drawn
  along the shared wall line, spanning both rooms. A resize lands the moving wall the same way, its opposite wall
  staying put. When a shared-wall snap and an edge snap are both in range on an axis, the nearer wins, the wall on a
  tie. Custom rooms snap by their box only (their walls are not on it). Cmd / Ctrl places freely, as every snap
  ([Snap override](../008-canvas/snap-override.md)). (`snapRoomWalls`, `snapRoomWallsResize` in `@livehuddle/document`.)

## Meeting Table

A table with six chairs round it, every seat facing the table.

- Drawn upright from the room's camera: two chairs beyond the table (their sitters face you), two in front (their
  backs to you), one at each end in profile, and the table top between them with its front edge toward you.
- **Six seats.** A character walking into it sits on the seat **nearest where it arrived**, facing the table: the
  far chairs face down, the near chairs up, the left end right, the right end left. A seat takes one sitter, as
  any chair does: a taken seat is skipped for the nearest free one, and a full table stops you beside it
  ([Chair](chair.md) "Sitting").
- Who is sitting is presence, as for every seat: the table rings each taken chair in its sitter's colour
  (which seat rides their presence, `seat.index`) and names the sitters in a pill above it ([Chair](chair.md)
  "Occupancy is presence").
- **It turns** ([Turning furniture](furniture-facing.md)), its chairs with it. From behind it reads the same, each
  sitter now facing the other way. Turned to face left it is a tall table: the two chairs that were beyond sit down its
  right facing left, the two in front down its left facing right, and the end chairs at its top and its foot.
  Aspect locked. Default 232 × 168.

## Plant, Bookshelf

Scenery that **blocks**: a character walks round them, not through.

- **Plant**: a potted plant, leaves above a pot. Default 56 × 88. Its **footprint** (the pot, at the bottom of the
  drawing) blocks.
- **Bookshelf**: shelves of coloured book spines. Default 120 × 132. Its footprint (the bottom quarter, full width)
  blocks, so it stands against a wall and you walk along in front of it. Turned to face left it is narrow and long, its
  books end on down its left and its base blocking along its length; from behind, its plain back's boards.
- A footprint blocks as a fence round its edge does (same reach, same slide). It is solid: a character inside one
  walks out of it and never deeper in ([Fence](fence.md#blocking)). The upper part of the drawing never blocks: it is
  what stands up from the floor, and a character in front of it is drawn in front of it.
- Neither is a destination: walking up to one does not ring it.

## Water Cooler, Coffee Machine

Walk up to one and your character **gets a drink**.

- **Water Cooler**: a blue water bottle on a white cooler with a tap. Default 56 × 112.
- **Coffee Machine**: a coffee machine with a carafe, on a little counter. Default 72 × 96.
- **Turned**: the cooler shows its vent from behind and, facing left, its taps and drip tray down its left; the coffee
  machine shows its vents from behind and, facing left, its screen and carafe down its left, its mug at the near end.
- **Using it**: walking a character onto it (the same arrival as a chair or a portal) gives it a cup, **water** or
  **coffee**, held in its hand for **60 seconds**. Every 8 seconds it takes a sip (the arm lifts the cup for a
  moment). A coffee steams. Using it again, or the other machine, swaps or refreshes the cup. Sitting keeps the
  cup: coffee at your desk.
- The machine **answers** on your screen: bubbles rise in the cooler's bottle, the coffee machine drips into the
  carafe, for a second and a half, on the drawing its facing shows: the bubbles from every side, the drip wherever the
  carafe shows (not from behind).
- **Everyone sees your cup**: what you hold rides your avatar presence (`holding: 'water' | 'coffee'`), like
  sitting. Nothing is written to the document; leaving the mode puts the cup down.
- Neither blocks, so you can walk right up to it; standing on it is standing in front of it.

## Rug

A floor rug: an oval with a border, in the element's fill. Decoration that never blocks and is never a destination;
placed **behind everything** like a room, so it lies on the floor under the furniture. Rooms and rugs paint as
backdrops, the larger first, however they arrive (placed, drawn to size, pasted, written by an agent): a rug lies on its
room's floor, and a room never covers what stands in it. Default 200 × 120. Turned, it is the same flat pattern from
behind and lies the other way round on its side, its box's sides swapped.

## Stage

A raised platform for an all-hands: whoever stands on it is heard by the whole tab
([Meeting rooms and the stage](../012-collaboration/meeting-rooms-and-stage.md#the-stage-part-2-built)).

- **Drawn from the room's camera**: its top in the element's fill (a warm honey wood, deep brown on dark paper) laid
  in boards (faint plank lines with staggered joints), a darker nosing along its front lip, and a front edge 24 px
  tall you see the face of: a stained-wood skirt shaded with the stroke, with a row of warm footlights along it
  ([Venue pieces](venue-pieces.md#the-stronger-stage), Work Tracker #512). [Stage Curtains and a
  Podium](venue-pieces.md#stage-curtains-podium) pair with it.
- **The name** is the element's label, on a plate in the top's fill centred on the front edge, clear of the
  footlights. A new stage is called **Stage**.
- **A floor piece** like a rug: placed behind everything, never blocks, never a destination; a stage on a room's
  floor paints over the floor and under the furniture. Not aspect locked. Default 360 × 140.
- **Standing on it** is having your feet on its top; the front edge is off it.
- **Two settings**, stored on the element: **Who Can Speak** (`stageSpeakers`: `'edit'`, Editors, the default; or
  `'take-part'`, Editors and Participants) and **Show Cameras** (`stageCameras`, off by default). Absent reads as
  the default; anything else makes the element invalid. Set from the element menu's **Stage** section: two tiles,
  **Editors** and **Editors and Participants**, and a **Show Cameras** switch
  ([The stage's way in](../012-collaboration/meeting-rooms-and-stage.md#the-stages-way-in-part-4-built)).

## Office Pod

A booth for two, with a sliding glass door that **closes by itself when both seats are taken**.

- **Drawn from the room's camera** like a small room: a back wall with a window in its face, side walls, a front
  wall with a doorway in its middle, and inside two padded benches facing each other across a little table. The
  door is a glass panel that sits slid behind the right of the front wall while the pod is open.
- **Two seats**, one on each bench, the left sitter facing right and the right sitter facing left. Walking in
  through the doorway sits you on the free seat nearest where you came in, by the [Chair](chair.md) rules: one
  sitter a seat, a taken seat skipped, a full pod stops you beside it. Who sits is presence, never stored, and the
  pod rings each taken bench seat and names its sitters in a pill above it like the meeting table.
- **The door closes when two people sit in it**, and opens the moment either stands up or leaves. Every machine
  works it out from the same presence (both seats held), so everyone sees the same door. It **slides** shut or open
  over 0.6 seconds; under reduced motion it jumps to where it ends.
- **The walls block** walking as a room's do, on all four sides, so the only way in is the doorway; while the door
  is closed the doorway blocks too, and nobody else can walk in. The two inside walk out the moment one stands
  (the door opens for them).
- **It is a call of its own** while calls are on, like a room ([Meeting rooms and the
  stage](../012-collaboration/meeting-rooms-and-stage.md#rooms-are-calls-part-1-built)): the two inside hear each
  other and nobody outside hears them, door open or shut. A pod in a room is the innermost call, so it is private
  from the room around it.
- **It turns**, and its walls, doorway, door, floor and seats turn with it: the doorway is always in the wall its front
  faces. From behind the doorway is in the far wall, through its face, the benches swapped and the window wall nearest
  you; turned to face left the doorway is down its left wall (the right wall facing right), the far wall's face along
  its top and the benches across it, one under the far wall facing you and one against the near wall, its back to you.
  The door slides behind the wall beside the doorway, and the strip where you knock is outside the doorway wherever it
  faces. Aspect locked. Default 176 × 144.
- A call for one is the [Phone Booth](workday-pieces.md#phone-booth): one seat, no invite, a call of its own that
  shows Busy.

## Bar, Bar Stool

- **Bar**: a long counter with a dark top, bottles and glasses on a back shelf behind it, and a foot rail along its
  front. Default 240 × 120. Its **footprint** (the counter, the lower half, full width) blocks, so people stand at it
  and walk round its ends.
- **Bar Stool**: a round padded seat on a tall stem, with a foot ring. **One seat**, its sitter facing up the canvas
  (their back to you, toward a bar placed above the stools). Seat rules as the [Chair](chair.md): walk onto it to sit,
  one sitter, a ring in the sitter's colour and their name above it. It reads the same from every side, so it keeps its
  one drawing and turning it turns its sitter (Up, toward a bar above it, is its default). Aspect locked. Default 44 × 64. A stool tucked under the counter seats its sitter in the counter's footprint;
  standing up there, the character walks out of the counter toward its nearer side, never deeper in, so it is never
  stuck in the bar ([Fence](fence.md#blocking)).
- **The bar turns**: from behind, the bartender's side, its counter beyond with glasses under it and the back shelf
  nearest you, its bottles' necks over its top, the counter blocking; turned to face left it is long and narrow, the
  counter and foot rail down its left (blocking down its length) and the back shelf down its right, its bottles toward
  the counter.
- Neither has a settings `…`; the stool's sitters, like every seat's, are presence.

## Drinks Cabinet, Drinks Fridge

Walk up to one and your character **gets a drink**, as at the [Water Cooler and Coffee
Machine](#water-cooler-coffee-machine).

- **Drinks Cabinet**: a wooden cabinet with glass doors and bottles on its shelves. Walking onto it gives a **juice**
  (an orange cup). Default 88 × 120.
- **Drinks Fridge**: a tall glass-fronted fridge of coloured cans. Walking onto it gives a **soda** (a red cup).
  Default 72 × 128.
- **Turned**, each shows its plain back from behind (the fridge's cooling grille low down) and, facing left, is tall and
  narrow, its front cheated down its left: the cabinet's glass doors and bottles over its drawers, the fridge's glass
  and cans under its lit header.
- The drink is held, sipped and seen by everyone exactly as water or coffee (`holding: 'juice' | 'soda'`), for the
  same minute; it never steams.
- Neither blocks, so you walk right up to one; neither plays an answer.

## Outdoor Plant, Tree

Garden scenery that **blocks** like the [Plant](#plant-bookshelf):

- **Outdoor Plant**: a round leafy shrub in a stone planter, a few flowers in it. Default 72 × 80. Its footprint (the
  planter) blocks.
- **Tree**: a trunk under a full round canopy, a soft shadow on the ground. Default 120 × 160. Its footprint (the
  base of the trunk) blocks, so a character walks round the trunk and passes in front of the canopy; the canopy
  never blocks.
- Neither is a destination.

## Garden Path

Stepping stones laid in a gravel strip: a **floor piece** like a [Rug](#rug), placed behind everything, never blocks,
never a destination. Drawn to its size like a room, so a path is stretched to any length without the stones
stretching. Not aspect locked. Default 240 × 64. The gravel takes the element's fill (a warm sand when unstyled).

- **Whole stones only.** The stones run along the longer side, the same size however long the path, spaced evenly
  between two insets: every stone stays at least 0.7 of the path's width in from each end, so the first and last are
  whole and the rounded ends are bare gravel. A path too short for two holds one stone in its middle. However the
  path is stretched, no stone is ever cut by its own edge.
- **Round when about square.** A path whose longer side is at most 1.25 times its shorter is a **plaza**: a round
  paved patch filling its box, a kerb round the rim, a ring of setts inside it and an open middle for a fountain or a
  statue. Placed where paths meet, a small one reads as a junction; a large one is a square to gather in.
- **Joining paths.** A path that meets another ends under it: its rounded end lies on the other's gravel (the
  other path or plaza drawn over it), and its stones, kept back from its end, stop at the other's edge, so a junction
  never shows one path's stones under another's. Paths never cross: where two would, a plaza is the junction.
- **Nothing on the stones.** In a template no piece stands on a path's stones and no path runs under a piece, a
  plaza's open middle aside (the template guard test).

## Grass

A patch of lawn: a **floor piece** like a [Rug](#rug) and the [Garden Path](#garden-path), placed behind everything,
never blocks, never a destination. Drawn to its size like a room, so it is stretched to any width and height: a soft
rounded green area with a fine tuft texture that repeats as a pattern tile, so a large lawn looks the same close up as
a small one and costs the same to draw (no per-blade drawing that grows with its size, no filters). Not aspect locked.
Default 240 × 160. The lawn takes the element's fill (a fresh green when unstyled, a deep green on dark paper).

## Garden Fence

A low white picket fence: a short run of pointed pickets on two rails, drawn to its size along its longer side like
the [Fence](fence.md). It **blocks walking exactly as a Fence does** (the same line along its run, the same reach and
slide), so a garden fence and a fence join up into one barrier. Not aspect locked. Default 200 × 28. Unstyled it is
white with the theme's stroke round each picket.

## Share roles

- **Editor**: places, moves, renames, recolours and deletes every piece, a room's Doors included; sets an older
  room's built-in doorway and a stage's Who Can
  Speak and Show Cameras.
- **Participant**: has no palette, so it places none; walks, sits and drinks like everyone.
- **Viewer**: walks, sits and drinks like everyone (all of it is presence, which a Viewer has).

## Telemetry ([Telemetry](../017-telemetry/telemetry.md))

- Placing one: `Element · Added · <Kind>` (`Room`, `Meeting-table`, `Plant`, `Bookshelf`, `Water-cooler`,
  `Coffee-machine`, `Rug`, `Stage`, `Office-pod`, `Bar`, `Bar-stool`, `Drinks-cabinet`, `Drinks-fridge`,
  `Outdoor-plant`, `Tree`, `Garden-path`, `Grass`, `Garden-fence`: a hyphenated kind keeps its hyphen, as every element's
  token does).
- A room's doorway changed: `Element · Changed · Room`; a stage's Who Can Speak or Show Cameras: `Element · Changed ·
Stage`.
- Getting a drink: `Canvas · Used · WaterCooler`, `CoffeeMachine`, `DrinksCabinet` or `DrinksFridge`. Never who, never
  how often in a session.

## Not in scope

- Doors that open and close, or that lock, on a Room (the Office Pod's door is the one door that moves, and only by
  who sits in it).
- Day and night in the garden, weather, or seasons.
- Light switches, day and night, or sound.
- Tables of other sizes (a four- or eight-seater). Chairs round any table do this today.
- Anyone else using your drink, handing a cup over, or drinks that run out.
