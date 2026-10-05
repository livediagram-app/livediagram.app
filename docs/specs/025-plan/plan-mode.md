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
- **The item panel** opens as a modal over the canvas when an item is opened (a sheet that rises from the
  bottom on a phone).
- **No Quick Style panel**: a board's look comes from the tab's theme; its colours are still in its element
  menu's Style.
- **The Layers panel is gone**, with its button: a board is worked by its columns and cards, not a stacking
  order. The **Card Types** button stands where it was ([Item types](item-types.md)). Layers returns with any
  other mode.
- **Everything else is Diagram mode's**: selection, arrows, text, stickies, frames, snapping, history and
  shortcuts, so notes and arrows around a board work as they always do.
- **The canvas pattern and colours are the tab's**, as in Diagram mode.

## Plan keeps its own tabs

- **A Plan tab with anything on it stays in Plan mode, and a tab in another mode with anything on it does not
  become a Plan tab.** Boards and cards are worked the Plan way on a tab of their own; a board in another mode is
  only a picture of them, and a diagram is not a board. The mode switch and **Shift+D** do not cross that line.
- Asking to leave opens **This Tab Stays in Plan Mode**; asking to enter opens **Plan Mode Needs Its Own Tab**.
  Each says why and offers **Create a New Tab**: a new tab, opening in the mode asked for, becomes the active
  tab (with its template picker, as any new tab). **Cancel** stays. Shift+D announces nothing it did not do; the
  dialog speaks for itself.
- An empty tab switches freely, into Plan and out of it.
- A visitor who cannot edit has no switch, so meets none of this.
- Telemetry: a tab made from the dialog is an ordinary new tab, `Tab` · `Created`.

## Tools

- **Plan starts on the Hand tool**: a board's cards take the pointer themselves, so a drag on the canvas moves
  it. Select is one pick away, for moving or resizing a board.
- **Eraser and Format are left out** of the tool picker and their shortcuts: they work on drawn content a Plan
  tab does not hold.
- **No Layers panel**, as below.

## The palette

The Plan layout offers three categories, **Cards**, **Boards** then **Widgets**, under their **Plan** heading in the category
picker, and opens on **Cards**. The Cards category ends with **Edit Cards**, which opens the Card Types panel
([Item types](item-types.md)); the Toolbar layout's strip ends with it while Cards is chosen. A Plan tab is worked by its boards, so there is no Popular and none of the
drawing, writing or decorating categories (Write, Shapes, Icons, Stickers, Media and the rest stay with the other
modes):

| Category | Holds                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Cards    | One per [item type](item-types.md) of the document, in its order: Project card, Task card... and any added |
| Boards   | Kanban, Sprint, Retro, Roadmap, Bug triage, Week, Blank, each with its own picture                         |
| Widgets  | One per [board widget](board-widgets.md) kind, placed in a board's header, never on the canvas             |

- A **board tile** places a Plan board with that preset's set-up. It shows every item of the document whose
  status is one of its columns.
- A **card tile** never puts anything on the canvas. Dragged and dropped (or pressed, then placed) into a board's
  column, it makes a new item of that type there (titled "New task", "New bug"...), at the drop point between
  cards and in the row it lands in (taking the row's field, its type kept); it is not opened, a click opens it.
  While it is dragged, the column under the pointer opens a dashed gap where it would land (the gap a card from
  another board opens), and no ghost is drawn on the canvas. Over no
  column, or over a board that does not show the type, nothing is made and the reason is said ("Drop a card into a
  column on a board", "This board shows Bug items only"). A Plan card on the canvas comes only from dragging a
  board's card off it.
- Draw mode's shape dock leaves Boards and Cards out: they frame items, not ink.

## Templates

Templates that open in Plan mode carry **seed items** with their boards. The items are made in the new
document's item store when the document is made; afterwards they are ordinary items.

| Template       | Board                                                                                |
| -------------- | ------------------------------------------------------------------------------------ |
| Blank Plan     | One Kanban board: To do, In progress, Done; no items                                 |
| Kanban Board   | Backlog, To do, In progress (WIP 3), Review (WIP 2), Done; a team mid-week           |
| Sprint Board   | Sprint backlog, In progress, In review, Done; swimlanes by assignee; estimates shown |
| Bug Triage     | New, Confirmed, Fixing, Fixed, Won't fix; Tasks labelled bug; swimlanes by priority  |
| Team Retro     | Went well, To improve, Ideas, Actions; voting with 5 votes; hide writing on          |
| Roadmap        | Now, Next, Later; Projects; labels shown                                             |
| Weekly Planner | Monday to Friday; due dates shown                                                    |

- The Kanban Board template is rebuilt as a Plan board; it opens in Plan. It stays in the Kanban boards family.
- Team Retro joins the Retrospectives family beside the sticky-note formats, which stay Diagram templates.
- Blank Plan is the mode's blank, as Blank Diagram is Diagram's.

## Collaboration

- Everyone in the room sees item changes as they happen, in order (items' [Live for everyone](items.md#live-for-everyone)).
- Presence shows on cards: a card someone is dragging or has open carries their colour ring and first name, sent
  as an ephemeral `plan-presence` room op that is never stored.
- Two people may work on one tab in different modes; someone in Diagram mode sees the boards move as items change.
- Facilitation on a board (voting, a vote budget, hide writing and reveal) lives in the board's set-up, so a retro
  needs no separate session tool.

## Agents

- Agents read and write items through the api, the CLI and MCP ([Agents](../024-agents/README.md)): the CLI's
  `item ls|add|set|move|rm`, and the MCP's `list_items` and `change_items`. Items are named by number (`#12`) or
  id prefix.
- A document made from a Plan template by an agent (the CLI's `--template`, the MCP's `create_document`) gets the
  template's seed items too.
- A text `board` view of a tab's Plan boards for agents is a later step; `list_items` reads the same items.

## Telemetry

- Switching to Plan, Opens in Plan and the template filter fire the existing mode events with `ModePlan`,
  `OpensInPlan` and `TemplateModePlan`.
- The `Plan` category: `Added` (the item type, or `Card` for a Plan card), `Moved` (`Board`), `Opened` (`Item`),
  `Voted` (`Up` / `Down`), `Deleted` (the item type), `Changed` (the set-up part) and `Revealed` (`Board`), never
  content. A board placed from the palette counts as `Element` · `Added` · `PlanBoard`.
- The header's Start Blank menu offers Blank Plan, with its own funnel slot (`HeaderPlan`).

## Help

- A help article for Plan mode (the mode, boards, set-up and keyboard) and one for items, registered with the help
  centre.
