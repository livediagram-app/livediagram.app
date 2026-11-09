import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  addRange,
  currentRegion,
  cycleInRange,
  expandForMerges,
  extendSelection,
  extendTo,
  homeEnd,
  inSelection,
  jumpFrom,
  moveSelection,
  pageSelection,
  selectAll,
  selectAllCells,
  selectCols,
  selectRows,
  selectsSeveral,
  single,
  stepFrom,
  type Grid,
} from './selection';

// A 10 by 6 grid; filled cells listed as "r,c"; row 3 and column 4 hidden; a merge at B2:C3 (1,1)-(2,2).
function grid(filled: string[] = [], opts: { hidden?: boolean; merge?: boolean } = {}): Grid {
  const set = new Set(filled);
  return {
    rows: 10,
    cols: 6,
    hiddenRow: (r) => !!opts.hidden && r === 3,
    hiddenCol: (c) => !!opts.hidden && c === 4,
    filled: (r, c) => set.has(`${r},${c}`),
    mergeAt: (r, c) =>
      opts.merge && r >= 1 && r <= 2 && c >= 1 && c <= 2 ? { r1: 1, c1: 1, r2: 2, c2: 2 } : null,
  };
}

describe('moves', () => {
  it('steps, staying in the grid and skipping hidden lines', () => {
    const g = grid([], { hidden: true });
    expect(stepFrom({ r: 0, c: 0 }, 'up', g)).toEqual({ r: 0, c: 0 });
    expect(stepFrom({ r: 2, c: 0 }, 'down', g)).toEqual({ r: 4, c: 0 });
    expect(stepFrom({ r: 0, c: 3 }, 'right', g)).toEqual({ r: 0, c: 5 });
    expect(stepFrom({ r: 9, c: 5 }, 'down', g)).toEqual({ r: 9, c: 5 });
    expect(stepFrom({ r: 0, c: 5 }, 'right', g)).toEqual({ r: 0, c: 5 });
  });
  it('treats a merge as one cell', () => {
    const g = grid([], { merge: true });
    expect(stepFrom({ r: 0, c: 1 }, 'down', g)).toEqual({ r: 1, c: 1 });
    expect(stepFrom({ r: 1, c: 1 }, 'down', g)).toEqual({ r: 3, c: 1 });
    expect(stepFrom({ r: 1, c: 1 }, 'right', g)).toEqual({ r: 1, c: 3 });
    expect(stepFrom({ r: 2, c: 2 }, 'up', g)).toEqual({ r: 0, c: 2 });
    expect(stepFrom({ r: 2, c: 2 }, 'left', g)).toEqual({ r: 2, c: 0 });
    expect(expandForMerges({ r1: 0, c1: 0, r2: 1, c2: 1 }, g)).toEqual({
      r1: 0,
      c1: 0,
      r2: 2,
      c2: 2,
    });
  });
  it('jumps to the edges of filled runs', () => {
    const g = grid(['0,0', '1,0', '2,0', '6,0']);
    expect(jumpFrom({ r: 0, c: 0 }, 'down', g)).toEqual({ r: 2, c: 0 });
    expect(jumpFrom({ r: 2, c: 0 }, 'down', g)).toEqual({ r: 6, c: 0 });
    expect(jumpFrom({ r: 6, c: 0 }, 'down', g)).toEqual({ r: 9, c: 0 });
    expect(jumpFrom({ r: 9, c: 0 }, 'down', g)).toEqual({ r: 9, c: 0 });
    expect(jumpFrom({ r: 6, c: 0 }, 'up', g)).toEqual({ r: 2, c: 0 });
    expect(jumpFrom({ r: 0, c: 1 }, 'right', grid())).toEqual({ r: 0, c: 5 });
    expect(jumpFrom({ r: 0, c: 0 }, 'down', grid(['0,0', '1,0']))).toEqual({ r: 1, c: 0 });
    expect(moveSelection(single({ r: 0, c: 0 }), 'down', g, true).active).toEqual({ r: 2, c: 0 });
    expect(moveSelection(single({ r: 0, c: 0 }), 'right', g).active).toEqual({ r: 0, c: 1 });
  });
  it('extends from the anchor', () => {
    const g = grid(['0,0', '1,0', '2,0']);
    let sel = single({ r: 0, c: 0 });
    sel = extendSelection(sel, 'down', g);
    sel = extendSelection(sel, 'right', g);
    expect(sel.ranges).toEqual([{ r1: 0, c1: 0, r2: 1, c2: 1 }]);
    expect(sel.active).toEqual({ r: 0, c: 0 });
    expect(extendSelection(single({ r: 0, c: 0 }), 'down', g, true).ranges[0]).toEqual({
      r1: 0,
      c1: 0,
      r2: 2,
      c2: 0,
    });
    expect(extendTo(sel, { r: 50, c: -2 }, g).ranges[0]).toEqual({ r1: 0, c1: 0, r2: 9, c2: 0 });
    expect(
      extendTo(single({ r: 0, c: 0 }), { r: 1, c: 1 }, grid([], { merge: true })).ranges[0],
    ).toEqual({ r1: 0, c1: 0, r2: 2, c2: 2 });
  });
  it('adds ranges and selects lines', () => {
    const g = grid([], { merge: true });
    const sel = addRange(single({ r: 0, c: 0 }), { r: 5, c: 5 }, g);
    expect(sel.ranges).toHaveLength(2);
    expect(addRange(sel, { r: 1, c: 1 }, g).ranges[2]).toEqual({ r1: 1, c1: 1, r2: 2, c2: 2 });
    expect(inSelection(sel, 5, 5)).toBe(true);
    expect(inSelection(sel, 4, 4)).toBe(false);
    expect(selectRows(3, 1, g).ranges[0]).toEqual({ r1: 1, c1: 0, r2: 3, c2: 5 });
    expect(selectCols(2, 4, g).ranges[0]).toEqual({ r1: 0, c1: 2, r2: 9, c2: 4 });
    expect(selectAllCells(g).ranges[0]).toEqual({ r1: 0, c1: 0, r2: 9, c2: 5 });
  });
  it('selects the current region, then everything', () => {
    const g = grid(['1,1', '1,2', '2,2', '3,3', '8,5']);
    expect(currentRegion({ r: 1, c: 1 }, g)).toEqual({ r1: 1, c1: 1, r2: 3, c2: 3 });
    const first = selectAll(single({ r: 1, c: 1 }), g);
    expect(first.ranges[0]).toEqual({ r1: 1, c1: 1, r2: 3, c2: 3 });
    expect(selectAll(first, g).ranges[0]).toEqual({ r1: 0, c1: 0, r2: 9, c2: 5 });
    expect(selectAll(single({ r: 6, c: 0 }), g).ranges[0]).toEqual({ r1: 0, c1: 0, r2: 9, c2: 5 });
    expect(currentRegion({ r: 9, c: 5 }, grid(['9,5', '8,4', '0,0']))).toEqual({
      r1: 8,
      c1: 4,
      r2: 9,
      c2: 5,
    });
  });
  it('pages, goes home and end, and cycles inside a range', () => {
    const g = grid();
    expect(pageSelection(single({ r: 0, c: 0 }), 4, g).active).toEqual({ r: 4, c: 0 });
    expect(pageSelection(single({ r: 2, c: 0 }), -4, g).active).toEqual({ r: 0, c: 0 });
    expect(homeEnd(single({ r: 3, c: 3 }), 'home', false, g, { r: 0, c: 0 }).active).toEqual({
      r: 3,
      c: 0,
    });
    expect(homeEnd(single({ r: 3, c: 3 }), 'end', false, g, { r: 0, c: 0 }).active).toEqual({
      r: 3,
      c: 5,
    });
    expect(homeEnd(single({ r: 3, c: 3 }), 'home', true, g, { r: 0, c: 0 }).active).toEqual({
      r: 0,
      c: 0,
    });
    expect(homeEnd(single({ r: 3, c: 3 }), 'end', true, g, { r: 7, c: 2 }).active).toEqual({
      r: 7,
      c: 2,
    });
    const sel = {
      ranges: [{ r1: 0, c1: 0, r2: 1, c2: 1 }],
      active: { r: 1, c: 1 },
      anchor: { r: 0, c: 0 },
    };
    expect(cycleInRange(sel, 'next-row').active).toEqual({ r: 0, c: 0 });
    expect(cycleInRange({ ...sel, active: { r: 0, c: 0 } }, 'prev-row').active).toEqual({
      r: 1,
      c: 1,
    });
    expect(cycleInRange(sel, 'next-col').active).toEqual({ r: 0, c: 0 });
    expect(cycleInRange({ ...sel, active: { r: 0, c: 0 } }, 'prev-col').active).toEqual({
      r: 1,
      c: 1,
    });
    expect(cycleInRange({ ...sel, active: { r: 0, c: 0 } }, 'next-row').active).toEqual({
      r: 1,
      c: 0,
    });
  });
});

// docs/specs/029-sheets/sheet.md "Keyboard": Home, End and Enter / Tab in a range put the active cell on a hidden
// line or a merge's covered cell, where nothing could be seen and typing wrote into it.
describe('moves land on shown cells', () => {
  // Column 0 and the last column hidden, rows 0 and 3 hidden, a merge at B2:C3 (1,1)-(2,2).
  const g: Grid = {
    rows: 10,
    cols: 6,
    hiddenRow: (r) => r === 0 || r === 3,
    hiddenCol: (c) => c === 0 || c === 5,
    filled: () => false,
    mergeAt: (r, c) =>
      r >= 1 && r <= 2 && c >= 1 && c <= 2 ? { r1: 1, c1: 1, r2: 2, c2: 2 } : null,
  };
  it('goes home and end past hidden columns and rows, onto a merge’s top-left', () => {
    const at = (which: 'home' | 'end', toSheet: boolean, from = { r: 5, c: 3 }) =>
      homeEnd(single(from), which, toSheet, g, { r: 9, c: 5 }).active;
    expect(at('home', false)).toEqual({ r: 5, c: 1 });
    expect(at('end', false)).toEqual({ r: 5, c: 4 });
    expect(at('home', false, { r: 2, c: 4 })).toEqual({ r: 1, c: 1 });
    expect(at('home', true)).toEqual({ r: 1, c: 1 });
    expect(at('end', true)).toEqual({ r: 9, c: 4 });
  });
  it('walks Enter and Tab past hidden rows and a merge’s covered cells', () => {
    const sel = {
      ranges: [{ r1: 1, c1: 1, r2: 4, c2: 3 }],
      active: { r: 1, c: 1 },
      anchor: { r: 1, c: 1 },
    };
    const walk = (dir: 'next-row' | 'next-col', n: number) => {
      const out = [];
      let s = sel;
      for (let i = 0; i < n; i++) out.push((s = cycleInRange(s, dir, g)).active);
      return out;
    };
    expect(walk('next-row', 4)).toEqual([
      { r: 4, c: 1 },
      { r: 4, c: 2 },
      { r: 1, c: 3 },
      { r: 2, c: 3 },
    ]);
    expect(walk('next-col', 3)).toEqual([
      { r: 1, c: 3 },
      { r: 2, c: 3 },
      { r: 4, c: 1 },
    ]);
    // A range of nothing shown leaves the active cell.
    const hidden = { ...sel, ranges: [{ r1: 3, c1: 0, r2: 3, c2: 5 }], active: { r: 3, c: 1 } };
    expect(cycleInRange(hidden, 'next-col', g).active).toEqual({ r: 3, c: 1 });
  });
  it('gives up on a whole sheet with nothing shown within budget', () => {
    // The largest sheet (10,000 rows by 200 columns) selected whole, every row hidden: 2,000,000 steps at most.
    const all: Grid = { ...g, rows: 10_000, cols: 200, hiddenRow: () => true };
    const sel = {
      ranges: [{ r1: 0, c1: 0, r2: 9_999, c2: 199 }],
      active: { r: 0, c: 0 },
      anchor: { r: 0, c: 0 },
    };
    let active;
    const ms = cpuMsOf(() => {
      active = cycleInRange(sel, 'next-row', all).active;
    });
    expect(active).toEqual({ r: 0, c: 0 });
    // Measured at 20 ms of CPU on a laptop; cpuBudgetMs triples the budget on CI.
    expect(ms).toBeLessThan(cpuBudgetMs(250));
  });
});

// docs/specs/029-sheets/sheet.md "Keyboard": a merge is one cell, so Enter and Tab on a clicked merge do not cycle
// into the cells it covers.
describe('selectsSeveral', () => {
  const merged = { r1: 1, c1: 1, r2: 2, c2: 2 };
  const sel = (range: typeof merged, active = { r: range.r1, c: range.c1 }) => ({
    ranges: [range],
    active,
    anchor: active,
  });

  it('is one cell for a single cell and for a clicked merge', () => {
    expect(selectsSeveral(single({ r: 4, c: 4 }), grid())).toBe(false);
    expect(selectsSeveral(sel(merged), grid([], { merge: true }))).toBe(false);
  });

  it('is several for a range past the merge, or a merge-sized range with no merge', () => {
    expect(selectsSeveral(sel({ ...merged, c2: 3 }), grid([], { merge: true }))).toBe(true);
    expect(selectsSeveral(sel(merged), grid())).toBe(true);
  });
});
