// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAN_TIER_OFF, type PlanTier } from './plan-tier';

const refresh = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@liveworkspace/subscription-ui/provider', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/subscription-ui/provider')>()),
  useRefreshSubscription: () => refresh,
}));
import { FOCUS_REREAD_MS, SETTLE_REREAD_MS, tierKey, useTierReread } from './use-tier-reread';

// A limit's control recovers without a reload: its list is read again when the owner's tier or what this person may
// do changes, and when the window is looked at again.

const tierOf = (tier: 'free' | 'pro', action: PlanTier['action'] = 'upgrade'): PlanTier => ({
  ...PLAN_TIER_OFF,
  on: true,
  settled: true,
  action,
  owner: {
    status: 'ready',
    view: { owner: 'p:user_ada', tier, action },
  } as unknown as PlanTier['owner'],
});

afterEach(() => {
  vi.useRealTimers();
  refresh.mockClear();
});

describe('useTierReread', () => {
  it('reads again when the owner’s tier or the action changes, never on the first read', () => {
    const again = vi.fn();
    const { rerender } = renderHook(({ tier }) => useTierReread(tier, again), {
      initialProps: { tier: tierOf('free') },
    });
    expect(again).not.toHaveBeenCalled();
    rerender({ tier: tierOf('free') });
    expect(again).not.toHaveBeenCalled();
    rerender({ tier: tierOf('pro', 'manage') });
    expect(again).toHaveBeenCalledTimes(1);
    expect(tierKey(tierOf('free'))).not.toBe(tierKey(tierOf('pro')));
  });

  it('reads once more after a tier change, when the api has heard of it too', () => {
    vi.useFakeTimers();
    const again = vi.fn();
    const { rerender, unmount } = renderHook(({ tier }) => useTierReread(tier, again), {
      initialProps: { tier: tierOf('pro', 'manage') },
    });
    rerender({ tier: tierOf('free') });
    expect(again).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(SETTLE_REREAD_MS - 1);
    expect(again).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(again).toHaveBeenCalledTimes(2);
    // Nothing is left waiting once the control closes.
    rerender({ tier: tierOf('pro', 'manage') });
    unmount();
    vi.advanceTimersByTime(SETTLE_REREAD_MS);
    expect(again).toHaveBeenCalledTimes(3);
  });

  it('reads again when the window is looked at again, at most once every few seconds', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const again = vi.fn();
    renderHook(() => useTierReread(tierOf('free'), again));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('focus'));
    expect(again).toHaveBeenCalledTimes(1);
    // The owner's tier is asked afresh with it, so its words and badge catch up with the api's limits.
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.setSystemTime(1_000_000 + FOCUS_REREAD_MS);
    window.dispatchEvent(new Event('focus'));
    expect(again).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('listens to nothing and reads nothing with Pro off', () => {
    const again = vi.fn();
    const { rerender } = renderHook(({ tier }) => useTierReread(tier, again), {
      initialProps: { tier: PLAN_TIER_OFF },
    });
    window.dispatchEvent(new Event('focus'));
    rerender({ tier: PLAN_TIER_OFF });
    expect(again).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
