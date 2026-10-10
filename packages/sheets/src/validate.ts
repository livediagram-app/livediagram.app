// Validation of writes and new sheets (blueprint sheets-engine.md "Validation"): the api runs it on every write
// before storing, against the sheet as stored; the editor runs it before sending, so a refusal is said at once.
import { validFormatPatch, validFormat } from './format';
import { isAxisId, isSheetId } from './ids';
import { storedAst } from './formula/stored';
import { tokenize } from './formula/tokens';
import {
  FORMULA_MAX,
  INPUT_MAX,
  SHEET_BYTES_MAX,
  SHEET_CELLS_MAX,
  SHEET_COLS_MAX,
  SHEET_FREEZE_COLS_MAX,
  SHEET_FREEZE_ROWS_MAX,
  SHEET_MERGES_MAX,
  SHEET_ROWS_MAX,
  SHEET_SIZED_AXES_MAX,
  SHEET_TITLE_MAX,
  SHEET_WRITE_BYTES_MAX,
  SHEET_WRITE_CELLS_MAX,
  AXIS_SIZE_MAX,
  CARD_TABLES_MAX,
  RANGE_NAMES_MAX,
  CARD_TABLE_ROWS_MAX,
  COLUMN_WIDTH_MIN,
  ROW_HEIGHT_MIN,
} from './limits';
import { posRangeOf } from './layout';
import { applySheetWrite, type CellChange, type SheetWrite } from './store';
import { applyLayoutChange, type LayoutChange } from './store-layout';
import { rangeNameProblem } from './range-names';
import { isFilterCondition } from './filter';
import {
  NOBODY,
  type Cell,
  type CellInput,
  type IdRange,
  type Sheet,
  type SheetLayout,
  type StoredRef,
} from './sheet';

export type SheetRejection =
  | 'sheet_too_large'
  | 'sheet_full'
  | 'input_too_long'
  | 'formula_invalid'
  | 'format_invalid'
  | 'axis_id_invalid'
  | 'title_invalid'
  | 'merge_invalid'
  | 'filter_invalid'
  | 'write_too_large'
  | 'write_invalid';

export type Validation = { ok: true } | { ok: false; error: SheetRejection; at?: string };

const no = (error: SheetRejection, at?: string): Validation => ({
  ok: false,
  error,
  ...(at ? { at } : {}),
});
const OK: Validation = { ok: true };

function isStoredRef(v: unknown): v is StoredRef {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  for (const [k, x] of Object.entries(r)) {
    switch (k) {
      case 's':
        if (!isSheetId(x)) return false;
        break;
      case 'st':
        if (typeof x !== 'string' || x.length === 0 || x.length > SHEET_TITLE_MAX) return false;
        break;
      case 'r1':
      case 'c1':
      case 'r2':
      case 'c2':
        if (!isAxisId(x)) return false;
        break;
      case 'a':
        if (!Number.isInteger(x) || (x as number) < 0 || (x as number) > 15) return false;
        break;
      case 'open':
        if (x !== 'r' && x !== 'c') return false;
        break;
      case 'spill':
        if (x !== true) return false;
        break;
      case 'p':
        if (
          !Array.isArray(x) ||
          x.length !== 4 ||
          !x.every((n) => Number.isInteger(n) && n >= -1 && n < 1e6)
        )
          return false;
        break;
      default:
        return false;
    }
  }
  return true;
}

export function validInput(v: unknown): v is CellInput {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 1) return false;
  const o = v as Record<string, unknown>;
  if ('n' in o) return typeof o.n === 'number' && Number.isFinite(o.n);
  if ('s' in o) return typeof o.s === 'string';
  if ('b' in o) return typeof o.b === 'boolean';
  if ('f' in o) {
    const f = o.f as Record<string, unknown>;
    if (typeof f !== 'object' || f === null || typeof f.t !== 'string' || !Array.isArray(f.r))
      return false;
    if (Object.keys(f).some((k) => k !== 't' && k !== 'r')) return false;
    return f.r.every(isStoredRef);
  }
  return false;
}

function inputProblem(input: CellInput): SheetRejection | null {
  if ('s' in input && input.s.length > INPUT_MAX) return 'input_too_long';
  if ('f' in input) {
    if (input.f.t.length > FORMULA_MAX) return 'input_too_long';
    // Every @n must name a reference and every reference be named; the template must read.
    const used = tokenize(input.f.t, 0, true)
      .filter((t) => t.k === 'stored')
      .map((t) => Number(t.v));
    if (used.some((i) => i >= input.f.r.length)) return 'formula_invalid';
    if (new Set(used).size !== input.f.r.length) return 'formula_invalid';
    if (storedAst(input.f) === null) return 'formula_invalid';
  }
  return null;
}

// The stored size of a cell, as the api counts it against SHEET_BYTES_MAX.
export function cellBytes(cell: Cell): number {
  return (
    (cell.input ? JSON.stringify(cell.input).length : 0) +
    (cell.format ? JSON.stringify(cell.format).length : 0)
  );
}

export function sheetBytes(sheet: Sheet): number {
  let n = 0;
  for (const c of sheet.cells.values()) n += cellBytes(c);
  return n;
}

function cellChangeProblem(ch: CellChange): Validation {
  if (!isAxisId(ch.r) || !isAxisId(ch.c)) return no('axis_id_invalid', `${ch.r}:${ch.c}`);
  if (ch.i !== undefined && ch.i !== null) {
    if (!validInput(ch.i)) return no('write_invalid', `${ch.r}:${ch.c}`);
    const p = inputProblem(ch.i);
    if (p) return no(p, `${ch.r}:${ch.c}`);
  }
  if (ch.f !== undefined && ch.f !== null && !validFormatPatch(ch.f))
    return no('format_invalid', `${ch.r}:${ch.c}`);
  return OK;
}

function idRangeOk(range: unknown): range is IdRange {
  if (typeof range !== 'object' || range === null) return false;
  const r = range as Record<string, unknown>;
  return isAxisId(r.r1) && isAxisId(r.c1) && isAxisId(r.r2) && isAxisId(r.c2);
}

const shortText = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

// A card table as a write may set it (sheet.md "Card tables").
function isCardTable(t: unknown, id: string): boolean {
  if (typeof t !== 'object' || t === null) return false;
  const x = t as Record<string, unknown>;
  if (x.id !== id || !isAxisId(x.head) || !shortText(x.type, 64)) return false;
  if (!Array.isArray(x.cols) || x.cols.length === 0 || x.cols.length > SHEET_COLS_MAX) return false;
  if (
    !x.cols.every(
      (col) =>
        typeof col === 'object' &&
        col !== null &&
        isAxisId((col as { c?: unknown }).c) &&
        shortText((col as { field?: unknown }).field, 60),
    )
  )
    return false;
  if (typeof x.rows !== 'object' || x.rows === null || Array.isArray(x.rows)) return false;
  const rows = Object.entries(x.rows as Record<string, unknown>);
  const drafts = x.drafts;
  if (
    drafts !== undefined &&
    (!Array.isArray(drafts) || drafts.length > CARD_TABLE_ROWS_MAX || !drafts.every(isAxisId))
  )
    return false;
  return (
    rows.length <= CARD_TABLE_ROWS_MAX &&
    rows.every(([r, item]) => isAxisId(r) && shortText(item, 64)) &&
    (x.controls === undefined || isAxisId(x.controls)) &&
    Object.keys(x).length ===
      5 + (drafts === undefined ? 0 : 1) + (x.controls === undefined ? 0 : 1)
  );
}

function layoutChangeProblem(ch: LayoutChange, layout: SheetLayout): Validation {
  switch (ch.k) {
    case 'insertRows':
    case 'insertCols': {
      const list = ch.k === 'insertRows' ? layout.rows : layout.cols;
      if (!Array.isArray(ch.ids) || ch.ids.length === 0 || !ch.ids.every(isAxisId))
        return no('axis_id_invalid');
      const taken = new Set(list);
      if (new Set(ch.ids).size !== ch.ids.length || ch.ids.some((id) => taken.has(id)))
        return no('axis_id_invalid');
      if (ch.after !== null && !isAxisId(ch.after)) return no('axis_id_invalid');
      return OK;
    }
    case 'deleteRows':
    case 'deleteCols':
    case 'moveRows':
    case 'moveCols':
    case 'orderRows':
    case 'orderCols':
      if (!Array.isArray(ch.ids) || !ch.ids.every(isAxisId)) return no('axis_id_invalid');
      if ('after' in ch && ch.after !== null && !isAxisId(ch.after)) return no('axis_id_invalid');
      return OK;
    case 'size': {
      if (!Array.isArray(ch.ids) || !ch.ids.every(isAxisId)) return no('axis_id_invalid');
      const min = ch.axis === 'r' ? ROW_HEIGHT_MIN : COLUMN_WIDTH_MIN;
      if (ch.px !== null && (!Number.isFinite(ch.px) || ch.px < min || ch.px > AXIS_SIZE_MAX))
        return no('write_invalid');
      return OK;
    }
    case 'hide':
      return Array.isArray(ch.ids) && ch.ids.every(isAxisId) && typeof ch.hidden === 'boolean'
        ? OK
        : no('write_invalid');
    case 'name': {
      if (typeof ch.name !== 'string') return no('write_invalid');
      if (ch.range === null) return OK;
      // Its cells must be on the sheet, and the name one it may take (renaming to another spelling of itself aside).
      const r = ch.range as Partial<IdRange> | undefined;
      const onSheet =
        !!r &&
        layout.rows.includes(r.r1!) &&
        layout.rows.includes(r.r2!) &&
        layout.cols.includes(r.c1!) &&
        layout.cols.includes(r.c2!);
      return onSheet && rangeNameProblem(ch.name, layout, ch.name) === null
        ? OK
        : no('write_invalid');
    }
    case 'cardTable': {
      if (typeof ch.id !== 'string' || !isAxisId(ch.id)) return no('write_invalid');
      if (ch.table === null) return OK;
      const others = (layout.cardTables ?? []).filter((t) => t.id !== ch.id).length;
      return others < CARD_TABLES_MAX && isCardTable(ch.table, ch.id) ? OK : no('write_invalid');
    }
    case 'options': {
      const flag = (v: unknown) => v === undefined || typeof v === 'boolean';
      const size = (v: unknown, min: number) =>
        v === undefined ||
        v === null ||
        (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= AXIS_SIZE_MAX);
      return flag(ch.showGrid) &&
        flag(ch.showHeaders) &&
        flag(ch.setupPending) &&
        size(ch.colWidth, COLUMN_WIDTH_MIN) &&
        size(ch.rowHeight, ROW_HEIGHT_MIN)
        ? OK
        : no('write_invalid');
    }
    case 'freeze': {
      const okCount = (n: number | undefined, max: number) =>
        n === undefined || (Number.isInteger(n) && n >= 0 && n <= max);
      return okCount(ch.rows, Math.min(layout.rows.length, SHEET_FREEZE_ROWS_MAX)) &&
        okCount(ch.cols, Math.min(layout.cols.length, SHEET_FREEZE_COLS_MAX))
        ? OK
        : no('write_invalid');
    }
    case 'merge':
    case 'unmerge':
      return idRangeOk(ch.range) ? OK : no('merge_invalid');
    case 'merges':
      return Array.isArray(ch.merges) && ch.merges.every(idRangeOk) ? OK : no('merge_invalid');
    case 'filter': {
      if (ch.filter === null) return OK;
      const conds: unknown = ch.filter.conds;
      return idRangeOk(ch.filter) &&
        typeof conds === 'object' &&
        conds !== null &&
        !Array.isArray(conds) &&
        Object.keys(conds).length <= SHEET_COLS_MAX &&
        Object.entries(conds).every(([col, cond]) => isAxisId(col) && isFilterCondition(cond))
        ? OK
        : no('filter_invalid');
    }
    case 'filterCond':
      return isAxisId(ch.col) && (ch.cond === null || isFilterCondition(ch.cond))
        ? OK
        : no('filter_invalid');
    default:
      return no('write_invalid');
  }
}

function overlaps(a: { r1: number; c1: number; r2: number; c2: number }, b: typeof a): boolean {
  return a.r1 <= b.r2 && b.r1 <= a.r2 && a.c1 <= b.c2 && b.c1 <= a.c2;
}

// The sheet's shape after a write is within the limits.
export function sheetProblem(sheet: Sheet): Validation {
  const { layout } = sheet;
  if (layout.rows.length > SHEET_ROWS_MAX || layout.cols.length > SHEET_COLS_MAX)
    return no('sheet_too_large');
  if (layout.rows.length === 0 || layout.cols.length === 0) return no('write_invalid');
  if (sheet.cells.size > SHEET_CELLS_MAX || sheetBytes(sheet) > SHEET_BYTES_MAX)
    return no('sheet_full');
  const sized = Object.keys(layout.rowSize ?? {}).length + Object.keys(layout.colSize ?? {}).length;
  if (sized > SHEET_SIZED_AXES_MAX) return no('sheet_full');
  const merges = layout.merges ?? [];
  if (merges.length > SHEET_MERGES_MAX) return no('merge_invalid');
  const boxes = merges.map((m) => posRangeOf(layout, m));
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      if (boxes[i] && boxes[j] && overlaps(boxes[i]!, boxes[j]!)) return no('merge_invalid');
  return OK;
}

// A write as sent: its own shape, then the sheet it would make.
export function validateWrite(sheet: Sheet, write: SheetWrite): Validation {
  if (typeof write !== 'object' || write === null) return no('write_invalid');
  if (write.kind === 'title') {
    const t = typeof write.title === 'string' ? write.title.trim() : '';
    return t.length === 0 || t.length > SHEET_TITLE_MAX ? no('title_invalid') : OK;
  }
  if (write.kind !== 'cells' && write.kind !== 'layout') return no('write_invalid');
  const cells = write.cells ?? [];
  if (!Array.isArray(cells)) return no('write_invalid');
  if (cells.length > SHEET_WRITE_CELLS_MAX) return no('write_too_large');
  if (JSON.stringify(write).length > SHEET_WRITE_BYTES_MAX) return no('write_too_large');
  for (const ch of cells) {
    const v = cellChangeProblem(ch);
    if (!v.ok) return v;
  }
  if (write.kind === 'layout') {
    if (!Array.isArray(write.changes) || write.changes.length === 0 || write.changes.length > 100)
      return no('write_invalid');
    // Each change against the layout as the ones before it in the write leave it: an undo inserts rows back and
    // then names the range that lay across them, in one write.
    let layout = sheet.layout;
    for (const ch of write.changes) {
      const v = layoutChangeProblem(ch, layout);
      if (!v.ok) return v;
      layout = applyLayoutChange(layout, ch);
    }
  }
  // A write that grows nothing past the limits from a sheet already past them (an older, larger one) is let through.
  const after = applySheetWrite(sheet, write, { now: 0, by: NOBODY }).sheet;
  const grew =
    after.cells.size > sheet.cells.size ||
    after.layout.rows.length > sheet.layout.rows.length ||
    after.layout.cols.length > sheet.layout.cols.length ||
    (after.layout.merges?.length ?? 0) > (sheet.layout.merges?.length ?? 0) ||
    write.kind === 'cells';
  // A sheet always has a cell: a write that deletes every row or column (two people each deleting
  // half) is refused whether or not it grew anything.
  if (after.layout.rows.length === 0 || after.layout.cols.length === 0) return no('write_invalid');
  return grew ? sheetProblem(after) : OK;
}

// A whole new sheet (a create, a copy, a restore).
export function validateSheetCreate(sheet: Sheet): Validation {
  if (!isSheetId(sheet.id)) return no('write_invalid', 'id');
  const t = sheet.title.trim();
  if (t.length === 0 || t.length > SHEET_TITLE_MAX) return no('title_invalid');
  const { layout } = sheet;
  if (!layout.rows.every(isAxisId) || !layout.cols.every(isAxisId)) return no('axis_id_invalid');
  // Card tables a seed carries (a copied sheet's), held to what a write may set.
  const tables = layout.cardTables;
  if (
    tables !== undefined &&
    (!Array.isArray(tables) ||
      tables.length > CARD_TABLES_MAX ||
      !tables.every((t) => isCardTable(t, (t as { id?: string })?.id ?? '')))
  )
    return no('write_invalid');
  // Named ranges a seed carries (a copied sheet's), held to what a write may set.
  const names = layout.names;
  if (
    names !== undefined &&
    (!Array.isArray(names) ||
      names.length > RANGE_NAMES_MAX ||
      !names.every(
        (x, i) =>
          typeof x?.name === 'string' &&
          rangeNameProblem(x.name, { ...layout, names: names.slice(0, i) }) === null &&
          [x.r1, x.r2].every((id) => layout.rows.includes(id)) &&
          [x.c1, x.c2].every((id) => layout.cols.includes(id)),
      ))
  )
    return no('write_invalid');
  // The look a seed carries (Sheet Settings), held to what a write may set.
  if (
    !layoutChangeProblem(
      {
        k: 'options',
        ...(layout.showGrid === undefined ? {} : { showGrid: layout.showGrid as boolean }),
        ...(layout.showHeaders === undefined ? {} : { showHeaders: layout.showHeaders as boolean }),
        ...(layout.colWidth === undefined ? {} : { colWidth: layout.colWidth }),
        ...(layout.rowHeight === undefined ? {} : { rowHeight: layout.rowHeight }),
        ...(layout.setupPending === undefined
          ? {}
          : { setupPending: layout.setupPending as boolean }),
      },
      layout,
    ).ok ||
    (layout.showGrid !== undefined && layout.showGrid !== false) ||
    (layout.showHeaders !== undefined && layout.showHeaders !== false) ||
    (layout.setupPending !== undefined && layout.setupPending !== true)
  )
    return no('write_invalid');
  if (
    new Set(layout.rows).size !== layout.rows.length ||
    new Set(layout.cols).size !== layout.cols.length
  )
    return no('axis_id_invalid');
  for (const [key, cell] of sheet.cells) {
    if (cell.input) {
      if (!validInput(cell.input)) return no('write_invalid', key);
      const p = inputProblem(cell.input);
      if (p) return no(p, key);
    }
    if (cell.format && !validFormat(cell.format)) return no('format_invalid', key);
  }
  return sheetProblem(sheet);
}
