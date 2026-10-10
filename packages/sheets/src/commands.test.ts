import { describe, expect, it } from 'vitest';
import { book } from './testing/book';
import {
  borderRange,
  boundedRange,
  clearRanges,
  fillFromEdge,
  fillRange,
  formatRanges,
  mergeRange,
  splitWrite,
  stepDecimals,
  typeInto,
  typeIntoRanges,
  unmergeRange,
} from './commands';
import {
  appendAxis,
  deleteAxis,
  freeze,
  hideAxis,
  insertAxis,
  moveAxis,
  resizeAxis,
  setFilterCondition,
  sortRange,
  sortSheet,
  toggleFilter,
} from './commands-axis';
import { applySheetWrite, type SheetWrite } from './store';
import { cellKey, type Sheet } from './sheet';
import { renderFormula } from './formula/stored';
import type { Grid } from './selection';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
const seeded = () => {
  let s = 3;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

// Apply a write to the book's first sheet and keep the workbook in step; returns the new sheet.
function run(b: ReturnType<typeof book>, w: SheetWrite | null, i = 0): Sheet {
  if (!w) throw new Error('no write');
  const r = applySheetWrite(b.sheets[i]!, w, ctx);
  b.sheets[i] = r.sheet;
  b.wb.updateSheet(r.sheet, w.kind === 'cells' ? r.touched : undefined);
  return r.sheet;
}

function input(b: ReturnType<typeof book>, a1: string): string {
  const sheet = b.sheets[0]!;
  const col = a1.charCodeAt(0) - 65;
  const row = Number(a1.slice(1)) - 1;
  const cell = sheet.cells.get(cellKey(sheet.layout.rows[row]!, sheet.layout.cols[col]!));
  const i = cell?.input;
  if (!i) return '';
  if ('f' in i) return renderFormula(i.f, b.wb.ctxFor(sheet.id));
  return String('n' in i ? i.n : 's' in i ? i.s : i.b);
}

const fmt = (b: ReturnType<typeof book>, a1: string) => {
  const sheet = b.sheets[0]!;
  return sheet.cells.get(
    cellKey(sheet.layout.rows[Number(a1.slice(1)) - 1]!, sheet.layout.cols[a1.charCodeAt(0) - 65]!),
  )?.format;
};

describe('typing', () => {
  it('reads what is typed and takes the format hint', () => {
    const b = book({ A1: '1' });
    const t = typeInto(b.wb, b.sheets[0]!.id, { r: 1, c: 0 }, '12%')!;
    expect(t.ok).toBe(true);
    run(b, t.ok ? t.write : null);
    expect(b.v('A2')).toBe(0.12);
    expect(fmt(b, 'A2')).toEqual({ nf: 'percent' });
    const cur = typeInto(b.wb, b.sheets[0]!.id, { r: 2, c: 0 }, '£5')!;
    run(b, cur.ok ? cur.write : null);
    expect(fmt(b, 'A3')).toEqual({ nf: 'currency', cur: '£' });
    const bad = typeInto(b.wb, b.sheets[0]!.id, { r: 0, c: 0 }, '=(1')!;
    expect(bad).toMatchObject({ ok: false, read: { reason: 'missing_close_bracket' } });
    expect(typeInto(b.wb, 'nope', { r: 0, c: 0 }, '1')).toBeNull();
    const clear = typeInto(b.wb, b.sheets[0]!.id, { r: 0, c: 0 }, '')!;
    run(b, clear.ok ? clear.write : null);
    expect(b.v('A1')).toBeNull();
  });
  it('keeps Plain Text cells as text', () => {
    const b = book({});
    run(b, formatRanges(b.wb, b.sheets[0]!.id, [{ r1: 0, c1: 0, r2: 0, c2: 0 }], { nf: 'text' }));
    const t = typeInto(b.wb, b.sheets[0]!.id, { r: 0, c: 0 }, '007')!;
    run(b, t.ok ? t.write : null);
    expect(b.v('A1')).toBe('007');
  });
  it('fills a selection with Ctrl+Enter, shifting formulas', () => {
    const b = book({ A1: '1', A2: '2' });
    const t = typeIntoRanges(
      b.wb,
      b.sheets[0]!.id,
      { r: 0, c: 1 },
      [{ r1: 0, c1: 1, r2: 1, c2: 1 }],
      '=A1*10',
    )!;
    run(b, t.ok ? t.write : null);
    expect([b.v('B1'), b.v('B2')]).toEqual([10, 20]);
    const lit = typeIntoRanges(
      b.wb,
      b.sheets[0]!.id,
      { r: 0, c: 2 },
      [{ r1: 0, c1: 2, r2: 1, c2: 2 }],
      '£1',
    )!;
    run(b, lit.ok ? lit.write : null);
    expect(fmt(b, 'C2')).toEqual({ nf: 'currency', cur: '£' });
    expect(typeIntoRanges(b.wb, b.sheets[0]!.id, { r: 0, c: 0 }, [], '=(')).toMatchObject({
      ok: false,
    });
  });
});

describe('clearing and formatting', () => {
  it('clears inputs, formats or both', () => {
    const b = book({ A1: '1', B1: 'x' });
    run(b, formatRanges(b.wb, b.sheets[0]!.id, [{ r1: 0, c1: 0, r2: 0, c2: 1 }], { b: true }));
    const all = [{ r1: 0, c1: 0, r2: 0, c2: 1 }];
    const s = b.sheets[0]!;
    expect((clearRanges(s, all, 'inputs') as { cells: unknown[] }).cells).toHaveLength(2);
    run(b, clearRanges(s, [{ r1: 0, c1: 0, r2: 0, c2: 0 }], 'formats'));
    expect(fmt(b, 'A1')).toBeUndefined();
    run(b, clearRanges(b.sheets[0]!, all, 'all'));
    expect(b.sheets[0]!.cells.size).toBe(0);
  });
  it('formats whole columns only as far as the sheet is filled', () => {
    const b = book({ A1: '1', A3: '3' });
    const s = b.sheets[0]!;
    const col = { r1: 0, c1: 0, r2: s.layout.rows.length - 1, c2: 0 };
    expect(boundedRange(col, s, b.wb.extent(s.id))).toEqual({ r1: 0, c1: 0, r2: 2, c2: 0 });
    const w = formatRanges(b.wb, s.id, [col], { i: true }) as { cells: unknown[] };
    expect(w.cells).toHaveLength(3);
    expect(formatRanges(b.wb, 'nope', [col], {})).toBeNull();
    const row = { r1: 0, c1: 0, r2: 0, c2: s.layout.cols.length - 1 };
    expect(boundedRange(row, s, b.wb.extent(s.id))).toEqual({ r1: 0, c1: 0, r2: 0, c2: 0 });
  });
  it('steps decimals', () => {
    expect(stepDecimals(undefined, true, 1.25, 1)).toBe(3);
    expect(stepDecimals(undefined, true, 3, -1)).toBe(0);
    expect(stepDecimals(undefined, false, null, 1)).toBe(3);
    expect(stepDecimals(10, false, null, 1)).toBe(10);
  });
  it('draws borders by mode', () => {
    const b = book({});
    const id = b.sheets[0]!.id;
    const border = { w: 1 as const, s: 'solid' as const, c: '#000000' };
    const range = { r1: 0, c1: 0, r2: 1, c2: 1 };
    run(b, borderRange(b.wb, id, range, 'outer', border));
    expect(fmt(b, 'A1')).toEqual({ bt: border, bl: border });
    expect(fmt(b, 'B2')).toEqual({ bb: border, br: border });
    run(b, borderRange(b.wb, id, range, 'inner', border));
    expect(fmt(b, 'A1')).toEqual({ bt: border, bl: border, bb: border, br: border });
    run(b, borderRange(b.wb, id, range, 'none', border));
    expect(fmt(b, 'A1')).toBeUndefined();
    for (const mode of ['all', 'top', 'bottom', 'left', 'right'] as const)
      expect(borderRange(b.wb, id, range, mode, border)?.kind).toBe('cells');
    expect(borderRange(b.wb, 'nope', range, 'all', border)).toBeNull();
  });
});

describe('merging', () => {
  it('merges, asking when it would clear inputs, and unmerges', () => {
    const b = book({ A1: 'keep', B1: 'lost' });
    const s = b.sheets[0]!;
    const m = mergeRange(s, { r1: 0, c1: 0, r2: 1, c2: 1 }, 'all')!;
    expect(m.needsConfirm).toBe(true);
    run(b, m.write);
    expect(b.v('A1')).toBe('keep');
    expect(b.v('B1')).toBeNull();
    expect(b.sheets[0]!.layout.merges).toHaveLength(1);
    const again = mergeRange(b.sheets[0]!, { r1: 0, c1: 0, r2: 2, c2: 1 }, 'all')!;
    run(b, again.write);
    expect(b.sheets[0]!.layout.merges).toHaveLength(1);
    run(b, unmergeRange(b.sheets[0]!, { r1: 0, c1: 0, r2: 0, c2: 0 }));
    expect(b.sheets[0]!.layout.merges).toBeUndefined();
    expect(unmergeRange(b.sheets[0]!, { r1: 0, c1: 0, r2: 0, c2: 0 })).toBeNull();
    const across = mergeRange(b.sheets[0]!, { r1: 0, c1: 0, r2: 2, c2: 2 }, 'across')!;
    expect(across.needsConfirm).toBe(false);
    run(b, across.write);
    expect(b.sheets[0]!.layout.merges).toHaveLength(3);
    expect(mergeRange(s, { r1: 0, c1: 0, r2: 0, c2: 0 }, 'all')).toBeNull();
    expect(mergeRange(s, { r1: 0, c1: 0, r2: 999, c2: 0 }, 'all')).toBeNull();
  });
});

describe('fill', () => {
  it('continues series and copies formulas in every direction', () => {
    const b = book({ A1: '1', A2: '2', B1: '=A1*2', D5: 'Mon', E5: 'x' });
    const id = b.sheets[0]!.id;
    run(b, fillRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 1 }, { r1: 0, c1: 0, r2: 4, c2: 1 }));
    expect([b.v('A5'), b.v('B5'), input(b, 'B3'), input(b, 'B4')]).toEqual([5, 10, '=A3*2', '']);
    run(b, fillRange(b.wb, id, { r1: 4, c1: 3, r2: 4, c2: 3 }, { r1: 4, c1: 3, r2: 4, c2: 5 }));
    expect(b.v('F5')).toBe('Wed');
    run(b, fillRange(b.wb, id, { r1: 4, c1: 3, r2: 4, c2: 3 }, { r1: 2, c1: 3, r2: 4, c2: 3 }));
    expect(b.v('D3')).toBe('Sat');
    run(b, fillRange(b.wb, id, { r1: 4, c1: 5, r2: 4, c2: 5 }, { r1: 4, c1: 4, r2: 4, c2: 5 }));
    expect(b.v('E5')).toBe('Tue');
  });
  it('copies with Ctrl, fills Ctrl+D and Ctrl+R, and clears when dragged back', () => {
    const b = book({ A1: '1', B1: '=A1+1' });
    const id = b.sheets[0]!.id;
    run(
      b,
      fillRange(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 2, c2: 0 }, true),
    );
    expect(b.v('A3')).toBe(3);
    run(b, fillFromEdge(b.wb, id, { r1: 0, c1: 1, r2: 2, c2: 1 }, 'down'));
    expect(input(b, 'B3')).toBe('=A3+1');
    run(b, fillFromEdge(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 2 }, 'right'));
    expect(b.v('C1')).toBe(1);
    expect(fillFromEdge(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 }, 'down')).toBeNull();
    expect(fillFromEdge(b.wb, id, { r1: 0, c1: 0, r2: 0, c2: 0 }, 'right')).toBeNull();
    run(b, fillRange(b.wb, id, { r1: 0, c1: 0, r2: 2, c2: 2 }, { r1: 0, c1: 0, r2: 0, c2: 1 }));
    expect([b.v('A2'), b.v('C1')]).toEqual([null, null]);
    expect(
      fillRange(b.wb, 'nope', { r1: 0, c1: 0, r2: 0, c2: 0 }, { r1: 0, c1: 0, r2: 1, c2: 0 }),
    ).toBeNull();
  });
});

describe('splitWrite', () => {
  it('splits by cells and bytes, layout first', () => {
    const cells = Array.from({ length: 12_000 }, (_, i) => ({ r: `r${i}`, c: 'c', i: { n: i } }));
    expect(
      splitWrite({ kind: 'cells', cells }).map((w) => (w as { cells: unknown[] }).cells.length),
    ).toEqual([5000, 5000, 2000]);
    const parts = splitWrite({ kind: 'layout', changes: [{ k: 'freeze', rows: 1 }], cells });
    expect(parts[0]!.kind).toBe('layout');
    expect(parts[1]!.kind).toBe('cells');
    const fat = Array.from({ length: 300 }, (_, i) => ({
      r: `r${i}`,
      c: 'c',
      i: { s: 'x'.repeat(9000) },
    }));
    expect(splitWrite({ kind: 'cells', cells: fat }).length).toBeGreaterThan(2);
    expect(splitWrite({ kind: 'title', title: 'x' })).toHaveLength(1);
    expect(splitWrite({ kind: 'cells', cells: [] })).toHaveLength(1);
    expect(splitWrite({ kind: 'layout', changes: [{ k: 'freeze', rows: 1 }] })).toHaveLength(1);
  });
});

describe('rows and columns', () => {
  it('inserts, appends, deletes, hides, resizes and moves', () => {
    const b = book({ A1: 'a', A2: 'b' }, { rows: 5, cols: 3 });
    const s = () => b.sheets[0]!;
    run(b, insertAxis(s(), 'r', 0, 2, 'before', seeded()));
    expect(b.v('A3')).toBe('a');
    run(b, insertAxis(s(), 'c', 0, 1, 'after', seeded()));
    expect(s().layout.cols).toHaveLength(4);
    run(b, appendAxis(s(), 'r', 3, seeded()));
    expect(s().layout.rows).toHaveLength(10);
    run(b, deleteAxis(s(), 'r', 0, 1));
    expect(b.v('A1')).toBe('a');
    expect(deleteAxis(s(), 'c', 0, 99)!.kind).toBe('layout');
    expect(deleteAxis(s(), 'r', 50, 60)).toBeNull();
    run(b, hideAxis(s(), 'r', 1, 1, true));
    expect(s().layout.hiddenRows).toHaveLength(1);
    expect(hideAxis(s(), 'r', 50, 50, true)).toBeNull();
    run(b, resizeAxis(s(), 'c', [0], 140));
    expect(Object.values(s().layout.colSize ?? {})).toEqual([140]);
    expect(resizeAxis(s(), 'c', [99], 140)).toBeNull();
    run(b, moveAxis(s(), 'r', 0, 0, 2));
    expect([b.v('A1'), b.v('A2')]).toEqual(['b', 'a']);
    expect(moveAxis(s(), 'r', 0, 1, 1)).toBeNull();
    run(b, moveAxis(s(), 'r', 1, 1, 0));
    expect(b.v('A1')).toBe('a');
    run(b, freeze(1, 0));
    expect(s().layout.frozenRows).toBe(1);
    expect(freeze().kind).toBe('layout');
  });
  it('refuses to grow past the limits or delete the last line', () => {
    const b = book({}, { rows: 2, cols: 2 });
    const s = b.sheets[0]!;
    const full = {
      ...s,
      layout: { ...s.layout, cols: Array.from({ length: 200 }, (_, i) => `q${i}`) },
    };
    expect(insertAxis(full, 'c', 0, 1, 'before')).toBeNull();
    expect(
      (deleteAxis(s, 'r', 0, 1) as { changes: { ids: string[] }[] }).changes[0]!.ids,
    ).toHaveLength(1);
  });
  it('sorts the sheet by reordering rows, frozen rows kept', () => {
    const b = book({ A1: 'Name', A2: 'c', A3: 'a', A4: 'b', B2: '=A2' }, { rows: 6, cols: 3 });
    run(b, freeze(1));
    const id = b.sheets[0]!.id;
    run(b, sortSheet(b.wb, id, 0, true));
    expect([b.v('A1'), b.v('A2'), b.v('A3'), b.v('A4')]).toEqual(['Name', 'a', 'b', 'c']);
    expect(b.v('B4')).toBe('c');
    run(b, sortSheet(b.wb, id, 0, false));
    expect(b.v('A2')).toBe('c');
    expect(sortSheet(b.wb, 'nope', 0, true)).toBeNull();
    expect(sortSheet(book({ A1: 'x' }).wb, 'sheet0xx', 0, true)).toBeNull();
  });
  it('sorts a range, formulas moving with their rows', () => {
    const b = book({
      A1: 'k',
      A2: '3',
      A3: '1',
      A4: '2',
      B2: '=A2*2',
      B3: '=A3*2',
      B4: '=A4*2',
      C2: 'stay',
    });
    const id = b.sheets[0]!.id;
    run(
      b,
      sortRange(b.wb, id, { r1: 0, c1: 0, r2: 3, c2: 1 }, [{ col: 0, ascending: true }], true),
    );
    expect([b.v('A2'), b.v('B2'), b.v('B4'), b.v('C2')]).toEqual([1, 2, 6, 'stay']);
    expect(
      sortRange(b.wb, id, { r1: 0, c1: 0, r2: 1, c2: 0 }, [{ col: 0, ascending: true }], true),
    ).toBeNull();
    expect(
      sortRange(b.wb, id, { r1: 1, c1: 0, r2: 3, c2: 0 }, [{ col: 0, ascending: true }], false),
    ).toBeNull();
    expect(sortRange(b.wb, 'nope', { r1: 0, c1: 0, r2: 3, c2: 0 }, [], false)).toBeNull();
  });
  it('turns the filter on over the filled block, and off', () => {
    const b = book({ A1: 'h', A2: '1', B2: '2' });
    const s = b.sheets[0]!;
    const g: Grid = {
      rows: 30,
      cols: 12,
      hiddenRow: () => false,
      hiddenCol: () => false,
      filled: (r, c) => (r === 0 && c === 0) || (r === 1 && c < 2),
      mergeAt: () => null,
    };
    run(b, toggleFilter(b.wb, s.id, { r1: 0, c1: 0, r2: 0, c2: 0 }, g));
    expect(b.sheets[0]!.layout.filter).toMatchObject({
      r1: s.layout.rows[0],
      r2: s.layout.rows[1],
      c2: s.layout.cols[1],
    });
    run(b, setFilterCondition(s.layout.cols[0]!, { op: 'gt', a: '5' }));
    run(b, toggleFilter(b.wb, s.id, { r1: 0, c1: 0, r2: 0, c2: 0 }, g));
    expect(b.sheets[0]!.layout.filter).toBeUndefined();
    run(b, toggleFilter(b.wb, s.id, { r1: 2, c1: 2, r2: 4, c2: 3 }, g));
    expect(b.sheets[0]!.layout.filter).toMatchObject({ r1: s.layout.rows[2] });
    expect(toggleFilter(b.wb, 'nope', { r1: 0, c1: 0, r2: 0, c2: 0 }, g)).toBeNull();
  });
});
