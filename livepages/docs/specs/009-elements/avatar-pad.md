# Avatar Pad

A Behaviour element that says **where Avatar-mode characters arrive**. While a tab has an Avatar Pad, anybody
who goes into [Avatar mode](../008-canvas/avatar-mode.md) starts standing on the pad, rather than wherever they
happened to be looking, and arrives in a beam of light in their own colour.

## Why

Avatar mode is how a room walks round a board together: a virtual office, a workshop space, a tour. Until the
pad, everyone appeared wherever the [Selection Mode button](mode-button.md) they pressed was, or in the middle of
whatever part of the canvas they had scrolled to, so a group arriving for a session landed scattered across the
board. A real space has an entrance. The pad is that entrance: the author puts it by the welcome sign, the lobby
or the first room, and everybody starts there.

## The element

A **shape kind**, `avatar-pad`, in the palette's **Collaborate** category under **Navigate** (Workshop's
palette), beside the portal, the chairs and the fence: like them it is somewhere a character goes. The tile reads
**Avatar Pad**. Search adds one in any mode, as it adds any element.

- **Drawn in the avatar's own pixel style.** A round teleport platform seen from the front and a little above,
  on the same coarse pixel grid and hard edges as the character ([Avatar mode](../008-canvas/avatar-mode.md)
  "The character"), in the sprite's own palette: the dark slate of its shoes for the outline, the trouser blues
  for the platform's side, the white-coat greys for its top, with a ring of brand-cyan light set into the top and
  a bright core where the character stands. Four small chevrons on the rim point in at the spot.
- **Alive, not busy.** The ring of light shimmers on a slow stepped loop (a few discrete brightness steps, the
  pixel-art way, never a smooth glow), so a pad on a still board still reads as switched on. It stops under
  reduced motion.
- **Fixed colours.** The pad keeps the sprite's palette whatever the theme, for the reason the character keeps
  its own: it belongs to the characters, not to the diagram, and a pad recoloured by a theme would stop looking
  like the thing they stand on.
- **No label and no settings `…`.** There is nothing to write on it and nothing to set. Its hover card names it.
- **Its proportions are locked** (unlockable from the menu like any element), so the pixel grid stays square.
  A resized pad scales its pixels; it never stretches them.
- **It lies on the floor.** Like a [rug or a room](office.md), it goes in behind everything when added, so
  furniture and characters stand on it. A character walks over it freely (it never blocks), and standing on it
  does not ring it as "the element you are on": the arrival is the pad's highlight.
- Otherwise an ordinary element: move, resize, rotate, lock, copy, delete, export.
- **One drawing, on the canvas and in an export**: both paint the shared pixel table in `@livepages/document`.
  The export draws the pad as it stands, ring lit; the shimmer and the arrival are the canvas's.

## Starting on the pad

Entering Avatar mode on a tab that has a pad puts the character's **feet on the pad's bright core**, facing
down, every time the mode is entered: from a Selection Mode button, after a detour to another tool, or after a
tab change. A pad wins over everything else that decides where a character appears, because the author who
placed it has said where people arrive:

1. A pad on the tab: the pad.
2. Otherwise, a Selection Mode button that hands out Avatar: just below that button.
3. Otherwise, the spot the character was left on, while it is still on screen.
4. Otherwise, the centre of the view.

- **The camera comes too.** When the pad's core is off screen, the view centres on it as the character appears,
  as it does on a trip through a [portal](portal-element.md). Zoom is never touched. A pad already on screen
  leaves the view where it is.
- **Several pads on one tab: the nearest wins.** The pad whose core is closest to the centre of your view when
  you enter the mode is the one you start on, so a big board with an entrance per area starts you at the area
  you are looking at. Two pads exactly as close: the one first in the layer order (furthest back) wins, so the
  choice is the same on every screen showing the same view.
- **Only what is drawn counts.** A pad on a hidden layer is not there: entry falls through to the rules after it.
- **Placing, moving or deleting a pad never moves anyone already walking.** A pad decides where people
  _arrive_; a character already in the mode stays where it is, on your screen and everyone else's, and the
  change applies at the next entry. The same goes for a peer moving the pad under you.
- Nothing about the spawn is stored or sent beyond the character's ordinary presence packet: where a character
  starts is its owner's machine deciding where to put it, the same trust model as the rest of Avatar mode.

## The arrival

A character that **appears on a pad arrives in a beam**: a column of pixel light in the arriving person's own
colour (their presence colour, their shirt's) drops onto the pad, flares, and lifts away, with a few square
sparkles rising out of it and the pad's ring flashing bright. It takes under a second and covers the figure while
it materialises, so the character seems to beam in rather than pop.

- **Everyone on the tab sees it.** Your own arrival plays when you enter the mode on a pad. A peer's plays on your
  screen when their character first appears to you standing on a pad: entering the mode, switching to this tab,
  or (once) when you join a room where they are already standing on one. It is derived on each machine from the
  presence packets everyone already sends; there is no arrival message, nothing stored, and nothing replayed.
- **One at a time per person.** A second arrival by the same person restarts theirs; at most
  `AVATAR_PAD_MAX_ARRIVALS` beams play on one screen at once, oldest dropped first, so a room of forty arriving
  together cannot fill the canvas with light.
- **Reduced motion: no beam.** The arrival is decoration; under `prefers-reduced-motion` (or the editor's own
  reduced-motion setting) the character simply appears on the pad, and the ring does not shimmer.
- A character walking onto a pad, or stepping out of a portal onto one, is not arriving: no beam.

## Share roles

- **Editor**: places, moves, resizes, turns and deletes pads, like any element.
- **Participant**: the Participant palette does not offer the pad, and a Participant cannot move or delete one.
  A Participant starts on it and sees arrivals like everyone.
- **Viewer**: cannot change a pad; starts on it and sees arrivals like everyone (Avatar mode is a Viewer's too).

What the pad does is gated on nothing: arriving changes nobody's document, so every role arrives the same way.

## Not votable

Like every Behaviour element ([Session tools (timer + voting)](../012-collaboration/session-tools.md)): controls,
not candidates.

## Telemetry

Per [Telemetry](../017-telemetry/telemetry.md): adding one emits the ordinary `Element·Added·Avatar-pad`, and
starting on a pad emits `track('Canvas', 'Used', 'AvatarPadArrival')`, once per entry, never per peer's arrival.

## Not in scope

- **No pad per person or per team.** Everyone starts on the same pad (or the nearest one).
- **No pressing it.** A pad is not a way into Avatar mode; a Selection Mode button set to Avatar is.
- **No departure effect.** Leaving the mode takes the character away as it always has.
