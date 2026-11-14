# Fence

A Behaviour element an Avatar-mode character **cannot walk through**.

## Why

[Avatar mode](../008-canvas/avatar-mode.md) lets a room walk around a canvas, and until now the canvas
had no edges: a character could stroll through the middle of a board someone was still writing on,
stand on a facilitator's agenda, or wander into the one area a session wanted to keep clear.

A fence gives the author a way to say "not in here" with the same tools they use to say anything
else on the canvas: place it, stretch it, turn it. Fences joined end to end make a barrier of any
shape, so fencing off a board means drawing four fences round it. People can still walk all the
way round the outside; they cannot come in.

## The element

A **shape kind**, `fence`, in the palette's **Rooms** category ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)), beside
the room, the stage and the rug: the pieces a floor is laid out with.

- **Drawn as a fence**: square posts at both ends and at even spacing between, with two rails
  running the full length. It reads as a barrier, not as a box with a border.
- **One straight run per element.** The run lies along the element's **longer side**: a wide fence
  runs across, a tall one runs down. Resizing a fence past square turns it, so a horizontal fence
  stretched tall becomes a vertical one; rotating it like any element points it any other way.
- **Joined fences read as one.** The end posts sit half the fence's thickness in from each end and
  the rails run to the very ends, so two fences placed end to end continue each other's rails,
  and two fences whose boxes share a corner put their end posts on the same spot. The ordinary
  snap guides line their edges up.
- **No label and no settings `…`.** A fence is scenery, like a chair; there is nothing to write on
  it and nothing to set beyond its colour.
- **Its colour is its stroke.** Unstyled it is a wood brown that reads on light and dark paper;
  the stroke colour picker recolours posts and rails together.
- Otherwise an ordinary element: move, resize, rotate, group, copy, theme, export.
- **One drawing, on the canvas and in an export**: both draw from the shared fence geometry in
  `@livehuddle/document`.

## Blocking

While a character walks (a click-walk, the arrow keys, or a shove from a peer), **it cannot cross a
fence**, from either side.

- The blocking line is the fence's run: the centre line along its longer side, from end to end,
  turned with the element's rotation.
- A character keeps a small **reach** (its feet's width, so a Tall character's is wider than a
  Small one's) away from the line, so it stops at the fence rather than standing in it. Two fences whose ends are closer together than a character is
  wide leave no gap to squeeze through, so fences joined by hand need not meet exactly.
- **Walking into a fence slides along it.** A diagonal walk that meets a fence keeps the part of
  its movement that runs along the fence, so a character steered into a fence skims along it the
  way people walk along a wall. A click-walk that can make no progress stops where it is; stopped within two
  reaches of where it was going (a peer standing by a fence), it counts as arriving, so what waited on the arrival
  (a shove) still happens. Whether a walk slides or stops depends on its angle alone, never on the display's frame
  rate.
- **A character already inside a fence's reach** (a fence or a room dropped on top of one) may step away
  from it, never across it. One standing **in the fence itself**, within 8 px of its line (a room's wall is drawn
  5 px either side of it), is not held by it at all and walks off to either side, so a character left in a room's
  wall can click-walk into the room or out of it. No walk brings a character that close (the Small character's
  reach is 9.2 px), so only one put there walks through.
  A step along the fence, the same distance off it, is never read as closing in for rounding (a millionth of a px
  either way).
- **A footprint is solid** ([Office](office.md)): a character inside one (sat on a seat tucked into it, such as a
  Bar Stool tucked under a Bar's counter, or with scenery dropped on it) is never held there. Its edges refuse
  only a step that goes deeper in, measured from its nearest side, so the character walks along it and out of its
  nearest side, never further in and never stuck. Outside it, its edges block as any fence does.
- **What does not walk is not blocked.** A portal still carries a character through a fence (a
  portal is a gate), sitting snaps a character onto its chair, and a new character appears where
  the mode puts it. Put down beside a fence or wall, inside its reach but not in it, it is nudged just clear of it
  to the side its feet were on, so it never opens held where a click past the wall does nothing; put down in the
  wall itself, it stays there, free to walk off either side. The same nudge follows a fence or room moved,
  pasted or resized onto a standing character, once the change settles (never on each frame of a drag), and a seat
  snap or a step aside that lands inside a wall's reach. A character a footprint is moved onto, or a seat snap tucks
  into one, is not nudged (a nudge to the side its feet were on would push it deeper in): it walks out. **A new
  character never appears inside a footprint** (Work Tracker #610): entering the mode with the spot it would appear on
  (the view's centre, below a button, the remembered spot) inside a piece that blocks (a pool's or a pond's water, a
  plant's pot, a car) puts it on the nearest free floor instead, clear of every footprint and every wall's reach,
  looking in front of the piece (below it) first when two spots are as near. **Below water it keeps a body's height
  clear** (Work Tracker 706, #707, 800): a spot that would put the character's feet under a pool's or a pond's water,
  closer than its own height (at its size), moves straight down to that height below the water, since a body
  standing just under the water's lower edge is drawn over it and reads as standing in it. The height is the whole
  standing figure, its tallest hair included, and 16 px more (a pool's 14 px coping and 2 px of air), so the head
  stands on the deck below the coping and no hair tuft pokes into the water on a phone. It is taken whenever the
  water's bottom edge is as near as any other free floor, so a character entering centred on a pool appears on the
  deck below it, never round on the far bank. When no free floor lies within
  `SPAWN_SEARCH_MAX` (1200 canvas px), it appears where it would have, and walks out. A character that starts inside
  a fenced area stays inside until it takes a portal out.
- **A fence is not a destination.** Standing beside one does not ring it as "the element you are
  on".

## Who it blocks

Blocking is decided on each person's own machine for their own character, the same trust model as
the rest of [Avatar mode](../008-canvas/avatar-mode.md): everyone's character is authoritative on
its owner's machine. Nothing about blocking is written to the document or sent to the room; peers
simply never see a character on the far side of a fence because its owner's walk never got there.

## Share roles

- **Editor**: places, moves, resizes, turns, recolours and deletes fences, like any element.
- **Participant**: has no palette, so it places no fence; a Participant's character is
  blocked like everyone's.
- **Viewer**: cannot change a fence; a Viewer's character is blocked like everyone's.

## Not in scope

- **No gates.** A fence has no opening; leave a gap between two fences, or put a portal in it.
- **No bent fences.** One element is one straight run; corners are two fences.
- **No blocking of the canvas tools.** A fence stops characters, never cursors, selection,
  dragging or arrows.
