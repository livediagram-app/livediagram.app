// The filter (docs/specs/029-sheets/sheet.md "Filter"): which rows of the filtered range every column's condition
// keeps. A column filters by the displayed values kept and/or a condition.
import { localeDayFirst, parseDateText } from './dates';
import { parsePlainNumber } from './input';
import { displayValue } from './number-format';
import { layoutIndex, posRangeOf } from './layout';
import { cellKey, type FilterCondition } from './sheet';
import { isError, type Scalar } from './formula/values';
import type { Workbook } from './engine/workbook';

export const CONDITION_OPS: readonly NonNullable<FilterCondition['op']>[] = [
  'empty',
  'notEmpty',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'exactly',
  'dateBefore',
  'dateAfter',
  'dateOn',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'eq',
  'neq',
];

function asNumber(text: string | undefined, locale: string): number | null {
  if (text === undefined) return null;
  const n = parsePlainNumber(text);
  if (n !== null) return n;
  const d = parseDateText(text, localeDayFirst(locale));
  return d ? d.serial : null;
}

export function conditionMatches(
  cond: FilterCondition,
  value: Scalar,
  shown: string,
  locale: string,
): boolean {
  if (cond.values && !cond.values.includes(shown)) return false;
  if (!cond.op) return true;
  const empty = value === null || value === '';
  const text = shown.toLowerCase();
  const a = (cond.a ?? '').toLowerCase();
  const num = typeof value === 'number' ? value : null;
  const na = asNumber(cond.a, locale);
  const nb = asNumber(cond.b, locale);
  switch (cond.op) {
    case 'empty':
      return empty;
    case 'notEmpty':
      return !empty;
    case 'contains':
      return text.includes(a);
    case 'notContains':
      return !text.includes(a);
    case 'startsWith':
      return text.startsWith(a);
    case 'endsWith':
      return text.endsWith(a);
    case 'exactly':
      return text === a;
    case 'dateBefore':
    case 'lt':
      return num !== null && na !== null && num < (cond.op === 'dateBefore' ? Math.floor(na) : na);
    case 'dateAfter':
      return num !== null && na !== null && Math.floor(num) > Math.floor(na);
    case 'dateOn':
      return num !== null && na !== null && Math.floor(num) === Math.floor(na);
    case 'gt':
      return num !== null && na !== null && num > na;
    case 'gte':
      return num !== null && na !== null && num >= na;
    case 'lte':
      return num !== null && na !== null && num <= na;
    case 'between':
      return (
        num !== null &&
        na !== null &&
        nb !== null &&
        num >= Math.min(na, nb) &&
        num <= Math.max(na, nb)
      );
    case 'eq':
      return na !== null ? num === na : text === a;
    case 'neq':
      return na !== null ? num !== na : text !== a;
  }
}

// The row ids the sheet's filter hides (its header row never).
export function filteredOutRows(wb: Workbook, sheetId: string): Set<string> {
  const out = new Set<string>();
  const sheet = wb.sheet(sheetId);
  const filter = sheet?.layout.filter;
  if (!sheet || !filter) return out;
  const box = posRangeOf(sheet.layout, filter);
  if (!box) return out;
  const ix = layoutIndex(sheet.layout);
  const conds = Object.entries(filter.conds)
    .map(([col, cond]) => ({ c: ix.colPos.get(col), col, cond }))
    .filter((x): x is { c: number; col: string; cond: FilterCondition } => x.c !== undefined);
  if (conds.length === 0) return out;
  for (let r = box.r1 + 1; r <= box.r2; r++) {
    const rowId = sheet.layout.rows[r]!;
    for (const { c, col, cond } of conds) {
      const v = wb.value(sheetId, r, c);
      const shown = displayValue(v, sheet.cells.get(cellKey(rowId, col))?.format, wb.locale).text;
      if (!conditionMatches(cond, isError(v) ? v : (v as Scalar), shown, wb.locale)) {
        out.add(rowId);
        break;
      }
    }
  }
  return out;
}

// A column's displayed values under the filter's header, with how many rows show each, for Filter by Values.
export function columnValueCounts(
  wb: Workbook,
  sheetId: string,
  colId: string,
): { text: string; count: number }[] {
  const sheet = wb.sheet(sheetId);
  const filter = sheet?.layout.filter;
  if (!sheet || !filter) return [];
  const box = posRangeOf(sheet.layout, filter);
  const c = layoutIndex(sheet.layout).colPos.get(colId);
  if (!box || c === undefined) return [];
  const counts = new Map<string, number>();
  for (let r = box.r1 + 1; r <= box.r2; r++) {
    const v = wb.value(sheetId, r, c);
    const shown = displayValue(
      v,
      sheet.cells.get(cellKey(sheet.layout.rows[r]!, colId))?.format,
      wb.locale,
    ).text;
    counts.set(shown, (counts.get(shown) ?? 0) + 1);
  }
  return [...counts]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) =>
      a.text === ''
        ? 1
        : b.text === ''
          ? -1
          : a.text.localeCompare(b.text, 'en', { numeric: true }),
    );
}
