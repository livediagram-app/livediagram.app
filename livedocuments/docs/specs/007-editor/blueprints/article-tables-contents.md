# Article tables, contents, headers and footers blueprint

Derived from [Article pages](../article-pages.md) "Tables", "Table of contents", "Headers and footers",
"Flowing onto pages", "Collaboration" and "Share roles". Implementation detail only; the spec owns every design
decision. The rest of the writing (its model, ops, editor, toolbar, zones, export) is the
[Article pages blueprint](article-pages.md); this one adds three blocks of behaviour on top of it.

## Domain and naming

| Term                       | Identifier                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table block                | `ArticleTableBlock` (`{ id, type: 'table', header?: true, cols, rows }`), `packages/document/src/article-table.ts`                                                                                                                                                                                                                       |
| Column                     | `ArticleTableColumn` (`{ id, w }`, `w` the column's share of the text width, the shares summing to 1)                                                                                                                                                                                                                                    |
| Row, cell                  | `ArticleTableRow` (`{ id, cells: ArticleRun[][] }`): a cell is its runs, one per column in `cols` order                                                                                                                                                                                                                                  |
| Reading a table            | `parseArticleTable(b, id)` (from `parseArticleBlock`); `normaliseShares`; `newArticleTable(id, rows, cols, header)`; `tableFromGrid(id, grid, header)`                                                                                                                                                                                   |
| Table text                 | `articleTableText(block)` (cells tab-joined, rows newline-joined: find, word counts, the Map)                                                                                                                                                                                                                                            |
| Cell op                    | `ArticleOp` `{ kind: 'cell'; block; row; col; runs }` (`article-flow-ops.ts`); `tableCellOps(before, after)` (`article-table.ts`)                                                                                                                                                                                                        |
| Contents block             | `ArticleTocBlock` (`{ id, type: 'toc', depth?: 1 \| 2 }`, absent depth 3); `ArticleTocDepth`                                                                                                                                                                                                                                             |
| Contents entries           | `ArticleTocEntry` (`{ id, level, text }`), `articleTocEntries(blocks, depth)`, `packages/document/src/article-toc.ts`                                                                                                                                                                                                                    |
| Header, footer             | `ArticleBand` (`{ left?, center?, right? }`), `ArticleStyle.header`, `.footer`, `.differentFirstPage` (`true`: Different First Page); `parseArticleBand`                                                                                                                                                                                 |
| Band fields                | `ARTICLE_BAND_FIELDS` (`{page}`, `{pages}`, `{name}`, `{date}`); `fillBand(text, values)`; `articleBandsFor(style, pageNumbers, index, count, name, date)` → `PageBands`; `bandDate(date)`, `packages/document/src/article-bands.ts`                                                                                                     |
| Header room                | `ARTICLE_HEADER_BAND_PX`; `articleTopMarginPx(style)` takes it into account; `articleHeaderBandPx(style)`                                                                                                                                                                                                                                |
| Editor nodes               | `table`, `table_row`, `table_cell`, `table_header` (cells `inline*`, prosemirror-tables roles), `toc` (atom) in `articleSchema`                                                                                                                                                                                                          |
| Table editing              | `tableEditing()`, `goToNextCell`, `addRowBefore/After`, `addColumnBefore/After`, `deleteRow`, `deleteColumn`, `toggleHeaderRow`, `CellSelection` (prosemirror-tables)                                                                                                                                                                    |
| Table commands             | `insertTable`, `tableCommand(name)`, `tableCommandBlock(state, name)` (why one cannot run), `tableTab(dir, reshape)`, `cellArrow(dir)`, `cellEnter`, `cellEdge('start' \| 'end')`, `inlineForCell(fragment)`, `TableCommandName` (`lib/article/article-table-commands.ts`)                                                               |
| Table keys, normaliser     | `tableKeymap(reshape)`, `tableColsPlugin`, `fittedCols` (`lib/article/article-table-plugins.ts`)                                                                                                                                                                                                                                         |
| Table node view            | `ArticleTableView` (`lib/article/article-table-view.ts`): the grid template from `cols` (`columnTemplate`), the resize grip (`gripAt`, `sharesDragged`)                                                                                                                                                                                  |
| Repeated header            | `repeatHeaderPlugin`, `repeatHeaderKey` (its meta), `measureRepeats(view, rootTop, z)`, `repeatBreaks(input)` (pure), `RepeatInput` (`lib/article/article-table-repeat.ts`)                                                                                                                                                              |
| Table paste                | `normalisePastedTables(html)`, `tsvGrid(text)`, `tsvSlice(text)`, `pasteIntoCell`, `trackTablePaste` (`lib/article/article-table-paste.ts`); composed over the writing's paste by `articleTablePasteProps(base)` (`lib/article/article-table-editor.ts`, beside `tablePlugins`, `tableKeyPlugins`, `tableNodeViews` and `jumpToHeading`) |
| Table look                 | `app/article-tables.css` (tables, the repeated header row, the grip, contents)                                                                                                                                                                                                                                                           |
| Contents view              | `TocView`, `tocPlugin`, `tocKey` (its meta: the pages), `hasToc`, `measureTocPages(view, pageOf)`, `headingPages` (`lib/article/article-toc-view.ts`)                                                                                                                                                                                    |
| Toolbar menu               | `TablePanel` (`components/canvas/article/page-toolbar-table.tsx`), shown while `selection.inTable`                                                                                                                                                                                                                                       |
| Bands on the page          | `PageBands` (`components/canvas/article/PageBands.tsx`), from `CanvasPages`; places from `pageBandLayout` (`lib/article/article-band-layout.ts`, with `setBandDocumentName` / `useBandDocumentName` for `{name}`)                                                                                                                        |
| Bands in the Style popover | `ArticleBandsSection` (`components/canvas/article/ArticleBandsSection.tsx`)                                                                                                                                                                                                                                                              |
| PDF link areas             | `ArticleLinkArea` (`{ x, y, w, h, href?, target? }`), handle `links()` and `headingPages()`; `pdfLinksFor`, `pdfLinksOn`, `linkAnnotation` (`lib/export-pdf-links.ts`); `assemblePdf` writes them                                                                                                                                        |

"Table" alone in the writing's code is the table block; the canvas's own is "table element" (`TableElement`).
"Contents" is the interface's word for the table of contents and `toc` the block type.

## Constants and configuration

| Constant                  | Value            | Where / provenance                                                                          |
| ------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `MAX_ARTICLE_TABLE_ROWS`  | 500              | `article-table.ts`; spec "Tables"                                                           |
| `MAX_ARTICLE_TABLE_COLS`  | 20               | `article-table.ts`; spec                                                                    |
| `MAX_ARTICLE_TABLE_CHARS` | 150,000          | `article-table.ts`; spec, under `ARTICLE_FRAME_CHARS` (200,000) so a table put fits a frame |
| `MAX_ARTICLE_CELL_TEXT`   | 2,000 characters | `article-table.ts`; spec                                                                    |
| `MAX_ARTICLE_CELL_RUNS`   | 64 runs a cell   | `article-table.ts`; D99                                                                     |
| `ARTICLE_TABLE_MIN_SHARE` | 0.05             | `article-table.ts`; spec "Column widths"                                                    |
| New table                 | 3 x 3, header on | `insertTable`; spec "Putting one in"                                                        |
| Cell padding              | 6 px / 10 px     | `article-tables.css`; spec "Look"                                                           |
| `ARTICLE_TOC_INDENT_PX`   | 20 px a level    | `article-tables.css` (`--toc-level`); spec "What it shows"                                  |
| `ARTICLE_BAND_MAX`        | 200 characters   | `article-bands.ts`; spec "Headers and footers"                                              |
| `ARTICLE_HEADER_BAND_PX`  | 32 px            | `article-style.ts`; spec "Where"                                                            |
| Repeat tolerance          | 1 px             | `article-table-repeat.ts` `REPEAT_SLACK`; D100                                              |

## Data and persistence

- **Stored**: a table block's `header` (absent: off), `cols` (`{ id, w }[]`) and `rows` (`{ id, cells }[]`, each
  row's `cells` as many as `cols`, each cell its runs, empty `[]`); a contents block's `depth` (absent: 3); the
  style's `header`, `footer` (each `{ left?, center?, right? }`, empty strings and empty bands dropped) and
  `differentFirstPage: true`. Defaults are absent. Contents entries, page numbers in them, and band text after the
  fields are filled are views, never stored.
- **Reading** (`parseArticleTable`): `cols` read as ids (`isArticleId`, repeated ids dropped) with a finite
  positive share, at most `MAX_ARTICLE_TABLE_COLS`; no usable column drops the block. Shares normalised
  (`normaliseShares`): each at least `ARTICLE_TABLE_MIN_SHARE`, summing to 1. Rows read as ids (repeated dropped),
  at most `MAX_ARTICLE_TABLE_ROWS`; each row's cells padded with `[]` or cut to the column count, each cell through
  `normaliseRuns(v, MAX_ARTICLE_CELL_TEXT, MAX_ARTICLE_CELL_RUNS)`; rows stop being taken once the JSON of the
  block would pass `MAX_ARTICLE_TABLE_CHARS`. No row drops the block. `header` only when `true`.
- **Contents** (`toc`): `depth` kept only as 1 or 2.
- **Bands**: each part a string, trimmed of control characters, cut to `ARTICLE_BAND_MAX`; an empty part dropped,
  an empty band dropped; `differentFirstPage` kept only as `true`.
- **Ops**: `diffArticleFlow` emits, for a table that stayed in place and changed only in its cells (the same
  `header`, `cols` and row ids in order), one `cell` op per changed cell (`tableCellOps`), else a `put` of the
  whole table. `applyArticleOps` applies a `cell` op to the named table's named row and column (a new table, row
  and cell object; every other object kept), and does nothing when the table, row or column is gone.
  `parseArticleOps` reads a `cell` op's ids (`isArticleId`) and its runs (`normaliseRuns` with the cell caps).
- **Participant rule** (`participant-article.ts`): a `cell` op is writing when it names a table block that is
  there; `table` and `toc` are not in `WRITING_BLOCKS`, so a Participant's put or remove of either is refused.
- **Snapshot, restore, migration**: new optional fields and block types; a tab without them reads as before. An
  older client reading a table or contents block drops it on parse (the block is unknown to it) and never writes
  over it unless it changes that article's writing.

## Behaviour and state

### Tables in the editor

- Schema: `table` (`group: 'block'`, `content: 'table_row+'`, `tableRole: 'table'`, `isolating`, attrs `id`,
  `cols`), `table_row` (`content: '(table_cell | table_header)+'`, attr `id`), `table_cell` / `table_header`
  (`content: 'inline*'`, attrs `colspan`, `rowspan`, `colwidth` for prosemirror-tables, never stored). DOM:
  `<table class="article-block article-table" data-block-id>` `<tbody>` `<tr data-row-id>` `<td>`/`<th>`; the
  stylesheet lays the table as a block, each row a CSS grid on `--article-table-cols` (the shares as `fr`),
  so each row is an ordinary block in the column flow (`break-inside: avoid`).
- Convert: `blockToNode` builds the rows, header-row cells as `table_header` when `header`; `nodeToBlock` reads
  `header` from the first row's cells all being `table_header`, `cols` from the node's `cols` attr, and each cell's
  runs (`runsOf`, capped as on reading).
- `tableColsPlugin` (`appendTransaction`, no history): for every table, `cols` made to match its column count
  (a new column takes the mean share, `normaliseShares`; removed columns' ids dropped from the end of the
  mapping of prosemirror-tables' column index); each row given an id when missing or repeated; a header-row
  flag kept consistent (any `table_header` outside row 0 turned into `table_cell`).
- `blockIdsPlugin` leaves rows alone (the plugin above owns them).
- `tableKeymap` (before `articleKeymap`), only inside a cell: Tab `goToNextCell(1)`, in the last cell
  `addRowAfter` then into it when `reshape`, else stays; Shift-Tab `goToNextCell(-1)`; Enter and Shift-Enter
  a `hard_break`; Backspace at a cell's start and Delete at its end swallowed (`cellEdge`); Mod-Enter falls
  through. With a `CellSelection`, Backspace / Delete empty the cells. Up and Down (`cellArrow`): on a cell's
  first or last line (`view.endOfTextblock`), the cell above or below (`TableMap.nextCell`), past the first or
  last row the block before or after the table; within a cell's lines the browser's. prosemirror-tables' own
  arrows assume block cells, so they never reach an `inline*` cell's neighbour.
- `table` and `table_row` set `allowGapCursor: false`: an `inline*` cell is a textblock, so the gap cursor
  would otherwise stop between cells.
- `backspaceAtStart` with a table before the caret's block moves the caret to the end of the table's last cell,
  deleting the block when it is an empty text block.
- `slashPlugin` never opens inside a cell (`$from.parent` a cell).
- `insertTable` (the slash menu's and Insert's Table): `newArticleTable(3, 3, true)` through
  `insertBlocksAfterCaret` (a paragraph after it when it ends the writing), the caret in the first cell.
- `tableCommand(name)` wraps prosemirror-tables' command, refusing `addRow*` at `MAX_ARTICLE_TABLE_ROWS` and
  `addColumn*` at `MAX_ARTICLE_TABLE_COLS`; `deleteRow` / `deleteColumn` on the only row or column delete the
  table (`deleteTable`); `toggleHeaderRow`. Each one transaction, one commit; `ArticleTableShape` tracked.
- `ArticleTableView` (node view, `ignoreMutation` for its own attributes): sets `--article-table-cols` on
  update; while `reshape` (and never for a touch), a pointer within 5 px of an inner column line marks the table
  `data-grip` with `--article-grip-x`, which the stylesheet draws as the grip line; pointerdown captures the pointer and moves the share between the two columns in screen px divided by
  the table's screen width, each kept at `ARTICLE_TABLE_MIN_SHARE`, previewed on the DOM only; pointerup
  dispatches one `setNodeAttribute(pos, 'cols', …)`; Escape restores the old template and dispatches nothing.

### Repeating the header row

- `repeatBreaks(input)` (pure): for one table, given the column height `H`, the first row's top in its column
  `y0`, the header row's height `hh` and each row's height, walks the rows from row 1: a row that would end past
  `H - REPEAT_SLACK` while something other than a repeated header is above it in its column starts a new column,
  where `y` restarts at `hh`. Returns the indexes of the rows that start a page.
- `ArticleEditor.measure` calls `measureRepeats(view, rootTop, z)` for every table with `header`: the first row's
  rect against the box top (divided by the screen scale) for `y0`, each row's `offsetHeight`, the box's height
  for `H`. When the result differs from `repeatHeaderPlugin`'s state it dispatches the breaks as `repeatHeaderKey` meta (only,
  never committed); the plugin draws, before each break row, a widget `tr.article-table-repeat`
  (`contenteditable=false`, `aria-hidden`, `break-before: column`) holding a copy of the header row's cells
  (`DOMSerializer`), keyed by the table id, the row id and the header's text, so an unchanged repeat is reused.
- The widgets only follow the first row, and the first row's top depends only on what is above the table, so a
  second measure gives the same breaks and the loop settles in one extra frame per table.

### Contents

- Schema: `toc` (`group: 'block'`, atom, selectable, attrs `id`, `depth`); DOM `<nav class="article-block
article-toc" data-block-id aria-label="Contents">`.
- `tocPlugin`: state `{ pages: Map<blockId, number>, decos }`, the pages set by a `tocKey` meta. Its decorations put on every
  `toc` node a node decoration whose spec carries the entries (`articleTocEntries` over the doc's paragraphs) and
  the page of each; the entries are recomputed only on a doc change, and only when the doc holds a `toc`.
- `TocView` (node view): renders "Contents", then an entry per heading (`button.article-toc-entry`,
  `data-toc-target` the heading id, `--toc-level`), its text, a leader and its page number; the depth chips while
  `reshape` (`.article-toc-depth`, buttons, `aria-pressed`), each dispatching `setNodeAttribute(pos, 'depth', …)`.
  A press on an entry (`jumpToHeading`): editable, the caret to the heading's start; for any reader the
  heading's rect to `onRevealCaret` (the view moves for a Viewer too). The chips and the empty hint are
  `.article-chrome`, left out of snapshots and exports.
- `ArticleEditor.measure` calls `measureTocPages(view, pageOf)`: each heading's first client rect's column for
  the page index, dispatched as a `tocKey` meta when it changed (only when the doc has a `toc`, `hasToc`).

### Headers and footers

- `articleTopMarginPx(style)` = max(margin, `ARTICLE_TOP_MIN_PX` + (header ? `ARTICLE_HEADER_BAND_PX` : 0));
  `flowFrame(pages, margin, top)` takes the top from it, so the writing, the zones and the toolbar follow.
- `usePageToolbarPlacement` takes the band off the top room, so the card stays in the 72 px above the band.
- `articleBandsFor(style, index, count, name, date)` → `{ header?: {left, center, right}, footer?: … } | null`:
  null on the first page when `differentFirstPage`; the footer's centre is the page number when Page
  Numbers is on and the footer has no centre; fields filled by `fillBand`.
- `PageBands` draws them in `CanvasPages` (replacing the page number span) from `pageBandLayout`, which
  returns null at once with no header, footer or page numbers; each line `data-page-band`, `aria-hidden`, in the
  page number's look. `pageWriting` pushes the same layout as `text` ops (`bandOps`) for the exports. Today's
  date for `{date}` is worked out once a day (`toLocaleDateString` costs about 1 ms).
- `ArticleBandsSection` in the Style popover: two rows of three inputs, the field buttons, the Different First
  Page switch; a draft per field previewed through `stylePreview`, committed on blur or Enter as one
  `withArticleStyleChanged` patch. A field button puts its field at the caret of the box last focused.

## Interfaces and contracts

- `ArticleOp` gains `cell`; the room relays it inside `article` frames unchanged (frames are op lists).
- `ArticleEditorHandle.links()` → `ArticleLink[]` in canvas px: contents entries (`target` the heading id) and
  `a.article-link` rects (`href`), from the live DOM.
- The PDF export adds `/Annots` to each page from `pdfLinksFor` (`assemblePdf` writes the link objects after
  the pages): a `target` resolves to the page holding the heading (`/Dest [page /Fit]`); an `href` to a `/URI`
  action.
- OpenAPI: `ArticleTableBlock`, `ArticleTocBlock`, `ArticleBand` generated from `@livedocuments/api-schema`.
- Markdown (agents, import): a pipe table ↔ a table block; `[TOC]` / `[TOC 1]` / `[TOC 2]` ↔ a contents block
  (`article-markdown.ts`, `article-markdown-io.ts`).
- Word export: `w:tbl` (`w:tblGrid` from the shares of the text width, `w:tblHeader` on the header row), a TOC
  complex field with cached entries (`w:hyperlink w:anchor` to `_Toc<id>` bookmarks on the headings and the page
  number as shown), `header1.xml` / `footer1.xml` (and empty first-page parts with `w:titlePg`).
- Word import: `w:tbl` → a table block (`tableFromGrid`), `w:tblHeader` on the first row → `header`.

## Errors and edge cases

- A malformed table (no columns, no rows) is dropped on read; ragged rows are padded or cut.
- Past a cap: rows past `MAX_ARTICLE_TABLE_ROWS` or the size are not kept (read), columns past 20 dropped; the
  commands refuse to grow past them; a paste is cut to them.
- A `cell` op for a table, row or column that is gone does nothing (a shape change won).
- An undo of a structure change restores the whole table (one put).
- A contents block with no headings draws only "Contents" (plus the writer's hint).
- A heading on a page past the tab's page limit (cut off) shows the last page's number.
- Bands on a one-page article with Different First Page: none at all.
- A header field longer than the page is clipped at the margins (`overflow: hidden`, `text-overflow: ellipsis`).

## Security and trust

- Cells' runs go through `normaliseRuns` (links only `isSafeArticleHref`, colours only hex); band text is plain
  text, drawn as text nodes, never HTML; the field names are a closed set.
- A pasted table is parsed by the schema's `parseDOM` after `normalisePastedTables` rewrites cell blocks into line
  breaks in a detached document (`DOMParser`, no scripts run, nothing attached).
- PDF link annotations carry only `http`, `https` and `mailto` addresses (escaped as PDF strings).
- The table caps keep one table under a frame, so the room never drops one.

## Performance and limits

- Measured on a 30-page article with 60 headings and a 200-row table (see the PR's Performance section).
- `repeatBreaks` is O(rows) over `offsetHeight` reads taken after layout, once per measure (one frame after a change).
- Contents entries are a single pass over the top-level blocks per doc change, only with a `toc` in the doc;
  page numbers one rect read per heading per measure.
- The header-row widgets are reused by key; a measure that finds the same breaks dispatches nothing.
- `tableCellOps` is O(cells) for a changed table, sending only the changed cells.

## Presentation and UX

- Table: hairlines `color-mix(in srgb, var(--article-ink) 18%, transparent)`, header `font-weight: 650` on
  `color-mix(in srgb, var(--article-accent) 10%, transparent)`; selected cells tinted with the brand selection
  colour; the grip a 2 px brand line on hover, 9 px wide hit area.
- Toolbar Table menu: `MenuRow`s with the toolbar's glyphs; Header Row a checked row; Delete Table last, red.
- Contents: "Contents" in the h2 type, entries in body type, a dotted leader in the muted ink, page numbers
  tabular; hover tints the entry for any reader (it is a link); the depth chips the toolbar's small chip look.
- Bands: 12 px, the page number's colour, single line, ellipsis.
- Style popover: "Header and Footer" section after Page Numbers: two labelled rows (Header, Footer) of three
  inputs (placeholders Left, Centre, Right), then the field chips (Page Number, Page Count, Document Name, Date),
  then Different First Page.

## Accessibility

- The table is a real table (`table`, `tr`, `th`/`td` with `scope="col"` on the header row) whatever its CSS
  display; repeated header rows are `aria-hidden` (a screen reader reads the header once).
- Contents is a `nav` named "Contents", each entry a button named "<heading>, page <n>".
- The grips and chips are pointer affordances; every table command is in the keyboard-reachable Table menu and the
  depth chips are buttons with names ("List Heading 1 to Heading 2").
- Band inputs are labelled ("Header Left", ...); the field buttons name the field they add.

## Web Experience

- prosemirror-tables loads with the lazy `ArticleEditor` chunk, never on first paint.
- The repeat and contents passes run in the measure frame, never in a keystroke's transaction.

## Observability

- `debugLog('[article-table] repeat breaks', …)` when the breaks change; `'[article-toc] pages'` when the
  contents pages change. Telemetry: `ArticleTable` and `ArticleContents` (inserted), `ArticleTableShape` (a row,
  column, header or width change), `ArticleTablePaste` (a paste that makes a table block).

## Testing

- `article-table.test.ts`: parse (caps, ragged rows, shares, ids), `newArticleTable`, `tableFromGrid`,
  `tableCellOps`, `articleTableText`.
- `article-flow-ops.test.ts` additions: cell ops diffed, applied, parsed; two clients' cell edits merge;
  shape change wins.
- `participant-article.test.ts`: a Participant's cell op applies; a table put or a toc put is refused.
- `article-toc.test.ts`, `article-bands.test.ts`, style tests for the header top margin.
- Editor: convert round trip, table commands and keys (`article-table-commands.test.ts`); `repeatBreaks`, column
  helpers, TSV, the contents plugin, band layout and PDF links (`article-table-layout.test.ts`); the table and
  contents views, Up and Down, paste and jumps in a real view (`article-table-view.test.ts`); the toolbar's Table
  menu, the bands section and the page bands (component tests); slash items.
- Markdown: pipe tables and `[TOC]` read and written (`article-markdown.test.ts`, `article-markdown-io.test.ts`).
- Word: export of a table, a contents and bands; import of a table (`docx.test.ts` in both).
- Roles: Editor shapes a table; Participant writes a cell but has no Table menu, no Tab-adds-a-row, no grips, no
  depth chips; Viewer edits nothing, and a contents entry still moves the view (`article-table-view.test.ts`,
  the toolbar's tests).

## Defaults ledger

D99 to D104 in [DEFAULTS.md](DEFAULTS.md).
