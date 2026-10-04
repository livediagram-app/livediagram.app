import { describe, expect, it } from 'vitest';
import { hasQuotes, isQuotedWord, tokeniseLine, unquotedPrefix, type Word } from './tokenise';

const words = (line: string): Word[] => {
  const out = tokeniseLine(line);
  if ('error' in out) throw new Error(out.error.expected);
  return out.words;
};
const values = (line: string) => words(line).map((w) => w.value);

describe('tokeniseLine', () => {
  it('splits on spaces and tabs, keeping columns and raw text', () => {
    expect(words('set  n3\tlabel=x')).toEqual([
      { value: 'set', segments: [{ text: 'set', quoted: false }], column: 1, raw: 'set' },
      { value: 'n3', segments: [{ text: 'n3', quoted: false }], column: 6, raw: 'n3' },
      {
        value: 'label=x',
        segments: [{ text: 'label=x', quoted: false }],
        column: 9,
        raw: 'label=x',
      },
    ]);
    expect(values('   ')).toEqual([]);
  });

  it('quotes, mid-word too, keeping which part was quoted', () => {
    const [, word] = words('set label="Sign in" "Orders service"');
    expect(word).toMatchObject({ value: 'label=Sign in', raw: 'label="Sign in"' });
    expect(word!.segments).toEqual([
      { text: 'label=', quoted: false },
      { text: 'Sign in', quoted: true },
    ]);
    expect(values(`a 'it is "raw" \\n' ""`)).toEqual(['a', 'it is "raw" \\n', '']);
  });

  it('reads escapes in double quotes', () => {
    expect(values('x "a\\"b\\\\c\\nd\\te"')).toEqual(['x', 'a"b\\c\nd\te']);
  });

  it("reads JSON's other escapes, so a JSON value reads as in JSON", () => {
    expect(values('x "caf\\u00e9 a\\/b \\b\\f\\r"')).toEqual(['x', 'café a/b \b\f\r']);
  });

  it('keeps # as text, so a hex reads', () => {
    expect(values('set n3 fill=#ff0000')).toEqual(['set', 'n3', 'fill=#ff0000']);
  });

  it('names the column of an unclosed quote or a bad escape', () => {
    expect(tokeniseLine('set label="Sign in')).toEqual({
      error: { column: 11, expected: 'a closing "' },
    });
    expect(tokeniseLine("x 'oops")).toEqual({ error: { column: 3, expected: "a closing '" } });
    expect(tokeniseLine('x "a\\qb"')).toEqual({
      error: { column: 5, expected: 'an escape: \\" \\\\ \\n \\t or \\uXXXX' },
    });
    expect(tokeniseLine('x "a\\')).toEqual({
      error: { column: 5, expected: 'an escape: \\" \\\\ \\n \\t or \\uXXXX' },
    });
  });
});

describe('word helpers', () => {
  const [plain, quoted, mixed] = words('label~pay "Pay" right-of:"Orders service"');

  it('find the unquoted prefix', () => {
    expect(unquotedPrefix(plain!)).toBe('label~pay');
    expect(unquotedPrefix(quoted!)).toBe('');
    expect(unquotedPrefix(mixed!)).toBe('right-of:');
  });

  it('tell a quoted label from a word with quotes', () => {
    expect([plain, quoted, mixed].map((w) => isQuotedWord(w!))).toEqual([false, true, false]);
    expect([plain, quoted, mixed].map((w) => hasQuotes(w!))).toEqual([false, true, true]);
  });
});
