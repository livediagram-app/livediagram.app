# Make Plan Cards

**Make Plan Cards** turns a roadmap, a flow or a process drawn in livediagram into liveplanner cards (Work Tracker
1369), so a team plans from the picture instead of typing it again. It is livediagram's half of the platform's
[Diagrams and Plans](../../../../liveworkspace/docs/specs/004-index/diagrams-and-plans.md); the route, the link between
a shape and its card, the limits and the roles are the platform's.

## Where

- **A selection**: the selection toolbar's **Make Plan Cards** (a plan-card glyph with a plus), beside Send to Plan,
  when the selection holds two or more shapes or stickies with words.
- **A whole tab**: the tab's menu (right-click a tab, or its More), **Make Plan Cards** under Send to Plan's group,
  when the tab holds one shape or sticky with words.

The same sessions that may Send to Plan see them: a signed-in account, on the server, not an embed, a workbench frame
or a Community copy. Read access to the diagram is enough; what decides is Edit on the plan.

## What becomes what

Read once, when the preview opens, from what the person sees:

- **Shapes become cards.** Every shape and sticky with words: not a lane, a frame, a text, an arrow, a line, a picture
  or a chart. Its first line (at most 200 characters, dates taken out) is the title; all its words go in the card's
  description with the line back to the shape.
- **Arrows become Blocked By.** An arrow drawn from shape A to shape B, both becoming cards, means B waits on A: B's
  Blocked By holds A. An arrow with heads at both ends or none says no order and is left out. An arrow that would
  close a loop (A waits on B waits on A) is left out, the first drawn kept, and the preview says how many.
- **Lanes become columns or labels.** A shape inside a lane or a frame (its centre in it; the smallest one when they
  nest) belongs to that lane's name. **Lanes Become** chooses: **Columns** (the board's column of that name, ignoring
  case; a name the board has no column for lands in the chosen column, and its rows say "No column called <name>"),
  **Labels** (the name as a label, cut to 32 characters) or **Nothing**. Columns is chosen when any lane's name is a
  column of the board, else Labels.
- **Dates become Start and Due.** A shape's own words naming two dates ("Design 1 Dec to 12 Dec", "2026-12-01 -
  2026-12-12") set Start and Due; one date at the end of its line or after "by", "due" or "on" sets Due, as Send to
  Plan reads them. On a **timeline**, where at least two texts or shapes are each nothing but a date and later dates
  stand further right, a shape whose words name no date takes Start from where its left edge falls on that axis and
  Due from its right edge (a shape no wider than a day takes one day).

## The preview

A centred dialog (a bottom sheet on a phone) under the dialog hero header (shapes on the left joined to cards on the
right, the title Make Plan Cards and "Turn this tab's shapes into cards in a plan"), nothing written until the person
presses Make Cards:

1. **Plan**, **Board** and **Column**, exactly as Send to Plan's picker offers them (Recent plans, New Plan, a plan
   they cannot edit not listed; the plan remembered per diagram).
2. **Lanes Become**: Columns, Labels or Nothing, shown only when the shapes sit in lanes or frames.
3. **The cards**, one row each in the diagram's reading order (top to bottom, then left to right), every row ticked:
   the title, the column or label it lands in, Start and Due, "Waits on 2", and **Updates #12** where the shape
   already has a card in this plan. Unticking a row leaves that shape out (a shape that isn't a task), and any arrow to
   it. A search box narrows long lists; **Untick All** and **Tick All** sit beside it.
4. **Removed from the diagram**: when this tab's shapes made cards in this plan before and some of those shapes are
   gone, each such card gets a row, **unticked**, "Move to Trash". Only a ticked row is trashed; nothing is ever
   deleted silently, and a trashed card can be restored from the plan's Trash.
5. The foot sums it up ("Make 12 cards, update 3, 8 Blocked By links, 1 left out (a loop)") beside **Make Cards**,
   which reads **Update Cards** when every row updates.

Making shows "Making cards", then closes with a toast "12 cards in Launch plan" and **Open Plan**. A refusal says why
in the dialog, in fixed words ("You can't add cards to this plan", "That plan is full", "The plan couldn't be reached
just now. Try again.") and the person may try again. Escape or Cancel closes; every row is reachable by Tab and Space
ticks it.

**Making again** opens on the same plan and board: shapes with a live card read **Updates #N** and update that card's
title, Start, Due and labels and add its new Blocked By links (its column stays the plan's). New shapes add cards.

## The chip

Each shape that made a card wears Send to Plan's chip as one of its element indicators
([element-indicators.md](../008-canvas/element-indicators.md)): the card's column and its plan, ticked once done, live
as the plan moves it. A shape with cards in several plans shows the newest and "+N".

## Changes to the plan

On a tab drawn by liveplanner's [View As Diagram](../../../../liveplanner/docs/specs/026-plan/view-as-diagram.md), each
box is a card (`card:<lane>:<card>`), each lane a column (`lane:<lane>`) and each of the plan's arrows a Blocked By link
(`dep:<blocker>:<card>`). Editing the drawing's structure offers the change to the plan, never makes it:

- **An arrow drawn from one card's box to another's** offers "Launch waits on Design".
- **A box dragged into another lane** offers "Move Launch to Done".

The offers gather in a pill at the top centre of the canvas, "2 changes to the plan", opening a list: each with
**Apply** and **Dismiss**, and **Apply All**. Applying asks the index (`POST /items/:plan/plan-edits`) as the person,
who needs Edit on the plan; a refused edit says why in its row ("You can view this plan but not change it"). An
applied change becomes the plan's, and the plan's redraw then draws it as its own (the arrow takes its `dep:` id, the
box settles in its lane). **Dismiss** hides the offer for this session; the drawing keeps it until the plan's next
redraw puts the plan's picture back. Deleting one of the plan's arrows or boxes changes
only the picture: the next redraw puts it back, since the plan is the source of truth.

The pill shows only to a session that may edit the diagram, and only while there is something to offer.

## Who sees what

| Role in the diagram              | Make Plan Cards                              | Chips | Changes to the plan          |
| -------------------------------- | -------------------------------------------- | ----- | ---------------------------- |
| Editor                           | Selection toolbar, tab menu                  | Yes   | Offered; applied with Edit on the plan |
| Participant                      | Selection toolbar, tab menu                  | Yes   | No (cannot draw arrows)      |
| Viewer                           | Selection toolbar, tab menu                  | Yes   | No                           |
| Guest, Offline, embed, Community | None                                         | No    | No                           |

## Telemetry

`UI·Opened·MakePlanCards`, `UI·Created·MakePlanCards`, `UI·Refused·MakePlanCards`, `UI·Opened·PlanChange`,
`UI·Created·PlanChange`, `UI·Refused·PlanChange` (the platform's Telemetry).
