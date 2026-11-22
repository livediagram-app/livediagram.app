import { describe, expect, it } from 'vitest';
import { bullet, code, divider, flowOf, para, runsPara, table } from './__fixtures__/writing';
import { blockText, writingText } from './writing-text';

describe('the plain text of writing', () => {
  it('reads runs, code and table cells, and nothing from blocks without words', () => {
    expect(blockText(para('Hello'))).toBe('Hello');
    expect(blockText(bullet('An item'))).toBe('An item');
    expect(blockText(code('const a = 1;'))).toBe('const a = 1;');
    expect(
      blockText(
        table([
          [[{ text: 'Region' }], [{ text: 'Owner' }]],
          [[{ text: 'EU' }], []],
        ]),
      ),
    ).toBe('Region\tOwner\nEU\t');
    expect(blockText(divider())).toBe('');
  });

  it('leaves a footnote reference out', () => {
    expect(
      blockText(runsPara([{ text: 'Fact' }, { text: '*', fn: 'A note' }, { text: '.' }])),
    ).toBe('Fact.');
  });

  it('joins a page a block a line, skipping the empty ones', () => {
    expect(
      writingText(flowOf(para('Title', 'title'), para(''), divider(), para(' Body '), code('x'))),
    ).toBe('Title\nBody\nx');
  });
});
