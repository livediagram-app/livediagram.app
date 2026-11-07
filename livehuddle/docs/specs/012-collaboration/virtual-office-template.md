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
| Top    | **Meeting Room** | A [meeting table](../009-elements/office.md#meeting-table) of six, a plant either side; glass walls and a sliding glass door, so you see who is meeting                                                                            |
| Bottom | **Kitchen**      | A kitchenette along the back wall ([Office amenities](../009-elements/office-amenities.md)): a fridge, a counter with a microwave and a kettle, a sink and a coffee machine; a water cooler, a plant, two chairs facing each other |
| Bottom | **Lounge**       | A bookshelf, a sofa on a rug, two chairs facing in, a plant, and the office dog's [Pet Bed](../009-elements/workday-pieces.md#pet-bed-and-its-dog)                                                                                 |
| Bottom | **Focus Room**   | One desk on its own, a bookshelf and a plant                                                                                                                                                                                       |

In the middle of the corridor, between the Desks' door and the Lounge's: an [Avatar Pad](../009-elements/avatar-pad.md),
where everyone arrives in a beam of light, and a line under it saying how to walk, talk, sit and get a coffee.

Every Space's pad stands in the middle of the action, on open floor, with room above it for the character standing on
it ([Where a Space's pad stands](../009-elements/avatar-pad.md#where-a-spaces-pad-stands)): the character's feet go on
the pad's core ([Entering on a pad](../008-canvas/avatar-mode.md#entering-on-a-pad)), so neither the pad nor that
figure ever overlaps furniture or a wall; a test checks the pad, the standing figure and the how-to line in every
Space.

Before 2026-11-06 the way in was a [Selection Mode button](../009-elements/mode-button.md) labelled **Walk In** in the
pad's place, with the character opening below it. The pad replaced it (owner, 2026-11-06: "Make sure all templates and
blank tabs gain an Avatar Pad - probably replace the old selection mode button"): walking is the default way to be in a
Space, so the board needs an entrance, not a switch. A Space made before keeps its button, which still works.

- The rooms are first in the tab, so they lie under the furniture; the rugs come next.
- Every room keeps its name as its label, so renaming one is renaming the room.
- The tab opens on a meeting board ([The meeting board](workshop-mode.md)) on grid paper.

## Spaces

Nine siblings, built the same way (`template-office-parts.ts`: open-air floors such as grass and garden paths first,
then rooms, rugs and stages, furniture after, and an **Avatar Pad** in the middle of the action with a how-to line under it). The first
three (`template-builders-spaces.ts`):

- **Coworking Space**: one open room of two desk clusters (four desks each pair facing across a shared bench), a coffee
  bar (coffee machine, water cooler, plant), a lounge (a sofa and two chairs round a rug), a bookshelf, and two
  **phone booths** along the right, small rooms each holding a [Phone Booth](../009-elements/workday-pieces.md#phone-booth)
  for a call away from the floor.
- **Team Pod**: one room for a small team: a cluster of four desks, a meeting table for the stand-up, a coffee
  machine, a plant and a bookshelf, and beside it a **Team Board** of four stickies (This week, Blocked on, Wins,
  Questions). Its Avatar Pad waits **in the middle of the pod**, between the desks and the table, its how-to line under
  it (Work Tracker #601). It first stood under the pod's door, where (seen at 100% from a desk or the table, the pod's
  bottom edge along the canvas's bottom) it sat under the bottom-right cluster, then beside the pod under the Team
  Board (#580).
- **All-Hands Hall**: one big room with a real [Stage](../009-elements/office.md#stage) up front (400 × 160,
  centred, with Show Cameras on; whoever speaks from it is heard by the whole hall,
  [Meeting rooms and the stage](meeting-rooms-and-stage.md#the-stages-way-in-part-4-built)) and a [Bring Focus](bring-focus.md) button
  for the presenter, [Stage Curtains and a Podium](../009-elements/venue-pieces.md#stage-curtains-podium) on the
  stage, thirty-two chairs in four rows facing the stage either side of a centre aisle, plants and a
  water cooler.

And six more, one module a category (`template-builders-office-more.ts`, `template-builders-events.ts`,
`template-builders-recreation.ts`, `template-builders-outdoor.ts`):

- **Focus Library** (Office): one quiet room, a row of bookshelves and six study desks, two **Office Pods** along the
  back for a call for two, a reading corner (a sofa and a chair on a rug) and a water cooler.
- **Training Room** (Events): one room with a small Stage up front (cameras on, a Podium on it) and Bring Focus beside it, four meeting
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
`template-builders-campus.ts`, `template-builders-campus-more.ts`). Campus keeps the company and education sites (the
Company Campus, the Startup HQ, the School Quad and the Co-working Tower); the Conference Venue and the Hotel and Suites,
built the same way, are filed under [Venues](#venues) since Work Tracker #641.

- **Company Campus**: down the left, **Desks** (two islands of four), a **Meeting Room** (a table and a Screen) and a
  **Focus Room**; across the top, an **Auditorium** with a Stage (cameras on), a Screen, Bring Focus and sixteen chairs
  in two rows either side of a centre aisle; down the right, a **Bar** (a bar with four stools, a drinks cabinet and
  fridge, a jukebox, a sofa and a chair on a rug) and a **Games Room** (a ping-pong table, two arcade machines, a
  fireplace, a sofa and a chair on a rug). Between them a garden: a walk along each column's doors, a cross path
  between them and the main path from the gate to the auditorium meeting at a round fountain plaza, benches facing
  it, a picnic table, a pond, a garden umbrella, a hammock and trees; by the gate, a
  [Car Park](../009-elements/venue-pieces.md#car-park-bike-rack) of two rows and a Bike Rack.
- **Conference Venue**: across the top, a **Foyer Bar**, a **Main Hall** (a Stage with Stage Curtains and a Podium, two Screens, Bring Focus and twenty
  chairs in two rows either side of a centre aisle) and a speakers' **Green Room**; along the bottom, **Breakout 1** to
  **Breakout 3** (a table and a Screen each) and a **Quiet Room** of two Office Pods. Between them a courtyard: a
  promenade with a path to every door, crossing the main path at a round fountain plaza, a cafe terrace of garden
  umbrellas, two ponds, benches and trees.
- **Startup HQ**: along the top, a **Studio** (two islands of four desks, a bookshelf, coffee and a notice board), a
  **Town Hall** (a Stage, a Screen, Bring Focus and twelve chairs) and a **Kitchen Bar** (a bar with stools, coffee, two
  chairs); below, a **Games Room** (a ping-pong table, two arcade machines and a jukebox). The garden in front is
  for working outside: a path along the front meeting the main path at a small round junction, a campfire circle of
  three chairs, two **Office Pods** on the lawn for calls, a pond, a hammock, trees, a garden umbrella and a Bike Rack
  by the gate.

- **Hotel and Suites** (three floors, three tabs, [Spaces with floors](#spaces-with-floors)): the **Lobby** (marble),
  with a reception, sofas on rugs, four [Columns](../009-elements/venue-pieces.md#pillar-column) and the **Lobby Lift**, round it a **Lobby Bar** (a bar with stools, a drinks cabinet,
  a sofa on a rug), a **Ballroom** (a Stage, a Screen, Bring Focus and twelve chairs either side of a centre aisle), a
  **Business Centre** (a table and a Screen) and a **Library Lounge** (shelves, a fireplace, a sofa on a rug); the
  **Suites** (carpet), six suites either side of a corridor, each a sofa on a rug, a desk and a plant, with the
  **Suites Lift** and a Directory at the corridor's end; the **Rooftop** (decking), a **Rooftop Bar**, a **Spa Room**
  of two Office Pods and an open terrace of garden umbrellas, hammocks, planters and a rooftop
  [Swimming Pool](../009-elements/venue-pieces.md#swimming-pool), with
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
- **The arrival point.** The Avatar Pad waits in the site's main hall (the Auditorium, the Main Hall, the Town Hall,
  the Lecture Hall), in the aisle among its rows ([Where a Space's pad
  stands](../009-elements/avatar-pad.md#where-a-spaces-pad-stands)), and a [Directory](../009-elements/directory.md)
  stands just inside the gate beside the main path, listing every room with a Walk There. A site on one tab has no Elevator; a site with floors arrives on its first floor and rides between them
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

- **The first floor arrives.** It has the Avatar Pad in its lobby and a Directory by the entrance, like every Space. The
  other floors are arrived at by [Elevator](../009-elements/elevator.md), and a Directory stands beside each floor's
  Elevator. Each of them has an Avatar Pad too, by its Elevators and its Directory, on open floor: a ride steps you
  out beside the Elevator as before, and someone who changes floor from the tab bar (a Participant or a Viewer, who
  are always walking) arrives on the pad rather than in the middle of the view.
- **Named Elevators.** Every floor has its Elevators named after the floor or their place ("Lobby Lift", "North
  Lift"), so the Elevator panel reads like a building's directory. The Co-working Tower's lifts stand in the same place
  on every floor, and so do its [Stairs](../009-elements/stairs.md), beside the North Lift, so a flight up or down lands
  you in the same spot a floor away. The Hotel and Suites has one flight of Stairs on every floor too (Work Tracker
  #641), beside that floor's lift with open floor below it to step off onto. Its lifts stand in a different place on
  each floor, so its Stairs do too; with one flight a floor, a climb always lands on that floor's flight.
- **Each floor is its own Space plan**: a heading naming the floor, closed rooms with a Door and a Room Sign each, and
  the same aisle and door rules as the other Spaces. A floor's tab is named after the floor ("Lobby", "Suites",
  "Rooftop"), and each floor has its own floor pattern.

## More Spaces

- **Expo Hall** (Events, one tab, concrete): sponsor booths, twelve **Office Pods** in rows of three, round a central
  keynote **Stage** (with Stage Curtains and a Podium) with Bring Focus and twelve chairs on the open floor, four
  **Pillars** between the booths and the seats, aisles of at least 160 px between the rows; a
  **Food Court** (two counters with stools, coffee and tables), a **Speaker Lounge** and a **Meeting Room**, each closed
  with a Door and a Room Sign; the Avatar Pad in the aisle facing the stage, and a Directory by the entrance.
- **Beach Offsite** (Outdoor, also in Campus; one tab, sand): a **Beach Hut** to meet in (a table and a Screen) and a
  **Tiki Bar** (a bar with stools, a drinks fridge, a jukebox), each closed with a Door and a Room Sign, joined by
  stone paths across the sand to the gate; a campfire circle of benches, hammocks under the palms (trees), garden
  umbrellas, a lagoon (a Pond) and a Swimming Pool.

## Games Rooms

Places to play together (Work Tracker #641), each one tab, a building of closed rooms off an open floor as the Expo
Hall is (`template-builders-games.ts`, `campusPlan` with indoor rooms): every room has a Door, a Room Sign and 160 px
of open floor in front of its Door, the Avatar Pad waits on the open floor among the games, and a Directory stands by
the entrance. They are built round the playable and moving pieces: the [Arcade Machine](../009-elements/social-pieces.md#arcade-machine)
and its Moon Mail, the [Ping-Pong Table](../009-elements/social-pieces.md#ping-pong-table)'s game, the Pool Table,
Foosball Table and Dartboard, the [Pet Bed](../009-elements/workday-pieces.md#pet-bed-and-its-dog)'s dog, and the
[piece moments](../009-elements/piece-moments.md) (a Vending Machine's can, a Fireplace stoked, a Plant rustled).

- **Arcade Lounge** (Games Rooms, carpet): the arcade floor itself is the open floor, two banks of **Arcade Machines**
  (each two rows of five, twenty machines in all) with a Bean Bag island (Bean Bags on a round rug) beside each, a **Prize Counter** (a Reception Desk) by the entrance; across the top a **Snack
  Bar** (a bar with stools, a Vending Machine, a Drinks Fridge and coffee), a glass-walled **Party Room** (a table and a
  Screen, so you see the party from the floor) and a **Chill Lounge** (Bean Bags on a round rug, a sofa on a rug, a
  Jukebox and a Team Photo Wall for the high scores). The Avatar Pad waits between the two Bean Bag islands.
- **Games Night Den** (Games Rooms, wood): a cosy **Den** (a Fireplace on the back wall with a Pet Bed beside it, a
  sofa on a bordered rug facing the fire, two games tables, three Bookshelves of games and windows in its back wall), a
  **Games Room** (a Pool Table, a Foosball Table, a Dartboard on the wall and a Jukebox) and a **Kitchen** (a counter
  run with a kettle and a microwave, a fridge and coffee; its door in its left wall, onto the hall). In the hall a Reading Nook, a coat
  rack and an umbrella stand by the front door.
- **Sports Bar** (Games Rooms, also in Recreation; wood): a **Bar** (two counters with eight stools, a Drinks Cabinet,
  a Drinks Fridge, a Dartboard on the wall and two tables) and a glass-walled **Screen Lounge** (two Screens, a World Clock for the kick-offs and five
  sofas on rugs in two rows), and on the open floor the **Games Floor**: two Ping-Pong Tables, a Pool
  Table, a Foosball Table and a Jukebox, a Vending Machine and a Notice Board of fixtures.

## Homes

Houses to meet in (Work Tracker #641), every one on two or three floors, one tab each, named **Downstairs** and
**Upstairs** (and the City Townhouse's **Roof Terrace**), joined by [Stairs](../009-elements/stairs.md) standing in the
same place on every floor, so a climb lands where you would expect a floor away (`template-builders-homes.ts`,
`template-floors.ts`). A home is a building of closed rooms off a hall (the open floor), as the Co-working Tower is, with
three differences: rooms have **no Room Sign** (a home's rooms need no sign saying whether they are free), there is **no
Directory** (a home's few rooms are all in view from the hall), and there is **no Elevator** (the Stairs are the way up).
Every floor has its own Avatar Pad: Downstairs in the hall, the middle of the action, with the how-to line; upstairs
on the landing beside the Stairs, where someone who changes floor from the tab bar arrives. **Windows** stand in the
outside walls, light falling in ([Window](../009-elements/room-builder.md#window)), never in a wall a room shares with
the hall.

- **Family House** (Downstairs wood, Upstairs carpet): Downstairs, a **Living Room** (a Fireplace with the Pet Bed and
  its dog beside it, a sofa on a bordered rug facing the fire, a chair, a Bookshelf, a Screen and plants; three windows)
  and a **Kitchen** (a fridge, a sink and a counter with a kettle and a microwave, coffee, a Long Table for the family
  and plants; three windows) either side of the hall, a **Cloakroom** (a toilet cubicle and a basin) and a **Playroom**
  (Bean Bags on a round rug, an Arcade Machine and a Foosball Table) below them, the Stairs at the top of the hall and a
  coat rack, an umbrella stand and a doormat inside the front door. Upstairs, a **Study** (two desks, a Bookshelf and a
  Calendar Wall), a **Kids' Room** (Bean Bags, a Reading Nook, a Ping-Pong Table), a **Bathroom** (a toilet cubicle and
  a basin) and a **Reading Room** (a Reading Nook, Bookshelves and a plant), windows in every outside wall, and a Team Photo Wall on the landing.
- **City Townhouse** (Downstairs parquet, Upstairs carpet, Roof Terrace deck; three floors): Downstairs, a
  **Kitchen-Diner** across the back (a counter run, a fridge, coffee and a Long Table; three windows) and a **Front
  Room** (a sofa on a rug, a Screen, a Bookshelf and the Pet Bed). Upstairs, a glass-walled **Home Office** (two desks
  facing each other, a Standing Desk, a Bookshelf and a Screen), a **Bathroom** and a **Music Room** (a Jukebox, a sofa
  on a rug and a Reading Nook). The **Roof Terrace** is open air: a roof garden of Grass, a Picnic Table under a Garden
  Umbrella, a Hammock, a fire pit (a Campfire) with two Benches, a plunge pool (a Swimming Pool), Outdoor Plants and Trees in planters, and a railing (a
  Garden Fence) round its edge.
- **Country Cottage** (Downstairs wood, Upstairs carpet): Downstairs, a **Farmhouse Kitchen** (a Fireplace for its
  range, a counter run and a sink, a fridge, a kettle and a big table; two windows) and a **Snug** (a Reading Nook, a
  sofa on a rug, a Bookshelf and the Pet Bed; a window), the hall with the Stairs, and beside the house a fenced
  **cottage garden** of Grass: a Pond, a Bench, a Tree, a Hammock and Outdoor Plants. Upstairs, an **Attic Studio** (a
  Standing Desk, a desk, a Bookshelf, a Team Photo Wall and plants; two windows), a **Bathroom** and a **Reading Room** (two Reading Nooks,
  Bookshelves and a Bean Bag; a window).

## Venues

Places an event is held at or a group stays at, rather than a company's own site: the **Conference Venue** and the
**Hotel and Suites** left Campus for them (Work Tracker #641, the owner: "Campus could split into Campus and another
category for Venues"), and the **Expo Hall** (Events) is cross-listed here. Built and tested as the Campus Spaces are
(a Door, a Room Sign and a path or open floor at every room, a Directory at the entrance).

- **Music Hall** (Venues, parquet; `template-builders-venues.ts`): a **Main Hall** (a Stage with Stage Curtains, two
  Screens, Bring Focus, a standing floor in front of the stage and twenty chairs in two rows either side of a centre
  aisle), a **Foyer Bar** (a bar with stools, a Drinks Cabinet, a Drinks Fridge and a Jukebox), a **Green Room** (a sofa
  on a rug, a chair, coffee and a water cooler) and a **Cloakroom** (coat racks, Lockers and an umbrella stand), round a
  foyer of four Columns, a **Merch Stand** (a Reception Desk and a Notice Board of the line-up) and the Directory by the
  doors. The Avatar Pad waits on the standing floor in front of the stage, clear of the rows.

## The catalogue plan

Every category, the templates in it and the element types each one uses (Work Tracker #641). Floors are the Room and
the Corridor, the Rug, the Stage, Grass and the Garden Path; every Space also has an Avatar Pad, a how-to line, a
heading, a Door on every room and, outside Homes, a Room Sign by every Door.

| Category    | Template                     | Tabs | Element types                                                                                                                                                                                                                                     |
| ----------- | ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campus      | Company Campus               | 1    | Desk, Meeting Table, Screen, Stage, Chair, Bring Focus, Bar, Bar Stool, Drinks Cabinet, Drinks Fridge, Jukebox, Sofa, Ping-Pong Table, Arcade Machine, Fireplace, garden set, Pet Bed, Window                                                     |
| Campus      | Startup HQ                   | 1    | Desk, Bookshelf, Coffee Machine, Notice Board, Stage, Screen, Bring Focus, Bar, Ping-Pong Table, Arcade Machine, Jukebox, Office Pod, Campfire, Hammock, Bike Rack, Pet Bed, Standing Desk, Dartboard, Window                                     |
| Campus      | School Quad                  | 1    | Stage, Screen, Bring Focus, Chair, Desk, Bookshelf, Bar, Bar Stool, Coffee Machine, Meeting Table, Fountain, Bench, Tree, Picnic Table, Bean Bag, Window                                                                                          |
| Campus      | Co-working Tower             | 3    | Elevator, Stairs, Directory, Desk, Hot Desk, Copier, Printer, Lockers, Office Pod, Nap Pod, Restroom set, Stage, Screen, Bar, Jukebox, Vending Machine, Ping-Pong Table, Foosball Table, Dartboard, Window                                        |
| Campus      | Beach Offsite (cross-listed) | 1    | Bar, Bar Stool, Drinks Fridge, Jukebox, Screen, Bench, Campfire, Hammock, Tree, Garden Umbrella, Pond, Swimming Pool, Ping-Pong Table, Window                                                                                                     |
| Events      | All-Hands Hall               | 1    | Stage, Stage Curtains, Podium, Bring Focus, Chair, Plant, Water Cooler, Window                                                                                                                                                                    |
| Events      | Training Room                | 1    | Stage, Podium, Bring Focus, Meeting Table, Coffee Machine, Water Cooler, Plant, Window                                                                                                                                                            |
| Events      | Expo Hall                    | 1    | Office Pod, Stage, Stage Curtains, Podium, Pillar, Chair, Bar, Bar Stool, Meeting Table, Notice Board, Directory, Team Photo Wall, Vending Machine, Lockers, Coat Rack, Umbrella Stand                                                            |
| Games Rooms | Arcade Lounge                | 1    | Arcade Machine, Reception Desk, Bar, Bar Stool, Vending Machine, Drinks Fridge, Coffee Machine, Meeting Table, Screen, Bean Bag, Sofa, Jukebox, Team Photo Wall, Plant, glass walls                                                               |
| Games Rooms | Games Night Den              | 1    | Fireplace, Pet Bed, Sofa, Meeting Table, Bookshelf, Pool Table, Foosball Table, Dartboard, Jukebox, kitchen set, Reading Nook, Coat Rack, Umbrella Stand, Window                                                                                  |
| Games Rooms | Sports Bar                   | 1    | Bar, Bar Stool, Drinks Cabinet, Drinks Fridge, Dartboard, Meeting Table, Screen, Sofa, Ping-Pong Table, Pool Table, Foosball Table, Jukebox, Vending Machine, Notice Board, World Clock, glass walls                                              |
| Homes       | Family House                 | 2    | Stairs, Fireplace, Pet Bed, Sofa, Chair, Bookshelf, Screen, kitchen set, Long Table, toilet and basin, Bean Bag, Arcade Machine, Foosball Table, Desk, Calendar Wall, Team Photo Wall, Reading Nook, Ping-Pong Table, Window                      |
| Homes       | City Townhouse               | 3    | Stairs, kitchen set, Long Table, Sofa, Screen, Bookshelf, Pet Bed, Desk, Standing Desk, toilet and basin, Jukebox, Reading Nook, Grass, Picnic Table, Garden Umbrella, Hammock, Campfire, Bench, Swimming Pool, Garden Fence, Window, glass walls |
| Homes       | Country Cottage              | 2    | Stairs, Fireplace, kitchen set, Meeting Table, Reading Nook, Sofa, Bookshelf, Pet Bed, Grass, Garden Fence, Pond, Bench, Tree, Hammock, Standing Desk, Desk, Team Photo Wall, Bean Bag, Window                                                    |
| Office      | Virtual Office               | 1    | Desk, Bookshelf, Printer, Meeting Table, kitchen set, Water Cooler, Coffee Machine, Sofa, Chair, Coat Rack, Umbrella Stand, Plant, Pet Bed, Window, glass walls                                                                                   |
| Office      | Coworking Space              | 1    | Desk, Phone Booth, Coffee Machine, Water Cooler, Sofa, Chair, Bookshelf, Plant, Lockers, Window, glass walls                                                                                                                                      |
| Office      | Team Pod                     | 1    | Desk, Meeting Table, Coffee Machine, Bookshelf, Plant, Sticky Note, Pet Bed, Window                                                                                                                                                               |
| Office      | Focus Library                | 1    | Bookshelf, Desk, Office Pod, Sofa, Chair, Water Cooler, Reading Nook, Window                                                                                                                                                                      |
| Outdoor     | Garden Retreat               | 1    | Grass, Garden Fence, Garden Path, Summer House (Room), Meeting Table, Bench, Campfire, Pond, Tree, Outdoor Plant, Pet Bed, Window                                                                                                                 |
| Outdoor     | City Park                    | 1    | Grass, Garden Path, Fountain, Bench, Picnic Table, Stage, Chair, Tree, Ping-Pong Table                                                                                                                                                            |
| Outdoor     | Beach Offsite                | 1    | as above                                                                                                                                                                                                                                          |
| Recreation  | Rooftop Bar                  | 1    | Bar, Bar Stool, Drinks Cabinet, Drinks Fridge, Sofa, Chair, Tree, Outdoor Plant                                                                                                                                                                   |
| Recreation  | Cafe                         | 1    | Bar, Bar Stool, Coffee Machine, Drinks Fridge, Meeting Table, Chair, Sofa, Plant, Pet Bed, Window                                                                                                                                                 |
| Recreation  | Sports Bar (cross-listed)    | 1    | as above                                                                                                                                                                                                                                          |
| Venues      | Conference Venue             | 1    | Bar, Stage, Stage Curtains, Podium, Screen, Bring Focus, Chair, Meeting Table, Office Pod, garden set, Coat Rack, Umbrella Stand, Window                                                                                                          |
| Venues      | Hotel and Suites             | 3    | Elevator, Directory, Column, Bar, Stage, Screen, Fireplace, Sofa, Desk, Office Pod, Garden Umbrella, Hammock, Swimming Pool, Stairs, Ping-Pong Table, Window                                                                                      |
| Venues      | Music Hall                   | 1    | Stage, Stage Curtains, Screen, Bring Focus, Chair, Bar, Bar Stool, Drinks Cabinet, Drinks Fridge, Jukebox, Sofa, Coat Rack, Lockers, Umbrella Stand, Column, Reception Desk, Notice Board                                                         |
| Venues      | Expo Hall (cross-listed)     | 1    | as above                                                                                                                                                                                                                                          |

The "garden set" is a site's Grass, Garden Fence, Garden Paths, plazas, Fountain, Benches, Picnic Table, Pond, Garden
Umbrella, Hammock, Trees and Outdoor Plants; the "kitchen set" a Kitchen Counter, a Kitchen Sink, a Fridge, a Microwave
and a Kettle.

### The review of the existing Spaces

Part 2 of Work Tracker #641 brings the newer pieces into the eighteen Spaces that came before them, wherever one makes
the place better to be in, and never by crowding it: every change keeps the aisle, door and sign rules above. The
newer pieces are [Windows](../009-elements/room-builder.md#window) and glass walls, [Stairs](../009-elements/stairs.md),
the Arcade Machine and the Ping-Pong Table, the Pet Bed and the Bean Bag, and the pieces that play a
[moment](../009-elements/piece-moments.md) every time you walk up to them. **Windows** go in the walls that face
outside (never one a room shares with a corridor, a lobby or another room), so light falls in. A room people should
see into without walking in has **glass walls** and a sliding glass Door.

| Space            | What changed, or why nothing did                                                                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Virtual Office   | The **Meeting Room** is glass, so you see who is meeting from the corridor; windows in every outside wall; a **Pet Bed** in the Lounge, its dog wandering the room.                                                                                            |
| Coworking Space  | Windows along the back and left walls; the two **phone booths** are glass, so a free one shows from the floor; a bank of **Lockers** for the members in the free corner under the booths.                                                                      |
| Team Pod         | Windows in the back and left walls; the team's **Pet Bed** between the pad and the stand-up table.                                                                                                                                                             |
| Focus Library    | Windows down both side walls; a **Reading Nook** by the water cooler, a second quiet seat away from the desks.                                                                                                                                                 |
| All-Hands Hall   | Windows down both long walls. Nothing else: the hall is for the stage, and its rows already fill it to the aisle rule.                                                                                                                                         |
| Training Room    | Windows down both side walls. Nothing else: the four tables and the aisle between them take the floor.                                                                                                                                                         |
| Expo Hall        | A **Team Photo Wall** for the show's photos and a **Vending Machine** in the free corner by the Meeting Room; a cloakroom corner by the entrance (**Lockers**, a **Coat Rack** and an **Umbrella Stand**).                                                     |
| Company Campus   | Windows in every room's outside walls; a **Pet Bed** by the Games Room's fire. No mezzanine: the site is one garden you walk between rooms, and a floor would split it.                                                                                        |
| Startup HQ       | Windows in every room's outside walls; a **Dartboard** on the Games Room's back wall. Its Studio already has the Pet Bed.                                                                                                                                      |
| School Quad      | Windows in every room's outside walls; two **Bean Bags** in the Library's reading corner. The Canteen stays as it is: a Vending Machine there would stand in its stools' way.                                                                                  |
| Co-working Tower | Windows in the outside walls on every floor (it already has its Stairs); a **Vending Machine** on Level 2's open floor; on Level 3 a games corner on the open floor (a **Ping-Pong Table** and a **Foosball Table**) and a **Dartboard** in the Roof Bar.      |
| Garden Retreat   | Windows in the Summer House's side walls; a **Pet Bed** on the lawn beside the bench.                                                                                                                                                                          |
| City Park        | A **Ping-Pong Table** on the lawn above the west path, as a city park has.                                                                                                                                                                                     |
| Beach Offsite    | Windows in the Tiki Bar's and the Beach Hut's outside walls; a **Ping-Pong Table** on the sand between the walk and the umbrellas.                                                                                                                             |
| Rooftop Bar      | No change: it is an open terrace with no walls to put a window in, every piece on it already plays a moment (the trees, the planters, the bar's clink), and the floor between the stools and the sofas is the walk to the bar, which a game table would block. |
| Cafe             | Windows in the front and left walls; the cafe's **Pet Bed** beside the sofa nook.                                                                                                                                                                              |
| Conference Venue | Windows in every room's outside walls; a **Coat Rack** and an **Umbrella Stand** in the Foyer Bar.                                                                                                                                                             |
| Hotel and Suites | **Stairs** beside the lift on every floor, so a guest can walk up; windows in the outside walls, one in every suite; a **Ping-Pong Table** on the Rooftop terrace.                                                                                             |

## Where they are

In eight categories, **Campus**, **Events**, **Games Rooms**, **Homes**, **Office**, **Outdoor**, **Recreation** and
**Venues** ([Template categories](../008-canvas/canvas-and-palette.md#template-categories)), on every start and on the
marketing gallery. Since Work Tracker #423 they are livehuddle's whole catalogue with Blank Space, and four of them lead
Popular ([Templates by mode](../007-editor/templates-by-mode.md#the-catalogue)). They were one **Virtual Spaces**
category while there were four; it split by kind of place when the six more arrived, Campus came with the three sites,
and Games Rooms, Homes and Venues came with Work Tracker #641.

## Share roles

As every template: an Editor creates a document or tab from it. Everyone on the board walks, sits, talks and drinks
in it ([Office](../009-elements/office.md#share-roles)). What the spaces add follows the elements' own rules:

- **The hall's Bring Focus**: an Editor presses it; a Participant or a Viewer cannot
  ([Bring Focus](bring-focus.md#rules)).
- **The Team Board's stickies**: an Editor and a Participant write on, move and recolour them; a Viewer reads them
  ([Share roles](../013-workspace/share-roles.md)).
- The **raised hand** an attendee is told to use is Behaviour › Wave, which every role may do and everyone sees;
  a Reactions burst plays on its sender's screen only ([Avatar mode](../008-canvas/avatar-mode.md)).
