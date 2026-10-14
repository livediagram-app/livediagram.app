// Column widths fitted to what their cells show (docs/specs/029-sheets/sheet-store.md "Agents", "Shaping a sheet"):
// each column as wide as its widest shown value, measured without a canvas (an agent's sheet is fitted in a Worker),
// within bounds. A cell merged across columns, a title over a table, never widens the one column it starts in.
import { layoutIndex, posRangeOf } from './layout';
import { displayValue } from './number-format';
import { FONT_SIZE_DEFAULT } from './format';
import { splitCellKey } from './sheet';
import type { SheetWrite } from './store';
import type { Workbook } from './engine/workbook';

// An average glyph's advance as a share of the font size, bold a little wider (the static render's chip estimate).
export const FIT_CHAR_EM = 0.56;
const FIT_BOLD = 1.08;
// Room either side of the text, and a dropdown chip's arrow and padding beside it.
export const FIT_PAD_PX = 18;
const FIT_CHIP_PX = 32;
// The narrowest and widest a fitted column is: a one-digit column stays clickable, a paragraph wraps or runs over.
export const FIT_MIN_PX = 56;
export const FIT_MAX_PX = 360;

// The fitted width of each column at `cols` (positions) that holds a shown value; a column with none is left out.
export function fittedWidths(
  wb: Workbook,
  sheetId: string,
  cols: readonly number[],
): Map<number, number> {
  const out = new Map<number, number>();
  const sheet = wb.sheet(sheetId);
  if (!sheet) return out;
  const { layout } = sheet;
  const ix = layoutIndex(layout);
  const wanted = new Set(cols);
  // The cells a merge spans more than one column from.
  const spanning = new Set<string>();
  for (const m of layout.merges ?? []) {
    const p = posRangeOf(layout, m);
    if (p && p.c2 > p.c1) spanning.add(`${p.r1},${p.c1}`);
  }
  const chipCols = new Set<number>();
  for (const rule of layout.rules ?? []) {
    if ((rule.is !== 'list' && rule.is !== 'range') || rule.show) continue;
    const p = posRangeOf(layout, rule);
    if (p) for (let c = p.c1; c <= p.c2; c++) chipCols.add(c);
  }
  for (const [key, cell] of sheet.cells) {
    if (!cell.input) continue;
    const { r: rowId, c: colId } = splitCellKey(key);
    const r = ix.rowPos.get(rowId);
    const c = ix.colPos.get(colId);
    if (r === undefined || c === undefined || !wanted.has(c) || spanning.has(`${r},${c}`)) continue;
    const text = displayValue(wb.value(sheetId, r, c), cell.format, wb.locale).text;
    if (!text) continue;
    const px = ((cell.format?.fs ?? FONT_SIZE_DEFAULT) * 4) / 3;
    const longest = Math.max(...text.split('\n').map((line) => line.length));
    const width =
      longest * px * FIT_CHAR_EM * (cell.format?.b ? FIT_BOLD : 1) +
      FIT_PAD_PX +
      (chipCols.has(c) ? FIT_CHIP_PX : 0);
    out.set(c, Math.max(out.get(c) ?? 0, width));
  }
  for (const [c, w] of out) out.set(c, Math.round(Math.min(FIT_MAX_PX, Math.max(FIT_MIN_PX, w))));
  return out;
}

// The write that sets those widths, one size change per width; null when no column holds a value.
export function fitColumnsWrite(
  wb: Workbook,
  sheetId: string,
  cols: readonly number[],
): SheetWrite | null {
  const sheet = wb.sheet(sheetId);
  if (!sheet) return null;
  const byPx = new Map<number, string[]>();
  for (const [c, px] of fittedWidths(wb, sheetId, cols)) {
    const id = sheet.layout.cols[c]!;
    byPx.set(px, [...(byPx.get(px) ?? []), id]);
  }
  if (byPx.size === 0) return null;
  return {
    kind: 'layout',
    changes: [...byPx].map(([px, ids]) => ({ k: 'size' as const, axis: 'c' as const, ids, px })),
  };
}
