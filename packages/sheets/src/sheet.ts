// The sheet model (docs/specs/029-sheets/sheet-store.md "What a sheet is", blueprint sheets-engine.md "Types").
// Cells are keyed by row id and column id, never by position: a row's place is only its index in the layout.
import { makeAxisIds, type Rand } from './ids';
import { SHEET_COLS_NEW, SHEET_ROWS_NEW, SHEET_TITLE_MAX } from './limits';

// A reference in a stored formula, by ids (blueprint "Stored form"). Absent corner ids mean a whole column (no
// rows) or a whole row (no columns).
export type StoredRef = {
  // Another sheet, by id; or by title when no sheet of that title existed when it was written.
  s?: string;
  st?: string;
  r1?: string;
  c1?: string;
  r2?: string;
  c2?: string;
  // Absolute bits: 1 the first row, 2 the first column, 4 the second row, 8 the second column.
  a?: number;
  // Open-ended: `A2:A` runs to the last row ('r'), `A2:2` to the last column ('c').
  open?: 'r' | 'c';
  // `B2#`: the whole spilled range of B2.
  spill?: true;
  // A reference to a sheet by title (`st`) keeps positions, as there was no layout to take ids from:
  // [r1, c1, r2, c2], -1 where a part is absent.
  p?: [number, number, number, number];
};

// A formula as stored: its text with each reference replaced by `@<index>` into `r`.
export type StoredFormula = { t: string; r: StoredRef[] };

export type CellInput = { n: number } | { s: string } | { b: boolean } | { f: StoredFormula };

export type BorderStyle = 'solid' | 'dashed' | 'dotted';
export type Border = { w: 1 | 2 | 3; s: BorderStyle; c: string };

export type NumberFormatKind =
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

// A whole number of points, FONT_SIZE_MIN to FONT_SIZE_MAX (format.ts); FONT_SIZES are the steps − and + take.
export type FontSize = number;

export type CellFormat = {
  nf?: NumberFormatKind;
  dp?: number;
  cur?: string;
  b?: true;
  i?: true;
  u?: true;
  st?: true;
  fc?: string;
  bg?: string;
  fs?: FontSize;
  ha?: 'l' | 'c' | 'r';
  va?: 't' | 'm' | 'b';
  wr?: 'o' | 'w' | 'c';
  bt?: Border;
  br?: Border;
  bb?: Border;
  bl?: Border;
};

export type Cell = { input?: CellInput; format?: CellFormat };

// A rectangle by ids (merges, the filter's range, presence).
export type IdRange = { r1: string; c1: string; r2: string; c2: string };

export type ConditionOp =
  | 'empty'
  | 'notEmpty'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'exactly'
  | 'dateBefore'
  | 'dateAfter'
  | 'dateOn'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'eq'
  | 'neq';

// A column's filter: the displayed values kept (Filter by Values) and/or a condition (Filter by Condition).
export type FilterCondition = { values?: string[]; op?: ConditionOp; a?: string; b?: string };

export type SheetFilter = IdRange & { conds: Record<string, FilterCondition> };

export type SheetLayout = {
  rows: string[];
  cols: string[];
  rowSize?: Record<string, number>;
  colSize?: Record<string, number>;
  hiddenRows?: string[];
  hiddenCols?: string[];
  frozenRows?: number;
  frozenCols?: number;
  merges?: IdRange[];
  filter?: SheetFilter;
  // The sheet's own look, from the Sheet's settings (docs/specs/029-sheets/sheet.md "Sheet Settings"); absent is the
  // default: gridlines and headers shown, lines COLUMN_WIDTH_NEW wide and ROW_HEIGHT_NEW tall unless sized.
  showGrid?: false;
  showHeaders?: false;
  colWidth?: number;
  rowHeight?: number;
  // A sheet placed from the palette, not set up yet (sheet.md "Setup Sheet"): the Setup Sheet card shows while it
  // has no cells.
  setupPending?: true;
  // Card tables (sheet.md "Card tables"): ranges of rows that are Plan cards, kept in step both ways.
  cardTables?: CardTable[];
  // Named ranges (docs/specs/029-sheets/sheet.md "Named ranges"): each a name and the cells it covers, by id.
  names?: RangeName[];
};

// A card table: its header row, each column's card field (as the header named it), which row is which card (row
// id to item id), and the card type new rows take.
// A named range: its name as given (looked up case aside) and its cells, as a merge's, by row and column ids.
export type RangeName = { name: string } & IdRange;

export type CardTable = {
  id: string;
  head: string;
  cols: { c: string; field: string }[];
  rows: Record<string, string>;
  type: string;
  // Rows edited and not yet saved to their cards (Save or Cancel on the row): cards leave them alone meanwhile.
  drafts?: string[];
  // The column, just past the table's, whose cells hold a draft row's Save and Cancel.
  controls?: string;
};

export type SheetPerson = { id: string; name: string; color: string };

export type Sheet = {
  id: string;
  tabId: string;
  title: string;
  layout: SheetLayout;
  cells: Map<string, Cell>;
  rev: number;
  createdAt: number;
  updatedAt: number;
  updatedBy: SheetPerson;
};

export function cellKey(rowId: string, colId: string): string {
  return `${rowId}:${colId}`;
}

export function splitCellKey(key: string): { r: string; c: string } {
  const i = key.indexOf(':');
  return { r: key.slice(0, i), c: key.slice(i + 1) };
}

export function emptyLayout(
  rand: Rand = Math.random,
  rows = SHEET_ROWS_NEW,
  cols = SHEET_COLS_NEW,
): SheetLayout {
  const ids = makeAxisIds(rows + cols, rand);
  return { rows: ids.slice(0, rows), cols: ids.slice(rows) };
}

export const NOBODY: SheetPerson = { id: '', name: 'Someone', color: '#94a3b8' };

export function emptySheet(init: {
  id: string;
  tabId: string;
  title: string;
  layout?: SheetLayout;
  now?: number;
  by?: SheetPerson;
  rand?: Rand;
}): Sheet {
  const now = init.now ?? 0;
  return {
    id: init.id,
    tabId: init.tabId,
    title: init.title,
    layout: init.layout ?? emptyLayout(init.rand),
    cells: new Map(),
    rev: 0,
    createdAt: now,
    updatedAt: now,
    updatedBy: init.by ?? NOBODY,
  };
}

// The next free "Sheet N" title among `taken` (case ignored), as a placed sheet is named.
export function nextSheetTitle(taken: readonly string[], base = 'Sheet'): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  for (let n = 1; ; n++) {
    const title = `${base} ${n}`;
    if (!lower.has(title.toLowerCase())) return title;
  }
}

// A title asked for (a dropped file's name), kept unique among `taken`: as it is, else "<title> 2", "<title> 3", ...
// Trimmed to the title limit; an empty one becomes the next "Sheet n".
export function uniqueSheetTitle(wanted: string, taken: readonly string[]): string {
  const base = wanted
    .trim()
    .slice(0, SHEET_TITLE_MAX - 4)
    .trim();
  if (!base) return nextSheetTitle(taken);
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const title = `${base} ${n}`;
    if (!lower.has(title.toLowerCase())) return title;
  }
}

// A copy's title: "<title> (copy)", then "(copy 2)", ... kept unique among `taken`.
export function copyTitle(title: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((t) => t.toLowerCase()));
  const first = `${title} (copy)`;
  if (!lower.has(first.toLowerCase())) return first;
  for (let n = 2; ; n++) {
    const t = `${title} (copy ${n})`;
    if (!lower.has(t.toLowerCase())) return t;
  }
}
