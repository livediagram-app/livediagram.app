// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionProvider, SUBSCRIPTION_STALE_MS } from './SubscriptionProvider';
import {
  useBilling,
  useOwnerView,
  usePrices,
  useRefreshSubscription,
  useSubscription,
} from './hooks';
import { markLeaving, SUBSCRIBED_PARAM } from './return-marker';
import {
  GARDEN,
  ME,
  meResponse,
  ownerView,
  serviceFetch,
  summary,
  team,
  tokenOf,
  withProvider,
} from '../test/fixture';
import { SUBSCRIBED_NOTICE_MS } from './SubscribedNotice';

// subscription.md "The subscription Worker", "A person's browser": the page reads its own subscription once and
// shares it, and reads it again when the person comes back from the checkout or the portal.

function Tier({ id }: { id: string }) {
  const load = useSubscription();
  return <p data-testid={id}>{load.status === 'ready' ? load.me.personal.tier : load.status}</p>;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('SubscriptionProvider', () => {
  it('reads /me once with the account’s token and shares it', async () => {
    const { fetcher, calls } = serviceFetch();
    render(
      withProvider(
        <>
          <Tier id="a" />
          <Tier id="b" />
        </>,
        fetcher,
      ),
    );
    expect(screen.getByTestId('a').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    expect(screen.getByTestId('b').textContent).toBe('free');
    expect(calls).toEqual([{ path: '/me', method: 'GET', auth: 'Bearer tok', body: null }]);
  });

  it('signed out: says so without asking the service', async () => {
    const { fetcher, calls } = serviceFetch();
    render(withProvider(<Tier id="a" />, fetcher, () => {}, null));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('signed_out'));
    expect(calls).toEqual([]);
  });

  it('waits while the page is still checking who is here, and asks nothing for a visitor', async () => {
    const { fetcher, calls } = serviceFetch();
    const { rerender } = render(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher} account="checking">
        <Tier id="a" />
      </SubscriptionProvider>,
    );
    expect(screen.getByTestId('a').textContent).toBe('loading');
    rerender(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher} account="out">
        <Tier id="a" />
      </SubscriptionProvider>,
    );
    expect(screen.getByTestId('a').textContent).toBe('signed_out');
    expect(calls).toEqual([]);
    rerender(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher} account="in">
        <Tier id="a" />
      </SubscriptionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    expect(calls).toHaveLength(1);
  });

  it('an unreachable service is an error, not a blank', async () => {
    const { fetcher } = serviceFetch({ down: true });
    render(withProvider(<Tier id="a" />, fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('error'));
  });

  it('refresh reads again', async () => {
    const service = { me: meResponse() };
    const { fetcher, calls } = serviceFetch(service);
    function Refresh() {
      const refresh = useRefreshSubscription();
      return <button onClick={() => void refresh()}>Again</button>;
    }
    render(
      withProvider(
        <>
          <Tier id="a" />
          <Refresh />
        </>,
        fetcher,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    service.me = meResponse({ personal: summary(ME, 'pro') });
    fireEvent.click(screen.getByRole('button', { name: 'Again' }));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('pro'));
    expect(calls.filter((call) => call.path === '/me')).toHaveLength(2);
  });

  it('refreshes asked for while one is on its way share one more read after it, never one each', async () => {
    const { fetcher, calls } = serviceFetch();
    let done: Promise<void>[] = [];
    function Refresh() {
      const refresh = useRefreshSubscription();
      return <button onClick={() => void (done = [refresh(), refresh(), refresh()])}>Again</button>;
    }
    render(
      withProvider(
        <>
          <Tier id="a" />
          <Refresh />
        </>,
        fetcher,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    const reads = () => calls.filter((call) => call.path === '/me').length;
    fireEvent.click(screen.getByRole('button', { name: 'Again' }));
    // The second and third asked while the first was on its way: they share the one read that follows it.
    expect(done[1]).toBe(done[2]);
    expect(done[1]).not.toBe(done[0]);
    await act(() => done[1]);
    expect(reads()).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Again' }));
    await act(() => Promise.all(done).then(() => undefined));
    expect(reads()).toBe(5);
  });

  it('an owner view is asked once per owner, whoever asks', async () => {
    const { fetcher, calls } = serviceFetch({
      owners: { [GARDEN]: ownerView(GARDEN, 'ask_admin') },
    });
    function Action({ id }: { id: string }) {
      const owner = useOwnerView(GARDEN);
      return <p data-testid={id}>{owner.status === 'ready' ? owner.view.action : owner.status}</p>;
    }
    render(
      withProvider(
        <>
          <Action id="a" />
          <Action id="b" />
        </>,
        fetcher,
      ),
    );
    expect(screen.getByTestId('a').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('ask_admin'));
    expect(screen.getByTestId('b').textContent).toBe('ask_admin');
    expect(calls.filter((call) => call.path.startsWith('/owner'))).toEqual([
      {
        path: `/owner?scope=${encodeURIComponent(GARDEN)}`,
        method: 'GET',
        auth: 'Bearer tok',
        body: null,
      },
    ]);
  });

  it('prices come with the subscription, and are asked for alone for a visitor', async () => {
    const signedIn = serviceFetch();
    function Price() {
      const prices = usePrices();
      return <p data-testid="price">{prices ? `${prices.currency} ${prices.pro}` : 'none'}</p>;
    }
    const first = render(withProvider(<Price />, signedIn.fetcher));
    await waitFor(() => expect(screen.getByTestId('price').textContent).toBe('GBP 8'));
    expect(signedIn.calls.map((call) => call.path)).toEqual(['/me']);
    first.unmount();

    const visitor = serviceFetch();
    render(
      <SubscriptionProvider getToken={tokenOf(null)} fetch={visitor.fetcher} account="out">
        <Price />
      </SubscriptionProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('price').textContent).toBe('GBP 8'));
    expect(visitor.calls).toEqual([{ path: '/prices', method: 'GET', auth: null, body: null }]);
  });

  it('checkout comes back to this page marked subscribed, and the browser goes where the service says', async () => {
    window.history.replaceState(null, '', '/plan/abc?tab=2');
    const { fetcher, calls } = serviceFetch({
      checkoutUrl: '/subscription/checkout?session=chk_9',
    });
    const navigate = vi.fn();
    function Pay() {
      const billing = useBilling();
      return <button onClick={() => void billing?.checkout(ME)}>Pay</button>;
    }
    render(withProvider(<Pay />, fetcher, navigate));
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith(
      `${window.location.origin}/subscription/checkout?session=chk_9`,
    );
    const sent = calls.find((call) => call.path === '/checkout')!;
    expect(sent.auth).toBe('Bearer tok');
    expect(sent.body).toEqual({
      owner: ME,
      returnTo: `${window.location.origin}/plan/abc?tab=2&${SUBSCRIBED_PARAM}=1`,
    });
  });

  it('from an app’s page the checkout is on the service’s origin', async () => {
    const { fetcher } = serviceFetch();
    const navigate = vi.fn();
    function Pay() {
      const billing = useBilling();
      return <button onClick={() => void billing?.portal(ME)}>Bill</button>;
    }
    render(
      <SubscriptionProvider
        getToken={tokenOf('tok')}
        fetch={fetcher}
        navigate={navigate}
        origin="https://www.liveworkspace.app"
      >
        <Pay />
      </SubscriptionProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bill' }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        'https://www.liveworkspace.app/subscription/billing?session=prt_1',
      ),
    );
  });

  it('back from a checkout: the marker leaves the address and the new tier is announced', async () => {
    window.history.replaceState(null, '', `/plan/abc?tab=2&${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: ME, kind: 'checkout' });
    const { fetcher } = serviceFetch({ me: meResponse({ personal: summary(ME, 'pro') }) });
    render(withProvider(<Tier id="a" />, fetcher));
    const notice = await screen.findByText('You’re on Pro');
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(window.location.search).toBe('?tab=2');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('You’re on Pro')).toBeNull();
  });

  it('back from a team’s checkout names the team; a cancelled checkout announces nothing', async () => {
    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: GARDEN, kind: 'checkout' });
    const paid = serviceFetch({
      me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'admin', 'team')] }),
    });
    const first = render(withProvider(<Tier id="a" />, paid.fetcher));
    expect(await screen.findByText('Garden Club Is on Pro for Teams')).toBeTruthy();
    first.unmount();

    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: ME, kind: 'checkout' });
    const unpaid = serviceFetch();
    render(withProvider(<Tier id="a" />, unpaid.fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    expect(screen.queryByText(/on Pro/)).toBeNull();
  });

  it('announces nothing it cannot know was gained: no word of leaving, or the portal, with Pro already on', async () => {
    const paid = meResponse({
      personal: summary(ME, 'pro'),
      teams: [team(GARDEN, 'Garden Club', 'admin', 'free')],
    });
    // Storage was refused, so the browser kept no word of leaving for the TEAM's checkout, which was then
    // cancelled. The address still says a checkout sent them back, and their own Pro is months old.
    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    const cold = render(withProvider(<Tier id="a" />, serviceFetch({ me: paid }).fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('pro'));
    expect(screen.queryByText(/on Pro/)).toBeNull();
    expect(window.location.search).toBe('');
    cold.unmount();

    // A cancelled team checkout, remembered: the team is still Free, so nothing, and never the person's own.
    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: GARDEN, kind: 'checkout' });
    const cancelled = render(withProvider(<Tier id="a" />, serviceFetch({ me: paid }).fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('pro'));
    expect(screen.queryByText(/on Pro/)).toBeNull();
    cancelled.unmount();

    // Back from the portal, on an address someone marked: nothing was bought there.
    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: ME, kind: 'portal' });
    render(withProvider(<Tier id="a" />, serviceFetch({ me: paid }).fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('pro'));
    expect(screen.queryByText(/on Pro/)).toBeNull();
  });

  it('the announcement leaves on its own however often the page renders meanwhile', async () => {
    window.history.replaceState(null, '', `/?${SUBSCRIBED_PARAM}=1`);
    markLeaving({ owner: ME, kind: 'checkout' });
    const { fetcher } = serviceFetch({ me: meResponse({ personal: summary(ME, 'pro') }) });
    // A host that hands new props on every render, as an editor's does.
    const page = (tick: number) => (
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher} navigate={() => {}}>
        <Tier id="a" />
        <span>{tick}</span>
      </SubscriptionProvider>
    );
    // The clock is ours from before the notice appears, and still runs so the read can answer.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = render(page(0));
    await screen.findByText('You’re on Pro');
    // It rendered every second: each render used to start the clock again, and it never left.
    for (let second = 1; second < SUBSCRIBED_NOTICE_MS / 1000; second += 1) {
      act(() => void vi.advanceTimersByTime(1000));
      rerender(page(second));
    }
    expect(screen.queryByText('You’re on Pro')).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByText('You’re on Pro')).toBeNull();
  });

  it('reads again when the tab is shown after leaving for billing, or once stale; not on every focus', async () => {
    const { fetcher, calls } = serviceFetch();
    render(withProvider(<Tier id="a" />, fetcher));
    await waitFor(() => expect(screen.getByTestId('a').textContent).toBe('free'));
    const reads = () => calls.filter((call) => call.path === '/me').length;

    act(() => void window.dispatchEvent(new Event('focus')));
    expect(reads()).toBe(1);

    markLeaving({ owner: ME, kind: 'portal' });
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(reads()).toBe(2));
    // The one return is one read, however many events announce it.
    act(() => void window.dispatchEvent(new Event('pageshow')));
    expect(reads()).toBe(2);

    const later = Date.now() + SUBSCRIPTION_STALE_MS + 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    act(() => void window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(reads()).toBe(3));
    vi.restoreAllMocks();
  });
});
