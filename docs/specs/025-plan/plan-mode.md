# Plan mode

**Plan mode** is the [editor mode](../007-editor/editor-modes.md) for running work on boards: Kanban boards,
sprint boards, triage boards, retros, roadmaps. It narrows the palette to what a board needs and makes
[Plan boards](plan-board.md) work like a planning tool (pick up a card, drop it in a column) instead of a drawing.
Like every mode, it never decides what the tab is: Plan mode is how a person works on a general tab, its boards
and cards are elements the other modes see too, and the work on them is [items](items.md) in the document's
item store.

## Domain language

| Term          | Means                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| **Plan mode** | The editor mode `plan`, shown as **Plan**                                    |
| **Plan**      | In the interface, the mode's name and its palette category; never a tab kind |

- "Board" alone keeps its old meanings elsewhere in the specs; in this folder it is always a **Plan board**.
- Event-storming boards are a tab kind with their own rules and are untouched by Plan mode.

## Offering the mode

- Plan is the fourth mode, after Illustrate: the mode switch, **Opens in**, **Shift+D** and the template picker's
  mode filter list it in that order.
- It is an **experimental mode** with its own switch, **Plan mode** in Settings › Experimental, on by default,
  apart from Illustrate's. Turned off, Plan leaves every list of modes and a tab that opens in Plan opens in
  Diagram, as Illustrate does.
- Its mark is a board: three columns, the middle one holding a raised card.

## What the mode brings into focus

- **The palette** narrows to the board's needs (below).
- **Plan boards and Plan cards take input** as [Plan board](plan-board.md#working-on-a-board) describes.
- **The item panel** opens beside the canvas when an item is opened.
- **Everything else is Diagram mode's**: selection, arrows, text, stickies, frames, snapping, history and
  shortcuts, so notes and arrows around a board work as they always do.
- **The canvas pattern and colours are the tab's**, as in Diagram mode.

## The palette

The Plan layout offers six categories, landing on Popular:

| Category | Holds                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Popular  | Kanban board, Retro board, Task card, Bug card, Note card, Sticky note, Text, Frame, Arrow, Image, Checklist, Link |
| Plan     | Boards: Kanban board, Sprint board, Retro board, Roadmap, Blank board. Cards: one per item type                    |
| Write    | Diagram's Write, without Page and Annotation                                                                       |
| Shapes   | Diagram's Shapes                                                                                                   |
| Icons    | The icon catalogue                                                                                                 |
| Stickers | The sticker catalogue                                                                                              |
| Media    | Image and Avatar                                                                                                   |

- A **board tile** places a Plan board with that preset's set-up. The board starts empty unless the tab already
  has items its scope matches.
- A **card tile** makes a new item of that type (titled "New task", "New bug"...) and places its Plan card,
  with the title ready to type.
- Build, Components, Devices, Data, Tech, Behaviours, Draw and My shapes are left out.

## Templates

Templates that open in Plan mode carry **seed items** with their boards. The items are made in the new
document's item store when the document is made; afterwards they are ordinary items.

| Template       | Board                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| Blank Plan     | One Kanban board: To do, In progress, Done; no items                                 |
| Kanban Board   | Backlog, To do, In progress (WIP 3), Review (WIP 2), Done; a team mid-week           |
| Sprint Board   | Sprint backlog, In progress, In review, Done; swimlanes by assignee; estimates shown |
| Bug Triage     | New, Confirmed, Fixing, Fixed, Won't fix; Bug scope; swimlanes by priority           |
| Team Retro     | Went well, To improve, Ideas, Actions; voting with 5 votes; hide writing on          |
| Roadmap        | Now, Next, Later; Epic scope; labels shown                                           |
| Weekly Planner | Monday to Friday; due dates shown                                                    |

- The Kanban Board template is rebuilt as a Plan board; it opens in Plan. It stays in the Kanban boards family.
- Team Retro joins the Retrospectives family beside the sticky-note formats, which stay Diagram templates.
- Blank Plan is the mode's blank, as Blank Diagram is Diagram's.

## Collaboration

- Everyone in the room sees item changes as they happen, in order (items' [Live for everyone](items.md#live-for-everyone)).
- Presence shows on cards: a card someone is dragging or has open carries their colour ring and first name.
- Two people may work on one tab in different modes; someone in Diagram mode sees the boards move as items change.
- Facilitation on a board (voting, a vote budget, hide writing and reveal) lives in the board's set-up, so a retro
  needs no separate session tool.

## Agents

- Agents read and write items through the api, the CLI and MCP with item verbs: list, get, add, set, move and
  remove ([Agents](../024-agents/README.md)).
- The **board** view prints a tab's Plan boards as text: each column with its items' keys, titles and fields.

## Telemetry

- Switching to Plan, Opens in Plan and the template filter fire the existing mode events with `ModePlan`,
  `OpensInPlan` and `TemplateModePlan`.
- Item created, moved, opened, voted and deleted, board added, set-up changed and revealed each fire one event
  with the item type or set-up part as its type, never content.

## Help

- A help article for Plan mode, one for Plan boards and one for items, registered with the help centre.
