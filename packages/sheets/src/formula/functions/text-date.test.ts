import { describe, expect, it } from 'vitest';
import { calc } from '../../testing/book';
import { serialFromDate } from '../../dates';

const T = { A1: 'Hello World', A2: '  a   b  ', A3: 'a-b-c', B1: '1', B2: '', B3: 'x', F1: '=1/0' };

describe('text', () => {
  it.each([
    ['=CONCAT(A3, "!", B1)', 'a-b-c!1'],
    ['=CONCATENATE("a", "b")', 'ab'],
    ['=TEXTJOIN(", ", TRUE, B1:B3)', '1, x'],
    ['=TEXTJOIN(", ", FALSE, B1:B3)', '1, , x'],
    ['=JOIN("/", B1:B3)', '1//x'],
    ['=LEFT(A1, 5)', 'Hello'],
    ['=LEFT(A1)', 'H'],
    ['=RIGHT(A1, 5)', 'World'],
    ['=RIGHT(A1, 0)', ''],
    ['=MID(A1, 7, 3)', 'Wor'],
    ['=LEN(A1)', 11],
    ['=UPPER(A1)', 'HELLO WORLD'],
    ['=LOWER(A1)', 'hello world'],
    ['=PROPER("hello o\'neil-jones")', "Hello O'neil-Jones"],
    ['=TRIM(A2)', 'a b'],
    ['=CLEAN(CHAR(7) & "x")', 'x'],
    ['=SUBSTITUTE(A3, "-", "+")', 'a+b+c'],
    ['=SUBSTITUTE(A3, "-", "+", 2)', 'a-b+c'],
    ['=SUBSTITUTE(A3, "-", "+", 9)', 'a-b-c'],
    ['=SUBSTITUTE(A3, "", "+")', 'a-b-c'],
    ['=REPLACE(A1, 1, 5, "Howdy")', 'Howdy World'],
    ['=FIND("o", A1)', 5],
    ['=FIND("o", A1, 6)', 8],
    ['=SEARCH("WOR", A1)', 7],
    ['=SEARCH("w*d", A1)', 7],
    ['=SEARCH("~*", "a*b")', 2],
    ['=SEARCH("o", A1, 6)', 8],
    ['=REPT("ab", 3)', 'ababab'],
    ['=EXACT("a", "A")', false],
    ['=TEXT(1234.5, "#,##0.00")', '1,234.50'],
    ['=TEXT("x", "@!")', 'x!'],
    ['=TEXT(TRUE, "0")', 'TRUE'],
    ['=VALUE("1,234.5")', 1234.5],
    ['=VALUE("12%")', 0.12],
    ['=VALUE("£5")', 5],
    ['=VALUE(5)', 5],
    ['=VALUE(B2)', 0],
    ['=VALUE("14:30")', 14.5 / 24],
    ['=VALUE("2026-10-08")', serialFromDate(2026, 10, 8)],
    ['=CHAR(65)', 'A'],
    ['=CODE("A")', 65],
    ['=REGEXMATCH(A1, "^H.*d$")', true],
    ['=REGEXEXTRACT("abc123", "\\d+")', '123'],
    ['=REGEXEXTRACT("abc123", "c(\\d)")', '1'],
    ['=REGEXREPLACE("a  b", "\\s+", " ")', 'a b'],
    ['=HYPERLINK("https://x.test", "X")', 'X'],
    ['=HYPERLINK("https://x.test")', 'https://x.test'],
    ['=SPLIT("a,b;c", ",;")', 'a'],
    ['=SPLIT("a", "")', 'a'],
    ['=COUNTA(SPLIT("a,,b", ","))', 2],
    ['=COUNTA(SPLIT("a,,b", ",", TRUE, FALSE))', 3],
    ['=COUNTA(SPLIT("a--b", "--", FALSE))', 2],
    ['=SPLIT(",", ",")', ''],
    ['="a"&1&TRUE', 'a1TRUE'],
  ])('%s', (f, out) => {
    expect(calc(f, T)).toEqual(out);
  });
  it.each([
    ['=LEFT(A1, -1)', '#VALUE!'],
    ['=RIGHT(A1, -1)', '#VALUE!'],
    ['=MID(A1, 0, 1)', '#VALUE!'],
    ['=SUBSTITUTE(A3, "-", "+", 0)', '#VALUE!'],
    ['=REPLACE(A1, 0, 1, "x")', '#VALUE!'],
    ['=REPLACE(F1, 1, 1, "x")', '#DIV/0!'],
    ['=FIND("z", A1)', '#VALUE!'],
    ['=SEARCH("z", A1)', '#VALUE!'],
    ['=SEARCH("a", A1, 0)', '#VALUE!'],
    ['=REPT("a", -1)', '#VALUE!'],
    ['=REPT("a", 20000)', '#VALUE!'],
    ['=VALUE("abc")', '#VALUE!'],
    ['=VALUE(TRUE)', '#VALUE!'],
    ['=VALUE(F1)', '#DIV/0!'],
    ['=CHAR(0)', '#VALUE!'],
    ['=CODE("")', '#VALUE!'],
    ['=REGEXMATCH("a", "(")', '#VALUE!'],
    ['=REGEXEXTRACT("a", "z")', '#N/A'],
    ['=REGEXEXTRACT("a", "(")', '#VALUE!'],
    ['=REGEXREPLACE("a", "(", "")', '#VALUE!'],
    ['=TEXT(1, F1)', '#DIV/0!'],
    ['=TEXT(F1, "0")', '#DIV/0!'],
    ['=CONCAT(F1)', '#DIV/0!'],
    ['=CONCATENATE(F1)', '#DIV/0!'],
    ['=TEXTJOIN(F1, TRUE, "a")', '#DIV/0!'],
    ['=TEXTJOIN(",", "x", "a")', '#VALUE!'],
    ['=TEXTJOIN(",", TRUE, F1)', '#DIV/0!'],
    ['=JOIN(F1, "a")', '#DIV/0!'],
    ['=JOIN(",", F1)', '#DIV/0!'],
    ['=SPLIT(F1, ",")', '#DIV/0!'],
    ['=LEN(F1)', '#DIV/0!'],
    ['=LEFT("a", "x")', '#VALUE!'],
    ['=REPT(REPT("a", 9000), 2)', '#VALUE!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, T)).toMatchObject({ e });
  });
  it('bounds regular expression work', () => {
    expect(calc(`=REGEXMATCH(REPT("a", 9000), "${'(a+)+'.repeat(300)}")`)).toMatchObject({
      e: '#VALUE!',
    });
  });
});

const d = (y: number, m: number, day: number) => serialFromDate(y, m, day);
const DATES = {
  A1: '2026-10-08',
  A2: '2026-01-31',
  A3: '2024-02-29',
  A4: '2026-12-25',
  B1: '14:30:15',
  F1: '=1/0',
};

describe('dates', () => {
  it.each([
    ['=TODAY()', 46303],
    ['=NOW()', 46303.5],
    ['=DATE(2026, 10, 8)', d(2026, 10, 8)],
    ['=DATE(2026, 13, 1)', d(2027, 1, 1)],
    ['=DATE(2026, 3, 0)', d(2026, 2, 28)],
    ['=DATE(26, 1, 1)', d(1926, 1, 1)],
    ['=TIME(14, 30, 0)', 14.5 / 24],
    ['=TIME(25, 0, 0)', 1 / 24],
    ['=DATEVALUE("8 Oct 2026")', d(2026, 10, 8)],
    ['=DATEVALUE(46303.7)', 46303],
    ['=TIMEVALUE("2:30 pm")', 14.5 / 24],
    ['=TIMEVALUE("2026-10-08 06:00")', 0.25],
    ['=YEAR(A1)', 2026],
    ['=MONTH(A1)', 10],
    ['=DAY(A1)', 8],
    ['=HOUR(B1)', 14],
    ['=MINUTE(B1)', 30],
    ['=SECOND(B1)', 15],
    ['=WEEKDAY(A1)', 5],
    ['=WEEKDAY(A1, 2)', 4],
    ['=WEEKDAY(A1, 3)', 3],
    ['=WEEKNUM(A1)', 41],
    ['=WEEKNUM(A1, 2)', 41],
    ['=ISOWEEKNUM(A1)', 41],
    ['=ISOWEEKNUM(DATE(2027, 1, 1))', 53],
    ['=ISOWEEKNUM(DATE(2026, 1, 1))', 1],
    ['=EDATE(A2, 1)', d(2026, 2, 28)],
    ['=EDATE(A2, -13)', d(2024, 12, 31)],
    ['=EOMONTH(A1, 0)', d(2026, 10, 31)],
    ['=EOMONTH(A3, 12)', d(2025, 2, 28)],
    ['=DATEDIF(A3, A1, "Y")', 2],
    ['=DATEDIF(A3, A1, "M")', 31],
    ['=DATEDIF(A3, A1, "D")', d(2026, 10, 8) - d(2024, 2, 29)],
    ['=DATEDIF(A3, A1, "MD")', 9],
    ['=DATEDIF(DATE(2026,1,31), DATE(2026,3,1), "MD")', 1],
    ['=DATEDIF(A3, A1, "YM")', 7],
    ['=DATEDIF(A3, A1, "YD")', d(2026, 10, 8) - d(2026, 3, 1)],
    ['=DATEDIF(DATE(2026,11,1), DATE(2027,10,8), "YD")', d(2027, 10, 8) - d(2026, 11, 1)],
    ['=DATEDIF("2026-01-01", "2026-02-01", "D")', 31],
    ['=DAYS(A4, A1)', 78],
    ['=NETWORKDAYS(A1, A4)', 57],
    ['=NETWORKDAYS(A4, A1)', -57],
    ['=NETWORKDAYS(A1, A4, A4)', 56],
    ['=WORKDAY(A1, 1)', d(2026, 10, 9)],
    ['=WORKDAY(A1, 2)', d(2026, 10, 12)],
    ['=WORKDAY(A1, -4)', d(2026, 10, 2)],
    ['=WORKDAY(A1, 1, DATE(2026,10,9))', d(2026, 10, 12)],
  ])('%s', (f, out) => {
    const v = calc(f, DATES);
    expect(v as number).toBeCloseTo(out as number, 9);
  });
  it('works out year fractions on every basis', () => {
    const f = (b: number) => calc(`=YEARFRAC(DATE(2026,1,1), DATE(2026,7,1), ${b})`) as number;
    expect(f(0)).toBeCloseTo(0.5, 9);
    expect(f(1)).toBeCloseTo(181 / 365, 9);
    expect(f(2)).toBeCloseTo(181 / 360, 9);
    expect(f(3)).toBeCloseTo(181 / 365, 9);
    expect(f(4)).toBeCloseTo(0.5, 9);
    expect(calc('=YEARFRAC(DATE(2024,1,31), DATE(2026,3,31))') as number).toBeCloseTo(2.1666667, 6);
    expect(calc('=YEARFRAC(DATE(2026,7,1), DATE(2026,1,1), 0)') as number).toBeCloseTo(0.5, 9);
    expect(calc('=YEARFRAC(DATE(2024,6,1), DATE(2026,6,1), 1)') as number).toBeCloseTo(2, 2);
    expect(calc('=YEARFRAC(DATE(2024,1,1), DATE(2024,7,1), 1)') as number).toBeCloseTo(
      182 / 366,
      9,
    );
  });
  it.each([
    ['=DATE(10000, 1, 1)', '#NUM!'],
    ['=DATE(-1, 1, 1)', '#NUM!'],
    ['=TIME(-1, 0, 0)', '#NUM!'],
    ['=DATEVALUE("nope")', '#VALUE!'],
    ['=DATEVALUE(TRUE)', '#VALUE!'],
    ['=TIMEVALUE(1)', '#VALUE!'],
    ['=TIMEVALUE("nope")', '#VALUE!'],
    ['=WEEKDAY(A1, 9)', '#NUM!'],
    ['=WEEKNUM(A1, 9)', '#NUM!'],
    ['=EDATE(A1, 999999)', '#NUM!'],
    ['=DATEDIF(A1, A3, "Y")', '#NUM!'],
    ['=DATEDIF(A3, A1, "Q")', '#NUM!'],
    ['=DATEDIF(F1, A1, "Y")', '#DIV/0!'],
    ['=DATEDIF(A1, F1, "Y")', '#DIV/0!'],
    ['=DATEDIF(A3, A1, F1)', '#DIV/0!'],
    ['=DAYS(F1, A1)', '#DIV/0!'],
    ['=DAYS(A1, F1)', '#DIV/0!'],
    ['=NETWORKDAYS(F1, A1)', '#DIV/0!'],
    ['=NETWORKDAYS(A1, F1)', '#DIV/0!'],
    ['=NETWORKDAYS(A1, A4, F1)', '#DIV/0!'],
    ['=NETWORKDAYS(0, 999999)', '#NUM!'],
    ['=WORKDAY(F1, 1)', '#DIV/0!'],
    ['=WORKDAY(A1, F1)', '#DIV/0!'],
    ['=WORKDAY(A1, 1, F1)', '#DIV/0!'],
    ['=WORKDAY(A1, 999999)', '#NUM!'],
    ['=YEARFRAC(F1, A1)', '#DIV/0!'],
    ['=YEARFRAC(A1, F1)', '#DIV/0!'],
    ['=YEARFRAC(A1, A4, 9)', '#NUM!'],
    ['=YEARFRAC(A1, A4, "x")', '#VALUE!'],
  ])('%s is %s', (f, e) => {
    expect(calc(f, DATES)).toMatchObject({ e });
  });
});
