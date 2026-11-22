import { describe, expect, it } from 'vitest';
import { csvToMarkdownTable, parseCsv } from './csv';

describe('parseCsv', () => {
  it('reads quoted fields with commas, line breaks and doubled quotes', () => {
    expect(parseCsv('Name,Note\r\n"Doe, Jane","She said ""hi""\nthen left"\n\nLast,\n')).toEqual([
      ['Name', 'Note'],
      ['Doe, Jane', 'She said "hi"\nthen left'],
      ['Last', ''],
    ]);
  });
});

describe('csvToMarkdownTable', () => {
  it('writes a pipe table, the first row its header', () => {
    expect(csvToMarkdownTable('Name,Status\nA | B,"Done\nsoon"\nShort\nLong,x,extra')).toBe(
      [
        '| Name | Status |',
        '| --- | --- |',
        '| A \\| B | Done soon |',
        '| Short |  |',
        '| Long | x |',
      ].join('\n'),
    );
  });

  it('answers nothing for an empty file', () => {
    expect(csvToMarkdownTable('\n')).toBe('');
  });
});
