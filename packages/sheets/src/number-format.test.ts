import { describe, expect, it } from 'vitest';
import { displayValue, formatNumber, textFormat } from './number-format';
import { serialFromParts } from './dates';

const gb = (n: number, f?: Parameters<typeof formatNumber>[1]) => formatNumber(n, f, 'en-GB');

describe('number formats', () => {
  it('draws each kind', () => {
    expect(gb(1234.5)).toBe('1234.5');
    expect(gb(1234.5, { nf: 'number' })).toBe('1,234.50');
    expect(gb(1234.5, { nf: 'number', dp: 0 })).toBe('1,235');
    expect(gb(0.125, { nf: 'percent' })).toBe('12.50%');
    expect(gb(1234.5, { nf: 'currency', cur: '$' })).toBe('$1,234.50');
    expect(gb(-1234.5, { nf: 'currency' })).toBe('-£1,234.50');
    expect(gb(-1234.5, { nf: 'accounting' })).toBe('£ (1,234.50)');
    expect(gb(1234.5, { nf: 'accounting' })).toBe('£ 1,234.50');
    expect(gb(1234.5, { nf: 'scientific' })).toBe('1.23E+03');
    expect(gb(0.00012, { nf: 'scientific' })).toBe('1.20E-04');
    expect(gb(serialFromParts(2026, 10, 8), { nf: 'date' })).toBe('08/10/2026');
    expect(gb(serialFromParts(2026, 10, 8, 14, 5), { nf: 'datetime' })).toBe('08/10/2026, 14:05');
    expect(gb(0.5, { nf: 'time' })).toBe('12:00:00');
    expect(gb(1.25, { nf: 'duration' })).toBe('30:00:00');
    expect(gb(-0.5, { nf: 'duration' })).toBe('-12:00:00');
    expect(gb(2.5, { dp: 2 })).toBe('2.50');
    expect(formatNumber(1234.5, { nf: 'number' }, 'de-DE')).toBe('1.234,50');
    expect(formatNumber(1.5, undefined, 'de-DE')).toBe('1,5');
    expect(formatNumber(1.5, { nf: 'scientific' }, 'de-DE')).toBe('1,50E+00');
  });
  it('displays values by kind', () => {
    expect(displayValue(null, undefined, 'en')).toMatchObject({ text: '', kind: 'empty' });
    expect(displayValue(true, undefined, 'en')).toMatchObject({ text: 'TRUE', align: 'c' });
    expect(displayValue('hi', undefined, 'en')).toMatchObject({ text: 'hi', align: 'l' });
    expect(displayValue(3, undefined, 'en')).toMatchObject({ text: '3', align: 'r' });
    expect(displayValue(Infinity, undefined, 'en')).toMatchObject({ text: '#NUM!' });
    expect(displayValue({ e: '#DIV/0!' }, undefined, 'en')).toMatchObject({
      text: '#DIV/0!',
      error: 'Division by zero',
    });
    expect(displayValue({ rows: [[7, 8]] }, undefined, 'en')).toMatchObject({ text: '7' });
    expect(formatNumber(0.1 + 0.2, undefined, 'en')).toBe('0.3');
  });
});

describe('TEXT format codes', () => {
  it.each([
    [1234.567, '0.00', '1234.57'],
    [1234.567, '#,##0', '1,235'],
    [1234.567, '#,##0.00', '1,234.57'],
    [0.256, '0%', '26%'],
    [0.256, '0.0%', '25.6%'],
    [1234.5, '£#,##0.00', '£1,234.50'],
    [1234.5, '0.00E+00', '1.23E+03'],
    [5, '000', '005'],
    [0.5, '#.##', '.5'],
    [3, '0.0#', '3.0'],
    [3.14159, '0.0#', '3.14'],
    [1500000, '0.0,,"M"', '1.5M'],
    [-5, '0;(0)', '(5)'],
    [-5, '0.00', '-5.00'],
    [0, '0;-0;"zero"', 'zero'],
    [12, '0 "units"', '12 units'],
    [46303, 'dd/mm/yyyy', '08/10/2026'],
    [46303, 'mmm yyyy', 'Oct 2026'],
    [46303, 'dddd d mmmm yy', 'Thursday 8 October 26'],
    [46303, 'mmmmm', 'O'],
    [46303.6, 'hh:mm', '14:24'],
    [46303.6, 'h:mm AM/PM', '2:24 PM'],
    [46303.25, 'h:mm a/p', '6:00 A'],
    [1.5, '[h]:mm', '36:00'],
    [0.5, '[mm]:ss', '720:00'],
    [0.5, '[ss]', '43200'],
    [46303.6, 'hh:mm:ss.00', '14:24:00.00'],
    [1234.5, 'General', '1234.5'],
    [46303, '[Red]0', '46303'],
    [1, '\\$0_)', '$1 '],
    [1, '*-0', '1'],
  ])('%s with %s is %s', (n, code, out) => {
    expect(textFormat(n, code)).toBe(out);
  });
  it('formats text with @', () => {
    expect(textFormat('Bob', '"Name: "@')).toBe('Name: Bob');
    expect(textFormat('Bob', '0;0;0;"<"@">"')).toBe('<Bob>');
    expect(textFormat('Bob', '0.00')).toBe('Bob');
    expect(textFormat(5, '')).toBe('5');
  });
});
