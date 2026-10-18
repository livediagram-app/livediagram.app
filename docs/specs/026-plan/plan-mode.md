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

- Plan is the fifth mode, after Pages: a start's mode switch, **Shift+D** on an empty tab and the template
  picker's mode filter list it in that order.
- It is always offered, like every mode ([Editor modes](../007-editor/editor-modes.md#every-mode-always-offered)).
  Its Settings › Experimental switch went when it graduated.
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
  leaving Plan mid-tour still ends it (closing a card panel it opened).
- **Dashboards, Start Planning and the Sheet templates load when drawn too**: a Dashboard tab's page loads only for a
  Dashboard tab, Start Planning with the board picker, the Sheet templates' designs only when one is set up or drawn
  in a preview (the catalogue a menu names them from carries names and lines alone), and the tab menu's CSV writer
  at the press. Measured on the document page's first load (gzipped JS, the static export): 1,463 KiB on main before
  Dashboards and the new templates, 1,860 KiB with them loaded up front, 1,485 KiB once lazy (+22 KiB).
  `plan-lazy-load.test.ts` keeps them out of the first load.
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

- An empty Plan tab (nothing on its canvas at all) shows, in the middle of the canvas, **Start Planning**: one wide
  panel (up to 1024 px, kept clear of the toolbar above and the bottom-right buttons below, scrolling inside itself)
  in which every way to start is one look away, without steps.
  - **Header**: **Start Planning** (20 px), "Pick how to run the work. You can add more boards, sheets and dashboards
    later.", a search field (**Find a board, sheet or layout**, focused as the panel opens on a desktop) and Help.
  - **The rail** (left, 208 px; on a phone a row of chips under the header that scrolls sideways): **Recommended**,
    **Boards**, **Spreadsheets** and **Dashboards**, each with its glyph and how many it holds (a count badge, tinted with the chosen one), the chosen one tinted in
    the brand colour; then, under a hairline, **Inspiration** (as the others). The arrow keys move along the rail. It opens on
    Recommended each time.
  - **The grid** beside the rail: the chosen category's heading and line, then its cards, three a row (two on a narrow
    panel, one on a phone), cascading in when the category changes (the shared cascade, within the motion budget; the
    first paint does not animate), scrolled back to its top each time.
  - **On a phone** the panel runs nearly edge to edge under the menu box and stays compact: the title (18 px) and Help on
    one line, the search on the next, no line under the title; the rail's chips scroll the chosen one into view; each
    card is a row (its picture 96 by 72 px at the left, its name, badge and line, two lines at most, beside it, no
    card-type chips), so a screen holds several.
    - **Recommended** ("The quickest ways to start, picked for most teams."): the Roadmap, Kanban and To-do List boards,
      the Overview dashboard, the Empty Sheet, and the Feedback form.
    - **Boards** ("Columns of cards for the work to move through."): every board type in `PLAN_BOARD_TILES`' order,
      Blank first, All Cards last, the Archive board left out.
    - **Spreadsheets** ("Cells, formulas and charts, beside your boards."): **Empty Sheet** ("A blank grid, ready to
      type into.": a blank grid at once, with no Setup Sheet), **Card Table** ("Your cards of a type as rows, linked
      both ways. Pick which next.", only while the document has cards; Setup Sheet opens on its Cards step, Plan Cards
      chosen, to filter by Card Type), then every [sheet template](../029-sheets/sheet.md#sheet-templates) in the
      catalogue's order (Budget, Tracker, Timesheet, Contacts, Invoice, Expense Report, Sales Pipeline, Inventory,
      Guest List, Grade Book, Habit Tracker, Loan Calculator), each with its line and a picture of how it looks (its
      title and header in its accent, banded rows, its total, summary and chart), each with its own search words
      (`START_KEYWORDS`: a Loan Calculator found by "mortgage", an Invoice by "billing"). A template opens Setup Sheet
      on Style with it chosen, Banded picked and Freeze Header Row on, so **Create Sheet** makes it. A sheet later cleared starts Setup Sheet from the
      beginning.
    - **Visualisations** ("One chart filling the tab, read live from every card: a Gantt chart, a due calendar and
      more."), above Dashboards: Gantt Chart, Due Calendar, Start Calendar, Cards by Field, Priority Matrix and Card
      Search, each its picture; choosing one makes the tab a Visualisation tab of it, named after it when still on its
      default name ([Plan tabs](plan-tabs.md#a-row-that-fills-the-page)).
    - **Dashboards** ("Your boards, sheets and charts side by side, in rows of slots."): the preset layouts (Two by
      Two, Overview, Focus, Three Columns, Stacked, Report), each drawn to scale.
      Ahead of them come Dashboards **built from the document's own work** (`suggested-dashboards.ts`; the
      document's tabs are fetched as the panel opens so every board is read), each badged **For You** (in place of its kind badge), its
      chips saying what it holds, made at once with its slots filled:
      - a board whose cards have start and due dates: **<Board> Timeline** (Completion, Due Soon, Item Count and
        Unassigned; a Gantt chart; the board);
      - a board with estimates (or a Points widget): **<Board> Sprint Health** (Points, Completion, People and Stale
        Cards; the board; Cards by Field and Priority Matrix);
      - a board laned by priority, or taking Bugs: **<Board> Triage** (Priorities, Unassigned, Stale Cards and Due Soon;
        Priority Matrix and Cards by Field; the board);
      - a board with votes: **<Board> Summary** (Top Voted, Item Count and People; the board; Cards by Field);
      - two boards or more: **Team Overview** (Completion, Due Soon, Item Count and People; the boards two to a row, up
        to six; Cards by Field and Due Calendar);
      - a board and a Sheet: **<Board> and <Sheet>** (Completion, Due Soon and Item Count; the two side by side).
        The first takes the Overview layout's place in Recommended. A tab still on its default name takes the
        Dashboard's name. Archive and All Cards boards suggest nothing.
    - **Inspiration** ("Ready-made ways to run real work, from hiring to launches, set up across tabs for you."): the
      Plan templates that set up boards, the most eye-opening first: Hiring Pipeline, Content Calendar, Product Launch,
      OKRs, Feedback Board, Project Planner, Bug Tracker, Team Retro, Weekly Planner and Kanban, then Task Tracker
      (Blank Plan left out, and a [spreadsheet template](plan-templates.md#spreadsheet-templates) that makes one tab
      too: it is one Sheet that **Spreadsheets** above already offers, so no choice shows twice; one that sets up more
      tabs, as Task Tracker's Sheet and Overview, stays; `INSPIRATION_TEMPLATES`), each its template preview and a badge of how many tabs it
      adds ("4 Tabs", `planTemplateTabCount`). Choosing one applies the template to this
      tab, its later tabs after it.
  - **A card**: a large picture (112 px tall) on a soft panel of the tab's column colour, then its name with a small
    badge of its kind (**Board**, **Sheet**, **Dashboard**, **Template**) where the grid mixes kinds (Recommended, a search), its line
    (two lines at most), and for a board the card types it takes, as chips with each type's colour (up to three, then
    "+2"; a Blank board says **You Choose**, All Cards **Every Card**). On hover or focus it lifts and its border takes the
    brand colour. Choosing one acts at once: a board is placed, empty,
    in the middle of the view; a sheet as above; a layout makes the tab a Dashboard of it. Each choice makes the tab
    its kind ([Plan tabs](plan-tabs.md)).
  - **Search** matches names, lines, kinds, a board's card types and each choice's keywords (`START_KEYWORDS`, a sheet template's own `keywords` and a Plan template's
    `templateKeywords`, the words every template search reads: what
    it is for and other names for it, a Sprint found by "scrum", Hiring Pipeline by "recruiting", Budget by
    "expenses"; every word typed must match, case ignored), across every category, the results
    grouped under **Boards**, **Spreadsheets**, **Dashboards** and **Inspiration**, after a **Best Match** of the choices whose name begins
    with what was typed ([Template starts → A title match leads](../007-editor/start-diagramming.md#the-panel)); the rail shows no choice while a search is typed, and
    Escape clears it. Templates of the other modes that match follow, under **In Other Modes**, and choosing one switches the
    tab to its mode ([Template starts → Found in other modes](../007-editor/start-diagramming.md#found-in-other-modes)). Nothing
    found anywhere: the shared empty state, "No boards, sheets or layouts match “<text>”" ("Try another word.").
  - The keyboard reaches everything in reading order; Enter or Space chooses. It is gone once the tab has anything on
    it, and never shown to someone who may only view (a Participant or a Viewer). In the tab's light or dark look.
- Every list of board types (the palette's Boards, Start Planning) is one list (`PLAN_BOARD_TILES`), and **All
  Cards is always its last option**: a new board type goes before it (and before Archive, which sits just ahead of
  All Cards in the palette).
- Plan mode has no empty-canvas card: Start Planning is its start. A diagram template or another mode's is found by
  its search, or reached through the mode switch that leads the rail.
- **A new tab from Plan stays Plan**: adding a tab (the tab bar's **+**) while in Plan mode opens it in Plan
  (`opensIn` Plan, for everyone), straight to **Start Planning**. Every mode does the same: a
  new tab opens in the mode it was made from ([Editor modes](../007-editor/editor-modes.md) "A new tab opens in the
  mode it was made from").

## Switching modes keeps the tab

- **A tab keeps its mode once it has content** ([Editor modes](../007-editor/editor-modes.md#the-mode-switch)), so
  boards and Sheets go only on tabs in Plan ([Plan tabs](plan-tabs.md#only-in-plan)): a paste or an agent never puts
  one on a tab in another mode. Their work is items in the document, which no mode touches.
- **A board a tab in another mode already holds** (from before) is drawn with its columns and cards, live as items
  change, and is selected, moved, resized, copied, styled and deleted as any element is. Its cards do not take the
  pointer or the keyboard there.
- **A diagram is welcome in Plan**: a tab's shapes, ink, arrows and pages stay on it in Plan mode, worked the Diagram
  way (Plan's palette offers fewer of them, nothing more).
- A start's mode switch and **Shift+D** switch an empty tab at once, with no question, as between any two modes;
  Shift+D announces the mode it reached. A tab with content keeps its mode
  ([Editor modes](../007-editor/editor-modes.md#the-mode-switch)).
- A tab with Plan content is never added to another document: the tab menu's **Add to Document** is off for it,
  as its cards are this document's items.
- Telemetry: a switch is the existing mode event (`Editor` · `Changed` · `ModePlan`, ...), nothing more.

## Tools

- **Plan starts on the Hand tool**: a board's cards take the pointer themselves, so a drag on the canvas moves
  it. Select is one pick away, for moving or resizing a board.
- **Eraser and Format are left out** of the tool picker and their shortcuts: they work on drawn content a Plan
  tab does not hold.
- **No Layers panel**, as below.

## No palette

Plan mode shows **no palette**, to an Editor or a Participant: a Plan tab is worked by its boards, sheets and
dashboards, and each carries its own tools on its surface, so a strip of tiles only made them harder to use. What the palette used to place is reached where it is
used:

- **Boards and Sheets**: Start Planning on an empty tab ([Starting a board](#starting-a-board)), its templates
  included.
- **Cards**: a column's **Add card** ([Plan board](plan-board.md)), and the Plan strip's **New Card**.
- **Widgets**: the **+** at the end of a board's widgets ([Board widgets](board-widgets.md)).
- **Card Types**: the **Card Types** button in the bottom-right cluster ([Item types](item-types.md)).
- **Metrics, visualisations, notes and the written cards**: a Dashboard's **Add to Slot** and its slot menu's **Add a
  Slot** ([Plan tabs](plan-tabs.md#dashboard-tab)).

The Explorer menu keeps its corner on a phone, as on a whiteboard. Draw mode's shape dock leaves the Plan categories
out: they frame items, not ink.

A board placed by any of these paths takes its preset's set-up: a column takes the status the tab already has of its
name, and any other column a status of its own, so it starts empty
([Plan board](plan-board.md#the-board-set-up), "One name, one status").

- **Each preset takes the card types its work is made of**: Kanban takes Tasks and Actions; To-do List,
  Actions; Sprint, Stories, Tasks and Bugs; Retro, Notes and Ideas; Roadmap, Projects; Bug Triage, Bugs; Week,
  Tasks, Actions and Notes. Blank asks in Setup Board; Archive and All Cards show cards by what they are.
- **A preset brings its card types**, all of them [ready-made types](plan-templates.md#ready-made-card-types)
  (Bug: red, the bug glyph; Story: violet, the story glyph); a Blank board brings none. Placing the board adds
  each type it brings that the document lacks (by id), as one change, so in a fresh document (which starts with no
  card types) the first board chooses them: a Kanban board's document has Task and Action only
  ([Item types](item-types.md#the-type-catalogue)). Only a board
  that appears while the document is open adds them (placed by this person, a template or a collaborator); the
  boards a document opens with never do, so a type someone deleted stays deleted. A template's tabs bring theirs
  as they are made, on every path ([Plan templates](plan-templates.md#card-types-a-template-uses)), and an agent's
  `add_board` brings its preset's.

## Templates

Templates that open in Plan mode set up a way of working across several tabs, with **no cards**:
[Plan templates](plan-templates.md) holds the catalogue, how a template's tabs are made and how their boards
hand cards to each other. Blank Plan is the mode's blank, as Blank Diagram is Diagram's: an empty Plan tab, no board, so it opens on **Start
with a Board**.

## Collaboration

- Everyone in the room sees item changes as they happen, in order (items' [Live for everyone](items.md#live-for-everyone)).
- Presence shows on cards: a card someone is dragging or has open carries their colour ring and first name, sent
  as an ephemeral `plan-presence` room op that is never stored.
- **A late joiner sees cards already held.** The room keeps no holds, so each person holding a card says it again
  when a new person appears in the room's presence list, and when their own connection rejoins (the room gives a
  rejoined connection a new presence id, which carries no hold until it is said). Nobody else sends anything: a
  person holding nothing stays silent. A holder who leaves or drops takes the ring with them, since rings are
  drawn only for people in the presence list.
- Everyone on a tab works in its one mode, and sees the boards move as items change.
- Facilitation on a board (hide writing and reveal) lives in the board's set-up, and voting is the tab's session
  vote on the cards, so a retro needs nothing
  beyond the board and the tab's Vote.
- **No participant cursors on a Plan tab but a Dashboard**: a Board tab, a Sheet tab, or any other tab worked on in
  Plan mode shows no one else's cursor (or laser): the board or Sheet covers the canvas a cursor would point at, and
  presence there is the avatars and each card's editing ring. A Dashboard (a Visualisation tab included) shows them,
  as a diagram does (`planHidesCursors`).

### Nothing attached to Plan items

A Plan item (a board, a Plan card element, a visualisation or a Sheet; `takesAttachments` in `@livediagram/document`)
takes **no comment, action, link or note** of its own: the conversation lives on its cards, each with its comments
and fields. So, for everyone whatever their share role:

- its element menu (a right-click, the selection's ⋯, a board's cog) has no **Collaborate** (Assign Action, Add
  Comment) and no **Resources** (Add Link, Add Note) sections;
- the command palette offers no **Add / Edit Note** or **Add Comment** with one selected, and those commands do
  nothing on one;
- a Viewer's selection toolbar has no **Add Comment** button for one;
- a Dashboard slot's cog offers none either (its Slot section only arranges the slot).

A comment thread, action, link or note left on a Plan item from before stays in the document untouched (nothing is
deleted or migrated), but its indicators are not drawn, so nothing invites adding to it.

## Agents

- Agents read and write items through the api, the CLI and MCP ([Agents](../024-agents/README.md)): the CLI's
  `item ls|add|set|move|rm`, and the MCP's `list_items` and `change_items`. Items are named by number (`#12`) or
  id prefix.
- A document made from a Plan template by an agent (the CLI's `--template`, the MCP's `create_document`) gets the
  same tabs and boards, with no cards, as one made in the editor ([Plan templates](plan-templates.md)).
- How agents read the plan, name columns, card types and fields, and change card types: [Plan for agents](plan-agents.md).

## Telemetry

- Switching to Plan, Opens in Plan and the template filter fire the existing mode events with `ModePlan`,
  `OpensInPlan` and `TemplateModePlan`.
- The `Plan` category: `Added` (the item type, or `Card` for a Plan card), `Moved` (`Board`), `Opened` (`Item` from a board or a list; `Parent`, `ChildCard` or `Breadcrumb` from inside the item panel), `Deleted` (the item type), `Changed` (the set-up part), `Toggled` (`FlagOn` / `FlagOff`)
  and `Revealed` (`Board`), never content. A board placed from the palette counts as `Element` · `Added` · `PlanBoard`, a plan view as `PlanView`.
- The header's Start Blank menu offered Blank Plan until it was retired, its funnel slot (`HeaderPlan`) kept for history.

## The Plan tour

- The first time a person works in Plan with a board or Sheet open, a guided tour offers itself on that board or
  Sheet, changing nothing on it: [Plan tour](plan-tour.md).

## Help

- A help article for Plan mode (the mode, boards, set-up and keyboard) and one for items, registered with the help
  centre; one for the [Plan tour](plan-tour.md).
