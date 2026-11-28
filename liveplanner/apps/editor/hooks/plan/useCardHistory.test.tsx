// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/item-history', () => ({ fetchItemHistory: vi.fn(async () => []) }));

import { fetchItemHistory } from '@/lib/api/item-history';
import { historyWritten } from '@/lib/api/history-written';
import { ITEM_HISTORY_REFETCH_MS, useCardHistory } from './useCardHistory';

// The open card's history reads again when this screen writes it without the card changing (a session's Skip), not
// only when its `rev` moves; a write to another card leaves it alone.
const SCOPE = { ownerId: 'me', projectId: 'p1', shareCode: null, tabId: null };

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(fetchItemHistory).mockClear();
});
afterEach(() => vi.useRealTimers());

describe('useCardHistory', () => {
  it('reads again, after the pause, when the open card’s history is written', async () => {
    renderHook(() => useCardHistory({ scope: SCOPE, itemId: 'c1', rev: 3, enabled: true }));
    await act(async () => {});
    expect(fetchItemHistory).toHaveBeenCalledTimes(1);
    act(() => historyWritten('other'));
    await act(async () => vi.advanceTimersByTime(ITEM_HISTORY_REFETCH_MS));
    expect(fetchItemHistory).toHaveBeenCalledTimes(1);
    act(() => historyWritten('c1'));
    await act(async () => vi.advanceTimersByTime(ITEM_HISTORY_REFETCH_MS));
    expect(fetchItemHistory).toHaveBeenCalledTimes(2);
  });

  it('does not listen while disabled', async () => {
    renderHook(() => useCardHistory({ scope: SCOPE, itemId: 'c1', rev: 3, enabled: false }));
    act(() => historyWritten('c1'));
    await act(async () => vi.advanceTimersByTime(ITEM_HISTORY_REFETCH_MS));
    expect(fetchItemHistory).not.toHaveBeenCalled();
  });
});
