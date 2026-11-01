import { describe, expect, it } from 'vitest';
import { Slice } from 'prosemirror-model';
import { blocksToDoc } from './article-convert';
import { cardPasteSlice } from './article-card-paste';

// docs/specs/007-editor/flashcards.md "Text only": a paste onto a card keeps the text, a table as a list.
const sliceOf = (...blocks: Parameters<typeof blocksToDoc>[0]) =>
  new Slice(blocksToDoc(blocks).content, 0, 0);
const kinds = (s: Slice) => {
  const out: string[] = [];
  s.content.forEach((n) => out.push(`${n.type.name}:${n.textContent}`));
  return out;
};

describe('cardPasteSlice', () => {
  it('makes a pasted table a list, a row an item, and leaves a page break out', () => {
    const { slice, cut } = cardPasteSlice(
      sliceOf(
        { id: 'h', type: 'paragraph', style: 'h2', runs: [{ text: 'Heading' }] },
        {
          id: 't',
          type: 'table',
          cols: [
            { id: 'c1', w: 1 },
            { id: 'c2', w: 1 },
          ],
          rows: [
            { id: 'r1', cells: [[{ text: 'a' }], [{ text: 'b' }]] },
            { id: 'r2', cells: [[{ text: 'c' }], [{ text: 'd' }]] },
          ],
        },
        { id: 'pb', type: 'pageBreak' },
        { id: 'p', type: 'paragraph', runs: [{ text: 'after' }] },
      ),
    );
    expect(cut).toBe(true);
    expect(kinds(slice)).toEqual([
      'paragraph:Heading',
      'list_item:a · b',
      'list_item:c · d',
      'paragraph:after',
    ]);
  });

  it('hands back text alone untouched', () => {
    const s = sliceOf(
      { id: 'p', type: 'paragraph', runs: [{ text: 'one' }] },
      { id: 'l', type: 'list', list: 'bullet', runs: [{ text: 'two' }] },
    );
    expect(cardPasteSlice(s)).toEqual({ slice: s, cut: false });
  });
});
