# 3D view

Status: **implemented** (Work Tracker 1043). Drawn as real 3D ([Real 3D](3d-engine.md)); what this page says the
view does (the camera, turning, cut-away) stays.

**The Space is always 3D** (the owner, 2026-11-27: "remove the 2d mode entirely, 3d always, same with rotation, remove
the setting, leave it always on"): there is no flat plan, no 3D View switch, no Shift+3 and no setting. The **3D View**
tilts the Space back like Apple Maps' 3D: a perspective camera looks down at the
floor at an angle, the walls of Rooms, Corridors and Fences stand up with their doorways cut in them, and
every character stands upright on the floor. It is a way to see the Space as a place rather than a plan; it changes
nothing on the board and nothing anyone else sees.

The owner (2026-11-15): a 3D view like Apple Maps, the Space tilted back with walls up, not an isometric angle, and
not laggy.

## What it shows

- **The tab's background lies on the floor**: its colour and its pattern (dots, a grid, a floor) are laid on the
  floor under every piece, so they tilt and turn with it, around you as far as the walls are drawn; past that the
  background's colour carries on to the horizon (the owner, 2026-11-18: "in 3d mode I seem to lose the canvas
  background").
- **The floor** is the board as it is drawn flat (rooms' floors, rugs, furniture, stickies, text, everything), tilted
  back about the middle of the screen with perspective: what is nearer the top of the screen is further away and
  smaller. What covers the floor stays on it: rugs, grass, garden paths, ponds and pools, the Car Park,
  stairs, Avatar Pads, stickies, text and everything that is not a piece of the Space.
- **The walls stand up**: every line a character cannot cross because it is a wall (a Room's walls, a Corridor's walls, a
  Fence's and a Garden Fence's run) rises from the floor as a wall face. They are the same
  lines the walk is stopped by ([Avatar mode](avatar-mode.md) "Finding the way"), so what you see standing is exactly
  what blocks you.
  - **Doorways are framed.** A Door standing on a wall ([Room builder](../009-elements/room-builder.md#door)) cuts it,
    and stands in its gap as a doorway: a dark wooden frame with a lintel of plaster over it, so the way through reads
    from across the room (the owner, 2026-11-17: "the doors should be more visible"). In a glass wall the panel over
    the frame is glass, as the wall is, never plaster, and the door is a glass door: a slim pale metal frame and a
    leaf of glass with a bar handle (the owner, 2026-11-18). The plan's flat leaf and swing arc give way to the door's
    own model, one per [door type](../009-elements/room-builder.md#door-types), so each type reads as itself (the
    owner, 2026-11-27: "doors only seem to be one type"):
    - **Door**: one leaf with two raised panels and a brass handle (glass with a bar handle in a glass wall),
      swinging up to 85 degrees out of the wall at its hinge, the side the plan's swing shows.
    - **Double Door**: two leaves hinged at the jambs, each glazed above a raised panel, meeting in the middle
      shut and swinging apart, both to the plan's side.
    - **Sliding Door**: two glass panels in slim metal frames hanging from a metal track along the head, meeting in
      the middle shut and sliding apart into the wall either side, each its own width.
    - **Revolving Door**: a glass drum (two curved glass walls, open toward each side of the wall) under a round
      metal canopy, with four glass wings on a centre post. The wings turn while anyone is near and come to rest
      squared, two of them along the wall line.
  - **Doors open on their own.** Every door stands shut and opens as a character comes near it, then closes behind
    them ([Room builder](../009-elements/room-builder.md#opening-on-their-own): within 80 canvas px of its opening,
    open over 350 ms, closed 600 ms after the last one leaves, over 500 ms). Every character this view draws opens
    doors (yours, peers', the Receptionist), and in edit mode too, so a door opens for whoever walks through it as
    you watch. It is this view's own drawing: no write, nothing sent. Nobody can open or shut a door by hand; a
    click on a door walks you there as a click on the floor does. Under reduced motion a door jumps open and shut.
  - **Windows are windows.** A Window on a plaster wall ([Room builder](../009-elements/room-builder.md#window)) is
    cut out of it and stands in it as a window: plaster below its sill and over its head, a painted frame with a
    transom and a mullion, and glass catching the light (night on a dark canvas). A glass room's walls are glass
    throughout, so a window on one adds nothing. (The owner, 2026-11-17: "the windows don't look like windows".)
  - **Wall pieces hang on the wall.** A Notice Board, Clock, Dartboard, Calendar Wall, Photo Wall, Hand Dryer,
    Screen and Room Sign placed against a room's back wall (its top within 64 px below the wall's line, or a wall
    running within 24 px of its foot, its middle along it) hangs on that wall: upright in the wall's plane, its foot 10 px up it, drawn small enough to stay inside
    the wall with 12 px of wall over it (the owner, 2026-11-18: "items placed on them like screens and bookshelfs etc
    don't go higher than the wall"). A Screen fills its wall: as wide as the wall run it hangs on, 16 px clear of each
    end, as tall as the wall allows (the owner: "as large as possible on that wall"). One with no back wall near stands where it is, as any piece. (The owner, 2026-11-17: "not just
    floating in the air".) With the camera turned, a hung piece stands out from its wall facing the camera, as a
    blade sign does, so its words still read. Wall pieces are only ever placed on a wall
    ([Wall pieces](../009-elements/wall-pieces.md)).
  - **Fences stand as fences**: a Fence's run stands as wooden rails and posts, a Garden Fence's as white pickets on
    two rails, the picket fence its flat drawing shows. Each has a thickness (a Fence 8 canvas px, a Garden Fence 6):
    its far side stands that far back with a cap along the top, so a fence seen end on, turned or running away from
    the camera, still reads as a fence rather than a hairline (the owner, 2026-11-25). Lower than a character, a fence
    is never cut away as you walk along or past it, as grass is not. A Window's flat frame and sill give way to the standing one,
    leaving only its light on the floor (the owner, 2026-11-18: windows "leave a line along the floor line"). A fence's flat drawing on the floor is hidden while the view
    shows (as a room's flat name is), so the fence is never drawn twice, once standing and once lying under it (the
    owner, 2026-11-17: "what is the white stuff under the garden fences").
  - **Heights**: a Room or Corridor wall is 152 canvas px, as tall as the tallest piece that stands against a wall
    (a Toilet Cubicle), so a bookshelf, a fridge or lockers never rise over it; an Office Pod is a booth, its walls a
    little over a character (73) and of glass, so you see who meets inside (the owner, 2026-11-27: "Meeting pods should
    be glass walls"); a Fence is a low run (22 canvas px); a doorway's opening is 96, under a 56 px lintel.
    A window sits in the middle of its wall, a fifth of the wall over it and a third under it.
  - **Glass rooms** ([Office](../009-elements/office.md#glass-walls)) stand up as glass: a pale, see-through face.
  - **Lit from the front**: a wall facing the camera is lightest, one running away from it darker, so the corners
    read without outlines. Each wall has a lighter top edge, its thickness seen from above.
  - **A room's name stands over its door**: the Room's label (the name that sits in its back wall's face in the
    flat plan) is a small sign on each doorway's lintel, where no piece on the wall covers it (the owner, 2026-11-18:
    "put the room names above the door, not on the back wall - which may be covered by elements"). A room no Door
    leads into keeps it on its back wall; one drawn with the Room Builder on its furthest wall that faces the camera. Its flat name on the floor is
    hidden while the view shows, so the name is never written twice. With the camera turned so the wall runs away
    from it, the name stands out from the lintel facing the camera, a blade sign over the door, so it always reads
    (the owner, 2026-11-18: "text on the room signs above the door is rotated").
  - **The plan's walls give way to the standing ones** (the owner, 2026-11-18: "one wall of every room ... is a
    different size" and "weird bits of wall poking out the back"): the flat plan's wall tops and the back wall's deep
    face are hidden while the view shows, with plain floor under the back wall's face, so every wall stands the same
    height and nothing flat pokes past them from any side the camera turns to. A glass room's flat panes and frames
    give way the same. The plain floor stops at the back wall's line, so a turned camera never sees the room's floor
    carry on outside its wall (the owner, 2026-11-18: "the floor outside the room continues the rooms floor"). A room's side walls end at its back and front walls, never past them (the owner: "the sides
    are going further than the back wall").
- **A stage stands up** (the owner, 2026-11-18: "stage should have some height, depth when i stand on it"): a
  Stage's top rises 20 canvas px on four sides of dark wooden boards under a lit lip, and what stands on it (a
  character, a Podium) stands on its top; in real 3D the whole box is the deck, a platform with steps up at its front
  ([A Stage is a platform](3d-engine.md#a-stage-is-a-platform)). Stage Curtains stand along their own line, as a wall does, so a turned
  camera sees them edge on or from behind, never swung in front of the stage.
- **Rooms on grass have roofs** (the owner, 2026-11-18: "a roof like a house, but sloped ... Only for rooms on grass"):
  a Room whose middle stands on Grass is a house, so a hipped roof sits on its walls, rising from all four of them
  (the owner: "roof should come up from all sides") to a ridge along the room's long side, every slope tiled, at about 35 degrees and never more than 150 canvas px over
  the wall tops. It is a ghost, like the walls in front of you (half see-through), so it never hides anyone, and it
  fades away while you stand inside that room. A **glass room** on grass has a **flat glass roof** instead, the
  same glass as its walls, lying on its wall tops (the owner, 2026-11-25: "a glass roof as its glass walls, not
  sloping, just a flat glass roof"), and a room drawn with the Room Builder has a flat roof the shape of its outline
  (glass for a glass room, tiled otherwise), since a hipped roof needs four walls. A room on any other floor is a room
  inside a building and has none; a turned room has none either.
- **The pieces stand up** (the owner, 2026-11-17: "none of the furniture and items are 3d, they remain 2d
  in 3d mode"): every piece of the Space drawn upright in the flat plan (furniture, seats, desks, tables, plants and
  trees, machines, shelves, signs, screens, boards, portals, everything with legs or a pot on the ground) rises from
  the floor about its front edge and faces the camera, as the characters do, so a bookshelf stands as a bookshelf
  and a plant as a plant rather than lying squashed on the floor. Its drawing is the flat plan's, unchanged: the
  pieces are already drawn from the characters' camera, so standing them up is all the 3D they need. See
  [Pieces stand up](#pieces-stand-up).
- **Grass pokes up** (the owner, 2026-11-17: "shouldn't the grass be poking up slightly in 3d"): a lawn stays on
  the floor, and rows of thin green blades 7 canvas px tall stand across it every 22 canvas px, inside its rounded
  edge, so a lawn reads as grass from the side. Too low to hide anyone, the blades are never cut away. No blade pokes
  up through what lies over the lawn: a row stops at a Room's, Corridor's or Office Pod's floor, a Garden Path, a Rug,
  the Stage, a Pond, a Swimming Pool, the Car Park, Stairs or an Avatar Pad, and carries on past it (the owner,
  2026-11-17: "the grass now comes through the room floors").
- **The characters stand upright**: yours, every peer's and the Receptionist, each turned to face the camera
  (billboarded) about their feet, so they stand on the spot they walk on, in their four facings, walking, sitting and
  hopping. Their name chips and status chips ride with them, upright and readable.
- **The office dog trots on the floor** (the owner, 2026-11-18: "the dog flies into the air and goes through the
  floor"): asleep it lies in its Pet Bed as the bed's drawing shows it; out of its bed it walks on the floor itself,
  standing up about its own feet as a character does, however far it trots from the standing bed. It walks at a
  steady pace along a route round the pieces in its area (the walking grid characters use), never through them, and
  never jumps: it carries on from where it stood when the view changes or the tab comes back, and walks home to its bed
  before it naps (the owner, 2026-11-18: "transport back to his bed or to random nearby places" and "he also shouldn't
  walk through objects, but around them"). The scene draws it as a 3D model curled in its bed or trotting on the
  floor ([Real 3D](3d-engine.md) "The office dog").
- **Sitters are drawn over their piece**: a sitter on a chair, a sofa, a bench or
  either side of a table stands just in front of the standing piece. One sitting behind it (further back than 60 % of
  its depth: a table's far side, behind a desk turned to face you) has their legs hidden under its front, so they read
  as sitting behind it, never hidden by it or sitting on the floor (the owner, 2026-11-17). A seat that is the piece
  itself (a chair, a bar stool) never hides its sitter, whichever way it faces (the owner, 2026-11-25: on a bar stool
  turned away, "I can't see the left half of my body"). A piece that closes round its sitter (a Phone Booth, a Toilet
  Cubicle, a Nap Pod) seen from behind hides the whole of them, and only their name and status show over its top (the
  owner, 2026-11-25: "my head pokes out").
- **A name or status chip sits just over the head as drawn** (the owner, 2026-11-27): the chip faces the camera
  while the figure stands upright, so seen from above the figure looks shorter by the sine of the tilt; the chip comes
  down by that difference, at every tilt.
- **What floats above heads stands up with them**: speech bubbles, the talking bars, raised hands and camera and
  screen bubbles turn to face the camera about the same feet, so they stay over the head they belong to. They are
  drawn over the whole scene, so no wall ever hides one, however near the wall the speaker stands; the Receptionist's
  card too, which in 3D always stands over his head, never under his feet. Their words are **sharp**: each is drawn
  flat on the screen, moved and scaled to where the camera would stand it, following the tilt
  as the view turns, rather than drawn through the camera's perspective, which softened every letter (the owner,
  2026-11-17: "text like the receptionist chat looks blurry in 3d"). So turning the view in and out, they stay over
  their speaker on every frame.
- **What lies on the floor stays on it**: the hearing ring, the "you are here" ring, an Avatar Pad's arrival beam.
- **The horizon**: past the floor the background's colour fades into a soft horizon along the top fifth of the
  screen, faint past its first half so what stands at the back of a room (a bar and its stools) stays crisp (the
  owner, 2026-11-18: "bar stools look blurry in 3d"). The tab's pattern lies on the floor with its colour ("The tab's
  background lies on the floor", above).

## Pieces stand up

- **Which pieces**: every shape kind of the Space that is drawn standing (`standsIn3D` in the blueprint). Floor
  coverings lie flat: the Room and Corridor (their walls stand instead), Fences (theirs too), Doors and
  Windows (part of a wall), the Rug, Grass, Garden Path, Pond, Swimming Pool, Car Park, Stairs and Avatar Pad,
  and the board's controls (Mode Button, Focus Button, Timer, Stopwatch), icons and stickers. Every other element
  (stickies, text, cards, pictures, charts) is the floor's. An **Office Pod's furniture stands up inside
  its walls**: its walls stand as a room's do, and each of its benches, and its table with its mug, stands up about
  its own front edge and middle, as a piece does (the owner, 2026-11-25: the far bench was "floating in the air, its
  not connected to the ground" while they all stood about the near one; and a turned camera turns each piece where
  it stands, the seats staying where they are rather than swinging round the pod's middle), so the booth's inside reads as furniture rather than a floor plan (the owner,
  2026-11-17: "I meant the furniture inside"). Its sitters are drawn over its benches.
- **Tables are built, not stood** (the owner, 2026-11-18: "the chairs are floating in the air, they need to still be
  connected to the ground but look 3d"): a Meeting Table, a Long Table and a Picnic Table are not stood up as one
  drawing, which hung their far chairs and far bench in the air over the table. Each chair stands up about its own
  feet, where it stands on the floor; a table's top and a bench's seat lie level at their height, held up by their
  front edge and legs, which stand from the floor to it. So every chair and leg meets the floor, the far chairs stand
  behind the table, and its top is seen from above as a table's is. A sitter sits at the chair or bench they are on:
  on the far side the table hides their legs and they look over it, on the near side they sit in front of it.
- **Cars stand in their bays** (the owner, 2026-11-18: "cars aren't 3d"): a Car Park's tarmac, lines and kerb lie
  on the floor, and each car stands up in its bay about its wheels, nose, tail or side to the camera as the facing
  draws it, its shadow on the tarmac.
- **About its front edge**: a piece turns up about the bottom edge of its box, the line its legs, base or pot stand
  on, and faces the camera. Being no taller than its box is deep, it never leans back past its own footprint, so a
  piece against a wall never pokes through it. A turned piece (one with a rotation) stands about its middle instead.
- **In the scene**: pieces, walls and characters are sorted by depth together, so a character behind a desk is
  hidden by it, one in front of a bookshelf stands over it, and a piece behind a wall is hidden by the wall (unless
  the wall is cut away in front of you).
- **Against a wall**: a character stands up about its feet facing the camera, so it leans back from them, and a wall
  just behind its feet (as the camera sees it, within the figure's height and chip) cut through it: a peer or the
  Receptionist standing in front of a room's wall showed only their feet. Standing there, a character is drawn towards
  the camera by its whole height and chip (the sitter's `--space-seat-lift`, as the Receptionist behind a desk is), so
  it stands whole in front of the wall. Only walls taller than a character count, never a fence, the grass or a stage
  (`apps/editor/lib/space-3d/space-3d-wall-lift.ts`).
- **Standing at a piece** (a Treadmill's belt, a Standing Desk) is drawn as sitting near its front is, in front of
  it, so the piece never covers you (the owner, 2026-11-18: "I seem to be hidden behind it"); one standing behind
  theirs (a Podium's speaker) has their legs hidden under its front.
- **Taking a seat is one frame**: the step towards the camera a sitter takes lands with them, never eased in after,
  so no frame shows them inside the chair (the owner, 2026-11-18: "I see a few frames of clipping").
- **Sitting**: a character sitting near a piece's front (a chair, a sofa, a bench, a table's near side: feet within
  60% of the piece's depth of its front edge) is drawn in front of the piece; one sitting further
  in (behind a desk, on the far side of a table, with a chair's back towards you) sits behind the piece's front, so
  the desk, the table or the chair's back hides their legs as it would.
- **A desk's screen lights while someone sits at it** (the owner, 2026-11-27: "When I sit down at a desk with a screen
  the screen should activate when I am there"): each sitter lights the screen of the one desk nearest their feet,
  within 34 canvas px of its footprint, and it goes dark as they stand.
- **Clicking a standing piece** clicks that piece, wherever on its drawing the press lands: a
  press over a standing piece finds the nearest piece drawn under it before the floor.
- **It animates** with the tilt: the pieces rise as the walls fold up, and lie back down as the view flattens.
- **Only near pieces stand**: the pieces in the view area (the walls' area, "Performance") stand; the rest lie flat
  in the distance, under the horizon's fog, and rise as the view comes near.

**Walls are finished** (the owner, 2026-11-27: the walls were "plain"): a wall stands on a skirting board, proud
of both faces, and is topped by a capping strip a shade lighter than its top; a window has a sill standing out both
sides and a white frame all round its glass, split down the middle by a glazing bar when it is wider than 40 px. A
picket row stands as fewer, broader pickets than the plan draws (one every 12 px on two rails), so it never shimmers
as the camera moves.

## Walls in front of you are cut away

A wall between the camera and your own character would hide you, so it fades out: any wall across the view (a side
wall running towards the camera never hides you and never fades: the owner, 2026-11-27, saw a room's left wall drop
"for no reason") with a part closer in front of your feet
(towards the bottom of the screen) than the floor it hides, and within 72 canvas px of them to either side. The floor a
wall hides is its height as it stands (its built height times the walls' rise, `WALL_RISE`) times the tangent of the
camera's tilt from straight down: about 233 canvas px for a Room's wall at the resting 52 degrees, less for an Office
Pod's lower walls, deeper as a right-drag lowers the camera (QA, 2026-11-27: at a fixed 150 px, the Lounge's back wall
hid half the pad and your feet as you arrived). Such a wall is cut down to a low wall while you stand there, each piece of it on its own: a door or a window splits a side into separate walls, and only the pieces in your way go (the owner, 2026-11-27: "doors and windows should cause walls to be split into separate objects"), and it comes back as you walk away (the owner, 2026-11-27: a
see-through slab across the screen was janky). Cut down, it stands 14 canvas px high with its top capped in the wall's
top colour, as a doll's house is drawn: everything in it above that height (windows, lintels, door leaves, glass) is
cut at the same line, so an open door's leaf is a low stub still swung open (or slid, or turned), never
folded shut, and it keeps moving as characters come and go (the owner, 2026-11-18: "it should remain open"). What
hangs on it (a Screen, a Poster, a Clock, a Notice Board, any piece that only mounts on a wall, but not a Fireplace or
a Bookshelf, which stand on the floor) goes with it while it is down and comes back as it grows back, so nothing is
left floating where the wall stood (QA, 2026-11-27: the City Townhouse's Screen hung in mid-air over the cut-down
wall). It fades out as its low cut-down copy fades in, and back, over 0.32 s, never squashed (the owner, 2026-11-27: "a simple fade would be less jarring"). Fences and picket rows lower than that
stay as they are. Only your own character cuts
walls; peers behind a wall are hidden by it, as people are.

**Rooms open up as you come near** (the owner, 2026-11-18: "when I am in a room, the wall(s) facing me in that room
should be hidden" and "when I walk near that room, so I can see what is inside and maybe choose to enter it"): while
your feet are inside a Room or Office Pod, or within 96 canvas px of its walls, its walls on the camera's side (its
front wall, as the camera is turned, with the doorways and windows in it) are cut down the same way, so you see the whole
room.

## Arriving

- **Arriving on a tab starts from the whole Space** (the owner, 2026-11-27: "when I load into a tab, can you make it
  start really zoomed out and then after half a second zoom in smoothly to my character. This way I get a feeling for
  where things are"). Opening a Space walking, a load or a reload into a tab, a change of tab and travel to another
  tab first frame the whole tab (the board's content, as Fit frames it, no closer than the walking zoom and no
  further out than the zoom range's 10%), hold that for half a second (`INTRO_HOLD_MS`, 500 ms), then zoom in over
  1.4 s (`INTRO_ZOOM_MS`, ease-in-out) to where the arrival would have landed: your character in the middle at the
  walking camera's 3D zoom. The zoom changes evenly (it is eased in log space, so each moment doubles or halves it at
  the same pace) and your character slides in a straight line on screen to the middle, so the eye stays on it as the
  Space grows round it.
  - **Any input stops it where it is**: a press, a wheel, a key, a pinch or a touch. The view stays as it then is, as
    if you had zoomed there yourself; the walking camera takes over from your next step.
  - **Not when it would show nothing new**: a tab whose content already fits at the walking zoom (less than a quarter
    closer, `INTRO_MIN_RATIO`) lands at once. So does Edit, whose arrival is the fit itself, and a tab with no
    character to zoom to.
  - **Reduced motion lands at once**, on the end view.
  - Switching to Walk on the tab you are on still glides in over the Edit | Walk morph, without the overview.
  - While it plays, the drawn area (below, "Performance") stays the one chosen for the whole Space, and is chosen again
    once it ends, so the zoom re-renders nothing but the view.

## Fit frames the Space as it stands

Fit to Screen in Edit and the arrival's overview frame the whole tab as the tilted, turned camera shows it, not as the
flat plan lies (QA, 2026-11-27: Fit cropped the left and right of Rooftop Bar, Virtual Office and Company Campus):
the perspective widens the plan's near edge and the walls stand up over its far edge, so the fit takes the box of
every boxed element from the floor to the top of a Room's wall as it stands (`SPACE_WALL_HEIGHT` x `WALL_RISE`),
projects its corners through the camera at the tilt and turn now, and finds the zoom and centre that put that
projected box in the middle of the canvas, inside its padding, at no more than 100% (`fit3DView`,
`apps/editor/lib/space-3d/space-3d-fit.ts`). The padding top and bottom is the flat fit's (the strip's depth, at
least 60 px); on a canvas narrower than 640 px (a phone) the sides keep only 16 px, so the Space fills the width
(QA, 2026-11-27: at 390 x 844 the Space fitted very small, the strip's depth taken off each side too).

## The camera

- **It looks down at 52 degrees from straight down**, with a perspective of 1100 screen px: the angle of a map
  tilted back, not of an isometric drawing (which has no perspective and is turned 45 degrees).
- **It tilts about the middle of the screen**, which is where the walking camera keeps your character
  ([Avatar mode](avatar-mode.md) "The camera"), so you stay centred as the view tilts and as you walk: every step
  moves the floor under you.
- **Zoom**: the zoom controls, the keyboard, a wheel and a pinch zoom about your character,
  walls and characters growing with the floor.
- **Click or tap a spot on the floor to walk there**: the press is traced back through the camera
  to the floor point under it. A press above the horizon finds no floor and walks nowhere. Arrow keys steer by the
  screen (up is away from the camera).

## Turning the camera

The owner, 2026-11-18: "quarter turns is fine". You can walk round to see the other side of the room.

- **Always on** (the owner, 2026-11-27), with no setting: the old Rotate in 3D View preference is gone.
- **Turn Left and Turn Right** are the left and right of the view dial (below) on a desktop and two buttons in the
  bottom-right cluster on a phone, and `[` and `]` in Edit or Walk do the same, with the action keys' guards. Each turns the camera a quarter turn about
  your character, over the tilt's 520 ms ease; turning on past a full turn keeps going round, never back.
- **Right-drag turns it freely** with a mouse (the owner, 2026-11-27: "on desktop with a mouse when I right click and
  pan I want it to free rotate"), in Edit or Walk: dragging right turns the floor the way your hand moves at the
  bottom of the screen, a quarter turn for every 240 px across, about your character, following the pointer
  with no ease, and it stays where you let go. A right press that never moves 4 px is still a right-click (the
  context menu in Edit, the gender toggle on your character in Walk), opened as you let go; one that moved opens
  nothing. A turn left anywhere between quarters: `[`, `]` and the dial's arrows go on to the next quarter that way.
- **Right-drag up or down tilts it** (the owner, 2026-11-27: "make it so that the right click rotation thing also
  shifts the perspective vertically"): dragging down lifts the camera toward overhead, up lowers it toward the floor,
  a degree every 4 px, between 24° and 70° from overhead (52° to start), with no ease; across and up or down at once
  turns and tilts together. What is placed over the scene (the selection toolbar, the chips) follows the tilt, and a
  new tab or Space starts back at 52°.
  The turn and the tilt follow the pointer on the stage every move; the rest of the view (the cut-away walls, what a press picks)
  catches up every 150 ms and as you let go, so turning stays smooth (the owner, 2026-11-27: "Rotating with my cursor
  is very laggy").
- **A new tab starts from the default view** (the owner, 2026-11-27: "when I change tab or enter a new space reset my
  zoom to default perspective"): opening a Space or moving to another tab puts the camera back unturned, and frames
  the tab in Edit (walking, the camera centres on your character at 180% as ever).
  What depends on the side a piece is seen from (a sitter's lift, a table built row by row, the receptionist behind
  her desk, the arrow keys' steering) takes the nearest quarter; the walls cut away, the pans and click to walk
  follow the exact angle.
- **It is yours, in this browser tab**: never synced, never remembered.
- **What turns with it**: the floor and the walls (they are 3D, so you see a room from its other sides), and every
  piece that stands on the floor: it keeps its place and its facing on the floor, so the camera sees the side it
  looks at, a piece's side drawing from the side and its back drawing from behind (the owner: "the bookcase shouldn't
  always face me, it should show me the back if I rotate behind it"), standing on the edge of its box nearest the
  camera. A table built row by row is built from the drawing the camera sees, row by row as from the front.
  Characters face the camera. Click or tap to walk traces the press back through the turned camera; the arrow keys
  steer by the screen (up is still away from the camera); a drag, a one-finger swipe or a two-finger scroll pans the
  floor the way your hand moves on the screen, whichever way the camera looks (the owner, 2026-11-18: pans went "the
  original direction, making it impossible to navigate around"); the walls in front of you, in the camera's direction, are
  the ones cut away; a sitter's lift and legs follow the camera's side of their piece. Pieces hung on a wall stay on
  it. The office dog's bed lies flat on the floor while the dog is out of it.
- **A turned piece keeps its size and stands on the floor** (the owner, 2026-11-18: the coat stand and umbrellas
  "shrink in size"; the sofa, bookcase and lockers looked "like they are floating in the air on one side, not connected
  to the ground"): the drawing the camera sees is drawn at the scale the piece's own drawing has on the canvas. From the
  front or behind it is the front or back drawing at its own shape. Side on it is the piece's end: its back drawing (an
  upright drawing) narrowed to the piece's depth (its side drawing's width), standing on its foot, because the side
  drawing is the flat plan's view from above and stood up it floats at its far end. A kind whose side drawing is an
  upright view of its end (a chair, a jukebox, a treadmill, a fridge, a hammock: `SIDE_IS_ELEVATION`) shows it whole;
  every other kind's side drawing is the plan's box turned (a desk's top, a sofa's seat, a printer), which stood up
  lies the piece on its side (the owner, 2026-11-18: "the Printer, its lying on its side"), so side on it shows its
  front drawing narrowed to about its depth (half its front at most), upright on its foot, as a piece turned steeply
  away reads. A **long, low piece** (its front drawing under 0.7 times as tall as it is wide: a bench, a sofa, a bar, a
  pool table) is the exception: side on it shows its whole length, built as a low box: its side drawing as its top,
  raised to the piece's own height over an upright end face (the drawing's lowest band), so a two-seater bench turned
  to face right still reads as a two-seater running away from you (the owner, 2026-11-25: "It should be taller when
  rotated that way"), never as a rug, and whoever stands at it is taller than it (a turned reception desk, "hits my
  face"). The heights keep an order under a character's 56 canvas px (the owner: "there should be some visual height
  hierarchy"): counters, bars and desks 30, pool and foosball tables 26, a ping-pong table 24, a sofa 20, a bench 18, a
  bike rack 16, anything else 22. A piece drawn the same from every side (a coat stand) is never narrowed. It stands on the edge
  of its own footprint nearest the camera, so it covers exactly the floor that stops you walking: a turned fountain
  is never stood in (the owner: "the original blocks ... move"). A one-seat piece (a Phone Booth, a Bar Stool, a
  chair) slides across, turned, so the seat it draws is over the seat its sitter sits on: you sit inside a turned
  booth, never beside it (the owner, 2026-11-25). Only a table drawn from above (a Long Table, one
  built row by row) turns its box.
- **A piece turned on the plan** by quarter turns (a sofa facing into the room, lockers along a side wall) is seen the
  same way in the 3D view, its own turn added to the camera's, so it stands grounded from every side, the camera
  unturned included.
- **Words read the right way up**: a room's name over its door is mirrored back when the camera sees that wall from
  behind, and a Text element on the floor turns with the camera about its middle. So do an Avatar Pad and the board's
  controls (Mode Button, Focus Button, Timer, Stopwatch), whose drawings are pictures to read, so a pad never shows as
  a sideways ellipse (the owner, 2026-11-18: "nor avatar landing pads").
- **Your character's facing follows the camera**: a sitter, a walker and the receptionist are drawn facing the way they
  face on the floor as the camera sees it (the owner: "I rotated screen then sat down at this desk, my character is
  facing the wrong way").

## Show All (Nothing in view)

The nudge when everything has scrolled out of view ([Canvas](canvas-and-palette.md)) counts what the
3D camera sees: the floor it draws, far ahead and less behind (all round when turned), so content up ahead is never
called out of view, and the nudge's Show All, which centres on your character, brings it back (the owner, 2026-11-18:
"Bring it back into view does nothing when I am in 3d").

## Pieces you can use

In the 3D view a piece with a control of its own (an Arcade's Insert Coin, a Notice Board, the dog, a Reception
Desk's bell) glows softly under the pointer (the owner, 2026-11-18: "in 3d its not obvious which things I can
interact with"). The bubbles that open as you walk up (Insert Coin, Welcome and Ring) stand upright over their piece
as sharp, flat cards, as the characters' chips do.

- **Telemetry**: each turn sends `Canvas · Used · Space3DTurn`, charted as 3D View Turns.
- **Telemetry**: a right-drag that turns or tilts sends the same event once, as you let go.

## Always on

- **There is no switch**: no 3D View button, no Shift+3, nothing remembered (the old `livehuddle:v2:space-3d` key is
  no longer read). Every canvas, in Edit and Walk, for every role, opens tilted from its first frame.
- **The camera is closer than a plan's**: a walk lands at 180% with you in the middle (DEFAULTS.md D145; the owner,
  2026-11-27, wanted the characters to read: it was 140%); zoom works
  as before from there.

## The view dial

The owner (2026-11-26): "change the zoom to be a larger circular control which allows me to control zoom (height) up
and down and angle left and right".

On a desktop the corner's zoom buttons are one round dial, 128 px across, at the corner's right, in Edit and Walk,
with Undo and Redo just left of it, their bottom level with its bottom (the owner, 2026-11-27: "move undo redo buttons
to the left of the navigator and zoom control, not below it", then "at the bottom"):

- **Up zooms in, down zooms out** (the camera lower or higher over the floor). A press steps 10% as the old buttons
  did; holding glides on until you let go, within the zoom's bounds.
- **Left and right turn the camera** a quarter turn each way, as Turn Left and Turn Right do. Always shown.
- **The middle** shows the zoom: a click fits the tab, hovering offers the zoom levels, as the old percentage did.
- **The wheel over the dial** zooms, and **dragging its middle** up or down zooms smoothly, left or right past a short
  way turns the camera once.
- Each part has a tooltip and a name for screen readers; the dial is reached by Tab like the buttons it replaces.
- On a phone the corner keeps its row (pinch zooms, Fit stays), since a dial would cover the plan.

## Editing in 3D

The owner (2026-11-26): "Can you make the edit mode 3d as well? So it looks the same as I built and then walk in it".

- **The 3D view shows in Edit too**, always: switching between Edit and Walk keeps it 3D.
- **A press on a Room's or a Corridor's floor selects it** (the owner, 2026-11-27: "if in edit mode I click a room
  (not furniture in it) it should select it"): a press that meets no piece's model is traced through the camera to
  the floor, and the smallest Room or Corridor whose floor holds that point (turned and drawn rooms by their outline)
  takes it as a press on its own drawing, so it selects, drags and opens its menu as a press on the floor's drawing does. A press on a piece
  in the room still picks the piece.
- **A click in Walk lands where you see it** (the owner, 2026-11-27: "I go to click something like a desk but it
  walks outside the room"): the scene answers a walking press, the model it meets or the floor under it through the
  very camera that drew it, before any guess from the stood-up drawings; a doorway's drawing, hidden in the scene,
  no longer claims presses on the desks beside it.
- **A piece being added shows as its 3D model** (the owner, 2026-11-27: "when I am adding to the space it is in 2d so
  i can never place it right, the objects should only ever be in 3d and look the same as when I drop them"): an armed
  or dragged palette piece stands where it would land, its model and its contact shadow exactly as it will stand once
  dropped, turned with Space as it will be; the flat preview steps aside for it. A door, a window or a fence being
  placed is drawn in the walls it changes, as they will stand with it (the doorway cut, the window glazed, the fence
  run), so you see it live on the wall (the owner, 2026-11-27: "with windows I can't see through the window so don't
  know if I am placing it right"). A kind with neither keeps the flat preview.
- **A piece being placed off the walls cuts down the walls in front of it** (the owner, 2026-11-27: "when adding new
  elements near a wall if not placing on the wall the wall should hide so I can see where I am placing it"), as they
  are for your feet; a piece going onto a wall leaves that wall standing.
- **Editing works on the floor under the pointer**: a press, a drag, a marquee, a drop from the building strip, a
  drawn wall or outline all land where the pointer meets the floor, through the tilted and turned camera, so a piece
  dragged follows the pointer across the floor at every turn.
- **A dragged piece is drawn where it is going, as it goes** (the owner, 2026-11-27: "dragging things around in edit
  mode is impossible, I don't see where I am dragging them to"): its model and its contact shadow move with the
  pointer every frame (a collaborator's drag too), never waiting for the drop. The snap guides (alignment lines,
  even-spacing ticks, snap dots) lie on the floor through the same camera, so they line up with the pieces.
- **Pieces are picked from the scene** ([Real 3D](3d-engine.md)): a press on a model selects that piece, as a press on
  its drawing on the floor does. The piece whose own surfaces the press meets first wins, not the one whose box is nearer (a
  chair tucked under a desk, a lamp beside a sofa), so a click always selects what it lands on (the owner, 2026-11-27:
  "I often can't click an element to select it in edit mode, having to draw a box around it instead"); a press beside
  a thin part (a leg, a rail) that meets no surface still picks the piece whose box it is in.
- **What you look at stays in view**: with no character of yours while editing, the floor at the middle of the view
  stands in for your feet, so the walls in front of it fade, as they do for you walking. Every roof is off while
  editing (the owner, 2026-11-27: "in edit mode hide all roofs"), and so is every room's wall on the camera's side
  (each Room's and Office Pod's walls across the view nearer the camera than its middle, with the doorways and windows
  in them), cut down as the cut-away cuts them, so the whole floor plan is in reach (QA, 2026-11-27: in Virtual
  Office the tall front walls hid the front half of every room). Its back and side walls stand. Walking, only the
  rooms you are in or near open up (above).
- **Walls and roofs move smoothly** (the owner, 2026-11-27: "its a bit jarring when they choose to open or close"): a
  wall in your way slides down over 320 ms and grows back only once it has been out of your way for 450 ms, so a pan
  past it never flickers it; a roof lifts and fades over 380 ms and settles back the same way.
- Selection outlines and handles lie on the floor around the piece's footprint; menus and the building strip stay
  flat over the view.
- **The selection toolbar stays over the piece as drawn** (the owner, 2026-11-27: "the element toolbar needs to stay on
  top of the element as I move my screen, not cover it"): it is placed against the piece's box on the screen through
  the tilted, turned camera, from its footprint up to its model's top, so it sits above the piece and follows it as
  the view pans, zooms or turns.
- **Furniture snaps to walls** (the owner, 2026-11-27): a piece of furniture dragged within 18 canvas px of a wall's
  face (a Room's, Corridor's or Pod's wall, a window, a glass wall or a fence) that runs beside it lands flush against
  that face: a room's inside face, unless the view looks at the room from outside (the middle of the view is outside
  it), then its outside face (the owner, 2026-11-27: "on the inside not the outside unless I am facing the outside"); a
  fence's either face. A wall wins its axis over an edge alignment; Cmd or Ctrl held places freely, as for every snap. A dragged
  room never snaps to its own walls.
- **Dragging is smooth**: while a selection is moved, resized or reshaped only the pieces it changes are rebuilt each
  frame; the rest of the scene, the walls and the roofs stay as they were and are rebuilt once when you let go.
  Measured on Virtual Office (73 elements): rebuilding every piece took 23 ms a frame, more than a frame's budget.
- **Everything you can do while walking still works in 3D**: walking, sitting, using pieces, walking through doors, the
  reader, speech, reactions, calls, the avatar palette.

## Share roles

It only changes the viewer's own view, so every role has it ([Share roles](../013-workspace/share-roles.md)):

- **Editor**: while walking and while editing.
- **Participant** and **Viewer**: always, since they are always walking.

## Phones and narrow windows

- Turn Left and Turn Right are in the cluster's row on a phone, as the zoom controls are.
- **A tap walks, a drag pans**.
- The camera, heights and cut-away are the same on every screen; perspective is in screen px, so a phone looks a
  little more steeply into the distance than a desktop does.

## Themes

The walls are the plaster the flat plan draws (../009-elements/furniture-art-style.md "Rooms"): a plaster face with a
lighter top edge, a soft shadow at its foot and a wooden skirting. On a dark canvas (`data-dark-canvas`) they are the
same walls in evening light, deeper, whatever the app's light or dark mode. A wall reads against the floor by its
shading, its foot shadow and its skirting rather than by a stroke.

**Wall colour.** A tab can paint its walls: `wallColor` on the tab (a `#rrggbb`, set in Tab Style's Room panel or by
a look, [Tab Style dialog](../011-theme/canvas-and-theme-dialog.md#room-panel)). Unset, the walls are the plaster
above. Set, the face takes the colour, its shade a third darker, its top edge a quarter lighter, and on a dark canvas
the lot is the same colour in evening light, as the plaster is: a modest step deeper, its lightness down a tenth and
never more than 0.06, so the chosen hue stays recognisable (a red wall reads red, not near black). Anything drawn on a wall (a
sign's ink) takes a dark or a light ink, whichever reads at 4.5:1 on the face. The skirting, doors and windows keep
their own colours. The walls layer sets these as its own custom properties (`--space-wall`, `--space-wall-shade`,
`--space-wall-top`, `--space-wall-ink`), so nothing is restyled per wall and a change costs one style write. The
tab body is stored as JSON, so the field needs no migration; Apply to All Tabs copies it with the rest of the style.

## Performance

The owner's "not laggy" is the budget: walking in 3D holds 60 fps on a mid laptop on a Space the size of Virtual
Office, and 30 fps or better on a phone.

- **The camera is the browser's.** The tilt is one CSS 3D transform on a stage around the canvas's world layer, so
  walking (which moves the world layer) changes a transform the compositor applies; nothing is laid out or painted for
  a step that was not already.
- **The floor is one plane.** The board's elements stay in their one element plane, flattened into a single layer, so
  a board of a thousand elements is still one layer in 3D (livediagram's Isometric view made a layer per extruded
  copy and spent seconds per frame on large boards).
- **Walls are built once per change**: the wall list is worked out from the board when it changes, never per frame,
  and drawn by the 3D scene ([3D engine](3d-engine.md)), never as page elements. The floor and the standing pieces
  near the view (within one and a half screens to either side, three ahead and one and a half behind, at the current
  zoom) are re-chosen when the view has moved three quarters of a screen.
  The arrival's overview zoom (above, "Arriving") holds the area it starts with until it ends.
- **Pieces stand in the element plane**: each near standing piece is turned by one CSS rotation on its own box, so
  it is a layer of its own while the view shows; a piece's drawing is rasterised once, never per step. Only the
  near ones are turned, chosen with the walls, so the layers grow with what is in view, not with the board. The
  floor's other elements stay in the plane, unturned. Measured on Virtual Office (2026-11-17, 43 standing pieces,
  a 144 Hz laptop): walking in 3D drew 769 frames at a median of 6.9 ms and a 95th percentile of 8.6 ms.
- **The cut-away is the only per-step work**: a check of each wall against your feet, in the 3D scene's frame.
- **The 3D code loads with the canvas**: nothing of it is in the editor's first bundle; it is fetched as the canvas
  mounts, since the view is always 3D.

## Out of scope

- A flat 2D plan: removed (the owner, 2026-11-27).
- People arrows ([People arrows](people-arrows.md)) aimed through the 3D camera: they point by the board's layout on the
  screen, not through the camera.
- 3D in exports.
