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

A **shape kind**, `avatar-pad`, in the palette's **Travel** category ([The Space categories](../010-palette/palette-top-level-categories.md#the-space-categories)), beside the portal, the bring focus button and the link card:
like them it is somewhere a character goes. The tile reads
**Avatar Pad**. Search adds one in any mode, as it adds any element.

- **Drawn as a piece of the Space.** A round teleport platform seen from the room's camera angle, a little
  above, drawn in the same style as the furniture ([Office](office.md)): smooth vector shapes, outlined in the
  theme's line colour at the furniture's line weight, the platform's body in the same soft wash as a seat, its side
  shaded toward the room. A ring of brand-cyan light is set into a recessed well in the top, with a soft glow round a
  bright core where the character stands, and five small lamps glow along the rim's front. It scales cleanly at any
  size and zoom: no pixel grid, no blocky edges.
- **Alive, not busy.** The ring, its glow and the lamps breathe on a slow, gentle pulse (a fine-stepped fade, so it
  reads as eased while restyling only on its steps), so a pad on a still board still reads as switched on. It stops
  under reduced motion.
- **Theme lines, fixed light.** The outline and body follow the theme on light and dark paper, as every piece of
  furniture does, so the pad sits in the room. The light (ring, glow, core, lamps) keeps the avatar's own brand
  cyan whatever the theme, as a plant keeps its leaves: it is the part that says "the characters arrive here".
- **No label and no settings `…`.** There is nothing to write on it and nothing to set. Its hover card names it.
- **Its proportions are locked** (unlockable from the menu like any element), so the platform stays round. An
  unlocked, stretched box fits the drawing whole and centred; it never stretches it.
- **It lies on the floor.** Like a [rug or a room](office.md), it goes in behind everything when added, so
  furniture and characters stand on it. A character walks over it freely (it never blocks), and standing on it
  does not ring it as "the element you are on": the arrival is the pad's highlight.
- Otherwise an ordinary element: move, resize, rotate, lock, copy, delete, export.
- **One drawing, on the canvas and in an export**: both paint the same vector table in `@livehuddle/document`.
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
  you are looking at. Two pads exactly as close: the one first in the tab's element order (furthest back) wins, so the
  choice is the same on every screen showing the same view.
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

Like every Behaviour element ([Session tools (timer)](../012-collaboration/session-tools.md)): controls,
not candidates.

## Pressing it

- **A click on a pad starts Avatar mode on that pad**, for every role (anyone may walk): the character arrives on
  the pressed pad's core in its beam of light, whichever pad is nearest the view's centre, and the camera centres on
  it at 100% ([Avatar mode](../008-canvas/avatar-mode.md) "The camera"). It goes through the same pick as the picker
  and a Selection Mode button, so leaving the mode returns to the tool you were in.
- **Dragging it still moves it**: the press fires on `click` and is swallowed when the pointer travelled
  (`usePressWithoutDrag`, as the Portal and the Selection Mode button do). A hover card names it: **Start Walking
  Here**.
- Inside Avatar mode the canvas is pointer-inert, so a pad is walked onto, not pressed.
- Implementation: `AvatarPadView`'s `onPress`, threaded as `onPressAvatarPad`; the canvas sets the walk's one-shot
  `spawnPadRef` to the pad before the pick, and the walk's entry takes that pad over the nearest one.

## Telemetry

Per [Telemetry](../017-telemetry/telemetry.md): adding one emits the ordinary `Element·Added·Avatar-pad`, and
starting on a pad emits `track('Canvas', 'Used', 'AvatarPadArrival')`, once per entry, never per peer's arrival.

## Not in scope

- **No pad per person or per team.** Everyone starts on the same pad (or the nearest one).
- **No departure effect.** Leaving the mode takes the character away as it always has.
