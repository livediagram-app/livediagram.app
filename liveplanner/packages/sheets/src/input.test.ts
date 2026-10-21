import { describe, expect, it } from 'vitest';
import { localeSeparators, parseLocaleNumber, parsePlainNumber, readLiteralInput } from './input';
import { serialFromDate, serialFromParts } from './dates';

const gb = (t: string, asText = false) => readLiteralInput(t, 'en-GB', asText);

describe('readLiteralInput', () => {
  it.each([
    ['12', { n: 12 }, undefined],
    ['-3.5', { n: -3.5 }, undefined],
    ['1,234.5', { n: 1234.5 }, undefined],
    ['1.2e3', { n: 1200 }, undefined],
    ['12%', { n: 0.12 }, { nf: 'percent' }],
    ['£12', { n: 12 }, { nf: 'currency', cur: '£' }],
    ['$1,200.50', { n: 1200.5 }, { nf: 'currency', cur: '$' }],
    ['-£4', { n: -4 }, { nf: 'currency', cur: '£' }],
    ['€3', { n: 3 }, { nf: 'currency', cur: '€' }],
    ['TRUE', { b: true }, undefined],
    ['false', { b: false }, undefined],
    ['8/10/2026', { n: serialFromDate(2026, 10, 8) }, { nf: 'date' }],
    ['2026-10-08', { n: serialFromDate(2026, 10, 8) }, { nf: 'date' }],
    ['8 Oct 2026', { n: serialFromDate(2026, 10, 8) }, { nf: 'date' }],
    ['October 8, 2026', { n: serialFromDate(2026, 10, 8) }, { nf: 'date' }],
    ['14:30', { n: 14.5 / 24 }, { nf: 'time' }],
    ['2:30 pm', { n: 14.5 / 24 }, { nf: 'time' }],
    ['2026-10-08 14:30', { n: serialFromParts(2026, 10, 8, 14, 30) }, { nf: 'datetime' }],
    ["'0012", { s: '0012' }, undefined],
    ['hello', { s: 'hello' }, undefined],
    ['1,2', { s: '1,2' }, undefined],
    ['£5%', { s: '£5%' }, undefined],
    ['31/02/2026', { s: '31/02/2026' }, undefined],
  ])('%s', (typed, input, hint) => {
    const r = gb(typed);
    expect(r.kind).toBe('value');
    if (r.kind === 'value') {
      expect(r.input).toEqual(input);
      expect(r.hint).toEqual(hint);
    }
  });
  it('reads day and month in the locale order', () => {
    const us = readLiteralInput('8/10/2026', 'en-US');
    expect(us.kind === 'value' && us.input).toEqual({ n: serialFromDate(2026, 8, 10) });
  });
  it('clears on empty and keeps Plain Text as typed', () => {
    expect(gb('   ').kind).toBe('clear');
    expect(gb(' 12 ', true)).toEqual({ kind: 'value', input: { s: ' 12 ' } });
    expect(gb('', true).kind).toBe('clear');
  });
  it('reads other locales', () => {
    expect(localeSeparators('de-DE')).toEqual({ group: '.', decimal: ',' });
    expect(parseLocaleNumber('1.234,5', 'de-DE')).toBe(1234.5);
    expect(parseLocaleNumber('1 234,5', 'fr-FR')).toBe(1234.5);
    expect(localeSeparators('xx-invalid-!!')).toEqual({ group: ',', decimal: '.' });
  });
  it('reads plain numbers', () => {
    expect(parsePlainNumber(' 3 ')).toBe(3);
    expect(parsePlainNumber('.5')).toBe(0.5);
    expect(parsePlainNumber('1,000')).toBeNull();
    expect(parsePlainNumber('1e999')).toBeNull();
  });
});
