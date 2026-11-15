// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ARTICLE_HOLD_EXPIRE_MS,
  ARTICLE_HOLD_IDLE_MS,
  ARTICLE_HOLD_REFRESH_MS,
} from '@livedocuments/api-schema';
import {
  answerArticleClaim,
  articleHoldsOf,
  getLocalArticleHold,
  noteArticleCaret,
  noteArticleTyping,
  pendingArticleHoldBlock,
  receiveArticleHold,
  releaseArticleHold,
  resetArticleHolds,
  resetArticleHoldsForTests,
  setArticleHoldsLive,
  setArticleHoldsTab,
  subscribeArticleHoldAnswers,
  subscribeLocalArticleHold,
  syncArticleHolders,
  useArticleHolds,
  type ArticleHoldAnswer,
  type LocalHoldChange,
} from './article-holds-store';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": our hold claimed while typing and let go on
// leaving, idling or losing the caret; collaborators' holds named, scoped to the tab, and gone when they let go,
// leave or fall silent.

const people = [
  { id: 'ann', name: 'Ann', color: '#f00' },
  { id: 'bob', name: 'Bob', color: '#00f' },
];

function listen() {
  const changes: LocalHoldChange[] = [];
  const answers: ArticleHoldAnswer[] = [];
  subscribeLocalArticleHold((c) => changes.push(c));
  subscribeArticleHoldAnswers((a) => answers.push(a));
  return { changes, answers };
}

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  setArticleHoldsTab('t');
});
afterEach(() => {
  resetArticleHoldsForTests();
  vi.useRealTimers();
});

describe('our hold', () => {
  it('claims the block we type in, waits on the room while it is open, and keeps it as we go on', () => {
    setArticleHoldsLive(true);
    const { changes, answers } = listen();
    noteArticleTyping('f', { blockId: 'b' });
    expect(getLocalArticleHold()).toMatchObject({ flow: 'f', spot: { blockId: 'b' }, state: 'pending' });
    expect(pendingArticleHoldBlock('f')).toBe('b');
    expect(pendingArticleHoldBlock('g')).toBeNull();
    noteArticleTyping('f', { blockId: 'b' });
    expect(changes).toEqual(['claim']);
    answerArticleClaim(getLocalArticleHold()!.seq, true);
    expect(answers).toEqual([{ flow: 'f', spot: { blockId: 'b' }, granted: true }]);
    expect(pendingArticleHoldBlock('f')).toBeNull();
    // Said again while we type, at most every refresh.
    vi.advanceTimersByTime(ARTICLE_HOLD_REFRESH_MS - 1);
    noteArticleTyping('f', { blockId: 'b' });
    expect(changes).toEqual(['claim']);
    vi.advanceTimersByTime(1);
    noteArticleTyping('f', { blockId: 'b' });
    expect(changes).toEqual(['claim', 'refresh']);
  });

  it('is ours at once while the room is closed, and a claim waiting when it closes becomes ours', () => {
    const { answers } = listen();
    noteArticleTyping('f', { blockId: 'b' });
    expect(getLocalArticleHold()!.state).toBe('granted');
    // Never said again with nobody to tell.
    vi.advanceTimersByTime(ARTICLE_HOLD_REFRESH_MS);
    noteArticleTyping('f', { blockId: 'b' });
    setArticleHoldsLive(true);
    noteArticleTyping('f', { blockId: 'c' });
    setArticleHoldsLive(false);
    expect(answers.at(-1)).toEqual({ flow: 'f', spot: { blockId: 'c' }, granted: true });
  });

  it('goes to whoever the room gave it to: a collaborator’s hold on the spot arrived before the answer', () => {
    setArticleHoldsLive(true);
    syncArticleHolders(people);
    const { answers, changes } = listen();
    noteArticleTyping('f', { blockId: 'b', row: 'r', col: 'c' });
    const { seq } = getLocalArticleHold()!;
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b', row: 'r', col: 'c' });
    answerArticleClaim(seq, true);
    expect(answers).toEqual([
      { flow: 'f', spot: { blockId: 'b', row: 'r', col: 'c' }, granted: false, holder: 'Ann' },
    ]);
    expect(getLocalArticleHold()).toBeNull();
    // Nothing to release: the room never gave it to us.
    expect(changes).toEqual(['claim']);
    // An answer for a claim that is gone, or already answered, changes nothing.
    answerArticleClaim(seq, true);
    expect(answers).toHaveLength(1);
  });

  it('names someone the roster does not know yet as Someone', () => {
    setArticleHoldsLive(true);
    const { answers } = listen();
    noteArticleTyping('f', { blockId: 'b' });
    receiveArticleHold('zed', { tabId: 't', flow: 'f', blockId: 'b' });
    answerArticleClaim(getLocalArticleHold()!.seq, true);
    expect(answers[0]).toMatchObject({ granted: false, holder: 'Someone' });
  });

  it('takes an unconfirmed answer as ours, and a claim on another tab’s hold as free', () => {
    setArticleHoldsLive(true);
    syncArticleHolders(people);
    const { answers } = listen();
    receiveArticleHold('ann', { tabId: 'other', flow: 'f', blockId: 'b' });
    noteArticleTyping('f', { blockId: 'b' });
    answerArticleClaim(getLocalArticleHold()!.seq, false);
    expect(answers[0]).toMatchObject({ granted: true });
  });

  it('lets go when the caret leaves its block, the writing loses it, or nothing is typed for the idle time', () => {
    const { changes } = listen();
    noteArticleTyping('f', { blockId: 'b' });
    noteArticleCaret('f', { blockId: 'b' });
    noteArticleCaret('g', null);
    expect(getLocalArticleHold()).not.toBeNull();
    noteArticleCaret('f', { blockId: 'c' });
    expect(getLocalArticleHold()).toBeNull();
    noteArticleTyping('f', { blockId: 'b' });
    releaseArticleHold('g');
    expect(getLocalArticleHold()).not.toBeNull();
    releaseArticleHold('f');
    noteArticleTyping('f', { blockId: 'b' });
    vi.advanceTimersByTime(ARTICLE_HOLD_IDLE_MS - 1);
    noteArticleTyping('f', { blockId: 'b' });
    vi.advanceTimersByTime(ARTICLE_HOLD_IDLE_MS - 1);
    expect(getLocalArticleHold()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(getLocalArticleHold()).toBeNull();
    expect(changes).toEqual(['claim', 'release', 'claim', 'release', 'claim', 'release']);
    // Nothing held: nothing to let go, and typing nowhere a hold could be claims nothing.
    releaseArticleHold();
    noteArticleCaret('f', null);
    noteArticleTyping('f', null);
    expect(changes).toHaveLength(6);
  });
});

describe('collaborators’ holds', () => {
  it('lists each article’s holds on this tab from people known by name, kept until something changes', () => {
    syncArticleHolders(people);
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' });
    receiveArticleHold('bob', { tabId: 't', flow: 'g', blockId: 'x', row: 'r', col: 'c' });
    receiveArticleHold('zed', { tabId: 't', flow: 'f', blockId: 'z' });
    const list = articleHoldsOf('f');
    expect(list).toEqual([{ id: 'ann', name: 'Ann', color: '#f00', blockId: 'b' }]);
    expect(articleHoldsOf('f')).toBe(list);
    expect(articleHoldsOf('g')).toEqual([
      { id: 'bob', name: 'Bob', color: '#00f', blockId: 'x', row: 'r', col: 'c' },
    ]);
    // The same hold said again changes nothing; a move does.
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' });
    expect(articleHoldsOf('f')).toBe(list);
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'c' });
    expect(articleHoldsOf('f')).toEqual([{ id: 'ann', name: 'Ann', color: '#f00', blockId: 'c' }]);
    setArticleHoldsTab('other');
    expect(articleHoldsOf('f')).toEqual([]);
    setArticleHoldsTab('other');
  });

  it('drops a hold let go, or of someone who left, and renames one whose name changed', () => {
    syncArticleHolders(people);
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' });
    receiveArticleHold('bob', { tabId: 't', flow: 'f', blockId: 'c' });
    receiveArticleHold('ann', { tabId: 't', flow: null });
    receiveArticleHold('ann', { tabId: 't', flow: null });
    expect(articleHoldsOf('f').map((h) => h.id)).toEqual(['bob']);
    syncArticleHolders([{ id: 'bob', name: 'Robert', color: '#00f' }, people[0]!]);
    expect(articleHoldsOf('f')[0]!.name).toBe('Robert');
    syncArticleHolders([people[0]!]);
    expect(articleHoldsOf('f')).toEqual([]);
    syncArticleHolders([people[0]!]);
  });

  it('lets a hold not said again within the expiry go, a refreshed one stay', () => {
    syncArticleHolders(people);
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' });
    vi.advanceTimersByTime(ARTICLE_HOLD_EXPIRE_MS / 2);
    receiveArticleHold('bob', { tabId: 't', flow: 'f', blockId: 'c' });
    vi.advanceTimersByTime(ARTICLE_HOLD_EXPIRE_MS / 2);
    expect(articleHoldsOf('f').map((h) => h.id)).toEqual(['bob']);
    receiveArticleHold('bob', { tabId: 't', flow: 'f', blockId: 'c' });
    vi.advanceTimersByTime(ARTICLE_HOLD_EXPIRE_MS - 1);
    expect(articleHoldsOf('f').map((h) => h.id)).toEqual(['bob']);
    vi.advanceTimersByTime(1);
    expect(articleHoldsOf('f')).toEqual([]);
  });

  it('keeps nobody’s hold once the room closes, and renders the writing’s list', () => {
    syncArticleHolders(people);
    const { result } = renderHook(() => useArticleHolds('f'));
    expect(result.current).toEqual([]);
    act(() => receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b' }));
    expect(result.current).toHaveLength(1);
    act(() => resetArticleHolds());
    expect(result.current).toEqual([]);
  });
});
