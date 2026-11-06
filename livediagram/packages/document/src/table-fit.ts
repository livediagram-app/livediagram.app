// A table's rows grow to fit their words (docs/specs/009-elements/table-rows-fit-text.md): the row heights and
// table height that hold every cell's text, measured as the export wraps it, taller only.
import { tableCellFontPx } from '@liveworkspace/model-core/table-cell-font';
import { PADDING_PX, type TableElement } from './index';
import { LABEL_LINE_HEIGHT, labelMeasure, wrapLabel } from './svg-render-primitives';
import { tableTrackSizes } from './svg-render-table';

// How many times a table sized to scale is measured again after growing (its font follows the row height).
export const TABLE_FIT_PASSES = 4;

type Measure = (fontPx: number, bold: boolean, italic: boolean) => (s: string) => number;

// The px a row of these cells needs: its tallest cell's wrapped lines plus the padding above and below.
function rowNeeds(
  el: TableElement,
  cells: string[][],
  r: number,
  colSizes: number[],
  rowH: number,
  measure: Measure,
): number {
  const pad = PADDING_PX[el.padding ?? 'sm'];
  const baseFontPx = tableCellFontPx(el.textSize, rowH);
  let need = 0;
  const row = cells[r] ?? [];
  for (let c = 0; c < row.length; c++) {
    const text = row[c] ?? '';
    if (!text) continue;
    const cs = el.cellStyles?.[r]?.[c] ?? null;
    const isHeader = (el.headerRow && r === 0) || (el.headerColumn && c === 0);
    const bold = isHeader || (cs?.bold ?? el.textBold) === true;
    const italic = (cs?.italic ?? el.textItalic) === true;
    const fontPx = tableCellFontPx(cs?.textSize, rowH, baseFontPx);
    const lines = wrapLabel(
      text,
      Math.max(8, (colSizes[c] ?? 0) - pad * 2),
      measure(fontPx, bold, italic),
      true,
    ).length;
    need = Math.max(need, lines * fontPx * LABEL_LINE_HEIGHT + pad * 2);
  }
  return Math.ceil(need);
}

// The `rowHeights` and `height` that fit this table's cells, or null when every row measured already holds its
// words. A row that needs more is pinned to what it needs and the table grows by the same amount; no row ever
// shrinks. Only the rows whose words differ from `before` are measured (every row without it), so typing in one cell
// of a large table measures one row, not the table.
export function tableGrowthForCells(
  el: TableElement,
  before: readonly (readonly string[])[] | null = null,
  measure: Measure = labelMeasure,
): Pick<TableElement, 'rowHeights' | 'height'> | null {
  const cells = el.cells;
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return null;
  const changed: number[] = [];
  for (let r = 0; r < rows; r++) {
    const was = before?.[r];
    const now = cells[r]!;
    if (!was || was.length !== now.length || now.some((t, c) => t !== was[c])) changed.push(r);
  }
  if (changed.length === 0) return null;
  const colSizes = tableTrackSizes(el.width, cols, el.colWidths);
  let height = el.height;
  let pinned: (number | null)[] = Array.from(
    { length: rows },
    (_, i) => el.rowHeights?.[i] ?? null,
  );
  let grew = false;
  for (let pass = 0; pass < TABLE_FIT_PASSES; pass++) {
    const sizes = tableTrackSizes(height, rows, pinned);
    const rowH = height / rows;
    let delta = 0;
    const next = [...pinned];
    for (const r of changed) {
      const need = rowNeeds(el, cells, r, colSizes, rowH, measure);
      // Half a pixel of slack, so a row a rounding short of its words doesn't grow by one.
      if (need > sizes[r]! + 0.5) {
        delta += need - sizes[r]!;
        next[r] = need;
      }
    }
    if (delta === 0) break;
    grew = true;
    pinned = next;
    height += delta;
  }
  return grew ? { rowHeights: pinned, height } : null;
}
