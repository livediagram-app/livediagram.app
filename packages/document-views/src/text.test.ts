import { describe, expect, it } from 'vitest';
import { attrValue, cellText, cutAtWord, jsonString } from './text';

describe('cutAtWord (R10)', () => {
  it('keeps text within the limit whole', () => {
    expect(cutAtWord('Orders service', 60)).toEqual({ kept: 'Orders service', cut: false });
  });

  it('cuts back to the last whitespace when the limit splits a word', () => {
    const note = 'Kong. Terminates TLS, rate-limits per API key, and routes by path.';
    expect(cutAtWord(note, 48)).toEqual({
      kept: 'Kong. Terminates TLS, rate-limits per API key,',
      cut: true,
    });
  });

  it('keeps a whole word that ends exactly at the limit', () => {
    expect(cutAtWord('abc def ghi', 7)).toEqual({ kept: 'abc def', cut: true });
  });

  it('cuts hard without whitespace, and counts code points not code units', () => {
    expect(cutAtWord('abcdefghij', 4)).toEqual({ kept: 'abcd', cut: true });
    expect(cutAtWord('😀😀😀😀😀', 3)).toEqual({ kept: '😀😀😀', cut: true });
  });

  it('cuts hard when the only whitespace leads', () => {
    expect(cutAtWord(' abcdefgh', 4)).toEqual({ kept: ' abc', cut: true });
  });
});

describe('jsonString', () => {
  it('quotes and escapes, with … outside the quote when cut', () => {
    expect(jsonString('say "hi"\nthen →')).toBe('"say \\"hi\\"\\nthen →"');
    expect(jsonString('one two three', 8)).toBe('"one two"…');
    expect(jsonString('short', 8)).toBe('"short"');
  });
});

describe('attrValue', () => {
  it('prints URL-safe values bare and the rest quoted', () => {
    expect(attrValue('https://stripe.com/docs/api?x=1#y')).toBe(
      'https://stripe.com/docs/api?x=1#y',
    );
    expect(attrValue('credit-card')).toBe('credit-card');
    expect(attrValue('two words')).toBe('"two words"');
    expect(attrValue('')).toBe('""');
    expect(attrValue('a"b')).toBe('"a\\"b"');
  });
});

describe('cellText', () => {
  it('escapes JSON and pipes', () => {
    expect(cellText('p99 | p50')).toBe('p99 \\| p50');
    expect(cellText('two\nlines "q"')).toBe('two\\nlines \\"q\\"');
  });

  it('escapes ; and } inside entity braces', () => {
    expect(cellText('a;b}', true)).toBe('a\\;b\\}');
    expect(cellText('a;b}')).toBe('a;b}');
  });
});
