// What the row and column menus, Sort, Freeze and Filter do (docs/specs/029-sheets/sheet.md "Rows and columns",
// "Sort", "Freeze", "Filter"), as pure builders to a layout write. New rows and columns get ids made here.
import type { GridRange } from './address';
import { makeAxisIds, type Rand } from './ids';
import { idRangeOf } from './layout';
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';
import { cellKey, type FilterCondition, type Sheet } from './sheet';
import { sortedOrder, type SortKey } from './sort';
import { shiftForCopy } from './formula/stored';
import { scalarOf } from './formula/values';
import type { CellChange, SheetWrite } from './store';
import type { Workbook } from './engine/workbook';
import { currentRegion, type Grid } from './selection';

export type Side = 'before' | 'after';

// Insert `count` rows (or columns) before or after position `at`, as many as the grid still has room for.
export function insertAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  at: number,
  count: number,
  side: Side,
  rand: Rand = Math.random,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  const room = (axis === 'r' ? SHEET_ROWS_MAX : SHEET_COLS_MAX) - list.length;
  const n = Math.min(count, room);
  if (n <= 0) return null;
  const pos = side === 'before' ? at - 1 : at;
  const after = pos < 0 ? null : (list[Math.min(pos, list.length - 1)] ?? null);
  const ids = makeAxisIds(n, rand, new Set(list));
  return {
    kind: 'layout',
    changes: [{ k: axis === 'r' ? 'insertRows' : 'insertCols', after, ids }],
  };
}

// Rows (or columns) added at the end: "Add 100 Rows", and a paste past the edge.
export function appendAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  count: number,
  rand: Rand = Math.random,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  return insertAxis(sheet, axis, list.length - 1, count, 'after', rand);
}

// Delete positions r1..r2 (or c1..c2). The last row or column of a sheet is kept: a sheet always has a cell.
export function deleteAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  from: number,
  to: number,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  let ids = list.slice(Math.max(0, from), Math.min(list.length, to + 1));
  if (ids.length >= list.length) ids = ids.slice(0, list.length - 1);
  if (ids.length === 0) return null;
  return { kind: 'layout', changes: [{ k: axis === 'r' ? 'deleteRows' : 'deleteCols', ids }] };
}

export function hideAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  from: number,
  to: number,
  hidden: boolean,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  const ids = list.slice(Math.max(0, from), to + 1);
  return ids.length ? { kind: 'layout', changes: [{ k: 'hide', axis, ids, hidden }] } : null;
}

export function resizeAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  positions: readonly number[],
  px: number | null,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  const ids = positions.map((p) => list[p]).filter((x): x is string => !!x);
  return ids.length ? { kind: 'layout', changes: [{ k: 'size', axis, ids, px }] } : null;
}

// Dragging selected headers: rows (or columns) from..to moved to before position `to` (the drop line).
export function moveAxis(
  sheet: Sheet,
  axis: 'r' | 'c',
  from: number,
  to: number,
  before: number,
): SheetWrite | null {
  const list = axis === 'r' ? sheet.layout.rows : sheet.layout.cols;
  if (before >= from && before <= to + 1) return null;
  const ids = list.slice(from, to + 1);
  const after = before <= 0 ? null : list[before - 1]!;
  return { kind: 'layout', changes: [{ k: axis === 'r' ? 'moveRows' : 'moveCols', ids, after }] };
}

export function freeze(rows?: number, cols?: number): SheetWrite {
  return {
    kind: 'layout',
    changes: [
      {
        k: 'freeze',
        ...(rows !== undefined ? { rows } : {}),
        ...(cols !== undefined ? { cols } : {}),
      },
    ],
  };
}

// Sort the whole sheet's rows by a column, frozen rows kept in place: one reorder of row ids, so no cell is
// rewritten and every formula keeps reading the cells it read.
export function sortSheet(
  wb: Workbook,
  sheetId: string,
  col: number,
  ascending: boolean,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const start = sheet.layout.frozenRows ?? 0;
  const extent = wb.extent(sheetId);
  const end = Math.max(start, extent.rows);
  const rows = sheet.layout.rows.slice(start, end);
  if (rows.length < 2) return null;
  const order = sortedOrder(rows.length, (i) => scalarOf(wb.value(sheetId, start + i, col)), [
    { col, ascending },
  ]);
  return { kind: 'layout', changes: [{ k: 'orderRows', ids: order.map((i) => rows[i]!) }] };
}

// Sort Range: only the selection's cells move (inputs and formats), each formula shifted with its row.
export function sortRange(
  wb: Workbook,
  sheetId: string,
  range: GridRange,
  keys: readonly SortKey[],
  hasHeader: boolean,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const r1 = range.r1 + (hasHeader ? 1 : 0);
  const count = range.r2 - r1 + 1;
  if (count < 2) return null;
  const order = sortedOrder(count, (i, c) => scalarOf(wb.value(sheetId, r1 + i, c)), keys);
  const ctx = wb.ctxFor(sheetId);
  const cells: CellChange[] = [];
  for (let k = 0; k < count; k++) {
    const fromRow = r1 + order[k]!;
    const toRow = r1 + k;
    if (fromRow === toRow) continue;
    for (let c = range.c1; c <= range.c2; c++) {
      const src = sheet.cells.get(cellKey(sheet.layout.rows[fromRow]!, sheet.layout.cols[c]!));
      const input = src?.input;
      const i =
        input && 'f' in input
          ? { f: shiftForCopy(input.f, toRow - fromRow, 0, ctx) }
          : (input ?? null);
      cells.push({
        r: sheet.layout.rows[toRow]!,
        c: sheet.layout.cols[c]!,
        i,
        f: src?.format ?? null,
      });
    }
  }
  return cells.length ? { kind: 'cells', cells } : null;
}

// Filter on (over the filled block around the selection, or the selection when it is more than one cell) or off.
export function toggleFilter(
  wb: Workbook,
  sheetId: string,
  sel: GridRange,
  grid: Grid,
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  if (sheet.layout.filter) return { kind: 'layout', changes: [{ k: 'filter', filter: null }] };
  const single = sel.r1 === sel.r2 && sel.c1 === sel.c2;
  const box = single ? currentRegion({ r: sel.r1, c: sel.c1 }, grid) : sel;
  const ids = idRangeOf(sheet.layout, box.r1, box.c1, box.r2, box.c2);
  return ids ? { kind: 'layout', changes: [{ k: 'filter', filter: { ...ids, conds: {} } }] } : null;
}

export function setFilterCondition(colId: string, cond: FilterCondition | null): SheetWrite {
  return { kind: 'layout', changes: [{ k: 'filterCond', col: colId, cond }] };
}
