// @vitest-environment jsdom
// An article page toolbar's send entries on a touch screen (liveworkspace/docs/specs/004-index/send-to-plan.md "On a
// touch screen"): the words a press on the bar started on win over those the tap left behind.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import type { PMState } from './article-sent';
import { useArticleSendPress } from './article-send-press';
import { setSendSource } from './send-store';
import { setSendHere } from './send-to-plan-entry';

// A one-block article whose selection runs from `from` to `to` over "Book the venue".
const stateOn = (from: number, to: number): PMState => {
  const block = {
    attrs: { id: 'b1' },
    isTextblock: true,
    nodeSize: 16,
    textContent: 'Book the venue',
  };
  const $from = { depth: 1, node: () => block, parent: block };
  return {
    doc: {
      ...block,
      attrs: {},
      forEach: () => {},
      content: { size: 16 },
      resolve: () => $from,
      textBetween: (a: number, b: number) => 'Book the venue'.slice(a - 1, b - 1),
    },
    selection: { from, to, $from },
    tr: { setMeta: () => ({}) as never, getMeta: () => undefined },
  };
};

afterEach(() => {
  setSendSource(null);
  setSendHere(null);
});

describe('useArticleSendPress', () => {
  it('sends the words the press held, though the selection moved before the click', () => {
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    setSendHere({ app: 'liveknowledge', tabId: 't1' });
    let state = stateOn(1, 5);
    const { result } = renderHook(() => useArticleSendPress(() => state));
    result.current.onPress();
    state = stateOn(3, 3);
    expect(result.current.pick()).toEqual({ blockId: 'b1', text: 'Book' });
    // Once taken, the words are those the caret is in now.
    expect(result.current.pick()).toEqual({ blockId: 'b1', text: 'Book the venue' });
  });

  it('reads nothing while no article is shown', () => {
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    setSendHere({ app: 'liveknowledge', tabId: 't1' });
    const { result } = renderHook(() => useArticleSendPress(() => null));
    result.current.onPress();
    expect(result.current.pick()).toBeNull();
  });

  it('holds nothing while this session cannot send', () => {
    let state = stateOn(1, 5);
    const { result } = renderHook(() => useArticleSendPress(() => state));
    result.current.onPress();
    state = stateOn(3, 3);
    expect(result.current.pick()).toEqual({ blockId: 'b1', text: 'Book the venue' });
  });
});
