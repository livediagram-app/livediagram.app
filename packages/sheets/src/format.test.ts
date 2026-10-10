import { describe, expect, it } from 'vitest';
import {
  formatEquals,
  isBorder,
  mergeFormat,
  validFormat,
  validFormatPatch,
  validFormatValue,
} from './format';

describe('format validation', () => {
  it.each([
    ['nf', 'percent', true],
    ['nf', 'weird', false],
    ['dp', 2, true],
    ['dp', 11, false],
    ['dp', 1.5, false],
    ['cur', '£', true],
    ['cur', 'X', false],
    ['fc', '#aabbcc', true],
    ['fc', '#ABC', false],
    ['bg', 'red', false],
    ['ff', 'space-grotesk', true],
    ['ff', 'Lora', false],
    ['ff', '', false],
    ['ff', 'a'.repeat(33), false],
    ['ff', 3, false],
    ['fs', 13, true],
    ['fs', 15, true],
    ['fs', 5, false],
    ['fs', 97, false],
    ['fs', 12.5, false],
    ['ha', 'c', true],
    ['ha', 'x', false],
    ['va', 'm', true],
    ['va', 'x', false],
    ['wr', 'w', true],
    ['wr', 'x', false],
    ['b', true, true],
    ['b', false, false],
    ['bt', { w: 1, s: 'solid', c: '#000000' }, true],
    ['bt', { w: 4, s: 'solid', c: '#000000' }, false],
    ['bt', { w: 1, s: 'solid', c: '#000000', x: 1 }, false],
    ['bt', null, false],
    ['zz', 1, false],
  ])('%s = %j is %s', (k, v, ok) => {
    expect(validFormatValue(k, v)).toBe(ok);
  });
  it('checks patches and whole formats', () => {
    expect(validFormatPatch({ b: true, fc: null })).toBe(true);
    expect(validFormatPatch({ nope: true })).toBe(false);
    expect(validFormatPatch([])).toBe(false);
    expect(validFormatPatch(null)).toBe(false);
    expect(validFormatPatch({ b: 'yes' })).toBe(false);
    expect(validFormat({ b: true })).toBe(true);
    expect(validFormat({ b: null })).toBe(false);
    expect(isBorder('x')).toBe(false);
  });
});

describe('mergeFormat', () => {
  it('sets, clears and empties', () => {
    expect(mergeFormat(undefined, { b: true })).toEqual({ b: true });
    expect(mergeFormat({ b: true, i: true }, { b: null })).toEqual({ i: true });
    expect(mergeFormat({ b: true }, { b: null })).toBeUndefined();
    expect(mergeFormat({ b: true }, null)).toBeUndefined();
    expect(formatEquals({ b: true }, { b: true })).toBe(true);
    expect(formatEquals(undefined, {})).toBe(true);
  });
});

describe('font size steps', () => {
  it('steps through the presets, kept within the limits', async () => {
    const { stepFontSize, FONT_SIZE_MIN, FONT_SIZE_MAX } = await import('./format');
    expect([
      stepFontSize(10, 1),
      stepFontSize(10, -1),
      stepFontSize(15, 1),
      stepFontSize(15, -1),
    ]).toEqual([11, 9, 16, 14]);
    expect([stepFontSize(72, 1), stepFontSize(8, -1)]).toEqual([FONT_SIZE_MAX, FONT_SIZE_MIN]);
  });
});
