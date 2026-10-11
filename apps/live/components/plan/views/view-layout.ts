// How the larger visualisations fit their content to their box (docs/specs/026-plan/plan-views.md "Using the
// space"): a view fills a whole Visualisation tab or a small Dashboard slot alike, so each sizes its cards, bars and
// cells from the width and height it is given. Pure, so the breakpoints are tested without a DOM.

// The view's header (view-frame ViewFrame, 2.5rem) and the body's padding either side (px-3 / py-3).
export const VIEW_HEADER_PX = 40;
export const VIEW_PAD_PX = 12;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// Card Search: a grid of cards, Detailed where a column of at least 240 px fits and the view is tall enough for a
// Detailed card (about 200 px with the filter bar), else Compact; as many columns as fit, 12 px apart.
export const CARD_SEARCH_GAP_PX = 12;
export const CARD_SEARCH_DETAILED_MIN_PX = 240;
export const CARD_SEARCH_COMPACT_MIN_PX = 200;
export const CARD_SEARCH_DETAILED_MIN_HEIGHT_PX = 260;
// The most cards drawn at once, as the card finder caps its rows (CARD_FINDER_ROWS_MAX): a Detailed face is a few
// dozen nodes, so thousands would stall a render. The rest are counted under the grid.
export const CARD_SEARCH_SHOWN_MAX = 200;

export function cardSearchLayout(
  width: number,
  height: number,
): { size: 'detailed' | 'compact'; columns: number } {
  const inner = width - 2 * VIEW_PAD_PX;
  const size =
    inner >= CARD_SEARCH_DETAILED_MIN_PX && height >= CARD_SEARCH_DETAILED_MIN_HEIGHT_PX
      ? 'detailed'
      : 'compact';
  const min = size === 'detailed' ? CARD_SEARCH_DETAILED_MIN_PX : CARD_SEARCH_COMPACT_MIN_PX;
  const columns = Math.max(
    1,
    Math.floor((inner + CARD_SEARCH_GAP_PX) / (min + CARD_SEARCH_GAP_PX)),
  );
  return { size, columns };
}

// Cards by Field: the rows share the body's height, each up to 96 px tall with a bar up to 44 px thick; below 24 px a
// row the list scrolls instead of squeezing. Labels and counts grow with the bar.
export const WORKLOAD_ROW_MIN_PX = 24;
export const WORKLOAD_ROW_MAX_PX = 96;
export const WORKLOAD_BAR_MIN_PX = 14;
export const WORKLOAD_BAR_MAX_PX = 44;
// The legend's line above the bars.
const WORKLOAD_LEGEND_PX = 28;

export type WorkloadLayout = {
  rowHeight: number;
  bar: number;
  font: number;
  countFont: number;
  labelColumn: number;
  scrolls: boolean;
};

export function workloadLayout(width: number, height: number, rows: number): WorkloadLayout {
  const body = height - VIEW_HEADER_PX - 2 * VIEW_PAD_PX - WORKLOAD_LEGEND_PX;
  const per = body / Math.max(1, rows);
  const rowHeight = Math.floor(clamp(per, WORKLOAD_ROW_MIN_PX, WORKLOAD_ROW_MAX_PX));
  const bar = Math.round(clamp(rowHeight * 0.55, WORKLOAD_BAR_MIN_PX, WORKLOAD_BAR_MAX_PX));
  const font = bar >= 32 ? 16 : bar >= 22 ? 14 : 12;
  return {
    rowHeight,
    bar,
    font,
    countFont: font >= 16 ? 15 : font >= 14 ? 13 : 11,
    // A third of a narrow view, up to 260 px in a wide one.
    labelColumn: Math.round(clamp(width * 0.3, 96, 260)),
    scrolls: per < WORKLOAD_ROW_MIN_PX,
  };
}

// Priority by Status: the cells share the body; the count grows with the cell (12 to 44 px), the row and column
// names with it (12 to 16 px).
export const MATRIX_COUNT_MIN_PX = 12;
export const MATRIX_COUNT_MAX_PX = 44;

export type MatrixLayout = {
  labelColumn: number;
  gap: number;
  countFont: number;
  labelFont: number;
};

export function matrixLayout(width: number, height: number, rows: number): MatrixLayout {
  const gap = width >= 600 && height >= 320 ? 6 : 4;
  const labelColumn = Math.round(clamp(width * 0.2, 72, 180));
  const cellW = (width - 2 * VIEW_PAD_PX - labelColumn - 3 * gap) / 3;
  // The column names take a line (about 24 px) over the cells.
  const cellH = (height - VIEW_HEADER_PX - 2 * VIEW_PAD_PX - 24 - rows * gap) / Math.max(1, rows);
  const countFont = Math.round(
    clamp(Math.min(cellW * 0.25, cellH * 0.5), MATRIX_COUNT_MIN_PX, MATRIX_COUNT_MAX_PX),
  );
  const labelFont = Math.round(clamp(cellH * 0.3, 12, 16));
  return { labelColumn, gap, countFont, labelFont };
}
