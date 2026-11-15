// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTICLE_HOLD_REFRESH_MS, type RoomOp } from '@livedocuments/api-schema';
import {
  getLocalArticleHold,
  noteArticleCaret,
  noteArticleTyping,
  receiveArticleHold,
  resetArticleHoldsForTests,
  subscribeArticleHoldAnswers,
  syncArticleHolders,
  type ArticleHoldAnswer,
} from '@/lib/article/article-holds-store';
import { useArticleHoldBroadcast } from './useArticleHoldBroadcast';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": a claim through `sequence`, so the room's answer
// settles it; the same claim said again while typing; a release when we let go; nothing while the room is closed.

function setup(opts: { live?: boolean; sequence?: boolean; answer?: boolean } = {}) {
  const sent: RoomOp[] = [];
  const sequenced: RoomOp[] = [];
  let settle: (ok: boolean) => void = () => {};
  const room = {
    send: (msg: { kind: string; op?: unknown }) => void sent.push(msg.op as RoomOp),
    ...(opts.sequence === false
      ? {}
      : {
          sequence: (op: RoomOp) => {
            sequenced.push(op);
            return new Promise<boolean>((resolve) => {
              settle = resolve;
            });
          },
        }),
  };
  const roomRef = { current: room };
  const hook = renderHook(
    (p: { live: boolean; activeId: string }) => useArticleHoldBroadcast({ roomRef, ...p }),
    { initialProps: { live: opts.live ?? true, activeId: 't' } },
  );
  const answers: ArticleHoldAnswer[] = [];
  subscribeArticleHoldAnswers((a) => answers.push(a));
  return { sent, sequenced, hook, answers, settle: (ok: boolean) => settle(ok), roomRef };
}

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => {
  resetArticleHoldsForTests();
  vi.useRealTimers();
});

describe('useArticleHoldBroadcast', () => {
  it('sends a claim to be answered, says it again while typing, and lets go', async () => {
    const { sent, sequenced, answers, settle } = setup();
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    expect(sequenced).toEqual([{ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b' }]);
    await act(async () => settle(true));
    expect(answers).toEqual([{ flow: 'f', spot: { blockId: 'b' }, granted: true }]);
    act(() => {
      vi.advanceTimersByTime(ARTICLE_HOLD_REFRESH_MS);
      noteArticleTyping('f', { blockId: 'b' });
    });
    expect(sent).toEqual([{ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b' }]);
    act(() => noteArticleCaret('f', { blockId: 'c' }));
    expect(sent.at(-1)).toEqual({ kind: 'article-hold', tabId: 't', flow: null });
  });

  it('settles a claim the room gave to someone else as refused', async () => {
    const { answers, settle } = setup();
    syncArticleHolders([{ id: 'ann', name: 'Ann', color: '#f00' }]);
    act(() => noteArticleTyping('f', { blockId: 'b', row: 'r', col: 'c' }));
    receiveArticleHold('ann', { tabId: 't', flow: 'f', blockId: 'b', row: 'r', col: 'c' });
    await act(async () => settle(true));
    expect(answers[0]).toMatchObject({ granted: false, holder: 'Ann' });
  });

  it('takes a claim as ours when the room has no answer to give', () => {
    const { sent, answers } = setup({ sequence: false });
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    expect(sent).toEqual([{ kind: 'article-hold', tabId: 't', flow: 'f', blockId: 'b' }]);
    expect(answers[0]).toMatchObject({ granted: true });
  });

  it('sends nothing while the room is closed, and our claims are ours at once', () => {
    const { sent, sequenced } = setup({ live: false });
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    expect(getLocalArticleHold()!.state).toBe('granted');
    expect([...sent, ...sequenced]).toEqual([]);
  });

  it('lets go when the tab changes or it unmounts, telling the room only of a hold it heard', () => {
    const { sent, hook } = setup();
    hook.rerender({ live: true, activeId: 'u' });
    expect(sent).toEqual([]);
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    hook.rerender({ live: true, activeId: 'v' });
    expect(sent).toEqual([{ kind: 'article-hold', tabId: 'u', flow: null }]);
    expect(getLocalArticleHold()).toBeNull();
    act(() => noteArticleTyping('f', { blockId: 'b' }));
    hook.unmount();
    expect(sent.at(-1)).toEqual({ kind: 'article-hold', tabId: 'v', flow: null });
  });
});
