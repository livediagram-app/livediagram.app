# 3D view

Status: **implemented** (Work Tracker 1043).

While you walk a Space, the **3D View** tilts it back like Apple Maps' 3D: a perspective camera looks down at the
floor at an angle, the walls of Rooms, Corridors, Office Pods and Fences stand up with their doorways cut in them, and
every character stands upright on the floor. It is a way to see the Space as a place rather than a plan; it changes
nothing on the board and nothing anyone else sees.

The owner (2026-11-15): a 3D view like Apple Maps, the Space tilted back with walls up, not an isometric angle, and
not laggy.

## What it shows

- **The floor** is the board as it is drawn flat (rooms' floors, rugs, furniture, stickies, text, everything), tilted
  back about the middle of the screen with perspective: what is nearer the top of the screen is further away and
  smaller. Furniture stays on the ground; it is drawn from above as always, so it reads as seen from the camera.
- **The walls stand up**: every line a character cannot cross because it is a wall (a Room's walls, a Corridor's walls,
  an Office Pod's walls, a Fence's and a Garden Fence's run) rises from the floor as a wall face. They are the same
  lines the walk is stopped by ([Avatar mode](avatar-mode.md) "Finding the way"), so what you see standing is exactly
  what blocks you.
  - **Doorways are gaps.** A Door standing on a wall ([Room builder](../009-elements/room-builder.md#door)) cuts it,
    and a room's own doorway is already a gap in its walls. A **shut** Door stands in its gap as a door panel, a
    little lower than the wall, in the door's wood; an open one leaves the gap clear.
  - **Heights**: a Room, Corridor or Office Pod wall is as tall as a character (56 canvas px); a Fence is a low run
    (22 canvas px); a shut Door's panel is 50.
  - **Glass rooms** ([Office](../009-elements/office.md#glass-walls)) stand up as glass: a pale, see-through face.
  - **Lit from the front**: a wall facing the camera is lightest, one running away from it darker, so the corners
    read without outlines. Each wall has a lighter top edge, its thickness seen from above.
  - **A room's name stands on its back wall**: the Room's label (the name that sits in its back wall's face in the
    flat plan) is written on the back wall as a sign, facing the camera, so it stays readable however far away the
    room is. A room drawn with the Room Builder writes it on its furthest wall that faces the camera.
- **The characters stand upright**: yours, every peer's and the Receptionist, each turned to face the camera
  (billboarded) about their feet, so they stand on the spot they walk on, in their four facings, walking, sitting and
  hopping as in the flat view. Their name chips and status chips ride with them, upright and readable.
- **What floats above heads stands up with them**: speech bubbles, the talking bars, raised hands and camera and
  screen bubbles turn to face the camera about the same feet, so they stay over the head they belong to.
- **What lies on the floor stays on it**: the hearing ring, the "you are here" ring, an Avatar Pad's arrival beam.
- **The floor pattern goes**: the tab's dots or grid are drawn on the screen, not on the floor, so the 3D view
  shows the tab's background colour alone, fading into a soft horizon at the top of the screen.

## Walls in front of you are cut away

A wall between the camera and your own character would hide you, so it fades out: any wall with a part less than
150 canvas px in front of your feet (towards the bottom of the screen) and within 72 canvas px of them to either side
fades to a ghost (18% opacity) while you stand there, and comes back as you walk away. Only your own character cuts
walls; peers behind a wall are hidden by it, as people are.

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
- **It is remembered per person, in this browser** (Browser Storage, `livehuddle:v2:space-3d`): turn it on and every
  walk on every board opens in 3D until you turn it off. Nothing is sent to the server or to anyone else.

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

The walls take their colours from the canvas: pale stone walls with a white top edge on a light canvas, slate walls
with a lighter top edge on a dark one (`data-dark-canvas`), whatever the app's light or dark mode. The top edge keeps
at least 3:1 against the face, so a wall's outline reads in every theme without a stroke.

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
  moved a quarter of that far.
- **The cut-away is the only per-step work**: a check of each drawn wall against your feet, which writes to a wall
  only when its state changes.
- **The 3D code loads on first use**: nothing of it is in the editor's first load; it is fetched the first time the
  view is turned on in a session (or when a walk starts with it remembered on).

## Out of scope

- Turning the camera (orbiting or rotating the view); the camera always looks up the screen.
- Heights for furniture or other pieces; a 3D look for the drawing of any element.
- People arrows ([People arrows](people-arrows.md)) aimed through the 3D camera: they still point from the flat view.
- A 3D view while editing, and 3D in exports.
