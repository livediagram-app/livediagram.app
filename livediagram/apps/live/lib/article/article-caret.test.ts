import { describe, expect, it } from 'vitest';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import type { ArticleBlock } from '@livediagram/document';
import { blocksToDoc } from './article-convert';
import { caretOf, resolveCaret } from './article-caret';

// docs/specs/007-editor/article-pages.md "Collaboration": a caret travels as its block's id and a
// character offset into that block's text, and lands in the same place in another copy.

const blocks: ArticleBlock[] = [
  { id: 't', type: 'paragraph', style: 'title', runs: [{ text: 'Hello' }] },
  // A line break inside: one character, as its stored `\n` is.
  { id: 'p', type: 'paragraph', runs: [{ text: 'ab' }, { text: 'c\nde', b: true }] },
  { id: 'd', type: 'divider' },
  { id: 'e', type: 'paragraph', runs: [] },
];
const doc = blocksToDoc(blocks);
const start = (id: string) => {
  let at = -1;
  doc.forEach((n, pos) => {
    if (n.attrs.id === id) at = pos;
  });
  return at;
};
const stateAt = (pos: number) =>
  EditorState.create({ doc, selection: TextSelection.create(doc, pos) });

describe('a caret by block and offset', () => {
  it('reads the block and the characters before the caret', () => {
    expect(caretOf(stateAt(start('t') + 1))).toEqual({ blockId: 't', offset: 0 });
    expect(caretOf(stateAt(start('t') + 4))).toEqual({ blockId: 't', offset: 3 });
    // After `ab`, `c` and the line break.
    expect(caretOf(stateAt(start('p') + 1 + 4))).toEqual({ blockId: 'p', offset: 4 });
    expect(caretOf(stateAt(start('e') + 1))).toEqual({ blockId: 'e', offset: 0 });
  });

  it('reads a selected block with no text as its start', () => {
    const state = EditorState.create({ doc, selection: NodeSelection.create(doc, start('d')) });
    expect(caretOf(state)).toEqual({ blockId: 'd', offset: 0 });
  });

  it('lands every offset back where it was read', () => {
    for (let pos = start('p') + 1; pos <= start('p') + 1 + 6; pos++) {
      const place = caretOf(stateAt(pos))!;
      expect(resolveCaret(doc, place)?.pos).toBe(pos);
    }
  });

  it('lands in the same block in a copy that differs elsewhere', () => {
    const other = blocksToDoc([
      { id: 'n', type: 'paragraph', runs: [{ text: 'A new block above' }] },
      ...blocks,
    ]);
    const at = resolveCaret(other, { blockId: 'p', offset: 2 })!;
    expect(other.textBetween(at.from + 1, at.pos!)).toBe('ab');
  });

  it('clamps an offset past the text to its end', () => {
    const at = resolveCaret(doc, { blockId: 't', offset: 99 })!;
    expect(at.pos).toBe(start('t') + 1 + 5);
    expect(at).toMatchObject({ from: start('t'), to: start('t') + 7 });
  });

  it('gives a block with no text only its place, and a gone block nothing', () => {
    expect(resolveCaret(doc, { blockId: 'd', offset: 0 })).toEqual({
      from: start('d'),
      to: start('d') + 1,
      pos: null,
    });
    expect(resolveCaret(doc, { blockId: 'gone', offset: 0 })).toBeNull();
  });
});
