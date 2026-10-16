// An agent's sheet change as the writes the editor would send (docs/specs/029-sheets/sheet-store.md "Agents"): each
// change names cells by A1, rows by number and columns by letter, and is built by the engine's own commands
// (writeRows, clearRanges, formatRanges, insertAxis, deleteAxis, sortRange, sortSheet, freeze), never re-implemented
// here. Pure: the caller sends what this returns, in order.
import {
  clearRanges,
  columnIndex,
  columnLetters,
  deleteAxis,
  formatRange,
  formatRanges,
  freeze,
  insertAxis,
  parseRangeText,
  SHEET_TITLE_MAX,
  sortRange,
  sortSheet,
  validFormatPatch,
  writeRows,
  formatA1,
  layoutIndex,
  rangeOptions,
  splitCellKey,
  validateWrite,
  writeForRules,
  type AgentValue,
  type CellChange,
  type FormatPatch,
  type Sheet,
  type GridRange,
  type Rand,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import type { SheetRefusal } from './sheet-state';
import { buildRuleChange, type SheetRuleChange } from './sheet-rule-change';
import { buildShapeChange, type SheetShapeChange } from './sheet-shape-change';
import { buildDesign, type SheetDesignInput } from './sheet-design';
import { buildChartChange, type SheetChartChange, type SheetChartOut } from './sheet-charts';
import { plural } from '@livediagram/document';

// How a cell looks, in words; null clears that part (false clears a flag).
export interface SheetFormatInput {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string | null;
  background?: string | null;
  // 10, 11, 12, 13, 14, 16, 18, 24 or 36.
  fontSize?: number | null;
  align?: 'left' | 'center' | 'right' | null;
  verticalAlign?: 'top' | 'middle' | 'bottom' | null;
  wrap?: 'overflow' | 'wrap' | 'clip' | null;
  // auto, number, percent, currency, accounting, scientific, date, time, datetime, duration or text.
  numberFormat?: string | null;
  decimals?: number | null;
  currency?: string | null;
}

export type SheetChange =
  | { op: 'set'; at: string; rows: AgentValue[][] }
  | { op: 'clear'; range: string; what?: 'inputs' | 'formats' | 'all' }
  | { op: 'format'; range: string; format: SheetFormatInput }
  | { op: 'insert_rows'; at: number; count?: number; side?: 'before' | 'after' }
  | { op: 'insert_cols'; at: string; count?: number; side?: 'before' | 'after' }
  | { op: 'delete_rows'; rows: string }
  | { op: 'delete_cols'; cols: string }
  | { op: 'rename'; title: string }
  | { op: 'sort'; by: string; range?: string; descending?: boolean; header?: boolean }
  | { op: 'freeze'; rows?: number; cols?: number }
  // Validation and format rules (sheet-rule-change.ts).
  | SheetRuleChange
  // Sizes, merges, borders and the filter (sheet-shape-change.ts).
  | SheetShapeChange
  // A sheet laid out as a template is (sheet-design.ts), and a chart over cells (sheet-charts.ts).
  | { op: 'design'; design: SheetDesignInput }
  | SheetChartChange
  | { op: 'clear_charts'; range?: string };

// What one change sends, the line that says what it did, and the charts it puts over the cells (for the caller to add
// to the tab).
export type BuiltChange =
  | {
      ok: true;
      writes: SheetWrite[];
      line: string;
      charts?: SheetChartOut[];
      // The charts to take off the tab: those reading a range's cells, or (null) every one of the sheet's.
      clearCharts?: GridRange | null;
    }
  | SheetRefusal;

// What a change needs of where its sheet is drawn: whether its tab's canvas is dark (a design's tints follow it).
export type SheetChangeContext = { dark?: boolean };

const refuse = (code: string, message: string): SheetRefusal => ({ ok: false, code, message });

const badRange = (text: string) =>
  refuse('range_invalid', `"${text}" is not a cell or range in A1 form ("B4", "A1:D20").`);

const ALIGN = { left: 'l', center: 'c', right: 'r' } as const;
const VALIGN = { top: 't', middle: 'm', bottom: 'b' } as const;
const WRAP = { overflow: 'o', wrap: 'w', clip: 'c' } as const;

const flag = (v: boolean | undefined) => (v === undefined ? undefined : v ? true : null);
const mapped = <K extends string, V>(map: Record<K, V>, v: K | null | undefined) =>
  v === undefined ? undefined : v === null ? null : map[v];

// The words as the engine's format keys; null when a value is not one a cell takes.
export function formatPatchOf(input: SheetFormatInput): FormatPatch | null {
  const raw: Record<string, unknown> = {
    b: flag(input.bold),
    i: flag(input.italic),
    u: flag(input.underline),
    st: flag(input.strikethrough),
    fc: typeof input.color === 'string' ? input.color.toLowerCase() : input.color,
    bg: typeof input.background === 'string' ? input.background.toLowerCase() : input.background,
    fs: input.fontSize,
    ha: mapped(ALIGN, input.align),
    va: mapped(VALIGN, input.verticalAlign),
    wr: mapped(WRAP, input.wrap),
    nf: input.numberFormat,
    dp: input.decimals,
    cur: input.currency,
  };
  const patch = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  return Object.keys(patch).length && validFormatPatch(patch) ? patch : null;
}

// Each format of the row (or column) at `source`, onto the rows (columns) `ids` made beside it.
function formatsCopied(
  sheet: Sheet,
  axis: 'r' | 'c',
  source: number,
  ids: readonly string[],
): CellChange[] {
  // The insert was checked against the sheet, so its neighbour is one of its rows (columns).
  const id = (axis === 'r' ? sheet.layout.rows : sheet.layout.cols)[source]!;
  const out: CellChange[] = [];
  for (const [key, cell] of sheet.cells) {
    if (!cell.format) continue;
    const { r, c } = splitCellKey(key);
    if ((axis === 'r' ? r : c) !== id) continue;
    // A new column takes its neighbour's look but not its number format: a column of amounts beside dates is not
    // dates. A new row is the same columns, so it takes all of it.
    const { nf: _nf, dp: _dp, cur: _cur, nc: _nc, ...look } = cell.format;
    const f = axis === 'r' ? cell.format : look;
    if (Object.keys(f).length === 0) continue;
    for (const made of ids) out.push(axis === 'r' ? { r: made, c, f } : { r, c: made, f });
  }
  return out;
}

// "3" or "3:5" (rows, 1-based) and "C" or "C:E" (columns) as positions.
function span(text: string, axis: 'r' | 'c'): { from: number; to: number } | null {
  const parts = text.trim().split(':');
  if (parts.length > 2) return null;
  const pos = parts.map((p) =>
    axis === 'r' ? (/^[0-9]{1,5}$/.test(p.trim()) ? Number(p) - 1 : -1) : columnIndex(p.trim()),
  );
  if (pos.some((p) => p < 0)) return null;
  return { from: Math.min(...pos), to: Math.max(...pos) };
}

export function buildSheetChange(
  wb: Workbook,
  sheetId: string,
  change: SheetChange,
  takenTitles: readonly string[],
  rand: Rand = Math.random,
  context: SheetChangeContext = {},
): BuiltChange {
  const sheet = wb.sheet(sheetId)!;
  const rowCount = sheet.layout.rows.length;
  const colCount = sheet.layout.cols.length;
  switch (change.op) {
    case 'set': {
      const made = writeRows(wb, sheetId, change.at, change.rows, rand);
      if (!made.ok)
        return made.error === 'formula_invalid'
          ? refuse('formula_invalid', `The formula in ${made.at} cannot be read: ${made.why}.`)
          : badRange(change.at);
      // A value a Reject rule refuses is refused here, naming the cell and what its rule allows (data-validation.md
      // "Agents"); the api would refuse it too.
      const check = validateWrite(sheet, writeForRules(sheet.layout, made.write), {
        rangeValues: (rule) => rangeOptions(wb, sheetId, rule),
      });
      if (!check.ok && check.error === 'value_invalid') {
        const ix = layoutIndex(sheet.layout);
        // A refused value always names its cell, on this sheet.
        const { r, c } = splitCellKey(check.at!);
        const where = formatA1(ix.rowPos.get(r)!, ix.colPos.get(c)!);
        return refuse('value_invalid', `${where} cannot take that value: ${check.line}.`);
      }
      const cut = made.truncated ? ' (cut at the sheet’s 10,000 rows or 200 columns)' : '';
      return {
        ok: true,
        writes: [writeForRules(sheet.layout, made.write)],
        line: `set ${made.range}${cut}`,
      };
    }
    case 'clear': {
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      const what = change.what ?? 'all';
      return {
        ok: true,
        writes: [clearRanges(sheet, [range], what)],
        line: `cleared ${what === 'all' ? '' : `${what} of `}${formatRange(range)}`,
      };
    }
    case 'format': {
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      const patch = formatPatchOf(change.format);
      if (!patch)
        return refuse(
          'format_invalid',
          'Give at least one format, each a value a cell takes: colours as #rrggbb, a font size of 10, 11, 12, ' +
            '13, 14, 16, 18, 24 or 36, decimals 0 to 10, a currency symbol like £, $ or €.',
        );
      // formatRanges answers null only for a sheet the workbook lacks, and this one was read above.
      const write = formatRanges(wb, sheetId, [range], patch)!;
      return { ok: true, writes: [write], line: `formatted ${formatRange(range)}` };
    }
    case 'insert_rows':
    case 'insert_cols': {
      const rows = change.op === 'insert_rows';
      const at = rows ? change.at - 1 : columnIndex(String(change.at));
      const count = change.count ?? 1;
      const side = change.side ?? 'before';
      const size = rows ? rowCount : colCount;
      if (!Number.isInteger(at) || at < 0 || at >= size)
        return refuse(
          'range_invalid',
          rows
            ? `Row ${change.at} is past the sheet's ${rowCount} rows.`
            : `Column "${change.at}" is not a column of the sheet (A to ${columnLetters(colCount - 1)}).`,
        );
      const write = insertAxis(sheet, rows ? 'r' : 'c', at, count, side, rand);
      if (!write)
        return refuse(
          'sheet_too_large',
          'A sheet has up to 10,000 rows and 200 columns (A to GR).',
        );
      // insertAxis answers one layout insert, its ids the rows or columns made.
      const { changes } = write as Extract<SheetWrite, { kind: 'layout' }>;
      const ids = (changes[0] as { ids: string[] }).ids;
      const made = ids.length;
      const where = rows ? `row ${at + 1}` : `column ${columnLetters(at)}`;
      // The new rows (columns) take the formats of the one before them, or after them at the very top (left), as a
      // spreadsheet's do: rows inserted above a total row look like the body row over them, not the total. Columns
      // take the look only (formatsCopied).
      const before = side === 'before' ? at - 1 : at;
      const source = before >= 0 ? before : at;
      const cells = formatsCopied(sheet, rows ? 'r' : 'c', source, ids);
      return {
        ok: true,
        writes: [
          cells.length ? { ...(write as Extract<SheetWrite, { kind: 'layout' }>), cells } : write,
        ],
        line: `inserted ${plural(made, rows ? 'row' : 'column')} ${side} ${where}`,
      };
    }
    case 'delete_rows':
    case 'delete_cols': {
      const rows = change.op === 'delete_rows';
      const text = rows ? change.rows : change.cols;
      const s = span(text, rows ? 'r' : 'c');
      if (!s || s.from >= (rows ? rowCount : colCount))
        return refuse(
          'range_invalid',
          rows
            ? `"${text}" is not rows of the sheet ("3", or "3:5"; it has ${rowCount}).`
            : `"${text}" is not columns of the sheet ("C", or "C:E"; it has A to ${columnLetters(colCount - 1)}).`,
        );
      const write = deleteAxis(sheet, rows ? 'r' : 'c', s.from, s.to);
      if (!write) return refuse('range_invalid', 'A sheet keeps at least one row and one column.');
      // What deleteAxis actually deletes: the span as far as the sheet goes, less the last row or column when the
      // span is all of them (a sheet keeps one). The line says that, not the span asked for.
      const { changes } = write as Extract<SheetWrite, { kind: 'layout' }>;
      const deleted = (changes[0] as { ids: string[] }).ids.length;
      const size = rows ? rowCount : colCount;
      const name = (at: number) => (rows ? String(at + 1) : columnLetters(at));
      const noun = rows ? 'row' : 'column';
      const last = s.from + deleted - 1;
      const label =
        deleted === 1 ? `${noun} ${name(s.from)}` : `${noun}s ${name(s.from)}:${name(last)}`;
      const kept =
        Math.min(s.to, size - 1) > last
          ? `; ${noun} ${name(last + 1)} stays, as a sheet keeps one`
          : '';
      return { ok: true, writes: [write], line: `deleted ${label}${kept}` };
    }
    case 'rename': {
      const title = change.title.trim();
      if (!title || title.length > SHEET_TITLE_MAX)
        return refuse('title_invalid', `A sheet title is 1 to ${SHEET_TITLE_MAX} characters.`);
      const lower = title.toLowerCase();
      if (takenTitles.some((t) => t.toLowerCase() === lower) && sheet.title.toLowerCase() !== lower)
        return refuse('sheet_title_taken', `Another sheet on the tab is called "${title}".`);
      return { ok: true, writes: [{ kind: 'title', title }], line: `renamed to "${title}"` };
    }
    case 'sort': {
      const col = columnIndex(change.by);
      if (col < 0 || col >= colCount)
        return refuse(
          'range_invalid',
          `"${change.by}" is not a column of the sheet (a letter, like "B").`,
        );
      const ascending = !change.descending;
      const order = ascending ? 'A to Z' : 'Z to A';
      if (!change.range) {
        const write = sortSheet(wb, sheetId, col, ascending);
        return {
          ok: true,
          writes: write ? [write] : [],
          line: `sorted the sheet by column ${change.by.toUpperCase()}, ${order}`,
        };
      }
      const range: GridRange | null = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      if (col < range.c1 || col > range.c2)
        return refuse(
          'range_invalid',
          `Column ${change.by.toUpperCase()} is outside ${formatRange(range)}.`,
        );
      const write = sortRange(wb, sheetId, range, [{ col, ascending }], change.header ?? false);
      return {
        ok: true,
        writes: write ? [write] : [],
        line: `sorted ${formatRange(range)} by column ${change.by.toUpperCase()}, ${order}`,
      };
    }
    case 'validate':
    case 'clear_validation':
    case 'conditional_format':
    case 'clear_conditional_formats':
      return buildRuleChange(wb, sheetId, change, rand);
    case 'resize':
    case 'merge':
    case 'unmerge':
    case 'border':
    case 'filter':
      return buildShapeChange(wb, sheetId, change);
    case 'design':
      return buildDesign(wb, sheetId, change.design, { dark: !!context.dark }, rand);
    case 'chart':
      return buildChartChange(wb, sheetId, change);
    case 'clear_charts': {
      if (change.range === undefined)
        return { ok: true, writes: [], line: 'cleared the sheet’s charts', clearCharts: null };
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      return {
        ok: true,
        writes: [],
        line: `cleared the charts reading ${formatRange(range)}`,
        clearCharts: range,
      };
    }
    case 'freeze': {
      if (change.rows === undefined && change.cols === undefined)
        return refuse('write_invalid', 'Freeze names rows, cols or both (0 unfreezes).');
      const parts = [
        change.rows !== undefined ? plural(change.rows, 'row') : null,
        change.cols !== undefined ? plural(change.cols, 'column') : null,
      ].filter(Boolean);
      return {
        ok: true,
        writes: [freeze(change.rows, change.cols)],
        line: `froze ${parts.join(' and ')}`,
      };
    }
  }
}
