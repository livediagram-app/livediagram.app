import { describe, expect, it } from 'vitest';
import {
  columnIndex,
  columnLetters,
  formatA1,
  formatRange,
  parseA1,
  parseRangeText,
  rangeContains,
  rangeSize,
} from './address';

describe('column letters', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [51, 'AZ'],
    [52, 'BA'],
    [199, 'GR'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('%i is %s, both ways', (n, letters) => {
    expect(columnLetters(n)).toBe(letters);
    expect(columnIndex(letters)).toBe(n);
    expect(columnIndex(letters.toLowerCase())).toBe(n);
  });
  it('refuses what is not letters', () => {
    expect(columnIndex('A1')).toBe(-1);
    expect(columnIndex('')).toBe(-1);
    expect(columnIndex('ABCDE')).toBe(-1);
  });
});

describe('A1', () => {
  it('formats with absolute parts', () => {
    expect(formatA1(3, 1)).toBe('B4');
    expect(formatA1(3, 1, { row: true, col: true })).toBe('$B$4');
    expect(formatA1(3, 1, { row: true, col: false })).toBe('B$4');
    expect(formatA1(3, 1, { row: false, col: true })).toBe('$B4');
  });
  it('parses cells', () => {
    expect(parseA1('b4')).toEqual({ r: 3, c: 1, abs: { row: false, col: false } });
    expect(parseA1(' $C$10 ')).toEqual({ r: 9, c: 2, abs: { row: true, col: true } });
    expect(parseA1('A0')).toBeNull();
    expect(parseA1('4B')).toBeNull();
    expect(parseA1('')).toBeNull();
  });
  it('parses and formats ranges, normalised', () => {
    expect(parseRangeText('D9:B4')).toEqual({ r1: 3, c1: 1, r2: 8, c2: 3 });
    expect(parseRangeText('B4')).toEqual({ r1: 3, c1: 1, r2: 3, c2: 1 });
    expect(parseRangeText('B4:')).toBeNull();
    expect(parseRangeText('A1:B2:C3')).toBeNull();
    expect(parseRangeText('x')).toBeNull();
    expect(formatRange({ r1: 3, c1: 1, r2: 8, c2: 3 })).toBe('B4:D9');
    expect(formatRange({ r1: 0, c1: 0, r2: 0, c2: 0 })).toBe('A1');
  });
  it('measures and contains', () => {
    const r = { r1: 1, c1: 1, r2: 3, c2: 2 };
    expect(rangeSize(r)).toEqual({ rows: 3, cols: 2 });
    expect(rangeContains(r, 2, 2)).toBe(true);
    expect(rangeContains(r, 0, 2)).toBe(false);
  });
});
