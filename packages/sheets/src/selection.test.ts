import { describe, expect, it } from 'vitest';
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
