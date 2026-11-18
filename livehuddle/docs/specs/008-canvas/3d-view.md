# 3D view

Status: **implemented** (Work Tracker 1043).

While you walk a Space, the **3D View** tilts it back like Apple Maps' 3D: a perspective camera looks down at the
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
  smaller. What covers the floor stays on it: rugs, grass, garden paths, the Stage, ponds and pools, the Car Park,
  stairs, Avatar Pads, stickies, text and everything that is not a piece of the Space.
- **The walls stand up**: every line a character cannot cross because it is a wall (a Room's walls, a Corridor's walls, a
  Fence's and a Garden Fence's run) rises from the floor as a wall face. They are the same
  lines the walk is stopped by ([Avatar mode](avatar-mode.md) "Finding the way"), so what you see standing is exactly
  what blocks you.
  - **Doorways are framed.** A Door standing on a wall ([Room builder](../009-elements/room-builder.md#door)) cuts it,
    and stands in its gap as a doorway: a dark wooden frame with a lintel of plaster over it, so the way through reads
    from across the room (the owner, 2026-11-17: "the doors should be more visible"). In a glass wall the panel over
    the frame is glass, as the wall is, never plaster, and the door is a glass door: a slim pale metal frame and a
    shut leaf of glass with a bar handle (the owner, 2026-11-18). A **shut** Door's leaf stands in
    the frame, two raised panels and a brass handle; an open one leaves the opening clear.
  - **Windows are windows.** A Window on a plaster wall ([Room builder](../009-elements/room-builder.md#window)) is
    cut out of it and stands in it as a window: plaster below its sill and over its head, a painted frame with a
    transom and a mullion, and glass catching the light (night on a dark canvas). A glass room's walls are glass
    throughout, so a window on one adds nothing. (The owner, 2026-11-17: "the windows don't look like windows".)
  - **Wall pieces hang on the wall.** A Notice Board, World Clock, Dartboard, Calendar Wall, Photo Wall, Hand Dryer,
    Screen and Room Sign placed against a room's back wall (its top within 64 px below the wall's line, its middle
    along it) hangs on that wall: upright in the wall's plane, its foot 10 px up it, drawn small enough to stay inside
    the wall with 12 px of wall over it (the owner, 2026-11-18: "items placed on them like screens and bookshelfs etc
    don't go higher than the wall"). One with no back wall near stands where it is, as any piece. (The owner, 2026-11-17: "not just
    floating in the air".)
  - **Fences stand as fences**: a Fence's run stands as wooden rails and posts, a Garden Fence's as white pickets on
    two rails, the picket fence its flat drawing shows. A fence's flat drawing on the floor is hidden while the view
    shows (as a room's flat name is), so the fence is never drawn twice, once standing and once lying under it (the
    owner, 2026-11-17: "what is the white stuff under the garden fences").
  - **Heights**: a Room or Corridor wall is 152 canvas px, as tall as the tallest piece that stands against a wall
    (a Toilet Cubicle), so a bookshelf, a fridge or lockers never rise over it; an Office Pod is a booth, its walls a
    little over a character (73); a Fence is a low run (22 canvas px); a doorway's opening is 96, under a 56 px lintel.
    A window sits in the middle of its wall, a fifth of the wall over it and a third under it.
  - **Glass rooms** ([Office](../009-elements/office.md#glass-walls)) stand up as glass: a pale, see-through face.
  - **Lit from the front**: a wall facing the camera is lightest, one running away from it darker, so the corners
    read without outlines. Each wall has a lighter top edge, its thickness seen from above.
  - **A room's name stands on its back wall**: the Room's label (the name that sits in its back wall's face in the
    flat plan) is written on the back wall as a sign, facing the camera, so it stays readable however far away the
    room is. A room drawn with the Room Builder writes it on its furthest wall that faces the camera. Its flat name on the floor is
    hidden while the view shows, so the name is never written twice.
  - **The plan's walls give way to the standing ones** (the owner, 2026-11-18: "one wall of every room ... is a
    different size" and "weird bits of wall poking out the back"): the flat plan's wall tops and the back wall's deep
    face are hidden while the view shows, with plain floor under the back wall's face, so every wall stands the same
    height and nothing flat pokes past them from any side the camera turns to. A glass room's flat panes and frames
    give way the same.
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
  hopping as in the flat view. Their name chips and status chips ride with them, upright and readable.
- **The office dog trots on the floor** (the owner, 2026-11-18: "the dog flies into the air and goes through the
  floor"): asleep it lies in its Pet Bed as the bed's drawing shows it; out of its bed it walks on the floor itself,
  standing up about its own feet as a character does, however far it trots from the standing bed.
- **Sitters are drawn over their piece**, as the flat plan draws them: a sitter on a chair, a sofa, a bench or
  either side of a table stands just in front of the standing piece. One sitting behind it (further back than 60 % of
  its depth: a table's far side, behind a desk turned to face you) has their legs hidden under its front, so they read
  as sitting behind it, never hidden by it or sitting on the floor (the owner, 2026-11-17).
- **What floats above heads stands up with them**: speech bubbles, the talking bars, raised hands and camera and
  screen bubbles turn to face the camera about the same feet, so they stay over the head they belong to. They are
  drawn over the whole scene, so no wall ever hides one, however near the wall the speaker stands; the Receptionist's
  card too, which in 3D always stands over his head, never under his feet. Their words are **as sharp as in the flat
  view**: each is drawn flat on the screen, moved and scaled to where the camera would stand it, following the tilt
  as the view turns, rather than drawn through the camera's perspective, which softened every letter (the owner,
  2026-11-17: "text like the receptionist chat looks blurry in 3d"). So turning the view in and out, they stay over
  their speaker on every frame.
- **What lies on the floor stays on it**: the hearing ring, the "you are here" ring, an Avatar Pad's arrival beam.
- **The floor pattern goes**: the tab's dots or grid are drawn on the screen, not on the floor, so the 3D view
  shows the tab's background colour alone, fading into a soft horizon at the top of the screen.

## Pieces stand up

- **Which pieces**: every shape kind of the Space that is drawn standing (`standsIn3D` in the blueprint). Floor
  coverings lie flat: the Room and Corridor (their walls stand instead), Fences (theirs too), Doors and
  Windows (part of a wall), the Rug, Grass, Garden Path, Stage, Pond, Swimming Pool, Car Park, Stairs and Avatar Pad,
  and the board's controls (Mode Button, Focus Button, Timer, Stopwatch), icons and stickers. Every other element
  (stickies, text, cards, pictures, charts) is the floor's. An **Office Pod's furniture stands up inside
  its walls**: its walls stand as a room's do, and its benches, table and mug stand up together about the table's
  front edge, as a piece does, so the booth's inside reads as furniture rather than a floor plan (the owner,
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
- **Sitting**: a character sitting near a piece's front (a chair, a sofa, a bench, a table's near side: feet within
  60% of the piece's depth of its front edge) is drawn in front of the piece, as in the flat plan; one sitting further
  in (behind a desk, on the far side of a table, with a chair's back towards you) sits behind the piece's front, so
  the desk, the table or the chair's back hides their legs as it would.
- **Clicking a standing piece** clicks that piece, wherever on its drawing the press lands, as in the flat plan: a
  press over a standing piece finds the nearest piece drawn under it before the floor.
- **It animates** with the tilt: the pieces rise as the walls fold up, and lie back down as the view flattens.
- **Only near pieces stand**: the pieces in the view area (the walls' area, "Performance") stand; the rest lie flat
  in the distance, under the horizon's fog, and rise as the view comes near.

## Walls in front of you are cut away

A wall between the camera and your own character would hide you, so it fades out: any wall with a part less than
150 canvas px in front of your feet (towards the bottom of the screen) and within 72 canvas px of them to either side
fades to a ghost (18% opacity) while you stand there, and comes back as you walk away. Only your own character cuts
walls; peers behind a wall are hidden by it, as people are.

## Arriving

The owner, 2026-11-18: "first view should fit the whole room for a second then zoom in smoothly into 3d mode. This
way I can get an idea of where I am in the space right away".

- **Arriving on a tab with the 3D view on** (opening a Space walking, or travelling to another tab) shows the whole tab
  flat, framed as Fit frames it, for a second (SPACE_3D_OVERVIEW_MS, 1000 ms); then the camera glides in to your
  character over 900 ms while the view tilts up, landing at the walking camera's 3D zoom.
- **Not on the Edit | Walk switch**: switching to Walk on the tab you are on glides straight in, as before, since you
  were just looking at the whole tab. Not with reduced motion: it lands at once.
- Walking, clicking and steering work throughout; the tilt waits for the overview.

## The camera

- **It looks down at 52 degrees from straight down**, with a perspective of 1100 screen px: the angle of a map
  tilted back, not of an isometric drawing (which has no perspective and is turned 45 degrees).
- **It tilts about the middle of the screen**, which is where the walking camera keeps your character
  ([Avatar mode](avatar-mode.md) "The camera"), so you stay centred as the view tilts and as you walk: every step
  moves the floor under you, as in the flat view.
- **Zoom works as in the flat view**: the zoom controls, the keyboard, a wheel and a pinch zoom about your character,
  walls and characters growing with the floor.
- **Click or tap a spot on the floor to walk there**, as in the flat view: the press is traced back through the camera
  to the floor point under it. A press above the horizon finds no floor and walks nowhere. Arrow keys steer exactly as
  in the flat view (up is away from the camera).

## Turning the camera

The owner, 2026-11-18: "quarter turns is fine". You can walk round to see the other side of the room.

- **Turn Left and Turn Right** sit beside the 3D View switch while it is on (a curved arrow each, with tooltips), and
  `[` and `]` while walking do the same, with the action keys' guards. Each turns the camera a quarter turn about
  your character, over the tilt's 520 ms ease; turning on past a full turn keeps going round, never back.
- **It is yours, in this browser tab**: never synced, never remembered, and back to looking up the screen when the view
  goes flat (it turns back as it flattens), so the flat plan never turns.
- **What turns with it**: the floor and the walls (they are 3D, so you see a room from its other sides), and every
  piece that stands on the floor: it keeps its place and its facing on the floor, so the camera sees the side it
  looks at, a piece's side drawing from the side and its back drawing from behind (the owner: "the bookcase shouldn't
  always face me, it should show me the back if I rotate behind it"), standing on the edge of its box nearest the
  camera. A table built row by row is built from the drawing the camera sees, row by row as from the front.
  Characters face the camera. Click or tap to walk traces the press back through the turned camera; the arrow keys
  steer by the screen (up is still away from the camera); the walls in front of you, in the camera's direction, are
  the ones cut away; a sitter's lift and legs follow the camera's side of their piece. Pieces hung on a wall stay on
  it. The office dog's bed lies flat on the floor while the dog is out of it.
- **Out of scope**: free orbiting.

## Turning it on and off

- **The 3D View button** sits in the bottom-right cluster, before the zoom controls, while you walk: a switch
  (`aria-pressed`), lit while the view is 3D. Its hover card: **3D View**, "Tilt the Space back and stand its walls
  up. Shift+3." Named **3D** beside its icon on a wide desktop, as the cluster's other buttons are.
- **Shift+3** turns it on and off while walking (matched on the key's code, so it is Shift+3 on every layout), and it
  is listed in Settings' Keyboard reference under "While walking".
- **It animates**: the floor tilts back (or flattens) over 520 ms while the walls fold up from the floor (or down onto
  it) and the characters rise upright, all together. Under reduced motion (the system setting or the Reduce Motion
  preference) it switches at once.
- **Your character stays centred** throughout: the tilt turns about the middle of the screen.
- **It brings the camera closer** (the owner, 2026-11-17: "3d should be closer than 2d", "toggling between them
  should alter my zoom both ways"): turning the view on zooms in by 1.4 times (within the zoom's limits) about your
  character, and turning it off zooms back out: to the zoom you had, when you did not zoom while in 3D, else by the
  same 1.4. The zoom eases there on the tilt's own curve and length (520 ms), so the camera closes in as it tilts
  rather than jumping a frame ahead of it (the owner, 2026-11-17: "the transition between 2d and 3d is janky"); a zoom of your own
  mid-ease takes over. The zoom is the canvas's own, so the zoom controls show it and every zoom works on it. Only the switch
  zooms: a walk that starts in 3D lands at the walking camera's 3D zoom, 140% with you in the middle (where the flat
  walk lands at 100%, [Avatar mode](avatar-mode.md) "The camera"), and a walk that ends is framed by Edit as always.
- **It is on by default** (the owner, 2026-11-18: "3d should be the default mode, but if people toggle to 2d remember it
  for the next time they come back"): every walk opens in 3D until you turn it off.
- **It is remembered per person, in this browser** (Browser Storage, `livehuddle:v2:space-3d`): turn it off and every
  walk on every board opens flat until you turn it back on. Nothing is sent to the server or to anyone else.

## What stays editable

- **The 3D view is a view of walking.** It shows only while you walk (Avatar mode); walking is already read-only for
  you ([Avatar mode](avatar-mode.md) "Read-only while active"), so the 3D view locks nothing that walking did not.
- **Editing needs the flat plan**: switching to Edit (the Edit | Walk toggle, `E`, Escape, a tile dragged in) flattens
  the view, with the same animation, and the building strip, handles and menus work on the flat plan as always. The
  choice is kept, so the next walk tilts back again. This is the difference from livediagram's retired Isometric view,
  which was its own tool and turned editing off while it showed ([Not in livehuddle](../002-project-scope/not-in-livehuddle.md#the-presenting-tools-isometric-and-zen)).
- **Everything you can do while walking still works in 3D**: walking, sitting, using pieces, opening doors, the
  reader, speech, reactions, calls, the avatar palette.

## Share roles

It only changes the viewer's own view, so every role has it ([Share roles](../013-workspace/share-roles.md)):

- **Editor**: while walking.
- **Participant** and **Viewer**: always, since they are always walking.

## Phones and narrow windows

- The button is in the cluster's row on a phone and on a narrow window, as the zoom controls are; Shift+3 needs a
  keyboard.
- **A tap walks, a drag pans**, as in the flat view.
- The camera, heights and cut-away are the same on every screen; perspective is in screen px, so a phone looks a
  little more steeply into the distance than a desktop does.

## Themes

The walls are the plaster the flat plan draws (../009-elements/furniture-art-style.md "Rooms"): a plaster face with a
lighter top edge, a soft shadow at its foot and a wooden skirting. On a dark canvas (`data-dark-canvas`) they are the
same walls in evening light, deeper, whatever the app's light or dark mode. A wall reads against the floor by its
shading, its foot shadow and its skirting rather than by a stroke.

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
  and each wall is one element with one transform. Only the walls near the view are drawn (within one and a half
  screens to either side, three ahead and one and a half behind, at the current zoom), re-chosen when the view has
  moved three quarters of a screen.
- **Pieces stand in the element plane**: each near standing piece is turned by one CSS rotation on its own box, so
  it is a layer of its own while the view shows; a piece's drawing is rasterised once, never per step. Only the
  near ones are turned, chosen with the walls, so the layers grow with what is in view, not with the board. The
  floor's other elements stay in the plane, unturned. Measured on Virtual Office (2026-11-17, 43 standing pieces,
  a 144 Hz laptop): walking in 3D drew 769 frames at a median of 6.9 ms and a 95th percentile of 8.6 ms.
- **The cut-away is the only per-step work**: a check of each drawn wall against your feet, which writes to a wall
  only when its state changes.
- **The 3D code loads on first use**: nothing of it is in the editor's first load; it is fetched the first time the
  view is turned on in a session (or when a walk starts with it remembered on).

## Out of scope

- Orbiting the camera freely; it turns only in quarter turns ([Turning the camera](#turning-the-camera)).
- A 3D model of any piece (sides, a top, turning to show its back as the camera moves): pieces stand as their flat
  drawing, facing the camera.
- People arrows ([People arrows](people-arrows.md)) aimed through the 3D camera: they still point from the flat view.
- A 3D view while editing, and 3D in exports.
