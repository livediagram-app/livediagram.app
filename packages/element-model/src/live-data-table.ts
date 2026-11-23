// What a live read gives an element (liveworkspace/docs/specs/004-index/live-data.md "The element"): the read's series
// picked and ordered by the link's `series`, and a table's cells from a read (a header row, then a row per category),
// bounded so a read never grows a table past what it draws. Pure.
import type { ChartTable } from './chart-table';

// A header and 500 categories; a label column and 12 series.
export const LIVE_TABLE_ROWS_MAX = 501;
export const LIVE_TABLE_COLS_MAX = 13;

// The series that feed the element: those `series` names, in its order (an index past the read is skipped); all of
// them when it names none, or when none it names is there.
export function pickSeries(table: ChartTable, series: readonly number[] | undefined): ChartTable {
  if (!series?.length) return table;
  const picked = series.flatMap((i) => {
    const s = table.series[i];
    return s ? [s] : [];
  });
  return picked.length ? { categories: table.categories, series: picked } : table;
}

// A number as a table cell shows it: whole numbers plainly, others to at most two places, never in exponent form.
export function liveCellText(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

// A table's cells from a read: the header row (`labelHeading`, then each series' name), then each category with its
// values.
export function tableCellsFromRead(table: ChartTable, labelHeading: string): string[][] {
  const series = table.series.slice(0, LIVE_TABLE_COLS_MAX - 1);
  const rows = table.categories.slice(0, LIVE_TABLE_ROWS_MAX - 1);
  return [
    [labelHeading, ...series.map((s) => s.name)],
    ...rows.map((label, r) => [
      label,
      ...series.map((s) => {
        const v = s.values[r];
        return v === undefined ? '' : liveCellText(v);
      }),
    ]),
  ];
}

type TableFields = {
  cells: string[][];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  cellStyles?: unknown[][];
  headerRow?: boolean;
};

// The patch a read makes to a table: its new cells, a header row, and the per-row and per-column sizes and cell
// styles kept only while the grid keeps its shape (a reshaped grid would misalign them). Null when nothing changes.
export function liveTablePatch<T extends TableFields>(
  el: T,
  cells: string[][],
): Partial<TableFields> | null {
  const same = JSON.stringify(el.cells) === JSON.stringify(cells);
  if (same && el.headerRow === true) return null;
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const sameRows = el.cells.length === rows;
  const sameCols = (el.cells[0]?.length ?? 0) === cols;
  return {
    cells,
    headerRow: true,
    ...(sameCols ? {} : { colWidths: undefined }),
    ...(sameRows ? {} : { rowHeights: undefined }),
    ...(sameRows && sameCols ? {} : { cellStyles: undefined }),
  };
}
