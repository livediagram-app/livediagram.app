import { COLUMN_WIDTH_NEW, ROW_HEIGHT_NEW } from './limits';
import { describe, expect, it } from 'vitest';
import {
  axisOffsets,
  colWidth,
  idRangeOf,
  indexAtOffset,
  insertIds,
  layoutIndex,
  moveIds,
  posRangeOf,
  rowHeight,
} from './layout';
import {
  copyTitle,
  emptyLayout,
  emptySheet,
  nextSheetTitle,
  cellKey,
  splitCellKey,
  uniqueSheetTitle,
} from './sheet';
import { isAxisId, isSheetId, makeAxisIds, makeSheetId } from './ids';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('ids', () => {
  it('makes valid, distinct ids', () => {
    const ids = makeAxisIds(500, seeded(), new Set(['aaaaaa']));
    expect(new Set(ids).size).toBe(500);
    expect(ids.every(isAxisId)).toBe(true);
    expect(ids).not.toContain('aaaaaa');
    expect(isSheetId(makeSheetId(seeded(7)))).toBe(true);
    expect(isSheetId('short')).toBe(false);
    expect(isAxisId('ABC123')).toBe(false);
  });
  it('retries a collision', () => {
    let calls = 0;
    // The first six draws spell the taken id, then fresh ones.
    const r = () => (calls++ < 6 ? 0 : 0.5);
    expect(makeAxisIds(1, r, new Set(['aaaaaa']))).toEqual(['ssssss']);
  });
});

describe('layout', () => {
  const layout = { rows: ['r1aa', 'r2aa', 'r3aa'], cols: ['c1aa', 'c2aa'], rowSize: { r2aa: 40 } };
  it('indexes ids', () => {
    const ix = layoutIndex(layout);
    expect(ix.rowPos.get('r3aa')).toBe(2);
    expect(ix.colPos.get('c2aa')).toBe(1);
    expect(layoutIndex(layout)).toBe(ix);
  });
  it('reads sizes with defaults', () => {
    expect(rowHeight(layout, 'r2aa')).toBe(40);
    expect(rowHeight(layout, 'r1aa')).toBe(ROW_HEIGHT_NEW);
    expect(colWidth(layout, 'c1aa')).toBe(COLUMN_WIDTH_NEW);
  });
  it('maps ranges both ways', () => {
    const ids = idRangeOf(layout, 2, 1, 0, 0)!;
    expect(ids).toEqual({ r1: 'r1aa', c1: 'c1aa', r2: 'r3aa', c2: 'c2aa' });
    expect(posRangeOf(layout, ids)).toEqual({ r1: 0, c1: 0, r2: 2, c2: 1 });
    expect(posRangeOf(layout, { ...ids, r1: 'gone' })).toBeNull();
    expect(idRangeOf({ rows: [], cols: [] }, 0, 0, 0, 0)).toBeNull();
    expect(idRangeOf(layout, 0, 0, 99, 99)).toEqual(ids);
  });
  it('inserts and moves ids', () => {
    expect(insertIds(['a', 'b'], null, ['x'])).toEqual(['x', 'a', 'b']);
    expect(insertIds(['a', 'b'], 'a', ['x', 'y'])).toEqual(['a', 'x', 'y', 'b']);
    expect(insertIds(['a', 'b'], 'gone', ['x'])).toEqual(['a', 'b', 'x']);
    expect(moveIds(['a', 'b', 'c', 'd'], ['d', 'b'], 'a')).toEqual(['a', 'b', 'd', 'c']);
    expect(moveIds(['a', 'b', 'c'], ['c'], null)).toEqual(['c', 'a', 'b']);
    expect(moveIds(['a', 'b'], ['zz'], null)).toEqual(['a', 'b']);
    expect(moveIds(['a', 'b'], ['a'], 'a')).toEqual(['a', 'b']);
    expect(moveIds(['a', 'b'], ['a'], 'gone')).toEqual(['a', 'b']);
  });
  it('finds offsets with hidden axes', () => {
    const off = axisOffsets(['a', 'b', 'c'], (id) => (id === 'b' ? 50 : 10), new Set(['c']));
    expect([...off]).toEqual([0, 10, 60, 60]);
    expect(indexAtOffset(off, 0)).toBe(0);
    expect(indexAtOffset(off, 9.9)).toBe(0);
    expect(indexAtOffset(off, 10)).toBe(1);
    expect(indexAtOffset(off, 1000)).toBe(2);
    expect(indexAtOffset(new Float64Array([0]), 5)).toBe(0);
  });
});

describe('sheet', () => {
  it('starts empty at 100 by 26', () => {
    const l = emptyLayout(seeded());
    expect(l.rows).toHaveLength(100);
    expect(l.cols).toHaveLength(26);
    const s = emptySheet({ id: 'sheet01', tabId: 't', title: 'Sheet 1', rand: seeded() });
    expect(s.cells.size).toBe(0);
    expect(s.rev).toBe(0);
  });
  it('names sheets and copies', () => {
    expect(nextSheetTitle([])).toBe('Sheet 1');
    expect(nextSheetTitle(['sheet 1', 'Sheet 2'])).toBe('Sheet 3');
    expect(copyTitle('Budget', [])).toBe('Budget (copy)');
    expect(copyTitle('Budget', ['Budget (copy)'])).toBe('Budget (copy 2)');
  });
  it('keeps an asked-for title unique', () => {
    expect(uniqueSheetTitle(' Budget ', [])).toBe('Budget');
    expect(uniqueSheetTitle('Budget', ['budget', 'Budget 2'])).toBe('Budget 3');
    expect(uniqueSheetTitle('   ', ['Sheet 1'])).toBe('Sheet 2');
    expect(uniqueSheetTitle('x'.repeat(80), [])).toHaveLength(56);
  });
  it('keys cells', () => {
    expect(splitCellKey(cellKey('r1', 'c1'))).toEqual({ r: 'r1', c: 'c1' });
  });
});
