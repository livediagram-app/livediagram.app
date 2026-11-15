// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleBlock, ArticleFlow } from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from '@/lib/article/article-convert';
import { articleHoldsKey, articleHoldsPlugin } from '@/lib/article/article-holds';
import {
  answerArticleClaim,
  getLocalArticleHold,
  noteArticleTyping,
  receiveArticleHold,
  resetArticleHoldsForTests,
  setArticleHoldsLive,
  setArticleHoldsTab,
  syncArticleHolders,
} from '@/lib/article/article-holds-store';
import {
  resetArticleHeldNoticeForTests,
  setArticleHeldToast,
} from '@/lib/article/article-hold-notice';
import { useWritingHolds } from './useWritingHolds';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": collaborators' holds reach the writing, a given
// claim commits what waited, and a refused one puts the block back with a notice naming the writer.

const blocks: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', runs: [{ text: 'First' }] },
  { id: 'b', type: 'paragraph', runs: [{ text: 'Second' }] },
];

function setup() {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [articleHoldsPlugin(() => {})] }),
  });
  const viewRef = { current: view };
  const committed = { current: { blocks } as ArticleFlow };
  const scheduleCommit = vi.fn();
  const hook = renderHook(() => useWritingHolds({ flow: 'f', viewRef, committed, scheduleCommit }));
  return { view, committed, scheduleCommit, hook };
}

afterEach(() => {
  resetArticleHoldsForTests();
  resetArticleHeldNoticeForTests();
});

describe('useWritingHolds', () => {
  it('brings collaborators’ holds in this article into the writing', () => {
    setArticleHoldsTab('t');
    syncArticleHolders([{ id: 'ann', name: 'Ann', color: '#f00' }]);
    const { view } = setup();
    act(() => receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' }));
    expect(articleHoldsKey.getState(view.state)!.holds).toEqual([
      { id: 'ann', name: 'Ann', color: '#f00', blockId: 'b' },
    ]);
  });

  it('commits once our claim is given, and leaves other articles’ answers alone', () => {
    const { scheduleCommit } = setup();
    setArticleHoldsLive(true);
    act(() => noteArticleTyping('g', { blockId: 'b' }));
    act(() => answerArticleClaim(getLocalArticleHold()!.seq, true));
    expect(scheduleCommit).not.toHaveBeenCalled();
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    act(() => answerArticleClaim(getLocalArticleHold()!.seq, true));
    expect(scheduleCommit).toHaveBeenCalledTimes(1);
  });

  it('puts a block given to someone else back as it was, naming them', () => {
    setArticleHoldsTab('t');
    syncArticleHolders([{ id: 'ann', name: 'Ann', color: '#f00' }]);
    const toast = vi.fn();
    setArticleHeldToast(toast);
    const { view, committed } = setup();
    setArticleHoldsLive(true);
    act(() => view.dispatch(view.state.tr.insertText(' by Bob', 14)));
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    act(() => receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' }));
    act(() => answerArticleClaim(getLocalArticleHold()!.seq, true));
    expect(docToBlocks(view.state.doc, committed.current.blocks)).toBe(committed.current.blocks);
    expect(toast).toHaveBeenCalledWith('Ann is writing in this paragraph.');
    // A refusal with nothing of ours in the block changes nothing in it.
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    act(() => answerArticleClaim(getLocalArticleHold()!.seq, true));
    expect(docToBlocks(view.state.doc, committed.current.blocks)).toBe(committed.current.blocks);
  });

  it('does nothing once the writing is gone', () => {
    const { scheduleCommit, hook } = setup();
    hook.unmount();
    setArticleHoldsLive(true);
    noteArticleTyping('f', { blockId: 'b' });
    answerArticleClaim(getLocalArticleHold()!.seq, true);
    expect(scheduleCommit).not.toHaveBeenCalled();
  });
});
