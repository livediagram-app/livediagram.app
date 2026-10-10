// Where rows and columns sit on screen (blueprint sheet-element.md "Layout"): offsets with hidden and filtered
// lines, the frozen panes, merges, the window in view, the cell under a point, the scroll that reveals a cell and
// how many rows a page is.
import { describe, expect, it } from 'vitest';
import type { SheetLayout } from '@livediagram/sheets';
import {
  COL_HEADER_PX,
  ROW_HEADER_PX,
  cellBox,
  geometryOf,
  hitTest,
  mergeAt,
  pageRows,
  scrollToReveal,
  totalSize,
  visibleWindow,
} from './sheet-geometry';

// A layout of `rows` x `cols` with ids r0.., c0.. (rows 24px and columns 100px unless sized).
function grid(rows: number, cols: number, extra: Partial<SheetLayout> = {}): SheetLayout {
  return {
    rows: Array.from({ length: rows }, (_, i) => `r${i}`),
    cols: Array.from({ length: cols }, (_, i) => `c${i}`),
    ...extra,
    // Fixed sizes (100 x 24), so the arithmetic below tests the geometry, not the engine's defaults.
    rowSize: {
      ...Object.fromEntries(Array.from({ length: rows }, (_, i) => [`r${i}`, 24])),
      ...extra.rowSize,
    },
    colSize: {
      ...Object.fromEntries(Array.from({ length: cols }, (_, i) => [`c${i}`, 100])),
      ...extra.colSize,
    },
  };
}

const at0 = { top: 0, left: 0 };
// A point in the frame from a point in the grid area (under the headers).
const pt = (gx: number, gy: number) => [ROW_HEADER_PX + gx, COL_HEADER_PX + gy] as const;

describe('geometryOf', () => {
  it('sums sizes, giving hidden rows and columns no size', () => {
    const g = geometryOf(
      grid(5, 3, {
        hiddenRows: ['r1'],
        hiddenCols: ['c2'],
        rowSize: { r3: 40 },
        colSize: { c1: 50 },
      }),
    );
    expect([...g.rows]).toEqual([0, 24, 24, 48, 88, 112]);
    expect([...g.cols]).toEqual([0, 100, 150, 150]);
    expect(totalSize(g)).toEqual({ width: 150, height: 112 });
    expect(g.hiddenRow(1)).toBe(true);
    expect(g.hiddenRow(0)).toBe(false);
    expect(g.hiddenCol(2)).toBe(true);
    expect(g.hiddenCol(0)).toBe(false);
  });

  it('draws rows the filter leaves out at no height', () => {
    const g = geometryOf(grid(3, 1), new Set(['r0']));
    expect([...g.rows]).toEqual([0, 0, 24, 48]);
    expect(g.hiddenRow(0)).toBe(true);
  });

  it('measures the frozen panes, clamped to the grid', () => {
    const g = geometryOf(grid(10, 5, { frozenRows: 2, frozenCols: 1 }));
    expect(g.frozenRows).toBe(2);
    expect(g.frozenHeight).toBe(48);
    expect(g.frozenWidth).toBe(100);
    const over = geometryOf(grid(3, 2, { frozenRows: 50, frozenCols: 9 }));
    expect(over.frozenRows).toBe(3);
    expect(over.frozenCols).toBe(2);
    expect(over.frozenHeight).toBe(72);
    expect(over.frozenWidth).toBe(200);
  });

  it('finds the merge over any covered cell and skips merges whose ids are gone', () => {
    const g = geometryOf(
      grid(5, 5, {
        merges: [
          { r1: 'r1', c1: 'c1', r2: 'r2', c2: 'c3' },
          { r1: 'gone', c1: 'c0', r2: 'r0', c2: 'c0' },
        ],
      }),
    );
    expect(g.merges.size).toBe(1);
    expect(mergeAt(g, 2, 3)).toEqual({ r1: 1, c1: 1, r2: 2, c2: 3 });
    expect(mergeAt(g, 1, 1)).toEqual({ r1: 1, c1: 1, r2: 2, c2: 3 });
    expect(mergeAt(g, 0, 0)).toBeNull();
    expect(mergeAt(g, 3, 3)).toBeNull();
  });
});

describe('visibleWindow', () => {
  it('is the scrolled rows and columns in view, plus overscan', () => {
    const g = geometryOf(grid(100, 30));
    expect(visibleWindow(g, { top: 240, left: 0 }, { width: 300, height: 240 })).toEqual({
      r1: 6,
      r2: 24,
      c1: 0,
      c2: 7,
    });
  });

  it('starts below the frozen panes', () => {
    const g = geometryOf(grid(100, 30, { frozenRows: 2, frozenCols: 1 }));
    const w = visibleWindow(g, at0, { width: 300, height: 240 });
    expect(w.r1).toBe(2);
    expect(w.r2).toBe(14);
    expect(w.c1).toBe(1);
    expect(w.c2).toBe(7);
  });

  it('is clamped to the grid, and empty when every line is frozen', () => {
    const g = geometryOf(grid(10, 2));
    expect(visibleWindow(g, at0, { width: 5000, height: 5000 })).toEqual({
      r1: 0,
      r2: 9,
      c1: 0,
      c2: 1,
    });
    const frozen = geometryOf(grid(3, 2, { frozenRows: 3, frozenCols: 2 }));
    const w = visibleWindow(frozen, at0, { width: 500, height: 500 });
    expect(w.r2).toBeLessThan(w.r1);
    expect(w.c2).toBeLessThan(w.c1);
  });
});

describe('cellBox', () => {
  it('places frozen cells fixed and scrolling ones by the scroll, spanning a merge', () => {
    const g = geometryOf(grid(10, 5, { frozenRows: 1, frozenCols: 1 }));
    const scroll = { top: 30, left: 40 };
    expect(cellBox(g, 0, 0, scroll)).toEqual({ x: 0, y: 0, w: 100, h: 24 });
    expect(cellBox(g, 3, 2, scroll)).toEqual({ x: 160, y: 42, w: 100, h: 24 });
    expect(cellBox(g, 3, 2, scroll, { r1: 3, c1: 2, r2: 4, c2: 3 })).toEqual({
      x: 160,
      y: 42,
      w: 200,
      h: 48,
    });
  });
});

describe('hitTest', () => {
  const g = geometryOf(grid(10, 5));

  it('finds the corner, cells and nothing past the grid', () => {
    expect(hitTest(g, 10, 10, at0)).toEqual({ kind: 'corner' });
    expect(hitTest(g, ...pt(150, 30), at0)).toEqual({ kind: 'cell', r: 1, c: 1 });
    expect(hitTest(g, ...pt(600, 30), at0)).toEqual({ kind: 'none' });
    expect(hitTest(g, ...pt(30, 600), at0)).toEqual({ kind: 'none' });
  });

  it('finds column headers and the edges between them', () => {
    expect(hitTest(g, ROW_HEADER_PX + 150, 10, at0)).toEqual({ kind: 'col', c: 1, edge: false });
    expect(hitTest(g, ROW_HEADER_PX + 198, 10, at0)).toEqual({ kind: 'col', c: 1, edge: true });
    // Just right of a boundary is the left column's edge; the first column has no left edge.
    expect(hitTest(g, ROW_HEADER_PX + 102, 10, at0)).toEqual({ kind: 'col', c: 0, edge: true });
    expect(hitTest(g, ROW_HEADER_PX + 2, 10, at0)).toEqual({ kind: 'col', c: 0, edge: false });
    expect(hitTest(g, ROW_HEADER_PX + 600, 10, at0)).toEqual({ kind: 'none' });
  });

  it('finds row headers and the edges between them', () => {
    expect(hitTest(g, 10, COL_HEADER_PX + 30, at0)).toEqual({ kind: 'row', r: 1, edge: false });
    expect(hitTest(g, 10, COL_HEADER_PX + 46, at0)).toEqual({ kind: 'row', r: 1, edge: true });
    expect(hitTest(g, 10, COL_HEADER_PX + 26, at0)).toEqual({ kind: 'row', r: 0, edge: true });
    expect(hitTest(g, 10, COL_HEADER_PX + 2, at0)).toEqual({ kind: 'row', r: 0, edge: false });
    expect(hitTest(g, 10, COL_HEADER_PX + 500, at0)).toEqual({ kind: 'none' });
  });

  it('answers a merged cell with its top-left', () => {
    const merged = geometryOf(grid(5, 5, { merges: [{ r1: 'r1', c1: 'c1', r2: 'r2', c2: 'c2' }] }));
    expect(hitTest(merged, ...pt(250, 60), at0)).toEqual({ kind: 'cell', r: 1, c: 1 });
  });

  it('adds the scroll, except over the frozen panes', () => {
    expect(hitTest(g, ...pt(10, 10), { top: 48, left: 100 })).toEqual({
      kind: 'cell',
      r: 2,
      c: 1,
    });
    const f = geometryOf(grid(10, 5, { frozenRows: 1, frozenCols: 1 }));
    const scroll = { top: 48, left: 100 };
    expect(hitTest(f, ...pt(10, 10), scroll)).toEqual({ kind: 'cell', r: 0, c: 0 });
    expect(hitTest(f, ...pt(150, 30), scroll)).toEqual({ kind: 'cell', r: 3, c: 2 });
    expect(hitTest(f, ROW_HEADER_PX + 50, 10, scroll)).toEqual({ kind: 'col', c: 0, edge: false });
    expect(hitTest(f, ROW_HEADER_PX + 150, 10, scroll)).toEqual({
      kind: 'col',
      c: 2,
      edge: false,
    });
    expect(hitTest(f, 10, COL_HEADER_PX + 10, scroll)).toEqual({ kind: 'row', r: 0, edge: false });
    expect(hitTest(f, 10, COL_HEADER_PX + 30, scroll)).toEqual({ kind: 'row', r: 3, edge: false });
  });
});

describe('scrollToReveal', () => {
  const g = geometryOf(grid(100, 30));
  const view = { width: 300, height: 240 };

  it('is null when the cell is already in view', () => {
    expect(scrollToReveal(g, 5, 1, at0, view)).toBeNull();
  });

  it('scrolls down and right to the far edge, and back up and left to the near one', () => {
    expect(scrollToReveal(g, 20, 0, at0, view)).toEqual({ top: 264, left: 0 });
    expect(scrollToReveal(g, 2, 0, { top: 200, left: 0 }, view)).toEqual({ top: 48, left: 0 });
    expect(scrollToReveal(g, 0, 5, at0, view)).toEqual({ top: 0, left: 300 });
    expect(scrollToReveal(g, 0, 0, { top: 0, left: 150 }, view)).toEqual({ top: 0, left: 0 });
  });

  it('never scrolls for a frozen line, and measures from below the frozen panes', () => {
    const f = geometryOf(grid(100, 30, { frozenRows: 2, frozenCols: 1 }));
    expect(scrollToReveal(f, 1, 0, { top: 500, left: 400 }, view)).toBeNull();
    expect(scrollToReveal(f, 2, 1, { top: 100, left: 0 }, view)).toEqual({ top: 0, left: 0 });
  });
});

describe('pageRows', () => {
  it('is the rows of average height that fit below the frozen rows, at least one', () => {
    expect(pageRows(geometryOf(grid(100, 3)), 240)).toBe(10);
    expect(pageRows(geometryOf(grid(100, 3, { frozenRows: 2 })), 240)).toBe(8);
    expect(pageRows(geometryOf(grid(100, 3)), 5)).toBe(1);
  });
});
