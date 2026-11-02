import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { findDecorations, findHighlightKey, findHighlightPlugin } from './article-find-plugin';
import { clearFindHighlights, publishFindHighlights } from '@/lib/find/find-highlight-store';

// docs/specs/007-editor/find-and-replace.md "Highlights": the matches drawn over the writing, never in it.
const blocks: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', runs: [{ text: 'plan' }] },
  { id: 'b', type: 'paragraph', runs: [{ text: 'a plan' }] },
];
const doc = blocksToDoc(blocks);
const spans = (state: EditorState) =>
  findHighlightKey
    .getState(state)!
    .find()
    .map((d) => [
      d.from,
      d.to,
      (d as unknown as { type: { attrs: { class: string } } }).type.attrs.class,
    ]);

afterEach(() => clearFindHighlights());

describe('findDecorations', () => {
  it('marks each stretch at its block offsets, dropping blocks gone or now shorter', () => {
    const set = findDecorations(doc, [
      { blockId: 'a', from: 0, to: 4, mark: 'current' },
      { blockId: 'b', from: 2, to: 6, mark: 'held' },
      { blockId: 'gone', from: 0, to: 1, mark: 'match' },
      { blockId: 'a', from: 2, to: 9, mark: 'match' },
    ]);
    // Block a's text from 1; block b's (after a's six positions) from 7.
    expect(set.find().map((d) => [d.from, d.to])).toEqual([
      [1, 5],
      [9, 13],
    ]);
    expect(findDecorations(doc, [])).toBe(findDecorations(doc, []));
  });
});

describe('the find plugin', () => {
  it('draws the published matches of its flow, and maps them through typing', () => {
    publishFindHighlights({
      flows: new Map([['f1', [{ blockId: 'b', from: 2, to: 6, mark: 'match' }]]]),
      elements: new Map(),
    });
    const state = EditorState.create({ doc, plugins: [findHighlightPlugin(() => 'f1')] });
    expect(spans(state)).toEqual([[9, 13, 'find-match']]);
    // Typing ahead of the match moves it along.
    const typed = state.apply(state.tr.insertText('X', 1));
    expect(spans(typed)).toEqual([[10, 14, 'find-match']]);
    // A rebuild reads the store again.
    publishFindHighlights({
      flows: new Map([['f1', [{ blockId: 'a', from: 0, to: 4, mark: 'current' }]]]),
      elements: new Map(),
    });
    const rebuilt = state.apply(state.tr.setMeta(findHighlightKey, true));
    expect(spans(rebuilt)).toEqual([[1, 5, 'find-match-current']]);
    // A selection change keeps the same set.
    expect(findHighlightKey.getState(state.apply(state.tr))).toBe(findHighlightKey.getState(state));
  });

  it('redraws its view when its own flow changes, not another', () => {
    const state = EditorState.create({ doc, plugins: [findHighlightPlugin(() => 'f1')] });
    const plugin = state.plugins[0]!;
    const sent: boolean[] = [];
    const view = {
      get state() {
        return state;
      },
      dispatch: (tr: ReturnType<EditorState['tr']['setMeta']>) => {
        sent.push(tr.getMeta(findHighlightKey) === true && tr.getMeta('addToHistory') === false);
      },
    };
    const pv = plugin.spec.view!(view as never);
    publishFindHighlights({ flows: new Map([['f2', []]]), elements: new Map() });
    expect(sent).toEqual([]);
    publishFindHighlights({
      flows: new Map([['f1', [{ blockId: 'a', from: 0, to: 4, mark: 'match' }]]]),
      elements: new Map(),
    });
    expect(sent).toEqual([true]);
    pv.destroy!();
    clearFindHighlights();
    expect(sent).toEqual([true]);
  });
});
