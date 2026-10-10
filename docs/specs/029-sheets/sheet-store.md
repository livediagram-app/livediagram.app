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
| **referenced**            | Named by an element of its document: a Sheet's `sheetId` or a copy's `copyOf`  | used, linked              |

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
  may name its id (made by the client), and a restore (undo, a sync) its old rev. A **restore** of a sheet
  that is still stored keeps it, and cancels a delete waiting on it being unreferenced.
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
- **Delete**: removes the sheet and its cells. **Delete when unreferenced** (the editor's, with its element) removes
  them now if nothing references the sheet, or else as soon as nothing does ([Deleting a sheet](#deleting-a-sheet)).
- Every write answers with what is stored: the changed cells, the layout if it changed, and the sheet rev.
- A write the server could not take for now (no answer, a timeout, a rate limit, a server error) is kept, still
  shown and still ahead of the sheet's later writes, and sent again after a wait that doubles from half a second
  up to 30 seconds, until it lands or the room confirms it. Only a refusal (any other answer) drops it, with a
  toast, and fetches the sheet again.

## Deleting a sheet

A sheet is **referenced** by every element in its document that names it: a Sheet element showing it
(`sheetId`), and a copy not yet made (`copyOf`: a duplicated Sheet, a pasted one, or one on a duplicated tab, which
is made from it when first drawn). A sheet nothing references is **unreferenced**.

- **Delete with the element**: deleting a Sheet element (Delete, Backspace, the selection's trash button, the
  context menu's Delete, the command palette) whose sheet nothing else references asks first, one dialog for the
  whole selection: **Delete Sheet?** ("Sheet 1 and its cells are deleted. Undo brings it back while this page is
  open."), or **Delete 3 Sheets?** for several ("Sheet 1, Costs, Budget and their cells are deleted. Undo brings them back while this page is open."), with **Delete** and **Cancel**. **Delete** removes the elements and
  the sheets with them; **Cancel** removes nothing.
- A sheet something else still references (another Sheet element, a copy not yet made) is not asked about and
  stays: only the element goes.
- The api deletes a sheet the person deleted with its element as soon as it is unreferenced. If the element's
  removal has not reached the api yet, the sheet goes the moment it does.
- **Undo** puts the element back and makes the sheet again as it was (its id, title, rows, columns and cells),
  while the page that deleted it is open. **Redo** removes the element again; its sheet is then left as a Cut's is.
- **Cut**, an agent's or another person's removal, deleting a layer, a tab, or Fill Tab's clearing do not ask and
  do not delete the sheet: it is kept, so a paste, an Undo or a restore brings it back.
- A sheet unreferenced for 30 days is deleted for good. The api notes the moment a sheet becomes unreferenced (or
  referenced again) as the tabs that reference it are saved, and deletes, once a day, the sheets unreferenced for
  longer.
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
- Undoing a deletion of rows or columns puts back only what the deletion took, into the sheet as it is at the
  undo: the deleted lines' sizes, hidden state and card-table links and drafts, the merges, filter range and named
  ranges it shrank or dropped, a card table's deleted columns. What changed since is kept (a row linked or drafted,
  a merge or a name made), and a merge, filter or name someone changed after the deletion is theirs, not put back.
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
