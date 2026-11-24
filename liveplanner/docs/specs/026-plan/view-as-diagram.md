# View As Diagram

**View As Diagram** draws a board as a livediagram diagram that stays live (Work Tracker 1369): its cards as boxes, its
Blocked By links as arrows, its columns as lanes, and the critical path highlighted. liveplanner has Blocked By chains
and a [Gantt Chart](plan-views.md#gantt-chart), but no picture of how the work hangs together; this is that picture, in
the app built for drawing, beside the plan as a connected tab. It is liveplanner's half of the platform's
[Diagrams and Plans](../../../../liveworkspace/docs/specs/004-index/diagrams-and-plans.md); the routes, the graph, the
limits and the roles are the platform's.

## Where

A **Board tab's** menu (right-click the tab, or its More), **View As Diagram**, after Export. It shows where the plan
is on the server and the session is signed in (not Offline, an embed, a workbench frame or a Community copy). The tab
menu is for those who may change the plan's tabs; the route itself needs only read, so a reader the platform lets in
(an agent, a later entry) draws what they can read.

## The dialog

A centred dialog (a bottom sheet on a phone) under the dialog hero header (cards on the left becoming a drawn flow on
the right, the title View As Diagram and "Draw this board as a live diagram in livediagram"):

- **Board**: the tab's boards, the first chosen (most tabs hold one, and then the row is not shown).
- **Cards**: **Whole Board** (chosen), or **Cards the Filter Shows** when the board has a filter on, saying how many
  ("Cards the Filter Shows, 14 of 40").
- **The preview**: what will be drawn, counted from the cards the editor already holds: "40 cards in 4 lanes, 22
  Blocked By arrows, a critical path of 6 cards", and the critical path's cards by number and title in order, so the
  person sees what the highlight will mean. A board over `PLAN_VIEW_CARDS_MAX` says "The first 500 of 612 cards will be
  drawn". A board with no cards says so and offers nothing to make.
- **Name**: the diagram's name, "<board title> diagram" to start, editable.
- **Make Diagram** ("Drawing") makes it and closes:
  - For an Editor of the whole plan, a **connected tab** to the diagram goes in at the end of the tab bar and becomes
    the open tab, showing its preview and Open, as any [connected tab](../../../../liveworkspace/docs/specs/004-index/connected-tabs.md);
    the connection grants Editor on the diagram, so anyone opening it from the plan may draw changes to suggest.
  - For anyone else (who may not change the plan's tabs), the diagram opens in livediagram in a new browser tab.
  - A toast "Diagram made" with **Open Diagram**.
- A refusal says why in the dialog ("livediagram couldn't be reached just now. Try again.") and nothing is left behind.

## What is drawn

- **Boxes**: each card the board (or its filter) shows, in board order, labelled with its number and title, linked to
  the card. Done cards are drawn quiet.
- **Lanes**: the board's columns that hold a drawn card, in board order, each named as the column.
- **Arrows**: each Blocked By link between two drawn cards, from the blocker to the card that waits.
- **The critical path**: the longest chain of open cards through their Blocked By links, weighing each card's days from
  Start to Due (one when it has neither). Its boxes are drawn strong and its arrows thick.
- **A caption** under the title: "Drawn live from <plan>, <board>", linked to the plan.

livediagram lays it out with its own lanes layout, the flow left to right.

## Live

Moving a card, renaming it, marking it done, trashing it, making one on the board or changing a Blocked By link
redraws the diagram within a few seconds (`PLAN_VIEW_SETTLE_MS` after the last change), for everyone with it open. A
change that alters nothing drawn redraws nothing. A plan keeps its `PLAN_VIEWS_PER_PLAN_MAX` newest diagrams live; an
older one stays as last drawn. A diagram whose maker can no longer read the plan, or edit the diagram, stops redrawing.

## Changes from the diagram

In the diagram, drawing an arrow between two cards' boxes or dragging a box into another lane offers the change to the
plan (livediagram's [Make Plan Cards, "Changes to the plan"](../../../../livediagram/docs/specs/013-workspace/make-plan-cards.md#changes-to-the-plan)).
Applied, liveplanner makes it as the person, checked as the card panel checks it: an Editor of the whole plan only, a
Blocked By link never closing a loop, a move only to a column of that board. The change lands in the plan's history as
theirs, the plan's rules hear it, and the diagram redraws.

## Roles

| Role in the plan                       | View As Diagram                                                           | Applying a diagram's change                     |
| -------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------- |
| Editor (whole plan)                    | Yes, with a connected tab                                                 | Yes                                             |
| Participant, Viewer, a tab-scoped link | No menu entry; the route lets a reader draw, opening in a new browser tab | No ("You can view this plan but not change it") |
| Guest, Offline, embed, Community       | No entry                                                                  | No                                              |

## Telemetry

`UI·Opened·ViewAsDiagram` (the dialog opened), `UI·Created·ViewAsDiagram` (a diagram made), `UI·Refused·ViewAsDiagram`
(turned away or unable to reach livediagram).
