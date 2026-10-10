# Sheets engine blueprint

Derived from [Formulas](../formulas.md), [Sheet store](../sheet-store.md) and the pure parts of [Sheet](../sheet.md).
Implementation contract for the `@livediagram/sheets` package: pure TypeScript, no DOM, no dependencies, shared by
the live editor (lazily loaded), the api worker (validation, renders, agents) and the MCP worker.

## Domain and naming

| Spec term         | Identifier                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------ |
| sheet             | `Sheet` (`packages/sheets/src/sheet.ts`)                                                   |
| sheet id          | `Sheet.id` (`SHEET_ID_PATTERN`)                                                            |
| row id, column id | strings in `SheetLayout.rows` / `.cols` (`AXIS_ID_PATTERN`)                                |
| layout            | `SheetLayout`                                                                              |
| cell              | `Cell { input?: CellInput; format?: CellFormat }`, keyed `cellKey(rowId, colId)`           |
| input             | `CellInput`                                                                                |
| value             | `Value` (`packages/sheets/src/formula/values.ts`)                                          |
| format            | `CellFormat`                                                                               |
| range             | `GridRange { r1, c1, r2, c2 }` (positions), `RefRange` (ids, stored)                       |
| cell write        | `SheetWrite` of kind `cells`                                                               |
| layout write      | `SheetWrite` of kind `layout`                                                              |
| sheet rev         | `Sheet.rev`                                                                                |
| selection         | `Selection { ranges: GridRange[]; active: { r, c } }` (`packages/sheets/src/selection.ts`) |

Positions (`r`, `c`) are zero-based indexes into the layout's current order; ids are what is stored. A function
that takes positions says so in its name or parameter (`atPos`); everything stored takes ids.

## Source layout

```
src/limits.ts              every constant in "Constants" below
src/ids.ts                 SHEET_ID_PATTERN, AXIS_ID_PATTERN, makeAxisIds(n, rand), makeSheetId(rand)
src/address.ts             columnLetters(c), columnIndex(letters), parseA1(text), formatA1(r, c), formatRange,
                           parseRangeText, normaliseRange, GridRange
src/sheet.ts               Sheet, SheetLayout, Cell, CellInput, CellFormat, cellKey, emptySheet, emptyLayout,
                           nextSheetTitle, uniqueSheetTitle, copyTitle
src/sheet-json.ts          SheetJson (cells as a list: the wire, the offline record, the Drive file), sheetToJson,
                           sheetFromJson, cellToJson, cellsFromJson
src/layout.ts              LayoutIndex (id -> position maps, memoised per layout object), sizes
src/input.ts               reading a value as typed (numbers, percents, currency, dates, booleans)
src/typed-input.ts         readTypedInput(text, locale, ctx) (formulas included), inputAsText(input, ctx)
src/format.ts              validFormatPatch, mergeFormat (null clears a key), FONT_SIZES, FORMAT_KEYS
src/number-format.ts       formatNumber, displayValue(value, format, locale), for each number format kind
src/format-codes.ts        TEXT()'s format codes
src/dates.ts               serials, parseDateText, parseTimeText (locale day/month order), isoFromSerial and
                           serialFromIso (a card's ISO date to and from a cell's serial)
src/formula/tokens.ts      tokenize(text) -> Token[] (with source offsets for colouring)
src/formula/ast.ts         Node union
src/formula/parse.ts       parseFormula(text) -> { ok: true, ast } | { ok: false, reason: ParseFailure, at }
src/formula/stored.ts      StoredFormula, compile (A1 -> ids), render (ids -> A1), shift for copy, mapFormulaRefs,
                           quoteSheet
src/formula/values.ts      Value, ErrorCode, DEFAULT_WHY, coercions, compareScalars (15 significant digits)
src/formula/criteria.ts    makeCriterion(value) (COUNTIF rules)
src/formula/fn.ts          FnDef and the argument helpers every family shares
src/formula/functions/     math stats logic lookup text date array finance cards conditional (the criteria ranges)
src/formula/registry.ts    FUNCTIONS, FUNCTION_FAMILIES, FUNCTION_NAMES (closed list), CARD_FUNCTION_NAMES
src/formula/function-docs.ts FUNCTION_DOCS (args, a line, an example; read by the editor and the help article)
src/engine/frame.ts        what a formula sees while it is worked out
src/engine/refs.ts         references as rectangles (and INDIRECT's text)
src/engine/evaluate.ts     evaluate(node, frame) -> Value
src/engine/dependencies.ts who reads what, recorded while evaluating; ranges indexed by column
src/engine/spill-shape.ts  which formulas may spill (static)
src/engine/workbook.ts     Workbook: the sheets of one tab, lazy values, spills, cycles, budgets, cards
src/engine/render.ts       renderWindow, renderModelsForTab, sheetFramesOf -> SheetRenderModel (exports, images)
src/store.ts               SheetWrite, applySheetWrite, inverseSheetWrite, mergeSheetChange, rebase
src/chart-data.ts          sheetChartTable (a range as categories and series), regionAround, CHART_*_MAX
src/store-layout.ts        applyLayoutChange (insert, delete, move, order, size, hide, freeze, merge(s), filter, options)
src/validate.ts            validateWrite(sheet, write) -> ok | rejection; validateSheetCreate
src/commands.ts            typeInto, typeIntoRanges, clearRanges, formatRanges, borderRange, merge/unmerge,
                           fillRange, fillFromEdge, splitWrite, stepDecimals, boundedRange
src/commands-axis.ts       insert, append, delete, hide, resize, move, freeze, sort, filter (layout writes)
src/commands-paste.ts      pasteClip, pasteCut, pasteExternal
src/commands-shift.ts      shiftCells: Insert Cells and Delete Cells (built on the cut-paste move)
src/selection.ts           Selection ops: move, extend, jump (Ctrl+arrows), select all, rows, columns, cycle
src/fill.ts                series detection and continuation
src/clipboard.ts           SheetClip, clipFromRange, clipToTsv, clipToHtml, readPastedHtml, readPastedText
src/csv.ts                 parseCsv(text, sep?) (RFC 4180), toCsv(rows)
src/sort.ts                sort key order, sorting rows and ranges
src/filter.ts              FilterCondition, conditionMatches, filteredOutRows, columnValueCounts
src/find.ts                findMatches(workbook, sheetId, query, options), replaceAll(...)
src/cards.ts               CardSource (structural), card rows for the card functions
src/a1-io.ts               agents: readRange, writeRows; AGENT_LOCALE (en-GB)
src/range-names.ts         Named ranges: rangeNameProblem (the name rules and their toasts), findRangeName, sameName,
                           nameHome (own sheet, else the one other sheet with it); RANGE_NAME_MAX 60, RANGE_NAMES_MAX 100
src/sheet-starters.ts      Setup Sheet: SHEET_STARTS / SheetStartId, SHEET_LOOKS / SheetLook, SHEET_CELL_SIZES,
                           SETUP_CARDS_MAX, SheetStarter, sheetStarter(id, now) (Blank, Budget, Tracker, Timesheet,
                           Contacts), SheetSetup, setupWrite (a starter with the look, freeze and sizes as one write),
                           cardsStarter (Plan Cards' header and rows), resetSheetWrite (Clear Sheet)
src/testing/book.ts        test harness: book(spec), calc(formula)
src/index.ts
```

Every file stays under ~400 lines; the function families split by file as above, and `registry.ts` is a flat
catalogue (exempt).

## Types

```ts
type CellInput =
  | { n: number } // a number (dates and times too)
  | { s: string } // text
  | { b: boolean }
  | { f: StoredFormula };
type StoredFormula = { t: string; r: StoredRef[] }; // template + references, below
type StoredRef = {
  s?: string; // another sheet's id
  st?: string; // another sheet by title (no sheet of that title when written)
  r1?: string;
  c1?: string; // first corner ids; absent = whole column / whole row
  r2?: string;
  c2?: string; // second corner (a range), absent for a single cell
  a?: number; // absolute bits: 1 r1, 2 c1, 4 r2, 8 c2
  open?: 'r' | 'c'; // A2:A (open to the last row) / A2:2 (open to the last column)
  spill?: true; // B2#
};
type CellFormat = {
  nf?: NumberFormatKind;
  dp?: number;
  cur?: string; // number format, decimals 0..10, currency symbol
  b?: true;
  i?: true;
  u?: true;
  st?: true; // bold, italic, underline, strikethrough
  fc?: string;
  bg?: string; // #rrggbb text and fill colour
  ff?: string; // a font id (FONT_ID_RE: a-z, digits and -, up to 32); resolved to a stack by the drawing side
  fs?: FontSize; // a whole number, FONT_SIZE_MIN 6 to FONT_SIZE_MAX 96; FONT_SIZES the − / + steps (stepFontSize)
  ha?: 'l' | 'c' | 'r';
  va?: 't' | 'm' | 'b'; // absent is 'm' (middle)
  wr?: 'o' | 'w' | 'c';
  bt?: Border;
  br?: Border;
  bb?: Border;
  bl?: Border; // { w: 1 | 2 | 3, s: 'solid'|'dashed'|'dotted', c: '#rrggbb' }
};
type NumberFormatKind =
  | 'auto'
  | 'number'
  | 'percent'
  | 'currency'
  | 'accounting'
  | 'scientific'
  | 'date'
  | 'time'
  | 'datetime'
  | 'duration'
  | 'text';
type SheetLayout = {
  rows: string[];
  cols: string[];
  rowSize?: Record<string, number>;
  colSize?: Record<string, number>;
  hiddenRows?: string[];
  hiddenCols?: string[];
  frozenRows?: number;
  frozenCols?: number;
  merges?: { r1: string; c1: string; r2: string; c2: string }[];
  filter?: {
    r1: string;
    c1: string;
    r2: string;
    c2: string;
    conds: Record<string, FilterCondition>;
  };
  showGrid?: false; // Sheet Settings; absent shows gridlines
  showHeaders?: false; // absent shows row numbers and column letters
  colWidth?: number; // a line's width unless colSize has it; absent is COLUMN_WIDTH_NEW
  rowHeight?: number; // likewise for rows; absent is ROW_HEIGHT_NEW
  setupPending?: true; // placed from the palette and awaiting Setup Sheet; absent once set up
  cardTables?: CardTable[]; // sheet.md "Card tables"
  names?: RangeName[]; // sheet.md "Named ranges": { name } & IdRange, unique per sheet case aside
};
// A card table: its header row, each column's card field (as the header named it), which row is which card, the
// card type new rows take, the rows edited and not yet saved, and the Controls column just past the table.
type CardTable = {
  id: string;
  head: string; // row id
  cols: { c: string; field: string }[];
  rows: Record<string, string>; // row id -> item id
  type: string;
  drafts?: string[]; // row ids
  controls?: string; // column id
};
type Sheet = {
  id: string;
  tabId: string;
  title: string;
  layout: SheetLayout;
  cells: Map<string, Cell>; // cellKey(rowId, colId) = `${rowId}:${colId}`
  rev: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: SheetPerson;
};
```

- The template `t` is the formula text with each reference replaced by `@<index>` into `r`; `@` is not otherwise
  valid outside a string literal (the tokenizer refuses it in typed formulas), so a template never collides.
- The wire format of `Sheet` is `SheetDto` (`packages/api-schema/src/sheets.ts`): `cells` as an array of
  `{ r, c, i?, f? }` (row id, column id, input, format) so it is JSON.

## Typed input (`readTypedInput`)

Order of reading, first match wins (spec formulas.md "What a typed input becomes"):

1. Current format `text` → `{ s }` (as typed, no trim).
2. Leading `'` → `{ s: rest }`.
3. Leading `=` (and length > 1) → `parseFormula`; ok → `compileFormula` → `{ f }`; else the failure (the editor
   shows it; agents get `formula_invalid`).
4. `true` / `false` (any case, trimmed) → `{ b }`.
5. Number forms (trimmed): optional sign, currency prefix from `CURRENCY_SYMBOLS` (hint `currency`, `cur`), digits
   with the locale's group separator, the locale's decimal mark, exponent; trailing `%` (hint `percent`, value / 100).
6. Date / time / date-time (`parseDateText`, `parseTimeText`): ISO `yyyy-mm-dd[ hh:mm[:ss]]`; numeric `d/m/y` or
   `m/d/y` by locale (`localeDayFirst(locale)` from `Intl.DateTimeFormat(locale).formatToParts`), 2-digit years
   as 2000 + y below 70 else 1900 + y; `d mmm yyyy`, `mmm d yyyy` with English month names; times `h:mm[:ss]`
   with optional `am`/`pm`. Hint `date`, `time` or `datetime`.
7. Empty after trim → clear (no input).
8. Otherwise `{ s: text }`.

`formatHint` is applied only when the cell's `nf` is unset or `auto`. Agent inputs use locale `en-GB`.

## Formula language

### Tokens

`number`, `string` (double quotes, `""` escape), `bool` (`TRUE`/`FALSE` not followed by `(`), `ref` (A1 cell, with
`$`s; column-only `A:C`; row-only `2:4` handled in the parser from `number ':' number`), `sheetRef` (`Name!` or
`'Quoted Name'!`, `''` escape), `func` (name followed by `(`; names `[A-Z][A-Z0-9.]*`, case-insensitive, stored
upper), `op` (`+ - * / ^ & = <> < > <= >= % :`), `(`, `)`, `,`, `;` (inside `{}`), `{`, `}`, `#` (spill suffix,
directly after a ref), `error` literals (`#N/A`, `#REF!`, ...), `stored` (`@n`, only in templates), whitespace
(kept as trivia for offsets). Every token carries `start`, `end` source offsets.

### Grammar (precedence climbing)

```
formula   := '=' expr
expr      := compare
compare   := concat (( '=' | '<>' | '<' | '>' | '<=' | '>=' ) concat)*
concat    := additive ('&' additive)*
additive  := term (('+' | '-') term)*
term      := power (('*' | '/') power)*
power     := unary ('^' unary)*            // left-associative, as Sheets
unary     := '-' unary | '+' unary | postfix
postfix   := range '%'*
range     := primary (':' primary)?        // both sides refs (same sheet prefix allowed on the first only)
primary   := number | string | bool | error | ref '#'? | sheetRef ref | call | '(' expr ')' | array
call      := func '(' (expr (',' expr)*)? ')'   // empty arguments allowed: f(a,,b)
array     := '{' row (';' row)* '}'; row := literal (',' literal)*
```

`ParseFailure` (closed): `unexpected_token`, `missing_close_bracket`, `missing_open_bracket`,
`unterminated_string`, `bad_reference`, `unknown_sheet_quote`, `too_long` (> `FORMULA_MAX`), `too_deep`
(> `FORMULA_DEPTH_MAX`), `empty`, `array_ragged`. Each has editor copy in `PARSE_FAILURE_COPY` ("There's a missing
closing bracket", ...). Unknown function names parse (they evaluate to `#NAME?`).

### Stored form

- `compileFormula(ast, { layout, sheetId, titles })`: each reference becomes a `StoredRef` with the ids at its
  positions in the target sheet's layout (another sheet: resolved by `titles` (title → id, case-insensitive) to
  `s`, else `st`). A position past the target's grid is kept as a `#REF!` error literal in the template. The
  template is re-emitted from tokens with normalised spacing kept as typed.
- `renderFormula(stored, ctx)`: replaces each `@n` with A1 text from the current layouts (a missing id renders
  `#REF!`; a range whose corner id is missing renders the shrunk range from the corner that remains, or `#REF!`
  when both are gone), `s` renders the sheet's current title (quoted when needed), `st` the stored title.
- `storedAst(stored)` parses the template once and caches by object identity (a `WeakMap`).
- `shiftForCopy(stored, dr, dc, from, to)`: relative parts move by `dr`/`dc` positions in the target layout; a
  part moved off the grid becomes `#REF!`. Used by copy-paste, fill and Ctrl+Enter. Cut-paste does not shift:
  the moved cells keep their stored refs, and refs to the moved cells are rewritten (`rewriteRefsForMove`).

### Values and coercion

- `Value = number | string | boolean | null (empty) | SheetError | ValueArray` where `SheetError = { e: ErrorCode }`
  and `ValueArray = { rows: Value[][] }`.
- `toNumber`: number; boolean 1/0; empty 0; text by `readTypedInput` number/date rules in `en-US`-agnostic form
  (`.` decimal only) else `#VALUE!`. `toText`: numbers with up to 15 significant digits, no grouping; booleans
  `TRUE`/`FALSE`. Comparisons: numbers < text < booleans across kinds (as Sheets); text case-insensitive.
- Float display rounding to 15 significant digits (`roundSignificant`), so `=0.1+0.2` shows `0.3`.

### Functions

- `FunctionDef = { min: number; max: number /* Infinity */; impl; volatile?: true; lazy?: true; arrayArgs?: number[];
returnsArray?: true }`. `lazy` functions (`IF`, `IFS`, `SWITCH`, `IFERROR`, `IFNA`, `AND`, `OR`, `CHOOSE`) get
  thunks so unused branches are not evaluated.
- The closed name list is exactly formulas.md's catalogue. `FUNCTION_DOCS[name] = { args: string[]; summary;
example }` feeds autocomplete, the hint card and the help article; a test checks the docs, the registry and
  formulas.md list the same names.
- A call whose argument count is outside `min..max` evaluates to `#N/A` with the reason "Wrong number of
  arguments to SUM. Expected at least 1", which the editor shows on hover.
- Scalar functions applied to an array argument broadcast (lift) element-wise, producing an array, unless the
  parameter is in `arrayArgs` (aggregates take ranges as they are).
- `REGEX*`: compiled with `new RegExp(pattern, 'u')`; each call checks a time budget (`REGEX_BUDGET_MS`) using a
  counter of characters scanned (`text.length * pattern.length` > `REGEX_WORK_MAX` → `#VALUE!`), since a
  regex cannot be interrupted.
- `INDIRECT` / `OFFSET` build refs at evaluation time against the tab's sheets; their dependents are volatile.
- `TODAY`/`NOW` read `frame.now()` (injected; tests pin it).
- Card functions read `frame.cards: CardSource | null` (null → the cell shows `Loading…`, a `pending` marker, not
  an error). `CardSource = { cards(): readonly CardRow[]; fieldOf(card, name): Value | undefined; version: number }`
  built by the caller from items and types (the editor in its sheet chunk, the api and MCP from the store).

### Workbook and recalculation

- `new Workbook({ sheets, now, cards, locale })` holds the sheets of one tab. `values(sheetId)` returns the computed
  `Value` grid lazily per cell; `setCards(source)`, `applyChange(change)` (from `store.ts`) and `recalc()`.
- **Dependency graph**: for each formula cell, its precedent refs resolved to `(sheetId, rowId|*, colId|*)` cells and
  ranges. Single-cell precedents go in a `Map<cellId, Set<formulaCell>>`; ranges in a per-sheet interval index
  (`RangeIndex`: ranges bucketed by column id, each bucket a sorted array of row-position intervals rebuilt on layout
  change), so `dependentsOf(cell)` is O(log n + hits).
- **Dirty propagation**: a change marks the changed cells, then walks dependents breadth-first (each once), plus
  every volatile cell and, when cards changed, every card-function cell. Evaluation is on demand with memo; a cell
  re-entered while on the evaluation stack is a cycle: every cell on the stack from it is `#REF!` with reason
  `cycle` (the path kept for the hover).
- **Spills**: a formula's array value claims the rectangle below and right; a claimed cell with its own input, or
  another formula's claim, makes the formula `#SPILL!` (reason names the blocker). Claims are tracked in a
  `SpillMap` (cell → owner); a change to a cell inside a claim re-checks its owner.
- **Budget**: each recalc counts cell reads; past `RECALC_READS_MAX` it stops, marks unreached dirty cells
  `#NUM!` with reason `too_large`, and returns `{ truncated: true }` (the editor toasts the spec's line once). A
  single range of more than `RANGE_CELLS_MAX` cells read at once is `#NUM!`. Whole-column refs read only to the last
  filled row (`layoutSize` plus the sheet's filled extent).
- **Incremental**: `recalc()` returns `{ changed: Set<cellId> }` so views redraw only those. Slicing over frames is
  the editor's (it calls `recalcSome(budgetMs)`); the engine keeps the dirty queue between calls.

## Writes (`store.ts`)

```ts
type CellChange = {
  r: string;
  c: string;
  i?: CellInput | null;
  f?: Partial<Record<keyof CellFormat, unknown>> | null;
};
type LayoutChange =
  | { k: 'insertRows' | 'insertCols'; after: string | null; ids: string[] }
  | { k: 'deleteRows' | 'deleteCols'; ids: string[] }
  | { k: 'moveRows' | 'moveCols'; ids: string[]; after: string | null }
  | { k: 'orderRows' | 'orderCols'; ids: string[] } // a whole-sheet sort: the ids it reorders, in their new order
  | { k: 'size'; axis: 'r' | 'c'; ids: string[]; px: number | null }
  | { k: 'hide'; axis: 'r' | 'c'; ids: string[]; hidden: boolean }
  | { k: 'freeze'; rows?: number; cols?: number }
  | { k: 'cardTable'; id: string; table: CardTable | null } // a card table set whole, or removed
  // Sheet Settings: each key given is set; a size of null is the default again. Sizes are integers within
  // [COLUMN_WIDTH_MIN | ROW_HEIGHT_MIN, AXIS_SIZE_MAX]; a seeded layout is held to the same.
  | {
      k: 'options';
      showGrid?: boolean;
      showHeaders?: boolean;
      colWidth?: number | null;
      rowHeight?: number | null;
      setupPending?: boolean; // false ends setup, true shows Setup Sheet again
    }
  | { k: 'merge'; range: IdRange }
  | { k: 'unmerge'; range: IdRange }
  | { k: 'merges'; merges: IdRange[] } // every merge at once (the undo of a deletion that shrank some)
  | { k: 'filter'; filter: SheetLayout['filter'] | null }
  | { k: 'filterCond'; col: string; cond: FilterCondition | null };
type SheetWrite =
  | { kind: 'cells'; cells: CellChange[] }
  | { kind: 'layout'; changes: LayoutChange[]; cells?: CellChange[] } // merge's cleared cells ride along
  | { kind: 'title'; title: string };
```

- `CellChange.i`: absent = keep, `null` = clear, a value = set. `f`: absent = keep, `null` = clear every key, an
  object = per-key set (`null` per key clears it), applied with `mergeFormat`. A cell with no input and no format
  is removed.
- `applySheetWrite(sheet, write, ctx)` returns `{ sheet, applied }` where `applied` is the write as it landed
  (ids that no longer exist dropped, `insert after` a gone id resolved to its stored neighbour or the end), which
  is what the api stores and relays and every client applies. Deleting rows or columns removes their cells and
  merges/filters touching them shrink or go; card tables lose the deleted rows' links and drafts, a table whose
  header row or every column went is gone, and a deleted Controls column is dropped (`store-layout.ts`). The
  inverse (`inverseSheetWrite`) restores each card table as it was, links and drafts of the deleted lines included. Pure, used by the api, the offline store and the editor's optimistic
  apply, so all converge.
- `inverseSheetWrite(before, applied)`: cells → their old inputs and formats (exact keys touched); insert → delete
  of the same ids; delete → insert of the same ids after their old neighbours, plus their cells and sizes; move →
  move back after the old neighbour; orderRows → the old order; size/hide/freeze/merge/filter/options → old values;
  title → old title.
- `mergeSheetChange(local, op)`: applies a room change when `op.rev === local.rev + 1`; `<=` is a duplicate
  (ignored); a gap returns `'refetch'`.
- `writeTouches(write)`: the set of cells / axes touched, for the undo journal and presence.

## Validation (`validate.ts`)

`validateWrite(sheet, write)` → `{ ok: true }` or `{ ok: false, error: SheetRejection, at? }` with
`SheetRejection` closed: `sheet_too_large` (rows > `SHEET_ROWS_MAX` or cols > `SHEET_COLS_MAX` after the write),
`sheet_full` (cells > `SHEET_CELLS_MAX` or bytes > `SHEET_BYTES_MAX`), `input_too_long`, `formula_invalid`
(template re-parse fails, a ref index out of bounds, `@` misuse), `format_invalid` (unknown key, bad colour,
size, decimals), `axis_id_invalid` (pattern, or an insert reusing a live id), `title_invalid` (empty or >
`SHEET_TITLE_MAX`), `merge_invalid` (overlap, or > `SHEET_MERGES_MAX`), `filter_invalid`, `write_too_large`
(> `SHEET_WRITE_CELLS_MAX` cells or > `SHEET_WRITE_BYTES_MAX`). `validateSheetCreate` checks a whole sheet the
same way.

## Clipboard, CSV, fill, sort, filter, find

- `SheetClip = { rows: number; cols: number; cells: (Cell | null)[][]; from?: { sheetId; r; c }; cut?: true }`,
  serialised to the clipboard as `web application/x-livediagram-sheet+json` where supported, with `text/plain`
  (TSV of displayed values) and `text/html` (a `<table>` with inline `font-weight`, `font-style`, `color`,
  `background-color`, `text-align`). `readPastedHtml(html)` tokenises `<table>/<tr>/<td|th>` with `colspan`/
  `rowspan` and the same inline styles plus `<b>/<i>/<u>/<s>`, without a DOM (a small tag scanner; entities via a
  table of the common named ones plus numeric). `readPastedText` splits by tab when any line holds a tab, else by
  comma when every line parses as CSV with the same column count > 1, else one column.
- `parseCsv` is RFC 4180 (quoted fields, `""`, CRLF or LF, a final newline), cut at `SHEET_ROWS_MAX` ×
  `SHEET_COLS_MAX` with `truncated` set. `toCsv` quotes fields holding `,`, `"`, CR or LF.
- `detectSeries(values)`: all numbers with a constant step → arithmetic; all dates with a constant day step, or the
  same day of month a month apart → date series; text with a trailing integer and the same prefix → number series;
  English month (`Jan`/`January`) and day names (`Mon`/`Monday`), case kept → cyclic; else copy. A single number
  copies (Sheets) unless Ctrl is held, which increments by 1.
- `sortKeyCompare` implements the spec order (numbers, text case-insensitive by `localeCompare(…, 'en', { sensitivity:
'base', numeric: true })`, booleans, errors, empty last both ways), stable.
- `FilterCondition = { values?: string[] /* displayed texts kept */; op?: ConditionOp; a?: string; b?: string }` with
  `ConditionOp` the spec's list. `visibleRowsAfterFilter(workbook, sheetId)` returns the hidden row ids.
- `findMatches` scans filled cells in row-major order of the layout; `replaceAll` returns one `cells` write of the
  changed inputs (text inputs and formula templates' string literals only when "Also Search Formulas"; formulas'
  values are never replaced), with the count.

## Errors and edge cases

| Case                                       | Handling                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| A stored ref's row or column deleted       | Renders and evaluates `#REF!`                                                 |
| A range with one corner deleted            | Shrinks to the remaining corner's side (renders the shrunk range)             |
| Reference to a sheet title not on the tab  | `st` kept; `#REF!` until a sheet of that title exists; resolves live          |
| Two sheets on a tab share a title (a race) | References resolve to the earlier-created; the api refuses new duplicates     |
| Cycle                                      | `#REF!` on each cell in the loop; reason `cycle` with the path                |
| Spill blocked                              | `#SPILL!` with the blocker's A1                                               |
| Formula evaluated before cards loaded      | `pending`; drawn `Loading…`                                                   |
| Recalc past the budget                     | `#NUM!` with reason `too_large` on unreached cells; `truncated` returned      |
| Number overflow / NaN                      | `#NUM!`                                                                       |
| Date before serial 0 or after 9999-12-31   | `#NUM!` from date functions; displayed as the number                          |
| Merge over filled cells                    | `commands.mergeRange` reports `{ needsConfirm: true }`; the write clears them |
| Paste larger than the grid                 | Grid grows up to the limits; the rest cut, `truncated` reported               |
| Undo of a deleted row                      | Inverse re-inserts the same ids at the old neighbour, with its cells          |

## Security and trust

- The engine runs untrusted inputs (any editor or agent) in every viewer's browser and in workers: no `eval`, no
  `Function`, no prototype access (values are plain data; the registry is a `Map`-like frozen object looked up by
  upper-cased own keys only).
- Every loop is bounded: recalc reads (`RECALC_READS_MAX`), range size (`RANGE_CELLS_MAX`), formula length and depth,
  regex work (`REGEX_WORK_MAX`), text results (`TEXT_RESULT_MAX`, longer → `#VALUE!`), `REPT`, `SEQUENCE` and
  array results (`ARRAY_CELLS_MAX`).
- `HYPERLINK` targets are kept only when `http:`, `https:` or `mailto:`; others render the label as text.
- Pasted HTML is scanned, never inserted into the DOM; only the listed styles are read, colours normalised to
  `#rrggbb`.

## Performance and limits

- Worst case sheet: 50,000 filled cells. Budget: build the workbook and evaluate every cell of a 50,000-cell sheet
  of which 20,000 are formulas (`SUM` over 10-cell ranges and chained references) in under 400 ms on a laptop in
  Node; a single-cell edit with 100 dependents recalculates in under 5 ms. Both are tests
  (`packages/sheets/src/engine/perf.test.ts`, run with a generous CI multiplier).
- Layout index lookups are O(1) (`Map` per layout object, built once, O(rows + cols)).
- `renderWindow` touches only the cells in its window (plus their precedents on demand).
- Parse cache: one `storedAst` per stored formula object; inputs are immutable, so identity is a sound key.

## Observability

Pure package: no logging. It returns reasons (`ParseFailure`, `SheetRejection`, error reasons, `truncated`) that
callers log with their fingerprints ([sheet-store blueprint](sheet-store.md#observability)).

## Testing

Every path is under `packages/sheets/src/`.

| Rule                                                                     | Test                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| A1 ⇄ positions, column letters to GR and beyond                          | `address.test.ts`                                                                  |
| Typed input table, per locale, Plain Text, `'`                           | `input.test.ts`                                                                    |
| Number formats and `TEXT` codes, locales                                 | `number-format.test.ts`                                                            |
| Formats validated and merged                                             | `format.test.ts`                                                                   |
| Date serials, parsing, leap years, 1900 boundary                         | `dates.test.ts`                                                                    |
| Tokenizer offsets, grammar, precedence, every failure                    | `packages/sheets/src/formula/parse.test.ts`                                        |
| Compile / render round trip; deleted ids; shrink; titles                 | `packages/sheets/src/formula/stored.test.ts`                                       |
| Copy shift, absolute parts, off-grid `#REF!`                             | `packages/sheets/src/formula/stored.test.ts`                                       |
| Every function: a happy path, an edge, an error                          | `formula/functions/*.test.ts`                                                      |
| Card functions                                                           | `packages/sheets/src/formula/functions/array-finance-cards.test.ts` ("Plan cards") |
| Registry = docs = formulas.md list                                       | `packages/sheets/src/formula/registry.test.ts`                                     |
| Criteria and wildcards                                                   | `packages/sheets/src/formula/criteria.test.ts`                                     |
| Recalc: dependents, volatile, cycles, spills, cross-sheet                | `packages/sheets/src/engine/workbook.test.ts`, `edges.test.ts`                     |
| Budget truncation and perf budgets                                       | `packages/sheets/src/engine/perf.test.ts`                                          |
| apply/inverse round trip for every write kind; merge, rebase             | `store.test.ts`                                                                    |
| Validation, every rejection                                              | `validate.test.ts`, `edges.test.ts` ("validation edges")                           |
| Typing, clearing, formats, merges, fill, split, rows                     | `commands.test.ts`                                                                 |
| Insert Cells and Delete Cells                                            | `commands-shift.test.ts`                                                           |
| Clipboard TSV/HTML both ways, cut moves, find, filter, render, agents A1 | `paste-io.test.ts`                                                                 |
| CSV RFC 4180; series detection and fill                                  | `fill-csv.test.ts`                                                                 |
| Sort order and stability                                                 | `edges.test.ts` ("sort order")                                                     |
| Selection moves, Ctrl+arrow jumps                                        | `selection.test.ts`                                                                |
| Ids, layout, sheet titles                                                | `layout.test.ts`                                                                   |

## Constants and configuration

| Constant                | Value                              | Provenance / safe range                                   |
| ----------------------- | ---------------------------------- | --------------------------------------------------------- |
| `SHEET_ROWS_NEW`        | 100                                | Spec; a new sheet's rows                                  |
| `SHEET_COLS_NEW`        | 26                                 | Spec; A to Z                                              |
| `SHEET_ROWS_MAX`        | 10000                              | Spec; 1,000–50,000 (layout JSON ~70 KB at 10,000)         |
| `SHEET_COLS_MAX`        | 200                                | Spec; A to GR                                             |
| `SHEET_CELLS_MAX`       | 50000                              | Spec; bounds the GET and the recalc                       |
| `SHEET_BYTES_MAX`       | 4194304                            | Spec; 4 MB of stored cells                                |
| `DOCUMENT_SHEETS_MAX`   | 200                                | Spec                                                      |
| `DOCUMENT_CELLS_MAX`    | 200000                             | Spec                                                      |
| `INPUT_MAX`             | 10000                              | Spec; characters                                          |
| `FORMULA_MAX`           | 8000                               | Spec; characters                                          |
| `FORMULA_DEPTH_MAX`     | 64                                 | Spec; nesting                                             |
| `SHEET_TITLE_MAX`       | 60                                 | Spec                                                      |
| `SHEET_FREEZE_ROWS_MAX` | 100                                | Default (D16)                                             |
| `SHEET_FREEZE_COLS_MAX` | 26                                 | Default (D16)                                             |
| `SHEET_MERGES_MAX`      | 1000                               | Spec                                                      |
| `SHEET_SIZED_AXES_MAX`  | 5000                               | Spec                                                      |
| `SHEET_WRITE_CELLS_MAX` | 5000                               | Spec; a write's cells                                     |
| `SHEET_WRITE_BYTES_MAX` | 1048576                            | Default (D2); one D1 parameter stays well under D1's 2 MB |
| `RECALC_READS_MAX`      | 5000000                            | Spec                                                      |
| `RANGE_CELLS_MAX`       | 1000000                            | Spec                                                      |
| `ARRAY_CELLS_MAX`       | 100000                             | Default (D3)                                              |
| `TEXT_RESULT_MAX`       | 10000                              | Matches `INPUT_MAX`                                       |
| `REGEX_WORK_MAX`        | 10000000                           | Default (D4); about 50 ms of scanning                     |
| `COLUMN_WIDTH_NEW`      | 120                                | Spec; px                                                  |
| `ROW_HEIGHT_NEW`        | 28                                 | Spec; px                                                  |
| `COLUMN_WIDTH_MIN`      | 24                                 | Spec                                                      |
| `ROW_HEIGHT_MIN`        | 18                                 | Spec                                                      |
| `SHEET_ID_PATTERN`      | `/^[A-Za-z0-9_-]{6,32}$/`          | As items' ids                                             |
| `AXIS_ID_PATTERN`       | `/^[a-z0-9]{4,12}$/`               | 6-char random base-36 ids by default; collisions refused  |
| `CURRENCY_SYMBOLS`      | `£ $ € ¥ ₹ ₩ ₽ ₺ ₪ ₫ R$ CHF kr zł` | Common symbols; extendable                                |

## Named ranges

- `LayoutChange` `{ k: 'name'; name; range: IdRange | null }` sets (replacing any spelling of the name) or removes a
  name; its inverse puts back the name as it was. `deleteRows` / `deleteCols` shrink names as merges (`shrinkRange`),
  dropping one whose cells all went; their inverse restores every name. `validateWrite` takes a name only when
  `rangeNameProblem` (allowing its own spelling) is null and its four ids are on the sheet; `validateSheetCreate` holds
  a seed's names to the same. `resetSheetWrite` removes them all.
- `SheetsCtx.name(name)` (Workbook `ctxFor`) resolves through `nameHome` and `posRangeOf` to a `PosRef` (absolute);
  `evaluate` reads a `name` node as that range (`#NAME?` "Unknown name X" when none). Names live on the layout, so any
  name change resets the workbook like any layout change: no extra dependency edges.
