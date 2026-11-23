// @vitest-environment jsdom
// An upgrade reaches an open Walkthroughs list without a reload (walkthroughs.md "With Pro on"): the limits are read
// again when the tier behind them changes, and once more after the door's entitlement cache, never on the first
// answer, and not at all with Pro off.
import { act, render, waitFor } from '@testing-library/react';
import type { WalkthroughLimits } from '@liveworkspace/media/walkthrough';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import { useRefreshSubscription } from '@liveworkspace/subscription-ui/provider';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIER_SETTLE_MS, tierKey, useTierReread } from './tier-reread';

const OWNER = 'p:user_owner';
const LIMITS: WalkthroughLimits = {
  maxMs: 1,
  stored: 2,
  storedLimit: 2,
  owner: OWNER,
  storedOwner: ME,
};

beforeEach(() => setProForTests(true));
afterEach(() => {
  setProForTests(null);
  vi.useRealTimers();
});

let refresh: () => Promise<void> = async () => {};
function Probe({ limits, again }: { limits: WalkthroughLimits | null; again: () => void }) {
  useTierReread(limits, again);
  refresh = useRefreshSubscription();
  return null;
}

function mount(limits: WalkthroughLimits | null) {
  const owners = {
    [ME]: ownerView(ME, 'upgrade'),
    [OWNER]: ownerView(OWNER, 'none'),
  };
  const { fetcher, calls } = serviceFetch({ owners });
  const again = vi.fn();
  const view = render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <Probe limits={limits} again={again} />
    </SubscriptionProvider>,
  );
  return { owners, calls, again, view };
}

describe('tierKey', () => {
  it('is null until both views are ready, then their tiers (none for a view that may not know it)', () => {
    const ready = { status: 'ready' as const, view: ownerView(ME, 'upgrade', 'pro') };
    expect(tierKey({ status: 'loading' }, ready)).toBeNull();
    expect(tierKey(ready, { status: 'off' })).toBeNull();
    expect(tierKey(ready, { status: 'ready', view: { ...ready.view, tier: null } })).toBe('pro|');
    expect(tierKey({ status: 'ready', view: { ...ready.view, tier: null } }, ready)).toBe('|pro');
  });
});

describe('useTierReread', () => {
  it('reads nothing on the first answer, again on an upgrade, and once more after the door’s cache', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { owners, calls, again } = mount(LIMITS);
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith('/owner')).length).toBe(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(again).not.toHaveBeenCalled();
    owners[ME] = ownerView(ME, 'upgrade', 'pro');
    await act(async () => {
      await refresh();
    });
    await waitFor(() => expect(again).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIER_SETTLE_MS);
    });
    expect(again).toHaveBeenCalledTimes(2);
    // The same tiers read again: nothing more.
    await act(async () => {
      await refresh();
    });
    expect(again).toHaveBeenCalledTimes(2);
  });

  it('takes the length owner’s scope for both from a service that names no stored owner', async () => {
    const { calls } = mount({ ...LIMITS, storedOwner: undefined });
    await waitFor(() =>
      expect(
        calls.some((c) => c.path.includes(encodeURIComponent(OWNER)) || c.path.includes(OWNER)),
      ).toBe(true),
    );
    expect(calls.some((c) => c.path.includes('user_ada'))).toBe(false);
  });

  it('asks nothing before the list has answered, with no scope, and drops a pending read when it leaves', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const none = mount(null);
    const noScope = mount({ ...LIMITS, owner: null, storedOwner: null });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    for (const m of [none, noScope]) {
      expect(m.calls.some((c) => c.path.startsWith('/owner'))).toBe(false);
      expect(m.again).not.toHaveBeenCalled();
      m.view.unmount();
    }
    const { owners, calls, again, view } = mount(LIMITS);
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith('/owner')).length).toBe(2));
    owners[OWNER] = ownerView(OWNER, 'none', 'pro');
    await act(async () => {
      await refresh();
    });
    await waitFor(() => expect(again).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TIER_SETTLE_MS);
    });
    expect(again).toHaveBeenCalledTimes(1);
  });
});
