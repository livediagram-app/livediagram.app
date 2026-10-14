# Virtual Office and space templates

A Facilitate template that starts a team with a whole office to walk round in
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

- The rooms are first in the tab, so they lie under the furniture; the rugs come next.
- Every room keeps its name as its label, so renaming one is renaming the room.
- The tab opens in **Facilitate** on grid paper.

## Spaces

Three siblings, built the same way (`template-office-parts.ts`: rooms first, rugs next, furniture after, and a
**Walk In** button with a how-to line under the plan):

- **Coworking Space**: one open room of two desk clusters (four desks each pair facing across a shared bench), a coffee
  bar (coffee machine, water cooler, plant), a lounge (a sofa and two chairs round a rug), a bookshelf, and two
  **phone booths** along the right, small rooms with one chair each for a call away from the floor.
- **Team Pod**: one room for a small team: a cluster of four desks, a meeting table for the stand-up, a coffee
  machine, a plant and a bookshelf, and beside it a **Team Board** of four stickies (This week, Blocked on, Wins,
  Questions).
- **All-Hands Hall**: one big room with a **Stage** (a rug, labelled) and a [Bring Focus](bring-focus.md) button
  for the presenter, thirty-two chairs in four rows facing the stage either side of a centre aisle, plants and a
  water cooler.

## Where they are

In the **Meetings** category of the template picker, and Start Facilitating's own **Spaces** group (Virtual Office,
Coworking Space, Team Pod, All-Hands Hall), after Meetings. Extra templates (not defaults).

## Share roles

As every template: an Editor creates a document or tab from it. Everyone on the board walks, sits, talks and drinks
in it ([Office](../009-elements/office.md#share-roles)).
