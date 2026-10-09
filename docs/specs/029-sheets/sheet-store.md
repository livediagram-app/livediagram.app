# Sheet store

A document's **sheet store** holds every [sheet](sheet.md) of the document: its title, its rows and columns, and
its cells' inputs and formats. Like the [item store](../026-plan/items.md), it lives apart from the canvas: a Sheet
element on a tab only names its sheet, so a sheet of tens of thousands of cells never weighs on the tab's
elements, its snapshots, its changesets or its room.

## Domain language

| Term                      | Means                                                                          | Never called              |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------- |
| **sheet store**           | Every sheet of one document                                                    | workbook, database        |
| **sheet id**              | A sheet's internal id, named by its Sheet element                              | key                       |
| **row id**, **column id** | A row's or column's own id, kept for life whatever its place                   | index (that is its place) |
| **layout**                | A sheet's rows and columns in order, with their sizes, hidden flags and freeze | structure, shape          |
| **cell write**            | A change to cells' inputs and/or formats                                       | update, edit              |
| **layout write**          | A change to rows or columns: insert, delete, move, resize, hide, freeze        | structural change         |
| **sheet rev**             | The sheet's revision, raised by one on every write to it                       | version                   |

## What a sheet is

- **`id`**: a short random id, unique in its document. A copied document keeps every sheet id, so its Sheet
  elements still frame the right sheets.
- **`tabId`**: the tab it was made on. A sheet belongs to one tab for life: its references to other sheets are
  that tab's, and a tab-scoped link reads only its tab's sheets.
- **`title`**: up to 60 characters, unique among the tab's sheets.
- **Layout**: the rows and the columns, each an ordered list of ids, with each one's size (where set) and hidden
  flag; how many rows and columns are frozen; the merged ranges; the filter (its range and each column's
  condition); the sheet's default column width and row height.
- **Cells**: for each cell with an input or a format, its row id, its column id, its **input** (stored as what it
  means: a number, text, a boolean, or a formula) and its **format**.
- **Who and when**: `createdAt`, `updatedAt`, `updatedBy` (the display identity, a one-way hash as on items).
- **`rev`**: the sheet rev.

### Rows and columns by id

- Every row and column has an id that never changes when rows and columns are inserted, deleted, moved, hidden or
  sorted. Cells are stored by row id and column id; a row's place is only its position in the layout.
- A formula is stored with its references pointing at row and column ids (and other sheets at their sheet id),
  and drawn as `A1` text from the layout of the moment. So:
  - inserting, moving and sorting rows or columns rewrites no cell, and every formula still reads the cells it
    read;
  - deleting a row or column deletes its cells, and a reference to one of them reads `#REF!`; a range with a
    corner in it shrinks to what is left;
  - renaming a sheet rewrites nothing; a formula naming it shows the new title;
  - a write sent before someone else's layout write lands on the cells its sender meant, wherever they now are.
- A reference to a sheet title no sheet on the tab has is stored by its title and reads `#REF!` until such a
  sheet is there.

## Changing a sheet

- **Create** (placing a Sheet element, a copy, a CSV): a title, its tab and optionally its layout and cells. It
  may name its id (made by the client), and a restore (undo, a sync) its old rev.
- **Cell write**: a set of cells by row and column id, each with an input to set or clear and/or format keys to
  set or clear. Two people writing different cells, or different format keys of a cell, never overwrite each
  other; the same input or format key resolves to the last write.
- **Layout write**: insert rows or columns (new ids, made by the client, at a place given as "after this id"),
  delete them, move them (after an id), resize them, hide or show them, set the freeze, merge or unmerge a range,
  set or clear the filter and its conditions. A layout write naming an id that is gone does what still makes
  sense (deleting a deleted row is nothing; inserting after a deleted row inserts at its old neighbour, else the
  end).
- **Sort** is a layout write of the rows (their new order) for a whole-sheet sort, and a cell write for a range.
- **Rename**: a new title; refused when another sheet on its tab has it (`sheet_title_taken`).
- **Delete**: removes the sheet and its cells.
- Every write answers with what is stored: the changed cells, the layout if it changed, and the sheet rev.

## Sheets no element frames

- Deleting a Sheet element does not delete its sheet, so Undo, a tab restored from the Trash, or a paste of the
  cut element brings the sheet back as it was.
- A sheet no element on its tab has framed for 30 days is deleted for good by the api's daily sweep.
- Deleting a document for good deletes its sheets with it.

## Who may do what

Sheets follow the document's access ([Auth and guest access](../014-identity/auth-and-guest-access.md)):

- **Read** with any access to the document. A visitor on a **tab-scoped** link reads only that tab's sheets.
- **Create, write, rename, delete** with edit access (a tab-scoped edit link: only its tab's sheets).
- An agent token acts as its person; a read-only token reads only.

## Live for everyone

- Every write is pushed to everyone in the document's room at once, in order, with the sheet rev: the changed
  cells, and the new layout if it changed.
- A client that sees a gap in a sheet's revs, or reconnects, fetches that sheet again.
- Nothing a browser sends over the room changes a sheet: sheets change only through the api. Presence on a sheet
  (`sheet-presence`) is ephemeral and never stored.

## Loading

- A sheet's cells are fetched when its Sheet element is first drawn on the open tab, together with the other
  sheets on that tab (one request for the tab's sheets), and kept for the session.
- A document with no Sheet element on its open tab fetches nothing.

## Undo

- A person undoes their own sheet changes with the canvas's Undo, in order, mixed with their canvas edits and card
  changes ([Items](../026-plan/items.md#undo)).
- An undo writes back the old inputs and formats of exactly the cells its change touched, and the old layout of
  what its layout change touched (a deleted row comes back with its id, place and cells).
- Like canvas undo, an undo writes the old value back even over a later change someone else made to that cell.

## Offline documents

- An [offline document](../006-document/offline-mode.md) keeps its sheet store inside its own record, as a
  `sheets` array beside its tabs and items. Every rule above holds, minus the room.
- **Sync to cloud** sends the sheets with the document; **Take offline** fetches every sheet first, all or
  nothing.

## Copies and exports

- **Duplicate** copies the sheet store with the document (same ids).
- **Duplicate Tab** copies the tab's sheets as new sheets on the new tab (new ids, `(copy)` titles kept unique
  per tab), and the new tab's Sheet elements frame the copies.
- **The `.livediagram` file** (the Google Drive mirror's document file) carries the sheets; the field is additive,
  so the file stays version 1.
- A **Community** copy carries the sheets.
- Images, thumbnails, PDFs and api or MCP renders draw Sheet elements from the store.

## Agents

- Agents read and write sheets through the api, the CLI and MCP ([Agents](../024-agents/README.md)), by sheet
  title (or id) and A1 references, never ids of rows and columns:
  - MCP **`list_sheets`** (a document's sheets: title, tab, size, filled range, the Sheet element framing it),
    **`read_sheet`** (a range's non-empty cells by A1: input, value and what it shows; plus freeze, merges and
    filter), **`change_sheet`** (changes in order: set cells by A1 from rows of inputs; clear or format a range;
    insert or delete rows and columns; sort; freeze; rename) and **`add_sheet`** (place a Sheet element on a tab,
    optionally filled from rows or CSV text).
  - CLI: `sheet ls <doc>`, `sheet get <doc> <sheet> [range]`, `sheet set <doc> <sheet> <A1> <value…>` (or `--csv`
    from a file or stdin), `sheet add <doc> [--tab] [--title] [--csv]`, `sheet insert-rows`, `sheet insert-cols`,
    `sheet rm-rows`, `sheet rm-cols`.
- A read answers at most 5,000 cells of its range and 100,000 characters of cells, and says where to read on.
- Inputs from agents are read as typed in the `en-GB` locale (day before month), unless a value is given as a
  JSON number or boolean; a formula an agent writes that cannot be read is refused (`formula_invalid`, naming the
  cell and why), never stored as `#ERROR!`.
- Values an agent reads are worked out by the same engine the editor uses.

## Limits

- Up to 200 sheets per document; a create past it is refused (`sheets_full`).
- A sheet has up to 10,000 rows and 200 columns (A to GR); a write past either is refused (`sheet_too_large`); a
  paste or import is cut at it and says so.
- Up to 50,000 cells with an input or a format per sheet, and 4 MB of stored cells; past either, a write is
  refused (`sheet_full`, "This sheet holds the most cells it can").
- Up to 200,000 such cells per document across its sheets (`sheets_full`).
- An input is up to 10,000 characters; a formula up to 8,000 (`input_too_long`).
- Up to 1,000 merged ranges and 5,000 rows or columns with their own size per sheet.
- A write changes up to 5,000 cells; the editor sends a larger paste, fill or import as several writes, one undo
  step. Writes count against the write rate limit.
