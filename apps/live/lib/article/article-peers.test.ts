import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { ArticleBlock } from '@livediagram/document';
import { blocksToDoc } from './article-convert';
import { articlePeersKey, articlePeersPlugin, onlyPeers, setArticlePeers } from './article-peers';
import type { ArticlePeerCaret } from './article-carets-store';

// docs/specs/007-editor/article-pages.md "Collaboration": a collaborator's caret in their colour,
// and a bar beside the block they are in, brought in without touching the writing.

const blocks: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', runs: [{ text: 'First' }] },
  { id: 'b', type: 'paragraph', runs: [{ text: 'Second' }] },
  { id: 'd', type: 'divider' },
];
const ann: ArticlePeerCaret = {
  id: 'ann',
  name: 'Ann',
  color: '#f00',
  blockId: 'b',
  offset: 3,
  fresh: true,
};

const fresh = () => EditorState.create({ doc: blocksToDoc(blocks), plugins: [articlePeersPlugin] });
const decos = (state: EditorState) => articlePeersKey.getState(state)!.decorations.find();

describe('the peers plugin', () => {
  it('draws a caret at the offset and a bar on its block, changing no text', () => {
    const state = fresh();
    const tr = setArticlePeers(state, [ann]);
    expect(onlyPeers(tr)).toBe(true);
    expect(tr.getMeta('addToHistory')).toBe(false);
    const next = state.apply(tr);
    expect(next.doc).toBe(state.doc);
    const found = decos(next);
    // Block `b` starts after `a` (7): its text from 8, three characters in.
    expect(found.map((d) => [d.from, d.to])).toEqual([
      [7, 15],
      [11, 11],
    ]);
  });

  it('keeps one bar per block, and a bar alone beside a block with no text', () => {
    const state = fresh();
    const bob = { ...ann, id: 'bob', color: '#00f', offset: 0 };
    const zed = { ...ann, id: 'zed', blockId: 'd', offset: 0 };
    const found = decos(state.apply(setArticlePeers(state, [ann, bob, zed])));
    expect(found).toHaveLength(4);
  });

  it('follows its block through a change typed above it, and drops a gone block', () => {
    let state = fresh();
    state = state.apply(setArticlePeers(state, [ann]));
    state = state.apply(state.tr.insertText('More ', 1));
    expect(decos(state).map((d) => d.from)).toEqual([12, 16]);
    state = state.apply(state.tr.delete(12, 20));
    expect(decos(state)).toEqual([]);
  });

  it('counts a selection change as more than carets', () => {
    const state = fresh();
    const tr = setArticlePeers(state, [ann]).setSelection(TextSelection.create(state.doc, 3));
    expect(onlyPeers(tr)).toBe(false);
  });
});
