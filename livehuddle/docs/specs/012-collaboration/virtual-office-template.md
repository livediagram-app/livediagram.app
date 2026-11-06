# Virtual Office and space templates

A template that starts a team with a whole office to walk round in
[Avatar mode](../008-canvas/avatar-mode.md), built from the [office pieces](../009-elements/office.md) and the
[furniture](../009-elements/chair.md), so nobody has to draw a floor plan before they can meet in it.

## The board

A title, **Our Office**, with a waving sticker and a line inviting people to walk in and rename the rooms. Under it,
six [rooms](../009-elements/office.md#room) either side of a corridor, every doorway opening onto the corridor:

| Row    | Room             | What is in it                                                                                                                                                                                                                      |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top    | **Reception**    | A sofa facing the room on a rug, a plant either side; a coat rack and an umbrella stand by the door                                                                                                                                |
| Top    | **Desks**        | Six desks in two rows, every sitter facing their screen; a bookshelf, a plant and a printer                                                                                                                                        |
| Top    | **Meeting Room** | A [meeting table](../009-elements/office.md#meeting-table) of six, a plant either side                                                                                                                                             |
| Bottom | **Kitchen**      | A kitchenette along the back wall ([Office amenities](../009-elements/office-amenities.md)): a fridge, a counter with a microwave and a kettle, a sink and a coffee machine; a water cooler, a plant, two chairs facing each other |
| Bottom | **Lounge**       | A bookshelf, a sofa on a rug, two chairs facing in, a plant                                                                                                                                                                        |
| Bottom | **Focus Room**   | One desk on its own, a bookshelf and a plant                                                                                                                                                                                       |

At the corridor's end: an [Avatar Pad](../009-elements/avatar-pad.md), the office's entrance, where everyone arrives
in a beam of light, and a line beside it saying how to walk, talk, sit and get a coffee.

Every Space's pad stands on open floor, with room above it for the character standing on it: the character's feet go
on the pad's core ([Entering on a pad](../008-canvas/avatar-mode.md#entering-on-a-pad)), so neither the pad nor that
figure ever overlaps furniture or a wall. The pad stands `WAY_IN_CLEAR` (72 px) below the wall or fence above it, which
clears a Regular character's head; a test checks the pad and the standing figure in every Space.

Before 2026-11-06 the way in was a [Selection Mode button](../009-elements/mode-button.md) labelled **Walk In** in the
pad's place, with the character opening below it. The pad replaced it (owner, 2026-11-06: "Make sure all templates and
blank tabs gain an Avatar Pad - probably replace the old selection mode button"): walking is the default way to be in a
Space, so the board needs an entrance, not a switch. A Space made before keeps its button, which still works.

- The rooms are first in the tab, so they lie under the furniture; the rugs come next.
- Every room keeps its name as its label, so renaming one is renaming the room.
- The tab opens on a meeting board ([The meeting board](workshop-mode.md)) on grid paper.

## Spaces

Nine siblings, built the same way (`template-office-parts.ts`: open-air floors such as grass and garden paths first,
then rooms, rugs and stages, furniture after, and an **Avatar Pad** with a how-to line under the plan, beside it for the Team Pod). The first
three (`template-builders-spaces.ts`):

- **Coworking Space**: one open room of two desk clusters (four desks each pair facing across a shared bench), a coffee
  bar (coffee machine, water cooler, plant), a lounge (a sofa and two chairs round a rug), a bookshelf, and two
  **phone booths** along the right, small rooms with one chair each for a call away from the floor.
- **Team Pod**: one room for a small team: a cluster of four desks, a meeting table for the stand-up, a coffee
  machine, a plant and a bookshelf, and beside it a **Team Board** of four stickies (This week, Blocked on, Wins,
  Questions). Its Avatar Pad waits **beside the pod, under the Team Board**, level with the pod's lower half and low enough that someone standing on it stands clear of the board, its how-to
  line wrapped beside it in the board's column, not under the plan like the other Spaces' (Work Tracker #580). Seen
  at 100% from a desk or the table, the pod's bottom edge lies along the canvas's bottom, where the bottom-right
  cluster floats, and a way in under the pod sat under the cluster. Open floor lies under the pad, and the door is
  a short walk round the pod's corner.
- **All-Hands Hall**: one big room with a real [Stage](../009-elements/office.md#stage) up front (400 × 160,
  centred, with Show Cameras on; whoever speaks from it is heard by the whole hall,
  [Meeting rooms and the stage](meeting-rooms-and-stage.md#the-stages-way-in-part-4-built)) and a [Bring Focus](bring-focus.md) button
  for the presenter, thirty-two chairs in four rows facing the stage either side of a centre aisle, plants and a
  water cooler.

And six more, one module a category (`template-builders-office-more.ts`, `template-builders-events.ts`,
`template-builders-recreation.ts`, `template-builders-outdoor.ts`):

- **Focus Library** (Office): one quiet room, a row of bookshelves and six study desks, two **Office Pods** along the
  back for a call for two, a reading corner (a sofa and a chair on a rug) and a water cooler.
- **Training Room** (Events): one room with a small Stage up front (cameras on) and Bring Focus beside it, four meeting
  tables in two pairs either side of a centre aisle for group work, a coffee machine, a water cooler and plants.
- **Rooftop Bar** (Recreation): an open terrace (one room) with a long **Bar** of two counters and eight **Bar Stools**
  in front of it, a **Drinks Cabinet** and a **Drinks Fridge** behind, two lounges (a sofa and a chair on a rug each)
  either side of the doorway, trees and **Outdoor Plants** round the edge.
- **Cafe** (Recreation): a counter (a Bar) with four stools, a coffee machine and a drinks fridge behind it, two tables
  (meeting tables) on the right, a pair of chairs facing each other, and a sofa nook on a rug.
- **Garden Retreat** (Outdoor): a lawn of **Grass** fenced by a **Garden Fence** with a gateway in the bottom, a
  **Garden Path** from the gate to a **Summer House** (a room with a meeting table) and two side paths, one to a
  **Bench** and one to two chairs round a **Campfire**, a **Pond** under the trees, **Trees** and Outdoor Plants round
  it (the social pieces: [social-pieces.md](../009-elements/social-pieces.md)).
- **City Park**: an open lawn crossed by two Garden Paths that meet at a round plaza with a **Fountain** in its
  middle, trees in each corner, two **Benches** facing the plaza, a **Picnic Table**, and a bandstand (a Stage) with
  four chairs facing it.

The open-air Spaces have no walls round them: the fence and the trees hold the edge, and the Avatar Pad waits under the
gate or the path, so walking in is walking up it.

## Campus Spaces

Whole sites, the **Campus** category: offices, a hall with a Stage and a bar, each its own room, set in
a fenced garden that joins them up, so one Space holds the whole working day (`template-campus-parts.ts`,
`template-builders-campus.ts`, `template-builders-campus-more.ts`).

- **Company Campus**: down the left, **Desks** (two islands of four), a **Meeting Room** (a table and a Screen) and a
  **Focus Room**; across the top, an **Auditorium** with a Stage (cameras on), a Screen, Bring Focus and sixteen chairs
  in two rows either side of a centre aisle; down the right, a **Bar** (a bar with four stools, a drinks cabinet and
  fridge, a jukebox, a sofa and a chair on a rug) and a **Games Room** (a ping-pong table, two arcade machines, a
  fireplace, a sofa and a chair on a rug). Between them a garden: a walk along each column's doors, a cross path
  between them and the main path from the gate to the auditorium meeting at a round fountain plaza, benches facing
  it, a picnic table, a pond, a garden umbrella, a hammock and trees.
- **Conference Venue**: across the top, a **Foyer Bar**, a **Main Hall** (a Stage, two Screens, Bring Focus and twenty
  chairs in two rows either side of a centre aisle) and a speakers' **Green Room**; along the bottom, **Breakout 1** to
  **Breakout 3** (a table and a Screen each) and a **Quiet Room** of two Office Pods. Between them a courtyard: a
  promenade with a path to every door, crossing the main path at a round fountain plaza, a cafe terrace of garden
  umbrellas, two ponds, benches and trees.
- **Startup HQ**: along the top, a **Studio** (two islands of four desks, a bookshelf, coffee and a notice board), a
  **Town Hall** (a Stage, a Screen, Bring Focus and twelve chairs) and a **Kitchen Bar** (a bar with stools, coffee, two
  chairs); below, a **Games Room** (a ping-pong table, two arcade machines and a jukebox). The garden in front is
  for working outside: a path along the front meeting the main path at a small round junction, a campfire circle of
  three chairs, two **Office Pods** on the lawn for calls, a pond, a hammock, trees and a garden umbrella.

- **Hotel and Suites** (three floors, three tabs, [Spaces with floors](#spaces-with-floors)): the **Lobby** (marble),
  with a reception, sofas on rugs and the **Lobby Lift**, round it a **Lobby Bar** (a bar with stools, a drinks cabinet,
  a sofa on a rug), a **Ballroom** (a Stage, a Screen, Bring Focus and twelve chairs either side of a centre aisle), a
  **Business Centre** (a table and a Screen) and a **Library Lounge** (shelves, a fireplace, a sofa on a rug); the
  **Suites** (carpet), six suites either side of a corridor, each a sofa on a rug, a desk and a plant, with the
  **Suites Lift** and a Directory at the corridor's end; the **Rooftop** (decking), a **Rooftop Bar**, a **Spa Room**
  of two Office Pods and an open terrace of garden umbrellas, hammocks, planters and a long water garden (a Pond), with
  the **Rooftop Lift**.
- **Co-working Tower** (three floors, three tabs): the **Ground Floor** (wood), with **Hot Desks** (three islands of
  four, a print corner and lockers), a **Meeting Room**, a **Cafe** (a counter with stools, coffee, a fridge, two chairs)
  and the **North Lift** and **South Lift** off the open floor by the entrance, a coat rack and an umbrella stand
  inside it; **Level 2** (carpet tiles), **Phone Booths** (six Office Pods in two rows), a **Quiet Room**, two meeting
  rooms and a **Restroom** (two cubicles, a hand dryer and two basins); **Level 3** (parquet), the **Event Floor** (a Stage, two Screens, Bring Focus
  and twenty chairs either side of a centre aisle), a **Green Room** and a **Roof Bar**. Every floor has both lifts,
  in the same places, so riding one steps out where you expect.
- **School Quad** (one tab, a garden): a **Lecture Hall** (a Stage, a Screen, Bring Focus and twelve chairs), two
  classrooms (**Classroom A**, **Classroom B**: two rows of desks facing a Screen), a **Library** (shelves and desks)
  and a **Canteen** (a counter with stools, coffee and a table), round a grassy quad: a path round the quad to every
  door, a main path from the gate meeting the walk at a round fountain plaza, benches, trees and
  a picnic table.

What every campus shares:

- **Rooms are closed, with a Door.** Every room has `roomDoor: 'none'` and one [Door](../009-elements/room-builder.md#door)
  standing in the middle of the wall that faces its path, snapped onto that wall as a placed Door is.
- **Every door is on a path.** Indoors, a Door opens onto the floor's open corridor or lobby (at least 160 px clear in
  front of it). Outdoors, a short Garden Path runs out from every Door to a walk, and the walks join into one
  network that reaches the gate. Paths join as [Garden Path](../009-elements/office.md#garden-path) says: a path that
  meets another ends under it, and where two would cross they meet at a round plaza (a fountain plaza, or a small
  junction), so no stone ever lies under another path or a piece.
- **Every room is signed.** A [Room Sign](../009-elements/screen-and-room-sign.md#room-sign) 88 px wide stands beside
  each Door's path: on the lawn against a side or bottom wall, or on the face of a back wall (right of the Door, clear
  of the room's name), so its centre is within the 64 px a sign reaches for its room's floor. A walk
  keeps far enough from the wall (110 px from a side wall, 72 px from a top or bottom one) that the sign stands clear of
  it.
- **The arrival point.** The Avatar Pad waits under the gate in the bottom fence, and a
  [Directory](../009-elements/directory.md) stands just inside the gate beside the main path, listing every room with a
  Walk There. A site on one tab has no Elevator; a site with floors arrives on its first floor and rides between them
  ([Spaces with floors](#spaces-with-floors)).
- **Room to walk.** Every aisle between seats is at least 120 px clear (two Regular characters, 2 × 40 × 1.5; a seat
  takes a character only when its feet step onto it, so no catch distance is added): seats side by side are one row
  (16 px or less apart) or an aisle apart, and one behind the other share an edge or are an aisle apart. A hall's
  centre aisle is 160 px wide, the first 96 px inside every Door is clear of seats and scenery, and no seat stands on a
  path.
- **Sizes.** The garden sites are 2100 to 2560 px wide and 1300 to 1460 px tall under the heading, rooms at the other Spaces'
  scale (a room 220 to 640 px deep, a hall 960 to 1120 px wide); they open walking, like every Space, so the camera
  follows the character rather than fitting the site.

## Spaces with floors

The **Hotel and Suites** and the **Co-working Tower** are buildings, one floor per tab
([Templates by mode](../007-editor/templates-by-mode.md#a-template-with-floors)):

- **The first floor arrives.** It has the Avatar Pad at its entrance and a Directory beside it, like every Space. The
  other floors are arrived at by [Elevator](../009-elements/elevator.md), and a Directory stands beside each floor's
  Elevator. Each of them has an Avatar Pad too, by its Elevators and its Directory, on open floor: a ride steps you
  out beside the Elevator as before, and someone who changes floor from the tab bar (a Participant or a Viewer, who
  are always walking) arrives on the pad rather than in the middle of the view.
- **Named Elevators.** Every floor has its Elevators named after the floor or their place ("Lobby Lift", "North
  Lift"), so the Elevator panel reads like a building's directory. The Co-working Tower's lifts stand in the same place
  on every floor.
- **Each floor is its own Space plan**: a heading naming the floor, closed rooms with a Door and a Room Sign each, and
  the same aisle and door rules as the other Spaces. A floor's tab is named after the floor ("Lobby", "Suites",
  "Rooftop"), and each floor has its own floor pattern.

## More Spaces

- **Expo Hall** (Events, one tab, concrete): sponsor booths, twelve **Office Pods** in rows of three, round a central
  keynote **Stage** with Bring Focus and twelve chairs on the open floor, aisles of at least 160 px between the rows; a
  **Food Court** (two counters with stools, coffee and tables), a **Speaker Lounge** and a **Meeting Room**, each closed
  with a Door and a Room Sign; the Avatar Pad at the entrance with a Directory beside it.
- **Beach Offsite** (Outdoor, also in Campus; one tab, sand): a **Beach Hut** to meet in (a table and a Screen) and a
  **Tiki Bar** (a bar with stools, a drinks fridge, a jukebox), each closed with a Door and a Room Sign, joined by
  stone paths across the sand to the gate; a campfire circle of benches, hammocks under the palms (trees), garden
  umbrellas and a lagoon (a Pond).

## Where they are

In five categories, **Campus**, **Office**, **Events**, **Outdoor** and **Recreation**
([Template categories](../008-canvas/canvas-and-palette.md#template-categories)), on every start and on the marketing
gallery. Since Work Tracker #423 they are livehuddle's whole catalogue with Blank Space, and four of them lead Popular
([Templates by mode](../007-editor/templates-by-mode.md#the-catalogue)). They were one **Virtual Spaces** category
while there were four; it split by kind of place when the six more arrived, and Campus came with the three sites.

## Share roles

As every template: an Editor creates a document or tab from it. Everyone on the board walks, sits, talks and drinks
in it ([Office](../009-elements/office.md#share-roles)). What the spaces add follows the elements' own rules:

- **The hall's Bring Focus**: an Editor presses it; a Participant or a Viewer cannot
  ([Bring Focus](bring-focus.md#rules)).
- **The Team Board's stickies**: an Editor and a Participant write on, move and recolour them; a Viewer reads them
  ([Share roles](../013-workspace/share-roles.md)).
- The **raised hand** an attendee is told to use is Behaviour › Wave, which every role may do and everyone sees;
  a Reactions burst plays on its sender's screen only ([Avatar mode](../008-canvas/avatar-mode.md)).
