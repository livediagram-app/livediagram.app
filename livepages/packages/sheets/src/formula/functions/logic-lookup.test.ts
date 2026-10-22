import { describe, expect, it } from 'vitest';
import { book, calc } from '../../testing/book';

const T = {
  A1: 'Apple',
  B1: '1',
  C1: 'red',
  A2: 'Banana',
  B2: '2',
  C2: 'yellow',
  A3: 'Cherry',
  B3: '3',
  C3: 'red',
  D1: '10',
  D2: '20',
  D3: '30',
  E1: 'x',
  E2: '',
  F1: '=1/0',
  G1: '5',
};

describe('logic', () => {
  it.each([
    ['=IF(B1>0, "yes", "no")', 'yes'],
    ['=IF(B1>5, "yes")', false],
    ['=IF(B1>5, 1/0, 2)', 2],
    ['=IF(B1>0, 2, 1/0)', 2],
    ['=SUM(IF(B1:B3>1, D1:D3, 0))', 50],
    ['=SUM(IF(B1:B3>1, D1:D3))', 50],
    ['=IFS(B1>2, "a", B1>0, "b")', 'b'],
    ['=SWITCH(B2, 1, "one", 2, "two")', 'two'],
    ['=SWITCH(B3, 1, "one", "other")', 'other'],
    ['=AND(B1>0, B2>0)', true],
    ['=AND(B1:B3)', true],
    ['=OR(B1>5, B2>1)', true],
    ['=XOR(TRUE, TRUE, TRUE)', true],
    ['=AND("true", 1)', true],
    ['=NOT(FALSE)', true],
    ['=TRUE()', true],
    ['=FALSE()', false],
    ['=IFERROR(F1, "safe")', 'safe'],
    ['=IFERROR(B1, "safe")', 1],
    ['=SUM(IFERROR(1/(B1:B3-2), 0))', 0],
    ['=IFNA(NA(), "none")', 'none'],
    ['=IFNA(F1, "none")', { e: '#DIV/0!' }],
  ])('%s', (f, out) => {
    const v = calc(f, T);
    if (typeof out === 'object') expect(v).toMatchObject(out);
    else expect(v).toEqual(out);
  });
  it.each([
    ['=IF("x", 1, 2)', '#VALUE!'],
    ['=IF(F1, 1, 2)', '#DIV/0!'],
    ['=SUM(IF({TRUE,"x"}, 1, 2))', '#VALUE!'],
    ['=IFS(B1>5, "a")', '#N/A'],
    ['=IFS(B1>5)', '#N/A'],
    ['=IFS(F1, 1)', '#DIV/0!'],
    ['=SWITCH(B3, 1, "one")', '#N/A'],
    ['=SWITCH(F1, 1, "one")', '#DIV/0!'],
    ['=SWITCH(B1, F1, "one")', '#DIV/0!'],
    ['=AND(A1:A3)', '#VALUE!'],
    ['=AND(F1)', '#DIV/0!'],
    ['=OR(A1)', '#VALUE!'],
    ['=XOR(A1)', '#VALUE!'],
    ['=NOT("x")', '#VALUE!'],
    ['=NOT(F1)', '#DIV/0!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, T)).toMatchObject({ e });
  });
});

describe('information', () => {
  it.each([
    ['=ISBLANK(H9)', true],
    ['=ISBLANK(A1)', false],
    ['=ISNUMBER(B1)', true],
    ['=ISTEXT(A1)', true],
    ['=ISLOGICAL(TRUE)', true],
    ['=ISERROR(F1)', true],
    ['=ISNA(NA())', true],
    ['=ISNA(F1)', false],
    ['=ISFORMULA(F1)', true],
    ['=ISFORMULA(A1)', false],
    ['=ERROR.TYPE(F1)', 1],
    ['=N(B2)', 2],
    ['=N(TRUE)', 1],
    ['=N(A1)', 0],
    ['=TYPE(B1)', 1],
    ['=TYPE(A1)', 2],
    ['=TYPE(TRUE)', 4],
    ['=TYPE(F1)', 16],
    ['=TYPE(B1:B2)', 64],
  ])('%s', (f, out) => {
    expect(calc(f, T)).toEqual(out);
  });
  it('reports errors', () => {
    expect(calc('=ERROR.TYPE(1)', T)).toMatchObject({ e: '#N/A' });
    expect(calc('=ISFORMULA(1)', T)).toMatchObject({ e: '#N/A' });
    expect(calc('=N(F1)', T)).toMatchObject({ e: '#DIV/0!' });
    expect(calc('=NA()', T)).toMatchObject({ e: '#N/A' });
  });
});

describe('lookup', () => {
  it.each([
    ['=VLOOKUP("banana", A1:D3, 4, FALSE)', 20],
    ['=VLOOKUP("Ch*", A1:D3, 3, FALSE)', 'red'],
    ['=VLOOKUP(2.5, B1:D3, 3)', 20],
    ['=VLOOKUP(2, B1:D3, 3, TRUE)', 20],
    ['=HLOOKUP(2, B1:B3, 1, FALSE)', { e: '#N/A' }],
    ['=HLOOKUP("Apple", A1:D3, 2, FALSE)', 'Banana'],
    ['=MATCH("Cherry", A1:A3, 0)', 3],
    ['=MATCH(2.5, B1:B3)', 2],
    ['=MATCH(25, D1:D3, 1)', 2],
    ['=MATCH(2, {3,2,1}, -1)', 2],
    ['=XMATCH("cherry", A1:A3)', 3],
    ['=XMATCH(25, D1:D3, -1)', 2],
    ['=XMATCH(25, D1:D3, 1)', 3],
    ['=XMATCH("b*", A1:A3, 2)', 2],
    ['=XMATCH("red", C1:C3, 0, -1)', 3],
    ['=XLOOKUP("Banana", A1:A3, D1:D3)', 20],
    ['=XLOOKUP("Zed", A1:A3, D1:D3, "none")', 'none'],
    ['=XLOOKUP(2, B1:D1, B1:D1)', { e: '#N/A' }],
    ['=XLOOKUP(10, D1:D3, A1:C3)', 'Apple'],
    ['=XLOOKUP("red", C1:C3, A1:A3, , 0, -1)', 'Cherry'],
    ['=LOOKUP(2, B1:B3, D1:D3)', 20],
    ['=LOOKUP(2.5, B1:D3)', 20],
    ['=LOOKUP(3, B1:D1)', 1],
    ['=INDEX(A1:D3, 2, 4)', 20],
    ['=INDEX(A1:C3, 3)', 'Cherry'],
    ['=SUM(INDEX(B1:D3, 0, 3))', 60],
    ['=SUM(INDEX(B1:D3, 2, 0))', 22],
    ['=INDEX(D1:D3, 2)', 20],
    ['=INDEX({1,2;3,4}, 2, 1)', 3],
    ['=INDEX({1,2,3}, 2)', 2],
    ['=SUM(INDEX({1,2;3,4}, 0, 2))', 6],
    ['=SUM(INDEX({1,2;3,4}, 1, 0))', 3],
    ['=SUM(INDEX({1,2;3,4}, 0, 0))', 10],
    ['=CHOOSE(2, "a", "b", "c")', 'b'],
    ['=ROW(B4)', 4],
    ['=ROW()', 20],
    ['=COLUMN(D2)', 4],
    ['=COLUMN()', 10],
    ['=SUM(ROW(A1:A3))', 6],
    ['=SUM(COLUMN(A1:C1))', 6],
    ['=ROWS(A1:A3)', 3],
    ['=ROWS({1;2})', 2],
    ['=COLUMNS(A1:D1)', 4],
    ['=COLUMNS({1,2})', 2],
    ['=SUM(OFFSET(D1, 0, 0, 3))', 60],
    ['=OFFSET(A1, 1, 3)', 20],
    ['=INDIRECT("D" & 2)', 20],
    ['=SUM(INDIRECT("D1:D3"))', 60],
  ])('%s', (f, out) => {
    const v = calc(f, T);
    if (typeof out === 'object') expect(v).toMatchObject(out);
    else expect(v).toEqual(out);
  });
  it.each([
    ['=VLOOKUP("Zed", A1:D3, 2, FALSE)', '#N/A'],
    ['=VLOOKUP("Apple", A1:D3, 9, FALSE)', '#REF!'],
    ['=VLOOKUP(F1, A1:D3, 2)', '#DIV/0!'],
    ['=VLOOKUP(1, A1:D3, "a")', '#VALUE!'],
    ['=VLOOKUP(1, A1:D3, 1, "x")', '#VALUE!'],
    ['=MATCH("Zed", A1:A3, 0)', '#N/A'],
    ['=MATCH(1, A1:D3, 0)', '#N/A'],
    ['=MATCH(F1, A1:A3, 0)', '#DIV/0!'],
    ['=MATCH(1, A1:A3, "x")', '#VALUE!'],
    ['=XMATCH(1, A1:D3)', '#N/A'],
    ['=XMATCH(F1, A1:A3)', '#DIV/0!'],
    ['=XMATCH(1, A1:A3, "x")', '#VALUE!'],
    ['=XMATCH(1, A1:A3, 0, "x")', '#VALUE!'],
    ['=XMATCH("Zed", A1:A3)', '#N/A'],
    ['=XLOOKUP("Zed", A1:A3, D1:D3)', '#N/A'],
    ['=XLOOKUP(1, A1:D3, A1:D3)', '#VALUE!'],
    ['=XLOOKUP("Apple", A1:A3, D1:D2)', '#VALUE!'],
    ['=XLOOKUP(1, B1:D1, B1:C1)', '#VALUE!'],
    ['=XLOOKUP(F1, A1:A3, D1:D3)', '#DIV/0!'],
    ['=XLOOKUP(1, A1:A3, D1:D3, , "x")', '#VALUE!'],
    ['=XLOOKUP(1, A1:A3, D1:D3, , 0, "x")', '#VALUE!'],
    ['=LOOKUP(0, B1:B3, D1:D3)', '#N/A'],
    ['=LOOKUP(F1, B1:B3)', '#DIV/0!'],
    ['=LOOKUP(2, B1:B3, A1:D3)', '#N/A'],
    ['=INDEX(A1:D3, 9, 1)', '#REF!'],
    ['=INDEX({1,2}, 1, 9)', '#REF!'],
    ['=INDEX(A1:D3, "a")', '#VALUE!'],
    ['=INDEX(A1:D3, 1, "a")', '#VALUE!'],
    ['=CHOOSE(9, "a")', '#VALUE!'],
    ['=CHOOSE("x", "a")', '#VALUE!'],
    ['=ROW(1)', '#VALUE!'],
    ['=COLUMN(1)', '#VALUE!'],
    ['=OFFSET(1, 0, 0)', '#VALUE!'],
    ['=OFFSET(A1, -1, 0)', '#REF!'],
    ['=OFFSET(A1, 0, 0, 0)', '#REF!'],
    ['=OFFSET(A1, "a", 0)', '#VALUE!'],
    ['=INDIRECT("nonsense!!")', '#REF!'],
    ['=INDIRECT("A1", FALSE)', '#REF!'],
    ['=INDIRECT(F1)', '#DIV/0!'],
    ['=INDIRECT("A1", "x")', '#VALUE!'],
    ['=INDIRECT(5)', '#REF!'],
    ['=INDIRECT("Nope!A1")', '#REF!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, T)).toMatchObject({ e });
  });
  it('reads another sheet through INDIRECT', () => {
    const b = book({ 'Sheet 1': { A1: '=INDIRECT("Budget!B2")' }, Budget: { B2: '9' } });
    expect(b.v('A1')).toBe(9);
  });
  it('approximate matches skip values of another kind', () => {
    expect(calc('=MATCH(3, {1,"a",2,"b",4})')).toBe(3);
    expect(calc('=VLOOKUP(5, {"a",1;"b",2}, 2)')).toMatchObject({ e: '#N/A' });
  });
});
