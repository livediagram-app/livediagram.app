// The Custom number format (docs/specs/029-sheets/sheet.md "Formatting"): a format code, as TEXT reads one.
import { describe, expect, it } from 'vitest';
import { formatCodeReads } from './format-codes';
import { displayValue } from './number-format';
import { validFormat, validFormatPatch } from './format';

describe('a custom format code', () => {
  it('reads codes people use, and refuses ones that cannot be read', () => {
    for (const code of [
      '0.00',
      '\\[0\\]',
      '#,##0',
      '0%',
      '£#,##0.00',
      'dd/mm/yyyy',
      '[h]:mm:ss',
      '@',
      '0;(0);"zero";@',
    ])
      expect(formatCodeReads(code), code).toBe(true);
    for (const code of ['', '   ', '"open', '[h:mm', 'h]', '[[h]]', '0;0;0;0;0', 'x'.repeat(65)])
      expect(formatCodeReads(code), code).toBe(false);
  });
  it('draws a number and text the same in every locale', () => {
    const f = { nf: 'custom' as const, nc: '#,##0.0' };
    expect(displayValue(1234.56, f, 'de-DE')).toMatchObject({
      text: '1,234.6',
      align: 'r',
      kind: 'number',
    });
    expect(displayValue('hi', { nf: 'custom', nc: '"<"@">"' }, 'en-GB')).toMatchObject({
      text: '<hi>',
      align: 'l',
    });
    expect(displayValue('hi', { nf: 'custom' }, 'en-GB').text).toBe('hi');
  });
  it('hides the numbers of an empty section, as Excel does', () => {
    const draw = (v: number, nc: string) => displayValue(v, { nf: 'custom', nc }, 'en-GB').text;
    expect(draw(-5, ';;;')).toBe('');
    expect(draw(5, ';;;')).toBe('');
    expect(draw(-5, '0;;0')).toBe('');
    expect(draw(5, '0;;0')).toBe('5');
    expect(draw(0, '0;0;')).toBe('');
    expect(draw(-5, '0;(0)')).toBe('(5)');
    expect(draw(-5, '0')).toBe('-5');
  });
  it('rounds half away from zero, as ROUND and the Number format do', () => {
    const draw = (v: number, nc: string) => displayValue(v, { nf: 'custom', nc }, 'en-GB').text;
    expect(draw(1.005, '0.00')).toBe('1.01');
    expect(draw(2.675, '0.00')).toBe('2.68');
    expect(draw(-1.005, '0.00')).toBe('-1.01');
    expect(draw(0.125, '0.00')).toBe('0.13');
    expect(draw(1234567.891, '#,##0.00')).toBe('1,234,567.89');
  });
  it('is a format key a write may set', () => {
    expect(validFormat({ nf: 'custom', nc: '0.00' })).toBe(true);
    expect(validFormatPatch({ nc: '"open' })).toBe(false);
    expect(validFormatPatch({ nc: 5 })).toBe(false);
  });
});
