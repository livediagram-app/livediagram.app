// Named ranges (docs/specs/029-sheets/sheet.md "Named ranges", formulas.md "Named ranges").
import { describe, expect, it } from 'vitest';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from './store';
import { rangeNameProblem, nameHome, findRangeName } from './range-names';
import { validateWrite } from './validate';
import { book, makeSheets } from './testing/book';
import type { Sheet } from './sheet';

const ctx = { now: 1, by: { id: 'p', name: 'P', color: '#000000' } };
const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;
const base = (): Sheet => makeSheets({ 'Sheet 1': {} }, { rows: 8, cols: 4 })[0]!;
const name = (n: string, r1: number, c1: number, r2 = r1, c2 = c1): SheetWrite => ({
  kind: 'layout',
  changes: [{ k: 'name', name: n, range: { r1: R(r1), c1: C(c1), r2: R(r2), c2: C(c2) } }],
});
const apply = (s: Sheet, w: SheetWrite) => applySheetWrite(s, w, ctx);
const undo = (s: Sheet, w: SheetWrite) => {
  const r = apply(s, w);
  return { after: r.sheet, back: apply(r.sheet, inverseSheetWrite(s, r)).sheet };
};

describe('what may name a range', () => {
  it('takes a letter or _ then letters, digits, _ or ., and nothing a formula reads otherwise', () => {
    const layout = base().layout;
    expect(rangeNameProblem('TaxRate', layout)).toBeNull();
    expect(rangeNameProblem('_q3.sales', layout)).toBeNull();
    expect(rangeNameProblem('3rd', layout)).toMatch(/start with a letter/);
    expect(rangeNameProblem('tax rate', layout)).toMatch(/start with a letter/);
    expect(rangeNameProblem('x'.repeat(61), layout)).toMatch(/start with a letter/);
    expect(rangeNameProblem('true', layout)).toMatch(/TRUE and FALSE/);
    expect(rangeNameProblem('AB12', layout)).toMatch(/cell reference/);
    expect(rangeNameProblem('r1c1', layout)).toMatch(/cell reference/);
    // Up to four letters then a row is a cell to the parser (RATE2), so not a name; Sales2024 is fine.
    expect(rangeNameProblem('Rate2', layout)).toMatch(/cell reference/);
    expect(rangeNameProblem('Sales2024', layout)).toBeNull();
    const named = apply(base(), name('Rate', 0, 0)).sheet.layout;
    expect(rangeNameProblem('RATE', named)).toMatch(/Another range/);
    // Renaming to another spelling of itself is fine.
    expect(rangeNameProblem('RATE', named, 'Rate')).toBeNull();
  });
});

describe('setting and removing a name', () => {
  it('sets, replaces and removes a name, each undone exactly', () => {
    const set = undo(base(), name('Rate', 0, 1));
    expect(set.after.layout.names).toEqual([
      { name: 'Rate', r1: R(0), c1: C(1), r2: R(0), c2: C(1) },
    ]);
    expect(set.back.layout.names).toBeUndefined();
    const moved = undo(set.after, name('RATE', 2, 2, 3, 3));
    expect(moved.after.layout.names).toEqual([
      { name: 'RATE', r1: R(2), c1: C(2), r2: R(3), c2: C(3) },
    ]);
    expect(moved.back.layout.names).toEqual(set.after.layout.names);
    const gone = undo(set.after, {
      kind: 'layout',
      changes: [{ k: 'name', name: 'rate', range: null }],
    });
    expect(gone.after.layout.names).toBeUndefined();
    expect(gone.back.layout.names).toEqual(set.after.layout.names);
  });

  it('shrinks with its deleted rows, loses a name whose cells all went, and undo brings both back', () => {
    const s = apply(apply(base(), name('Block', 1, 0, 3, 1)).sheet, name('One', 5, 2)).sheet;
    const del = undo(s, { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(1), R(5)] }] });
    expect(del.after.layout.names).toEqual([
      { name: 'Block', r1: R(2), c1: C(0), r2: R(3), c2: C(1) },
    ]);
    expect(del.back.layout.names).toEqual(s.layout.names);
  });

  it('accepts the undo of a deletion that took a named range\u2019s corner, or all of it', () => {
    const s = apply(base(), name('Tax', 1, 0, 3, 0)).sheet;
    for (const ids of [[R(3)], [R(1), R(2), R(3)]]) {
      const r = apply(s, { kind: 'layout', changes: [{ k: 'deleteRows', ids }] });
      const inverse = inverseSheetWrite(s, r);
      expect(validateWrite(r.sheet, inverse).ok).toBe(true);
      expect(apply(r.sheet, inverse).sheet.layout.names).toEqual(s.layout.names);
    }
  });

  it('refuses a name it may not take, or cells that are not on the sheet, and re-points one it has', () => {
    const s = apply(base(), name('Rate', 0, 0)).sheet;
    // The same name again (any spelling) re-points it: a sheet never holds two.
    expect(validateWrite(s, name('rate', 1, 1)).ok).toBe(true);
    expect(apply(s, name('rate', 1, 1)).sheet.layout.names).toHaveLength(1);
    expect(validateWrite(s, name('A1', 1, 1)).ok).toBe(false);
    const off: SheetWrite = {
      kind: 'layout',
      changes: [{ k: 'name', name: 'Far', range: { r1: 'zz', c1: C(0), r2: R(0), c2: C(0) } }],
    };
    expect(validateWrite(s, off).ok).toBe(false);
    expect(validateWrite(s, name('Other', 1, 1)).ok).toBe(true);
  });
});

describe('a name in a formula', () => {
  const named = (
    b: ReturnType<typeof book>,
    title: string,
    n: string,
    r1: number,
    c1: number,
    r2 = r1,
    c2 = c1,
  ) => {
    const i = b.sheets.findIndex((s) => s.title === title);
    const s = b.sheets[i]!;
    const tag = `s${i}`;
    const next = applySheetWrite(
      s,
      {
        kind: 'layout',
        changes: [
          {
            k: 'name',
            name: n,
            range: {
              r1: `${tag}r${r1}`,
              c1: `${tag}c${c1}`,
              r2: `${tag}r${r2}`,
              c2: `${tag}c${c2}`,
            },
          },
        ],
      },
      ctx,
    ).sheet;
    b.sheets[i] = next;
    b.wb.updateSheet(next);
  };

  it('reads a named cell and a named range, case aside, and keeps reading them when filled down', () => {
    const b = book({
      A1: '0.2',
      B1: '10',
      B2: '20',
      B3: '30',
      C1: '=B1*taxrate',
      C2: '=B2*TaxRate',
      D1: '=SUM(Amounts)',
    });
    expect(b.v('C1')).toMatchObject({ e: '#NAME?' });
    named(b, 'Sheet 1', 'TaxRate', 0, 0);
    named(b, 'Sheet 1', 'Amounts', 0, 1, 2, 1);
    expect(b.v('C1')).toBe(2);
    expect(b.v('C2')).toBe(4);
    expect(b.v('D1')).toBe(60);
    // The named cell changes: every reader follows.
    b.set('A1', '0.5');
    expect(b.v('C2')).toBe(10);
  });

  it('reads its own sheet first, then the one other sheet that has it, and #NAME? when several do', () => {
    const b = book({ 'Sheet 1': { A1: '1', B1: '=Rate' }, Rates: { A1: '7' }, More: { A1: '9' } });
    named(b, 'Rates', 'Rate', 0, 0);
    expect(b.v('B1')).toBe(7);
    named(b, 'More', 'Rate', 0, 0);
    expect(b.v('B1')).toMatchObject({ e: '#NAME?' });
    named(b, 'Sheet 1', 'Rate', 0, 0);
    expect(b.v('B1')).toBe(1);
  });

  it('finds the sheet a name reads', () => {
    const a = {
      id: 'a',
      layout: { rows: [], cols: [], names: [{ name: 'X', r1: 'r', c1: 'c', r2: 'r', c2: 'c' }] },
    };
    const b = { id: 'b', layout: { rows: [], cols: [] } };
    expect(nameHome('x', b, [a, b])?.sheet.id).toBe('a');
    expect(nameHome('y', b, [a, b])).toBeNull();
    expect(findRangeName(a.layout, 'X')?.name).toBe('X');
  });
});
