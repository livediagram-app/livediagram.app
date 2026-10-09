import { describe, expect, it } from 'vitest';
import { calc } from '../../testing/book';

const DATA = {
  A1: '1',
  A2: '2',
  A3: '3',
  A4: 'x',
  A5: 'TRUE',
  B1: '10',
  B2: '20',
  B3: '30',
  B4: '40',
  B5: '50',
};
const close = (v: unknown, n: number) => expect(v as number).toBeCloseTo(n, 6);

describe('maths', () => {
  it.each([
    ['=SUM(A1:A5)', 6],
    ['=SUM(1, "2", TRUE)', 4],
    ['=SUM(A1:A3, 10)', 16],
    ['=PRODUCT(A1:A3)', 6],
    ['=SUMIF(B1:B5, ">25")', 120],
    ['=SUMIF(A1:A3, ">1", B1:B3)', 50],
    ['=SUMIF(A1:A3, ">1", B1)', 50],
    ['=SUMIFS(B1:B5, A1:A5, ">=2", B1:B5, "<40")', 50],
    ['=SUMPRODUCT(A1:A3, B1:B3)', 140],
    ['=ABS(-4)', 4],
    ['=ROUND(2.675, 2)', 2.68],
    ['=ROUND(-2.5)', -3],
    ['=ROUND(1234, -2)', 1200],
    ['=ROUNDUP(3.21, 1)', 3.3],
    ['=ROUNDDOWN(3.29, 1)', 3.2],
    ['=INT(-7.8)', -8],
    ['=TRUNC(-7.8)', -7],
    ['=MOD(10, 3)', 1],
    ['=MOD(-3, 2)', 1],
    ['=POWER(2, 10)', 1024],
    ['=SQRT(16)', 4],
    ['=LOG(8, 2)', 3],
    ['=LOG10(1000)', 3],
    ['=SIGN(-3)', -1],
    ['=CEILING(23, 5)', 25],
    ['=FLOOR(23, 5)', 20],
    ['=CEILING(1, 0)', 0],
    ['=MROUND(17, 5)', 15],
    ['=MROUND(17, 0)', 0],
    ['=QUOTIENT(10, 3)', 3],
    ['=GCD(12, 18)', 6],
    ['=LCM(4, 6)', 12],
    ['=LCM(4, 0)', 0],
    ['=FACT(5)', 120],
    ['=RANDBETWEEN(1, 6)', 4],
    ['=0.1+0.2=0.3', true],
  ])('%s is %s', (f, out) => {
    expect(calc(f, DATA)).toEqual(out);
  });
  it('works out irrational results', () => {
    close(calc('=EXP(1)'), Math.E);
    close(calc('=LN(10)'), Math.log(10));
    close(calc('=PI()'), Math.PI);
    close(calc('=RAND()'), 0.5);
  });
  it.each([
    ['=SQRT(-1)', '#NUM!'],
    ['=LN(0)', '#NUM!'],
    ['=LOG(1, 1)', '#NUM!'],
    ['=LOG10(0)', '#NUM!'],
    ['=MOD(1, 0)', '#DIV/0!'],
    ['=QUOTIENT(1, 0)', '#DIV/0!'],
    ['=POWER(0, -1)', '#DIV/0!'],
    ['=POWER(-8, 0.5)', '#NUM!'],
    ['=FACT(-1)', '#NUM!'],
    ['=GCD(-1)', '#NUM!'],
    ['=LCM(-1)', '#NUM!'],
    ['=CEILING(5, -1)', '#NUM!'],
    ['=MROUND(5, -1)', '#NUM!'],
    ['=RANDBETWEEN(5, 1)', '#NUM!'],
    ['=SUM(1/0)', '#DIV/0!'],
    ['=SUM("x")', '#VALUE!'],
    ['=PRODUCT(1/0)', '#DIV/0!'],
    ['=SUMIFS(B1:B5, A1:A2, 1)', '#VALUE!'],
    ['=SUMIFS(B1:B5, A1:A5)', '#N/A'],
    ['=SUMIF(A1:A2, 1, 1/0)', '#DIV/0!'],
    ['=SUMPRODUCT(A1:A3, B1:B2)', '#VALUE!'],
    ['=SUMPRODUCT(A1:A2/0)', '#DIV/0!'],
    ['=SUM()', '#N/A'],
    ['=ABS("a")', '#VALUE!'],
    ['=RANDBETWEEN("a", 1)', '#VALUE!'],
    ['=RANDBETWEEN(1, "a")', '#VALUE!'],
    ['=GCD("a")', '#VALUE!'],
    ['=LCM("a")', '#VALUE!'],
    ['=SUMIF(A1:A2, 1/0)', '#DIV/0!'],
    ['=SUMIFS(B1:B5, A1:A5, 1, B1:B2, 2)', '#VALUE!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, DATA)).toMatchObject({ e });
  });
});

describe('statistics', () => {
  it.each([
    ['=AVERAGE(B1:B5)', 30],
    ['=AVERAGEIF(A1:A3, ">1", B1:B3)', 25],
    ['=AVERAGEIF(B1:B5, ">25")', 40],
    ['=AVERAGEIFS(B1:B5, B1:B5, ">15", B1:B5, "<45")', 30],
    ['=MINIFS(B1:B5, B1:B5, ">15")', 20],
    ['=MAXIFS(B1:B5, B1:B5, "<45")', 40],
    ['=MINIFS(B1:B5, B1:B5, ">100")', 0],
    ['=MEDIAN(B1:B4)', 25],
    ['=MODE(1, 2, 2, 3)', 2],
    ['=MIN(B1:B5)', 10],
    ['=MAX(B1:B5)', 50],
    ['=MIN(A4)', 0],
    ['=COUNT(A1:A5, 7, "8")', 5],
    ['=COUNTA(A1:A5)', 5],
    ['=COUNTBLANK(A1:A7)', 2],
    ['=COUNTIF(A1:A5, "x")', 1],
    ['=COUNTIF(B1:B5, ">=30")', 3],
    ['=COUNTIFS(A1:A3, ">1", B1:B3, "<30")', 1],
    ['=LARGE(B1:B5, 2)', 40],
    ['=SMALL(B1:B5, 2)', 20],
    ['=RANK(30, B1:B5)', 3],
    ['=RANK(30, B1:B5, 1)', 3],
    ['=RANK(10, B1:B5, 1)', 1],
    ['=PERCENTILE(B1:B5, 0.5)', 30],
    ['=QUARTILE(B1:B5, 1)', 20],
    ['=VAR.P(B1:B5)', 200],
    ['=VAR(B1:B5)', 250],
  ])('%s is %s', (f, out) => {
    expect(calc(f, DATA)).toEqual(out);
  });
  it('works out spreads and correlation', () => {
    expect(calc('=STDEV(B1:B5)', DATA) as number).toBeCloseTo(15.8113883, 6);
    expect(calc('=STDEV.P(B1:B5)', DATA) as number).toBeCloseTo(14.1421356, 6);
    expect(calc('=CORREL(A1:A3, B1:B3)', DATA) as number).toBeCloseTo(1, 9);
  });
  it.each([
    ['=AVERAGE(A4)', '#DIV/0!'],
    ['=AVERAGEIF(B1:B5, ">100")', '#DIV/0!'],
    ['=AVERAGEIFS(B1:B5, B1:B5, ">100")', '#DIV/0!'],
    ['=AVERAGEIFS(B1:B5, B1:B2, ">1")', '#VALUE!'],
    ['=AVERAGEIFS(B1:B5, B1:B5)', '#N/A'],
    ['=MEDIAN(A4)', '#NUM!'],
    ['=MODE(1, 2, 3)', '#N/A'],
    ['=LARGE(B1:B5, 9)', '#NUM!'],
    ['=RANK(31, B1:B5)', '#N/A'],
    ['=PERCENTILE(B1:B5, 2)', '#NUM!'],
    ['=QUARTILE(B1:B5, 5)', '#NUM!'],
    ['=STDEV(1)', '#DIV/0!'],
    ['=VAR.P()', '#N/A'],
    ['=CORREL(A1:A3, B1:B2)', '#N/A'],
    ['=CORREL(A1, B1)', '#DIV/0!'],
    ['=CORREL({1,1}, {1,2})', '#DIV/0!'],
    ['=COUNTIF(A1:A5)', '#N/A'],
    ['=COUNTIFS(A1:A2, 1, B1:B3, 1)', '#VALUE!'],
    ['=AVERAGEIF(A1:A2, 1/0)', '#DIV/0!'],
    ['=SMALL(1/0, 1)', '#DIV/0!'],
    ['=SMALL(B1:B5, "a")', '#VALUE!'],
    ['=RANK("a", B1:B5)', '#VALUE!'],
    ['=RANK(1, 1/0)', '#DIV/0!'],
    ['=RANK(1, B1:B5, "a")', '#VALUE!'],
    ['=PERCENTILE(1/0, 1)', '#DIV/0!'],
    ['=PERCENTILE(B1:B5, "a")', '#VALUE!'],
    ['=QUARTILE(1/0, 1)', '#DIV/0!'],
    ['=QUARTILE(B1:B5, "a")', '#VALUE!'],
    ['=AVERAGE(1/0)', '#DIV/0!'],
    ['=STDEV.P()', '#N/A'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, DATA)).toMatchObject({ e });
  });
});
