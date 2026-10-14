// An agent's changes to a sheet's shape (docs/specs/029-sheets/sheet-store.md "Agents", "Shaping a sheet"): column and
// row sizes (px, or fitted to what the cells show), merges, borders and the filter, built by the engine's own commands
// (resizeAxis, fitColumnsWrite, mergeRange, unmergeRange, borderRange). Pure: the caller sends what this returns.
import {
  AXIS_SIZE_MAX,
  COLUMN_WIDTH_MIN,
  ROW_HEIGHT_MIN,
  borderRange,
  columnIndex,
  columnLetters,
  fitColumnsWrite,
  formatRange,
  idRangeOf,
  isColour,
  mergeRange,
  parseRangeText,
  resizeAxis,
  unmergeRange,
  type BorderMode,
  type CellChange,
  type SheetWrite,
  type Workbook,
} from '@livediagram/sheets';
import { plural } from '@livediagram/document';
import type { SheetRefusal } from './sheet-state';

export type SheetShapeChange =
  | { op: 'resize'; cols?: string; rows?: string; px?: number; fit?: boolean }
  | { op: 'merge'; range: string; across?: boolean }
  | { op: 'unmerge'; range: string }
  | {
      op: 'border';
      range: string;
      sides?: BorderMode;
      color?: string;
      width?: 1 | 2 | 3;
      style?: 'solid' | 'dashed' | 'dotted';
    }
  | { op: 'filter'; range?: string | null };

type Built = { ok: true; writes: SheetWrite[]; line: string } | SheetRefusal;

// A border's colour when none is given: the slate rule the sheet looks draw with.
export const BORDER_COLOUR_DEFAULT = '#cbd5e1';

const refuse = (code: string, message: string): SheetRefusal => ({ ok: false, code, message });
const badRange = (text: string) =>
  refuse('range_invalid', `"${text}" is not a cell or range in A1 form ("B4", "A1:D20").`);

// "3" or "3:5" (rows, 1-based) and "C" or "C:E" (columns) as positions, within `size`.
function positions(text: string, axis: 'r' | 'c', size: number): number[] | null {
  const parts = text.trim().split(':');
  if (parts.length > 2) return null;
  const pos = parts.map((p) =>
    axis === 'r' ? (/^[0-9]{1,5}$/.test(p.trim()) ? Number(p) - 1 : -1) : columnIndex(p.trim()),
  );
  if (pos.some((p) => p < 0)) return null;
  const from = Math.min(...pos);
  const to = Math.min(Math.max(...pos), size - 1);
  if (from > to) return null;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const spanText = (axis: 'r' | 'c', at: readonly number[]) => {
  const name = (p: number) => (axis === 'r' ? String(p + 1) : columnLetters(p));
  const noun = axis === 'r' ? 'row' : 'column';
  return at.length === 1
    ? `${noun} ${name(at[0]!)}`
    : `${noun}s ${name(at[0]!)}:${name(at[at.length - 1]!)}`;
};

function resize(
  wb: Workbook,
  sheetId: string,
  change: Extract<SheetShapeChange, { op: 'resize' }>,
): Built {
  const sheet = wb.sheet(sheetId)!;
  if ((change.cols === undefined) === (change.rows === undefined))
    return refuse('write_invalid', 'Resize names cols ("A:C") or rows ("2:5"), one of them.');
  const axis = change.cols !== undefined ? 'c' : 'r';
  const text = (change.cols ?? change.rows)!;
  const size = axis === 'c' ? sheet.layout.cols.length : sheet.layout.rows.length;
  const at = positions(text, axis, size);
  if (!at)
    return refuse(
      'range_invalid',
      axis === 'c'
        ? `"${text}" is not columns of the sheet ("C", or "C:E").`
        : `"${text}" is not rows of the sheet ("3", or "3:5").`,
    );
  if (change.fit) {
    if (axis === 'r') return refuse('write_invalid', 'Fit sizes columns; give rows a px height.');
    const write = fitColumnsWrite(wb, sheetId, at);
    return {
      ok: true,
      writes: write ? [write] : [],
      line: write
        ? `fitted ${spanText('c', at)} to their cells`
        : `nothing to fit in ${spanText('c', at)}`,
    };
  }
  const min = axis === 'c' ? COLUMN_WIDTH_MIN : ROW_HEIGHT_MIN;
  if (
    typeof change.px !== 'number' ||
    !Number.isFinite(change.px) ||
    change.px < min ||
    change.px > AXIS_SIZE_MAX
  )
    return refuse(
      'write_invalid',
      `Give px, ${min} to ${AXIS_SIZE_MAX}${axis === 'c' ? ', or fit: true' : ''}.`,
    );
  const px = Math.round(change.px);
  return {
    ok: true,
    writes: [resizeAxis(sheet, axis, at, px)!],
    line: `sized ${spanText(axis, at)} to ${px} px`,
  };
}

export function buildShapeChange(wb: Workbook, sheetId: string, change: SheetShapeChange): Built {
  const sheet = wb.sheet(sheetId)!;
  switch (change.op) {
    case 'resize':
      return resize(wb, sheetId, change);
    case 'merge': {
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      const made = mergeRange(sheet, range, change.across ? 'across' : 'all');
      if (!made)
        return refuse('range_invalid', `${formatRange(range)} is one cell, or past the sheet.`);
      const cleared = (made.write as { cells?: readonly CellChange[] }).cells?.length ?? 0;
      return {
        ok: true,
        writes: [made.write],
        line: `merged ${formatRange(range)}${change.across ? ' across' : ''}${
          cleared ? `, clearing ${plural(cleared, 'cell')} under the merge` : ''
        }`,
      };
    }
    case 'unmerge': {
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      const write = unmergeRange(sheet, range);
      return {
        ok: true,
        writes: write ? [write] : [],
        line: write
          ? `unmerged ${formatRange(range)}`
          : `nothing is merged in ${formatRange(range)}`,
      };
    }
    case 'border': {
      const range = parseRangeText(change.range);
      if (!range) return badRange(change.range);
      const color = (change.color ?? BORDER_COLOUR_DEFAULT).toLowerCase();
      if (!isColour(color)) return refuse('format_invalid', 'A border colour is #rrggbb.');
      const sides = change.sides ?? 'all';
      // The range was read above, so the sheet is in the workbook.
      const write = borderRange(wb, sheetId, range, sides, {
        w: change.width ?? 1,
        s: change.style ?? 'solid',
        c: color,
      })!;
      return {
        ok: true,
        writes: [write],
        line:
          sides === 'none'
            ? `took the borders off ${formatRange(range)}`
            : `drew ${sides} borders on ${formatRange(range)}`,
      };
    }
    case 'filter': {
      if (!change.range) {
        return {
          ok: true,
          writes: sheet.layout.filter
            ? [{ kind: 'layout', changes: [{ k: 'filter', filter: null }] }]
            : [],
          line: 'turned the filter off',
        };
      }
      const range = parseRangeText(change.range);
      const ids = range ? idRangeOf(sheet.layout, range.r1, range.c1, range.r2, range.c2) : null;
      if (!range || !ids) return badRange(change.range);
      return {
        ok: true,
        writes: [{ kind: 'layout', changes: [{ k: 'filter', filter: { ...ids, conds: {} } }] }],
        line: `turned the filter on over ${formatRange(range)}`,
      };
    }
  }
}
