# Plan board

A **Plan board** is one element on the canvas that frames the document's [items](items.md) as columns of cards:
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

- **Title**: shown in the board's header.
- **Columns**: each a **status** value and a display name, an optional **WIP limit** and an optional colour. A board
  has 1 to 12 columns. The first column is where new items land when no column is chosen.
- **Done column**: optionally one column is marked done: its cards draw muted and count as finished in the
  header's progress.
- **The board's ⋯ menu**: left of the cog, for a document with a slide deck, a **⋯** ("More for {Title}") opening
  the board's actions as icon-left rows: **Add to Slides** (the board as a slide; announces "Board added to the
  slides").
- **Board Settings cog**: a board's header ends with a cog (**Board Settings**, with a tooltip) at its far right, after Maximise,
  for someone who may edit. It opens a popover under it holding the same four sub-sections as the element menu's Board
  (**Board Setup**, **Swimlanes**, **Supported Cards**, **Card Layout**), each under a heading that opens it,
  one at a time (Board Setup when it opens; opening one closes the other); it scrolls when taller than the window. A press
  outside or Escape closes it. Telemetry: `Plan` · `Opened` · `BoardSettings`.
- **Swimlanes**: none, or grouped by assignee, type, priority, status, or **any field** the card types the board
  shows offer, Parent among them (see [Swimlanes by a field](#swimlanes-by-a-field)). A board's columns are its statuses, so rows by status would repeat them: Status is not a choice on a board
  (the menu and Setup Board leave it out), except on an All Cards board, whose one column holds every status and whose
  rows are its statuses; a board stored grouping by status (an older one, or an agent's write) reads as no grouping
  (`normaliseBoardSetup`). A Gantt chart's Swimlanes still offer Status. The menu lists only what those
  types offer: None always, Type when it shows more than one type, Assignee, Priority and each field when
  one of its types has it; a board stored grouping by `parent` reads as grouping by the Parent field; a grouping already in use stays listed (and pressed) even once its types no longer offer it.
  A Gantt chart's Swimlanes do the same for the card types it draws.
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
  column) is saved in Title Case. A status picked from the ones the document already has keeps its name as it
  is. A status with no name on the tab reads as its id in Title Case ("in-review~ab12" is "In Review").
- Names already stored in documents are not rewritten: an older board keeps "To do" until someone renames it.

Where each is set, so a setting lives with what it changes, never in one central panel:

- **A column's own settings** sit on the column: a cog at the far right of its head (shown on hover and focus,
  always on a touch screen) opens a small popover (a sheet on a phone) with its **name**, **colour** (No colour or any colour from the
  [colour picker](../004-interface-design/colour-picker.md)), **WIP limit**, **Counts as Done**, **Move Left** / **Move Right**, **+ Add Column After**,
  then two ways to take it away. **Remove Column** (a column glyph) takes it off this board only, at once: the
  state and its cards stay, so another board's column for it still shows them (where none does, the cards read
  as No status, as any card of a state no board names). **Delete Status** (a bin) deletes the state: when it
  holds cards (out of the Trash, on any board) it first opens a popover anchored to it: "Delete {Name}?", "Its N
  cards are in {Name}, on every board that shows it. Where should they go?", and two option cards, one picked:
  **Move to Another Column** (a menu of the board's other columns, the first picked; the default) or **Move to the
  Trash** ("You can restore them from the Trash."). **Delete Status** in it (a bin) moves the cards as picked,
  then removes the column, and the state's column from every other board in the document; **Cancel** or Escape
  keeps it. Moving to the Trash moves every card of that state and announces "N cards moved to the Trash"; a card
  whose type leaves out the target column's state stays, as a move does. A state that holds no card is deleted
  at once. The board's last column cannot be removed. Each change applies as it is made. **+ Add Column After**
  opens the **column picker** (below) in the popover; the column it adds goes after this one, and the popover
  moves to it, anchored to its cog.
- **The board's own settings** sit in its element menu (right-click the board, or the selection's ⋯) as one
  **Board** category (a flyout), holding four sub-sections, each a collapsible group under a small uppercase heading,
  one open at a time (Board Setup when it opens), as the cog shows them: **Board Setup** (its **Title**, **Setup
  Board** and **Fill Tab**, [Fill Tab](#fill-tab); a board is added to the slides from its own ⋯ menu, above),
  **Swimlanes** (**Group Rows By**, one grid: None, Assignee,
  Type, Priority (Status only on an All Cards board), then a row per groupable field, in one [option list](#option-lists), named by the field and drawn with its kind's glyph),
  **Supported Cards** (**Card Types**, below; left out on an Archive board) and **Card Layout** (**Card Size**:
  Minimal, Compact or Detailed; what a card shows at each size is its type's Display, [Card
  display](item-types.md#card-display)). Group Rows By, Card Types and Card Size each open with a one-line info note
  (an "i" in a circle) saying what it does.
  New columns come from a column's **+ Add Column After**.
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
  column), for Action cards only, Compact cards showing who has each action and when it is due (a to-do list is a
  dense list of short items, so Compact; its checklist is in the card), and the Completion and Due Soon widgets.
- **Setup Board**: a board with no columns (the Blank board starts so, and starts taller than a set-up board: 880 px
  against 640, blueprint DEFAULTS D5) shows, in place of its columns, a **Setup
  Board** card in the board's colours (a board glyph, the title, a line: "Pick its cards, columns and layout. Change
  them any time from its cog.", Help), with three steps shown as a wizard stepper across the card: a numbered
  circle per step joined by a connecting line, the step's name beside its circle (under it on a narrow card), no
  further description. The current step's circle is filled in the brand colour and its name bold
  (`aria-current="step"`); a done step's circle holds a tick, the line up to the current step is filled in the brand
  colour, and a done step is a button back to it (pointer, focus ring); a step ahead is muted and not a button. It
  fits a phone's width without cutting a name.
  1. **Card Types**: an [option list](#option-lists), a row per card type of the document (its glyph on a tint of its colour, its name, a tick when
     on), none on to start (run again on a set-up board, the types it shows); **Select All** and **Clear**; under the list **Add New Card Type** (a dashed full-width button, while the catalogue has room) opens the type editor, and a type made there joins the list already ticked; a count ("Every card type, 5 in all", "3 of 5 card types").
     **Next: Columns** needs at least one. A hairline sits under the step tiles.
  2. **Columns**: the columns chosen so far, top to bottom as the board will show them left to right, each a row
     with a grip, its name, "Existing state" or "New", and a remove cross; "No columns yet. Add one below." while
     there are none. A row is reordered by dragging its grip (mouse, pen or finger): a lifted copy follows the
     pointer, the others close up and a dashed slot in the brand colour shows where it will land; release places
     it, Escape puts it back; Alt+Up and Alt+Down on a grip move it by keyboard. Its heading counts them with a count badge. Then **Add a New State**, a name field
     and **Add** (Enter adds too): a name matching an existing state uses it ("Uses the existing To Do state, so its
     cards show here."), one already chosen is refused ("That column is already on the board."). Then **Use an
     Existing State**, an [option list](#option-lists) with a row per status the document has that is not chosen, listed exactly as
     the column picker's Existing Statuses (the same statuses, order, colour swatch, "On Sprint, Roadmap" or "Not on
     any board", and card count of the card types chosen in step 1; named "Add {State}"), one to a row, with
     **Add All**. At 12 columns adding stops ("A board holds up to 12 columns."). **Back** returns to step 1 with
     nothing lost. **Next: Layout** (needs a column) goes on; Create Board is not offered before the Layout step.
  3. **Layout** (starting from the board as it is, so pressing straight through keeps its preset's layout): "How the
     board is laid out. It starts as the board is now; every choice can change later from its cog." Then
     **Swimlanes** (its line "Rows across the board, one for each value of the field you pick." and the same option list
     as the board menu's Swimlanes, offering what the card types chosen in step 1 offer), **Card Display** (its line
     "How much of each card shows. Each card type's Display sets what shows at each size." and the same Minimal,
     Compact and Detailed rows as the menu's Card Layout), then, under a hairline, **Fill Tab** (a switch row:
     "Fill Tab", "The board always fills this tab, so the rest of the canvas can't be used."), off to start (on when
     run again on a board that fills its tab). Turned on while the tab holds other elements, a warning shows under
     it as a plain bordered notice (never red, destructive-actions.md): "The rest of this canvas becomes unusable, and its N other elements will be deleted when you create
     the board." (save, on a board run again), with "1 other element" for one; no warning on an otherwise empty tab.
     **Back** returns to Columns with nothing lost.
     **Create Board** (**Save Board** on a board run again; the Layout step's only, needs a column) writes the columns (an existing state keeps its
     status, so its cards show; a new one has a status of its own), the card types (every type is no `addTypes`; a
     chosen few are) and the layout (grouping, card size, and Fill Tab with its deletion, [Fill Tab](#fill-tab)) as
     one change, one undo step. Telemetry: `Plan` · `Changed` · `BoardSetUp`. Someone who may only view reads that the board is not
     set up yet.
- **Setup Board again**: on a board that has columns (not All Cards or Archive), the Board Setup section (the cog's,
  and the element menu's Board) holds a full-width **Setup Board** under its title. It closes the menu and shows the same screen in
  place of the board's columns, for this person only, filled in with the board as it is (its card types ticked, its
  columns in order, its layout), with **Cancel** and, last, **Save Board**. Saving writes both as one change: a column kept keeps
  its id and settings (name, WIP limit, colour, width), a new one is made as in setup, and one left out leaves this
  board only (its cards keep their state; the done column goes with its column).
- **The column picker** is how a column is added to a board that has columns (a column's **+ Add Column After**;
  a board with none uses Setup Board, above):
  - **Existing statuses**: the statuses the document knows that this board has no column for. Known is: a
    status any board in the document names as a column (on any tab; All Cards and Archive boards aside), a status
    a card is in (out of the Trash) though no board names it, and a card type's Default State that neither names.
    One per name (ignoring case, spacing and punctuation; a name this board already has as a column is left out
    too). Ordered as the document's boards give them (the open tab's first, then tab, board and column order),
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
    Status** ("In Review"), and nothing else shows: the picker is then what it always was.
  - **Existing Statuses**: under the field and a hairline, a small uppercase heading with the count, then a row per
    status: a colour swatch (the colour the first board using it gives its column; a hollow ring when none does),
    its name, a quiet line saying where it is used ("On Sprint, Roadmap", or "Not on any board"), and a pill with
    how many of its cards this board would show ("4 cards", "1 card", "No cards"): cards out of the Trash and the
    Archive, of the card types this board shows. The list scrolls past about five rows. With two or more and the
    field blank, **Add All** (by the heading) adds them all, in order, as one change (up to the 12-column limit).
    When the typed text narrows the list to nothing: "No existing status matches "{text}"." (Add Column then makes
    it new).
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
- **Every board shows every card**: there is no per-board filter by type or label; a board shows every item whose
  status is one of its columns, and counts the rest as not on it.
- **One name, one status**: a document never has two statuses of the same name (compared as the column picker
  compares them, ignoring case, spacing and punctuation). A board placed from the palette gives a column the status
  the tab's boards already have of that name, so its cards show there too, and a status of its own (the column's
  status and a short suffix, `todo~k3f9`) only to a name no status has yet. A board's first column, typed on an
  empty board, does the same. Renaming a column to a name another status has switches the column to that status
  when its own status holds no cards (out of the Trash), the cards of that status then showing in it; when its own
  status holds cards, or the board already has a column for that status, the rename is refused and the name put
  back, with a note under it: "A {Name} state already exists. Add it from Add Column, so its cards show here."
  Boards from a template keep the template's statuses, and come with no cards.
  Whatever brings two states of one name into a document (a template's tab added beside a board, a pasted or
  agent-written board, a document from before this rule), they **merge** into the first, in tab, board and
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

- **Header**: title, the count of items shown, a progress bar (done of all, when a done column is set), the
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
- **Cards** in rank order, at the board's **card size**. A card is a rounded tile with a hairline border and a soft
  shadow that lifts a little under the pointer (still under reduced motion, it does not move). Every card carries
  the item type's colour as the fill behind its **number** (white or near-black text, whichever reads better on it); a
  Minimal card, which shows no number, has a small dot of it before the title. A card being dragged or opened by
  someone else carries their colour ring and name. Of the fields the set-up shows:
  - **Minimal**: the title (two lines at most) and nothing else, but a session vote's stepper during a vote.
  - **Compact**: the type's glyph on a tint of its colour and the number, top left, beside the title (two lines at
    most), over one row of the priority's signal bars, the start and due dates, votes, comments and the assignee's
    avatar.
  - **Detailed** (the default): a header of the **type chip** (its glyph and name on a tint of its colour), the
    number on its type's colour, the item's own colour dot (when it has one) and, at the end, the **priority** as signal bars with its name (Low one bar, Medium two, High three,
    Urgent three in its red); the title (three lines); the project it sits under; two lines of its description;
    custom fields shown on cards, as name and value; up to four **label chips** (each in its label's colour, the
    same as in the card panel, "+2" for the rest); then a footer of **pills**: the start date ("From 1 Oct"), the
    due date, the estimate, checklist progress ("2/5", green when complete), comments and votes, with the
    assignee's avatar at the end.
  - **Due date pill**: "Due 10 Oct" (as the start pill reads "From 8 Oct"), red once past (unless the card is done), amber when due within two days, otherwise quiet.
  - The fields are Number, Type, Assignee, Priority, Labels, Estimate, Start Date, Due Date, Votes, Checklist,
    Description and Project; Compact draws Number, Type, Assignee, Priority, Start Date, Due Date and Votes. A
    start date reads "From 1 Oct", muted.
- **Swimlanes**: a labelled row per group (an assignee's avatar and name, a type's glyph, a project's
  [Colour](items.md#colour) dot before its name), "No assignee" last.
  Each swimlane collapses on its own, per person.

### Swimlanes by a field

A board can group its rows by one field of its cards (`swimlaneBy: 'field'` with `swimlaneField`, the field's
id), so a field added to a type (a Project's **Customer**) can set the rows straight away.

- **Which fields**: every custom field of a kind that groups (Choice, Checkbox, Number, Date, Text, Card) on any type in
  the document's catalogue, and the built-in **Labels**, **Estimate**, **Start Date** and **Due Date**. Long
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

- An **All Cards** board (the Boards category's All Cards tile) shows every card in the document that is not
  archived, whatever its status, in its one column, a **swimlane per status**. A status row is named by the
  column that has it on a board of the document (the open tab's boards first, then each other tab's, in board
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
  own button; a bottom sheet titled "Add a Card" on a phone), as
  Illustrate's + opens "Add a page": a row per card type the board shows, each its glyph on a tint of its
  colour and its name; choosing one adds a card of it ("New task"...) at the end of the cell, in the cell's row
  (taking the row's field). Arrow keys move between the rows as in every menu; Escape, a press anywhere
  else (the canvas included, mouse, pen or touch) or a wheel or trackpad pan outside it closes it. There is no typed title: the new card opens at once in its panel with its title selected, so
  typing names it (see **Open an item**).
- **Add New Card Type**: under the rows, the menu ends in **Add New Card Type**, for someone who may edit while the catalogue has room for another type. It closes the menu and opens the type editor
  on a new type whose statuses are only this board's columns' (every other status of the document turned off), so
  its cards fit the board. Saving it adds it to this board's card types when the board takes a chosen few (a board
  that takes every type already shows it); closing the editor makes nothing. Telemetry: `Plan` · `Added` ·
  `CardType`, as any new type.
- **Right-click a card** for its menu (icon-left rows in sentence case, **Trash** last and styled as the rest, as the item panel's ⋯ menu): **Open**, **Duplicate** (a copy right after it, without its votes),
  **Archive** (or **Restore**; [Items](items.md#archive)),
  **Add to Slides** (an item slide, [Presentation mode](../012-collaboration/presentation-mode.md#item-slides)),
  **Edit Card Type** (the card's type in the type editor),
  **Move to** another column of the board, and **Trash** (to the [Trash](items.md#trash), restorable there). Someone who may only view gets
  Open alone; a face-down card has no menu. It is the shared context menu, so it opens at the pointer, stays
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
  - **Header**: the type (a picker, with its glyph), the key, a **⋯** menu of **Duplicate** (a copy right after
    it, without its votes, as the card menu's), **Flag** (or **Remove Flag**), **Archive** (or **Restore**) and **Edit Card Type** (closing the panel and opening the card's type in the type
    editor), then, after a separator, **Help** (opening the Cards article), then, after another, **Trash** (to the Trash) at the bottom of the list, as icon-left rows, then the close button. Someone who
    may only view gets a ⋯ of Help alone.
  - **Parent** is a Card field (item-types.md "Card fields"): its control's open arrow opens the parent, and a
    Project lists the cards under it in its **Linked as Parent** section, as any Card field's linked card does.
  - **Breadcrumb**: the panel remembers the cards opened from inside it (a Parent's Open, a child row, a crumb).
    Once it holds more than one, the header starts with a breadcrumb of the earlier ones. A crumb opens its card and
    drops the crumbs after it, and opening a card already in the trail goes back to it rather than repeating it.
    Opening a card any other way (from a board, the Cards finder, a link) starts a new trail. It holds at most 8
    cards, dropping the oldest; a card trashed or deleted meanwhile leaves it. The header shows the 3 crumbs nearest
    the current card (1 on a phone); earlier ones fold into a **…** button that names how many and opens a menu of
    them, each a step back. On a phone the breadcrumb takes a row of its own above the header, its crumb pointing
    back, so the type picker keeps its room.
  - **The header reads part by part**, each looking like what it does:
    - a **crumb** is a link: its type glyph in its type colour and its title (cut to fit; the full "Back to #3
      Title" on hover and to assistive technology), muted, darkening with a soft background and an underline on
      hover; crumbs are parted by a muted chevron.
    - the **current card** ends the trail and is not a link: its **Card Type** picker, a bordered pill with the
      type's glyph and a chevron (a plain label for someone who may not edit), then its number as a quiet
      monospace **#12** tag; pressing the tag copies "#12" and its tooltip says **Copied**.
    - after a gap, the **⋯** menu and **Close**, each named by a tooltip.
  - **Moving between cards** keeps the panel open: it changes card in place, without opening again, and each card
    starts on its own first tab.
  - **Labels** are coloured chips in one field (each label keeps its colour everywhere), with the document's
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
card to the previous or next column; **Shift+Up/Down** moves it within the column; Delete moves it to the
Trash; **N** opens the Add a Card menu for the card's cell; the context-menu key opens the card's menu. Every move is announced ("#12 moved to In Progress,
position 2 of 4").

## Option lists

Every option picker in Plan mode is one **option list** (`OptionRows`): a bordered, rounded box holding a row per
choice, one to a row, each row its icon at the left, then its name (Title Case), a quiet second line where it helps
(where a state is used), and at the right a marker. A one-of-a-set list (a radio group) ticks the chosen row and tints
it in the brand colour (light and dark); an on-or-off list (checkboxes) shows a box at the right, filled and ticked
when on; a list of actions (Add a Card, an existing state to add) has no marker. Hover and keyboard focus tint a row;
outside a menu one row is in the Tab order and ArrowUp / ArrowDown / Home / End move between rows, Enter or Space
picks; inside a command menu the rows are its items (`menuitemradio`, `menuitemcheckbox`, `menuitem`) and the menu's
own keys move between them. In Setup Board it wears the board's colours. It is used by:

- the board menu and cog: **Swimlanes** (Group Rows By), **Supported Cards** (Card Types), **Card Layout** (Card
  Size), **Board Setup** (Fill Tab: On Canvas, Fill Tab); a Gantt chart's Card Types and Swimlanes;
- **Setup Board**: Card Types, Use an Existing State, and the Layout step's Swimlanes and Card Display;
- **Add a Card**'s card types; a card type's **States**; the **Card Types** panel's rows (each with its own Edit and
  Duplicate, so the same box and rows without a marker); the column picker's Existing Statuses;
- a column's settings: **Move Left** and **Move Right** are rows, icon left, like the actions under them.

Left as they are: the board preset gallery (PlanBoardPicker: large visual previews to compare), the glyph palette
(GlyphPicker: an icon grid, where a row each would be far too long) and a type's Display size switch (ItemTypeDisplay:
a three-way segmented control, not a list of options), and the palette's Plan tiles (cards and views to drag onto the
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
  painted with the canvas's own background (its colour and pattern), so nothing on the canvas shows through, in any
  strip the board leaves beside or below the panels. A sheet
  across the canvas (a phone) pushes the top or bottom instead. It never gives up more than 45% of the canvas on an
  axis. It follows the chrome as it changes (a panel opened, closed, moved or collapsed, the window resized), and a
  panel dragged over it still floats above it. A panel opened for a moment (the Trash, the Cards panel, card search,
  Card Types, Layers, a vote or poll, the AI panel, the item panel) floats over the board and never moves or resizes
  it, so nothing jumps as it opens or closes. Everything on the board works as it does on the canvas: cards drag,
  open and add, and widgets filter. The header does not move the board while it is maximised.
- **The header holds the top row**: maximised (or filling its tab), a board, view or Sheet does not start below the
  Toolbar layout's top row; it starts at the top of the canvas area, and its header grows to that row's height
  (`HeaderBand`), so the menu button, the mode menu and the palette toolbar float inside the header instead of over
  a strip of canvas above it. The palette leaves the centre for the header's right end, 12 px before its controls,
  so the middle of the header is the title's and widgets'. Its controls (the view's own, Maximise or Restore, the cog,
  the ⋯ menu) sit together in a rounded card at its right end, matching the menu box at the left: the element's
  surface, its border and a soft shadow. The header's own content keeps clear of them: its title, count and widgets
  start after the mode menu and stop short of the palette (truncating, or the widgets scrolling, as they do when
  narrow). It is laid out this way only when there is room: at least 140 px between the mode menu and the palette
  with the palette at the right (a desktop or a wide tablet). Otherwise (a phone, where the menu sits in the
  palette's strip, or a narrow window) the element starts below the top row as before. The header follows the row
  as it changes (the palette's category switching its width, the window resizing). With no palette in the row (it is
  hidden, below, or the person may not edit) the header holds the menu alone, its content running on to its controls.
- **The name rides in the menu box**: while the header holds the top row, the element's name (a board's or view's
  title, a Sheet's title) moves out of its header into the menu box at the top left, after the mode menu and a hairline,
  in the chrome's own text colour, truncating past 16 rem. It is the same title: a double-click on it renames it in
  place, as in the header. The room the band needs is measured from the menu box without the name, so the name
  coming or going never takes the band away. Without a band (a phone, a narrow window) the name stays in the header.
- **Zoom stands down**: while a board, view or Sheet is maximised or fills its tab, the canvas cannot zoom, so the
  bottom-right zoom controls (Zoom out, the zoom level and its menu, Zoom in, and a phone's Fit) stay where they
  are but are disabled, each hover card saying why: "Zoom is off while a board, view or sheet fills the canvas." They
  come back the moment it is restored.
- **Five slots across**: maximised (or filling its tab), a column slot is a fifth of the board's body
  (`MAXIMISED_BOARD_SLOTS`), never narrower than a column's floor (220 px a slot, so a phone scrolls sooner); a column
  set wider takes its slots and the gaps between them. A board of five slots or fewer fills the width as on the
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
  - A board **filling its tab** ([Fill Tab](#fill-tab)): the palette (on a phone too) opens on Plan's **Cards** and its
    category picker lists Cards alone, whatever the mode, since a card is the one thing that lands on the board.
  - A Sheet **filling its tab**: the palette is hidden altogether (nothing it offers can land anywhere); on a phone,
    where the menu shares the palette's row, the menu stays.
  - Anything **maximised** (a board, view or Sheet, the person's own view for a moment): the palette is the mode's
    as usual. Picking a tile that is not a card (pressing it, not dragging it) restores the element first, so the
    tool is ready on the canvas it is meant for; a card tile keeps it maximised (onto a board, a card is dropped).
  - The category the person had stays chosen underneath and is back the moment the element stops filling the tab.
- **Nothing under it moves**: while a board is maximised (or fills its tab), the canvas takes no input that would
  change it. A cover over the whole canvas area (the board sits in it at its insets) takes every press, double-click,
  right-click and wheel around the board, so nothing is selected, dragged, marqueed, resized, drawn, panned or
  zoomed, by any tool; a press on the board itself is the board's alone, never also a canvas gesture. The canvas's
  own keyboard shortcuts stand down (no arrow nudge, Delete, select-all, duplicate, lock, z-order, zoom, paste or
  tool key; the chords the browser would take over, Cmd+D and Cmd+A among them, are prevented), while undo and redo
  (Cmd+Z, Cmd+Shift+Z, Ctrl+Y), search (Cmd+K), zen (Z), the mode switch (Shift+D), Escape, the chrome (header, tab
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
- It is a view for the person alone, like zen mode: the board element keeps its size and place, nothing is
  saved or sent to anyone else, and nothing enters undo. Collaborators see the board as it is on the canvas.
- It ends on its own when the board leaves the screen: switching tab, the board being deleted (by anyone), or
  leaving Plan mode. A zen mode the person had on before stays on after Restore.
- One board at a time: maximising another board (there is no way to reach one while maximised) is not offered.
- It works the same on a phone and a tablet: the board fills the canvas area, and its body scrolls.
- Telemetry: `Plan / Toggled / BoardMaximised` and `Plan / Toggled / BoardRestored`.

## Fill Tab

A board can be set to **fill its tab**: the tab becomes the board, for everyone, every time the tab is shown. Named
**Fill Tab** (what it does to the tab, in two words, beside Maximise, which is one person's view for a moment). A
Sheet fills its tab by the same rules, set from its Sheet Settings ([Fill Tab](../029-sheets/sheet.md#fill-tab)).

- **Stored on the board** (`fillTab: true` on its set-up; absent is off), so it syncs to collaborators, survives a
  reload and is undone like any board edit.
- **Where it is set**: the **Board Setup** section (the element menu's Board, and the board's cog) holds a **Fill
  Tab** group (info note: "The board always fills this tab, so the rest of the canvas can't be used.") with two
  rows in an [option list](#option-lists), **On Canvas** and **Fill Tab**, the current one ticked; and the Setup Board wizard's Layout step (above).
  Only someone who may edit sees either. It is offered on every board, All Cards and Archive boards included.
- **Turning it on deletes everything else on the tab's canvas**: every other element (shapes, notes, arrows, other
  Plan boards, Plan cards and views, locked elements and those on hidden or locked layers too, since nothing under
  the board could be reached again). When there is any, the menu (or a phone's settings sheet) closes and a confirm (the shared confirm dialog) says
  so first:
  "Fill the Tab with {Title}?", "The rest of this canvas becomes unusable, and its N other elements will be deleted
  (M of them locked). Undo brings them back.", **Delete and Fill Tab** / **Cancel** (the board's set-up is read as it is when the change is made, so an edit
  made while the confirm was open is kept) (the locked clause only when
  some are). On an otherwise empty tab it applies at once. Cards (items) are not elements: they are never deleted by
  this, and a card whose board was deleted reads as its state does with no board ([A state no board
  names](#a-state-no-board-names)).
- **One undo step**: the deletion and the setting are one change, so one undo brings every element back and the
  board back onto the canvas. Turning it off is a board edit too (nothing comes back but the canvas).
- **Filled**: whenever the tab is shown (opening the document, switching to the tab, a reload, a collaborator's or
  a share link's view), the board is drawn over the canvas area as a maximised board is, in every mode (Plan mode
  works on it as on the canvas; in Diagram or Draw mode it reads as a board does outside Plan mode, and switching
  to Plan mode works on it). The editor's header, tab bar, footer, palette and panels stay, so the person can move
  between tabs and modes; the board sits clear of them as a maximised board does. It appears at once (no grow).
  The board's **Maximise/Restore** button is hidden, and Escape does not restore it; nothing un-fills it but
  turning Fill Tab off. Presses, wheel and right-click on it stay on the board, so the canvas under it is never
  selected, panned, zoomed or menu'd; the board element's own menu is reached through its cog (Board Setup) while
  it fills the tab.
- **Turning it off** (the On Canvas row, or the wizard run again) puts the board back on the canvas, where it was,
  and the normal Maximise/Restore comes back. A person who had the board maximised when Fill Tab came on is
  released from the maximise at once.
- **Two boards (or Sheets) set to fill one tab** (an agent's or a collaborator's write, a paste): the first in canvas
  order (element order) fills it; the others stay under it, unseen.
- **Elements added while it is on** (a collaborator or their agent, a palette shape dropped on the board; this person's own paste and tool keys stand down)
  are **hidden, not blocked**: they are kept in the tab under the board, unseen and unreachable, until Fill Tab is
  turned off, and they count among the elements deleted if it is turned on again. Blocking would need every add
  path (the api, agents, paste) to know the rule; hiding needs none, and nothing is silently lost.
- **A locked tab**: its edits are refused as every edit there is, so the setting cannot change; a tab locked while
  filled stays filled. **Read-only viewers and share links** see the board filled and cannot toggle it.
- **Slides and presenting**: a slide of the board shows the board as a slide does, not filled; presenting covers
  the screen with the slide anyway.
- **The board deleted** (by anyone, or by an undo past its creation): nothing fills the tab, and the canvas is back.
- Telemetry: `Plan / Toggled / FillTabOn` and `Plan / Toggled / FillTabOff`, fired when the change is made (before
  it is written), from the menu and the wizard alike.

## The Plan card

- Draws one item's card face at the element's size, with the item type's colour; resizes like a box.
- Has its own **Card Size** (Minimal, Compact or Detailed, the board's three; Detailed when unset), set from the
  **Card** flyout of its element menu (a collapsible **Card Size** row, closed until opened, as every menu row is), one undoable element edit (`planCard.size`, Detailed stored as absent). Its
  card type's Display decides what shows at each size, as on a board. Exports and images draw its face as they do
  today, whatever its size. Telemetry: `Plan` · `Changed` · `PlanCardSize`.
- A double-click or double-tap opens the item panel, in every mode; a single click or tap only selects it, as for
  any element. Two presses at one spot within the double-press window count (`usePressWithoutDrag` with
  `requireDouble`), not the browser's `dblclick`, so a tap works as a click does. A press that travels past the press
  slop moves the card and counts for nothing.
- When its item is not in the document's store (deleted, or the tab came from another document) it draws "Item
  not found" in a dashed outline and offers to remove the card.

## A state no board names

- A card's state belongs to the columns that name it. When the last board or column naming a state goes, its
  cards read as **No status** everywhere: their board rows and lanes, the Card Search and Cards panel, a card's
  linked and child cards, its slide, the Gantt chart's state, the plan views' counts and the card's own
  **Status** picker (which never offers a raw state id). The card keeps the state itself, so undoing the
  board's or column's removal puts every card straight back; picking a state in the card's panel settles it, and an empty board still offers the
  state (by its name) for its first column, which brings its cards back (`namedStatus`). The Trash says where a card came from only while
  that state still has a column.

## On a phone

- A finger on a board's empty space (between and below cards, column backgrounds) pans the canvas, as it does
  anywhere else, whatever the tool: it never selects or moves the board, and holding it opens no menu. Only the
  board's header moves the board, as with a mouse. A finger on a card picks the card up, and buttons and fields
  work as they do with a mouse. Held still on a card (`LONG_PRESS_MS`), a finger opens the card's menu at the
  finger, as a right-click does, for someone who may edit; lifting it then neither opens the card nor drags it.
- A tap on a column's header (not its cog) frames that column: the view glides to fit it, header to the board's
  foot, below the top strip, as a tap on a page does in Illustrate (`frameBoardColumn`). Not while the board is
  maximised.
- A board's header buttons (the ⋯, the settings cog, Maximise) stay on screen: when the board runs past the
  canvas's right edge (zoomed in on a phone, or panned), they slide left to stay 8 px inside it, on the board's
  surface with a shadow so they read over the header, never past the board's own left edge
  (`useKeepOnScreen`). Elsewhere (a board on a slide) they stay where they are.
- A board's body does not scroll under a finger (a native scroll would cancel a card's drag); a board with more
  cards than fit is made taller, or scrolled with a mouse or trackpad.

## Theme and style

- A board and a Plan card follow the tab's theme and their own style, like any shape: a theme stamps their fill,
  stroke and text colours when they are made and rewrites them on a theme switch, and Quick Style, the colour
  pickers and the style presets set them. The board's fill is its surface, its stroke its border and focus
  colour, its text colour its ink; columns, cards, card borders and muted text are mixed from those. Ink that
  would not read on the fill is swapped for a readable one. With no colours of their own (the Default theme)
  they take the canvas surface's neutral set, light or dark.
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
  document's items, without the interactive controls.
- Read-only visitors see the board and open items read-only; they cannot drag, add or change set-up.
