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
| **unplaced**     | Items the board's scope matches whose status is none of its columns                    | orphans, hidden           |
| **scope**        | Which items a board shows: by type, by label, or all                                   | filter (that is a view's) |
| **quick filter** | A person's own, unsaved narrowing of what a board shows ("Only mine", a search)        | scope                     |
| **face-down**    | A card drawn as its colour and author only, while its board hides writing              | hidden, private           |

## The board set-up

Stored on the element, shared by everyone, undone like any element edit:

- **Title**: shown in the board's header.
- **Columns**: each a **status** value and a display name, an optional **WIP limit** and an optional colour. A board
  has 1 to 12 columns. The first column is where new items land when no column is chosen.
- **Done column**: optionally one column is marked done: its cards draw muted and count as finished in the
  header's progress.
- **Swimlanes**: none, or grouped by assignee, type, priority or parent.
- **Scope**: all items, or only these types, or only items carrying a label.
- **Card shows**: which fields a card face draws (key, type, assignee, priority, labels, estimate, due, votes,
  checklist progress). Title always shows.
- **Voting**: off, or on with an optional number of votes each person may spend on this board.
- **Hide writing**: off, or on: each person's cards on this board are face-down to everyone else until the board
  is revealed. It hides the face, not the data; it is a facilitation aid, not a privacy boundary.

## What the board shows

- **Header**: title, the count of items shown, a progress bar (done of all, when a done column is set), the
  avatars of people on the board, the quick filter and the set-up button.
- **Columns**: name, count, and the WIP limit as `3 / 4`. Over the limit, the count turns to a warning colour and
  the column header says so; it never refuses a card.
- **Cards** in rank order. A card face draws the item type's colour stripe and glyph, the key (`#12`), the title
  (up to three lines), then the fields the set-up shows. A card being dragged or opened by someone else carries
  their colour ring and name.
- **Swimlanes**: a labelled row per group (an assignee's avatar and name, a type's glyph), "No assignee" last.
  Each swimlane collapses on its own, per person.
- **Unplaced**: when items in scope have a status no column shows, the header says "3 not on this board"; opening
  it lists them, each with "Move to" a column.
- **Empty**: a board with no items shows, in its first column, "Add your first item" with the add field open
  for anyone who can edit.
- **Too many**: a column scrolls inside itself past the board's height; the board never grows on its own.

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
- **Drag a card off the board** onto the canvas to leave a Plan card there; the item stays on the board too.
  **Drag a Plan card onto a board** to move its item into the column it lands on; the Plan card goes away.
- **Add an item**: each column ends in "Add item". Typing a title and pressing Enter makes the item and keeps the
  field open for the next one; Escape closes it. The title may carry **quick tokens**: `@name` assigns,
  `#label` labels, `!high` (or `!urgent`, `!medium`, `!low`) sets priority, `~3` estimates, and a leading
  `bug:` (any type name) sets the type. Each token turns into a chip as it is recognised.
- **Open an item**: clicking a card opens the **item panel** beside the canvas. Every field of the item's type
  is edited in place and saved as it changes; the panel shows who made the item and who last changed it. It
  closes with Escape or the close button, and follows the item if someone else moves it.
- **Vote**: on a voting board each card has a vote control; a person sees their own votes and the total. With a
  vote budget the header shows the votes left.
- **Reveal**: on a board hiding writing, anyone who may edit can press **Reveal**; every card turns face up for
  everyone, and the set-up's Hide writing turns off.
- **Set-up**: the set-up button opens the board panel: title, columns (add, rename, recolour, reorder, set WIP,
  mark done, remove), swimlanes, scope, card fields, voting and hide writing. Removing a column with cards asks
  where they go.

### Keyboard

With focus on a card: arrow keys move focus between cards; Enter opens the item; **Shift+Left/Right** moves the
card to the previous or next column; **Shift+Up/Down** moves it within the column; Delete deletes the item
(undoable); **N** starts a new item in the card's column. Every move is announced ("#12 moved to In progress,
position 2 of 4").

## The Plan card

- Draws one item's card face at the element's size, with the item type's colour; resizes like a box.
- Clicking it (in Plan mode) or double-clicking it (other modes) opens the item panel.
- When its item is not in the document's store (deleted, or the tab came from another document) it draws "Item
  not found" in a dashed outline and offers to remove the card.

## Both elements everywhere

- Both are general-tab elements: they exist in every mode and in exports, and only input differs by mode.
- In exports, thumbnails and api or MCP images the board draws its header, columns and card faces from the
  document's items, without the interactive controls.
- Read-only visitors see the board and open items read-only; they cannot drag, add or change set-up.
