import { describe, expect, it } from 'vitest';
import { book, calc } from '../../testing/book';
import type { CardRow, CardSource } from '../../cards';
import type { Scalar } from '../values';

const T = {
  A1: 'b',
  B1: '2',
  A2: 'a',
  B2: '3',
  A3: 'c',
  B3: '1',
  A4: 'a',
  B4: '3',
  F1: '=1/0',
  G1: 'TRUE',
  G2: 'FALSE',
  G3: 'TRUE',
  G4: 'FALSE',
};
const cell = (b: ReturnType<typeof book>, a1: string) => b.v(a1);

describe('arrays', () => {
  it('filters, sorts, finds unique rows and makes sequences', () => {
    const b = book({ ...T, D1: '=FILTER(A1:B4, B1:B4>1)', D6: '=SORT(A1:B4, 2, FALSE, 1, TRUE)' });
    expect([cell(b, 'D1'), cell(b, 'E1'), cell(b, 'D3'), cell(b, 'E3')]).toEqual(['b', 2, 'a', 3]);
    expect([cell(b, 'D6'), cell(b, 'D7'), cell(b, 'D8'), cell(b, 'D9')]).toEqual([
      'a',
      'a',
      'b',
      'c',
    ]);
  });
  it.each([
    ['=COUNTA(FILTER(A1:A4, G1:G4))', 2],
    ['=COUNTA(FILTER(A1:B1, {TRUE,FALSE}))', 1],
    ['=COUNTA(UNIQUE(A1:A4))', 3],
    ['=COUNTA(UNIQUE(A1:A4, FALSE, TRUE))', 2],
    ['=COUNTA(UNIQUE({1,1,2}, TRUE))', 2],
    ['=SUM(SEQUENCE(4))', 10],
    ['=SUM(SEQUENCE(2, 3, 10, 5))', 135],
    ['=INDEX(SORTBY(A1:A4, B1:B4, -1), 1)', 'a'],
    ['=INDEX(SORTBY(A1:A4, B1:B4), 1)', 'c'],
    ['=INDEX(SORT(B1:B4), 4)', 3],
    ['=INDEX(TRANSPOSE(A1:B2), 2, 1)', 2],
    ['=SUM(ARRAYFORMULA(B1:B4*2))', 18],
    ['=SUM(B1:B4*{1;1;1;1})', 9],
    ['=SUM({1,2}+{10;20})', 66],
    ['=SUM(-B1:B4)', -9],
    ['=SUM(B1:B4%)', 0.09],
  ])('%s', (f, out) => {
    expect(calc(f, T)).toEqual(out);
  });
  it.each([
    ['=FILTER(A1:A4, B1:B4>9)', '#N/A'],
    ['=FILTER(A1:B1, {FALSE,FALSE})', '#N/A'],
    ['=FILTER(A1:A4, B1:B2>1)', '#VALUE!'],
    ['=FILTER(A1:A4, F1:F4)', '#DIV/0!'],
    ['=FILTER(A1:A4, A1:A4)', '#VALUE!'],
    ['=SORT(A1:B4, 9)', '#VALUE!'],
    ['=SORT(A1:B4, "x")', '#VALUE!'],
    ['=SORT(A1:B4, 1, "x")', '#VALUE!'],
    ['=SORTBY(A1:A4, B1:B2)', '#VALUE!'],
    ['=SORTBY(A1:A4, B1:B4, "x")', '#VALUE!'],
    ['=UNIQUE({1;1}, FALSE, TRUE)', '#N/A'],
    ['=UNIQUE(A1:A4, "x")', '#VALUE!'],
    ['=UNIQUE(A1:A4, FALSE, "x")', '#VALUE!'],
    ['=SEQUENCE(0)', '#VALUE!'],
    ['=SEQUENCE(1000, 1000)', '#NUM!'],
    ['=SEQUENCE("x")', '#VALUE!'],
    ['=SUM({1,2}+{1,2,3})', '#N/A'],
    ['=SEQUENCE(1000000)', '#NUM!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, T)).toMatchObject({ e });
  });
});

describe('finance', () => {
  const near = (f: string, n: number, digits = 4) =>
    expect(calc(f) as number).toBeCloseTo(n, digits);
  it('works out loans and investments', () => {
    near('=PMT(5%/12, 60, 20000)', -377.4247, 3);
    near('=PMT(0, 10, 1000)', -100);
    near('=FV(4%/12, 120, -200)', 29449.96, 1);
    near('=FV(0, 10, -100)', 1000);
    near('=PV(5%/12, 60, -400)', 21196.28, 1);
    near('=PV(0, 10, -100)', 1000);
    near('=NPER(5%/12, -400, 20000)', 56.1843, 3);
    near('=NPER(0, -100, 1000)', 10);
    near('=NPV(8%, 100, 200, 300)', 502.21, 2);
    // By definition: the rate RATE finds gives back the payment, and the net present value at the IRR is nothing.
    near('=PMT(RATE(60, -400, 20000), 60, 20000)', -400, 6);
    near('=-1000 + NPV(IRR({-1000, 300, 400, 500}), 300, 400, 500)', 0, 6);
  });
  it.each([
    ['=PMT(1%, 0, 100)', '#NUM!'],
    ['=NPER(0, 0, 100)', '#NUM!'],
    ['=NPER(5%, -10, 1000)', '#NUM!'],
    ['=IRR({1, 2})', '#NUM!'],
    ['=IRR({-1, 2}, "x")', '#VALUE!'],
    ['=NPV("x", 1)', '#VALUE!'],
    ['=NPV(1%, 1/0)', '#DIV/0!'],
    ['=RATE(2, 0, 1, 1)', '#NUM!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f)).toMatchObject({ e });
  });
  it('passes an error in the cash flows through', () => {
    expect(calc('=IRR(A1:B1)', { A1: '-1', B1: '=1/0' })).toMatchObject({ e: '#DIV/0!' });
  });
});

function cardSource(cards: Record<string, Scalar>[]): CardSource {
  const rows: CardRow[] = cards.map((c) => ({ key: c.number as number }));
  const known = new Set(['title', 'state', 'status', 'estimate', 'number', 'assignee']);
  return {
    cards: () => rows,
    fieldOf: (card, name) => {
      const c = cards.find((x) => x.number === card.key)!;
      const k = name.toLowerCase() === 'status' ? 'state' : name.toLowerCase();
      return c[k];
    },
    knowsField: (name) => known.has(name.toLowerCase()),
    version: 1,
  };
}

const CARDS = cardSource([
  { number: 1, title: 'Login', state: 'Done', estimate: 3, assignee: 'Sam' },
  { number: 2, title: 'Signup', state: 'Doing', estimate: 5, assignee: 'Ali' },
  { number: 3, title: 'Logout', state: 'Done', estimate: 2, assignee: 'Sam' },
]);

describe('Plan cards', () => {
  it.each([
    ['=CARDCOUNT()', 3],
    ['=CARDCOUNT("State", "Done")', 2],
    ['=CARDCOUNT("status", "done", "Estimate", ">2")', 1],
    ['=CARDCOUNT("Title", "Log*")', 2],
    ['=CARDSUM("Estimate")', 10],
    ['=CARDSUM("Estimate", "Assignee", "Sam")', 5],
    ['=CARDSUM("Title")', 0],
    ['=CARD(2, "Title")', 'Signup'],
    ['=COUNTA(CARDS("Number, Title", "State", "Done"))', 6],
    ['=INDEX(CARDS("Number, Title"), 1, 2)', 'Title'],
    ['=INDEX(CARDS("Number, Title"), 3, 2)', 'Signup'],
  ])('%s', (f, out) => {
    expect(calc(f, {}, { cards: CARDS })).toEqual(out);
  });
  it.each([
    ['=CARDCOUNT("Nope", 1)', '#NAME?'],
    ['=CARDCOUNT("State")', '#N/A'],
    ['=CARDCOUNT(1/0, 1)', '#DIV/0!'],
    ['=CARDSUM("Nope")', '#NAME?'],
    ['=CARDSUM(1/0)', '#DIV/0!'],
    ['=CARDSUM("Estimate", "State")', '#N/A'],
    ['=CARD(9, "Title")', '#N/A'],
    ['=CARD(1, "Nope")', '#NAME?'],
    ['=CARD("x", "Title")', '#VALUE!'],
    ['=CARD(1, 1/0)', '#DIV/0!'],
    ['=CARDS("Nope")', '#NAME?'],
    ['=CARDS(" , ")', '#VALUE!'],
    ['=CARDS(1/0)', '#DIV/0!'],
    ['=CARDS("Title", "State")', '#N/A'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, {}, { cards: CARDS })).toMatchObject({ e });
  });
  it('reads Loading… until the cards arrive, then recalculates', () => {
    const b = book({ A1: '=CARDCOUNT()' });
    expect(b.v('A1')).toMatchObject({ e: '#N/A', why: 'pending' });
    b.wb.setCards(CARDS);
    expect(b.v('A1')).toBe(3);
  });
});
