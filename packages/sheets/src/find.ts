// Find and Replace (docs/specs/029-sheets/sheet.md "Find"): matches in values (and, asked, in inputs), row by row
// in the layout's order; Replace All is one cells write of the changed inputs, never of formulas' results.
import { displayValue } from './number-format';
import { layoutIndex } from './layout';
import { splitCellKey, type CellInput } from './sheet';
import { escapeRegExp } from './input';
import { inputAsText, readTypedInput } from './typed-input';
import type { CellChange } from './store';
import type { Workbook } from './engine/workbook';
import type { CellPos } from './address';

export type FindOptions = { matchCase?: boolean; entireCell?: boolean; inFormulas?: boolean };

function matcher(query: string, opts: FindOptions): (text: string) => boolean {
  const q = opts.matchCase ? query : query.toLowerCase();
  return (text) => {
    const t = opts.matchCase ? text : text.toLowerCase();
    return opts.entireCell ? t === q : t.includes(q);
  };
}

export function findMatches(
  wb: Workbook,
  sheetId: string,
  query: string,
  opts: FindOptions = {},
): CellPos[] {
  const sheet = wb.sheet(sheetId);
  if (!sheet || query === '') return [];
  const ix = layoutIndex(sheet.layout);
  const ctx = wb.ctxFor(sheetId);
  const test = matcher(query, opts);
  const out: CellPos[] = [];
  for (const [key, cell] of sheet.cells) {
    if (!cell.input) continue;
    const { r: rowId, c: colId } = splitCellKey(key);
    const r = ix.rowPos.get(rowId);
    const c = ix.colPos.get(colId);
    if (r === undefined || c === undefined) continue;
    const shown = displayValue(wb.value(sheetId, r, c), cell.format, wb.locale).text;
    const typed = opts.inFormulas ? inputAsText(cell.input, ctx) : '';
    if (test(shown) || (opts.inFormulas && test(typed))) out.push({ r, c });
  }
  return out.sort((a, b) => a.r - b.r || a.c - b.c);
}

function replaceIn(text: string, query: string, by: string, opts: FindOptions): string {
  if (opts.entireCell) return by;
  const re = new RegExp(escapeRegExp(query), opts.matchCase ? 'g' : 'gi');
  return text.replace(re, () => by);
}

// Replace in typed inputs: text, and with "Also Search Formulas" the formula's text. Returns the changes and
// how many cells changed.
export function replaceAll(
  wb: Workbook,
  sheetId: string,
  query: string,
  by: string,
  opts: FindOptions = {},
): { cells: CellChange[]; count: number } {
  const sheet = wb.sheet(sheetId);
  if (!sheet || query === '') return { cells: [], count: 0 };
  const ctx = wb.ctxFor(sheetId);
  const test = matcher(query, opts);
  const cells: CellChange[] = [];
  for (const [key, cell] of sheet.cells) {
    const input = cell.input;
    if (!input) continue;
    const isFormula = 'f' in input;
    if (isFormula && !opts.inFormulas) continue;
    const typed = inputAsText(input, ctx);
    if (!test(typed)) continue;
    const next = replaceIn(typed, query, by, opts);
    if (next === typed) continue;
    const asText = cell.format?.nf === 'text' || 's' in input;
    const read = readTypedInput(next, wb.locale, ctx, asText && !isFormula);
    if (read.kind === 'invalid') continue;
    const { r, c } = splitCellKey(key);
    const i: CellInput | null = read.kind === 'clear' ? null : read.input;
    cells.push({ r, c, i });
  }
  return { cells, count: cells.length };
}
