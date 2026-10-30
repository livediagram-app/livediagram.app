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

## The board set-up

Stored on the element, shared by everyone, undone like any element edit:

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
- **Board Settings cog**: a board's header ends with a cog (**Board Settings**, with a tooltip) at its far right, after
  Maximise, for someone who may edit. It selects the board and opens its **element menu** under itself (the menu a
  right-click on the board opens, with the same rules: maximised or filling its tab, no Layer, Size, Rotation or
  Animation; under Style, set apart by a separator, its own rows Board Setup, Columns, Swimlanes, Sort Cards, Supported Cards and Card Layout; no Collaborate or
  Resources, [Nothing attached to Plan items](plan-mode.md#nothing-attached-to-plan-items)); pressed again it
  closes it. A board a collaborator holds opens nothing. In a Dashboard slot, where the board is simplified
  ([Dashboard tab](plan-tabs.md#dashboard-tab) "A board in a slot is simplified"), the header ends with the slot's own
  cog (**Slot Settings**: the slot toolbar, with **Open Tab**, and its **Slot** section) and no board sections, for
  everyone. Maximised from the slot, the board is whole again: for an Editor the cog opens **Board Settings** as a
  popover (as a Sheet's and a chart's cogs do), Board Setup, Columns, Swimlanes, Sort Cards, Supported Cards and Card
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
  **Estimate**, **Start Date** and **Due Date**, then every custom **Number**, **Currency**, **Date**, **Rating** and
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

- **A column's own settings** sit on the column: a cog at the far right of its head (always shown, for an Editor) opens a small popover (a sheet on a phone). On top is a **toolbar**: **Move Left** and **Move Right** at its start, one
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
  flyout rows of the menu itself**, under Style and set apart from it by a separator, each opening its own panel to the
  side, rather than one level down under a **Board** flyout, which would cost a click and hide them behind a name
  the rows say better; the cog shows the same rows: **Board Setup** (its **Title** and **Setup
  Board**; a board on the canvas is added to the slides from its element menu, above; the board itself has no ⋯),
  **Columns** (below; left out on an All Cards or Archive board and on one not set up yet, which Setup Board sets up),
  **Swimlanes** (**Group Rows By**, one grid: None, Assignee,
  Type, Priority (Status only on an All Cards board), then a row per groupable field, in one [option list](#option-lists), named by the field and drawn with its kind's glyph),
  **Supported Cards** (**Card Types**, below; left out on an Archive board) and **Card Layout** (**Card Size**:
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
  cell's Add card offers only **Add New Card Type** (stored as an empty `addTypes`). A board shows only cards of those types, and takes only those:
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
    from the placeholder's **Set up board**; and from Board Setup's **Setup Board** (below). Only for that person:
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
     on), none on to start (run again on a set-up board, the types it shows); **Select All** and **Clear**; under the list **Add New Card Type** (a dashed full-width button, while the catalogue has room) opens the type editor, and a type made there joins the list already ticked; a count ("Every card type, 5 in all", "3 of 5 card types").
     **Next: Columns** needs at least one.
  2. **Columns**: the columns chosen so far, top to bottom as the board will show them left to right, each a row
     with a grip, its name, "Existing state" or "New", and a remove cross; "No columns yet. Add one below." while
     there are none. A row is reordered by dragging its grip (mouse, pen or finger): a lifted copy follows the
     pointer, the others close up and a dashed slot in the brand colour shows where it will land; release places
     it, Escape puts it back; Alt+Up and Alt+Down on a grip move it by keyboard. Its heading counts them with a count badge. Then **Add a New State**, a name field
     and **Add** (Enter adds too): a name matching an existing state uses it ("Uses the existing To Do state, so its
     cards show here."), one already chosen is refused ("That column is already on the board."). Then **Use an
     Existing State**, an [option list](#option-lists) with a row per status the project has that is not chosen, listed exactly as
     the column picker's Existing Statuses (the same statuses, order, colour swatch, "On Sprint, Roadmap" or "Not on
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

- **Setup Board again**: on a board that has columns (not All Cards or Archive), the Board Setup section (the cog's,
  and the element menu's Board) holds a full-width **Setup Board** under its title. It closes the menu and opens the same dialog over the
  board, for this person only (the board stays as it is underneath, for everyone), filled in with the board as it is
  (its card types ticked, its columns in order, its layout), starting at step 1 every time, with **Cancel** and, last,
  **Save Board**. Closing it changes nothing. Saving writes both as one change: a column kept keeps
  its id and settings (name, WIP limit, colour, width), a new one is made as in setup, and one left out leaves this
  board only (its cards keep their state; the done column goes with its column).
- **The column picker** is how a column is added to a board that has columns (a column's **+ Add Column After**, or
  the board's **Columns** section;
  a board with none uses Setup Board, above):
  - **Existing statuses**: the statuses the project knows that this board has no column for. Known is: a
    status any board in the project names as a column (on any tab; All Cards and Archive boards aside), a status
    a card is in (out of the Trash) though no board names it, and a card type's Default State that neither names.
    One per name (ignoring case, spacing and punctuation; a name this board already has as a column is left out
    too). Ordered as the project's boards give them (the open tab's first, then tab, board and column order),
    then the ones only cards are in, by name, then the card types' Default States, in catalogue order. A status no
    board names reads as its id in Title Case.
  - **The field**: one field, **Add Column** beside it. With existing statuses it is labelled **Add a Column**
    ("Find or name a status") and works as a combobox over them: typing narrows the list to the names that hold
    the text (as names compare), ArrowDown and ArrowUp move a highlight through the rows (Up past the first goes
    back to the typed text), Enter adds the highlighted status, a press on a row adds it, and a row under the
    pointer is highlighted. With nothing highlighted, Enter or **Add Column** adds the typed name: a name that
    matches an existing status uses that status rather than making a near-duplicate, and says so under the field
    as it is typed ("Uses the existing To Do status"); a name this board already has as a column says "This board
    already has To Do" and adds nothing; any other name makes a column with a status of its own (its name and a
    short suffix), so it starts empty. Without existing statuses it is the plain field, labelled **Name a New
    Status** ("In Review"), with **Suggested Statuses** under it (below) when any are left.
  - **Existing Statuses**: under the field and a hairline, a small uppercase heading with the count, then a row per
    status: a colour swatch (the colour the first board using it gives its column; a hollow ring when none does),
    its name, a quiet line saying where it is used ("On Sprint, Roadmap", or "Not on any board"), and a pill with
    how many of its cards this board would show ("4 cards", "1 card", "No cards"): cards out of the Trash and the
    Archive, of the card types this board shows. The list scrolls past about five rows. With two or more and the
    field blank, **Add All** (by the heading) adds them all, in order, as one change (up to the 12-column limit).
    When the typed text narrows the list to nothing: the shared empty state, "No states match “{text}”", with "Add
    Column makes it a new state." ([Empty states](../004-interface-design/empty-states.md)).
  - **Suggested Statuses**: only while there are no existing statuses to list, under the field and a hairline, a
    small uppercase heading, then the [suggested statuses](#suggested-statuses) this board has no column for and
    the project has no status of, one to a row; a press adds that one as a new status, and **Add All** (by the
    heading, with two or more) adds them all, in order, as one change (up to the 12-column limit). None left, the
    section does not show. Telemetry: `Plan` · `Changed` · `ColumnAddedSuggested`.
  - A status picked from the list (or matched by name) keeps its status and its name, so the cards already in it
    show in the new column. Each add is one board change, undone in one step. Telemetry: `Plan` · `Changed` ·
    `ColumnAdded` for a new status, `ColumnAddedExisting` for an existing one (a row, a matched name, Add All).
  - **Where it shows**: **+ Add Column After** opens it as its own small popover hung beside the button (to its
    right, else left, below or above, whichever fits on screen) with an arrow pointing at it, over the settings
    popover, which stays open behind it. The picker's field takes focus as it opens; focus goes back to the button
    when it closes. It closes on an add, on a press outside it, or on Escape, which closes only the picker (a second
    Escape closes the settings). An added status or new name then moves the settings to the new column, its name
    selected; Add All closes them.
  - **Light and dark**: it wears the editor's popover surface (white, slate-900 in dark), the highlight in the
    brand tint; row colour changes are instant under reduced motion.
- <a id="suggested-statuses"></a>**Suggested statuses**: where a board's columns are chosen and the project has no
  state to offer, so the person need not invent the usual ones, up to five common statuses are suggested, in the
  order a board runs: **Backlog** ("Ideas and work for later"), **To Do** ("Ready to start"), **In Progress**
  ("Being worked on"), **In Review** ("Waiting for a check") and **Done** ("Finished"), Done last as a board's done
  column usually ends it. A suggestion is left out once its name (as names compare) is a column the board has (or
  Setup Board has chosen) or a status the project already has, so a suggestion never makes a near-duplicate. Each
  is an [option list](#option-lists) row of actions: a plus glyph, its name, its quiet line, named "Add {Name}". Added,
  a suggestion is a new status of its own (its name and a short suffix), as a typed name is; **Done** counts as done
  by its name, as any [done-like name](#done-columns) does. Only someone who may edit the board sees them, as only they set up a board or add its columns: a
  Participant and a Viewer never do (a Viewer reads the placeholder's "Someone who can edit it will set it up.").
  Telemetry: `Plan` · `Changed` · `ColumnAddedSuggested`, once a press (Add All too), in Setup Board and the column
  picker alike.
- **Every board shows every card**: there is no per-board filter by type or label; a board shows every item whose
  status is one of its columns, and counts the rest as not on it.
- **One name, one status**: a project never has two statuses of the same name (compared as the column picker
  compares them, ignoring case, spacing and punctuation). A board placed from the palette gives a column the status
  the tab's boards already have of that name, so its cards show there too, and a status of its own (the column's
  status and a short suffix, `todo~k3f9`) only to a name no status has yet. A board's first column, typed on an
  empty board, does the same. Renaming a column to a name another status has switches the column to that status
  when its own status holds no cards (out of the Trash), the cards of that status then showing in it; when its own
  status holds cards, or the board already has a column for that status, the rename is refused and the name put
  back, with a note under it: "A {Name} state already exists. Add it from Add Column, so its cards show here."
  Boards from a template keep the template's statuses, and come with no cards.
  Whatever brings two states of one name into a project (a template's tab added beside a board, a pasted or
  agent-written board, a project from before this rule), they **merge** into the first, in tab, board and
  column order, so every client keeps the same one: each board takes the kept state (a board holding both keeps
  the earlier column and drops the later), and the cards in the other, and a trashed card's state to restore
  to, move to it, as one write. It is done by someone who may edit, once every tab and the cards have loaded,
  with no undo step (undoing it would only split the cards again), and again whenever a duplicate appears
  (`useMergeDuplicateStatuses`). A card type's Default State or turned-off states naming a merged-away state
  are left as they are. A board starts wide enough for every
  column side by side at
  its narrowest (220px a slot, with the gaps between), never narrower than its default, so no new board scrolls. Archive and All Cards boards show cards by what they are, not by
  status, and keep their columns.
- **Hide writing** comes with a board's template (the Retro's is on); it has no menu control.

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
  - The fields are Number, Type, Assignee, Priority, Labels, Estimate, Start Date, Due Date, Votes, Checklist,
    Description and Project. A start date reads "From 1 Oct", muted.
- **Swimlanes**: a labelled row per group (an assignee's avatar and name, a type's glyph, a project's
  [Colour](items.md#colour) dot before its name), "No assignee" last.
  Each swimlane collapses on its own, per person.

### Swimlanes by a field

A board can group its rows by one field of its cards (`swimlaneBy: 'field'` with `swimlaneField`, the field's
id), so a field added to a type (a Project's **Customer**) can set the rows straight away.

- **Which fields**: every custom field of a kind that groups (Choice, Checkbox, Number, Date, Text, Card) on any type in
  the project's catalogue, and the built-in **Labels**, **Estimate**, **Start Date** and **Due Date**. Long
  text and Link never group (each value is its own row), nor do Description, Checklist, Votes and Title.
  Assignee, Type, Priority and Status keep their own tiles. A **Card** field (Parent among them) gives a row per
  linked card, named by its title with the linked card's colour dot when it has a Colour, in the linked cards' number
  order ("Missing card" for a link whose card is gone), then
  **No {Field}**; a drop into a row sets the link (item-types.md "Card fields").
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
  - **Labels**: a card sits in the row of its **first** label; rows A to Z.
- **Dropping a card into a row** sets the field to that row's value, as Sam's row assigns to Sam: a Choice to the
  option, a box ticked (Yes) or cleared (No), a number, a date, the text. Into a **Labels** row it puts that label
  first, adding it if the card did not have it (its other labels are kept). Into **No _field_** it clears the
  field (all of a card's labels, for Labels). A card whose type does not offer the field still takes the value,
  stored but unshown, as for any row.
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
- **Drag a card onto another board** to move its item into that board's column (and row, setting the row's
  field) where it lands, with the same placeholder. The item now has that column's status, so a board without
  that column lists it under "Not on this board".
- **Drag a card off the board** onto the canvas to leave a Plan card there; the item stays on the board too.
  **Drag a Plan card onto a board** to move its item to the end of the column it lands on; the Plan card goes
  away.
- **Add a card**: each cell ends in a quiet **+ Add card** ("Add your first card" on an empty board). It opens
  the **Add a Card** menu (the shared anchored menu with an option list and no header, since it opens under its
  own button; a bottom sheet titled "Add a Card" on a phone): a row per card type the board shows, each its glyph on a tint of its
  colour and its name; choosing one adds a card of it ("New task"...) at the end of the cell, in the cell's row
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
- **Add New Card Type**: under the rows, the menu ends in **Add New Card Type**, for someone who may edit while the catalogue has room for another type. It closes the menu and opens the type editor
  on a new type whose statuses are only this board's columns' (every other status of the project turned off), so
  its cards fit the board. Saving it adds it to this board's card types when the board takes a chosen few (a board
  that takes every type already shows it); closing the editor makes nothing. Telemetry: `Plan` · `Added` ·
  `CardType`, as any new type.
- **Right-click a card** for its menu (icon-left rows in sentence case, **Trash** last and styled as the rest, as the item panel's ⋯ menu): **Open**, **Duplicate** (a copy right after it, without its votes),
  **Archive** (or **Restore**; [Items](items.md#archive)),
  **Edit Card Type** (the card's type in the type editor),
  **Move to** another column of the board, and **Trash** (to the [Trash](items.md#trash), restorable there). Someone who may only view gets
  Open alone; a Participant gets Open, Duplicate, Move to and Flag (or Remove Flag), as the item panel's ⋯ menu gives it; a face-down card has no menu. It is the shared context menu, so it opens at the pointer, stays
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
    line, "Add a description…" with a pencil, not a dashed box. **Details** is a soft rounded panel inset in the
    modal (a light tint and a hairline ring), headed in small capitals; each row is a muted 12 px label beside
    its control, at least 36 px tall, with no hover highlight (the control shows its own). **Status** reads as a pill: a dot in its stage's colour (Not Started, In Progress, Done) before its name, in medium weight. **Linked as …** sections are headed like the other sections (13 px semibold, a count beside), and an empty one is a quiet line, not a box. Created by and Edited by close it, small and
    quiet under a hairline. On a phone the layout is unchanged: one column, Details the first tab.
  - **Maximised**: on a desktop the header holds a **Maximise Card** button (the maximise glyph a board's own
    Maximise uses) just left of the close button, after the ⋯ menu. Pressed, the panel grows to fill the window
    less a 1 rem margin on every side (corners kept rounded, the dimmed editor showing as a thin frame, so it
    still reads as the card over the plan: Escape, the close button and a press on that frame close it as
    before), and the button becomes **Minimise Card** (the minimise glyph, pressed), which puts it back to its
    usual size. The size eases between the two (200 ms; at once with reduced motion). Maximised, the room is used
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
      type's glyph and a chevron (a plain label for someone who may not edit), then its number as a quiet
      monospace **#12** tag; pressing the tag copies "#12" and its tooltip says **Copied**.
    - after a gap, the **⋯** menu and **Close**, each named by a tooltip.
  - **Moving between cards** keeps the panel open: it changes card in place, without opening again, and each card
    starts on its own first tab.
  - **Labels** are coloured chips in one field (each label keeps its colour everywhere: a 12% tint of it, inked with
    70% of it mixed toward the page's ink, dark in light mode and white in dark, which reads at 4.5:1 for every swatch), with the project's
    other labels offered as it is typed in; Backspace in an empty field takes the last one off.
  - **Checklist**: a progress bar and "2 of 5" over its steps; each step's text is edited in place, ticked with
    a rounded box, and taken off with ×; **Add a step** keeps its place for the next.
  - **Main column**: the title, large, then the type's tabs (see [Item types](item-types.md)) and the fields
    of the chosen tab. The **Description** is rich text: bold, italic, underline, strikethrough, size, colour,
    headings and links, and **bullet** and **numbered lists** from their own toolbar buttons, from a toolbar over
    it or the usual shortcuts. Enter on a list item starts the next one; Enter on an empty item ends the list.
    It reads as text until clicked (hovering shows **Edit**); an empty one is a quiet **Add a description…** line (a pencil before it), not a box. Editing, it sits on a raised surface with the shortcuts beneath and **Saving…** then **Saved**;
    focus leaving it, or Escape, returns it to reading.
  - **Details panel** on the right: the fields in no tab, as label and value rows (Status first, as a coloured
    picker), then **Created by** and **Edited by** (with when), each with the person's disc (initials on
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

### Keyboard

With focus on a card: arrow keys move focus between cards; Enter opens the item; **Shift+Left/Right** moves the
card to the previous or next column; **Shift+Up/Down** moves it within the column (on a sorted board it moves nothing
and says why); Delete moves it to the
Trash, focus going on to the next card in its cell (else the one before; a cell left empty hands it to the nearest card on the board, the next in reading order, else the one before); **N** opens the Add a Card menu for the card's cell; the context-menu key opens the card's menu. Every move is announced ("#12 moved to In Progress,
position 2 of 4").

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
  Duplicate, so the same box and rows without a marker); the column picker's Existing Statuses and Suggested
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
menu, the one the canvas opens, never the browser's; a card's own right-click keeps its card menu.

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
  title, a Sheet's title) moves out of its header into the menu box at the top left, after the mode menu and a hairline,
  in the chrome's own text colour, truncating past 16 rem. It is the same title: a double-click on it renames it in
  place, as in the header. A board's [card type chips](#card-type-chips) stay in the header, leading it just after
  the menu box. The room the band needs is measured from the menu box without the name, so the name
  coming or going never takes the band away. Without a band (a phone, a narrow window) the name stays in the header.
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
switch** anywhere (not in Board Setup, the board's cog, the Setup Board wizard or Sheet Settings), and so no
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
[Export](plan-tabs.md#export)) and come in from its tab menu's **Import CSV…**, in place of the project's Import
([Board tab and Sheet tab](plan-tabs.md#board-tab-and-sheet-tab)). The files are read and written by the Sheet's CSV reader and writer
([CSV](../029-sheets/sheet.md#csv)): RFC 4180 quoting both ways, a comma (or a tab, when the first line holds one; a semicolon when it holds semicolons
and no comma).
A download is safe to open: a field a spreadsheet would run as a formula is made inert with a leading `'` (the
Sheet's rule).

**The CSV export** (everyone, a Viewer included) is the cards the board shows, before any quick filter: column by
column in board order, each column's cards in their order on it. A file named for the board's title ("Roadmap.csv";
"Board.csv" untitled), one header row, then a row per card:

- **Key**, **Title**, **Type** (its label), **Status** (the column's name as the board shows it; an All Cards or
  Archive board, the state's name).
- Then each built-in field any of the board's card types offers, in this order: **Assignee** (the person's name),
  **Priority** (Urgent, High, Medium, Low), **Start**, **Due** (YYYY-MM-DD), **Estimate**, **Labels** (joined by ", "),
  **Description** (its plain text).
- Then the custom fields of the board's card types by their label, in catalogue order (a label two types share is one
  column): a Card field (Parent among them) as the linked card's title, a checkbox as "Yes" or empty, the rest as
  written. A field a card's type does not offer is empty on its row.

**Import CSV…** (an Editor or a Participant, who may add cards; dimmed for a Viewer, and on an Archive board) opens a
file picker (`.csv`, `.tsv`). The first row names the columns, matched case-insensitively by the names the Sheet's
card functions take ("Title", "Status" or "State", "Assignee" or "Owner", "Due Date", ...) and then by the custom
fields' labels; a column it does not know is ignored, and so is **Key** (the new cards are numbered afresh). A file
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
  of its options; a Card field is not imported.
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
- **The header has no widgets and no card type chips** on a phone: the title, taking the room up to the header's controls (beside widgets
  it keeps to 40% of the header), then the controls. The quick filter the widgets set
  stands down with them, so a filter set on a wider screen never hides cards with nothing on screen saying so.
- A board that scrolls on its own (maximised, filling its tab, or in a Dashboard slot) shows one column a screen (see
  "Five slots across"); covering the canvas, its body ends 8.5 rem (and the home indicator's safe area) past its last
  cards, so they scroll up clear of the bottom controls that run across a phone's screen.
- **One column in focus**: as that board scrolls sideways its columns snap so one sits centred, its neighbours
  peeking in on either side, and a fling moves one column, never several (mandatory snapping, each column a stop).
  The snapping is sideways only: it never moves the board up or down, and scrolling down a column glides freely,
  never pulled back to the top. Each column's snap point is a plain marker spanning the column's full height, not its
  sticky header, so scrolling down moves no snap point and the browser has nothing to re-snap mid-scroll. (The jank
  this replaces had two causes, both fixed at the root: the snap points were the sticky headers, and every card was
  `touch-none`, so on a column that is mostly cards a finger could scroll only in the gaps between them.) The body
  keeps its scroll to itself (overscroll contained) while it covers the canvas, so reaching its end never drags the
  page under it; in a Dashboard slot only its sideways scroll is contained, so scrolling down past its end still
  scrolls the Dashboard.
- **A finger on a card scrolls** that board as empty space does (across and down); held still for
  `CARD_HOLD_TO_DRAG_MS` first, it picks the card up and carries it, the board no longer scrolling under it. A finger
  that moves before the hold is up is a scroll: the card neither moves nor opens. A tap still opens the card, and held
  still for `LONG_PRESS_MS` it opens the card's menu. Elsewhere (a desktop, a tablet, a board on a phone's canvas) a
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
- Corners follow Quick Style's Corners (12 px by default), text follows the tab's font (or the element's own),
  and a shadow sits under the board like any shape's.
- The same colours draw the board in exports, thumbnails and images.
- A board keeps its layers to itself: its sticky column heads never draw over another element, even where boards
  overlap.
- A selected board or Plan card has no quick-connect pluses: its cards are its content, not nodes to chain from.
  With no plus to clear, its selection toolbar sits close above it (the 16 px gap read-only views use, not 48 px).
  Only boxed elements close the gap this way: an arrow keeps 48 px, as its move frame sits in that gap.

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
