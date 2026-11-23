// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setProForTests } from '../testing';
import { ITEM_TIER_OFF, type ItemTierView } from './item-tier';

const refresh = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../provider')>()),
  useRefreshSubscription: () => refresh,
}));
import { useAiCredits } from './use-ai-credits';
import { useTierReread } from './use-tier-reread';

// subscription.md "What people see": a look again at the window reads the owner's usage again, once.

const ON: ItemTierView = { ...ITEM_TIER_OFF, on: true };

afterEach(() => {
  setProForTests(null);
  refresh.mockClear();
});

describe('a look again at the window', () => {
  it('asks the service once for the AI credits, whose own reread is that ask', () => {
    setProForTests(true);
    const { result } = renderHook(() => useAiCredits(ON));
    act(
      () => void result.current.take({ tier: { limit: 'aiCreditsPerMonth', used: 50, max: 50 } }),
    );
    expect(result.current.spent).toEqual({ used: 50, max: 50 });
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(refresh).toHaveBeenCalledTimes(1);
    // A refusal from before is forgotten with it.
    expect(result.current.spent).toBeNull();
  });

  it('asks the service beside a reread that reads something else', () => {
    setProForTests(true);
    const again = vi.fn();
    renderHook(() => useTierReread(ON, again));
    act(() => void window.dispatchEvent(new Event('focus')));
    expect(again).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
