# Real 3D

Status: **in progress** (on by default; Settings > Editor > Canvas > Real 3D turned off brings back the [3D view](3d-view.md)'s stood-up drawings).

The owner (2026-11-25): "I want it to actually be 3d, not fake 3d, but I don't want the art style to change", and "I
should be able to go into 2d or 3d".

The 3D view today stands each piece's flat drawing up on the floor and fakes depth with a rule per case (a sitter's
lift, legs hidden behind a desk, a piece's end narrowed side on, a pod's furniture stood in a layer of its own). The
rules meet each other on every piece, facing and camera turn, and each fix broke a neighbour. Real 3D replaces the
stood-up drawings with a real scene: what hides what, turning a piece, turning the camera and sitting inside a booth
come from the geometry, not from rules.

## What stays the same

- **2D is unchanged.** Edit and the flat walk draw the plan as today. The 3D View switch, Shift+3, its default, its
  memory in this browser, Arriving, the 52 degree tilt, the zoom, quarter turns ([3D view](3d-view.md)) behave as they
  do now. Switching keeps your place, the camera's direction and your selection, mid-walk too.
- **The art.** The same palette and the same dark outlines, lit as real models (below), so a piece seen from the
  default camera looks like its flat drawing and from any other side like the same piece. The owner (2026-11-25):
  "Why is everything so pixelated and ugly now", then chose richer lit models over the pixel grain.
- **What blocks you.** A model stands on the footprint the walk is stopped by, so what you see is what blocks you.
- **Everything you do while walking**: walking, sitting, using pieces, doors, speech, reactions, calls and their
  bubbles, the chips, the cut-away walls in front of you, rooms opening as you come near.

## One world, every camera

The owner (2026-11-25): "other people might also be looking at a different perspective rotation, so it needs to be
consistent across all possible views".

- **The scene is built only from what everyone shares**: the board, and each character's spot, seat, facing and pose.
  Nothing about where a piece, a seat or a character is depends on anyone's camera. The camera (its turn, its zoom)
  is the only thing that is yours, so two people turned different ways see the same room from two sides, with every
  sitter in the same seat and every piece in the same place.
- **Depth is real**: everything is drawn with a depth buffer, so what is nearer the camera hides what is behind it, at
  every height (the owner, 2026-11-25: "I should stand over things I am visually taller than"). You stand taller than a
  bench, a desk or a counter and are seen over it; a bookshelf, lockers or a booth taller than you hide you behind
  them; a sitter on a bench is seen sitting on it from the front and from behind.
- A test renders the same Space from all four turns and checks every sitter's figure overlaps its seat's model in each.

## The scene

- **Floor**: the board's floor layer (the tab's background, rooms' floors, rugs, grass, paths, stickies, text, every
  element that is not a piece of the Space) is drawn flat as today and laid in the scene as the ground.
- **Walls, doors, windows, fences, roofs** are boxes with a thickness: a wall 8 canvas px thick, a Fence 8, a Garden
  Fence 6, a roof on a room on grass (hipped on a box room, flat glass on a glass room, flat on a Room Builder
  outline). A door is a leaf on a hinge in its frame, open or shut as the plan says.
- **Pieces** are block models (below), placed on their footprint at their facing. Turning a piece on the plan turns
  its model; turning the camera shows its other sides. Nothing is narrowed, slid, lifted or stood in a layer.
- **Characters** are modelled characters (below). A sitter sits on the seat's real position and height, so they are inside a
  booth, at a desk, on a bench, and hidden by whatever is between them and the camera. Only their name and status
  chips, speech and call bubbles stay flat cards over their heads, always readable, never hidden.

## Models

Each piece kind has a model in the art's unit (one drawing pixel), in its palette, built so that seen from the default
camera it matches its flat front drawing.

- **Smooth where the thing is round**: boxes are bevelled (their edges eased, a part thinner than 2.5 units stays
  square), and round things are turned, bent or rounded rather than stacked: trees (a flared trunk, branches and a
  crown of leaf clumps), plants, the Fountain (basin, bowl, water sheet and jets), the Car Park's cars, the Bike Rack's
  bikes and hoops, the Garden Umbrella, the Campfire.
- **Roofs** are tiled: courses of tiles up each slope to a capped ridge, eaves and gables hanging past the walls with
  their boards, a soffit under the overhang.

- **Heights keep an order** under a character (56 canvas px): counters, bars and desks 30, pool and foosball tables
  26, a ping-pong table 24, a sofa 20, a bench 18, a bike rack 16; a phone booth, lockers, a fridge, a bookshelf
  taller than a character.
- **Seats** are points in the model (where the sitter's hips go) and the direction they face, so a sitter is placed by
  the model, never by a rule per kind.
- **Materials**: each box takes a colour from the drawing's tones (wood, fabric, metal, glass, screen); glass is
  see-through; a screen glows. A theme's or a tab's colours apply as they do to the flat drawing.
- **Every standing kind has a model** (2026-11-25): 65 kinds with a drawing, plus the Screen, the Room Sign and the
  Portal. A kind added later without one stands as a block of its footprint at its kind's height until it gets one.
- **Pieces hung on a wall** (boards, clocks, the Screen, a Room Sign) hang at eye height against the back of their box.

## Characters

The owner (2026-11-25): "The character model is also awful, needs to be way higher quality".

Every character (you, peers, the Receptionist) is a modelled character built from its look (gender, clothes, hair,
hair colour, shirt colour), in the same colours as its sprite: a rounded head with eyes, brows, nose, mouth and ears,
each hairstyle shaped as its own (buzz, mohawk, curly, afro, long, bob, ponytail, bun, topknot, pigtails, braid,
spiky), each outfit's sleeves, collar, legs or skirt, and shoes. It is jointed at the hips, shoulders and knees:

- it turns smoothly to face the way it walks;
- walking runs a smooth stride, arms swinging against the legs, knees bending, a small bob, easing back to standing;
- sitting puts its hips on the seat's real height with thighs forward and shins down;
- waving, cheering, jumping jacks, a raised flag and a cup in hand move the same joints.

A size choice scales the whole character. Each look's parts are built once and shared by everyone who wears it.

## Moments

Using or walking past a piece plays its moment as it does in 2D ([piece moments](3d-view.md)), now in the scene: the
owner (2026-11-25): "remember to retain the effects all the elements had too ... like walking past a tree causes leaves
to fall off". The piece is lifted out of the scene for the moment and moved: a tree, an umbrella, a coat rack, a
hammock or curtains rock away from you; small things shiver; anything else hops. Its particles play with it: leaves
falling from a tree or a plant, butterflies off a planter, a coin into the Fountain, Pond or Pool with ripples, sparks
off a fire, a puff from a kettle or a sink, a car's lamps flashing, glints. `/document/real-3d-sheet?moment=<kind>`
replays one kind's moment for review.

## The camera

- A perspective camera at the 3D view's tilt (52 degrees from straight down), quarter turns, zoom about your character,
  as today.
- **The light**: a sky light and a sun that casts soft shadows, following the middle of the view; every surface lit by
  its normal, so a curve shades smoothly. Outlines are drawn in the art's outline colour.
- **Click or tap to walk** casts a ray from the press to the ground; **a press on a piece** (to use it, to sit) picks
  the model under it: the nearest model box the ray enters, and the point where it meets it, kept inside the piece's
  box (so a press on a bench's left end picks its left seat).
- **The ink**: the scene is outlined in the art's outline colour, one pixel wide, wherever a piece or figure stands
  against what is behind it; a face seen at a slant is never inked across.
- **Cut-away**: walls between the camera and your character fade to a ghost as today, and the roof over you is lifted
  off. Any other wall or roof a sight line from your head to the camera passes through goes too, so a turn never leaves
  you behind a building. A piece never needs to.

## Rollout

1. **Prototype** behind `real3D` (Settings > Editor > Canvas, off): floor, walls, doors, fences, roofs, characters, and the Phone Booth, Office Pod, Bench, Reception Desk and Fence as models, beside the current view
   for the owner to compare.
2. **Every kind** modelled (done 2026-11-25), and a test page that renders every kind x facing x camera turn, empty and sat in, as one
   contact sheet, kept as screenshot tests.
3. **Switch over**: `real3D` on for everyone, then the CSS 3D code and its rules (`space-3d-pieces.ts` lifts and
   slices, `space-3d-rows.ts`, the pod layer, `useFlatBillboards`) deleted.

## Performance

The 3D view's budget holds: 60 fps on a mid laptop on Virtual Office, 30 fps on a phone.

- **Loaded on first use**: the renderer (three.js) and the models load the first time the 3D view is turned on in a
  session; nothing of them is in the editor's first load or in 2D. Their size is measured in the prototype and
  reported before the switch.
- **One draw per material per kind**: each kind's model is built once and drawn instanced for every piece of that kind;
  characters share one set of parts per look.
- **Measured** (2026-11-25, Company Campus, ego lite on an M-series laptop): about 613,000 triangles in the scene; the
  frame time is the same in 2D and 3D (the browser's frame cap), so the scene is not the limit there. A mid laptop and a
  phone are not measured yet.
- **Only near things are drawn**, chosen as the walls are today; the floor layer is one texture redrawn only when the
  board changes.
- **No work per step but the camera and the moving figures.**

## Share roles

It only changes the viewer's own view, so every role has it, as the 3D view ([3D view](3d-view.md#share-roles)).

## Out of scope

- Free orbiting (quarter turns only), first-person, shadows cast by lights, 3D in exports.
