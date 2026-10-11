// The Custom number format (docs/specs/029-sheets/sheet.md "Formatting"): a format code, as TEXT reads one.
import { describe, expect, it } from 'vitest';
import { formatCodeReads } from './format-codes';
import { displayValue } from './number-format';
import { validFormat, validFormatPatch } from './format';

describe('a custom format code', () => {
  it('reads codes people use, and refuses ones that cannot be read', () => {
    for (const code of [
      '0.00',
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
  it('is a format key a write may set', () => {
    expect(validFormat({ nf: 'custom', nc: '0.00' })).toBe(true);
    expect(validFormatPatch({ nc: '"open' })).toBe(false);
    expect(validFormatPatch({ nc: 5 })).toBe(false);
  });
});
