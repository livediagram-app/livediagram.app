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

## Cost

Plan must cost nothing to a document that does not use it:

- **No item requests without Plan content**: a document fetches its items only once the open tab has a Plan
  board, card or view, opens in Plan (so its Cards and Trash panels list strays before it has a board), or its
  deck has a card slide; from then on it keeps them for the session. A room join or resync
  refetches only items already loaded.
- **Plan's UI loads when drawn**: boards, cards, the item panel, the type editor, the Card Types panel, the board
  menu, the Cards category and card slides are separate chunks, fetched the first time one appears. The
  [Plan tour](plan-tour.md) loads the first time the person enters Plan and stays loaded for the session, so
  leaving Plan mid-tour still tidies its example board away.
- **No re-render churn**: the Plan context keeps its identity across editor renders that change nothing Plan
  holds, so boards and cards re-render only when items, types, presence or the board change.
- **Other tabs load once**: statuses are the document's ([Plan templates](plan-templates.md#hand-offs)), so a
  document in Plan of 2 to 12 tabs loads its other tabs once a session in the background, as the search panel
  does; a larger one reads each tab's boards as it is opened.
- **No presence chatter**: a card held (opened or dragged) is said to the room, and its release; nothing is sent
  by a person who never holds one. A holder says it once more when someone new joins, and when their own
  connection rejoins, so a late joiner sees it too (Collaboration, below).
- **Server**: a tab-scoped list reads the store once and the revision without a count; a document copy carries
  its items in the same batch as its tabs.

## Starting a board

- A Plan tab with no board shows, in the middle of the canvas, **Start with a Board**: a tile per board type, Blank
  first and the Archive board left out, each a small picture of the board (its columns, its rows, cards in the
  colours of the types it takes) over its name and its full description, in the tab's light or dark look, as a new
  infographic page offers its layouts. Choosing one places that board,
  empty, in the middle of the view. It is gone once the tab has a board, and never shown to someone who may only
  view. It keeps clear of the toolbar above and the bottom-right buttons below, scrolling inside itself when the
  tiles run taller than the room; on a phone it shows two tiles a row with shorter pictures.
- Plan mode has no empty-canvas Quick Start banner: the board picker is its start.

## Switching modes keeps the tab

- **A tab switches into and out of Plan freely, whatever it holds, and nothing on it is lost.** Plan mode is how
  a person works on the tab, never what the tab is: its boards, cards and views are elements every mode keeps,
  and their work is items in the document, which no mode touches.
- **In another mode a board is an element like any other**: it is drawn with its columns and cards, live as
  items change, and is selected, moved, resized, copied, styled and deleted as any element is. Its cards do not
  take the pointer or the keyboard there; switching back to Plan makes them work again.
- **A diagram is welcome in Plan**: a tab's shapes, ink, arrows and pages stay on it in Plan mode, worked the Diagram
  way (Plan's palette offers fewer of them, nothing more).
- The mode switch and **Shift+D** switch at once, with no question, as between any two modes; Shift+D announces
  the mode it reached.
- A tab with Plan content is never added to another document: the tab menu's **Add to Document** is off for it,
  as its cards are this document's items.
- Telemetry: a switch is the existing mode event (`Editor` · `Changed` · `ModePlan`, ...), nothing more.

## Tools

- **Plan starts on the Hand tool**: a board's cards take the pointer themselves, so a drag on the canvas moves
  it. Select is one pick away, for moving or resizing a board.
- **Eraser and Format are left out** of the tool picker and their shortcuts: they work on drawn content a Plan
  tab does not hold.
- **No Layers panel**, as below.

## The palette

The Plan layout offers seven categories and opens on **Cards**. The card-backed five, **Cards**, **Boards**,
**Widgets**, **Metrics** and **Visualisations**, sit under the **Plan** heading of the category picker, first; then
**Content** under **Common** and **Tools** under **Dynamic**, the headings their elements belong to elsewhere. The Cards category ends with **Edit Cards**, which opens the Card Types panel
([Item types](item-types.md)); the Toolbar layout's strip ends with it while Cards is chosen. A Plan tab is worked by its boards, so there is no Popular and none of the
drawing or decorating categories (Shapes, Icons, Stickers and the rest stay with the other modes); the few other
elements a team plans beside its boards come in Content and Tools:

| Category       | Holds                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cards          | One per [item type](item-types.md) of the document, in its order: Project card, Task card... and any added                               |
| Boards         | Kanban, Sprint, Retro, Roadmap, Bug triage, Week, All Cards, Archive, Blank, each with its own picture                                   |
| Widgets        | One per [board widget](board-widgets.md) kind, placed in a board's header, never on the canvas                                           |
| Metrics        | The read-out widgets free on the canvas, over every card ([Plan views](plan-views.md#metrics))                                           |
| Visualisations | Project Gantt Chart, Due Calendar, Workload by Person, Status Breakdown, Priority by Status ([Plan views](plan-views.md#visualisations)) |
| Content        | Sticky Note, Text, Image, Page                                                                                                           |
| Tools          | Temperature, Estimate, Idea Box, Picker, Timer, Stopwatch                                                                                |

- A **board tile** places a Plan board with that preset's set-up, empty: its columns have statuses of their own
  ([Plan board](plan-board.md#the-board-set-up)).
- A **card tile** never puts anything on the canvas. Dragged and dropped (or pressed, then placed) into a board's
  column, it makes a new item of that type there (titled "New task", "New bug"...), at the drop point between
  cards and in the row it lands in (taking the row's field, its type kept); it is not opened, a click opens it.
  While it is dragged, the column under the pointer opens a dashed gap where it would land (the gap a card from
  another board opens), and no ghost is drawn on the canvas. Over no
  column, or over a board that does not show the type, nothing is made and the reason is said ("Drop a card into a
  column on a board", "This board shows Bug items only"). A Plan card on the canvas comes only from dragging a
  board's card off it.
- **Pressed**, a card tile's hint at the top of the canvas says where it goes: **Select the board column you want
  this card to appear in**, or, on a tab with no board, **Add a board first in order to use cards**.
- Content and Tools hold the same tiles as their home categories (Write, Media, Behaviours), placing
  the same elements.
- Draw mode's shape dock leaves the Plan categories out: they frame items, not ink.

## Templates

Templates that open in Plan mode set up a way of working across several tabs, with **no cards**:
[Plan templates](plan-templates.md) holds the catalogue, how a template's tabs are made and how their boards
hand cards to each other. Blank Plan is the mode's blank, as Blank Diagram is Diagram's: one empty board.

## Collaboration

- Everyone in the room sees item changes as they happen, in order (items' [Live for everyone](items.md#live-for-everyone)).
- Presence shows on cards: a card someone is dragging or has open carries their colour ring and first name, sent
  as an ephemeral `plan-presence` room op that is never stored.
- **A late joiner sees cards already held.** The room keeps no holds, so each person holding a card says it again
  when a new person appears in the room's presence list, and when their own connection rejoins (the room gives a
  rejoined connection a new presence id, which carries no hold until it is said). Nobody else sends anything: a
  person holding nothing stays silent. A holder who leaves or drops takes the ring with them, since rings are
  drawn only for people in the presence list.
- Two people may work on one tab in different modes; someone in Diagram mode sees the boards move as items change.
- Facilitation on a board (voting, a vote budget, hide writing and reveal) lives in the board's set-up, so a retro
  needs no separate session tool.

## Agents

- Agents read and write items through the api, the CLI and MCP ([Agents](../024-agents/README.md)): the CLI's
  `item ls|add|set|move|rm`, and the MCP's `list_items` and `change_items`. Items are named by number (`#12`) or
  id prefix.
- A document made from a Plan template by an agent (the CLI's `--template`, the MCP's `create_document`) gets the
  same tabs and boards, with no cards, as one made in the editor ([Plan templates](plan-templates.md)).
- A text `board` view of a tab's Plan boards for agents is a later step; `list_items` reads the same items.

## Telemetry

- Switching to Plan, Opens in Plan and the template filter fire the existing mode events with `ModePlan`,
  `OpensInPlan` and `TemplateModePlan`.
- The `Plan` category: `Added` (the item type, or `Card` for a Plan card), `Moved` (`Board`), `Opened` (`Item` from a board or a list; `Parent`, `ChildCard` or `Breadcrumb` from inside the item panel),
  `Voted` (`Up` / `Down`), `Deleted` (the item type), `Changed` (the set-up part), `Toggled` (`FlagOn` / `FlagOff`)
  and `Revealed` (`Board`), never content. A board placed from the palette counts as `Element` · `Added` · `PlanBoard`, a plan view as `PlanView`.
- The header's Start Blank menu offers Blank Plan, with its own funnel slot (`HeaderPlan`).

## The Plan tour

- The first time a person works in Plan, a guided tour offers itself, on an example board it takes away again:
  [Plan tour](plan-tour.md).

## Help

- A help article for Plan mode (the mode, boards, set-up and keyboard) and one for items, registered with the help
  centre; one for the [Plan tour](plan-tour.md).
