import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARTICLE_PEER_FRESH_MS,
  articlePeersOf,
  getLocalArticleCaret,
  receiveArticleCaret,
  resetArticleCaretsForTests,
  resetArticlePeers,
  setArticleCaretsTab,
  setLocalArticleCaret,
  subscribeLocalArticleCaret,
  syncArticlePeople,
} from './article-carets-store';

// docs/specs/007-editor/article-pages.md "Collaboration": each collaborator's caret, in their
// colour and by their name, in the article they are writing on the tab we are on, until they leave
// the writing or the room.

const ann = { id: 'ann', name: 'Ann', color: '#f00' };
const bob = { id: 'bob', name: 'Bob', color: '#00f' };

beforeEach(() => {
  vi.useFakeTimers();
  setArticleCaretsTab('t');
  syncArticlePeople([ann, bob]);
});
afterEach(() => {
  resetArticleCaretsForTests();
  vi.useRealTimers();
});

describe("collaborators' carets", () => {
  it('holds a caret by article, named and coloured, fresh while it has just moved', () => {
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 3 });
    expect(articlePeersOf('f')).toEqual([
      { id: 'ann', name: 'Ann', color: '#f00', blockId: 'b', offset: 3, fresh: true },
    ]);
    expect(articlePeersOf('other')).toEqual([]);
    vi.advanceTimersByTime(ARTICLE_PEER_FRESH_MS);
    expect(articlePeersOf('f')[0]?.fresh).toBe(false);
  });

  it('keeps the list by identity until something changes', () => {
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 3 });
    const first = articlePeersOf('f');
    expect(articlePeersOf('f')).toBe(first);
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 3 });
    expect(articlePeersOf('f')).toBe(first);
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 4 });
    expect(articlePeersOf('f')).not.toBe(first);
  });

  it('drops a caret on null, and the carets of anyone who left', () => {
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 0 });
    receiveArticleCaret('bob', { tabId: 't', flow: 'f', blockId: 'c', offset: 0 });
    receiveArticleCaret('ann', { tabId: 't', flow: null });
    expect(articlePeersOf('f').map((p) => p.id)).toEqual(['bob']);
    syncArticlePeople([ann]);
    expect(articlePeersOf('f')).toEqual([]);
  });

  it('follows a rename or a new colour', () => {
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 0 });
    syncArticlePeople([{ ...ann, name: 'Annie', color: '#0f0' }, bob]);
    expect(articlePeersOf('f')[0]).toMatchObject({ name: 'Annie', color: '#0f0' });
  });

  it('draws only carets on our tab, and none of someone not in the room', () => {
    receiveArticleCaret('ann', { tabId: 'other', flow: 'f', blockId: 'b', offset: 0 });
    receiveArticleCaret('zed', { tabId: 't', flow: 'f', blockId: 'b', offset: 0 });
    expect(articlePeersOf('f')).toEqual([]);
    setArticleCaretsTab('other');
    expect(articlePeersOf('f').map((p) => p.id)).toEqual(['ann']);
  });

  it('forgets everyone when the room closes', () => {
    receiveArticleCaret('ann', { tabId: 't', flow: 'f', blockId: 'b', offset: 0 });
    resetArticlePeers();
    syncArticlePeople([ann]);
    expect(articlePeersOf('f')).toEqual([]);
  });
});

describe('our caret', () => {
  it('is set by the writing that has it and cleared only by that writing', () => {
    const seen = vi.fn();
    const off = subscribeLocalArticleCaret(seen);
    setLocalArticleCaret('f', { blockId: 'b', offset: 2 });
    setLocalArticleCaret('f', { blockId: 'b', offset: 2 });
    expect(getLocalArticleCaret()).toEqual({ flow: 'f', blockId: 'b', offset: 2 });
    expect(seen).toHaveBeenCalledTimes(1);
    setLocalArticleCaret('g', null);
    expect(getLocalArticleCaret()).not.toBeNull();
    setLocalArticleCaret('f', null);
    expect(getLocalArticleCaret()).toBeNull();
    off();
  });
});
