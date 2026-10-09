import { describe, expect, it } from 'vitest';
import { book } from '../testing/book';
import { Workbook } from './workbook';

describe('values and recalculation', () => {
  it('works out formulas through references', () => {
    const b = book({ A1: '2', A2: '3', A3: '=A1*A2', A4: '=A3+1' });
    expect(b.v('A3')).toBe(6);
    expect(b.v('A4')).toBe(7);
    b.set('A1', '10');
    expect(b.v('A4')).toBe(31);
  });
  it('recalculates only what depends on a change', () => {
    const b = book({ A1: '1', B1: '=A1*2', C1: '=5*5' });
    expect(b.v('B1')).toBe(2);
    expect(b.v('C1')).toBe(25);
    b.set('A1', '4');
    expect(b.v('B1')).toBe(8);
  });
  it('follows ranges, whole columns and open ranges', () => {
    const b = book({
      A1: '1',
      A2: '2',
      A3: '3',
      B1: '=SUM(A1:A3)',
      C1: '=SUM(A:A)',
      D1: '=SUM(A2:A)',
    });
    expect([b.v('B1'), b.v('C1'), b.v('D1')]).toEqual([6, 6, 5]);
    b.set('A4', '10');
    expect([b.v('B1'), b.v('C1'), b.v('D1')]).toEqual([6, 16, 15]);
  });
  it('reads other sheets by title', () => {
    const b = book({ 'Sheet 1': { A1: '=Budget!B2*2' }, Budget: { B2: '21' } });
    expect(b.v('A1')).toBe(42);
    b.set('B2', '1', 'Budget');
    expect(b.v('A1')).toBe(2);
  });
  it('shows #REF! for a circular formula, with its loop', () => {
    const b = book({ A1: '=B1', B1: '=A1' });
    expect(b.v('A1')).toMatchObject({ e: '#REF!' });
    expect((b.v('B1') as { why: string }).why).toMatch(/Circular reference: .*→/);
    b.set('B1', '5');
    expect(b.v('A1')).toBe(5);
  });
  it('works out a chain thousands long without overflowing', () => {
    const cells: Record<string, string> = { A1: '1' };
    for (let i = 2; i <= 3000; i++) cells[`A${i}`] = `=A${i - 1}+1`;
    const b = book(cells, { rows: 3000 });
    expect(b.v('A3000')).toBe(3000);
  });
  it('spills arrays, and reads spilled cells', () => {
    const b = book({ A1: '=SEQUENCE(3)', B1: '=SUM(A1:A3)', C1: '=A2', D1: '=SUM(A1#)' });
    expect(b.v('A1')).toBe(1);
    expect(b.v('A2')).toBe(2);
    expect(b.v('C1')).toBe(2);
    expect(b.v('B1')).toBe(6);
    expect(b.v('D1')).toBe(6);
    expect(b.wb.spillOwnerAt(b.sheets[0]!.id, 2, 0)).toEqual({ r: 0, c: 0 });
    expect(b.wb.spillOwnerAt(b.sheets[0]!.id, 0, 0)).toBeNull();
  });
  it('blocks a spill on a filled cell, and lets it go when emptied', () => {
    const b = book({ A1: '=SEQUENCE(3)', A3: 'x', B1: '=A2' });
    expect(b.v('A1')).toMatchObject({ e: '#SPILL!', why: 'The result would overwrite A3' });
    expect(b.v('B1')).toBe(null);
    b.set('A3', '');
    expect(b.v('A1')).toBe(1);
    expect(b.v('B1')).toBe(2);
  });
  it('blocks a spill past the grid', () => {
    expect(book({ A1: '=SEQUENCE(100)' }).v('A1')).toMatchObject({ e: '#SPILL!' });
  });
  it('re-works volatile cells on any change and on tick', () => {
    let n = 0;
    const b = book({ A1: '=RAND()', B1: '1' }, { rand: () => ++n / 10 });
    expect(b.v('A1')).toBe(0.1);
    expect(b.v('A1')).toBe(0.1);
    b.set('B1', '2');
    expect(b.v('A1')).toBe(0.2);
    b.wb.tick();
    expect(b.v('A1')).toBe(0.3);
  });
  it('knows extents, formulas and card use', () => {
    const b = book({ C5: '1', A1: '=CARDCOUNT()' });
    expect(b.wb.extent(b.sheets[0]!.id)).toEqual({ rows: 5, cols: 3 });
    expect(b.wb.usesCards()).toBe(true);
    expect(book({ A1: '=1' }).wb.usesCards()).toBe(false);
    expect(b.wb.extent('nope')).toEqual({ rows: 0, cols: 0 });
  });
  it('resets on a layout change and on removing a sheet', () => {
    const b = book({ 'Sheet 1': { A1: '=Budget!A1' }, Budget: { A1: '7' } });
    expect(b.v('A1')).toBe(7);
    const budget = b.sheets[1]!;
    b.wb.updateSheet({
      ...budget,
      layout: { ...budget.layout, rows: ['new', ...budget.layout.rows] },
    });
    expect(b.v('A1')).toBe(7);
    b.wb.removeSheet(budget.id);
    expect(b.v('A1')).toMatchObject({ e: '#REF!' });
    b.wb.removeSheet('gone');
  });
  it('returns null past the grid and for unknown sheets', () => {
    const wb = new Workbook({ sheets: [], locale: 'en' });
    expect(wb.value('x', 0, 0)).toBeNull();
    expect(wb.sheetList()).toEqual([]);
    expect(wb.formulaResult('x', 0, 0)).toBeNull();
  });
  it('gives a formula its whole array', () => {
    const b = book({ A1: '=SEQUENCE(2,2)' });
    expect(b.wb.formulaResult(b.sheets[0]!.id, 0, 0)).toEqual({
      rows: [
        [1, 2],
        [3, 4],
      ],
    });
  });
});
