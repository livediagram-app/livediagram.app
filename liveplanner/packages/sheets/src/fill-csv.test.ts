import { describe, expect, it } from 'vitest';
import { fillSeries } from './fill';
import { csvSafeField, isCsvPhoneNumber, parseCsv, toCsv } from './csv';
import { serialFromDate } from './dates';

const n = (x: number) => ({ n: x });
const s = (x: string) => ({ s: x });

describe('fillSeries', () => {
  it.each([
    [[n(1)], 3, false, [n(1), n(1), n(1)]],
    [[n(1)], 2, true, [n(2), n(3)]],
    [[n(1), n(2)], 2, false, [n(3), n(4)]],
    [[n(10), n(7)], 2, false, [n(4), n(1)]],
    [[n(1), n(2), n(4)], 2, false, [n(1), n(2)]],
    [[n(1), n(2)], 1, true, [n(1)]],
    [[s('Item 1')], 2, false, [s('Item 2'), s('Item 3')]],
    [[s('Q1'), s('Q3')], 2, false, [s('Q5'), s('Q7')]],
    [[s('a1'), s('b2')], 2, false, [s('a1'), s('b2')]],
    [[s('x09')], 1, false, [s('x10')]],
    [[s('Jan')], 2, false, [s('Feb'), s('Mar')]],
    [[s('November')], 2, false, [s('December'), s('January')]],
    [[s('MON'), s('WED')], 2, false, [s('FRI'), s('SUN')]],
    [[s('monday')], 1, false, [s('tuesday')]],
    [[s('x')], 2, false, [s('x'), s('x')]],
    [[s('a'), undefined], 3, false, [s('a'), undefined, s('a')]],
    [[s('Item 1'), s('Item 2'), s('Item 9')], 1, false, [s('Item 1')]],
  ])('%j for %i', (src, count, copy, out) => {
    expect(fillSeries(src as never, count, copy)).toEqual(out);
  });
  it('counts down when filling up or left', () => {
    expect(fillSeries([s('Mon')], 2, false, false, true)).toEqual([s('Sun'), s('Sat')]);
    expect(fillSeries([s('Item 3')], 1, false, false, true)).toEqual([s('Item 2')]);
    expect(fillSeries([n(5)], 2, true, false, true)).toEqual([n(4), n(3)]);
  });
  it('continues dates by the month when they step by months', () => {
    const jan31 = serialFromDate(2026, 1, 31);
    const feb28 = serialFromDate(2026, 2, 28);
    expect(
      fillSeries([n(serialFromDate(2026, 1, 15)), n(serialFromDate(2026, 2, 15))], 1, false, true),
    ).toEqual([n(serialFromDate(2026, 3, 15))]);
    expect(fillSeries([n(jan31), n(serialFromDate(2026, 3, 31))], 1, false, true)).toEqual([
      n(serialFromDate(2026, 5, 31)),
    ]);
    expect(fillSeries([n(serialFromDate(2025, 12, 31)), n(jan31)], 1, false, true)).toEqual([
      n(feb28),
    ]);
    expect(fillSeries([n(jan31), n(jan31 + 7)], 1, false, true)).toEqual([n(jan31 + 14)]);
    expect(fillSeries([n(jan31), n(jan31)], 1, false, true)).toEqual([n(jan31)]);
    expect(fillSeries([n(1.5), n(2.5)], 1, false, true)).toEqual([n(3.5)]);
  });
});

describe('CSV', () => {
  it('reads RFC 4180', () => {
    expect(parseCsv('a,b\r\n"c,d","e""f"\n"multi\nline",\n')).toEqual({
      rows: [
        ['a', 'b'],
        ['c,d', 'e"f'],
        ['multi\nline', ''],
      ],
      truncated: false,
    });
    expect(parseCsv('﻿a\tb\nc\td').rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseCsv('a;b', ';').rows).toEqual([['a', 'b']]);
    expect(parseCsv('').rows).toEqual([]);
    expect(parseCsv('x').rows).toEqual([['x']]);
  });

  it('reads a semicolon-separated file, as Excel writes it where the decimal mark is a comma', () => {
    expect(parseCsv('Name;Amount\nTea;3,50\n').rows).toEqual([
      ['Name', 'Amount'],
      ['Tea', '3,50'],
    ]);
    // A comma file with a semicolon in one field stays comma-separated.
    expect(parseCsv('a,b;c\n1,2').rows).toEqual([
      ['a', 'b;c'],
      ['1', '2'],
    ]);
    // A comma-decimal value with no header, and a comma in a header: still semicolons.
    expect(parseCsv('Tea;3,50\nCoffee;2,80').rows).toEqual([
      ['Tea', '3,50'],
      ['Coffee', '2,80'],
    ]);
    expect(parseCsv('Name;Amount, EUR\nTea;3,50\n').rows).toEqual([
      ['Name', 'Amount, EUR'],
      ['Tea', '3,50'],
    ]);
    // A quoted comma is a field's, not a separator; a blank line takes no part.
    expect(parseCsv('"Doe, J";Score\n\nAl;7').rows).toEqual([
      ['Doe, J', 'Score'],
      [''],
      ['Al', '7'],
    ]);
    // And a quoted semicolon in a comma file is a field's too.
    expect(parseCsv('Item,Notes\nA,"x;y"').rows).toEqual([
      ['Item', 'Notes'],
      ['A', 'x;y'],
    ]);
  });

  it("reads a one-column sheet's download back as one column", () => {
    const rows = [['Item; qty'], ['x']];
    expect(parseCsv(toCsv(rows)).rows).toEqual(rows);
  });

  // A tab only in a field is the field's: the first line holding one used to make the whole file tab-separated, so a
  // sheet whose first row held a tab came back from its own download garbled.
  it("reads a download whose first row holds a tab back as it was, and a quoted tab as a field's", () => {
    const rows = [
      ['a\tb', 'c'],
      ['d', 'e\tf'],
    ];
    expect(parseCsv(toCsv(rows)).rows).toEqual(rows);
    expect(parseCsv('"x\ty",z\n1,2').rows).toEqual([
      ['x\ty', 'z'],
      ['1', '2'],
    ]);
    // A tab outside quotes on the first line still makes a tab-separated file.
    expect(parseCsv('"a,b"\tc\n1\t2').rows).toEqual([
      ['a,b', 'c'],
      ['1', '2'],
    ]);
  });

  // The tie between commas and semicolons went to semicolons even when reading by semicolons broke a quoted field:
  // a one-row download holding a semicolon came back split inside its quotes.
  it("reads a quoted semicolon as a field's, even where both separators split a line alike", () => {
    for (const rows of [[['', ';']], [['a\tb', 'a;']], [['=SUM(A1)', ';x"']]]) {
      expect(parseCsv(toCsv(rows)).rows).toEqual(rows);
    }
    // A real semicolon file still reads as one, its quoted comma kept.
    expect(parseCsv('"Doe, J";7').rows).toEqual([['Doe, J', '7']]);
  });

  it('cuts at the limits', () => {
    expect(parseCsv(`${'a,'.repeat(250)}a`).rows[0]).toHaveLength(200);
    const big = parseCsv('1\n'.repeat(10_005));
    expect(big.rows).toHaveLength(10_000);
    expect(big.truncated).toBe(true);
    expect(parseCsv('1\n'.repeat(10_000)).truncated).toBe(false);
  });
  it('writes quoting what needs it', () => {
    expect(
      toCsv([
        ['a', 'b,c'],
        ['"q"', 'l\nm'],
      ]),
    ).toBe('a,"b,c"\r\n"""q""","l\nm"\r\n');
    expect(toCsv([])).toBe('');
  });
  // docs/specs/029-sheets/sheet.md "CSV": a download never carries a live formula into another spreadsheet.
  it('makes a field a spreadsheet would run as a formula inert in a safe download, numbers as shown kept', () => {
    const rows = [
      ['=HYPERLINK("http://x","y")', '+cmd', '-2+3+cmd|calc', '@SUM(A1)', '\tx', '\rx'],
      ['-1,200.50', '-£45', '+3%', '-7', 'plain', ''],
    ];
    expect(parseCsv(toCsv(rows, { safe: true }), ',').rows).toEqual([
      ['\'=HYPERLINK("http://x","y")', "'+cmd", "'-2+3+cmd|calc", "'@SUM(A1)", "'\tx", "'\rx"],
      ['-1,200.50', '-£45', '+3%', '-7', 'plain', ''],
    ]);
    // A sheet's own round trip is untouched.
    expect(toCsv([['=1+1']])).toBe('=1+1\r\n');
    expect(parseCsv(toCsv(rows), ',').rows).toEqual(rows);
  });
  it('keeps spaced numbers as shown and reads a long run of spaces in linear time', () => {
    expect(['- £ 45', '£ 45', '-45 £%'].map(csvSafeField)).toEqual(['- £ 45', '£ 45', '-45 £%']);
    expect(csvSafeField('- x')).toBe("'- x");
    // A field that is a sign then 100,000 spaces backtracked quadratically before (seconds); now well under a budget.
    const field = `-${' '.repeat(100_000)}x`;
    const t0 = performance.now();
    expect(csvSafeField(field)).toBe(`'${field}`);
    expect(performance.now() - t0).toBeLessThan(50);
  });
  // A phone number holds no formula, so a download keeps its + as quoted text with no ' (sheet.md "CSV").
  it('writes a phone number as quoted text, keeping its +, and still makes a formula inert', () => {
    expect(['+44 20 7946 0958', '+1 (555) 010-0199'].map(csvSafeField)).toEqual([
      '+44 20 7946 0958',
      '+1 (555) 010-0199',
    ]);
    expect(isCsvPhoneNumber('+44')).toBe(false);
    for (const formula of ['+44 20 7946 0958+A1', '+SUM(A1)', '+1-2 x', '=HYPERLINK("x")'])
      expect(csvSafeField(formula), formula).toBe(`'${formula}`);
    expect(toCsv([['+44 20 7946 0958', '=1+1', 'a,b']], { safe: true })).toBe(
      `"+44 20 7946 0958",'=1+1,"a,b"\r\n`,
    );
    expect(parseCsv(toCsv([['+44 20 7946 0958']], { safe: true }), ',').rows).toEqual([
      ['+44 20 7946 0958'],
    ]);
    const field = `+${' '.repeat(100_000)}x`;
    const t0 = performance.now();
    expect(csvSafeField(field)).toBe(`'${field}`);
    expect(performance.now() - t0).toBeLessThan(50);
  });
});
