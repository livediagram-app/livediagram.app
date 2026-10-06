# Plan board

A **Plan board** is one element on the canvas that frames the document's [items](items.md) as columns of cards:
a Kanban board, a sprint board, a retro. The board holds only its **set-up** (its columns, how it groups, what it
shows); the cards on it are drawn from the item store. Moving a card changes the item, so every other board that
shows the item, and every collaborator, sees it move.

A **Plan card** is one item placed on its own anywhere on the canvas, for example beside the part of a diagram it
is about.

## Domain language

| Term             | Means                                                                                  | Never called              |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------- |
| **Plan board**   | The `plan-board` shape: a board set-up drawn with the items it matches                 | Kanban element, board tab |
| **Plan card**    | The `plan-card` shape: one item on the canvas                                          | ticket element            |
| **board set-up** | The board's stored configuration (`planBoard` on the element)                          | board config, settings    |
| **column**       | One status the board shows, left to right                                              | lane (lanes are elements) |
| **swimlane**     | One row of the board, grouping its cards by a field (assignee, type, priority, parent) | lane, row                 |
| **WIP limit**    | The most cards a column should hold                                                    | cap, max                  |
| **unplaced**     | Items whose status is none of the board's columns                                      | orphans, hidden           |
| **quick filter** | A person's own, unsaved narrowing of what a board shows ("Only mine", a search)        | filter setting            |
| **face-down**    | A card drawn as its colour and author only, while its board hides writing              | hidden, private           |

## The board set-up

Stored on the element, shared by everyone, undone like any element edit:

- **Title**: shown in the board's header.
- **Columns**: each a **status** value and a display name, an optional **WIP limit** and an optional colour. A board
  has 1 to 12 columns. The first column is where new items land when no column is chosen.
- **Done column**: optionally one column is marked done: its cards draw muted and count as finished in the
  header's progress.
- **Swimlanes**: none, or grouped by assignee, type, priority or parent.
- **Card shows**: which fields a card face draws (key, type, assignee, priority, labels, estimate, due, votes,
  checklist progress). Title always shows.
- **Voting**: off, or on with an optional number of votes each person may spend on this board.
- **Hide writing**: off, or on: each person's cards on this board are face-down to everyone else until the board
  is revealed. It hides the face, not the data; it is a facilitation aid, not a privacy boundary.

Where each is set, so a setting lives with what it changes, never in one central panel:

- **A column's own settings** sit on the column: a cog at the far right of its head (shown on hover and focus,
  always on a touch screen) opens a small popover (a sheet on a phone) with its **name**, **colour** (none or
  one of eight), **WIP limit**, **Counts as Done**, **Move Left** / **Move Right**, **+ Add Column After** and
  **Remove Column**. Removing a column with cards first asks where they go (**Move and Remove**, or **Keep
  It**); the board's last column cannot be removed. Each change applies as it is made.
- **The board's own settings** sit in its element menu (right-click the board, or the selection's ⋯), in two
  flyouts: **Board** (**Title**; **Swimlanes**: No Swimlanes, By Assignee, By Card Type, By Priority, By Project, By Status;
  **Add to Slides**, the whole board as a slide, [Presentation mode](../012-collaboration/presentation-mode.md#board-slides)) and
  **Cards**: the **Card Size** (Minimal, Compact or Detailed, below) and what each card face shows besides its
  title, a tile per field pressed on or off. A field the chosen size cannot draw keeps its setting but its tile is
  dimmed, so the tiles always say what the cards show. New columns come from a column's **+ Add Column After**.
- **New cards a board takes**: the Cards menu's **New Cards Can Be** row, a tile per card type pressed on or off
  (at least one stays on). Add Card offers only those types, and the palette refuses another ("This board takes
  Note, Idea and Action cards"). A card of another type that reaches the board (dragged, or by status) still shows.
  Defaults: Retro, Note and Idea (an action is tracked on a board of its own); Sprint, Task and Action; Bug Triage, Task; Roadmap, Project; Kanban and
  Week, Task, Action and Note; Blank and All Cards, every type.
- **A board with no columns** (the Blank board starts so) shows, in place of its columns, "No columns yet" and a
  field to name the first; Enter or **Add Column** makes it. Every new column gets a status of its own (its name
  and a short suffix), so it starts empty.
- **Every board shows every card**: there is no per-board filter by type or label; a board shows every item whose
  status is one of its columns, and counts the rest as not on it.
- **A board placed from the palette starts empty**: its columns get statuses of their own (the column's status
  and a short suffix, `todo~k3f9`), so no card the document already has lands on it. Boards from a template keep
  the template's statuses, and come with no cards. A board starts wide enough for every column side by side at
  its narrowest (220px a slot, with the gaps between), never narrower than its default, so no new board scrolls. Archive and All Cards boards show cards by what they are, not by
  status, and keep their columns.
- **Voting** and **Hide writing** come with a board's template (the Retro's are on); they have no menu control.

## What the board shows

- **Header**: title, the count of items shown, a progress bar (done of all, when a done column is set), the
  avatars of people on the board and the quick filter.
- **Move handle**: while a board is selected, a grip before its title shows where to take hold of it: the
  header (and the empty part of its widget row) moves the board; columns and cards do not.
- **Columns**: name, count, and the WIP limit as `3 / 4`. Over the limit, the count turns to a warning colour and
  the column header says so; it never refuses a card.
- **Column width**: a column is one slot wide, or two or three (its cog's **Width**); the slots share the board's
  width, so a wide column suits a busy stage.
- **Columns fill the board**: a board resized taller runs its columns to its bottom edge (on a board with
  swimlanes, the last open swimlane takes the spare height); a board shorter than its cards scrolls.
- **Cards** in rank order, at the board's **card size**. Every card carries the item type's colour stripe; a card
  being dragged or opened by someone else carries their colour ring and name. Of the fields the set-up shows:
  - **Minimal**: the title (two lines at most) and nothing else, but the vote control on a voting board.
  - **Compact**: the type's glyph beside the title (two lines at most), over one line of the number, the
    priority (a dot), the due date, votes and the assignee's avatar.
  - **Detailed** (the default): the type and number with a priority chip, the title (three lines), the project it
    sits under, two lines of its description, custom fields shown on cards, up to four labels, a checklist
    progress bar, then a footer of the due date (red once past, unless done), the estimate, votes and the
    assignee's first name and avatar.
  - The fields are Number, Type, Assignee, Priority, Labels, Estimate, Start Date, Due Date, Votes, Checklist,
    Description and Project; Compact draws Number, Type, Assignee, Priority, Start Date, Due Date and Votes. A
    start date reads "From 1 Oct", muted.
- **Swimlanes**: a labelled row per group (an assignee's avatar and name, a type's glyph), "No assignee" last.
  Each swimlane collapses on its own, per person.
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
  the **Add a Card** popover (a bottom sheet on a phone), as Illustrate's + opens "Add a page": a tile per card
  type the board shows, each its glyph on a tint of its colour and its name; choosing one adds a card of it
  ("New task"...) at the end of the cell, in the cell's row (taking the row's field). Arrow keys move between the
  tiles; Escape or an outside press closes it. There is no typed title: the card is titled in place or in its
  panel.
- **Right-click a card** for its menu: **Open**, **Duplicate** (a copy right after it, without its votes),
  **Archive** (or **Restore**; [Items](items.md#archive)),
  **Add to Slides** (an item slide, [Presentation mode](../012-collaboration/presentation-mode.md#item-slides)),
  **Move to** another column of the board, and **Delete** (undo brings it back). Someone who may only view gets
  Open alone; a face-down card has no menu.
- **Open an item**: clicking a card opens the **item panel**, a wide modal over the canvas. Every field of the
  item's type is edited in place and saved as it changes, except votes, which live on the card face only. It
  closes with Escape or the close button, and follows the item if someone else moves it.
  - **Header**: the type (a picker, with its glyph), the key, **Help** (the `?` with a small label), a **⋯** menu
    of **Duplicate** (a copy right after it, without its votes, as the card menu's), **Archive** (or **Restore**)
    and **Delete**, as icon-left rows, then the close button. Someone who may only view gets no ⋯.
  - **Parent**: once set, an **Open** button beside it opens the parent in the panel.
  - **Labels** are coloured chips in one field (each label keeps its colour everywhere), with the document's
    other labels offered as it is typed in; Backspace in an empty field takes the last one off.
  - **Checklist**: a progress bar and "2 of 5" over its steps; each step's text is edited in place, ticked with
    a rounded box, and taken off with ×; **Add a step** keeps its place for the next.
  - **Main column**: the title, large, then the type's tabs (see [Item types](item-types.md)) and the fields
    of the chosen tab. The **Description** is rich text: bold, italic, underline, strikethrough, size, colour,
    headings and links, and **bullet** and **numbered lists** from their own toolbar buttons, from a toolbar over
    it or the usual shortcuts. Enter on a list item starts the next one; Enter on an empty item ends the list.
    It reads as text until clicked (hovering shows **Edit**); an empty one is a dashed **Add a description**
    invitation. Editing, it sits on a raised surface with the shortcuts beneath and **Saving…** then **Saved**;
    focus leaving it, or Escape, returns it to reading.
  - **Details panel** on the right: the fields in no tab, as label and value rows (Status first, as a coloured
    picker), then who made the item and who last changed it.
  - **On a phone** it is a sheet of one column, as tall as a sheet goes (85% of the screen): the title, then a tab bar whose first tab is
    **Details** (the side panel's fields), then the type's tabs.
- **Vote**: on a voting board each card has a vote control; a person sees their own votes and the total. With a
  vote budget the header shows the votes left.
- **Reveal**: on a board hiding writing, anyone who may edit can press **Reveal**; every card turns face up for
  everyone, and the set-up's Hide writing turns off.
- **Set-up**: a column's cog, and the board's element menu (above, "The board set-up").

### Keyboard

With focus on a card: arrow keys move focus between cards; Enter opens the item; **Shift+Left/Right** moves the
card to the previous or next column; **Shift+Up/Down** moves it within the column; Delete deletes the item
(undoable); **N** opens the Add a Card popover for the card's cell; the context-menu key opens the card's menu. Every move is announced ("#12 moved to In progress,
position 2 of 4").

## The Plan card

- Draws one item's card face at the element's size, with the item type's colour; resizes like a box.
- Clicking it (in Plan mode) or double-clicking it (other modes) opens the item panel.
- When its item is not in the document's store (deleted, or the tab came from another document) it draws "Item
  not found" in a dashed outline and offers to remove the card.

## On a phone

- A finger on a board's empty space (between and below cards, column backgrounds) pans the canvas, as it does
  anywhere else; a finger on a card picks the card up, and buttons and fields work as they do with a mouse.
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

## Both elements everywhere

- Both are general-tab elements: they exist in every mode and in exports, and only input differs by mode.
- In exports, thumbnails and api or MCP images the board draws its header, columns and card faces from the
  document's items, without the interactive controls.
- Read-only visitors see the board and open items read-only; they cannot drag, add or change set-up.
