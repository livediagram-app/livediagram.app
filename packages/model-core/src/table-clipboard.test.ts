import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { isTabularClipboard, parseClipboardTableText } from './table-clipboard';

describe('parseClipboardTableText', () => {
  it('splits TSV into a row-major grid and drops the trailing blank line', () => {
    expect(parseClipboardTableText('a\tb\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseClipboardTableText('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseClipboardTableText('a\rb')).toEqual([['a'], ['b']]);
    expect(parseClipboardTableText('')).toEqual([['']]);
  });

  it('tells one value from a tabular paste', () => {
    expect(parseClipboardTableText('hello')).toEqual([['hello']]);
    expect(isTabularClipboard([['hello']])).toBe(false);
    expect(isTabularClipboard([])).toBe(false);
    expect(isTabularClipboard([['a', 'b']])).toBe(true);
    expect(isTabularClipboard([['a'], ['b']])).toBe(true);
  });
});

// A spreadsheet quotes a cell that holds a line break, a tab or a quote, doubling its quotes. Split on every
// newline, a two-line cell became two rows and shifted every row under it.
describe('parseClipboardTableText quoted cells', () => {
  it('reads a quoted cell as one cell', () => {
    expect(parseClipboardTableText('"Line 1\nLine 2"\tB\r\nC\tD\r\n')).toEqual([
      ['Line 1\nLine 2', 'B'],
      ['C', 'D'],
    ]);
    expect(parseClipboardTableText('"He said ""hi"""\t"a\tb"')).toEqual([['He said "hi"', 'a\tb']]);
  });

  it('keeps a quote that does not close a cell as text', () => {
    expect(parseClipboardTableText('5" pipe\t"x\n"y')).toEqual([['5" pipe', '"x'], ['"y']]);
    expect(parseClipboardTableText('"open\tb')).toEqual([['"open', 'b']]);
    expect(parseClipboardTableText('"a"b\tc')).toEqual([['"a"b', 'c']]);
  });

  it('stays linear on quotes that never close', () => {
    const text = '"' + '\t""'.repeat(200_000);
    const ms = cpuMsOf(() => parseClipboardTableText(text));
    expect(ms).toBeLessThan(cpuBudgetMs(150));
  });
});
