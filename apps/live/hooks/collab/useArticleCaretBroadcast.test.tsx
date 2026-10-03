// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  articlePeersOf,
  receiveArticleCaret,
  resetArticleCaretsForTests,
  setLocalArticleCaret,
  syncArticlePeople,
} from '@/lib/article/article-carets-store';
import { useArticleCaretBroadcast } from './useArticleCaretBroadcast';
import { BROADCAST_THROTTLE_MS } from './useEditorBroadcast';

// docs/specs/007-editor/article-pages.md "Collaboration": where we are writing goes to the room as
// presence at the cursor's rate, the last place always following, and a null when the writing loses
// the caret; nothing while the room is closed or a hide-cursors vote runs.

function setup(initial: { live?: boolean; hidden?: boolean; activeId?: string } = {}) {
  const sent: unknown[] = [];
  const roomRef = { current: { send: (msg: unknown) => sent.push(msg) } };
  const hook = renderHook(
    (p: { live: boolean; hidden: boolean; activeId: string }) =>
      useArticleCaretBroadcast({ roomRef, ...p }),
    { initialProps: { live: true, hidden: false, activeId: 't', ...initial } },
  );
  return { sent, ops: () => sent.map((m) => (m as { op: unknown }).op), hook };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  resetArticleCaretsForTests();
  vi.useRealTimers();
});

describe('useArticleCaretBroadcast', () => {
  it('sends the caret, throttled with the last place following, then null on leaving', () => {
    const { ops } = setup();
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 1 }));
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 2 }));
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 3 }));
    expect(ops()).toEqual([
      { kind: 'article-caret', tabId: 't', flow: 'f', blockId: 'b', offset: 1 },
    ]);
    act(() => vi.advanceTimersByTime(BROADCAST_THROTTLE_MS));
    expect(ops().at(-1)).toEqual({
      kind: 'article-caret',
      tabId: 't',
      flow: 'f',
      blockId: 'b',
      offset: 3,
    });
    act(() => setLocalArticleCaret('f', null));
    expect(ops().at(-1)).toEqual({ kind: 'article-caret', tabId: 't', flow: null });
    expect(ops()).toHaveLength(3);
  });

  it('sends nothing while the room is closed', () => {
    const { sent } = setup({ live: false });
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 1 }));
    expect(sent).toEqual([]);
  });

  it('retracts a shown caret when a hide-cursors vote opens, and shows it again after', () => {
    const { ops, hook } = setup();
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 1 }));
    hook.rerender({ live: true, hidden: true, activeId: 't' });
    expect(ops().at(-1)).toEqual({ kind: 'article-caret', tabId: 't', flow: null });
    act(() => setLocalArticleCaret('f', { blockId: 'b', offset: 2 }));
    expect(ops()).toHaveLength(2);
    hook.rerender({ live: true, hidden: false, activeId: 't' });
    expect(ops().at(-1)).toMatchObject({ flow: 'f', offset: 2 });
  });

  it("draws only collaborators' carets on the tab we are on", () => {
    const { hook } = setup();
    syncArticlePeople([{ id: 'ann', name: 'Ann', color: '#f00' }]);
    receiveArticleCaret('ann', { tabId: 'u', flow: 'f', blockId: 'b', offset: 0 });
    expect(articlePeersOf('f')).toEqual([]);
    hook.rerender({ live: true, hidden: false, activeId: 'u' });
    expect(articlePeersOf('f').map((p) => p.id)).toEqual(['ann']);
  });
});
