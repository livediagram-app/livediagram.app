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
- **No label, and one setting.** There is nothing to write on it. The tab's first pad has the
  [Receptionist](../008-canvas/receptionist.md#asking-him-to-leave): its element menu in Edit mode holds a
  **Receptionist** section with one switch, stored as `receptionistLeft: true` when he was asked to leave (absent is
  there). Another pad shows no section. Its hover card names it.
- **Its proportions are locked** (unlockable from the menu like any element), so the platform stays round. An
  unlocked, stretched box fits the drawing whole and centred; it never stretches it.
- **It lies on the floor.** Like a [rug or a room](office.md), it goes in behind everything when added, so
  furniture and characters stand on it. A character walks over it freely (it never blocks), and standing on it
  does not ring it as "the element you are on": the arrival is the pad's highlight.
- Otherwise an ordinary element: move, resize, rotate, copy, delete, export.
- **One drawing, on the canvas and in an export**: both paint the same vector table in `@livehuddle/document`.
  The export draws the pad as it stands, ring lit; the shimmer and the arrival are the canvas's.

## Every Space and blank tab has one

Walking is the default way to be in a Space (a Participant and a Viewer always walk; an Editor switches with the Walk
button), so every board starts with an entrance (owner, 2026-11-06: "Make sure all templates and blank tabs gain an
Avatar Pad - probably replace the old selection mode button").

- **Every Spaces template** (all twenty-six, in every category) places **one** pad, which replaced its **Walk In**
  [Selection Mode button](mode-button.md), **in the middle of the action** ([Where a Space's pad
  stands](#where-a-spaces-pad-stands)), with the how-to line centred under it (`arrival` in
  `packages/templates/src/template-arrival.ts`). A pad is a floor, so it comes first in the template's elements with
  the other floors (`floorsFirst` in `build-template.ts`).
- **A building's other floors** (the Hotel and Suites' Suites and Rooftop, the Co-working Tower's Level 2 and Level 3)
  have one too, by their Elevators and Directory: a ride still steps you out beside the Elevator, and someone who
  changes floor from the tab bar arrives on the pad, where the ride would have put them.
- **A blank tab gets one when it is started blank**: **Blank Space** chosen on Start a Space; the start's **×** (and
  Escape, and the phone's drag down), which starts from a blank space; an explicit blank (`/new?blank=1`,
  `/new?start=blank`); and an agent's blank tab (`buildTemplateTab` with `blank-session`). All of them are the Blank
  Space template's one element (`buildTemplate('blank-session')`).
- **Where on a blank tab**: centred across, a little below the middle of the view (its centre `BLANK_PAD_DROP`,
  160 px, below it), so the middle stays free to build in and the pad is in view at 100% on a desktop and a phone.
- **A new tab still opens on Start a Space, empty**: the tab bar's +, a new Space's first tab and a copy of an empty
  tab hold nothing until something is chosen, and the pad lands with the choice (a template bringing its own). Start a
  Space shows only on an empty tab, and the [empty-document clean-up](../013-workspace/empty-document-cleanup.md)
  sweeps a Space nobody started, so a pad on every tab from birth would have hidden the start and kept every
  abandoned Space forever.
- **A tab with nothing but its pad is still blank.** It does not [open walking](../008-canvas/avatar-mode.md#opening-walking)
  (there is nothing to walk round, and its Editor is about to build), and entering it does not fit the view to the
  pad: the view is centred `BLANK_PAD_DROP` above the pad, at the zoom it already has, so the pad sits below the
  middle just as it lands when the tab is started blank in the editor, wherever the tab was built (the `/new` route
  and an agent build it round (0, 0)) ([Fit-to-screen](../008-canvas/canvas-and-palette.md)). Choosing Blank Space likewise leaves the view where it was,
  selects nothing and keeps the tool in hand, as the empty blank did.
- **The × is not a pick**: it lands the same pad but counts no `Template·Used`.

### Where a Space's pad stands

Someone joining a Space arrives on its pad, and opening walking puts them in the middle of the screen at 100%
([The camera](../008-canvas/avatar-mode.md#the-camera)), so the pad decides what a newcomer sees first. It used to
stand at the entrance, under the plan's bottom-right corner, which left the newcomer at the edge of the Space, away from
everyone, and (seen from a seat near the bottom of a room, with the camera following) under the canvas's bottom-right
cluster (owner, Work Tracker #601: "Place the avatar pads in better locations so the avatar doesn't get lost right
away when joining, for example in the middle of a key room, or the centre of a courtyard"; #584).

- **In the middle of the action**: the Space's busiest shared room, its corridor, its lobby or its lawn, so the
  people, the seats and the stage are on screen around you when you arrive, at every window size.
- **On open floor**: neither the pad nor the Regular character standing on its core touches a wall, a fence or a piece
  of furniture; the pad lies on no Garden Path (its stones would hide under it) and on no Stage (the presenter's).
- **The how-to line under it**: centred under the pad and at most 360 px wide, so a phone's view centred on someone
  arriving (390 px at 100%) shows it whole; never over a piece or a wall (it may cross a path). Where the floor is
  narrow the line is narrower and wraps, or says less. (A line level with the pad, beside it, ran off a phone's screen:
  PR #1386's browser check.)
- **Inside the plan**: never in the margin under it or in its bottom-right quarter, where the bottom-right cluster
  floats. A building's other floors keep theirs by the Elevators.

| Space            | Where everyone arrives                                                                  | Line width |
| ---------------- | --------------------------------------------------------------------------------------- | ---------- |
| Virtual Office   | The middle of the corridor every room opens onto, between the Desks' and Lounge's doors | 360        |
| Coworking Space  | The open floor between the desk clusters and the lounge                                 | 160        |
| Team Pod         | The middle of the pod, between the desks and the table                                  | 320        |
| All-Hands Hall   | The centre aisle among the rows, facing the stage (the line a narrow sign down it)      | 140        |
| Focus Library    | The open floor between the two rows of desks                                            | 320        |
| Training Room    | The middle of the room, the four tables round it and the stage ahead                    | 360        |
| Rooftop Bar      | The middle of the terrace, the bar ahead and a sofa either side                         | 360        |
| Cafe             | The middle of the cafe, the counter, coffee machine and tables round it                 | 360        |
| Garden Retreat   | The lawn beside the summer house, its door and the campfire in view                     | 360        |
| City Park        | The lawn above the fountain plaza, between the north path and the trees                 | 260        |
| Company Campus   | The Auditorium, in the aisle between its first two rows                                 | 360        |
| Conference Venue | The Main Hall, in the aisle between its first two rows                                  | 360        |
| Startup HQ       | The Town Hall, in the aisle between its first two rows                                  | 360        |
| School Quad      | The Lecture Hall, in the aisle between its first two rows                               | 360        |
| Hotel and Suites | The lobby, before the reception desk, between the columns and the Directory             | 240        |
| Co-working Tower | The lobby, between the Hot Desks' door and the Lifts                                    | 360        |
| Expo Hall        | The aisle between the stage's two rows of chairs, the booths either side                | 360        |
| Beach Offsite    | The sand between the huts' walk and the campfire                                        | 360        |
| Festival Field   | The crowd field in front of the Main Stage, the stage ahead and the stalls to the left  | 360        |

A campus lands you in its main hall, where the all-company moments happen; its Directory stays just inside the gate.

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
- **Participant**: has no palette, so it places no pad, and cannot move or delete one.
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
