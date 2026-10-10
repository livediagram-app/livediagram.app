# Sheet

A **Sheet** is a spreadsheet on the canvas: one tab of a workbook, as a person knows it from Google Sheets or
Microsoft Excel. It is placed from Plan mode's **Sheet** palette category (under the **Spreadsheets** heading), moved and resized like a
[Plan board](../026-plan/plan-board.md), and maximised like one. Its cells are not stored on the canvas: the
element frames one sheet of the document's [sheet store](sheet-store.md), and the [formulas](formulas.md) in its
cells are worked out in every browser that shows it.

## Domain language

| Term              | Means                                                                                      | Never called             |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| **sheet**         | One grid of cells with a title, in the document's sheet store, framed by one Sheet element | spreadsheet, table, grid |
| **Sheet element** | The canvas element (`plan-sheet`) that frames a sheet; in the interface, **Sheet**         | sheet widget             |
| **cell**          | One square of the grid, named by its column letter and row number (`B4`)                   | field, box               |
| **input**         | What a cell holds as typed: a number, text, a true/false or a formula; stored              | raw value, source        |
| **value**         | What a cell shows: its input, or the result of its formula; worked out, never stored       | result (the formula's)   |
| **format**        | How a cell is drawn: its number format, font style, colours, alignment, wrap and borders   | style (an element's)     |
| **range**         | A rectangle of cells, `A1:C5`, or whole columns `A:C` or rows `2:4`                        | area, block              |
| **selection**     | The range a person has picked, with its **active cell** (where typing goes)                | focus                    |
| **Spreadsheets**  | The heading of Plan mode's palette over the **Sheet** category, which holds the Sheet tile | Spreadsheet band         |
| **the grid**      | The rows and columns a sheet has, filled or not (100 × 26 to start)                        | size, dimensions         |

- A **table** stays the canvas's own element (`table`), whose cells are plain text on the element; a sheet is
  never called a table.
- **Sheet** alone, in this folder, always means the sheet; the element is the **Sheet element** where the two
  differ.

## Placing a sheet

- Plan mode's palette offers the **Sheet** category under its own **Spreadsheets** heading, after the **Boards &
  Cards** heading, holding one tile, **Sheet** (a small grid with a header row and a highlighted cell; "A spreadsheet tab: cells, formulas,
  formatting, sort and filter").
- Pressed, then placed (or dragged and dropped), it puts a Sheet element of 960 × 560 on the canvas, its top left
  at the drop point, as a board is placed. The new sheet is empty: 100 rows by 26 columns (A to Z), titled
  **Sheet 1** (or the next free number on the tab: **Sheet 2**, ...).
- Dropping a `.csv` file on the canvas in Plan mode places a sheet filled from it, titled by the file's name
  (CSV, below).
- Placing one sends `Element · Added · PlanSheet`.
- The [Plan tour](../026-plan/plan-tour.md)'s Spreadsheets track places its own **Example Sheet**, already set up
  (Budget, Header look, header frozen) and never awaiting setup; it sends no event and is no undo step.

### Setup Sheet

- A sheet placed from the palette starts **awaiting setup** (`layout.setupPending`); a dropped CSV, a copy and a
  sheet an agent makes do not. While it awaits setup and has no cells, in Plan mode, someone who may edit sees a
  **Setup Sheet** card in place of the grid (the header, cog and Maximise stay), as a new board shows Setup Board:
  the card in the Sheet's colours (a sheet glyph, "Setup Sheet", "Start from a layout, your cards or a blank grid.
  Everything can change later from its cog.", Help), with Setup Board's wizard stepper: **Start From**, then **Style** (Plan Cards adds **Cards** and **Columns** between). Someone who may only view
  sees the empty grid.
- **Start From**: an option list ([Option lists](../026-plan/plan-board.md#option-lists)), a row per start with its
  glyph, name and line, **Blank** chosen to start:

| Start      | Line                                 | Fills                                                                                       |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| Blank      | An empty grid                        | Nothing                                                                                     |
| Plan Cards | Your cards as rows, linked both ways | A header of the chosen fields, then a row per card found, by number                         |
| Budget     | Items, amounts and a total           | Item, Category, Amount; four rows; a **Total** row `=SUM` of the amounts (two decimals)     |
| Tracker    | Tasks, owners, status and due dates  | Task, Owner, Status, Due; three rows, the dates a week apart from today                     |
| Timesheet  | Days, hours and a weekly total       | Day, Project, Hours; Monday to Friday; a **Total** row `=SUM` of the hours                  |
| Contacts   | Names, emails and phone numbers      | Name, Email, Phone, Company; two rows                                                       |
| Import CSV | A .csv or .tsv file                  | Next reads **Choose File…**: the file picker; the file fills the sheet (CSV) and setup ends |

- Plan Cards (offered when the document has live cards) adds two steps after Start From: **Cards**, the Cards panel's
  own search with its filters in the box ([Finding a card](../026-plan/items.md), Card Type always offered) with a
  count ("12 cards", "No cards match"; Next waits for one) and, under it, the first 10 cards found by number (each its
  type's glyph, number, title and state; only to look at, nothing opens) and "and N more", then **Columns**, an on-or-off option list of the fields the cards found can fill: Number,
  Title, Type and State (always included, locked on, "Always included"), then the built-in fields their card types have
  (Assignee, Priority, Estimate, Start, Due, Labels) and their custom fields by name. A column chosen and then filtered
  out is dropped. The rows are a card table, linked both ways (Card tables, below), and the sheet is the table:
  its columns end at the table's Controls column (the empty ones past it, which no card would read, are removed;
  the header menu can still insert one). At most 500 cards.
- **Style**: an option list of looks, each row a small drawn preview, its name and line: **Header** (the first row
  bold on a tinted fill; the default), **Banded** (Header, and every other row tinted), **Boxed** (Header, and thin
  borders round every filled cell), **Minimal** (the first row bold, gridlines off), **Plain** (no fills). A start without rows (Blank) styles nothing but
  gridlines and sizes. Then **Cell Size**, an option list: **Compact** (100 × 24), **Default** (120 × 28), **Roomy** (160 × 36), then **Freeze Header Row**, a switch row (on; not shown for Blank). Tints follow the canvas
  surface at the moment of setup (light or dark) and stay as set.
- **Next: Style** moves on; **Back** returns with nothing lost; **Start Blank** (step 1) ends setup with the empty
  grid. **Create Sheet** writes the start, the look, the freeze and the sizes as one change, one undo step, and the
  sheet no longer awaits setup. The grid then selects A1. Telemetry: `Sheet · Created · <Start>` (`Blank`, `Budget`,
  `Tracker`, `Timesheet`, `Contacts`, `Cards`; `Csv` counts choosing Import CSV, `Imported · Csv` the file read).
- Plan Cards makes the rows a **card table**: the rows are the cards (Card tables, below).
- Any cell arriving (a peer, an agent, an undo) puts the card away; a sheet cleared later does not show it again.

## The Sheet element

- It is a general-tab element: it exists in every mode and in exports; only input differs by mode, as for a board.
- It is drawn top to bottom as: the **header** (the sheet's title, the **Sheet Settings** cog and **Maximise Sheet**), in Plan mode
  for someone who may edit the **toolbar** and the **formula bar**, and the **grid** (column letters across the top,
  row numbers down the left, the cells).
- The element's frame is a window onto the grid: a sheet larger than its frame scrolls inside it (a mouse wheel,
  a trackpad, the scrollbars), with frozen rows and columns staying put. The scroll is the person's own, never
  saved or sent.
- It moves by its header and resizes by its handles, like a board; its grid takes the pointer in Plan mode.
- Its look follows the tab's theme as a board's does: the theme's board colours make its surface, header, grid
  lines and ink; a cell's own colours draw over them. Quick Style, colour pickers and style presets set the
  element's colours; corners follow Corners (12 px by default).
- A selected Sheet element has no quick-connect pluses.
- **Loading**: until its cells arrive, the frame and title show the site's loader in a Sheet's form, the opening
  screen's look ([New document route](../007-editor/new-document-route.md)): the shared **SheetBuildAnimation** (the
  same "You" cursor and timing as DiagramBuildAnimation, typing numbers into a small table, a bar growing beside each,
  then a total), **Opening Sheet** and the progress sweep. Reduced motion shows the finished table, still. A sheet
  that cannot load says "Couldn't load this sheet" (**Try Again**); one no longer in the document says so (**Remove**,
  for an editor), both over skeleton grid lines.

### Header

- The title, in the header's left after the Sheet's glyph (in the focus colour), is edited in place (a double-click on it or the header's empty space in Plan
  mode, as a board's, or the **Title** field in Sheet Settings), its text selected: up
  to 60 characters, unique on the tab (a taken title is refused: "Another sheet on this tab is called that").
  Renaming changes every reference to it in the tab's other sheets ([Formulas](formulas.md#other-sheets)).
- The header's buttons end **Focus** ([Focus](../026-plan/plan-board.md#focus)), **Maximise Sheet**, then the cog at the far
  right; a Sheet filling its tab has neither Focus nor Maximise ([Fill Tab](#fill-tab)).
- The **Sheet Settings** cog (a settings glyph, with a tooltip, in Plan mode) opens a popover of collapsible
  sections, one open at a time, as a board's Board Settings ([Sheet Settings](#sheet-settings)). The element's own
  Style, Duplicate and Delete are the canvas selection's, as a board's are; deleting a Sheet
  deletes its sheet, asked first ([Deleting a sheet](sheet-store.md#deleting-a-sheet)).
- **Maximise Sheet** (a maximise icon, with a tooltip) sits at the header's right, before the cog ([Maximised](#maximised)).

### Sheet Settings

| Section       | Holds                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sheet Setup   | **Title** (as a rename), **Import CSV…**, **Download CSV**, **Setup Sheet** (an empty sheet only: its setup card again), **Clear Sheet** (a sheet with cells; asks first: "Start Sheet 1 over? Every cell, format and setting goes, and Setup Sheet shows again. You can undo this.": every cell and format, sizes, hidden lines, freeze, merges, filter, card tables and the look back to the defaults, awaiting setup again, one change and one undo step) |
| Sheet Options | **Gridlines** and **Row and Column Headers**, each a switch, both on by default; then **Fill Tab** ([Fill Tab](#fill-tab))                                                                                                                                                                                                                                                                                                                                   |
| Cells         | **Column Width** and **Row Height** for lines not sized on their own (120 and 28 by default), **Reset to Default**                                                                                                                                                                                                                                                                                                                                           |
| Freeze        | **Frozen Rows** and **Frozen Columns** (someone who may only view does not see it)                                                                                                                                                                                                                                                                                                                                                                           |
| Calculations  | Which totals the status bar shows (Sum, Average, Count, Min, Max)                                                                                                                                                                                                                                                                                                                                                                                            |
| Named Ranges  | Each name with its range, **Go To** and **Remove** ([Named ranges](#named-ranges))                                                                                                                                                                                                                                                                                                                                                                           |

- Sheet Setup opens first. The same sections are the element menu's **Sheet** flyout (right-click the Sheet), as a board's
  settings are its Board flyout, acting on the same sheet. Numbers apply on Enter or leaving the field, kept within the limits (a column
  20 to 2,000 px, a row 16 to 2,000 px, frozen lines as Freeze's); Escape closes the popover without saving.
- Everything but the totals is the sheet's own: saved, seen by everyone, and one undo step each. A sheet without
  headers starts its cells at the frame's edge; without gridlines only fills and set borders show. Exports and
  images draw the same.
- The totals pick is the viewer's own, kept in their browser and shared with the status bar's menu.
- Someone who may only view sees the title (read only), **Download CSV** and the totals.

### Toolbar

One row, shown for someone who may edit, in Plan mode: on its left a **category switcher** (the palette's own
category dropdown, in its toolbar style, a tile grid), and to its right the chosen category's buttons only:

| Category  | Buttons                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text      | **Bold**, **Italic**, **Underline**, **Strikethrough** · **Text Colour** (a quick row of the one [colour picker](../004-interface-design/colour-picker.md): the Theme Palette's first five, the cell's picked, and **More Text Colours** (the four-dot glyph) for the full picker) · **Font**, **Font Size** (· a divider)                                                                                                                                                                                           |
| Cells     | **Fill Colour**, **Borders** · **Align Left**, **Align Centre**, **Align Right** · **Align Top**, **Align Middle**, **Align Bottom** · **Merge Cells**, **Wrap Text** · **Clear Formatting**                                                                                                                                                                                                                                                                                                                         |
| Numbers   | **Number Format** (Automatic, Number, Percent, Currency, Accounting, Scientific, Date, Time, Date Time, Duration, Plain Text), **Fewer Decimals**, **More Decimals**                                                                                                                                                                                                                                                                                                                                                 |
| Data      | **Sort** (A to Z, Z to A, Custom Sort…), **Filter** (on or off), **Freeze** (rows, columns)                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Charts    | **Bar Chart**, **Line Chart**, **Pie Chart** ([Charts](#charts))                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Functions | A menu per family of functions, **Maths**, **Statistics**, **Logic**, **Information**, **Lookup**, **Text**, **Date and Time**, **Arrays**, **Finance**, **Plan Cards** (named "Maths Functions" and so on: every function of the family the engine knows, each with its arguments and summary from the engine's catalogue, scrolling; a pick with several cells selected writes it over them into the cell below, `=SUM(B2:B6)`, else starts it in the active cell) · **All Functions** (shown as "All Functions…") |

- The toolbar opens on the category last picked (Text at first), for the session.
- On a desktop, a mouse resting on the switcher (about 120 ms) opens its menu, which stays open while the pointer
  moves into it and closes a moment (250 ms) after it leaves both; hovering never changes the category, only a pick
  does. Touch and the keyboard open it with a press, as before.
- `·` is a divider: each category sets its logical groups apart (Numbers: the format · the decimals; Data: Sort and
  Filter · Freeze; Functions: the five · All Functions). The everyday actions are buttons (the six alignments, pressed
  for the active cell, glyphs alone; a pressed horizontal alignment pressed again goes back to automatic, Align Middle
  is the default); only the rarer ones (Fill Colour, Borders, Merge Cells, Wrap Text, Number Format, Sort, Freeze)
  open a menu.
- Switching category cascades the new buttons in (the shared cascade, a small rise and fade a beat apart, within the
  motion budget; still under reduced motion); the toolbar's first paint does not animate.
- Buttons are glyphs with the shared Tooltip (never a native title); when every button of the category fits with
  its name beside it (a wide Sheet on a desktop), the names show and the tooltips are dropped. On a phone, or when
  they would not fit, glyphs alone; buttons that still do not fit fold from the right into a **More** (⋯) menu, so
  it never wraps.
- Each button reads the selection's active cell (Bold pressed when it is bold) and acts on the whole selection.
- Undo and Redo are the canvas's own (its controls and the keys), not repeated in the toolbar.

### Formula bar

- The **name box** shows the selection (`B4`, or `B4:D9`), or its name when the selection is exactly a named range;
  typing a reference or range there and pressing Enter selects it; typing a **name** selects that named range, or,
  for a new name, names the selection ([Named ranges](#named-ranges)). A name that cannot be one says why in a toast
  ("Names start with a letter or _, then letters, digits, _ or .", "That reads as a cell reference", "Another range on
  this sheet is called that").
- **fx** and the bar show the active cell's input (a formula as typed, a number unformatted); editing there edits
  the cell, as typing in it does. It grows to three lines for a long input, then scrolls.

## The grid

- Column headers read `A` to `Z`, then `AA`, `AB`, ...; row headers `1`, `2`, ....
- A new sheet's columns are 120 px and rows 28 px; text is 13 px in the tab's font.
- Below the last row, for someone who may edit, **Add** [100] more rows at the bottom (the number can be changed)
  grows the grid, up to its limit.
- Cells are drawn only as they scroll into view, so a sheet of thousands of rows scrolls as smoothly as a small one.
- Text runs over empty neighbours to the right (left-aligned) unless the cell wraps or clips. Numbers never run
  over: one too wide for its column shows with fewer decimals, then in scientific form, and as `#####` only when
  nothing fits.
- A cell's value is aligned by its kind unless set: numbers and dates right, text left, true/false centred.
- A cell with an error shows the error (`#DIV/0!`) in red ink; hovering it shows why ("Division by zero").

### Panning

- The cells pan (the grid scrolls under the pointer, as a hand drags paper) with: the **middle button** dragged; the
  **left button with Space held** (a bare Space in the grid waits for its release, typing a space only when no pan used
  it); the **right button** dragged (a right press that does not move still opens the menu, on release); and **one
  finger** on a touch screen (a tap still selects a cell, a second finger hands over to the canvas's pinch). A drag is
  a pan from 4 px.
- The canvas's Hand tool leaves a plain left press to the cells (Plan mode is always in Hand): a click selects and a
  drag selects a range, as on a board, where cards still drag under the Hand.
- A pan is the person's own view: nothing is saved, sent or undoable, as a scroll.
- Maximised, a finger scrolls the grid natively, with its momentum.

### Selection

- A click selects a cell; a drag, or Shift and a click, selects a range; Ctrl (⌘ on Apple devices) and a click or
  drag adds another range to the selection.
- A column header click selects the column, a row header click the row; a drag across headers selects several;
  the corner selects the whole sheet.
- The selection is drawn as a tinted range with a brand border, the active cell unshaded, with a **fill handle**
  (a small square) at the selection's bottom right. The column letters and row numbers it crosses are tinted, in
  the focus colour with an edge towards the cells; a whole selected row or column's header is solid.
- The bottom of the sheet shows, for a selection of more than one number, **Sum**, **Average** and **Count**, as a
  spreadsheet's status bar does (each name quiet, its number in ink, with a small arrow); a press on it picks which show, from those and **Min** and **Max** (the pick is the
  person's own, kept in their browser). It counts the rows a filter shows, and gives up past 100,000 cells.

### Editing

- Typing on a selected cell replaces its input; **Enter**, **F2** or a double-click edits it in place, with the
  caret at the end.
- **Enter** saves and moves down, **Shift+Enter** up, **Tab** right, **Shift+Tab** left; after a run of Tabs,
  Enter goes back to the column the run started in, one row down. **Escape** throws the edit away. A click
  elsewhere saves.
- **Alt+Enter** (⌥ Enter) adds a line break inside the cell.
- **Ctrl+Enter** saves the input into every cell of the selection.
- What is typed is read the way a spreadsheet reads it ([Formulas](formulas.md#what-a-typed-input-becomes)): `12`
  is a number, `12%` a percent, `£12` currency, `8/10/2026` a date (day and month in the person's locale order),
  `true` a true/false, `=` starts a formula, and a leading `'` keeps everything as text.
- **Delete** or **Backspace** clears the selection's inputs (formats stay); **Clear Formatting** clears formats.
- A cell holds up to 10,000 characters; the editor stops taking characters there and says so.

### Writing formulas

- Typing `=` starts a formula. While the caret is where a reference can go, a click on a cell (or a drag across a
  range, or the arrow keys) puts its reference in the formula; each reference in the formula is coloured, and the
  cells it names are outlined in the same colour.
- **F4** cycles the reference at the caret through `A1`, `$A$1`, `A$1`, `$A1`.
- A function name typed shows a list of matching functions with a line on each; Tab or Enter picks one and opens
  its bracket. Inside a function's brackets, a hint card shows its arguments, the current one bold, with an example.
- A formula that cannot be read is not saved: the cell stays in edit, the part that cannot be read is underlined,
  and a line under the editor says why ("There's a missing closing bracket").
- A reference to a cell of another sheet on the tab is made by clicking that sheet's cells while writing, or typed
  (`'Budget'!B4`).

### Keyboard

| Keys                                | Does                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Arrows                              | Move the active cell                                                                                  |
| Shift + arrows                      | Grow or shrink the selection                                                                          |
| Ctrl/⌘ + arrows                     | Jump to the edge of the filled run, or the next filled cell                                           |
| Ctrl/⌘ + Shift + arrows             | Select to that edge                                                                                   |
| Home / End                          | First / last column of the row                                                                        |
| Ctrl/⌘ + Home / End                 | `A1` / the last filled cell                                                                           |
| Page Up / Page Down                 | A screen up / down                                                                                    |
| Ctrl/⌘ + A                          | The filled run around the active cell, then the whole sheet                                           |
| Shift + Space / Ctrl + Space        | The whole row / column                                                                                |
| Ctrl/⌘ + C, X, V                    | Copy, cut, paste                                                                                      |
| Ctrl/⌘ + Shift + V                  | Paste values only                                                                                     |
| Ctrl/⌘ + D / R                      | Fill down / right from the selection's first row / column                                             |
| Ctrl/⌘ + B, I, U, Shift + X         | Bold, italic, underline, strikethrough                                                                |
| Ctrl/⌘ + ; and Ctrl/⌘ + Shift + ;   | Today's date / the time now                                                                           |
| Ctrl/⌘ + F; Ctrl + H, ⌘ + Shift + H | Find; Find and Replace (⌘ + H hides the browser on a Mac)                                             |
| Ctrl/⌘ + Z, Shift + Z, Y            | Undo, redo (the canvas's)                                                                             |
| Ctrl/⌘ + Shift + 1, 4, 5            | Number, Currency, Percent format                                                                      |
| Escape (nothing in edit)            | Ends the copy's marquee, then Find; then leaves the grid: the Sheet element is selected on the canvas |

- With more than one cell selected, **Enter** and **Tab** (and their Shift forms) walk the active cell through the
  selection and wrap. A merged cell is one cell: a clicked merge is a single cell, so Enter edits it and Tab moves
  on, never into the cells it covers.
- While the grid has focus, its keys are the grid's: the canvas's single-key shortcuts (tools, Delete for the
  element) do not fire. Escape hands the keys back to the canvas.

### Clipboard

- **Copy** puts the selection on the clipboard three ways: as the sheet's own cells (inputs and formats), as
  tab-separated text, and as an HTML table, so pasting into Google Sheets, Excel, a document or an email keeps its
  rows and columns. **Copy** and **Cut** mark the range with a dashed border, kept while the selection moves,
  until Escape, an edit, or (for a cut) the paste.
- **Paste** of the sheet's own cells puts the inputs and formats at the active cell, and formulas' relative
  references shift with them (`=A1` copied one row down becomes `=A2`). A paste of a cut moves the cells: their
  old place is cleared and every formula pointing at them follows them.
- **Paste** from elsewhere reads an HTML table (from Google Sheets, Excel, a web page: values, bold, italic,
  colours and alignment) or tab-separated, comma-separated or plain text (a line a row). Values are read as if
  typed.
- A paste into a selection larger than what was copied, whose size is a whole multiple of it, repeats it to fill.
- A paste past the grid's edge grows the grid, up to its limit; a paste past the limit is cut at it, and says so.
- **Paste Values Only** pastes values, no formulas and no formats; **Paste Formatting Only** (the cell menu)
  pastes only formats.

### Fill

- Dragging the fill handle extends the selection down, up, left or right and fills the new cells:
  - one number, text or formula is copied (a formula's relative references shift);
  - two or more numbers or dates are continued as a series by their step (`1, 2` → `3, 4`; Mondays → Mondays);
  - text ending in a number continues the number (`Item 1` → `Item 2`); month and day names continue (`Jan` →
    `Feb`).
  - Holding Ctrl (⌥ on Apple devices) while dragging copies instead of continuing a series.
- Double-clicking the fill handle fills down as far as the column beside it is filled.
- Dragging the fill handle back into the selection clears the cells it leaves.

### Rows and columns

- A header's edge is dragged to resize (a column at least 24 px, a row at least 18 px); double-clicking it fits
  the widest (or tallest) value. Several selected headers resize together.
- A header's menu (right-click, a long press on a touch screen, or the menu key): **Insert 1 Above / Below** (rows) or **Left / Right**
  (columns), as many as selected; **Delete**; **Clear**; **Hide**; **Resize…**; and on a column **Sort A to Z**,
  **Sort Z to A**. Hidden rows and columns show a small double arrow on the headers either side (**Show Column C**,
  **Show Rows 2 to 3**, with the shared tooltip), which unhides them; a sheet without headers draws the arrows at the
  grid's own edge, so hidden lines can always come back.
- Rows and columns can be dragged by their selected headers to a new place.
- Inserting, deleting and moving keep every formula right: references move with their cells, a reference to a
  deleted cell becomes `#REF!`, and a range shrinks or grows with what is inside it.

### Cell menu

Right-click on a cell (or a selection) opens the cell menu, built from the editor's menu parts, as the Explorer's
document menu is: a header, a toolbar of the clipboard verbs, then icon-left rows in groups, the everyday verbs
named in full and on show, the rarer ones in side flyouts, short enough to fit a laptop's window. Each row names what it will do to this selection
("Insert 3 Rows Above", "Delete Columns B to C"), so nothing has to be guessed.

- **Header**: the selection (`B2:C4`, or `B4` for one cell) and how many cells it covers ("6 Cells").
- **Toolbar**: **Cut**, **Copy**, **Paste**, **Paste Values**, **Clear Contents** and **Clear Formatting** (icon
  buttons with their names, and keys where they have them, in the hover card: Cut ⌘X, Copy ⌘C, Paste ⌘V, Paste
  Values ⇧⌘V, Clear Contents Delete; Ctrl on other systems).
- **Rows and columns**: **Insert Row Above**, **Insert Row Below**, **Insert Column Left**, **Insert Column Right**
  (as many as the selection spans: "Insert 3 Rows Above"), then **Delete Row 4** or **Delete Rows 2 to 4**, and
  **Delete Column B** or **Delete Columns B to C**.
- **Merge Cells** (a selection of more than one cell; asking first when it would drop values) or **Unmerge Cells**
  (a selection touching a merge).
- **Flyouts**, each a side panel of rows:

| Flyout        | Rows                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sort          | **Sort A to Z**, **Sort Z to A** (the sheet by the active cell's column, as the toolbar's Sort), **Custom Sort…**     |
| Shift Cells   | **Insert Cells, Shift Right**, **Insert Cells, Shift Down**, **Delete Cells, Shift Left**, **Delete Cells, Shift Up** |
| Hide          | **Hide Row 4** / **Hide Rows 2 to 4**, **Hide Column B** / **Hide Columns B to C**                                    |
| Paste Special | **Values Only**, **Formatting Only**                                                                                  |
| Insert Chart  | **Bar Chart**, **Line Chart**, **Pie Chart** ([Charts](#charts))                                                      |

Every row closes the menu once it has acted. A merge that would drop values asks the same thing from here and
from the toolbar: "Merging keeps only the top-left value. Merge B2:C4?" (**Cancel**, **Merge**). Someone who may only
view gets the header and **Copy** alone.

### Formatting

- Formats a cell can take: number format (and its decimals), bold, italic, underline, strikethrough, text colour,
  fill colour, font (one of the editor's [fonts](../004-interface-design/fonts.md), by id; unset, the tab's font; the
  toolbar's **Font** is a button naming the active cell's font in its own face, left of Font Size, opening a menu of
  **Default** then every font, each named in its own face, the active cell's ticked; an id the editor no longer
  offers draws in the tab's font), font size (any whole size from 6 to 96 points, 10 by default; the toolbar's Font Size is a number between − and +
  that step through 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36, 48 and 72, and takes a typed size, kept within the
  limits; folded into More it is a menu of those sizes), horizontal alignment, vertical alignment (top, middle,
  bottom; middle when unset), wrap (overflow, wrap, clip) and a border on each side (thin, medium, thick, dashed or dotted, in a colour).
- Colours are picked from the one [colour picker](../004-interface-design/colour-picker.md): the toolbar's quick rows draw its swatch and follow its keyboard, and their last button (four coloured dots, as Quick Style's More colours) opens it in full (Theme Palette,
  Standard Colours, Custom Colours).
- Number formats:

| Format     | `1234.5` shows     | Notes                                                    |
| ---------- | ------------------ | -------------------------------------------------------- |
| Automatic  | `1234.5`           | As typed: a typed `12%` is Percent, a typed date is Date |
| Number     | `1,234.50`         | Thousands separators, 2 decimals                         |
| Percent    | `123450.00%`       | 2 decimals                                               |
| Currency   | `£1,234.50`        | The symbol picked (£, $, €, ¥, ₹ and others); 2 decimals |
| Accounting | `£ 1,234.50`       | Symbol to the left edge, negatives in brackets           |
| Scientific | `1.23E+03`         | 2 decimals                                               |
| Date       | `18/05/1903`       | In the person's locale's short date                      |
| Time       | `12:00:00`         |                                                          |
| Date Time  | `18/05/1903 12:00` |                                                          |
| Duration   | `29628:00:00`      | Hours past 24 keep counting                              |
| Plain Text | `1234.5`           | Typed inputs stay text, never read as numbers            |

- Number formats are drawn in the viewer's locale (separators, date order), so two people may see `1,234.50` and
  `1.234,50` for the same value.
- A number too large or too small to be a date (a phone number in a Date column) is drawn as Automatic would draw
  it under Date, Time and Date Time.
- **Merge Cells** joins a range into one cell, keeping the top-left input (others are cleared, after asking if
  they hold anything). A merged cell is selected, typed into and formatted as one. **Merge Across** merges each row
  of the range on its own.

### Freeze

- **Freeze** keeps the first rows and/or columns in place while the rest scrolls (at most 100 rows and 26 columns):
  none, 1, 2, or up to the active
  cell's row or column. A thicker line marks the frozen edge, and it can be dragged to change it.
- Freezing is the sheet's, seen by everyone, as in a spreadsheet.

### Sort

- **Sort A to Z / Z to A** on a column sorts the whole sheet's rows by it, keeping frozen rows (headers) in place.
- **Sort Range…** sorts the selection only: by one column or more (each A to Z or Z to A), with **Data has a header
  row** to keep the first row.
- Order: numbers ascending, then text (ignoring case), then true/false, then errors, then empty cells last, both
  ways.
- A sort moves whole rows, formats with them. A formula moved with its row keeps pointing at its own row's cells.
- A sort is one change, undone in one step.

### Filter

- **Filter** turns on a filter over the filled range around the selection (or the selection): its first row
  becomes a header with a filter button in each cell.
- A column's filter button opens: **Sort A to Z**, **Sort Z to A**, **Filter by Values** (a searchable list of the
  column's values with counts, **Select All** and **Clear**), and **Filter by Condition** (is empty, is not empty,
  text contains, does not contain, starts with, ends with, is exactly, date is before / after / on, greater than,
  less than, between, equal to, not equal to).
- Rows that do not match every column's filter are hidden; a filtered column's button is filled. Row numbers of
  the visible rows stay as they are, so a gap shows rows are filtered.
- The filter is the sheet's, seen by everyone, as in a spreadsheet; turning it off shows every row again.
- Functions over a filtered range still read the hidden rows, as in a spreadsheet; the status bar's Sum reads the
  visible ones.

### Find

- **Ctrl/⌘ + F** with the grid focused opens a small **Find** bar on the sheet's top right: matches are counted
  ("3 of 12"), Enter and Shift+Enter go to the next and previous, and each match is highlighted. It looks in
  values, and with **Also Search Formulas** in inputs. **Match Case** and **Match Entire Cell** narrow it.
- **Ctrl + H** (**⌘ + Shift + H** on a Mac) opens it with **Replace with** and **Replace** / **Replace All** (inputs only, never formulas'
  results). Replace All is one change, undone in one step, and says how many it changed.
- Escape closes it.

## Named ranges

- A sheet's **named ranges** (`layout.names`): each a name and the cells it covers, by row and column ids, as merges
  are, so it grows with rows inserted inside it and follows moves ([Formulas](formulas.md#named-ranges)).
- A name: 1 to 60 characters, starting with a letter or `_`, then letters, digits, `_` or `.`; not `TRUE` or
  `FALSE`; not one that reads as a cell reference (`AB12`, `R1C1`); unique on its sheet, case aside. Up to 100 a sheet.
- **Naming**: select the cells and type the name in the formula bar's name box, then Enter (one undo step). Typing an
  existing name there selects its range.
- **Sheet Settings** has a **Named Ranges** section: each name with its range (`A1:B4`), **Go To** (selects it) and
  **Remove** (one undo step); "No named ranges yet. Select cells and type a name in the name box." when there are none.
- Formulas offer the sheet's names in their autocomplete, after the functions that match.
- Deleting every row or every column a range covers removes its name; Clear Sheet removes them all. A copied sheet
  keeps its names (they are its own).
- Telemetry: `Sheet · Changed · Name`.

## Card tables

- A sheet set up from Plan Cards holds a **card table** (`layout.cardTables`): its header row, each column's card
  field (by the name the header gave it), which row is which card, and the card type new rows take (the import's
  one card type when filtered to one, else the type most of its cards have). Up to 8 tables a sheet and 2,000
  linked rows a table.
- **Cards to rows**: a linked card changed anywhere (a board, the card panel, an agent) rewrites its row's cells
  in the table's columns, as the import wrote them (a date field as a date). These writes are quiet: no undo step.
  A card trashed or gone leaves its row as it last was.
- **Draft rows**: a cell edited in a table row (in the table's columns) makes the row a **draft**
  (`cardTable.drafts`, seen by everyone, so no one's sync overwrites it): tinted in the focus colour with an edge, and
  in the row's cell of the table's **Controls** column (`cardTable.controls`, the column just past the table, 72 px; a
  table made before it gets one, the next column if empty on its rows, else one inserted) a ✓ **Save Card** (**Add
  Card** for a new row) and an ✕ **Cancel Changes**, 24 px icon buttons with tooltips. Every card row in view shows
  **Open Card** (an open-in icon) at the right of its Title cell. Moving off a draft keeps it until saved or
  cancelled.
- **Save** writes the row to its card: the fields whose cells no longer say what the card says, read as agents name
  things: State by column name, Assignee by a person's name, Type by a card type's name, Priority and choice options
  case aside, Labels separated by commas, a date as the card's date (its day; a time of day is dropped). A cleared
  cell clears its field, except Type, Title and State, which a card always has (the card keeps them, and the next
  sync writes them back); Number is the card's own and is left. Field names are read as the card functions read them
  (State or Status, Assignee, Owner or Assigned To, Due or Due Date, and so on). A new row (directly under a linked row, a draft row or the header) becomes a card: its type from its
  Type cell or the table's, its State from its State cell or the table's first card's, its title from its Title cell
  (else the type's new-card title); its Number fills in. A row directly under a draft row joins the table too,
  so a block of rows pasted under the table becomes a block of new rows, each a draft. A value the plan does not know ("No column 'Doing'") is
  refused with a toast and the row stays a draft. The draft ends only once the card write lands: a write the plan
  store refuses keeps the row a draft ("That row could not be saved to its card. Its edits are kept: try Save
  again."), and a second Save while one is on its way does nothing. **Cancel** puts a card's row back as its card is, and empties a
  new row.
- A card changed elsewhere (a board, the card panel, an agent) while its row waits as a draft wins: the row's edits are
  put back to the card's values, and a notice says so ("Card #3 changed elsewhere, so its row's edits were put back").
  Only the person whose edit made the draft (in the session they made it in) puts it back and sees the notice;
  everyone else leaves another person's draft alone.
- **Dropdowns**: in a column whose field has set values (Type, State, Priority, Assignee, a choice field), the active
  cell of a table row shows a dropdown arrow inside its right edge, in the room such a column keeps at its cells'
  right so the arrow never covers a value ("Choose State", with a tooltip), opening an option list of those values,
  the cell's own ticked; on a date field (Due, Start) the arrow opens the system date picker itself, anchored to the
  cell, with no popover between ([Date fields](../004-interface-design/date-fields.md)); only a whole date from 1900
  on is taken. Picking one writes the cell (the row becomes a draft).
  Typing stays open; Save checks it.
- **Deleted rows**: deleting a linked row moves its card to the Trash (restorable from there, and Undo brings both
  back). Clearing a row's cells only clears its fields. A deleted row leaves the table at once (its link and any
  draft); deleting the header row ends the table, and deleting its Controls column drops it (the next one found
  again). Undo puts back what the deletion took (the deleted rows' links and drafts, a deleted column, the table
  itself when the deletion ended it) into the table as it is then, keeping rows linked or drafted since.
- Open Card, the draft tint and Save and Cancel draw only for someone who may edit (Open Card for everyone in Plan
  mode), and never over the frozen rows or columns a row has scrolled under.
- Sync runs while the Sheet is drawn, for someone who may edit; the card side follows the item store's rules and
  undo. A row's link is the sheet's, seen by everyone.

## Charts

- **Insert Chart** makes a pie, bar or line chart ([Pie chart](../009-elements/pie-chart.md)) from the sheet's cells:
  the toolbar's **Charts** category (**Bar Chart**, **Line Chart**, **Pie Chart**) and the cell menu's **Chart**
  section. It reads the selection; a single cell reads the block of data around it (a spreadsheet's current
  region). A single empty cell with nothing around it says "Select the cells to chart first".
- Several ranges picked together (Ctrl or ⌘ and a drag: the labels in A2:A5 and the amounts in C2:C5) chart as one:
  the rows they span, and only the columns picked, in the sheet's order, so a column between them (Category in B) is
  left out.
- The range is read as a spreadsheet does: a first row with no numbers among the values names the series; a first
  column of text or dates labels the categories (numbered 1, 2, … without one); every other column is a series
  ("Column B" when unnamed). A pie or bar chart shows the first series (a pie never below zero); a line chart shows
  them all. Rows a filter hides are left out. At most 500 categories and 12 series are read.
- The chart is an ordinary chart element whose `chartSource` names the sheet and the range by stable row and
  column ids, and, when only some of its columns were picked, those columns (`cols`), so it grows with rows inserted
  inside the range and follows moves. Its data is read live: change
  the cells and the chart changes, for everyone.
- It is placed floating over the Sheet's top right (24 px in, below the toolbar), selected. While its centre is
  on its Sheet it moves with the Sheet; dragged onto the canvas it stays there, still live. Moved back on, it is
  carried again.
- The element keeps the last read as its own data (saved quietly, no undo step, by someone who may edit), its labels
  written in one fixed locale (en-GB, as agents read) so editors in different locales never rewrite it; each person
  sees labels in their own locale. Exports, thumbnails, agents and other modes draw the kept read. A chart whose sheet or range corner is gone draws that last
  read.
- Its Data menu says it is drawn from a Sheet and offers **Unlink From Sheet**, which keeps the last read as an
  ordinary chart edited by hand. Its style, legend, palette and animation are set as any chart's.
- A chart copied with its Sheet (a duplicate, a paste, Duplicate Tab) reads the Sheet's copy; copied alone it
  reads the original.

## Undo

- Sheet changes join the canvas's Undo and Redo, in the order made, mixed with the person's canvas edits and
  card changes. Each saved edit, paste, fill, format change, sort, row or column change, filter change and Replace
  All is one step.
- Undo puts back exactly the cells, rows and columns the change touched, even over a later change someone else
  made to the same cell, as canvas undo does.

## Maximised

A sheet maximises exactly as a board does ([Maximised board](../026-plan/plan-board.md#maximised-board)):

- **Maximise Sheet** at the header's right; maximised, the sheet fills the canvas with zen chrome around it,
  the toolbar and formula bar stay, and the grid fills the rest.
- **Restore Sheet** (a minimise icon, in the same place) or **Escape** puts it back. Escape first closes what is
  open over the grid (a menu, the Find bar) and ends an edit in progress (throwing it away); only an Escape with
  none of those restores. A selection with nothing in edit restores at once.
- Nothing is lost either way: the selection, an edit in progress, scroll and an open menu carry over.
- It animates both ways as a board does (250 ms, ease-out; at once with reduced motion).
- It is the person's own view; nothing is saved, sent or undoable. It ends on its own when the sheet leaves the
  screen (switching tab, the sheet deleted, leaving Plan mode).
- On a touch screen, a finger on the maximised grid scrolls it.
- Telemetry: `Plan · Toggled · SheetMaximised` and `Plan · Toggled · SheetRestored`.

## Zoom

While a Sheet covers the canvas (maximised, or filling its tab), the canvas cannot zoom, so the bottom-right zoom
controls zoom the **sheet's cells** instead of standing down as they do for a board or view
([Maximised board](../026-plan/plan-board.md#maximised-board)):

- **Zoom out** and **Zoom in** step it by 10%, the level's menu offers its presets, and **Fit** (the level on a
  desktop, the Fit button on a phone) puts it back to **100%**. It runs from 50% to 200%; the level shows it.
- The column letters, row numbers and cells grow or shrink together inside the grid's frame; the header, toolbar,
  formula bar and status bar keep their size. Everything in the grid works as at 100%: selecting, dragging, editing,
  panning, menus.
- Their hover cards say what they zoom: "Zoom the sheet in by 10%.", "Zoom the sheet out by 10%.", "Show the sheet at
  100%."
- It is the person's own view, like maximising: never saved, sent or undone. It goes back to 100% the moment no Sheet
  covers the canvas, so the next one opens at its own size.

## Fill Tab

A Sheet can fill its tab for good, exactly as a board can ([Fill Tab](../026-plan/plan-board.md#fill-tab)):

- **Fill Tab** in Sheet Settings' Sheet Options: an option list, **On Canvas** (the default) or **Fill Tab**, with the board's
  drawn tiles and the line "The sheet always fills this tab, for everyone, so the rest of the canvas can't be used."
- It is stored on the element (`planSheet.fillTab: true`), so everyone sees it, in every mode.
- Turning it on deletes every other element on the tab, as one change and one undo step, asked first when there are
  any (the board's confirm: "Fill the Tab with Sheet 1?", **Delete and Fill Tab**). **On Canvas** puts it back on the
  canvas, one undo step.
- Filling, it draws over the canvas area as a maximised Sheet does; **Focus** and **Maximise Sheet** are hidden and
  Escape does not restore it. The first board or Sheet in element order with Fill Tab on wins.
- Telemetry: `Plan · Toggled · SheetFillTabOn` / `SheetFillTabOff`.

## Collaboration

- Everyone in the room sees cell changes as they happen ([Sheet store](sheet-store.md#live-for-everyone)), and
  every value that depends on them recalculates in their own browser.
- **Presence**: each other person's selection on the sheet is outlined in their colour, with their full name on a
  tag at its top right (hidden after 3 seconds still, shown again on hover). A cell someone is editing shows their
  outline thicker. It is sent as an ephemeral `sheet-presence` room op, never stored, and only while the person has
  a selection on a sheet; a late joiner hears it as a Plan card hold is said again ([Plan mode](../026-plan/plan-mode.md#collaboration)).
- Two people typing in different cells never overwrite each other. Two saving the same cell: the later save
  wins. A cell being edited by you that someone else changes keeps your edit; saving it wins.
- A row or column someone else inserts or deletes while you edit moves your edit with its cell; if your cell was
  deleted, your edit is thrown away and a toast says so ("Someone deleted the row you were editing").

## Who may do what

- **Read** with any access: open the sheet, scroll, select, copy, find, Download CSV.
- **Edit** with edit access: everything else.
- Someone who may only view sees no toolbar, the formula bar read-only, and no menus that change anything.

## Other modes

- In Diagram, Illustrate and Draw a Sheet element is an element like any other: drawn with its header and grid
  (its values, formats, frozen rows and merges, scrolled to the top left), live as cells change, and selected,
  moved, resized, copied, styled and deleted as any element. Its grid does not take the pointer or the keys; a
  double-click on it says "Switch to Plan to edit this sheet", with a **Switch to Plan** button, which switches
  the tab to Plan for everyone on it ([Editor modes](../007-editor/editor-modes.md) "Where the mode lives").
- A Sheet element is never added to another document by a tab's **Add to Document**, as a board's tab is not.

## Copying a Sheet element

- Duplicating or copying and pasting a Sheet element makes a **new sheet** with a copy of its cells, formats,
  rows, columns, freeze, merges and filter, titled `Sheet 1 (copy)` (or the next free title on its tab). The two
  are independent from then on.
- A paste into another document carries the cells on the clipboard; past the clipboard's limit (the sheet store's
  write limit), the paste is refused ("This sheet is too big to paste into another document; download it as CSV
  instead").
- References to other sheets in a copied sheet's formulas keep their titles, so they read the sheets of those
  titles on the tab it lands on (or show `#REF!`).

## CSV

- **Import CSV…** (Sheet Settings) opens a file picker for a `.csv` or `.tsv`; on a sheet with filled cells it asks
  first: **Replace Sheet**, **Insert at Selection** or **Cancel**. Values are read as if typed; the grid grows to fit,
  up to its limit (past it: "Imported the first 10,000 rows").
- Dropping a `.csv` on the canvas in Plan mode places a new sheet with it (above).
- **Download CSV** saves `<title>.csv`: every row and column up to the last filled cell, each cell's value as shown
  (formatted), comma-separated with quotes as RFC 4180, UTF-8.
- Telemetry: `Sheet · Imported · Csv`, `Sheet · Exported · Csv`.

## Exports and images

- Images, thumbnails, PDFs, slides and api or MCP renders draw the Sheet element as in other modes: header, column
  and row headers, and the cells that fit its frame from the top left (after frozen rows and columns), with values
  worked out from the sheet store.
- Card functions ([Formulas](formulas.md#plan-cards)) in an export read the document's items, as boards do.

## Performance

- Placing, scrolling, editing and recalculating a sheet must cost nothing to a document without one: its code and
  the formula engine load the first time a Sheet element is drawn, and its cells are fetched only for sheets on the
  open tab.
- Scrolling stays smooth at the sheet's limits (only cells in view are drawn); an edit recalculates only the cells
  that depend on it.

## Telemetry

- `Element · Added · PlanSheet` (placed from the palette or a CSV drop).
- `Plan · Toggled · SheetMaximised` / `SheetRestored`, `SheetFillTabOn` / `SheetFillTabOff`, `SheetFocused`.
- The `Sheet` category: `Changed` with the kind of change (`Cell`, `Formula`, `Format`, `Rows`, `Columns`, `Merge`,
  `Freeze`, `Sort`, `Filter`, `Replace`, `Fill`, `Paste`, `Title`, `Clear`, `Shift`, `Settings`, `Setup`: the closed
  `SHEET_CHANGE_KINDS`), sent once per change, never content; `Imported · Csv`, `Exported · Csv`; `Opened · Find`,
  `Opened · Settings`; `Created` with how a sheet was set up (`Blank`, `Budget`, `Tracker`, `Timesheet`, `Contacts`,
  `Cards`, `Csv`) or `Chart`;
  `Used` with a function's name when a formula using it is first saved (names from the closed function list only).
- The public dashboard charts them in a **Sheets** group.

## Help

- A help article **Sheets** (placing a sheet, editing, formulas, formatting, sort, filter, maximise, CSV, keyboard),
  registered with the help centre, and a **Sheet Functions** article listing every function with an example.
