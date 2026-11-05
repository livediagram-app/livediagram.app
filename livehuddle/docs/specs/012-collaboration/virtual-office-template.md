# Virtual Office and space templates

A template that starts a team with a whole office to walk round in
[Avatar mode](../008-canvas/avatar-mode.md), built from the [office pieces](../009-elements/office.md) and the
[furniture](../009-elements/chair.md), so nobody has to draw a floor plan before they can meet in it.

## The board

A title, **Our Office**, with a waving sticker and a line inviting people to walk in and rename the rooms. Under it,
six [rooms](../009-elements/office.md#room) either side of a corridor, every doorway opening onto the corridor:

| Row    | Room             | What is in it                                                                          |
| ------ | ---------------- | -------------------------------------------------------------------------------------- |
| Top    | **Reception**    | A sofa facing the room on a rug, a plant either side                                   |
| Top    | **Desks**        | Six desks in two rows, every sitter facing their screen; a bookshelf and a plant       |
| Top    | **Meeting Room** | A [meeting table](../009-elements/office.md#meeting-table) of six, a plant either side |
| Bottom | **Kitchen**      | A water cooler and a coffee machine, a plant, two chairs facing each other             |
| Bottom | **Lounge**       | A bookshelf, a sofa on a rug, two chairs facing in, a plant                            |
| Bottom | **Focus Room**   | One desk on its own, a bookshelf and a plant                                           |

At the corridor's end: a [Selection Mode button](../009-elements/mode-button.md) set to Avatar, labelled **Walk In**,
so one press puts a visitor's character at the door, and a line saying how to walk, talk, sit and get a coffee.

Every **Walk In** button in the office and the Spaces below has open floor under it: the character opens a full figure
below the button ([Entering from a button](../008-canvas/avatar-mode.md)), so that spot is never furniture or a wall.
The Virtual Office's corridor is deep enough for the button and that figure, and a test checks the spawn rectangle in
all four templates.

- The rooms are first in the tab, so they lie under the furniture; the rugs come next.
- Every room keeps its name as its label, so renaming one is renaming the room.
- The tab opens on a meeting board ([The meeting board](workshop-mode.md)) on grid paper.

## Spaces

Nine siblings, built the same way (`template-office-parts.ts`: open-air floors such as grass and garden paths first,
then rooms, rugs and stages, furniture after, and a **Walk In** button with a how-to line under the plan). The first
three (`template-builders-spaces.ts`):

- **Coworking Space**: one open room of two desk clusters (four desks each pair facing across a shared bench), a coffee
  bar (coffee machine, water cooler, plant), a lounge (a sofa and two chairs round a rug), a bookshelf, and two
  **phone booths** along the right, small rooms with one chair each for a call away from the floor.
- **Team Pod**: one room for a small team: a cluster of four desks, a meeting table for the stand-up, a coffee
  machine, a plant and a bookshelf, and beside it a **Team Board** of four stickies (This week, Blocked on, Wins,
  Questions).
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
- **City Park**: an open lawn crossed by two Garden Paths, trees in each corner, two **Benches** along the paths, a
  **Picnic Table**, a **Fountain** by the crossing, and a bandstand (a Stage) with four chairs facing it.

The open-air Spaces have no walls round them: the fence and the trees hold the edge, and the Walk In waits under the
gate or the path, so walking in is walking up it.

## Where they are

In four categories, **Office**, **Events**, **Outdoor** and **Recreation**
([Template categories](../008-canvas/canvas-and-palette.md#template-categories)), on every start and on the marketing
gallery. Since Work Tracker #423 they are livehuddle's whole catalogue with Blank Space, and four of them lead Popular
([Templates by mode](../007-editor/templates-by-mode.md#the-catalogue)). They were one **Virtual Spaces** category
while there were four; it split by kind of place when the six more arrived.

## Share roles

As every template: an Editor creates a document or tab from it. Everyone on the board walks, sits, talks and drinks
in it ([Office](../009-elements/office.md#share-roles)). What the spaces add follows the elements' own rules:

- **The hall's Bring Focus**: an Editor presses it; a Participant or a Viewer cannot
  ([Bring Focus](bring-focus.md#rules)).
- **The Team Board's stickies**: an Editor and a Participant write on, move and recolour them; a Viewer reads them
  ([Share roles](../013-workspace/share-roles.md)).
- The **raised hand** an attendee is told to use is Behaviour › Wave, which every role may do and everyone sees;
  a Reactions burst plays on its sender's screen only ([Avatar mode](../008-canvas/avatar-mode.md)).
