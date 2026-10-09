import { describe, expect, it } from 'vitest';
import { fillSeries } from './fill';
import { parseCsv, toCsv } from './csv';
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
    expect(fillSeries(src as never, count as number, copy as boolean)).toEqual(out);
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
});
