import { describe, expect, it } from 'vitest';
import { calc } from '../../testing/book';

// Answers other spreadsheets give that ours once did not (docs/specs/029-sheets/formulas.md "Functions").
describe('spreadsheet parity', () => {
  const KEYS = {
    A1: 'a*',
    B1: 'one',
    A2: '*',
    B2: 'two',
    A3: 'cherry',
    B3: 'three',
    A4: 'a?',
    B4: 'four',
  };

  it.each([
    ['=MATCH("~*", A1:A3, 0)', 2],
    ['=VLOOKUP("~*", A1:B3, 2, FALSE)', 'two'],
    ['=XLOOKUP("a~?", A1:A4, B1:B4, "none", 2)', 'four'],
    ['=XMATCH("a~*", A1:A4, 2)', 1],
    // A live wildcard still matches as one.
    ['=MATCH("ch*", A1:A3, 0)', 3],
  ])('a lookup key reads ~ escapes as COUNTIF does: %s is %s', (f, v) => {
    expect(calc(f, KEYS)).toBe(v);
  });

  it('LOOKUP answers a blank result cell as blank, not #N/A', () => {
    const cells = { A1: '1', A2: '2', A3: '3', B1: 'x', B3: 'z' };
    expect(calc('=LOOKUP(2, A1:A3, B1:B3)', cells)).toBeNull();
    expect(calc('=LOOKUP(3, A1:A3, B1:B3)', cells)).toBe('z');
    expect(calc('=LOOKUP(3, A1:A3, B1:B2)', cells)).toMatchObject({ e: '#N/A' });
  });

  it('PRODUCT of no numbers is 0', () => {
    expect(calc('=PRODUCT(A1:A2)', { A2: 'text' })).toBe(0);
    expect(calc('=PRODUCT(A1:A2)', { A1: '3', A2: '4' })).toBe(12);
  });

  it('TRIM takes spaces only', () => {
    expect(calc('=LEN(TRIM(CHAR(10)&"a"))')).toBe(2);
    expect(calc('=LEN(TRIM("a"&CHAR(160)))')).toBe(2);
    expect(calc('=TRIM("  a   b  ")')).toBe('a b');
  });

  it.each([
    ['=TEXT(0.5+0.6/86400, "hh:mm:ss.000")', '12:00:00.600'],
    ['=TEXT(46000+0.6/86400, "hh:mm:ss.00")', '00:00:00.60'],
    ['=TEXT(0.00001157, "hh:mm:ss.000")', '00:00:01.000'],
    ['=TEXT(0.5+0.9996/86400, "hh:mm:ss.000")', '12:00:01.000'],
    ['=TEXT(0.5+0.26/86400, "ss.0")', '00.3'],
    ['=TEXT(13/1440, "[m]")', '13'],
    ['=TEXT(13/1440, "[mm]:ss")', '13:00'],
    ['=TEXT(23.99999/24, "[h]:mm")', '24:00'],
    ['=TEXT(1.5, "[h]")', '36'],
    ['=TEXT(1/86400*90, "[s]")', '90'],
  ])('a time format reads its parts from one rounding: %s is %s', (f, v) => {
    expect(calc(f)).toBe(v);
  });

  it.each([
    ['=TEXT(5, "@")', '5'],
    ['=TEXT(5, "@""!""")', '5!'],
    ['=TEXT(-2.5, "@")', '-2.5'],
    ['=TEXT("abc", "@")', 'abc'],
  ])('a text section shows a number as text: %s is %s', (f, v) => {
    expect(calc(f)).toBe(v);
  });
});
