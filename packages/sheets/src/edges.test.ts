// The less travelled paths of the engine: coercions, operators, spills, sorting and validation edges.
import { describe, expect, it } from 'vitest';
import { book, calc } from './testing/book';
import { sortKeyCompare, sortedOrder } from './sort';
import {
  arrayOf,
  compareScalars,
  dims,
  isPending,
  numberText,
  scalars,
  toBool,
  toNumber,
  toText,
  PENDING,
} from './formula/values';
import { maySpill } from './engine/spill-shape';
import { parseFormula } from './formula/parse';
import { validateWrite } from './validate';
import type { SheetWrite } from './store';

describe('values', () => {
  it('coerces as Sheets does', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(true)).toBe(1);
    expect(toNumber(' ')).toBe(0);
    expect(toNumber('50%')).toBe(0.5);
    expect(toNumber('a'.repeat(30))).toMatchObject({
      e: '#VALUE!',
      why: expect.stringContaining('…'),
    });
    expect(toNumber({ e: '#N/A' })).toEqual({ e: '#N/A' });
    expect(toNumber({ rows: [[3]] })).toBe(3);
    expect(toText(null)).toBe('');
    expect(toText(false)).toBe('FALSE');
    expect(toText({ e: '#N/A' })).toEqual({ e: '#N/A' });
    expect(toBool(null)).toBe(false);
    expect(toBool(2)).toBe(true);
    expect(toBool(' TRUE ')).toBe(true);
    expect(toBool('false')).toBe(false);
    expect(toBool('x')).toMatchObject({ e: '#VALUE!' });
    expect(toBool({ e: '#N/A' })).toEqual({ e: '#N/A' });
    expect(numberText(1e21)).toBe('1E+21');
    expect(numberText(1.5e-10)).toBe('1.5E-10');
    // JavaScript's own exponent form (1e-9 to 1e-6) is written with a capital E too.
    expect(numberText(1.234e-7)).toBe('1.234E-7');
    expect(numberText(0)).toBe('0');
    expect(numberText(Infinity)).toBe('Infinity');
    expect(numberText(0.1 + 0.2)).toBe('0.3');
    expect([...scalars({ rows: [[1, { rows: [[2]] }]] })]).toEqual([1, 2]);
    expect(dims(arrayOf([]))).toEqual({ rows: 0, cols: 0 });
    expect(isPending(PENDING)).toBe(true);
    expect(isPending(1)).toBe(false);
  });
  it('compares across kinds', () => {
    expect(compareScalars(null, 'a')).toBe(-1);
    expect(compareScalars('', null)).toBe(0);
    expect(compareScalars(null, false)).toBe(0);
    expect(compareScalars(true, null)).toBe(1);
    expect(compareScalars(1, 'a')).toBe(-1);
    expect(compareScalars('b', 'A')).toBe(1);
    expect(compareScalars(true, false)).toBe(1);
    expect(compareScalars(false, true)).toBe(-1);
    expect(compareScalars(2, 2)).toBe(0);
  });
});

describe('operators', () => {
  it.each([
    ['=2^0.5^2=2', true],
    ['=-(-3)', 3],
    ['=+"5"', '5'],
    ['=1=1', true],
    ['=1<>1', false],
    ['=1<2', true],
    ['=2>1', true],
    ['=2<=1', false],
    ['=2>=2', true],
    ['="a"<"B"', true],
    ['=1="1"', false],
    ['=10%', 0.1],
    ['=2-0.5', 1.5],
  ])('%s', (f, out) => {
    expect(calc(f)).toEqual(out);
  });
  it.each([
    ['=1/0', '#DIV/0!'],
    ['=0^-1', '#DIV/0!'],
    ['=(-1)^0.5', '#NUM!'],
    ['=10^400', '#NUM!'],
    ['="a"+1', '#VALUE!'],
    ['=1+"a"', '#VALUE!'],
    ['=-"a"', '#VALUE!'],
    ['=NA()&"x"', '#N/A'],
    ['="x"&NA()', '#N/A'],
    ['=NA()+1', '#N/A'],
    ['=1+NA()', '#N/A'],
    ['=foo', '#NAME?'],
    ['=NOPE(1)', '#NAME?'],
    ['=ABS()', '#N/A'],
    ['=ABS(1, 2)', '#N/A'],
    ['=PI(1)', '#N/A'],
    ['=#REF!', '#REF!'],
    ['=Gone!A1', '#REF!'],
    ['=SUM(Gone!A:A)', '#REF!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f)).toMatchObject({ e });
  });
  it('names the arity it wants', () => {
    expect(calc('=ABS()')).toMatchObject({
      why: 'Wrong number of arguments to ABS. Expected exactly 1',
    });
    expect(calc('=ROUND(1,2,3)')).toMatchObject({
      why: 'Wrong number of arguments to ROUND. Expected at most 2',
    });
    expect(calc('=SUM()')).toMatchObject({
      why: 'Wrong number of arguments to SUM. Expected at least 1',
    });
  });
  it('reads open ranges by row, and title references once their sheet is there', () => {
    expect(calc('=SUM(A2:2)', { A2: '1', C2: '2' })).toBe(3);
    expect(calc('=SUM(2:2)', { A2: '1', C2: '2' })).toBe(3);
    const b = book({ 'Sheet 1': { A1: '=Later!A1' }, Later: { A1: '4' } });
    expect(b.v('A1')).toBe(4);
  });
  it('caps huge reads', () => {
    const b = book({ A1: '=SUM(A2:L10000)', B1: '=ROWS(A:A)' }, { rows: 10_000, cols: 12 });
    expect(b.v('A1')).toBe(0);
    expect(b.v('B1')).toBe(1);
  });
});

describe('spills', () => {
  const tree = (f: string) => {
    const r = parseFormula(f);
    if (!r.ok) throw new Error(f);
    return r.ast;
  };
  it('knows which formulas may spill', () => {
    expect(maySpill(tree('=SUM(A1:A2)'), [])).toBe(false);
    expect(maySpill(tree('=A1:A2'), [])).toBe(true);
    expect(maySpill(tree('={1,2}'), [])).toBe(true);
    expect(maySpill(tree('={1}'), [])).toBe(false);
    expect(maySpill(tree('=-SEQUENCE(2)%'), [])).toBe(true);
    expect(maySpill(tree('=1+FILTER(1,1)'), [])).toBe(true);
    expect(maySpill(tree('=ABS(1)'), [])).toBe(false);
    expect(maySpill(tree('=1'), [])).toBe(false);
    expect(maySpill({ k: 'stored', i: 0 }, [{ st: 'X', p: [0, 0, -1, -1] }])).toBe(false);
    expect(maySpill({ k: 'stored', i: 0 }, [{ st: 'X' }])).toBe(true);
    expect(maySpill({ k: 'stored', i: 0 }, [{ r1: 'a', c1: 'b', spill: true }])).toBe(true);
    expect(maySpill({ k: 'stored', i: 1 }, [])).toBe(false);
  });
  it('spills sideways, refuses overlaps, and empties when the source goes', () => {
    const b = book({ A1: '=SEQUENCE(1,3)', A2: '=SEQUENCE(2)', B2: '=SEQUENCE(1,2)' });
    expect([b.v('A1'), b.v('C1')]).toEqual([1, 3]);
    expect(b.v('A3')).toBe(2);
    expect(b.v('C2')).toBe(2);
    b.set('A2', '');
    expect(b.v('A3')).toBeNull();
    expect(book({ A1: '=FILTER(1, FALSE)' }).v('A1')).toMatchObject({ e: '#N/A' });
    const c = book({ A1: '=SEQUENCE(2)', A3: '=SEQUENCE(2)', B1: '=A2+A4' });
    expect(c.v('B1')).toBe(4);
  });
  it('reads a spill through # on another sheet, and its owner from inside', () => {
    const b = book({
      'Sheet 1': { A1: '=SUM(Nums!A1#)', B1: '=ROWS(Nums!A1#)' },
      Nums: { A1: '=SEQUENCE(4)' },
    });
    expect(b.v('A1')).toBe(10);
    expect(b.v('B1')).toBe(4);
    expect(book({ A1: '=SUM(B1#)', B1: '5' }).v('A1')).toBe(5);
  });
});

describe('sort order', () => {
  it('orders kinds, keeps empties last both ways', () => {
    const vals = [null, 'b', 2, true, { e: '#N/A' as const }, 'a', '', 1, false];
    const asc = sortedOrder(vals.length, (i) => vals[i]!, [{ col: 0, ascending: true }]).map(
      (i) => vals[i],
    );
    expect(asc).toEqual([1, 2, 'a', 'b', false, true, { e: '#N/A' }, null, '']);
    const desc = sortedOrder(vals.length, (i) => vals[i]!, [{ col: 0, ascending: false }]).map(
      (i) => vals[i],
    );
    expect(desc).toEqual([{ e: '#N/A' }, true, false, 'b', 'a', 2, 1, null, '']);
    expect(sortKeyCompare({ e: '#N/A' }, { e: '#DIV/0!' })).toBe(1);
    expect(sortKeyCompare({ e: '#DIV/0!' }, { e: '#N/A' })).toBe(-1);
    expect(sortKeyCompare({ e: '#N/A' }, { e: '#N/A' })).toBe(0);
    expect(sortKeyCompare('a10', 'a9')).toBe(1);
  });
});

describe('validation edges', () => {
  const sheet = book({}).sheets[0]!;
  const f = (r: unknown) =>
    validateWrite(sheet, {
      kind: 'cells',
      cells: [{ r: 's0r0', c: 's0c0', i: { f: { t: '@0', r: [r] } } }],
    } as unknown as SheetWrite);
  it.each([
    [{ s: 'abcdefgh' }, true],
    [{ s: 'x' }, false],
    [{ st: 'Budget', p: [0, 0, -1, -1] }, true],
    [{ st: '' }, false],
    [{ st: 'x', p: [0, 0] }, false],
    [{ r1: 'abcd', a: 3 }, true],
    [{ a: 16 }, false],
    [{ open: 'r' }, true],
    [{ open: 'x' }, false],
    [{ spill: true }, true],
    [{ spill: 1 }, false],
    ['x', false],
  ])('ref %j valid: %s', (ref, ok) => {
    expect(f(ref).ok).toBe(ok);
  });
});
