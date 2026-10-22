// A sheet's charts kept with their cells through an agent's change (docs/specs/029-sheets/sheet-store.md "Shaping a
// sheet"): a chart sits at a px anchor from A1's corner, so a column an agent inserts, resizes or deletes before it
// would leave it over other cells. Each chart is read as the cell under its anchor and its offset in that cell, and
// put back on that cell after the change; a chart whose cell went keeps its place. And the charts `clear_charts`
// takes: every one of the sheet's, or those reading cells of a range. Pure.
import {
  colWidth,
  posRangeOf,
  rowHeight,
  type GridRange,
  type IdRange,
  type SheetLayout,
} from '@livedesign/sheets';
import { anchorAt } from './sheet-charts';

// A chart element as it sits on the tab.
export type SheetChartEl = {
  id: string;
  chartSource?: { sheetId?: string; range?: IdRange };
  sheetAnchor?: { x: number; y: number };
};

// The cell under an anchor: its row and column ids, and how far into the cell the anchor sits.
type AnchorCell = { row: string; col: string; dx: number; dy: number };

// The line (row or column) a px offset falls in along an axis, and the offset into it; past the last, the last.
function lineAt(
  ids: readonly string[],
  hidden: ReadonlySet<string>,
  size: (id: string) => number,
  px: number,
): { id: string; into: number } | null {
  let start = 0;
  let last: { id: string; into: number } | null = null;
  for (const id of ids) {
    if (hidden.has(id)) continue;
    const s = size(id);
    if (px < start + s) return { id, into: px - start };
    last = { id, into: px - start };
    start += s;
  }
  return last;
}

export function anchorCell(
  layout: SheetLayout,
  anchor: { x: number; y: number },
): AnchorCell | null {
  const col = lineAt(
    layout.cols,
    new Set(layout.hiddenCols ?? []),
    (id) => colWidth(layout, id),
    anchor.x,
  );
  const row = lineAt(
    layout.rows,
    new Set(layout.hiddenRows ?? []),
    (id) => rowHeight(layout, id),
    anchor.y,
  );
  return col && row ? { row: row.id, col: col.id, dx: col.into, dy: row.into } : null;
}

// Where a chart on `cell` sits in `layout`, or null when its row or column is gone.
export function anchorOnCell(
  layout: SheetLayout,
  cell: AnchorCell,
): { x: number; y: number } | null {
  const r = layout.rows.indexOf(cell.row);
  const c = layout.cols.indexOf(cell.col);
  if (r < 0 || c < 0) return null;
  const at = anchorAt(layout, [r, c]);
  return { x: Math.round(at.x + cell.dx), y: Math.round(at.y + cell.dy) };
}

const chartsOf = (elements: readonly SheetChartEl[], sheetId: string) =>
  elements.filter((el) => el.chartSource?.sheetId === sheetId && el.sheetAnchor);

// The sheet's charts whose anchor a change from `before` to `after` would leave over other cells, each with the
// anchor that keeps it on its cell.
export function chartsFollowing(
  elements: readonly SheetChartEl[],
  sheetId: string,
  before: SheetLayout,
  after: SheetLayout,
): { id: string; sheetAnchor: { x: number; y: number } }[] {
  if (before === after) return [];
  const out: { id: string; sheetAnchor: { x: number; y: number } }[] = [];
  for (const el of chartsOf(elements, sheetId)) {
    // A sheet keeps a row and a column, so an anchor is always over a cell.
    const moved = anchorOnCell(after, anchorCell(before, el.sheetAnchor!)!);
    if (moved && (moved.x !== el.sheetAnchor!.x || moved.y !== el.sheetAnchor!.y))
      out.push({ id: el.id, sheetAnchor: moved });
  }
  return out;
}

// The ids of the sheet's charts that read any cell of `range` (every chart of the sheet when null).
export function chartsCleared(
  elements: readonly SheetChartEl[],
  sheetId: string,
  layout: SheetLayout,
  range: GridRange | null,
): string[] {
  return elements
    .filter((el) => el.chartSource?.sheetId === sheetId)
    .filter((el) => {
      if (!range) return true;
      const p = el.chartSource!.range ? posRangeOf(layout, el.chartSource!.range) : null;
      return !!p && p.r1 <= range.r2 && range.r1 <= p.r2 && p.c1 <= range.c2 && range.c1 <= p.c2;
    })
    .map((el) => el.id);
}
