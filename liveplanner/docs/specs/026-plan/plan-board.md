# Plan board

A **Plan board** is one element on the canvas that frames the project's [items](items.md) as columns of cards:
a Kanban board, a sprint board, a retro. The board holds only its **set-up** (its columns, how it groups, what it
shows); the cards on it are drawn from the item store. Moving a card changes the item, so every other board that
shows the item, and every collaborator, sees it move.

A **Plan card** is one item placed on its own anywhere on the canvas, for example beside the part of a diagram it
is about.

## Domain language

| Term             | Means                                                                                | Never called              |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| **Plan board**   | The `plan-board` shape: a board set-up drawn with the items it matches               | Kanban element, board tab |
| **Plan card**    | The `plan-card` shape: one item on the canvas                                        | ticket element            |
| **board set-up** | The board's stored configuration (`planBoard` on the element)                        | board config, settings    |
| **column**       | One status the board shows, left to right                                            | lane (lanes are elements) |
| **swimlane**     | One row of the board, grouping its cards by a field (assignee, type, any field, ...) | lane, row                 |
| **WIP limit**    | The most cards a column should hold                                                  | cap, max                  |
| **unplaced**     | Items whose status is none of the board's columns                                    | orphans, hidden           |
| **quick filter** | A person's own, unsaved narrowing of what a board shows ("Only mine", a search)      | filter setting            |
| **face-down**    | A card drawn as its colour and author only, while its board hides writing            | hidden, private           |
| **selection**    | The cards one person has picked on one board to change together (theirs, unsaved)    | multi-select, batch       |
| **saved filter** | A named quick filter kept on the board set-up, shared, that anyone may apply         | view, preset, smart list  |

## The board set-up

Stored on the element, shared by everyone, undone like any element edit:

- **Field names** in every menu below (Swimlanes, Sort Cards, the Filter widget, saved filters, field widgets, the
  selection bar): a built-in field reads as every card type the board shows names it, when they all agree
  ([Edit Field](item-types.md#built-in-full-edit): "Sort By Points" on a board of types calling Estimate Points);
  else by its own name. A saved filter on a field whose type changes comes off with the change, in its undo step.

- **Title**: shown in the board's header. <a id="the-boards-title"></a>A board placed on a tab (from the palette, Start
  Planning, or drawn) is **named after its tab** ("Launch"), its preset's name ("Kanban") when the tab has none or
  still has its default name ("Tab 4"), and a Board tab then takes the board's title
  ([Names](plan-tabs.md#names));
  a template's boards keep the titles the template gives them. When a tab is renamed away from its **default name**
  ("Tab 4", `isDefaultTabName`), each board on it still titled that takes the new name in the same change (one undo
  takes both back); a board someone titled differently keeps its title, and a tab that already had a name of its own
  renames no board.
- **Columns**: each a **status** value and a display name, an optional **WIP limit** and an optional colour. A board
  has 1 to 12 columns. A column's status is read trimmed, as a card's status is, so a card moved into it lands in it. The first column is where new items land when no column is chosen.
- <a id="done-columns"></a>**Done columns**: any of a board's columns can **count as done** (Done, Won't Do and
  Cancelled all close a card). Their cards draw muted, count as finished in the header's progress, Completion,
  Points and the dashboards, and are never overdue or stale. A board may have none, one or several.
  - **Found by name**: a column added or set up with a done-like name counts as done without anyone saying so:
    **Done**, **Won't Do**, **Won't Fix**, **Cancelled** (or Canceled), **Completed**, **Complete**, **Closed**,
    **Resolved**, **Shipped**, **Fixed**, **Released**, **Published**, **Delivered**, **Finished**, **Rejected**,
    **Declined**, **Abandoned**, **Dropped**, **Merged** and **Deployed**. Names are compared as statuses are
    (case, spacing, curly or straight apostrophes, "Wont Do"), whole names only: "Not Done" and "Done Soon" are not
    done.
  - **Set by hand**: **Counts as Done** in a column's own settings turns it on or off for that column, whatever its
    name, and that choice is kept (a later rename does not undo it).
  - **Older boards**: a board saved before columns were flagged keeps reading as it did, its one done column and
    every column after it counting as done, until its columns are next changed, when each column keeps what it
    counted as and is flagged so. A board with neither reads its columns' names.
- **The header's controls** run Focus, Maximise, then the cog. There is no ⋯: the cog is the board's menu.
  Maximised or filling its tab, the board has no Focus. A board has no Add to Slides button in its header.
- **Configure**: on a Board tab (the board filling its tab), an Editor sets the board up from the bottom-right
  cluster, not the header: a **Board** button (a cog, with a tooltip) joined to the left of **Style** in one group. The header then has no cog, and no hairline is left before where it was. Board opens the **Configure Board** panel the way
  Style opens Tab Style: on a screen wider than a phone it flies up from the button, its bottom-right corner just
  above the cluster's right edge; on a phone it is a bottom sheet; without the cluster on screen it is a centred
  dialog. Nothing dims, as each change applies live; a click outside, Escape or the close button closes it, and
  pressing Board again does too. Its header holds **Create Form** (where the board can take one, as in its element
  menu: a form whose responses come to this board) beside the close button, left out on a phone, where it does not
  fit beside the title. Its home holds:
  - **Suggested for This Board**: presets, each a small drawing of the layout, its name, a line on what it does and,
    when the board's cards give one, why it suits them ("5 of 8 cards have someone on them"). A preset sets the
    swimlanes, the sort and the card size at once and never the columns or the cards, so trying one is safe and one
    undo puts it back. **Simple Columns** and **Compact Overview** come first, always offered; then the others the board's card
    types can show, best fit first by how much of the
    board's own cards they use; one with nothing to show (lanes by person where nobody is assigned) is left out once the board holds five cards or
    more; with fewer there is too little to go on, so every preset its types can show is offered.
    The one the board is laid out as now is marked. At most **nine** are offered; past that the least fitting are
    left out. The presets: **By Person** (a row per person, soonest due first), **Most Urgent First** (highest
    priority first, then soonest due), **Deadlines First** (soonest due first), **By Priority** (a row per
    priority), **By Label** (a row per label), **Quick Wins First** and **Biggest First** (by estimate, smallest or
    largest first), **Starting Soon** (soonest start first), **Newest First** and **Recently Changed** (by the card's
    stamps), **By Card Type** (a row per card type, on a board showing more than one), **Compact Overview** (Minimal
    cards, no rows) and **Simple Columns** (no rows, cards in the order they were put). Then the board's own card
    types' fields: a Choice or Checkbox field gives a row per value ("By Stage", "A row for each Stage, from Lead to
    Won."), a number, currency, percent, rating or duration field a largest-first sort ("Highest Seats First"), and a
    date field a soonest-first one ("Earliest Renewal First"), each with how many cards hold it, or which type it
    comes from on a board with too few cards to judge by. They rank a little above a general preset using as many
    cards, being the board's own.
  - **Fine-Tune**: a tile per part of the set-up (Columns, Swimlanes, Sort Cards, Supported Cards, Card Layout, as
    the board shows them), each saying how it stands now ("5 columns", "Priority, then Due Date"). A tile opens that
    part's controls (the same as its element menu row) in a popover coming out of the tile, a small arrow pointing
    at it, above the tile or below as there is room (300 px wide, Columns 380 px for its rows of controls), the rest
    of the screen dimmed behind it so it stands out; the tile shows itself pressed while it is open. Pressing the
    tile again, a press outside it or Escape closes the popover alone, Configure Board staying open. The dimmed
    layer closes it on its click, not on the press, so a tap on the open tile (under the layer) closes it rather
    than closing and reopening it.
- **Board Settings cog**: elsewhere (a board on an ordinary tab, maximised or not), a board's header ends with a cog (**Board Settings**, with a tooltip) at its far right, after
  Maximise, for someone who may edit. It selects the board and opens its **element menu** under itself (the menu a
  right-click on the board opens, with the same rules: maximised or filling its tab, no Layer, Size, Rotation or
  Animation; no Style (the tab's theme dresses a board), then its own rows Columns, Swimlanes, Sort Cards, Supported Cards and Card Layout; no Collaborate or
  Resources, [Nothing attached to Plan items](plan-mode.md#nothing-attached-to-plan-items)); pressed again it
  closes it. A board a collaborator holds opens nothing. In a Dashboard slot, where the board is simplified
  ([Dashboard tab](plan-tabs.md#dashboard-tab) "A board in a slot is simplified"), the header ends with the slot's own
  cog (**Slot Settings**: the slot toolbar, with **Open Tab**, and its **Slot** section) and no board sections, for
  everyone. Maximised from the slot, the board is whole again: for an Editor the cog opens **Board Settings** as a
  popover (as a Sheet's and a chart's cogs do), Columns, Swimlanes, Sort Cards, Supported Cards and Card
  Layout, then the slot's **Slot** section, one open at a time; someone who may not edit the board sees the slot's own
  cog there. Telemetry: `Plan` · `Opened` ·
  `BoardSettings`.
- **Swimlanes**: none, or grouped by assignee, type, priority, status, or **any field** the card types the board
  shows offer, Parent among them (see [Swimlanes by a field](#swimlanes-by-a-field)). A board's columns are its statuses, so rows by status would repeat them: Status is not a choice on a board
  (the menu and Setup Board leave it out), except on an All Cards board, whose one column holds every status and whose
  rows are its statuses; a board stored grouping by status (an older one, or an agent's write) reads as no grouping
  (`normaliseBoardSetup`). A Gantt chart's Swimlanes still offer Status. The menu lists only what those
  types offer: None always, Type when it shows more than one type, Assignee, Priority and each field when
  one of its types has it; a board stored grouping by `parent` reads as grouping by the Parent field; a grouping already in use stays listed (and pressed) even once its types no longer offer it.
  A Gantt chart's Swimlanes do the same for the card types it draws.
- **Sort Cards**: off (cards in rank order, as placed by hand), or up to **two levels** of fields, each with a
  direction, shared by everyone. Each column (and each cell, with swimlanes) orders its cards by the first field, then
  the second where the first ties, then rank where both tie. The fields a board can sort by: **Priority**,
  **Estimate**, **Start Date** and **Due Date** (when its types offer them), **Created At** and **Last Edited At**
  (always: every type offers them, [Items](items.md#created-and-last-edited); sorted by the moment, not the day),
  then every custom **Number**, **Currency**, **Date**, **Rating** and
  **Choice** field the card types the board shows offer (a Choice by its options' order). A card with no value for a
  level (or whose type does not have the field) comes after those that have one, whichever way that level runs. The
  directions read by kind: Priority **Highest First** or **Lowest First**; a number, currency, estimate or rating
  **Lowest First** or **Highest First**; a date **Earliest First** or **Latest First**; a Choice **In Option Order**
  or **Reverse Option Order**. A field picked starts on Highest First for Priority and Rating, else on the first.
  A board sorted by a field its types no longer offer keeps it (listed and pressed, as Swimlanes keeps a grouping),
  and its cards read as having no value for it. While a board is sorted, **reordering within a column is off**:
  a card dropped back into its own cell stays where the sort puts it, and Shift+Up/Down announce "Sorted by {Field}:
  turn Sort Cards off to reorder by hand." Dragging a card to another column, row or board still moves it, its
  placeholder drawn where the sort will put it. Sort Cards off puts the hand order (rank) back as it was: sorting
  never changes a card's rank.
  - **Board Settings**' **Sort Cards** row (the element menu's and the cog's, after Swimlanes) opens with an info note
    ("Order each column's cards by up to two fields. While sorted, cards are not reordered by hand."), then **Sort
    By**: an [option list](#option-lists) of **None** then each sortable field (named by the field, drawn with its
    kind's glyph), and under it, while a field is chosen, its two directions as a two-row option list. Then **Then
    By**, the same for the second level, shown once Sort By has a field: None, then every sortable field but the
    first. Choosing None for Sort By turns Sort Cards off (the second level goes with it). Each choice is one element
    edit, undone like any other. Telemetry: `Plan` · `Changed` · `BoardSort`.
  - The board's header shows nothing new; a sorted board's column headers carry no handle. Someone who may only view
    sees the board sorted as everyone does.
- **Card shows**: which fields a card face draws (key, type, assignee, priority, labels, estimate, due, votes,
  checklist progress). Title always shows.
- **Voting** is not a board setting: a vote is the tab's session vote (Collaborate, Vote), cast on the cards the
  board shows ([Session tools](../012-collaboration/session-tools.md) "Voting on Plan cards"); a card shows the
  votes it has gathered.
- **Saved filters**: up to 8 named quick filters ([Board widgets](board-widgets.md#saved-filters)), shown as
  chips in the Filter widget. Each keeps the words, Only Mine, the field chips and the widget narrowings it was
  saved with; saving, renaming, updating and deleting one is an Editor's set-up change (undone as any), while
  applying one is each person's own quick filter.
- **Hide writing**: off, or on: each person's cards on this board are face-down to everyone else until the board
  is revealed. It hides the face, not the data; it is a facilitation aid, not a privacy boundary.

### Column names

- A column's (and so its status's) name is **Title Case**: every word capitalised, except a short article,
  conjunction or preposition in the middle (a, an, the, and, but, or, nor, for, so, yet, as, at, by, in, of, on,
  per, to, up, via, vs), so "Ready for Review"; the first and last words are always capitalised ("To Do",
  "Waiting On"). A word that already has a capital after its first letter is kept as typed (QA, MVP, iOS), as is
  anything that is not a letter; each part of a hyphenated word is capitalised ("No-Go"), a letter after an
  apostrophe is not ("Won't Fix"). One rule (`statusTitleCase`, packages/items) does it.
- Every board preset and Plan template names its columns this way (Kanban's **To Do**, **In Progress**,
  **Review**; Sprint's **Sprint Backlog**, **In Progress**, **In Review**; Bug Triage's **Won't Fix**; Retro's
  **Went Well**, **To Improve**). Status ids are unchanged, so cards already in them stay put.
- A name the person types (renaming a column, naming a new status in the column picker, the empty board's first
  column) is saved in Title Case. A status picked from the ones the project already has keeps its name as it
  is. A status with no name on the tab reads as its id in Title Case ("in-review~ab12" is "In Review").
- A column's settings open with the caret in its name on a desktop. On a phone (a bottom sheet) focus stays off the
  name, so no keyboard rises over the settings, except for a column just added, which opens there to be named.
- Names already stored in projects are not rewritten: an older board keeps "To do" until someone renames it.

Where each is set, so a setting lives with what it changes, never in one central panel:

- **A column's own settings** sit on the column: a cog at the far right of its head (always shown, for an Editor) opens a small popover (a sheet on a phone). A **right-click on the column's empty background** (anywhere in its cell that is not a card, its + Add card row included) opens the same settings, anchored to that column's cog as a press on the cog does, never the board's element menu, the tab's menu or the browser's; a right-click on a card keeps the card's menu. Only for someone who may change the board's set-up (where the cog shows); for anyone else a right-click there does what it did before (the board's element menu, or the tab's on a maximised or tab-filling board). On top is a **toolbar**: **Move Left** and **Move Right** at its start, one
  segmented control of two chevrons (each named by a tooltip; Move Left off on the first column, Move Right on the
  last), and **Remove** (a column glyph and the word; named Remove Column, rose on hover) at its end, apart from them
  as it takes the column away. A move glides: the column slides to its new place over 240 ms (a quick start, a soft
  landing), lifted above its neighbour on a soft shadow that settles as it lands, while the neighbour slides the other
  way and the cards ride along in their cells (they do not glide on their own as well); the popover goes with its cog
  frame by frame and settles under it. A reorder that arrives from a collaborator jumps, and reduced motion jumps. On a
  phone the sheet stays put. Under it: its **name**, **colour** (a row like the WIP limit's: "Colour" over
  its effect, or "No colour", and the colour's swatch at the row's end; pressed, the
  [colour picker](../004-interface-design/colour-picker.md) opens in its own popover beside it, No colour or any
  colour, the column popover staying open), **WIP limit**, **Width**, **Counts as Done** (a switch, on for a
  [done column](#done-columns) found by its name too), then, one to a row, **+ Add Column
  After** and **Delete Status**. The two ways to take it away: **Remove Column** (the toolbar's) takes it off this board only, at once: the
  state and its cards stay, so another board's column for it still shows them (where none does, the cards read
  as No status, as any card of a state no board names). **Delete Status** (a bin) deletes the state: when it
  holds cards (out of the Trash, on any board) it first opens a popover anchored to it: "Delete {Name}?", "Its N
  cards are in {Name}, on every board that shows it. Where should they go?", and two option cards, one picked:
  **Move to Another Column** (a menu of the board's other columns, the first picked; the default) or **Move to the
  Trash** ("You can restore them from the Trash."). **Delete Status** in it (a bin) moves the cards as picked,
  then removes the column, and the state's column from every other board in the project; **Cancel** or Escape
  keeps it. Moving to the Trash moves every card of that state and announces "N cards moved to the Trash"; a card
  whose type leaves out the target column's state stays, as a move does. A state that holds no card is deleted
  at once. The board's last column cannot be removed. Each change applies as it is made. **+ Add Column After**
  opens the **column picker** (below) in the popover; the column it adds goes after this one, and the popover
  moves to it, anchored to its cog.
- **The board's own settings** sit in its element menu (right-click the board, or the selection's ⋯) as **five
  flyout rows of the menu itself** (a board has no Style row: its tab's theme dresses it, and the old board
  presets are themes), each opening its own panel to the
  side, rather than one level down under a **Board** flyout, which would cost a click and hide them behind a name
  the rows say better; the cog shows the same rows (there is no Board Setup row: a board is named by its tab, and
  its columns and card types are set in Columns and Supported Cards; a board on the canvas is added to the slides
  from its element menu, above; the board itself has no ⋯),
  **Columns** (below; left out on an All Cards or Archive board and on one not set up yet, which Setup Board sets up),
  **Swimlanes** (**Group Rows By**, one grid: None, Assignee,
  Type, Priority (Status only on an All Cards board), then a row per groupable field, in one [option list](#option-lists), named by the field and drawn with its kind's glyph),
  **Supported Cards** (**Card Types**, below, then, for an Editor while the catalogue has room, a full-width **Add Card
  Type** that makes a new type with this board's statuses and adds it to the board; left out on an Archive board) and **Card Layout** (**Card Size**:
  Minimal or Detailed; what a card shows at each size is its type's Display, [Card
  display](item-types.md#card-display)). There is no Compact size: it differed too little from Detailed to be worth
  a choice. A board stored with the retired `cardSize: 'compact'` reads as Detailed; nothing is rewritten in
  place, and the board's next change saves it as Detailed (no `cardSize`). Group Rows By, Card Types and Card Size each open with a one-line info note
  (an "i" in a circle) saying what it does.
- **The Columns section** (the cog's and the element menu's): an info note ("The board's columns, left to right. Press
  one to open its settings."), then **On This Board** (a small uppercase heading with a count badge) over an
  [option list](#option-lists) of the board's columns left to right, a row each: its position number, its colour
  swatch (a hollow ring for none), its name, a **WIP n** pill when it has a limit, a green **Done** pill on each
  [done column](#done-columns), and a chevron. Pressing a row closes the menu and opens that column's own settings, anchored to its cog
  (above). Under a hairline, the **column picker** (below) inline, its button reading **Add** (still named Add
  Column): a column it adds goes at the end, or before the done columns when the board ends with them, and the section
  stays open so several can be added in a row; the row just added is tinted in the brand colour for a moment
  (1.6 s) as it fades in. At 12 columns the picker gives way to "A board holds up to 12 columns." The project's
  statuses are worked out only while the section is open. Each add is one board change, one undo step, with the
  picker's telemetry. Editor only: someone who may not edit sees no cog and no menu.
- **Card types a board shows**: the Cards menu's **Card Types** row, a row per card type ticked on or off in an [option list](#option-lists) (none
  named is every type). The last one can be turned off too: the board then takes no type, shows no cards, and each
  cell's Add card says so ("No card types on this board yet. Turn one on in Board, Supported Cards.", stored as an
  empty `addTypes`). A board shows only cards of those types, and takes only those:
  Add Card offers only them, a palette card of another type gets the red refused zone, and a card of another type
  dragged from another board is refused, each saying so ("This board shows Note, Idea and Action cards"). A card it
  hides is never moved, changed or deleted: it keeps its status and shows again the moment its type is turned back
  on. A board whose chosen types have all since been deleted (not turned off) shows and takes every type again. The board's count, widgets and quick filter count only the cards it shows. All Cards and Archive boards show
  every type unless their types are set. (Stored as `addTypes`; before this rule it limited new cards only, so a
  board that already named types now hides the others, which is what it says.)
  Defaults: Retro, Note and Idea (an action is tracked on a board of its own); Sprint, Task and Action; Bug Triage, Task; Roadmap, Project; Kanban and
  Week, Task, Action and Note; To-do List, Action; Blank and All Cards, every type.
- **The To-do List board** (preset `todo`, after Kanban in the lists): two columns, **To Do** and **Done** (the done
  column), for Action cards only, Detailed cards showing who has each action and when it is due (its checklist
  progress in the card's footer), and the Completion and Due Soon widgets.
- **Setup Board**: a board with no columns (the Blank board starts so, and starts taller than a set-up board: 880 px
  against 640, blueprint DEFAULTS D5) is **not set up yet**.
  - **On the canvas** it shows, in place of its columns, a calm **placeholder**, centred: a board glyph, the board's
    title, "Not set up yet", and for someone who may edit a **Set up board** button that opens the Setup Board
    dialog. Whoever else has the board selected the canvas's own selection badge names, as on any element. Someone
    who may only view reads "Someone who can edit it will set it up." instead of the button. The placeholder zooms
    with the board like any of its content.
  - **The dialog** is a modal over the editor (the editor's shared dialog: a dimmed backdrop, focus held inside,
    Escape, the close button or a press on the backdrop closes it), never drawn inside the board and never zoomed
    with the canvas. It is in the app's colours (light or dark, as the editor), 40 rem wide and a fixed height (up to
    40 rem, never past the window), so moving between steps never jumps it; on a phone it fills the screen. Its
    header holds a board glyph, the title **Set up your board**, the line "Pick its cards, columns and layout. Change
    them any time from its cog.", Help and Close. Under it, the steps as a **step indicator**: a numbered circle per
    step joined by a connecting line, the step's name beside its circle (under it on a narrow dialog), and "Step 2 of
    3" read out (a polite live region) as the step changes. The current step's circle is filled in the brand colour
    and its name bold (`aria-current="step"`); a done step's circle holds a tick, the line up to the current step is
    filled in the brand colour, and a done step is a button back to it (pointer, focus ring); a step ahead is muted
    and not a button. Only the step scrolls; its **footer** stays put under it: **Back** at the left (from step 2),
    and at the right **Not now** (**Cancel** when run again) and the step's primary action.
  - **When it opens**: for the person who placed the board (Start Planning, a Dashboard slot's new board), at once;
    and from the placeholder's **Set up board**. Only for that person:
    nobody else's screen changes. A board someone else placed, or one brought back by undo or a template, shows the
    placeholder until someone presses Set up board.
  - **Closing without finishing** leaves the board as it was (the placeholder) and keeps what was picked: opening it
    again on that board returns to the same step with the same choices, for the rest of the session.
  - **Keyboard**: Enter presses the step's primary action (Next or Create Board) from anywhere in the dialog but a
    text field, a button or a link (where Enter already means something: the column name field's Enter adds the
    column); a chosen option row counts, an unchosen one is picked by Enter instead. In each option list ArrowUp,
    ArrowDown, Home and End move between rows ([Option lists](#option-lists)).
  - **With others**: if the board is set up by someone else while the dialog is open (it gains columns this person
    did not write), the dialog closes and a toast says "This board was just set up by someone else."; whoever
    finishes first wins, and nothing this person picked is written. A board deleted while its dialog is open takes the
    dialog with it.

  The steps:

  1. **Card Types**: an [option list](#option-lists), a row per card type of the project (its glyph on a tint of its colour, its name, a tick when
     on), none on to start (run again on a set-up board, the types it shows); **Select All** and **Clear**; under the list **Add Card Type** (a dashed full-width button, while the catalogue has room) opens the type editor, and a type made there joins the list already ticked; a count ("Every card type, 5 in all", "3 of 5 card types").
     **Next: Columns** needs at least one.
  2. **Columns**: the columns chosen so far, top to bottom as the board will show them left to right, each a row
     with a grip, its name, "Existing state" or "New", and a remove cross; "No columns yet. Add one below." while
     there are none. A row is reordered by dragging its grip (mouse, pen or finger): a lifted copy follows the
     pointer, the others close up and a dashed slot in the brand colour shows where it will land; release places
     it, Escape puts it back; Alt+Up and Alt+Down on a grip move it by keyboard. Its heading counts them with a count badge. Then **Add a New State**, a name field
     and **Add** (Enter adds too): a name matching an existing state uses it ("Uses the existing To Do state, so its
     cards show here."), one already chosen is refused ("That column is already on the board."). Then **Use an
     Existing State**, an [option list](#option-lists) with a row per status the project has that is not chosen, listed exactly as
     the column picker's Available States (the same statuses, order, colour swatch, "On Sprint, Roadmap" or "Not on
     any board", and card count of the card types chosen in step 1; named "Add {State}"), one to a row, with
     **Add All**. When there is no existing state to use (a new plan, or every state the project has is already
     chosen), **Suggested States** shows in its place: the [suggested statuses](#suggested-statuses) left once the
     columns chosen and the project's states are set aside, one to a row, each added as a new state with one press
     where it keeps the order a board runs (before the first later suggestion already chosen, else at the end, so Done
     stays last whatever order they are pressed in),
     with **Add All** for two or more. At 12 columns adding stops ("A board holds up to 12 columns."). **Back** returns to step 1 with
     nothing lost. **Next: Layout** (needs a column) goes on; Create Board is not offered before the Layout step.
  3. **Layout** (starting from the board as it is, so pressing straight through keeps its preset's layout): "How the
     board is laid out. It starts as the board is now; every choice can change later from its cog." Then
     **Swimlanes** (its line "Rows across the board, one for each value of the field you pick." and the same option list
     as the board menu's Swimlanes, offering what the card types chosen in step 1 offer), **Card Display** (its line
     "How much of each card shows. Each card type's Display sets what shows at each size." and the same Minimal
     and Detailed rows as the menu's Card Layout). No Fill Tab: a board fills a tab by being a Board tab's
     ([Fill Tab](#fill-tab)). **Back** returns to Columns with nothing lost.
     **Create Board** (**Save Board** on a board run again; the Layout step's only, needs a column) writes the columns (an existing state keeps its
     status, so its cards show; a new one has a status of its own), the card types (every type is no `addTypes`; a
     chosen few are) and the layout (grouping and card size) as
     one change, one undo step, and closes the dialog, focus going to the board. Telemetry: `Plan` · `Changed` ·
     `BoardSetUp`.

- **No Setup Board again**: once a board is set up, its columns change in Columns and its card types in Supported
  Cards; the cog has no Setup Board to run the dialog again.

## What the board shows

- **Header**: title, the [card type chips](#card-type-chips), the count of items shown, a progress bar (cards in its done columns of all, when it has one), the
  avatars of people on the board and the quick filter.
- **Renaming in place**: in Plan mode, someone who may edit double-clicks the board's title (or the header's
  empty space) and the title becomes a text field, its text selected. **Enter** or leaving the field saves the
  trimmed name (up to 80 characters, as the Board menu's **Title** takes it), one change; an empty name changes
  nothing; **Escape** puts the old name back. The double-click goes no further (it never reaches the canvas), and
  the field's own presses never move the board. A double-click on a widget or a button in the header does not
  rename. Outside Plan mode, or to someone who may only view, a double-click does what it did before.
- **Move handle**: while a board is selected, a grip before its title shows where to take hold of it: the
  header (and the empty part of its widget row) moves the board; columns and cards do not.
- **Columns**: name, count, and the WIP limit as `3 / 4`. Over the limit, the count turns to a warning colour and
  the column header says so; it never refuses a card.
- **Column width**: a column is one slot wide, or two or three (its cog's **Width**); the slots share the board's
  width, so a wide column suits a busy stage.
- **Column heads stand clear of the board's header**: 12 px of the board's surface sits between the header and the
  row of column heads (not on a slot board), so they read as separate things.
- **Column heads stick flush**: scrolling down a board, its column heads (a collapsed column's too) stay at the top
  of the board's body. The 12 px that stands them clear at rest scrolls away with the cards, so a stuck head sits
  flush under the board's header with no strip of cards showing above it, and there is no jump between the two: the
  gap simply scrolls out. A head is solid: its colour (85%, as a cell's) is laid on the board's own paper rather than
  over what is behind it, so a card scrolling under a stuck head never shows through it, in any theme or finish,
  light or dark. A slot board's heads already rest flush and are solid.
- **Column heads**: a column's head reads count first: its count badge (the count, or "3 / 4" against a WIP limit,
  amber when over), then its name, then Collapse Column and its cog at the right.
- **Column hover**: the column under the pointer says so, barely: its head and cells (a collapsed column's strip
  too) shift 1.5% toward the board's ink, easing in and out over 250 ms (at once with reduced motion). Nothing else
  changes and nothing moves. Under the Sketch finish, whose drawing is a still copy, the same wash is laid over the
  drawing. Not on a touch screen, nor on a slot board.
- **Collapse Column**: a column's head offers **Collapse Column** (two arrows closing on a column's edge, at its right, with that tooltip, always shown,
  a little quieter at rest and full strength on hover and focus), and for someone who may edit, its cog's toolbar too. Collapsed, the
  column is a thin strip (`COLLAPSED_COLUMN_PX`) in its place: its colour bar and an **Expand Column** button (the arrows opening out from the edge) at the
  top, then its name written top to bottom (no count badge; the count is in its accessible name), the whole strip
  pressable to expand it. On a board with swimlanes, each open swimlane's part of the strip is shaped as that row's
  open cells are, and the name shows once, in the first open swimlane's part; the others are plain.
  - **The name only when it fits**: the name is shown whole or not at all, never cut short ("U..."). It needs its full
    length; in a part too short for that (a short swimlane row), the part shows nothing. The
    column is still named by the part's accessible name and its tooltip ("Expand Column, {Name}"). The browser's own
    layout decides it (no measuring in script, no flash of a clipped name), on a plain board and in every swimlane row. The other columns take
    the room it leaves (maximised or filling its tab, the five slots across are measured from what the strips leave).
  - **Drops**: a card dragged over a strip lights it (dashed in the focus colour, or in red when the card's type
    leaves the status out, where letting go is refused and the reason announced) and, let go, moves there at the column's end (in that swimlane's row on a board with
    swimlanes), as a drop into the open column would; the column stays collapsed. A palette card dropped on it is
    made there.
  - **The keyboard**: arrow keys pass over a collapsed column (its cards are not drawn); Shift+Left/Right still moves
    a card into it.
  - **Each person's own**, like a collapsed swimlane: nothing is saved to the plan, sent to anyone or undone. It is
    remembered per board on this browser (`localStorage`, `liveplanner:v2:board-collapsed:<board id>`, the column
    ids and the swimlane keys shut), so a reload, the tab reopened or the board maximised keeps it; a column removed
    from the board drops out of it.
  - **Every role**: an Editor, a Participant and a Viewer may each collapse and expand columns for themselves.
  - **It animates**: expanding, the column opens out from its strip as its neighbours glide aside; collapsing, the
    neighbours glide in and the strip fades in (`COLUMN_MOVE_MS`, within the motion budget). Under reduced motion it
    switches at once.
  - **Telemetry**: `Plan / Toggled / ColumnCollapsed` and `Plan / Toggled / ColumnExpanded`.
  - **Not on a phone** (below 640 px): no Collapse Column anywhere, and columns collapsed on a wider screen show
    open, one a screen as ever ("On a phone"). Nor in a Dashboard slot's compact board, whose columns show open;
    maximised from the slot, the person's collapsed columns apply.
  - **Exports** (an image of the tab, the CSV) draw every column open: they are drawn from the board's set-up, which collapsing
    never touches.
- **Columns fill the board**: a board resized taller runs its columns to its bottom edge (on a board with
  swimlanes, the last open swimlane takes the spare height); a board shorter than its cards scrolls.
- **Cards** in rank order (or as the board's [Sort Cards](#the-board-set-up) orders them), at the board's **card size**. A card is a rounded tile with a hairline border and a soft
  shadow that lifts a little under the pointer (still under reduced motion, it does not move). Every card carries
  the item type's colour as the fill behind its **number** (white or near-black text, whichever reads better on it); a
  Minimal card, which shows no number, has a small dot of it before the title. A card being dragged or opened by
  someone else carries their colour ring and name. Of the fields the set-up shows:
  - **Minimal**: the title (two lines at most) and nothing else, but a session vote's stepper during a vote.
  - **Detailed** (the default): a header of the **type chip** (its glyph and name on a tint of its colour), the
    number on its type's colour, the item's own colour dot (when it has one) and, at the end, the **priority** as signal bars with its name (Low one bar, Medium two, High three,
    Urgent three in its red); the title (three lines); the project it sits under; two lines of its description;
    custom fields shown on cards, as name and value; up to four **label chips** (each in its label's colour, the
    same as in the card panel, "+2" for the rest); then a footer of **pills**: the start date ("From 1 Oct"), the
    due date, the estimate, checklist progress ("2/5", green when complete), comments and votes, with the
    assignee's avatar at the end.
  - **Due date pill**: "Due 10 Oct" (as the start pill reads "From 8 Oct"), red once past (unless the card is done), amber when due within two days, otherwise quiet.
  - **Age pill** (when the type's Display places Age, [Card display](item-types.md#card-display)): how long the card has
    sat in its column, "4d", quiet under a week, amber from 7 days, red from 14; never on a card in a done column.
  - The fields are Number, Type, Assignee, Priority, Labels, Estimate, Start Date, Due Date, Votes, Checklist,
    Description and Project. A start date reads "From 1 Oct", muted.
- **Swimlanes**: a labelled row per group (an assignee's avatar and name, a type's glyph, a project's
  [Colour](items.md#colour) dot before its name), "No assignee" last.
  Each swimlane collapses on its own, per person, remembered per board on this browser with its collapsed columns.

### Swimlanes by a field

A board can group its rows by one field of its cards (`swimlaneBy: 'field'` with `swimlaneField`, the field's
id), so a field added to a type (a Project's **Customer**) can set the rows straight away.

- **Which fields**: every custom field of a kind that groups (Choice, Checkbox, Number, Date, Text, Card, Person,
  Labels) on any type in
  the project's catalogue, the built-in **Labels**, **Estimate**, **Start Date** and **Due Date**, and the four
  read-only stamps every type offers, **Created At**, **Created By**, **Last Edited At** and **Last Edited By**
  ([Items](items.md#created-and-last-edited)): a date row per local day the card was made or last edited, a person
  row per maker or editor, drawn as a Person field's rows. Long
  text and Link never group (each value is its own row), nor do Description, Checklist, Votes and Title.
  Assignee, Type, Priority and Status keep their own tiles. A **Card** field (Parent among them) gives a row per
  linked card, named by its title with the linked card's colour dot when it has a Colour, in the linked cards' number
  order ("Missing card" for a link whose card is gone), then
  **No {Field}**; a drop into a row sets the link (item-types.md "Card fields").
  A Person or Card field that [holds several](item-types.md#holds-several) puts a card in **each** of its values'
  rows.
- **Its name** is the field's label on the first type in the catalogue that offers it (a custom field id is
  unique within a type; two types sharing an id read as one field).
- **Rows and their order**, each named by its value, then a **No _field_** row last (where every card without a
  value sits, and where a card can be dropped to clear it):
  - **Choice**: the options in their order, each a row even with no cards (so a card can be dropped into it); a
    stored value that is no longer an option comes after them, A to Z.
  - **Checkbox**: **Yes**, then **No**, both always shown. An unticked or unset box is No, so there is no
    **No _field_** row.
  - **Number** (and Estimate): lowest first. **Date** (and Start, Due): earliest first, written as stored
    (`2026-10-06`).
  - **Text**: A to Z, ignoring case; surrounding spaces are not part of the value, and a blank value has none.
  - **Labels** (and a Labels field): a card sits in the row of its **first** label; rows A to Z.
  - **Person**: a row per person, named and drawn as the Assignee's rows are (a disc and the name), most cards
    first, then **No _field_**; a drop into a person's row sets the field to them.
  - **A field that holds several** (Person or Card, item-types.md "Holds Several"): a card sits in the row of
    **each** value it holds, and in **No _field_** only when it holds none. Dragging it from one value's row into
    another's swaps the value it left for the row's (keeping its others; if it already holds the row's value, the
    one it left just goes); into **No _field_** clears the field; from **No _field_** into a row sets a list of
    that one value.
- **Dropping a card into a row** sets the field to that row's value, as Sam's row assigns to Sam: a Choice to the
  option, a box ticked (Yes) or cleared (No), a number, a date, the text. Into a **Labels** row it puts that label
  first, adding it if the card did not have it (its other labels are kept). Into **No _field_** it clears the
  field (all of a card's labels, for Labels). A card whose type does not offer the field still takes the value,
  stored but unshown, as for any row. A row of one of the four stamps sets nothing: nobody can change who made a card or when, so a card
  dropped into another of its rows moves between columns only and stays in its own row, and its board offers no
  empty **No _field_** row to drop into.
- **Keyboard**: Shift+Arrows move a card within its row, as on every board with rows; changing row is a drag.
- **When the field goes**: a board laned by a field no type offers any more (removed from its type, the type
  deleted, or a kind that no longer groups) shows no rows, as if it had none, and keeps the setting, so the rows
  come back if the field does. It never fails to draw.
- **Exports** draw a board's cards column by column, rows or not, so nothing changes there.
- **Unplaced**: when items have a status no column shows, the header says "3 not on this board"; opening
  it lists them, each with "Move to" a column.
- **Empty**: a board with no items shows, in its first column, "Add your first item" with the add field open
  for anyone who can edit.
- **Too many**: a column scrolls inside itself past the board's height; the board never grows on its own.

## All Cards

- An **All Cards** board (the Boards category's All Cards tile) shows every card in the project that is not
  archived, whatever its status, in its one column, a **swimlane per status**. A status row is named by the
  column that has it on a board of the project (the open tab's boards first, then each other tab's, in board
  and column order), else by the status itself; every status
  a board names has a row, empty or not. Cards with no status sit under "No status".
- With no cards and no statuses yet it shows a single "No status" row, never a nameless one; with every row shut,
  the spare height goes to an empty row after them.
- Dragging a card to another row gives it that row's status; Add Card in a row adds a card with that status.
- A card never moves into a status its type leaves out ([Item types](item-types.md#an-item-type)): on any board a
  column with such a status shows the red refused zone while the card is dragged over it ("Task cards can't be
  Done"), and a drop or a Shift+Arrow move there is refused. A new card (Add Card, a palette card) is still made in
  any column.
- It is the place to find cards no board shows (orphans) and give them a status a board has.

## Working on a board

Input follows the person's editor mode (the [Editor modes](../007-editor/editor-modes.md) rule):

- **In Plan mode** the board is for working on items. Pressing a card picks the card up; pressing the board's
  header or border picks up the board.
- **In Diagram and Draw modes** the board is an element like any other: pressing anywhere on it selects and moves
  the board. Double-clicking a card still opens its item.
- **Cursors** (in Plan mode): a hand shows only where a press picks something up. A card shows the open hand to
  someone who may move it (an Editor or a Participant) and the pointing finger to a Viewer, whose press opens it; the
  board's body between the cards shows the arrow, for everyone, since a press there neither pans the canvas nor
  moves the board (it used to inherit the canvas's hand, so a Viewer saw a hand everywhere and could move nothing).

In Plan mode:

- **Drag a card** to another column, swimlane or place in a column. A placeholder opens where it will land; the
  move is one item write when it is dropped. Dropping on a swimlane also sets that swimlane's field (moving a
  card into Sam's row assigns it to Sam).
  - **A steady drag**: the placeholder is always the card's own height, and it stays where it is while the pointer
    crosses ground that is no cell (the gutter between two columns, a column's head, a swimlane's heading, the
    board's own header), moving only once the pointer is over another cell. So carrying a card into the next
    column never closes the gap and opens it again on the way, and the column it leaves does not shrink and grow
    back. Letting go there drops the card where the placeholder shows. Within a cell, the gap closing in one place
    and the gap opening in the next run together (the same length and easing), so the cards beyond both stay still
    and the cell keeps its height.
  - **No gap where the card already is**: dropping a card where it already is changes nothing, so no placeholder
    opens there. Over its own cell, at its own place (just before the card after it, or at the cell's end when it
    is the last), no gap shows; so a card alone in its column shows no drop zone anywhere in that cell, and the
    cell's + Add card row stays as it is. On a sorted board, where the sort decides a card's place, its own cell shows
    no drop zone at all. Letting go there does nothing: no write, no undo step, no announcement. A group carried
    together is not held to this (its cards may come from several places).
  - **Add card steps aside**: while a placeholder shows in a cell (a card dragged there, a card from another board,
    a new card dragged from the Cards panel), the cell's **+ Add card** row fades and folds away, giving
    its room to the placeholder, and comes back the same way once the placeholder leaves: one smooth motion of its
    room opening as it fades up, on the placeholder's own 180 ms and easing, so the placeholder closing and the row
    returning move together, and the row is clipped to its opening room (never drawn whole before its room is there). It folds by its row
    closing (not by being removed), so nothing above it moves, and it cannot be pressed while folded. With reduced
    motion it just goes and comes back.
- **Drag a card onto another board** to move its item into that board's column (and row, setting the row's
  field) where it lands, with the same placeholder. The item now has that column's status, so a board without
  that column lists it under "Not on this board".
- **Drag a card off the board** onto the canvas to leave a Plan card there; the item stays on the board too.
  **Drag a Plan card onto a board** to move its item to the end of the column it lands on; the Plan card goes
  away.
- **Add a card**: each cell ends in a quiet **+ Add card** ("Add your first card" on an empty board). It opens
  the **Add a Card** menu (the shared anchored menu with an option list under a small "Add a Card" heading; a bottom
  sheet titled "Add a Card" on a phone), in the board's own colours (the tab's theme: its column colour, border and
  text, as the cells it opens from): a row per card type the board shows, each drawn as the header's chips draw
  it (a small card in its colour with its glyph, [Card type chips](#card-type-chips)), its name, and under it "N
  fields" (and "N custom"), spoken by its name alone; choosing one adds a card of it ("New task"...) at the end of the cell, in the cell's row
  (taking the row's field). Arrow keys move between the rows as in every menu; Escape, a press anywhere
  else (the canvas included, mouse, pen or touch) or a wheel or trackpad pan outside it closes it. There is no typed title: the new card opens at once in its panel with its title selected, so
  typing names it (see **Open an item**).
- <a id="card-type-chips"></a>**Card type chips**: the board's header holds, right after its title, a **chip per
  card type the board takes** (its Add card types, in the project's order), so a card is one press or one drag away
  from the top of the page. Each chip is a small card drawn in its type's colour (a stripe of it down its left edge,
  the type's glyph on the card), then the type's name; while the header holds the top row (maximised or filling its
  tab), the board's name rides in the menu box and the chips lead the header straight after it, so they sit to
  the right of the name and give way to the widgets and controls rather than widening the box. With more than
  three types the chips drop their names and keep the little cards (the tooltip names each); when they do not fit,
  the row scrolls sideways, as the widget zone does. Each chip has a hover card, **Add a Task** (its type's name)
  over "Click to add one, or drag it onto the board.", and its accessible name is "Add a Task".
  - **A click** (or Enter or Space on a focused chip) adds a card of the type at the end of the column of the type's
    starting status (its Default State, as New {Type} uses) when the board has one, else the board's first column,
    in the first row (taking that row's field), and opens it in its panel to be named, exactly as Add card does.
  - **A drag** carries a card of the type: a small card in its colour and glyph, reading its new-card title ("New
    task"), follows the pointer, and over a board the cell under it opens the same placeholder a dragged card does
    (the column, the row and the place among its cards); a column whose status the type leaves out shows it red
    with the reason. Letting go there adds the card in that place, sets the row's field, and opens it to be named
    ("Task added to To Do" is announced). Let go anywhere else, over a refused cell (the reason is announced), or
    pressing Escape adds nothing. Any board on screen takes the drop, not only the chip's own, while it shows the type.
  - **Who sees them**: anyone who may add cards, an Editor or a Participant (the share roles' card rule, as Add card
    and Duplicate are), in Plan mode. A Viewer sees none. **Not on a phone** (below 640 px, where the header has no
    room), not on an Archive board (it takes no new cards), not on a board in a Dashboard slot (simplified), not on
    a board not set up yet (no columns), and not on a board that takes no card types.
  - The chips are buttons inside the header: a press on one never picks the board up, and a double-click on one
    never renames it. Their cursor is the pointer.
  - Telemetry: `Plan` · `Added` · the type, as any new card.
- **No Add Card Type in Add a Card**: the menu only adds cards. A new type is made from the Card Types panel, or from
  Supported Cards (above) for one with this board's statuses, added to the board once saved. (The menu used to end in
  Add New Card Type; it was taken out to keep the menu to its one job.)
- **Right-click a card** for its menu (icon-left rows in sentence case, **Trash** last and styled as the rest, as the item panel's ⋯ menu): **Open**, **Duplicate** (a copy right after it, without its votes),
  **Archive** (or **Restore**; [Items](items.md#archive)),
  **Edit Card Type** (the card's type in the type editor),
  **Move to** another column of the board, **Select** (starts [selecting several cards](#several-cards-at-once) with this one), and **Trash** (to the [Trash](items.md#trash), restorable there). Someone who may only view gets
  Open alone; a Participant gets Open, Duplicate, Move to, Select and Flag (or Remove Flag), as the item panel's ⋯ menu gives it; a face-down card has no menu. It is the shared context menu, so it opens at the pointer, stays
  inside the window as it grows and is a bottom sheet on a phone, as the element menu is.
- **Open an item**: clicking a card opens the **item panel**, a wide modal over the canvas. Every field of the
  item's type is edited in place and saved as it changes, except votes, which live on the card face only. It
  closes with Escape or the close button, and follows the item if someone else moves it. **Enter** in the title
  saves it and closes the panel (a refused save leaves it open, the title put back, with the reason). On a desktop, opening
  it puts the caret at the end of its **title**; on a phone focus rests on the panel itself, so no keyboard rises.
  The type picker never takes the first focus. Tab moves on through the controls.
  - **A card just made opens at once**: one this person adds with **Add Card**, places from the palette into a
    column, or makes with **New {Type}** in a card's Linked as sections opens in its panel, its
    title ("New task") selected on a desktop so typing replaces it. A card made by someone else, brought back by
    undo or redo, duplicated, or made by a template or an agent is not opened. The card stays where it was
    placed.
  - **Look**: a thin band of the card type's colour across the panel's top edge (lifted on the dark chrome as
    the type stripes are), then a slim header with no rule under it, then the title, large (22 px, semibold),
    a click away from editing. A long title wraps, up to **three lines**, then scrolls within them; a short one takes one
    line, so no room is kept for lines it does not need. It stays one line of text: Enter saves it (and closes the card),
    and a line break pasted in becomes a space. The main column's sections (Description, Checklist, Linked as Parent, Comments...)
    sit under 13 px semibold headings with generous space between them. An empty description is one quiet
    line, "Add a description…" with a pencil, not a dashed box; pressed, the editor eases in (it fades up and its writing
    area grows from that one line to its full height over about 200 ms; at once with reduced motion). A key typed
    while the prompt (or a description's Edit) has focus opens it the same way with that key already in, the caret
    after it, saved like any typing: nothing typed to open it is lost. **Details** is a soft rounded panel inset in the
    modal (a light tint and a hairline ring), headed in small capitals; each row is a muted 12 px label beside
    its control, at least 36 px tall, with no hover highlight (the control shows its own). **Status** reads as a pill: a dot in its stage's colour (Not Started, In Progress, Done) before its name, in medium weight. **Linked as …** sections are headed like the other sections (13 px semibold, a count beside), and an empty one is a quiet line, not a box. Who made the card and who last edited it close it as a quiet **footer** pinned to the
    bottom of the Details panel (however few its rows), under a hairline: two tidy rows, each the person's disc (20 px),
    "Edited by **Alex**" or "Created by **Sam**", and, at the row's end, when ("2h ago", "3 Oct"; the exact date and time
    in a tooltip) ([Created and Last Edited](items.md#created-and-last-edited)); a form's response reads "Form
    response **#12**" with its date. Edited by comes first and Created by last, at the very bottom (a form's response
    just above it). Each row is left out when the card holds no one for it. They are never fields
    in the middle of the panel: a card type does not place them in its tabs or Details (they are card-face fields
    only), so the footer is the panel's one place for them. On a phone the layout is one column, the footer ending
    the Details tab.
  - **Tabs**: the type's own tabs, then **Activity**, on every card type ([History](items.md#history) "Where it shows").
    On a phone, the panel's side column becomes a tab too, **Details** (the type's Details name), and it is the
    **last** tab, at the far right after Activity. A card always opens on the type's **first** tab (Overview), on a
    phone as on a desktop. The tab bar scrolls sideways when its tabs do not fit; arrow keys move between the tabs.
  - **Maximised**: on a desktop the header holds a **Maximise Card** button (the maximise glyph a board's own
    Maximise uses) just left of the close button, after the ⋯ menu. Pressed, the panel grows to fill the window
    less a 1 rem margin on every side (corners kept rounded, the dimmed editor showing as a thin frame, so it
    still reads as the card over the plan: Escape, the close button and a press on that frame close it as
    before), and the button becomes **Minimise Card** (the minimise glyph, pressed), which puts it back to its
    usual size. The change between the two sizes is animated (`short`, 200 ms, eased): the panel is laid out once at
    its new size and the browser morphs its old picture into the new one, cross-fading them without stretching (a
    React View Transition typed `item-panel-resize` on the shared Dialog's panel: only the compositor works each
    frame, nothing is laid out again mid-way), wherever the panel opens (a board, a sheet row, a dashboard, the card
    finder). With reduced motion, or a browser without View Transitions, it changes at once. Maximised, the room is used
    rather than stretched: the main column keeps a reading width (at most 52 rem, centred in the space beside
    Details, with wider side padding), the title grows to 26 px, and **Details** widens to 24 rem (28 rem on
    a window 1536 px or wider) with an 8 rem label column, so its controls are roomier; the tabs, fields and
    their order are unchanged. The choice is the person's own, kept with their [preferences](../007-editor/user-preferences.md)
    (`cardPanelMaximised`) and so following them to every device: every card they open afterwards, in any plan,
    opens the same way until they press it again. Every role has it (a Viewer reads a card maximised too), since
    it changes nothing in the plan. A phone (below 640 px wide, or a phone held sideways) has no such button and
    always opens the card as its sheet, whatever the preference says, as that layout already fills it. Pressing
    it is tracked as `UI · Toggled · CardMaximisedOn` or `CardMaximisedOff`, before the preference is saved.
  - **Header**: the type (a picker, with its glyph), the key, a **⋯** menu of **Duplicate** (a copy right after
    it, without its votes, as the card menu's), **Flag** (or **Remove Flag**), **Archive** (or **Restore**) and **Edit Card Type** (closing the panel and opening the card's type in the type
    editor), then, after a separator, **Copy Card Link** (the card's address, below) and **Help** (opening the Cards article), then, after another, **Trash** (to the Trash) at the bottom of the list, as icon-left rows, then **Maximise Card** on a desktop (above), then the close button. Someone who
    may only view gets a ⋯ of Copy Card Link and Help.
  - **Its address**: while a card is open, the page's address names it beside the tab pin, as
    `#t=<tab>&item=<card id>` (the same fragment an Inbox row opens a card with,
    [Inbox](../013-workspace/inbox.md) §1), and closing it takes the card back off. Opening that address opens the
    plan on that tab with the card's panel open, as the person's role draws it (a Viewer reads it, a Participant
    edits what a Participant may). A card that no longer exists, or that the link's share does not show, opens
    nothing and says nothing: the plan opens on the tab, and the address drops the card. A tab that is gone, or out
    of the share's scope, gives way to the plan's first tab, and the card still opens.
    - **Back closes the card.** Opening a card from the plan (a board, a sheet row, the Cards finder, a search
      result, a new card) adds one history entry, so the browser's Back closes the card and leaves the person on
      the plan, and Forward opens it again. Closing the card any other way (Close, Escape, Enter in the title,
      Trash) steps back off that entry, so Back afterwards leaves the plan as it did before. Moving from card to
      card inside the panel (the breadcrumb, a Parent's Open, a Linked as row) replaces the address and adds no
      entry. A card opened by its address, an Inbox row or an Actions board link replaces the address too: that
      entry is already the card's.
    - **Copy Card Link** in the ⋯ menu copies the card's address, for every role: `/project/<plan id>` with the share
      code it was opened with (`?s=<code>`, so someone on the same share link can follow it), then
      `#t=<tab>&item=<card id>`. The menu closes and a toast says "Link copied"; a copy the browser refuses
      says "Couldn't copy the link". A copied link only opens for someone who may already see the plan.
    - Only the editor's own address carries the card: an embed and the liveworkspace workbench frame keep their
      addresses as they are (as the tab pin does).
  - **Parent** is a Card field (item-types.md "Card fields"): its control's open arrow opens the parent, and a
    Project lists the cards under it in its **Linked as Parent** section, as any Card field's linked card does.
  - **Breadcrumb**: the panel remembers the cards opened from inside it (a Parent's Open, a child row, a crumb).
    Once it holds more than one, a row of its own above the header holds the breadcrumb: the shared
    [back bar](../004-interface-design/back-bar.md), naming the card opened before this one (**#1 Website relaunch**)
    with this card's number as its chip (**#2**). It opens that card and drops this one from the trail, so a longer
    trail is walked back one card at a time; opening a card already in the trail goes back to it rather than
    repeating it. Opening a card any other way (from a board, the Cards finder, a link) starts a new trail. It holds
    at most 8 cards, dropping the oldest; a card trashed or deleted meanwhile leaves it. The row is the same on a
    phone and a wide screen, so the type picker keeps its room.
  - **The header reads part by part**, each looking like what it does:
    - the **breadcrumb** above it is the back bar: the earlier card's number and title, cut to fit.
    - the **current card** ends the trail and is not a link: its **Card Type** picker, a bordered pill with the
      type's glyph and a chevron, then its number as a quiet monospace **#12** tag; pressing the tag copies "#12"
      and its tooltip says **Copied**.
    - <a id="card-type-choices"></a>**The types it offers** are the ones the card's boards take: the card types of
      every board that names the card's status as a column (their union; a board taking every type, or no board
      naming the status, a card in the Trash or with no status, offers the whole catalogue), always with the card's
      own type. So a card never switches to a type that would drop it off the board it sits on. A type the
      catalogue no longer has is never offered, save the card's own.
    - **One type to offer is no choice**: when that list holds only the card's own type (a plan with one card
      type, or a board taking only it), the pill gives way to a **plain label**, the type's glyph in its colour and
      its name, with no border, chevron or picker, exactly as someone who may not edit sees it. Two or more bring
      the picker back. The count is worked out live from the catalogue and the boards, so a type added, a board
      taking another, or a type deleted turns the label into the picker (or back) in place, for everyone, without
      reopening the card.
    - **Share roles**: an Editor and a Participant change a card's type from the picker (editing a card); a Viewer
      always sees the plain label.
    - after a gap, the **⋯** menu and **Close**, each named by a tooltip.
  - **Moving between cards** keeps the panel open: it changes card in place, without opening again, and each card
    starts on its own first tab.
  - **Labels** are coloured chips in one field (each label keeps its colour everywhere: a 12% tint of it, inked with
    70% of it mixed toward the page's ink, dark in light mode and white in dark, which reads at 4.5:1 for every swatch); Backspace in an
    empty field takes the last one off. Focusing the field opens **the label menu** under it, so the plan's labels
    are reused rather than retyped a little differently:
    - **Before typing**, it shows the plan's labels the card does not have as the same coloured chips, most used
      first (then A to Z), each with a small badge of how many cards on the plan carry it, under a quiet
      **Labels on this plan** heading. A plan with none says "No labels yet. Type one to add it."
    - **As you type**, it narrows to the labels containing the text (case aside), those starting with it first, the
      matching letters in bold, and ends with a dashed **+ Create "text"** chip when no label is spelled that way.
      The first label starting with the text is highlighted, else Create; ↑ and ↓ move the highlight (wrapping),
      Enter adds the highlighted one, and a click or tap adds any. A comma adds what is typed as it is.
    - Text that matches a plan label but for case ("bug" for "Bug") takes the plan's spelling, however it is added.
    - Escape, Tab or a press outside closes the menu (Escape never closes the card); adding a label keeps it open
      for the next.
    - A label lives only while a card carries it: removing its last use forgets it, so it is no longer offered.
      Counts are of the plan's cards outside the Trash; archived cards count.
  - **Checklist**: a progress bar and "2 of 5" over its steps; each step's text is edited in place, ticked with
    a rounded box, and taken off with ×; **Add a step** keeps its place for the next.
  - **Main column**: the title, large, then the type's tabs (see [Item types](item-types.md)) and the fields
    of the chosen tab. The **Description** is rich text: bold, italic, underline, strikethrough, size, colour,
    headings and links, and **bullet** and **numbered lists** from their own toolbar buttons, from a toolbar over
    it or the usual shortcuts. Enter on a list item starts the next one; Enter on an empty item ends the list.
    It reads as text until clicked (hovering shows **Edit**); an empty one is a quiet **Add a description…** line (a pencil before it), not a box. Editing, it sits on a raised surface with the shortcuts beneath and **Saving…** then **Saved**;
    focus leaving it, or Escape, returns it to reading.
    Every **Long Text** custom field is the same rich text, edited the same way, its empty line reading **Add
    _field name_…**; beneath it, as it nears its 2,000 characters, how many are left (from 90%), and past them
    "_n_ characters over" in amber, when it does not save until shortened.
  - **Details panel** on the right: the fields in no tab, as label and value rows (Status first, as a coloured
    picker), then **Created by** and **Last edited by** (each with when), each with the person's disc (initials on
    their colour) beside their name.
  - **On a phone** it is a sheet of one column, as tall as a sheet goes (85% of the screen): the title, then a tab bar whose first tab is
    **Details** (the side panel's fields), then the type's tabs.
- **Vote**: during the tab's session vote each card the board shows has the vote's stepper in its corner; the
  votes a card has gathered (from ended votes) show as its ▲ count where its type's Display places Votes.
- **Reveal**: on a board hiding writing, anyone who may edit can press **Reveal**; every card turns face up for
  everyone, and the set-up's Hide writing turns off.
- **Set-up**: a column's cog, and the board's element menu (above, "The board set-up").
- **Together**: several people can set up one board at once. Each change travels as only what changed (a
  column's new name, a moved column, a widget added), so two people editing different columns or settings
  both keep their edits and everyone sees the same board ([Collaboration race
  hardening](../012-collaboration/collab-race-hardening.md#phase-6-shipped-a-plan-boards-set-up-travels-as-deltas)).

### Cards move visibly

- When a board's cards change place, by this person's move or reorder or a collaborator's change arriving, every
  card that moved glides from where it was to where it now sits (260 ms, easing out) instead of jumping, so
  everyone sees where a card went. A card that appears or goes does not glide; the card being dragged does not
  (it is under the pointer); a change moving more than 40 cards at once (a filter, a swimlane change) snaps.
- Positions are read within the board (layout units), so panning or zooming the canvas never reads as a move.
  Reduced motion snaps. The measuring runs only when the board's arrangement of cards changes.

### Drag a column

<a id="drag-a-column"></a>An Editor reorders a board's columns by dragging a column's head left or right, as cards are
dragged, on a desktop (a mouse, pen or trackpad).

- **What moves**: the order of **this board's** columns, its set-up, nothing else. A column is a status shown on
  this board, so the statuses themselves, their cards and every other board's columns stay as they are (as
  Move Left and Move Right in a column's settings, which this is the drag of). No column is fixed: a
  [done column](#done-columns) may go anywhere, and a board that ends with its done columns keeps them there only
  while nobody moves them.
- **Where it starts**: pressing a column's head (its colour bar, count or name, anywhere but its buttons) and moving
  4 px (`COLUMN_DRAG_START_PX`) picks the column up; a press that moves less is still a press, so the head's
  buttons (Collapse Column, the cog) and a phone's tap keep working exactly as before. On hover the head shows the
  open hand (`grab`); while carried, the closed hand (`grabbing`) shows wherever the pointer goes. A collapsed
  column's strip is not picked up (a press on it expands it), but it moves aside like any column.
- **While carried**: the whole column, its head and every swimlane's cell, lifts (a soft shadow, raised 2 px and
  2% wider) and follows the pointer sideways only. The other columns slide aside to open the gap where it will land,
  each over the column move's 240 ms and easing (`COLUMN_MOVE_MS`), so the gap opens smoothly as the pointer
  crosses each neighbour's middle. Near the board's left or right edge the columns scroll sideways, as they do for a
  card. Nothing else on the board changes or re-renders while it is carried: the column's position is written
  straight to it at most once a frame.
- **Letting go** over the board puts the column where the gap is: one change to the board's set-up, so one undo
  step, sent live to everyone on the plan, the column settling from where it was let go into its place (the column
  move's glide, its shadow fading). Letting go where it started changes nothing (no write, no undo step).
  It is announced: "Moved In Progress to position 3 of 5".
- **Cancelling**: **Escape**, letting go outside the board, or the pointer being lost (a cancelled pointer, the
  window losing focus) puts every column back where it was, gliding, with no write. Escape while a column is
  carried does nothing else (it does not also close a popover or leave a maximised board).
- **The keyboard**: an Editor's column head is focusable (a tab stop, after the board's cards, named "{Name}
  column, position 2 of 5"); with it focused (or one of its buttons), **Alt+Shift+Left** and **Alt+Shift+Right**
  move the column one place, as Move Left and Move Right do, the move gliding, focus staying on the head and the move
  announced as a drag's is. At the first or last place the move is refused and said so ("In Progress is already the
  first column"). Move Left and Move Right in the column's settings name the keys in their tooltips and announce
  the same way.
- **Everywhere a board is worked**: on a board with swimlanes the column moves across every swimlane; collapsed
  columns slide aside like the rest; a sorted board's columns move as any board's (sorting orders cards, never
  columns); with a header band, and under every theme and finish: a multi-colour theme's column colours go by place
  ([Columns in the theme's colours](#column-colours)), so a column takes the colour of the place it lands in unless
  it has one of its own, while under Marker each column keeps its own hand-drawn ink, which is seeded by the column,
  not its place. A board maximised or filling its tab works the same.
- **Not here**: a phone, or any press by a finger (touch screens keep today's behaviour: a tap on a head frames the
  column), where columns are reordered in a column's settings (Move Left and Move Right) or Setup Board's Columns
  step; and a Dashboard slot's compact board, on which nothing sets the board up (it is reordered on its tab, or
  maximised from the slot).
- **Share roles**: an **Editor** drags and moves columns. A **Participant** and a **Viewer** may not change the
  board's set-up: their column heads show no hand, are not tab stops, never pick up and take no Alt+Shift+Arrows;
  the server refuses a Participant's set-up change in any case.
- **Telemetry**: `Plan / Changed / ColumnReordered`, as Move Left and Move Right.

### Keyboard

With focus on a card: arrow keys move focus between cards; Enter opens the item; **Shift+Left/Right** moves the
card to the previous or next column; **Shift+Up/Down** moves it within the column (on a sorted board it moves nothing
and says why); Delete moves it to the
Trash, focus going on to the next card in its cell (else the one before; a cell left empty hands it to the nearest card on the board, the next in reading order, else the one before); **N** opens the Add a Card menu for the card's cell; the context-menu key opens the card's menu. Every move is announced ("#12 moved to In Progress,
position 2 of 4").

**Shift+Space** adds the focused card to the selection or takes it out ([Several cards at once](#several-cards-at-once)).
While the focused card is one of two or more selected, **Shift+Left/Right** moves every selected card a column
left or right (each from its own column; a card already at the board's edge stays), as one write, and **Delete**
moves them all to the Trash (an Editor's); **Shift+Up/Down** still reorders the focused card alone. **Escape**
clears the selection.

### Several cards at once

Triage and sprint planning change many cards at once, so a board lets a person **select** several of its cards and
change them together.

- **Who**: an Editor or a Participant, in Plan mode, on a board on the canvas, maximised or filling its tab (not a
  board in a Dashboard slot, which is simplified). A Viewer never selects: a modifier click opens the card as a click
  does, and no selection bar shows. A face-down card is never selected.
- **Selecting**:
  - **Cmd-click** (Ctrl-click off a Mac) adds a card to the selection or takes it out.
  - **Shift-click** selects the range from the last card picked to this one, within one column (its swimlanes'
    cells read top to bottom); a card in another column than the last one picked is added alone and becomes the
    start of the next range.
  - **Shift+Space** on a focused card adds it or takes it out (see [Keyboard](#keyboard)). Shift+Arrows keep moving
    a card, as before.
  - **Select** in a card's menu (a right-click, or a long press on a phone) starts **select mode** with that card
    picked: while it lasts, a click or tap on a card adds it or takes it out rather than opening it. Select mode ends
    when the selection is cleared.
  - **Clearing**: Escape, the bar's **Clear Selection**, or a plain click on a card that is not selected (which opens
    it, as ever) clears the selection. A plain click on one of two or more selected cards opens it and keeps the
    selection, since a press there is how the group is picked up. A selected card that leaves the board (moved off it, trashed, filtered out, deleted by someone
    else) leaves the selection; a selection left with no card ends.
- **How a selected card looks**: the brand ring (2 px, the board's focus colour) round the card, on every card size,
  and its accessible name ends ", selected". Each change of selection is announced ("3 cards selected").
- **The selection bar**: while one or more cards are selected, a strip sits under the board's header (where the
  Example cards notice sits: the board's column colour, outlined in its focus colour) that names the count, **3 cards
  selected**, then its actions, each a button with a tooltip, then **Clear Selection** (a cross) at its end. Each action changes every selected card as **one write
  and one undo step**, reaching collaborators as one change:
  - **Move To**: a menu of the board's columns; the cards go to the end of that column, in the order they sit on the
    board.
  - **Assign**: the people a card can be assigned to (as the Assignee picker lists them), and **Unassign**.
  - **Priority**: Urgent, High, Medium, Low and **No Priority**.
  - **Labels**: the plan's labels, each adding it to every selected card that lacks it; under **Remove**, the labels
    the selection carries, each taking it off them all.
  - **Set Field**: any custom field that every selected card's type has and a person can type a value into (Choice,
    Checkbox, Number, Currency, Percent, Rating, Date, Text and Person); picking one shows its value editor, and
    **Clear** empties it on them all.
  - **Flag** (or **Remove Flag**, when every selected card is flagged).
  - **Archive** (or **Restore**, when every selected card is archived) and **Move to Trash**: an Editor's alone.
  - A card whose type does not offer the field changed (Assign on a Note with no Assignee) is left as it is; a
    column whose status a card's type leaves out keeps that card where it is, with one announcement for all of them
    ("2 cards stayed: their types can't be Done"). When no card takes the change, nothing is written and "No
    selected card changed" is announced.
  - On a board under 560 px wide (a phone among them) the actions show as icons alone (named by their tooltips and
    accessible names); wider, each icon has its name beside it. The bar wraps to a second line when they do not fit.
- **Dragging a group**: pressing a selected card and dragging carries the whole selection. The card under the pointer
  is drawn with the others stacked behind it (up to two more) and a count badge ("3"); the selected cards fade where
  they were; the placeholder opens where they will land. Letting go lands them together, **in the order they sat on
  the board** (columns left to right, rows top to bottom, then their place), at the drop point, as one write and one
  undo step; dropping on a swimlane sets its field on each, as a single card's drop does. Onto another board they
  land the same way (each card that board does not show stays); onto the Trash they all go there (an Editor's);
  onto the canvas nothing moves ("Drop the cards on a board" is announced). A sorted board places each where its
  sort puts it. Pressing an unselected card drags it alone and clears the selection.
- **Phone**: a long press opens the card's menu, which has **Select**; in select mode taps pick cards, and the bar sits
  under the board's title.
- The selection is this person's own, on this board, and never saved or sent: a collaborator sees only the changes it
  makes. Telemetry: `Plan` · `Selected` · `Cards` when a selection starts; `Plan` · `Moved` · `Cards` for a group's
  move; `Plan` · `Changed` · `Cards` for a bar action.

## Option lists

Every option picker in Plan mode is one **option list** (`OptionRows`): a bordered, rounded box holding a row per
choice, one to a row, each row its icon at the left, then its name (Title Case), a quiet second line where it helps
(where a state is used), and at the right a marker. A one-of-a-set list (a radio group) ticks the chosen row and tints
it in the brand colour (light and dark); an on-or-off list (checkboxes) shows a box at the right, filled and ticked
when on; a list of actions (Add a Card, an existing state to add) has no marker. Hover and keyboard focus tint a row;
outside a menu one row is in the Tab order and ArrowUp / ArrowDown / Home / End move between rows, Enter or Space
picks; inside a command menu the rows are its items (`menuitemradio`, `menuitemcheckbox`, `menuitem`) and the menu's
own keys move between them. In the Setup Board and Setup Sheet dialogs it wears the app's colours (light or dark). It is used by:

- the board menu and cog: **Swimlanes** (Group Rows By), **Sort Cards** (Sort By, Then By and their directions),
  **Supported Cards** (Card Types), **Card Layout** (Card
  Size), a Gantt chart's Card Types and Swimlanes;
- **Setup Board**: Card Types, Use an Existing State, Suggested States, and the Layout step's Swimlanes and Card Display;
- **Add a Card**'s card types; a card type's **States**; the **Card Types** panel's rows (each with its own Edit and
  Duplicate, so the same box and rows without a marker); the column picker's Available States and Suggested
  Statuses;
- a column's settings: **+ Add Column After** and **Delete Status** are rows, icon left (Move Left, Move Right and
  Remove Column sit on its toolbar); the board's **Columns** section lists its columns one to a row.

Left as they are: the board preset gallery (PlanBoardPicker: large visual previews to compare), the glyph palette
(GlyphPicker: an icon grid, where a row each would be far too long) and a type's Display size switch (ItemTypeDisplay:
a two-way segmented control, not a list of options), and the palette's Plan tiles (cards and views to drag onto the
canvas, part of the palette's catalogue, not a setting).

## Focus

- A board's header (and a Sheet's, [Sheet](../029-sheets/sheet.md#header)) holds **Focus** (a scan-eye glyph, with a
  tooltip "Focus Board" / "Focus Sheet") left of Maximise (the header ends Focus, Maximise, then the cog), for anyone in Plan mode, not while it is maximised or fills
  its tab. Pressed, the view glides (about 420 ms, eased; at once under reduced motion) to fit the element with the
  fit-to-screen margin, zooming in no further than 150%. Pressed again while the view already fits it, it glides out
  to fit everything on the tab. The view is the person's own, never saved or sent. Anything else moving the view
  while it glides (a wheel, a pinch, a pan, another fit) takes over: the glide stops where it is.
- A board, visualisation or Sheet this person adds (placed from the palette, dropped, drawn to size, picked in Start
  Planning) glides into view the same way (on a phone too, in place of the scroll that reveals other new elements).
  A peer's add, an undo or a tab switch does not move the view.
- Telemetry: `Plan · Toggled · BoardFocused` / `SheetFocused`.

## Maximised board

A right-click on a maximised board's empty space, or a board filling its tab (a Sheet's likewise), opens the tab's
menu, the one the canvas opens, never the browser's; a card's own right-click keeps its card menu, and for an Editor a
right-click on a column's background opens that column's settings
([The board set-up](#the-board-set-up), "A column's own settings").

A board can be maximised to work on it without the rest of the canvas around it.

- In Plan mode, the board's header ends with **Maximise Board** (a maximise icon, with a tooltip) at its top
  right.
- Maximised, the board fills the canvas area: it is drawn over the canvas and everything on it, while the
  editor's chrome stays as the person has it (the header, the tab bar and footer, and the palette as a toolbar or
  panels, per their setting); zen mode is not switched on (a zen mode the person had on stays on). It starts clear
  of the chrome laid over the canvas, measured from that chrome as it is (never a fixed number): below the Toolbar
  layout's top row (the menu button and mode menu at the top left, the palette toolbar at the top centre), and
  beside the layout's own panels (the Explorer, the Palette as panels: a panel nearer the left edge pushes the left
  side in, one nearer the right the right side). It runs down to the canvas's foot: the bottom-right controls (undo, the dock, zoom) float over it,
  still clickable, and its last cards are reached by scrolling. The Map is hidden while a board is maximised or fills
  its tab (there is no canvas to map) and comes back when it is restored. Around the board, the whole canvas area is
  painted with the canvas's own background (its colour and pattern, an animated pattern moving there as on the canvas),
  so nothing on the canvas shows through, in any strip the board leaves beside or below the panels. A sheet
  across the canvas (a phone) pushes the top or bottom instead. It never gives up more than 45% of the canvas on an
  axis. It follows the chrome as it changes (a panel opened, closed, moved or collapsed, the window resized), and a
  panel dragged over it still floats above it. A panel opened for a moment (the Trash, the Cards panel, card search,
  Card Types, Layers, a vote or poll, the item panel) floats over the board and never moves or resizes
  it, so nothing jumps as it opens or closes. Everything on the board works as it does on the canvas: cards drag,
  open and add, and widgets filter. The header does not move the board while it is maximised.
- **The header holds the top row**: maximised (or filling its tab), a board, view or Sheet does not start below the
  Toolbar layout's top row; it starts at the top of the canvas area, and its header grows to that row's height
  (`HeaderBand`), so the menu button, the mode menu and the palette toolbar float inside the header instead of over
  a strip of canvas above it. The palette leaves the centre for the header's right end, 12 px before its controls,
  so the middle of the header is the title's and widgets'. Its controls (the view's own, Maximise or Restore, the cog)
  sit together at its right end straight on the header, with no card of their own, its buttons the palette's tile size
  (36 px); the last one stands as far in from the element's right edge as the menu's first does from its left. In the
  band the menu box and the palette (a mode's strip, or a board's cards) drop their cards too (no border, no fill, no
  shadow, no hue), so the top row reads as the board's,
  view's or sheet's own header: the menu and name at the left, the controls at the right, and a hairline under it all
  (a board's header draws one there, as a Sheet's and a view's always have). The bottom-right buttons (Undo, the Plan strip, Theme, Zoom) move inside its frame while it covers the canvas: 16
  px further in and 20 px further up than on a canvas, clear of its edge and its scrollbar (not on a Dashboard's
  page). A board's **widgets** ride with the controls at the band's right, before the cog behind a hairline, so the right
  of the top row is one run of widgets and controls. The controls and a Sheet's toolbar are the menu box's height on screen (46 px at a 100% toolbar UI scale, its
  controls and inset scaling with it, its hairline not; `--plan-band-card-h`). The header's own content keeps clear of them: its title, count and widgets
  start after the mode menu and stop short of the palette (truncating, or the widgets scrolling, as they do when
  narrow). It is laid out this way only when there is room: at least 140 px between the mode menu and the palette
  with the palette at the right (a desktop or a wide tablet). On a phone (under 640 px of canvas) it still holds the
  top row, more simply: its header grows to the menu box's height and its content starts 12 px after the box, the
  name staying in the header and the controls as they are, with at least 160 px left after the menu (else, as in a
  narrow window, the element starts below the top row as before). The menu box takes the element's surface there too. The header follows the row
  as it changes (the palette's category switching its width, the window resizing). With no palette in the row (it is
  hidden, below, or the person may not edit) the header holds the menu alone, its content running on to its controls.
  The menu box and the palette in the band wear the element's hue: a 10% mix of it into the chrome's own light or
  dark card, and a 40% mix for their border, so their ink reads as ever. The hue is the element's board or sheet
  preset's (Style presets "Boards and sheets"), else its own border colour; an element in the theme's neutral colours
  leaves the chrome as it is.
- **The name rides in the menu box**: while the header holds the top row, the element's name (a board's or view's
  title, a Sheet's title) moves out of its header into the menu box at the top left, straight after the mode menu (no hairline between them),
  in the chrome's own text colour, truncating past 16 rem. It is the same title: a double-click on it renames it in
  place, as in the header. A board's [card type chips](#card-type-chips) stay in the header, leading it just after
  the menu box. The room the band needs is measured from the menu box without the name, so the name
  coming or going never takes the band away. Without a band (a phone, a narrow window) the name stays in the header.
- **The header arrives laid out, then fans in**: a board filling its tab (a tab switch, a reload) is measured before
  it is first drawn, so its header shows in the band at once, never first as a canvas header that then jumps (the
  name, chips and widgets moving between frames). Its card type chips, left to right, and its widgets then the
  widget zone's + and Edit Widgets, left to right, fan in as the header mounts: each fades up from 6 px low at 97%
  scale over the `micro` motion token, 25 ms after the one before (the delay stopping at 100 ms, so the row lands
  within the 250 ms ceiling). It plays only as the header mounts (its tab shown, the board placed or loaded), never on
  a re-render, a filter or a count changing, or a widget or chip added or reordered later (those simply appear in
  place); under reduced motion everything is simply there.
- **It is not placed on the canvas while it fills it**: maximised or filling its tab, a board, view or Sheet's
  element menu leaves out **Layer**, **Size**, **Rotation** and its **Animation** categories (they would change
  where and how it sits on the canvas it hides), and its animation does not play; restored, it animates in its
  place again and the categories come back.
- **Zoom is a Sheet's alone**: the bottom-right zoom buttons (Zoom out, the zoom level and its menu, Zoom in, and a
  phone's Fit) show only while a Sheet covers the canvas, and zoom its cells ([Zoom](../029-sheets/sheet.md#zoom)). On
  a Board, Dashboard or Form tab there is nothing to zoom, so they are not shown; the cluster keeps Zen
  when it applies, and goes when it does not.
- **Five slots across**: maximised (or filling its tab), a column slot is a fifth of the board's body
  (`MAXIMISED_BOARD_SLOTS`), never narrower than a column's floor (220 px a slot); a column
  set wider takes its slots and the gaps between them. On a phone a column takes the board's width less 64 px whatever
  its width (one column a screen, its neighbours peeking in at both edges), and the columns snap one at a time to
  the centre as they scroll sideways, except while a card is carried (the edge scroll moves them freely then). See
  "On a phone" for how the snapping keeps scrolling down smooth. A board of five slots or fewer fills the width as on the
  canvas; one of more scrolls its columns (and their swimlanes with them) sideways under a fixed header, by
  scrollbar, trackpad or Shift and the wheel. A card dragged (mouse, pen or finger) near the left or right edge of the
  columns scrolls them sideways, faster the nearer the edge, stopping at the ends; a pointer that only hovers never
  scrolls them. Under reduced motion it still scrolls, at one gentle speed. On the canvas a board keeps its columns sharing its width.
- On a touch screen, a finger on the maximised board's empty space scrolls the board (across and down), since
  it covers the canvas there is nothing to pan; a finger on a card still picks it up.
- **Restore Board** (a minimise icon, in the same place) or **Escape** puts it back. Escape restores only when
  no dialog (the item panel, a confirm) is open over the board; Escape in a dialog closes the dialog first. One
  Escape restores even with something selected: it restores and does nothing else (it does not also deselect).
- **The palette follows what fills the screen**:
  - A board **maximised or filling its tab** ([Fill Tab](#fill-tab)): the palette gives way to the board's own
    **cards**: a card of its own at the header's right end, apart from the controls card (the cog), holding a card
    tile for each card type the board takes (none for an Archive board, or one taking no types: the card is not
    shown), placed as the Cards tiles are (dragged into a column, or picked and then a column chosen). It wears the
    board's hue in the header band as the menu box does. On a phone, where the menu shares the palette's row, the
    palette stays and opens on Plan's **Cards** alone, whatever the mode.
  - A Sheet **maximised or filling its tab**: the palette is hidden altogether (nothing it offers can land in a
    Sheet); on a phone, where the menu shares the palette's row, the menu stays.
  - A view **maximised** (the person's own view for a moment): the palette is the mode's
    as usual. Picking a tile that is not a card (pressing it, not dragging it) restores the element first, so the
    tool is ready on the canvas it is meant for; a card tile keeps it maximised (onto a board, a card is dropped).
  - The category the person had stays chosen underneath and is back the moment the element stops filling the tab.
- **Nothing under it moves**: while a board is maximised (or fills its tab), the canvas takes no input that would
  change it. A cover over the whole canvas area (the board sits in it at its insets) takes every press, double-click,
  right-click and wheel around the board, so nothing is selected, dragged, marqueed, resized, drawn, panned or
  zoomed, by any tool; a press on the board itself is the board's alone, never also a canvas gesture. A wheel over
  the board, view or Sheet itself scrolls what it is over and never pans or zooms the canvas (a Ctrl or Cmd wheel over
  a Sheet zooms its cells: [Sheet](../029-sheets/sheet.md#zoom)), so restoring it gives back the view it covered. The canvas's
  own keyboard shortcuts stand down (no arrow nudge, Delete, select-all, duplicate, lock, z-order, zoom, paste or
  tool key; the chords the browser would take over, Cmd+D and Cmd+A among them, are prevented), while undo and redo
  (Cmd+Z, Cmd+Shift+Z, Ctrl+Y), search (Cmd+K), zen (Z), Escape, the chrome (header, tab
  bar, palette, panels, the bottom-right controls) and everything on the board keep working; copy and cut are left to
  the browser, for text on the board.
- **No selection chrome over it**: while a board is maximised (or fills its tab, [Fill Tab](#fill-tab)), no selection
  toolbar, popover, multi-selection toolbar or quick-connect plus floats over the canvas, for the board or anything
  else selected, however the selection came about (a press before maximising, select-all, undo or redo, a
  collaborator, the tab opening with the board selected). The selection itself is kept, and its chrome returns on
  restore.
- **Nothing is lost either way**: maximising and restoring move the board, they never redraw it from scratch, so
  its collapsed rows, an open popover and a drag in progress carry over.
- **It animates both ways**: maximising, the board grows from its place on the canvas to fill the canvas area;
  restoring, it shrinks back into its place, and only then is it on the canvas again (250 ms, the dialogs' `long`
  token and ease-out). Growing, its content fades in over the grow's last moments, so the whole maximise settles
  within those 250 ms. Under reduced motion it switches at once. Restoring before it has finished growing goes
  straight to shrinking back: the board is on the canvas again from that moment and never returns to the overlay.
  Maximising it again while it shrinks back keeps it maximised, and it grows afresh. A view (plan-views.md "Maximised view") animates the same way.
- **Its place is where it is drawn**, measured at the moment it grows or shrinks: on the canvas its element, in a
  Dashboard slot the slot itself (its element sits out of sight under the page: plan-tabs.md "Slot content"), so a
  board, Sheet or view maximised from a slot grows out of the slot and shrinks back into it, even if the page scrolled
  or the row was resized meanwhile.
- It is a view for the person alone, like zen mode: the board element keeps its size and place, nothing is
  saved or sent to anyone else, and nothing enters undo. Collaborators see the board as it is on the canvas.
- It ends on its own when the board leaves the screen: switching tab, the board being deleted (by anyone), or
  leaving Plan mode. A zen mode the person had on before stays on after Restore.
- One board at a time: maximising another board (there is no way to reach one while maximised) is not offered.
- It works the same on a phone and a tablet: the board fills the canvas area, and its body scrolls.
- Telemetry: `Plan / Toggled / BoardMaximised` and `Plan / Toggled / BoardRestored`.

## Fill Tab

A board **fills its tab** when the tab is a **Board tab** ([Plan tabs](plan-tabs.md#board-tab-and-sheet-tab)): the
tab is the board, for everyone, every time it is shown, and a Sheet tab's Sheet the same way. There is **no Fill Tab
switch** anywhere (not in the board's cog, the Setup Board wizard or Sheet Settings), and so no
deletion of the rest of a tab to make room: a board on an ordinary tab stays on its canvas, maximised by one person
for a moment at most ([Maximised board](#maximised-board)).

- **An old board's stored flag** (`fillTab: true` on its set-up, from before Board tabs) is still read: such a board
  fills its tab as a Board tab's does. Nothing sets it any more, and nothing offers to turn it off; converting an old
  Plan tab makes it a Board tab ([Converting old Plan tabs](plan-tabs.md#converting-old-plan-tabs)).
- **Filled**: whenever the tab is shown (opening the project, switching to the tab, a reload, a collaborator's or
  a share link's view), the board is drawn over the canvas area as a maximised board is (its header holding the top
  row where there is room), in Plan mode. The editor's header, tab bar, footer and panels stay, so the person can
  move between tabs; the board sits clear of them. It appears at once (no grow). There is no Maximise/Restore, no
  Focus and no Add to Slides, and Escape restores nothing. Presses, wheel and right-click on it stay on the board,
  so the canvas under it is never selected, panned, zoomed or menu'd; the board's settings are its cog.
- **Never seen small first.** A new Board or Sheet tab (Start Planning) is covered from its first frame: while the
  board's or Sheet's view is still loading, the canvas area wears its own opaque backdrop in the cover's place, so the
  element is never drawn small and selected on the canvas before it fills the tab. Start Planning fetches those views
  while it is open, so the backdrop is rarely seen for more than a frame or two.
- **Two boards (or Sheets) on one Board tab** (an agent's or a collaborator's write, a paste): the first in canvas
  order (element order) fills it; the others stay under it, unseen.
- **Elements added to a Board tab** (a collaborator or their agent, a paste) are **hidden, not blocked**: kept in the
  tab under the board, unseen and unreachable. Blocking would need every add path (the api, agents, paste) to know
  the rule; hiding needs none, and nothing is silently lost.
- **A locked tab**: its edits are refused as every edit there is. **Read-only viewers and share links** see the board
  filled.
- **Slides and presenting**: a slide of the board shows the board as a slide does; presenting covers the screen with
  the slide anyway.
- **The board deleted** (by anyone, or by an undo past its creation): nothing fills the tab, and the canvas is back.

## CSV

A board's cards go out to a CSV file from a **Board tab's** Export dialog (its **CSV** format,
[Export](plan-tabs.md#export)) and come in through the [Import dialog](plan-tabs.md#the-import-dialog)'s **CSV** row
(its Into This Tab row on a Board tab), or a CSV dropped on that dialog. The files are read and written by the Sheet's CSV reader and writer
([CSV](../029-sheets/sheet.md#csv)): RFC 4180 quoting both ways, a comma (or a tab, when the first line holds one; a semicolon when it holds semicolons
and no comma).
A download is safe to open: a field a spreadsheet would run as a formula is made inert with a leading `'` (the
Sheet's rule); a phone number as typed (`+44 20 7946 0958`) is written as quoted text with no `'`, as it holds no
formula.

**The CSV export** (everyone, a Viewer included) is the cards the board shows, before any quick filter: column by
column in board order, each column's cards in their order on it. A file named for the board's title ("Roadmap.csv";
"Board.csv" untitled), one header row, then a row per card:

- **Key**, **Title**, **Type** (its label), **Status** (the column's name as the board shows it; an All Cards or
  Archive board, the state's name).
- Then each built-in field any of the board's card types offers, in this order: **Assignee** (the person's name),
  **Priority** (Urgent, High, Medium, Low), **Start**, **Due** (YYYY-MM-DD), **Estimate**, **Labels** (joined by ", "),
  **Description** (its plain text). A header is the type's own name for the field when every card type the board
  shows names it the same ([Edit Field](item-types.md#built-in-full-edit)): "Points" for an Estimate every type
  calls Points; else the name above.
- Then the custom fields of the board's card types by their label, in catalogue order (a label two types share is one
  column): a Card field (Parent among them) as the linked card's title, a checkbox as "Yes" or empty, a Date and
  Time as its UTC instant in ISO 8601 (`2026-10-31T17:00:00Z`), a Date Range as an ISO 8601 interval
  (`2026-10-31/2026-11-02`), a Phone as typed, the rest as written; a Person or Card field that holds several as its names or titles joined by ", ". A field a card's type does not offer is empty on its row.

**Import CSV** (an Editor or a Participant, who may add cards; dimmed for a Viewer, and on an Archive board) opens a
file picker (`.csv`, `.tsv`). The first row names the columns, matched case-insensitively by the names the Sheet's
card functions take ("Title", "Status" or "State", "Assignee" or "Owner", "Due Date", ...), or by any name the board's
card types give a built-in field ([Edit Field](item-types.md#built-in-full-edit): a "Points" column fills Estimate),
and then by the custom fields' labels; a column it does not know is ignored, and so is **Key** (the new cards are numbered afresh). A file
over 5 MB (the CSV reader's 10,000 rows at about 500 bytes each) is refused before it is read: "That file is too big
to import. Import CSV reads files up to 5 MB." Each row after it becomes a new card on the board:

- **Title** is required: a file without a Title column adds nothing, and a row with an empty title is skipped. A
  title past the limit is cut to it.
- **Type**: the board's card type of that label (or id); else the board's first. A board that takes no card types
  adds nothing.
- **Status**: the board's column of that name; else the type's Default State when the board has a column for it;
  else the board's first column. On an All Cards board, a state any board names. A type that leaves the status out
  takes the first column it allows; a row whose type allows none of them is skipped.
- **Assignee**: the person of that name among those who could be assigned; else left empty.
- **Priority**: one of the four by name; else empty. **Estimate**: a number from 0 to 999; else empty.
- **Start**, **Due** and a custom date field: YYYY-MM-DD, or a day-first D/M/YYYY (also with `-` or `.`, and a
  two-digit year in this century); a date that is not a real day is left empty.
- **Labels**: split at commas and semicolons, as many as a card holds. **Description**: plain text, cut to its limit.
- Custom fields of the row's type by label: a number as a number, a checkbox from Yes/True/1/X, a choice only as one
  of its options; a Date and Time from ISO 8601 (with its offset, or without one read in the importer's own zone,
  "2026-10-31 17:00" too); a Date Range from two ends joined by `/` (or " to "), each read as its field's ends are; a
  Phone as a phone number (a leading `'` from an older download dropped); a Person field by name (a field that holds several takes a comma list of names); a Card field is
  not imported.
- A field the row's type does not offer is ignored, as is a value that does not fit its field.

The rows go in as **one write and one undo step**, each card at the end of its column in file order. At most as many
as the project still has room for (its card limit) are added; the rest are skipped. The board then says what
happened: "Added 12 cards", "Added 12 cards; skipped 3 rows" (with ", 2 missing a required field" when rows lacked a
[required field](item-types.md#required-fields), or "skipped 2 rows missing a required field" when all did), or why nothing was added ("No Title column in the
file", "No cards to add"). Telemetry: `Plan` · `Imported` · `Csv` when a file is read, `Plan` · `Exported` · `Csv` on
a download.

## Deleting a board

A board's cards are the project's, so deleting a board leaves them. But when the delete takes the last board showing
some card types, an Editor is offered, optionally, to tidy those away too, as deleting a Sheet offers its cells:

- **Which types**: those the deleted boards show (the types their Card Types name, every type when they name none) that
  no other board in the project shows, on any tab, a Dashboard's included. An Archive board counts as showing every
  type (it lists any card), as does a board not yet set up; while another board shows every type, nothing is offered.
- **The question** ("Delete Its Cards Too?"): "No other board shows Task and Bug. Delete the Task and Bug card types
  too? Their 5 cards go to the Trash, where they can be restored." (one type: "Its"; no cards: "No cards use it.").
  **Delete Cards Too** trashes those cards and deletes those types, as deleting a card type does; **Keep Them** (and
  closing the question) keeps both. The board is deleted either way.
- It asks only once every tab has loaded (a board on a tab not yet loaded could still show those types); before then
  the board is deleted without asking. A cut never asks. After a Sheet's question, if the delete takes both.
- **Deleting a tab** with boards on it (a Board tab, or a canvas tab holding boards) asks the same about the types
  its boards show that no board on another tab, a Dashboard's included, shows; the tab is deleted either way, once the
  question is answered (one undo brings the tab back; the cards come back from the Trash).
- Telemetry: `Plan` · `Deleted` · `BoardWithCards` or `BoardOnly`.

## The Plan card

- Draws one item's card face at the element's size, with the item type's colour; resizes like a box.
- Has its own **Card Size** (Minimal or Detailed, the board's two; Detailed when unset, and when stored as the
  retired `compact`), set from the
  **Card** flyout of its element menu (a collapsible **Card Size** row, closed until opened, as every menu row is), one undoable element edit (`planCard.size`, Detailed stored as absent). Its
  card type's Display decides what shows at each size, as on a board. Exports and images draw its face as they do
  today, whatever its size. Telemetry: `Plan` · `Changed` · `PlanCardSize`.
- A double-click or double-tap opens the item panel, in every mode; a single click or tap only selects it, as for
  any element. Two presses at one spot within the double-press window count (`usePressWithoutDrag` with
  `requireDouble`), not the browser's `dblclick`, so a tap works as a click does. A press that travels past the press
  slop moves the card and counts for nothing.
- When its item is not in the project's store (deleted, or the tab came from another project) it draws "Item
  not found" in a dashed outline and offers to remove the card.

## A state no board names

- A card's state belongs to the columns that name it. When the last board or column naming a state goes, its
  cards read as **No status** everywhere: their board rows and lanes, the Card Search and Cards panel, a card's
  Card field values and Linked as sections, its slide, the Gantt chart's state, the plan views' counts and the card's own
  **Status** picker (which never offers a raw state id). The card keeps the state itself, so undoing the
  board's or column's removal puts every card straight back; picking a state in the card's panel settles it, and an empty board still offers the
  state (by its name) for its first column, which brings its cards back (`namedStatus`). The Trash says where a card came from only while
  that state still has a column.

## On a phone

- **Cards are Minimal** on a phone (below 640 px), whatever the board's card size, so a column shows more of them; the
  size is the board's again on a wider screen. Nothing is saved.
- **No collapsed columns** on a phone: no Collapse Column, and a column collapsed on a wider screen shows open (it is
  collapsed again there).
- **The header has no widgets and no card type chips** on a phone: the title, taking the room up to the header's controls (beside widgets
  it keeps to 40% of the header), then the controls. The quick filter the widgets set
  stands down with them, so a filter set on a wider screen never hides cards with nothing on screen saying so.
- A board that scrolls on its own (maximised, filling its tab, or in a Dashboard slot) shows one column a screen (see
  "Five slots across"); covering the canvas, its body ends 8.5 rem (and the home indicator's safe area) past its last
  cards, so they scroll up clear of the bottom controls that run across a phone's screen.
- **One column in focus**: as that board scrolls sideways its columns snap so one sits centred, its neighbours
  peeking in on either side, and a swipe or fling moves one column, never several (mandatory snapping, each column a
  stop, for a mouse or trackpad too).
  The snapping is sideways only: it never moves the board up or down, and scrolling down a column glides freely,
  never pulled back to the top. Each column's snap point is a plain marker spanning the column's full height, not its
  sticky header, so scrolling down moves no snap point and the browser has nothing to re-snap mid-scroll. (The jank
  this replaces had two causes, both fixed at the root: the snap points were the sticky headers, and every card was
  `touch-none`, so on a column that is mostly cards a finger could scroll only in the gaps between them.) The body
  keeps its scroll to itself (overscroll contained) while it covers the canvas, so reaching its end never drags the
  page under it; in a Dashboard slot only its sideways scroll is contained, so scrolling down past its end still
  scrolls the Dashboard.
- **A column changes only on a swipe meant for it**: scrolling down a column never slides to its neighbour, however
  the thumb drifts sideways. Each touch settles its direction once, after it has moved `SWIPE_AXIS_SLOP_PX`: across
  only when it went clearly more across than down (`SWIPE_AXIS_RATIO` times as far), otherwise down, and a diagonal
  counts as down. A touch that went down stays down to its end: whatever it then does sideways, the column holds. A
  touch that went across carries the columns under the finger, and on release moves **one** column when it went
  `SWIPE_COMMIT_SHARE` of a column's width, or was a flick (`SWIPE_FLICK_PX_PER_MS` with at least
  `SWIPE_FLICK_MIN_PX` of travel, the same way), and is still clearly more across than down overall; anything less
  (a thumb's arc that set off sideways and curved into a scroll down among it) glides back to the column it left. Two fingers, a
  card being carried, and a board that is not one column a screen leave the gesture alone. The board takes vertical
  touch scrolling natively (its body and cards are `touch-action: pan-y`), so only the sideways swipe is the board's
  own; a mouse, trackpad or keyboard scrolls sideways as ever, snapping to each column. Under reduced motion the
  release jumps to the column instead of gliding.
- **A finger on a card scrolls** that board as empty space does (down, and across through the swipe above); held still for
  `CARD_HOLD_TO_DRAG_MS` first, it picks the card up and carries it, the board no longer scrolling under it. A finger
  that moves before the hold is up is a scroll: the card neither moves nor opens. A tap still opens the card, and held
  still for `LONG_PRESS_MS` it opens the card's menu, whose **Select** row starts select mode
  ([Several cards at once](#several-cards-at-once)). Elsewhere (a desktop, a tablet, a board on a phone's canvas) a
  finger on a card picks it up at once, as below.
- **A tap on a column's empty space** (its background, between and below its cards, or its header outside the cog) on
  that board glides the column to the centre, as a tap on a page does in Pages; across only, never up or down.
  Cards, buttons, fields and links keep their own taps. Under reduced motion it jumps there instead of gliding.
- A finger on a board's empty space (between and below cards, column backgrounds) pans the canvas, as it does
  anywhere else, whatever the tool: it never selects or moves the board, and holding it opens no menu. Only the
  board's header moves the board, as with a mouse. A finger on a card picks the card up, and buttons and fields
  work as they do with a mouse. Held still on a card (`LONG_PRESS_MS`), a finger opens the card's menu at the
  finger, as a right-click does, for someone who may edit; lifting it then neither opens the card nor drags it.
- A tap on a column's header (not its cog) frames that column: the view glides to fit it, header to the board's
  foot, below the top strip, as a tap on a page does in Pages (`frameBoardColumn`). Not while the board is
  maximised.
- A board's header buttons (the ⋯, the settings cog, Maximise) stay on screen: when the board runs past the
  canvas's right edge (zoomed in on a phone, or panned), they slide left to stay 8 px inside it, on the board's
  surface with a shadow so they read over the header, never past the board's own left edge
  (`useKeepOnScreen`). Elsewhere (a board on a slide) they stay where they are.
- On the canvas, a board's body does not scroll under a finger (a native scroll would cancel a card's drag); a board with more
  cards than fit is made taller, or scrolled with a mouse or trackpad.

## Theme and style

- A board and a Plan card follow the tab's theme and their own style, like any shape: a theme stamps their fill,
  stroke and text colours when they are made and rewrites them on a theme switch, and Quick Style, the colour
  pickers and the style presets set them. The board's fill is its surface, its stroke its focus and, mixed 35% into the fill so the lines stay quiet
  (`PLAN_BORDER_ACCENT_SHARE`; sheets and the start panel share it), its border
  colour, its text colour its ink; columns, cards, card borders and muted text are mixed from those. Ink that
  would not read on the fill is swapped for a readable one, and muted text leans toward the ink until it reads at
  4.5:1 on the column, a card and the board alike (`readableMuted`). With no colours of their own (the Default theme)
  they take the canvas surface's neutral set, light or dark, whose muted text meets the same bar.
- Every theme reads on a board, light and dark, because the palette guards its own contrast rather than trusting
  each theme's colours:
  - **Cards stand off their list.** On a light board a card is near white on the tinted list. On a dark board a card
    sits a step deeper than the board (18% toward black), as the Default dark set does, so a card reads as a card on a
    brown, green or violet list too (it was 4% lighter than the board, 1.1:1 on its list, and the cards vanished).
    A card's edge reaches 1.3:1 on the card (`cardBorder`), leaning toward the ink until it does.
  - **The accent reads as text.** The focus colour (the board's stroke) labels buttons and notices on the column, so
    it leans toward the ink until it reads at 4.5:1 on the column, a card and the board. A pale accent (Pastel's grey)
    turns deeper; a bright one stays as chosen.
  - **Colours on a card read on that card.** A type's accent (`accentOn`: its dot, number tag and chip, and every
    widget's and view's tone) reaches 3:1 on the board's own card, leaning toward white on a dark card and toward
    black on a light one. Coloured words on a card (the type chip's name, label chips, the priority's name, a due or
    finished pill, the blocked mark) reach 4.5:1 on their chip (`chipInkOn`). A colour that already reads is kept as
    chosen.
- Corners follow Quick Style's Corners (12 px by default), and a shadow sits under the board like any shape's.
  - <a id="column-colours"></a>**Columns in the theme's colours**: on a multi-colour theme each column takes the next of
    the theme's colours, in order and cycling: its top bar in the colour, its head and cells a light tint of it (10%,
    or 5% where 10% would take the board's text below 4.5:1, or none). A colour set on the column itself wins, and its
    face tints from that. A single-colour theme keeps every column alike.
  - **Card hover**: the card under the pointer stays exactly where it is (no rise: a moving transform re-rasterised
    its words and shifted them by a pixel as it eased) and gains a soft shadow lightly tinted with its type's colour, its
    edge leans 25% toward that colour, and a faint light in the colour (8%, fading out over 220 px) follows the pointer
    across its face. It eases in over about 250 ms. Under Professional, which draws no shadows, only its edge and
    light change; under Marker only its light does, its marker edge staying exactly as drawn (a hover never redraws
    the board, [finish.md](../008-canvas/finish.md) "Marker"). With reduced motion nothing moves or eases. Under Sketch, whose
    drawing is a still copy, a 4% wash of the ink is laid over the card as well. The pointer's spot is written
    straight to the card at most once a frame, from one listener on the board, with no render; a touch has no hover.
  - <a id="cards-fan-in"></a>**Cards fan in**: when a board first shows its cards (its tab opened or loaded), the cards
    in view drop into place: each from a little above (12 px, 4 px more per card down its column), turned 2.5 degrees
    (one way in odd columns, the other in even) and at 96%, fading up over about half a second, column by column
    (70 ms apart) and down each column (45 ms apart), every card started within 650 ms. At most 80 cards animate;
    cards out of view, cards added later and everyone with reduced motion simply show. It runs once per board as it
    mounts, with no render of its own.
  - **Drop gaps open and close**: the dashed gap a held card would land in is tinted in the focus colour and breathes
    softly (8% to 16% and back, with an inner glow, every 1.4 s) while it waits. It opens wherever it appears
    (from nothing to the card's height, from 92% wide, over 180 ms, with no overshoot), so the cards below give
    way, and where it leaves its room closes over the same 180 ms on the same easing, with nothing drawn in it, so
    only one gap ever shows and, as one closes while the next opens in a cell, the two together keep the cell's
    height and the cards beyond them still (["A steady drag"](#working-on-a-board)). With reduced
    motion it just shows and goes, and does not breathe.
  - **Open a card from where it is**: the card panel grows out of the card pressed (from its box to the panel's, 360
    ms, its contents fading up as it lands) and, closed while that card is on screen, shrinks back into it (260 ms,
    the dim fading with it). A card off screen, a phone's sheet and reduced motion keep the panel's own fade.
  - **Scrollbars**: a board's scrollbars are dressed in its theme, not the system's grey: a rounded thumb in the theme's
    line colour on a faint track of its column colour, drawn 6 px thick inside a 14 px bar so it is easy to grab,
    growing to 10 px and leaning to the text colour under the pointer, and the theme's focus colour while dragged.
    Square under the Professional finish. Where the browser has no such styling (Firefox), a thin bar in the same
    colours.
  - **See-through surface**: the board's own surface (the room round its columns and under its header) is 80% solid
    and its columns' cells 85%, so the tab's canvas, its colour or pattern, shows faintly through both (a column's
    head is solid, "Column heads stick flush", so a card under a stuck head never shows through). The
    cards stay solid, so their text reads exactly as on a solid board. A board in a Dashboard slot keeps a solid
    surface. What shows through is the tab's canvas alone: a board filling its Board tab hides the canvas's
    elements behind it (its own copy there), and a maximised one hides the selection box drawn behind it.
  - <a id="corners"></a>**Its columns and cards round with it**: a column's head and its cells take the board's corners up
    to 12 px, and a card, a card's drop gap and its focus ring 4 px less (8 px by default), so the parts nest. A column's
    head and its cells (one, or one per swimlane) stand apart with a gap between them, so each is rounded on all four
    corners, a collapsed column's strip too. A square board (Corners at 0) has square columns and cards, and under the Professional finish every one
    of them is square, as the board is; Sketch and Marker draw them with the same corners.
- Its headings (the board's title, column and swimlane names, card titles) follow the tab's font (or the element's
  own); its small text (chips, pills, fields, numbers, counts, buttons) is always the editor's own face, so every
  font reads on a card ([Fonts](../004-interface-design/fonts.md) "On boards and cards"). A face liveplanner does
  not offer draws its headings in the editor's face too.
- The same colours draw the board in exports, thumbnails and images.
- A board keeps its layers to itself: its sticky column heads never draw over another element, even where boards
  overlap.
- A selected board or Plan card has no quick-connect pluses: its cards are its content, not nodes to chain from.
  With no plus to clear, its selection toolbar sits close above it (the 16 px gap read-only views use, not 48 px).
  Only boxed elements close the gap this way: an arrow keeps 48 px, as its move frame sits in that gap.

## A busy board

<a id="busy-board"></a>A board showing more than 100 cards is **busy**. A Tab Style pick (a look, a theme, a finish, a
typeface, a size, a canvas setting) on a busy board applies at once: on a 2,000-card board the pick paints within
about a tenth of a second for a finish, a typeface, a size or the canvas, and within about a fifth of a second for a
theme, with the page answering throughout.

- **Cards redraw only for what they show.** A pick that changes nothing on a card (a finish, a typeface, a size, the
  canvas) redraws no card: the finish's shadows and the lettering reach the cards from the board's own styling. A
  theme or the canvas turning light or dark redraws each card once. An edit anywhere else in the plan (a save, a
  peer's change to another tab) redraws no card either.
- **Its parts snap rather than ease.** The colour ease ([Eased changes](../011-theme/canvas-and-theme-dialog.md#eased-changes))
  is skipped inside a busy board: easing every chip of hundreds of cards held the page for seconds a pick. The board's
  own surface and the rest of the canvas still ease. A board of 100 cards or fewer eases as before.
- **Cards out of view wait.** A busy board's cards out of view are not styled, laid out or painted until they come
  near the view, a few cards at a time, and each keeps its last drawn height meanwhile (one never drawn takes the
  usual height of its size), so the board scrolls as before. Every browser does so, Safari and the iPad included,
  and none cuts a card's shadow, ring or hover glow at its box.
- **A drag stays smooth.** Carrying a card on a 2,000-card board keeps up with the pointer or finger, on an iPad too:
  picking a card up and letting it go redraw only that card (its copy appearing over the page never restyles the
  board), a drop gap opening or closing in a long column slides the cards below it rather than redrawing them, the
  copy under the pointer moves without laying anything out, a column's hover colour snaps rather than eases, and
  letting go settles the cards in view (the cards out of view simply sit in their new places).
- **Marker draws what is in view.** Marker's hand-drawn parts on a busy board are drawn on the cards in view, up to the
  usual limit; a card scrolled into view takes them the next time the board settles after a change.
- **Sketch keeps the board.** Picking Sketch, or leaving it, keeps the board as it is (its scroll, its collapsed
  columns): only its drawing changes.

## Both elements everywhere

- Both are general-tab elements: they exist in every mode and in exports, and only input differs by mode.
- In exports, thumbnails and api or MCP images the board draws its header, columns and card faces from the
  project's items, without the interactive controls.
  - Each card face follows its type's Display at the board's card size, as the canvas does
    ([Item types](item-types.md) "Card display"): Minimal one line, Detailed a header,
    the title on up to three lines, what sits under it and a footer. A built-in field shows only when the board's card
    fields list it; a custom field shows as its name and value ("Severity: S1"). A field with no value is left out.
  - Each card is as tall as its face needs, so cards in a column stack at their own heights. A column whose cards do
    not all fit the board's height ends in a muted "+3 more" line, never dropping them silently.
  - Every bit of a card face stays inside the card: a pill too wide for the room left ends in an ellipsis.
  - A swimlane board draws its lanes as rows across every column, each with its name (and colour dot) above its
    cards, each lane as tall as its fullest column.
  - A Plan card element draws the same face, Detailed, inside its own bounds.
- Read-only visitors see the board and open items read-only; they cannot drag, add or change set-up.
