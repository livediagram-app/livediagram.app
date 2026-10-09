// Sheets for agents (docs/specs/029-sheets/sheet-store.md "Agents"): read a range as rows of inputs, values and
// what they show, and write rows of values at an A1 cell, by A1 and titles only, never row or column ids.
import { formatRange, parseRangeText, type GridRange } from './address';
import { appendAxis } from './commands-axis';
import { displayValue } from './number-format';
import { cellKey } from './sheet';
import { inputAsText, readTypedInput } from './typed-input';
import { isError, numberText, type Scalar } from './formula/values';
import { PARSE_FAILURE_COPY } from './formula/parse';
import { makeAxisIds, type Rand } from './ids';
import { SHEET_COLS_MAX, SHEET_ROWS_MAX } from './limits';
import type { CellChange, LayoutChange, SheetWrite } from './store';
import type { Workbook } from './engine/workbook';

export const AGENT_READ_CELLS_MAX = 5_000;
export const AGENT_LOCALE = 'en-GB';

export type AgentCell = { input: string; value: Scalar; display: string };

export type RangeRead =
  | { ok: true; range: string; rows: AgentCell[][]; truncated: boolean }
  | { ok: false; error: 'range_invalid' | 'sheet_not_found' };

function plainValue(v: Scalar): Scalar {
  return isError(v) ? `${v.e}` : v;
}

// A range (A1 text; the filled range when omitted), at most AGENT_READ_CELLS_MAX cells, row by row.
export function readRange(wb: Workbook, sheetId: string, rangeText?: string): RangeRead {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return { ok: false, error: 'sheet_not_found' };
  let range: GridRange | null;
  if (rangeText && rangeText.trim()) {
    range = parseRangeText(rangeText);
    if (!range) return { ok: false, error: 'range_invalid' };
  } else {
    const ext = wb.extent(sheetId);
    range = { r1: 0, c1: 0, r2: Math.max(0, ext.rows - 1), c2: Math.max(0, ext.cols - 1) };
  }
  range = {
    ...range,
    r2: Math.min(range.r2, sheet.layout.rows.length - 1),
    c2: Math.min(range.c2, sheet.layout.cols.length - 1),
  };
  const width = range.c2 - range.c1 + 1;
  const maxRows = Math.max(1, Math.floor(AGENT_READ_CELLS_MAX / width));
  const truncated = range.r2 - range.r1 + 1 > maxRows;
  if (truncated) range = { ...range, r2: range.r1 + maxRows - 1 };
  const ctx = wb.ctxFor(sheetId);
  const rows: AgentCell[][] = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const row: AgentCell[] = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const cell = sheet.cells.get(cellKey(sheet.layout.rows[r]!, sheet.layout.cols[c]!));
      const value = wb.value(sheetId, r, c);
      row.push({
        input: inputAsText(cell?.input, ctx),
        value: plainValue(value as Scalar),
        display: displayValue(value, cell?.format, wb.locale).text,
      });
    }
    rows.push(row);
  }
  return { ok: true, range: formatRange(range), rows, truncated };
}

export type AgentValue = string | number | boolean | null;

export type RowsWrite =
  | { ok: true; write: SheetWrite; range: string; truncated: boolean }
  | {
      ok: false;
      error: 'range_invalid' | 'sheet_not_found' | 'formula_invalid';
      at?: string;
      why?: string;
    };

// Rows of values written from an A1 cell: JSON numbers and booleans as they are, text read as typed in en-GB
// (`=` a formula, refused when it cannot be read), null clears. The grid grows to fit, up to its limits.
export function writeRows(
  wb: Workbook,
  sheetId: string,
  at: string,
  rows: readonly (readonly AgentValue[])[],
  rand: Rand = Math.random,
): RowsWrite {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return { ok: false, error: 'sheet_not_found' };
  const start = parseRangeText(at);
  if (!start) return { ok: false, error: 'range_invalid' };
  const width = Math.max(0, ...rows.map((r) => r.length));
  const needRows = Math.max(0, start.r1 + rows.length - sheet.layout.rows.length);
  const needCols = Math.max(0, start.c1 + width - sheet.layout.cols.length);
  const addRows = Math.min(needRows, SHEET_ROWS_MAX - sheet.layout.rows.length);
  const addCols = Math.min(needCols, SHEET_COLS_MAX - sheet.layout.cols.length);
  const changes: LayoutChange[] = [];
  let rowIds = sheet.layout.rows;
  let colIds = sheet.layout.cols;
  if (addRows > 0) {
    const grown = appendAxis(sheet, 'r', addRows, rand);
    if (grown && grown.kind === 'layout') {
      changes.push(...grown.changes);
      rowIds = [...rowIds, ...(grown.changes[0] as { ids: string[] }).ids];
    }
  }
  if (addCols > 0) {
    const ids = makeAxisIds(addCols, rand, new Set(colIds));
    changes.push({ k: 'insertCols', after: colIds[colIds.length - 1]!, ids });
    colIds = [...colIds, ...ids];
  }
  const base = wb.ctxFor(sheetId);
  const ctx = changes.length
    ? { ...base, own: { ...base.own, layout: { ...base.own.layout, rows: rowIds, cols: colIds } } }
    : base;
  const cells: CellChange[] = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = 0; j < rows[i]!.length; j++) {
      const r = rowIds[start.r1 + i];
      const c = colIds[start.c1 + j];
      if (!r || !c) continue;
      const v = rows[i]![j]!;
      if (v === null) {
        cells.push({ r, c, i: null });
        continue;
      }
      if (typeof v === 'number') {
        cells.push({ r, c, i: Number.isFinite(v) ? { n: v } : { s: numberText(v) } });
        continue;
      }
      if (typeof v === 'boolean') {
        cells.push({ r, c, i: { b: v } });
        continue;
      }
      const read = readTypedInput(
        v,
        AGENT_LOCALE,
        ctx,
        sheet.cells.get(cellKey(r, c))?.format?.nf === 'text',
      );
      if (read.kind === 'invalid') {
        const a1 = formatRange({
          r1: start.r1 + i,
          c1: start.c1 + j,
          r2: start.r1 + i,
          c2: start.c1 + j,
        });
        const why =
          read.reason === 'input_too_long'
            ? 'The value is too long'
            : PARSE_FAILURE_COPY[read.reason];
        return { ok: false, error: 'formula_invalid', at: a1, why };
      }
      const ch: CellChange = { r, c, i: read.kind === 'clear' ? null : read.input };
      if (read.kind === 'value' && read.hint)
        ch.f = { nf: read.hint.nf, ...(read.hint.cur ? { cur: read.hint.cur } : {}) } as never;
      cells.push(ch);
    }
  const write: SheetWrite = changes.length
    ? { kind: 'layout', changes, cells }
    : { kind: 'cells', cells };
  const end = {
    r: Math.min(start.r1 + rows.length, rowIds.length) - 1,
    c: Math.min(start.c1 + width, colIds.length) - 1,
  };
  return {
    ok: true,
    write,
    range: formatRange({
      r1: start.r1,
      c1: start.c1,
      r2: Math.max(start.r1, end.r),
      c2: Math.max(start.c1, end.c),
    }),
    truncated: addRows < needRows || addCols < needCols,
  };
}
