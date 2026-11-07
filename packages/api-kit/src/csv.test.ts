import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from './csv';

describe('csv', () => {
  it('leaves a plain field alone', () => {
    expect(csvField('Budget 2026')).toBe('Budget 2026');
  });

  it('quotes a quote, a comma and a line break', () => {
    expect(csvField('a "b"')).toBe('"a ""b"""');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
  });

  it('opens a formula with an apostrophe', () => {
    for (const lead of ['=', '+', '-', '@', '\t']) expect(csvField(`${lead}1`)).toBe(`'${lead}1`);
    expect(csvField('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('ends every row with CRLF', () => {
    expect(toCsv([['a\nb', '+1'], ['c']])).toBe('"a\nb",\'+1\r\nc\r\n');
  });
});
