// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { proEnabled, TIER_LIMITS } from '@liveworkspace/subscription';
import { proOn } from './flag';
import { LimitNotice } from './LimitNotice';
import { ProBadge } from './ProBadge';
import {
  useOwnerView,
  usePrices,
  useSubscription,
  useSubscriptionHost,
  useUpgrade,
} from './provider/hooks';
import { OWNER_OFF, SUBSCRIPTION_OFF, type OwnerViewLoad, type SubscriptionLoad } from './state';
import { ME, ownerView, serviceFetch, withProvider } from './test/fixture';
import { setProForTests } from './testing';
import { UsageMeter } from './UsageMeter';

// subscription.md "The flag": a page built with Pro off renders no Pro UI and makes no subscription request.

let seen: {
  load: SubscriptionLoad;
  owner: OwnerViewLoad;
  host: unknown;
  prices: unknown;
  inPlace: boolean;
}[];

function Everything() {
  const load = useSubscription();
  const owner = useOwnerView(ME);
  const host = useSubscriptionHost();
  const prices = usePrices();
  const upgrade = useUpgrade();
  seen.push({ load, owner, host, prices, inPlace: upgrade.inPlace });
  return (
    <>
      <ProBadge />
      <ProBadge form="outline" />
      <ProBadge form="mark" />
      <UsageMeter limitKey="automationRunsPerMonth" used={250} limit={250} />
      <LimitNotice
        limitKey="automationRunsPerMonth"
        used={250}
        owner={ownerView(ME, 'upgrade')}
        limit={TIER_LIMITS.free.automationRunsPerMonth}
      />
    </>
  );
}

describe('with Pro off', () => {
  beforeEach(() => {
    seen = [];
    setProForTests(false);
  });

  it('the build flag is off unless it is set', () => {
    setProForTests(null);
    expect(proOn()).toBe(proEnabled(process.env.NEXT_PUBLIC_PRO_ENABLED));
    expect(proOn()).toBe(false);
  });

  it('renders nothing and fetches nothing, under a provider', async () => {
    const { fetcher, calls } = serviceFetch();
    const { container, rerender } = render(withProvider(<Everything />, fetcher));
    rerender(withProvider(<Everything />, fetcher));
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('every hook answers its one off state', () => {
    const { fetcher } = serviceFetch();
    const { rerender } = render(withProvider(<Everything />, fetcher));
    rerender(withProvider(<Everything />, fetcher));
    expect(seen.length).toBeGreaterThan(1);
    for (const each of seen) {
      expect(each.load).toBe(SUBSCRIPTION_OFF);
      expect(each.owner).toBe(OWNER_OFF);
      expect(each.host).toBeNull();
      expect(each.prices).toBeNull();
      expect(each.inPlace).toBe(false);
    }
  });

  it('with Pro on but no provider, the hooks are off too and nothing is asked', () => {
    setProForTests(true);
    const { container } = render(<Everything />);
    expect(seen[0]!.load).toBe(SUBSCRIPTION_OFF);
    expect(seen[0]!.owner).toBe(OWNER_OFF);
    // The parts that need no service still draw.
    expect(container.querySelectorAll('[data-pro-badge]').length).toBeGreaterThan(0);
  });
});
