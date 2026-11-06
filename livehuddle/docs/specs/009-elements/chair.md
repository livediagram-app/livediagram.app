# Chair

A Behaviour element an Avatar-mode character **sits down in** when it walks
into one.

## Why

Avatar mode ([Avatar mode](../008-canvas/avatar-mode.md)) put people inside the canvas and gave them one thing to
do there: walk. A chair gives the room furniture, and furniture is what turns a
space into a place.

It earns its keep the moment a canvas has more than one: eight chairs around a
table is a seating plan, an attendance display, and a turn-taking device all at
once, drawn with elements the author already knows how to place. "Everyone grab
a seat" is a thing facilitators say, and on this canvas it becomes literal.

It is also the cheapest possible version of the idea: the walk hook already
fires when a character arrives on top of something, which is exactly how the
portal ([Portal element](portal-element.md)) works.

## The element

A **shape kind**, `chair`, in the palette's **Seats** category ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)), beside the desk, the sofa and the
meeting table.

- Drawn as a chair seen from above-front: a seat, a back, and a shadow, so it
  reads as furniture rather than as a box with a label. It is drawn **upright at every facing**
  (see [Facing](#facing)).
- **`ShapeElement.chairFacing`**: `'n' | 'e' | 's' | 'w'`, which way the seat
  points. Absent = `'n'` (back at the top, sitter facing down the canvas, toward
  the reader). Set from the element's context menu.
- **No settings `…` on its face.** Every other Behaviours card carries the
  shared ellipsis in its corner ([Canvas and palette](../008-canvas/canvas-and-palette.md)); a chair is furniture, not a card,
  and its one setting is set once from the element menu, so an ellipsis over
  the backrest only reads as a control on the seat.
- Its `label` is optional and renders under the chair: "Scribe", "Facilitator",
  "Alex": a chair that is somebody's chair.
- Otherwise a completely ordinary element: move, resize, rotate, theme, group,
  lock, copy, export.
- **One drawing, on the canvas and in an export.** The chair is a piece of the shared furniture table
  (`FURNITURE_ART` in `@livehuddle/document`) with the desk and the sofa: `FurnitureView` and the
  headless render (`svg-render-faces.ts`) both paint it, with one seat rule (`chairSeatFill`: the
  element's fill, or with the default `transparent` a wash of its stroke).
- **Animations ([Canvas and palette](../008-canvas/canvas-and-palette.md)) run on the drawing, not the box.** The element box is
  transparent, so the box versions of glow / pulse / trace / gradient would
  ring and fill a rectangle around nothing. Those four ride the chair's own
  silhouette instead (a drop-shadow, and a hue cycle for gradient), the same
  way a sticker's do ([Stickers](../010-palette/stickers.md)). The motion animations (bounce, float, swing,
  ...) move the whole element as they do on any other.

## Facing

Every piece of furniture (chair, desk, sofa) is drawn from **one camera**: the room's, looking down
at the canvas from the front at about forty-five degrees, the same camera the Avatar-mode characters
are drawn from. From it you see the tops of seats, desks and cushions, and the front face of anything
that faces you; **gravity always points down the screen**, so legs stand on the ground below the
piece and its shadow falls under it. Turning a piece **never rotates its drawing**: each facing has a
drawing of its own.

| Facing        | The sitter faces | What the room sees                                                 |
| ------------- | ---------------- | ------------------------------------------------------------------ |
| Down (`'n'`)  | down the canvas  | the **front**: the seat and the backrest's face behind it          |
| Up (`'s'`)    | up the canvas    | the **back**: the backrest's back nearest you, the seat beyond it  |
| Left (`'e'`)  | left             | the **side**: the seat from above, the backrest a bar on its right |
| Right (`'w'`) | right            | the side, mirrored                                                 |

- A side view keeps the piece's footprint: a sofa turned to face left is **tall**, its two cushions
  one above the other, its arms at the top and bottom ends and its legs only under its lower end.
  This is why a quarter turn swaps a desk's or sofa's box (below).
- The seat points and the occupied ring move with the drawing: a sitter lands on the seat in every
  view, never on a backrest.
- A desk's monitor turns with it: from the front you see its back, from the back its screen, from the
  side its edge on its stand.

## Sitting

Walking a character onto a chair seats it, fired **once on arrival** by the
same `useAvatarWalk` mechanism the portal uses (not every frame it stands
there).

- **Only the chair you are going to.** A click-walk sits you only in the piece its destination is in: clicking a
  chair (a desk, a sofa, a meeting table) walks you there and sits you down, but a walk to somewhere else that
  happens to cross a chair on the way walks straight through it, neither sitting you nor stopping you beside a
  taken one. Steering with the arrow keys sits you in whatever you steer into, since steering into a chair is
  choosing it; walking alongside one, feet outside it, never does. (`sitsOnEntry` in `@liveworkspace/avatar`'s
  walk.)

- The character **snaps to the chair's seat point** and switches to a seated
  pose: legs forward, body lowered, **facing the way the chair faces**
  (`n` down the canvas, `e` left, `s` up, `w` right: the same words the menu
  tiles use). The seat point turns with the chair, so the sitter lands on the
  seat rather than on the backrest of a sideways chair.
- **Any movement stands you up** (Work Tracker #560). While seated, a move is a move: an arrow key, a click or tap
  on the floor, on a piece or on a peer, or a walk somebody else starts for you (a Directory's Walk There, a talker's
  bars) stands the character up and starts that move in the same gesture, with no second press. Clicking **the piece
  you are sitting on** keeps you in it. Keys typed into a field (a panel's search, the message composer) are the
  field's, not movement, so typing never stands you up; nor do a pressed piece that acts in place, a reaction or a
  wave.
- **A taken seat is not sat in.** Walking into a chair somebody is already sitting in does not seat
  you: your character **stops beside it**, just outside the piece on the side it came from, and
  stays standing. A piece with more than one seat (a sofa, a meeting table) seats you on the **free
  seat nearest where you arrived**, and stops you beside it only when every seat is taken.
- **There is no Stand button.** Standing up is implied by moving, on a desktop and a touch screen alike, so the
  seated character carries no press of its own and a double-click means nothing more than a click.
- A seated character can still **wave and react** ([Avatar mode](../008-canvas/avatar-mode.md)). Sitting removes
  locomotion, not personality.
- A seated character **cannot be pushed** ([Avatar mode](../008-canvas/avatar-mode.md) "You can push each other"):
  clicking it walks you up beside it and sends no push, and a push that reaches a sitter anyway (they sat while you
  walked over) is ignored.

## Occupancy is presence, never document state

Who is in a chair rides the `avatar` RoomOp, as
`seatedOn: elementId | null` on `AvatarPresence`, with `seat: { index, at, tie }` beside it: which of
the piece's seats (`index`, in `seatPoints` order), when the sitter sat (`at`, their clock's epoch
milliseconds) and a random tiebreak drawn at that moment (`tie`). **Nothing is written to the
document.**

This is the rule that makes the feature safe, and it is [Avatar mode](../008-canvas/avatar-mode.md)'s rule
unchanged: everyone's character is authoritative on its owner's machine. So a
chair cannot be left permanently occupied by someone who closed their laptop, a
chair's occupancy cannot conflict between two clients, and no seating state
reaches the stored document or undo.

- The chair renders **occupied**: a soft ring in the sitter's presence colour
  and their name under it, derived from the peer presence the canvas already
  receives.
- **One sitter per seat, with no lock.** A seat is taken while somebody's presence says they sit in
  it; nothing else holds it, so it cannot get stuck. Two people who arrive at the same seat at once
  (each seated before the other's presence arrived) settle it the same way on every machine: the
  **earlier `at` keeps the seat, then the lower `tie`**, and the other stands up beside the seat as if
  they had found it taken. A packet without `seat` (an older client) holds the seat **nearest its
  feet** and counts as the earliest, since that client never gives a seat up.
- Sitting down and standing up are told to the room **at once**, not at the next heartbeat, so the
  seat reads taken or free to everyone within a packet's flight.
- A peer who leaves the mode, changes tab or disconnects vacates every chair
  for free, because their presence went away.

## Desk and sofa

Two more pieces of furniture seat a character exactly as a chair does, beside it in **Seats**:

- **Desk** (shape kind `desk`): a chair pulled up to a desk with a computer on it, the monitor's
  screen toward the room. Whoever sits at it **faces the computer**, so a new desk is placed with
  the desk at the back and the chair in front: `chairFacing` `'s'`, the sitter facing up the canvas
  with their back to the room.
- **Sofa** (shape kind `sofa`): a two-seater, a long back, two arms and two cushions. It has **two
  seat points**, and a character walking in sits on the one **nearest where it arrived**: walk in
  from the left, take the left cushion. A new sofa faces the reader (`'n'`).

Both share the chair's rules unchanged: the same `chairFacing` field and **Desk** / **Sofa**
menu section (the Chair section, titled for the furniture it is on), arrival seating through the
same walk hook, the same seated guards and ways of standing, and occupancy as presence (one ring in
the first sitter's colour, names above). A cushion takes one sitter, as a chair does; a sofa takes two.

Where they differ from the chair:

- **Turned, not stretched.** Neither is square, so turning one a quarter (Down to Left, say)
  **swaps its box about its centre** and shows its side view ([Facing](#facing)), so a sofa against
  a side wall is a tall sofa rather than a squashed one. A chair is square enough to turn in place.
- **Aspect locked** to their drawings, like the chair.
- **One drawing, on the canvas and in an export**: the chair, the desk and the sofa are a shared
  table of parts in `@livehuddle/document` (`FURNITURE_ART`), one drawing per view, that both
  renderers paint.

## Not in scope

- **No walk-to-the-nearest-free-chair.** Sit where you walked; a taken chair stops you beside it
  rather than sending you to another chair.
- **No table element.** A chair is furniture the room already knows how to
  arrange around whatever the author drew.
