# Real 3D

Status: **in progress** (always on, with no setting: the owner, 2026-11-27, "remove the 2d mode entirely, 3d always").

The owner (2026-11-25): "I want it to actually be 3d, not fake 3d, but I don't want the art style to change", and "I
should be able to go into 2d or 3d".

The 3D view today stands each piece's flat drawing up on the floor and fakes depth with a rule per case (a sitter's
lift, legs hidden behind a desk, a piece's end narrowed side on, a pod's furniture stood in a layer of its own). The
rules meet each other on every piece, facing and camera turn, and each fix broke a neighbour. Real 3D replaces the
stood-up drawings with a real scene: what hides what, turning a piece, turning the camera and sitting inside a booth
come from the geometry, not from rules.

## What stays the same

- **The [3D view](3d-view.md)'s camera**: the 52 degree tilt, the zoom and turns (quarter turns, or free with a right-drag) behave as that page says.
  The view is always 3D: there is no flat plan, no switch and no setting.
- **The art.** The same palette and the same dark outlines, lit as real models (below), so a piece seen from the
  default camera looks like its flat drawing and from any other side like the same piece. The owner (2026-11-25):
  "Why is everything so pixelated and ugly now", then chose richer lit models over the pixel grain.
- **What blocks you.** A model stands on the footprint the walk is stopped by, so what you see is what blocks you.
  A turned piece's model is its front's footprint turned with it, so while 3D draws the walk is stopped by that
  same turned footprint, not the side drawing's own (the owner, 2026-11-27: "I seem to be able to walk into a
  bookcase": on its side the drawing's footprint was a third of the model's length).
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
  outline). A door is its type's own model in its frame (leaves on hinges, sliding panels, a revolving drum), its moving
  parts their own meshes so they open and close as characters come near (3d-view.md "Doorways"). A walking character
  stops with its body at a wall's face, never in it: each wall's reach is grown by its half-thickness and the figure's
  half-width (fence.md "A wall keeps the whole body out of it").
- **Pieces** are block models (below), placed on their footprint at their facing. Turning a piece on the plan turns
  its model; turning the camera shows its other sides. Nothing is narrowed, slid, lifted or stood in a layer.
- **Characters** are modelled characters (below). A sitter sits on the seat's real position and height, so they are inside a
  booth, at a desk, on a bench, and hidden by whatever is between them and the camera. Only their name and status
  chips, speech and call bubbles stay flat cards over their heads, always readable, never hidden.

## Models

Each piece kind has a model in the art's unit (one drawing pixel), in its palette, built so that seen from the default
camera it matches its flat front drawing.

- **The Avatar Pad stands with depth** (the owner, 2026-11-27: "landing pad should be 3d btw and have depth") **and is
  grounded, not a teleporter** ("make it less scifi"): a 14 px round oak platform on a walnut foot set in under it, a
  walnut band round its side and a rounded lip, a round rug laid in its top (a terracotta binding, a cream field with a
  sage band) and, in its middle where a character arrives, a walnut medallion rimmed in ochre with a compass rose
  inlaid. Warm woods and soft rug colours, no glow and no lamps. Nothing stands more than a px over its 14 px top, its
  flat drawing hides under the model, and a character standing on it stands on its top, not sunk into it.
- **Believable chairs** (the owner, 2026-11-27: "Improve the aesthetic of the single chair, they look a bit
  rubbish"): no chair is stacked boxes. The Chair is a wooden dining chair: four turned legs tapering to the floor, an
  H of stretchers, a wooden apron under a cushion rolled at its edges, and a back curved round its sitter, tilted a
  little, a wooden shell behind and upholstered in front, carried on raked posts with a ball on each. A Desk's and a
  Hot Desk's chair is an office chair: a five-star base on casters, a gas lift in its sleeve, a padded seat,
  armrests on stems and a padded back on a curved spine. A Meeting Table's chairs are meeting chairs: a padded seat on
  a slim frame with four tapered legs, the back legs rising into posts that carry a padded back. The fabric is the
  seat's colour, the woods and metals the drawings'. Every seat's top is exactly the seat height, and every back stands
  clear of the rays that find the seat ("Sitting fits the figure": 6, 11, 16 and 21 px behind the feet), the dining
  chair's 16 to 21 px behind the feet and the smaller chairs' 11 to 16, so a sitter rests on the cushion, never on the
  back, and the back is found behind them.
- **The Pond is sunk into the ground** (the owner, 2026-11-27: "the pond needs to feel like it has more depth, design
  wise it feels older now"): an oval of its box, a smooth pale stone coping just proud of the lawn with a few pebbles on
  it, wet dark stone inside it and a muddy bank shelving gently down below the floor to the water, so you look down into
  it. The water lies below the floor, darkest in its deep middle and lighter in the shallows by the bank, with a
  sheen of sky on it in a few soft see-through streaks, two or three lily pads (one with a pink flower) and a clump of
  reeds at one edge. The bank shelves more gently than the camera looks down, so from any side you see only what you
  would through the hole in the ground. Low enough to cast no contact shadow; its flat drawing hides under the model.

- **Smooth where the thing is round**: boxes are bevelled (their edges eased, a part thinner than 2.5 units stays
  square), and round things are turned, bent or rounded rather than stacked: trees (a flared trunk, branches and a
  crown of leaf clumps), plants, the Fountain (basin, bowl, water sheet and jets), the Car Park's cars, the Bike Rack's
  bikes and hoops, the Garden Umbrella, the Campfire.
- **Trees by species** (office.md "Tree species"): the Oak, Pine, Birch, Palm, Cherry Blossom, Autumn Maple and
  Willow each have a model of their own, read from the tree's `variant` (a model's context carries it).
- **No blocky soft goods** (the owner, 2026-11-27: "hammock looks blocky", "bar stools look pixelated"): the Hammock's
  sling is one smooth surface sagging between spreader bars (curved along its length, cradled across it, striped),
  slung on ropes from a wooden stand; its lowest point is the seat (`SEAT_Z`, in the middle). The Bar Stool is
  turned: a round foot, a slim pole, a footrest ring, a rounded upholstered seat on a collar, 32 segments round.
- **Stands at a real height** (the owner, 2026-11-27: "Suggestion box should be taller, same with coffee machine
  etc"): a piece people use standing is at the height they would use it beside a character: the Suggestion Box's
  slot at chest height on a tall post, the Coffee Machine and the Printer on a cabinet at counter height (the Kitchen
  Counter's worktop). A Microwave and a Kettle stand at counter height (they go on a counter).
- <a id="room-names-read-in-3d"></a>**Room names read in 3D** (the owner, 2026-11-27: "Room signs aren't readable"):
  a room's name stands on a cream nameplate with a thin walnut rim, in dark ink, on the wall that carries it (on the
  lintel over its door, else high on its back wall), on both of the wall's faces so it reads from every side the
  camera turns to, never mirrored. A Room Sign's plaque carries its room's name the same way (its status lamp under
  it). The letters are geometry, not a picture: the browser's bold sans serif drawn once per name on a 128 px tall
  offscreen raster, its ink traced row by row with each edge placed to a fraction of a pixel (read from the raster's
  anti-aliasing) and each stroke laid as a few trapezoids whose sides follow the letter's slants and curves, so a name
  is as crisp as the walls at every zoom, its edges smooth lines rather than pixel steps (the owner, 2026-11-27: "Room
  signs look blurry"), and it never blurs or shimmers. The ink lies a hair over its plate, never far enough proud of it
  to throw an outline or a shadow ring round each letter. About as many triangles as the old rectangles (Meeting Room
  329 trapezoids against 307 rectangles), built once per name in under 1.5 ms. Their capitals are 15 px on a wall (a long name shrinks to fit its plate) and up to 11 px on
  a Room Sign (a tenth of its plaque's width). A wall cut away in front of you drops its plate with it.
- **Lamps glow without lights** ([Office amenities](../009-elements/office-amenities.md#lamps)): a lamp's shade is a
  lathed shell open at both ends, its inside a brighter warm cream than its outside and a bulb in it, and its pool of
  light a faint warm see-through disc (the glass material) on the floor or the desk. No lamp adds a light to the
  scene, so a room of lamps costs what a room of plants does.
- **Roofs** are tiled: courses of tiles up each slope to a capped ridge, eaves and gables hanging past the walls with
  their boards, a soffit under the overhang.

- **Heights keep an order** under a character (56 canvas px): counters, bars and desks 30, pool and foosball tables
  26, a ping-pong table 24, a sofa 20, a bench 18, a bike rack 16; a phone booth, lockers, a fridge, a bookshelf
  taller than a character.
- **Seats** are points in the model (where the sitter's hips go) and the direction they face, so a sitter is placed by
  the model, never by a rule per kind.
- **Materials**: each box takes a colour from the drawing's tones (wood, fabric, metal, glass, screen); glass is
  see-through; a screen glows. A theme's or a tab's colours apply as they do to the flat drawing.
- **Sitting fits the figure** (the owner, 2026-11-27: "the sitting animation on various chairs is borked"): a sitter's
  pose is measured on its own bones. Its hips rest on the seat, its knees over the seat's spot, and its shins reach
  the floor, angled forward when they are longer than the seat is high. The rig's feet hang from its root (they
  plant the walk), so whenever a pose turns the legs (sitting, a jack's spread) each foot is carried to its shin's
  end; nothing stays behind on, or under, the floor. Its back meets the seat's back, never passes through it (the
  owner, 2026-11-27: "he is merged with the back of the chair and hovering in the air"): the seat's back is found one
  canvas px at a time behind the feet, however large the sitter (a step that grew with the figure stepped over a thin
  back and missed it), and the hips go in front of it by how far the figure's own body reaches behind its hip joints,
  measured on the figure. A sitter's seat is searched for once and kept while they stay put.
- **Heights match the people** (the owner, 2026-11-27: the characters were too small beside the furniture): every
  piece stands 1.4 times the height its model is built at (`RISE`), and every wall, door and roof 1.2 times
  (`WALL_RISE`, less, so a corridor's walls never wall off the view), so with the larger character
  (avatar-mode.md, Size) a desk meets a person's waist, a seat their knees, and a doorway clears their head. A sitter's
  hips go to the risen seat; a character on an Avatar Pad stands on its risen top.
- **Every standing kind has a model** (2026-11-25): 65 kinds with a drawing, plus the Screen, the Room Sign and the
  Portal. A kind added later without one stands as a block of its footprint at its kind's height until it gets one.
- **Pieces are as deep as they really are** (the owner, 2026-11-27): an Arcade Machine's cabinet stands on most of
  its box's depth (its footprint from 52/112 down), as deep as it is wide and a little more, so you can't walk into its
  back; a Phone Booth's model takes only its box's front 56 px, its back wall just behind the stool, since the
  drawing's top half is the booth seen standing. Templates place both by their models.
- <a id="wall-pieces-sit-on-their-wall"></a>**Wall pieces sit on their wall** (the owner, 2026-11-27: "room signs
  shouldn't poke out like that when I am not facing them, they should stay attached to the wall"): a piece made for a
  wall (wall-pieces.md: boards, clocks, the Screen, a Room Sign, a Poster, a Bookshelf, a Fireplace) hangs flat on the face of the
  wall it stands against (`mountedFace`, the face `snapToWallFace` puts it on; a piece hung on a room's back wall's
  standing face is on the room's side), its back on the wall's 3D face and its front out from it (for a piece that
  turns, the back of its model, the footprint's back edge, not the back of its box), at its own height
  (boards at eye height). One that keeps the room's facing (a Screen, a Room Sign) on a side wall lies along that wall
  at its own width about its middle, never standing out from it like a blade. Seen from any turn of the camera it stays
  on its wall; a piece on no wall stands at the back of its box.
- **A Poster hangs its picture** ([Poster](../009-elements/poster.md)): its frame and mat are in the pieces' one
  geometry, as wide and as tall as its box, its middle at eye height; its picture is a textured quad of its own on the
  mat's opening (cover-cropped, at most 1024 px), loaded through the same image read as the Image element and
  released when it changes or goes, so a picture arriving never rebuilds the pieces.
- **The Screen scales with its size** ([Screen sizes](../009-elements/screen-and-room-sign.md#sizes)): its panel is
  as wide as the Screen and 9/16 as tall, its bezel and depth growing with it (2 to 8 px). Up to the wall's height
  (the Medium and smaller) it hangs on its wall on a slim bracket, its middle at eye height; a bigger one (Large,
  Cinema) stands on the floor on a wide stand of two splayed feet against its wall, its panel as tall as 9/16 of its
  width up to 280 px (a cinema's wide frame). Every size keeps a camera bar on its top and a status light on its
  lower edge.
- <a id="idle-screens-show-the-logo"></a>**An idle Screen shows the logo** ([The idle
  face](../009-elements/screen-and-room-sign.md#the-idle-face)): the Screen's model marks its glass (as a Poster marks
  its opening), and every Screen with nothing chosen gets a quad there, all of them one mesh on one shared canvas
  texture, so twenty idle Screens cost one draw and one texture upload. The texture (the prism and wordmark, drawn
  from @liveworkspace/brand's own geometry) is redrawn at most 15 times a second, only while the 3D view draws, only
  while the prism moves (its 3 s rest costs nothing) and only while an idle Screen is in view; the quads keep the
  logo's proportions on any Screen size. Reduced motion draws it once, open, and never again.
- <a id="a-stage-is-a-platform"></a>**A Stage is a platform** (the owner, 2026-11-27: "stage looks wrong, the floor
  isn't at the right depth"): its whole box is a deck of honey boards (its own fill when it has one) at the deck's
  height (20 px as the walls rise, `STAGE_DECK`), on solid dark wooden sides, a nosing along its front lip, the front
  edge's stained skirt with its footlights either side of the name plate, which carries "Stage" or the stage's own name
  in dark ink. A stage 150 px wide or more has two steps up at its front left. A character on the deck stands on it,
  and on each step at the step's height (the same raised tops as an Avatar Pad's); a piece placed on it (a Podium, the
  Curtains) stands on the deck. Its flat drawing and spotlight hide under the model; the On Stage badge still shows.

## Characters

The owner (2026-11-25): "The character model is also awful, needs to be way higher quality".
The owner (2026-11-27): "improve the avatar character models, they look rubbish at the moment, please make them more
detailed, more realistic and way better looking", then "they still look really goofy and rubbish, not like the
quality of a video game character which I want": game-artist models, in a stylised game look.

Every character (you, peers, the Receptionist) is an artist-made, rigged game character: Quaternius' Ultimate Modular
Men and Women packs (CC0, credited on the third-party licences page), one model file per pack, loaded the first time
3D draws a character of it (about 0.75 MB compressed each, cached). Each pack is one skeleton with swappable heads,
bodies, legs and feet, so a look (gender, clothes, hair, hair colour, shirt colour) puts together:

**Smooth, not faceted** (the owner, 2026-11-27: "Make it cleaner, like I see so many polygons all over it ... make it
smoother", and "without breaking the character model ... or changing it a lot"): the packs' models, colours, materials
and animations are drawn as shipped; only their shading changes. Each corner's normal is the average of the faces
meeting at its point within 60° of its own, so a round arm or face shades smoothly while a sole or a cuff stays crisp,
and the ink pass draws a character's outline against the scene but no ink across its facets and no occlusion speckle
on it (its pixels carry a mark in their alpha).

**Solid from every side** (the owner, 2026-11-27: "I can see through the back of the character models head into the
eyes, its scary"): a character and everything it holds or wears as a prop are drawn on both sides, as every Real 3D
material is, each face lit by its own normal. The Space's projection mirrors the screen, so a one-sided material
showed only its inner faces there (the inside of the far side of the head, and from behind the face through it); the
depth test now keeps the near, outer surface under the Space's projection and a plain camera (the model sheet, the
portraits) alike. Shadows are cast as before.

- the pack by gender;
- the body, legs and shoes nearest its outfit (a T-shirt and jeans, a hoodie, a suit, a vest and board shorts, a
  punk jacket, overalls, a hi-vis vest; a dress, a crop top), the shirt colour painting the garment (a suit takes
  its darker shade, a lab coat is white, a dress is one colour to its hem);
- the head nearest its hairstyle, the hair in its hair colour.

Every Clothes option and every Hair option the menu offers looks different in the scene (the owner, 2026-11-27: the
tiles must not repeat), without changing the packs' models:

- **Clothes**: all sixteen kept for both genders. An outfit with a part of its own wears it; the rest wear a distinct
  mix of the pack's bodies, legs and shoes, some with a fixed colour on a part the shirt does not paint (Stripes
  dark-blue jeans, Polo tan shorts, Turtleneck grey trousers, Jumper brown trousers, a man's Dress blue board shorts,
  a woman's Skirt a navy skirt, Overalls blue trousers, Hawaiian a sand pair; a woman's Flannel and Hawaiian wear the
  adventurer shirt). The looks that already had a body of their own keep exactly the appearance they had.
- **Hair**: each pack offers six styles it can draw as its own (`gameHairStyles`): a man Short, Buzz, Curly, Spiky,
  Mohawk, Bald; a woman Long, Bun, Short, Bob, Mohawk, Bald. Buzz is the short crop with its hair halfway to the skin
  (stubble), Bald all the way (shaved to the scalp). The others are dropped from that gender's Hair menu, and a look
  stored with one draws (and marks pressed) its nearest kept style: a man's Long, Ponytail, Bun, Top Knot, Braid
  as Short, Afro, Pigtails and Bob as Curly; a woman's Ponytail, Pigtails and Braid as Long, Top Knot as Bun, Spiky
  as Mohawk, Buzz, Curly and Afro as Short. The stored value is never rewritten, so livediagram's sprite still draws
  its own.

The packs' figures are made fuller than they come (the owner, 2026-11-27: "make them a bit fatter, too thin and
wiry"): torso, arms and legs thicker about their bones, head, hands and feet as they were. Their faces are drawn over
(the owner: "characters face detail needs to be higher"): eyes with a white, an iris (blue or green with fair or red
hair, grey-blue with grey or white, else brown), a pupil, a catchlight and a lash line; brows a shade deeper than the
hair; a nose; a smiling mouth with a lower lip. Each feature sits on the head's own surface and moves with it.

Until a pack has loaded, and if it fails to, a character is drawn as a modelled character
built in code from its look, in the sprite's colours: rounded head with a face and its own hairstyle, the outfit's
sleeves, collar, legs or skirt, and shoes.

It moves with the pack's own animations, blended by how fast it really moves:

- it faces the way it is really moving, any angle (a diagonal walk faces the diagonal), turning smoothly and leaning
  into the turn; stopped, it keeps the way it last faced until its facing changes;
- standing, it breathes and shifts its weight (the idle); moving, it cross-fades from the idle to the walk, and to the
  run only when it runs, each played faster or slower with the speed so its stride keeps pace with the ground. Every
  size's walk is the walk alone (the owner, 2026-11-27: "the walking doesn't feel very natural": a walk half blended
  with the run made the legs shuffle), and while the two do blend, the run keeps the walk's place in its stride;
- starting and stopping ease in and out (the cross-fade follows the eased speed);
- a wave plays the pack's own wave; sitting puts its hips on the seat's real height with thighs forward and shins
  down; cheering raises both arms, jumping jacks sweep them up overhead and spread the legs (each arm and leg easing
  there over about 0.1 s, never snapping into a T: the owner, 2026-11-27, saw the Receptionist flash one), a raised flag lifts the right arm with the flag upright
  in its hand, and a drink in hand is carried at the waist, the forearm bent up and the fingers closed round it (the owner, 2026-11-27: "do you think thats right for cofee?": not a pint pot through an open hand), life-sized and its own (a coffee mug with its handle, a water cup, a juice glass, a soda can), each posed over the animation in the
  character's own space.

The newer Behaviours are posed the same way, over the animation, each arm easing in and out over about 0.1 s:
**Raise Hand** lifts the right arm straight up beside the head, the hand open; **Clap** brings both forearms in front
of the chest, the hands meeting and parting on the beat; **Thumbs Up** raises the right forearm in front, the fingers
closed in a fist; **Point** holds the right arm straight out ahead, the index finger out and the others closed.

**Status signatures** ([Status](avatar-mode.md#status)) are props added to the character, built in code like the
drinks (small, life-sized, low-poly, lit by the scene) and made the first time a character wears them: head props on
an anchor at the head bone, kept in the character's own axes as the head was when dressed and scaled to sprite px, so
they turn and bob with the head; hand props in the hand like a drink, the arm carrying them at the waist (the
sandwich, the bottle) or raised to the ear (the phone). A drink, a Behaviour or a raised hand takes the hand first.
Their motion (twinkle, bob, steam, confetti, thought dots, a bite) is worked from the frame's clock and holds still
under reduced motion. They change nothing of the model itself (its parts, materials, colours, face or clips): a
character with no status is drawn exactly as it was.

The modelled stand-in moves the same way from code: planted feet (hip and knee solved from where each foot is), a
gait that quickens and lengthens with speed from a walk to a run, the body dipping and swaying with the stride.

A size choice scales the whole character. A [build](avatar-mode.md#build) (Skinny 0.82, Slim 0.91, Regular 1, Broad
1.1, Large 1.22) scales only its width and depth (the owner, 2026-11-27: "to make my character model more like me"):
the model's two horizontal axes, never its height, with the head bone scaled back by the inverse across its own
width and depth so the head keeps its proportions, and the prop in the hand scaled back the same way so a drink is
never stretched. The feet stay on the floor (the scale is about the feet, and height is untouched). Regular applies
no scale at all, so a Regular character is exactly the one drawn before the choice existed. The modelled stand-in
(before a pack loads) draws every build alike. Each look's tinted materials (and the stand-in's parts) are made once and
shared by everyone who wears it; each character has its own skeleton and animation mixer.

### Chips over heads

The name chip over a peer (and the Receptionist), and your own status chip, stand **clear above the head the scene
drew**, for every hairstyle and every status: measured from the figure, never a constant height. When a character is
dressed the scene measures how high its head reaches over its feet (its hair's top, from the dressed model), and when
it wears a status the top of each head prop worn (a party hat, a "?", the thought bubble) counts too (`StatusProps.reach`,
`status-props.ts`). Each frame, for a standing character, that height is projected through the camera, and the gap
between the feet and the head's top on the screen (in the chip card's own px, so less the zoom and the card's flat
scale, plus 3 px of air) is handed to the overlay as `--avatar-head-rise` (`lib/real-3d/head-rise.ts`; written only
when it moves half a pixel). The chip stands its usual rise above that, in place of the sprite's height and its status
headroom (`app/space-3d.css`). A sitter's chip keeps its own place over the seat. Before (QA 2026-11-27), a tall
hairstyle, or any status without a head prop (Available, Out to Lunch), put the chip over the face.

**A chip never grows past its size at the view's middle.** The overlay card a chip rides is scaled up as its feet come
nearer the camera; the chip itself is scaled back by the same amount (`scale: min(1, 1 / --space-flat-scale)`, about
its foot, so it stays over the head), so the Receptionist's chip at the foot of a small window is the size of everyone
else's at every zoom, and a far one still shrinks.

### Palette portraits

The owner (2026-11-27): "in walk mode in the palette, the previews of the items and character do not match reality".
Every picture of a character on the [avatar palette](avatar-mode.md#the-avatar-palette) (the Gender flyout's portrait
and its two tiles, the Clothes, Hair and Build tiles, the Actions cards and the preview card beside a flyout) is the game
character the scene draws, rendered from the same model:

- **Big enough to see.** The owner (2026-11-27): "make the previews bigger so I can actually see them better". A
  figure fills its tile: Gender and Clothes tiles 84 x 112 px pictures (132 px tiles), Build tiles 64 x 104 (128 px tiles,
  five across), Hair tiles a 76 x 72 head (104 px tiles).

- **The same character**: the look's pack, parts and tints (`gameLook`), lit by the scene's own sky and sun
  (`createLook`, without its shadows), in the scene's colours (unmanaged sRGB) and with its grade (a touch more
  saturation and contrast). Two options that wear the same part (Stripes and Polo both wear the T-shirt) show the same
  picture, because the scene draws them the same.
- **Framed for a portrait**, not the Space's camera: the character faces you, turned a little (15 degrees) so it has
  depth, seen from a little above (12 degrees), on a transparent ground. A whole-figure tile fits the figure's full
  height (and an Actions card the raised arms too); a Hair tile frames the head and shoulders so the hair is the
  picture; the preview card leaves room for a hop too.
- **An Actions card** shows the move's telling moment (`behaviourStill`): a Cheer's arms up, a Jumping Jack's arms
  out and legs apart, a Wave's hand up, a Spin turned side on, a Dance's raised arm.
- **The preview card** shows the look tried on as a large still, and a Behaviour played on a loop, posed each frame
  from the same `reactionPose` the canvas plays (its still under reduced motion). A status keeps its chip and Away its
  fade and Zz; nothing is drawn on the figure the scene does not draw (no headphones).
- **One renderer for all of them**: a single offscreen WebGL context, made on first use and released after 15 s with
  nothing to draw, never one per tile. A picture is rendered once per look, pose, crop and pixel size, kept as an
  image (160 kept, oldest out), and reused by every tile and every later opening. A character is dressed once per
  look and kept (24 looks), so its next picture only poses. The rendering is spread across frames (about 6 ms of
  work a frame, measured 2026-11-27 at a median of 3.4 to 3.7 ms a picture and 4.3 to 5.4 ms a frame) so opening a
  flyout never stalls the walk.
- **While the pack loads** (the first time, before the scene has drawn a character of that gender) a tile shows a
  quiet placeholder of its own size, never the old sprite; if the pack or WebGL fails, the tile falls back to the
  sprite, so there is always a picture.

## Grass

A lawn grows real grass (the owner, 2026-11-27: "make the grass look realistic, not just ugly green dots spread
apart"; later the same day: "make the grass look even better and more realistic"), replacing the old view's stood-up
rows of blades:

- blades scattered in clumps over the whole lawn, never in rows, inside its rounded edge with its soft rim showing;
  the same blades every time a lawn is drawn;
- each blade a thin tapered strip, its own height (5 to 8 canvas px, varying only a little across the lawn), its own
  bend (some nearly upright, some bowed well over) and a slight twist toward its tip, so no two blades share a shape;
- coloured from the lawn's colour as the floor under it is drawn on the tab's paper (light or dark), so blades and the
  ground between them are one lawn on either paper; dark at the root, where it melts into the ground, lighter and a
  touch warmer at the tip; each blade its own shade close to the lawn's colour (the owner, 2026-11-27: "the grass also
  still looks rubbish, its all patchy": an even, full lawn, never lighter and darker blotches or bare ground between
  clumps; now and then a dry blade), with broad, faint drifts of warmer and cooler green across a big lawn (hundreds
  of px across, never blotches) and now and then (about one clump in 30) a darker, taller tuft; no mown stripes;
- lit as the ground is and in the sun's shadows;
- swaying in a slow wind that rolls across the lawn in gusts, the tips moving, the roots still, each blade on its
  own beat and a taller blade further; all in the vertex shader, no work a frame but one number;
- the grass thins softly where the lawn ends: within 10 canvas px of its rim or of anything that covers it, blades
  grow shorter (down to about half), so it meets a path, a room or the stage as a mown edge, never a cut-off wall;
- a few wild flowers (small white daisies and yellow buttercups) in sparse drifts here and there, at most 4,000 in a
  scene, on the same wind;
- no blade or flower grows through what lies over the lawn (a room's floor, a corridor, an office pod, a path, a rug,
  the stage, water, the car park, stairs, the Avatar Pad) nor over what is read from above (a picture, a table); a
  round cover clears only its own outline, so the lawn grows right up to it rather than leaving a bare square round
  it: a Pond its oval, a round plaza (a square-ish Garden Path) its oval, the Avatar Pad its circle, and a Garden
  Path its rounded ends;
- the ink outline passes blades and flowers by, so a lawn is never a field of inked dots;
- as many blades as fill the lawn (one per 7 canvas px²), at most 160,000 in a scene: past that every lawn grows
  sparser alike, its blades a little wider (up to a third) so a big lawn still reads full at the same cost. Blades are
  one draw and flowers one more; a lawn regrows only when it, what covers it or the paper changes, once the change
  settles. Measured 2026-11-27 on the Festival Field (one 5.4 million px² lawn, Apple laptop GPU): see the blueprint.

## Moments

Using or walking past a piece plays its moment ([piece moments](3d-view.md)) in the scene: the
owner (2026-11-25): "remember to retain the effects all the elements had too ... like walking past a tree causes leaves
to fall off". The piece is lifted out of the scene for the moment and moved: a tree, an umbrella, a coat rack, a
hammock, curtains or a floor lamp rock away from you; small things shiver; anything else hops. Its particles play with it: leaves
falling from a tree or a plant, butterflies off a planter, a coin into the Fountain, Pond or Pool with ripples, sparks
off a fire, a puff from a kettle or a sink, a car's lamps flashing, a lamp's warm halo flickering, glints. `/document/real-3d-sheet?moment=<kind>`
replays one kind's moment for review.

## The office dog

A Pet Bed's dog ([Workday pieces](../009-elements/workday-pieces.md) "Pet Bed and its dog") is a model of its own in
the scene (the owner, 2026-11-27: "the dog doesn't seem to exist anymore nothing comes out of the bed"): a small,
round, low-poly sandy dog in the art's style, smooth and lit like the characters, with a darker head patch and floppy
ears, a cream snout and chest, a dark nose and eyes, a red collar with a gold tag, four legs and a tail.

- **Where it is and what it does are the dog's own**, unchanged: the same walk for everyone from the clock, its route
  round the pieces, its rests and naps, a pat that is yours alone. The scene reads them from the dog's hidden drawing
  each frame (where its feet are, mid-trot included; asleep or awake; trotting; a pat), as it reads the characters
  from their walkers, so nothing about the dog is worked out twice.
- **Asleep in its bed** it lies curled on the cushion, head down on its paws, eyes shut and tail round it, breathing
  slowly under a small "z". **Out of its bed** it trots on the floor, facing the way it goes and turning smoothly,
  legs stepping in diagonal pairs, body bobbing once a step and tail wagging; arrived, it lies down where it got to
  and rests. It lies down and gets up over a moment, never in a jump, and settles into its bed from wherever it
  arrives at it.
- **Patting it**: a press on the dog's model pats it, in Edit and in Walk, and never walks you, selects or drags. A
  heart rises over it and its tail wags fast for the pat's second and a half. Under the pointer it glows softly and the
  cursor is a hand, as any piece you can use.
- **Under reduced motion** it lies asleep in its bed and stays still; a pat shows the heart without its rise.
- It casts a shadow and is inked like the characters. Its few parts are made once per dog and freed with the scene.

## The camera

- A perspective camera at the 3D view's tilt (52 degrees from straight down), quarter or free turns, zoom about your character,
  as today.
- **The light** (the owner, 2026-11-27, of the flat, washed-out first look: "not achieving the level of polish,
  quality, finish and fidelity I wanted"): a warm sun from the front left and a cooler sky light, the sun clearly the
  stronger so every model is modelled by light and shade; every surface lit by its normal, so a curve shades smoothly.
  The sun casts soft shadows onto the floor and onto other models, following the middle of the view, crisp enough to
  read a chair's legs. Outlines are drawn in the art's outline colour.
- **Grounding**: every piece and character sits in a soft contact shadow under its footprint, darkest where it meets
  the floor, so nothing floats; creases where models meet (a chair under a desk, a cushion against a sofa's back) are
  shaded by a screen-space ambient occlusion pass.
- **Colour**: a gentle filmic grade over the drawn scene (a little more contrast and saturation, highlights rolled off
  rather than clipped), so the scene reads rich rather than washed out; the floor keeps its colours.
- **Click or tap to walk** casts a ray from the press to the ground; **a press on a piece** (to use it, to sit) picks
  the model under it: the nearest model box the ray enters, and the point where it meets it, kept inside the piece's
  box (so a press on a bench's left end picks its left seat).
- **The ink**: the scene is outlined in the art's outline colour, one pixel wide, wherever a piece or figure stands
  against what is behind it; a face seen at a slant is never inked across.
- **Cut-away**: walls between the camera and your character are cut down to a low capped wall (3d-view.md "Walls in
  front of you are cut away"), and the roof over you is lifted
  off. Any other wall or roof a sight line from your head to the camera passes through goes too, so a turn never leaves
  you behind a building. A piece never needs to.

## Rollout

1. **Prototype** behind `real3D` (now removed): floor, walls, doors, fences, roofs, characters, and the Phone Booth, Office Pod, Bench, Reception Desk and Fence as models, beside the current view
   for the owner to compare.
2. **Every kind** modelled (done 2026-11-25), and a test page that renders every kind x facing x camera turn, empty and sat in, as one
   contact sheet, kept as screenshot tests.
3. **Switch over**: done 2026-11-27, `real3D` and the 2D view removed, and the CSS view's walls, roofs and their
   rules deleted the same day; next the rest of the CSS 3D code (`space-3d-pieces.ts` lifts and slices,
   `space-3d-rows.ts`, the pod layer, `useFlatBillboards`).

## Performance

The 3D view's budget holds: 60 fps on a mid laptop on Virtual Office, 30 fps on a phone.

- **Loaded on first use**: the renderer (three.js) and the models load the first time a Space opens in a
  session; nothing of them is in the editor's first load. Their size is measured in the prototype and
  reported before the switch.
- **One draw per material per kind**: each kind's model is built once and drawn instanced for every piece of that kind;
  characters share one set of parts per look.
- **Measured** (2026-11-25, Company Campus, ego lite on an M-series laptop): about 613,000 triangles in the scene; the
  frame time is the same in 2D and 3D (the browser's frame cap), so the scene is not the limit there. A mid laptop and a
  phone are not measured yet.
- **Only near things are drawn**, chosen as the walls are today; the floor layer is one texture redrawn only when the
  board changes.
- **No work per step but the camera and the moving figures.**
- **Frame pacing** (the owner, 2026-11-27: "I want top notch performance"): at most 60 frames a second whatever the
  screen's rate, and 30 once the scene is calm (nobody moving, the camera still, no wall or roof easing, no moment
  playing, no pointer or key for 0.6 s), so idle breathing, grass and pets go on at half the cost. Measured on Team Pod
  in Brave on a 144 Hz screen, idle: page scripts 9.0% of a core before, 3.9% after.
- **Shaders compile off the main thread** (the owner, 2026-11-27: the page "freezes on load"): the GPU programs every
  material needs are compiled in parallel before the scene first draws, and the floor shows meanwhile, the scene
  fading in once its first frame is ready. The materials the scene only makes later (a moment's parts, a poster's
  picture, a desk's lit screen, a selection's marks) are compiled with them, and anything new later (a character's
  model arriving) holds the scene at most 0.4 s while its programs compile, never the page.
- **No hidden copies**: walls and roofs are the scene's alone; the old CSS view's walls and roofs are no longer built
  under it, and a modelled piece's hidden box is never stood up, raised or hung on its wall in the page (only an
  Office Pod's box still is).
- **No layout read per pointer move**: the canvas's box is measured when it moves or resizes, not on every move (it
  forced a layout of the whole page each time, the largest single cost while walking).

## Share roles

It only changes the viewer's own view, so every role has it, as the 3D view ([3D view](3d-view.md#share-roles)).

## Out of scope

- Tilting by hand (turns only), first-person, shadows cast by lights, 3D in exports.
