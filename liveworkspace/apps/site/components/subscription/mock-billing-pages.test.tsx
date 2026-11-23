// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatPrice,
  limitsFor,
  type MockCheckout,
  type MockPortal,
  type MockPortalRequest,
  type SubscriptionSummary,
} from '@liveworkspace/subscription';
import { formatDay } from '@liveworkspace/subscription-ui';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { actionDone } from './billing-copy';
import { TEST_MODE } from './BillingShell';

// The mock checkout and the mock billing portal (liveworkspace/docs/specs/019-subscription/subscription.md
// "Billing"): both say Test Mode, take no card, and send the browser back where it came from.

const left = vi.hoisted(() => ({ to: [] as string[] }));
vi.mock('./mock-client', async (actual) => ({
  ...(await actual<typeof import('./mock-client')>()),
  leaveTo: (url: string) => void left.to.push(url),
}));

const { MockCheckoutPage } = await import('./MockCheckoutPage');
const { MockBillingPage } = await import('./MockBillingPage');

const RENEWS = Date.UTC(2026, 11, 20);
const GRACE = Date.UTC(2026, 10, 27);
const gbp = (amount: number) => formatPrice(amount, 'GBP');

type Sent = { url: string; method: string; body: unknown };
let sent: Sent[];

function serve(answer: (call: Sent) => { status?: number; body: unknown }) {
  sent = [];
  const fetcher: typeof fetch = async (input, init) => {
    const call: Sent = {
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
    };
    sent.push(call);
    const { status = 200, body } = answer(call);
    return new Response(JSON.stringify(body), { status });
  };
  vi.stubGlobal('fetch', fetcher);
}

beforeEach(() => {
  setProForTests(true);
  left.to = [];
});
afterEach(() => {
  cleanup();
  setProForTests(null);
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const TEAM_CHECKOUT: MockCheckout = {
  id: 'chk_1',
  owner: 't:team_garden',
  ownerName: 'Garden Club',
  tier: 'team',
  seats: 6,
  currency: 'GBP',
  unitAmount: 6,
  amount: 36,
  returnTo: 'https://www.liveplanner.app/plan/abc?subscribed=1',
};

describe('the mock checkout', () => {
  it('shows the order: the tier, who it is for, seats and unit price, and the total a month', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=chk_1');
    serve(() => ({ body: TEAM_CHECKOUT }));
    render(<MockCheckoutPage />);
    const summary = await screen.findByLabelText('Order summary');
    expect(sent[0]).toMatchObject({ url: '/api/subscription/mock/checkout/chk_1', method: 'GET' });
    expect(screen.getByText('Subscribe to Pro for Teams')).toBeTruthy();
    expect(document.querySelector('[data-checkout-total]')!.textContent).toBe(gbp(36));
    expect(summary.textContent).toContain('For Garden Club, a team’s shared library');
    expect(summary.textContent).toContain(`6 × ${gbp(6)} a member`);
    expect(summary.textContent).toContain(`Total a Month${gbp(36)}`);
    // No card fields, and Test Mode said twice: the band and the payment panel.
    expect(document.querySelector('input')).toBeNull();
    expect(screen.getAllByText(TEST_MODE)).toHaveLength(2);
  });

  it('a person’s checkout has no seats row, in the subscription’s own currency', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=chk_2');
    serve(() => ({
      body: {
        ...TEAM_CHECKOUT,
        id: 'chk_2',
        owner: 'p:user_ada',
        ownerName: 'Ada Lovelace',
        tier: 'pro',
        seats: 1,
        currency: 'USD',
        unitAmount: 10,
        amount: 10,
      } satisfies MockCheckout,
    }));
    render(<MockCheckoutPage />);
    const summary = await screen.findByLabelText('Order summary');
    expect(summary.textContent).toContain('For Ada Lovelace, your personal library');
    expect(summary.textContent).not.toContain('Seats');
    expect(document.querySelector('[data-checkout-total]')!.textContent).toBe(
      formatPrice(10, 'USD'),
    );
  });

  it('Pay and Subscribe pays, then goes back where the service says', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=chk_1');
    serve((call) =>
      call.method === 'POST' ? { body: { url: TEAM_CHECKOUT.returnTo } } : { body: TEAM_CHECKOUT },
    );
    render(<MockCheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay and Subscribe' }));
    await waitFor(() => expect(left.to).toEqual([TEAM_CHECKOUT.returnTo]));
    expect(sent[1]).toMatchObject({ method: 'POST', body: { action: 'pay' } });
    // Busy until the page has gone, so a second press pays nothing twice.
    expect(screen.getByRole('button', { name: 'Subscribing…' }).getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('Cancel goes back without paying', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=chk_1');
    serve((call) =>
      call.method === 'POST'
        ? { body: { url: 'https://www.liveplanner.app/plan/abc' } }
        : { body: TEAM_CHECKOUT },
    );
    render(<MockCheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(left.to).toEqual(['https://www.liveplanner.app/plan/abc']));
    expect(sent[1]).toMatchObject({ method: 'POST', body: { action: 'cancel' } });
  });

  it('a payment that fails says so and can be tried again', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=chk_1');
    serve((call) =>
      call.method === 'POST'
        ? { status: 503, body: { error: 'unavailable' } }
        : { body: TEAM_CHECKOUT },
    );
    render(<MockCheckoutPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay and Subscribe' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Nothing was charged.');
    expect(
      screen.getByRole('button', { name: 'Pay and Subscribe' }).getAttribute('aria-busy'),
    ).toBeNull();
    expect(left.to).toEqual([]);
  });

  it('an unknown, used or missing session says the checkout has closed', async () => {
    window.history.replaceState(null, '', '/subscription/checkout?session=gone');
    serve(() => ({ status: 404, body: { error: 'not_found' } }));
    const first = render(<MockCheckoutPage />);
    expect(await screen.findByRole('heading', { name: 'This Checkout Has Closed' })).toBeTruthy();
    first.unmount();
    window.history.replaceState(null, '', '/subscription/checkout');
    sent = [];
    render(<MockCheckoutPage />);
    expect(screen.getByRole('heading', { name: 'This Checkout Has Closed' })).toBeTruthy();
    expect(sent).toEqual([]);
  });
});

function subscription(over: Partial<SubscriptionSummary> = {}): SubscriptionSummary {
  return {
    owner: 't:team_garden',
    tier: 'team',
    state: 'active',
    seats: 6,
    currency: 'GBP',
    amount: 36,
    periodEnd: RENEWS,
    graceEnds: null,
    limits: limitsFor('team', 6),
    usage: {},
    ...over,
  };
}

const portal = (
  over: Partial<SubscriptionSummary> = {},
  more: Partial<MockPortal> = {},
): MockPortal => ({
  id: 'prt_1',
  ownerName: 'Garden Club',
  subscription: subscription(over),
  members: 6,
  returnTo: 'https://www.liveplanner.app/plan/abc',
  ...more,
});

/** A portal whose every action answers from `next`, by action. */
function servePortal(start: MockPortal, next: Partial<Record<string, MockPortal>> = {}) {
  serve((call) => {
    if (call.method !== 'POST') return { body: start };
    const { action } = call.body as MockPortalRequest;
    return { body: next[action] ?? start };
  });
}

describe('the mock billing portal', () => {
  beforeEach(() => window.history.replaceState(null, '', '/subscription/billing?session=prt_1'));

  it('shows the subscription, its state, a team’s seats, and the way back', async () => {
    servePortal(portal());
    render(<MockBillingPage />);
    expect(await screen.findByRole('heading', { name: 'Billing' })).toBeTruthy();
    expect(sent[0]).toMatchObject({ url: '/api/subscription/mock/portal/prt_1', method: 'GET' });
    const card = document.querySelector('[data-billing-state]') as HTMLElement;
    expect(card.getAttribute('data-billing-state')).toBe('active');
    expect(card.textContent).toContain('Pro for Teams');
    expect(card.textContent).toContain('Active');
    expect(card.textContent).toContain(`The next payment is on ${formatDay(RENEWS)}.`);
    expect(card.textContent).toContain(`${gbp(36)} a month`);
    expect(screen.getByText(`6 × ${gbp(6)} a member · 6 joined members`)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe(
      'https://www.liveplanner.app/plan/abc',
    );
    expect(screen.getByText(TEST_MODE)).toBeTruthy();
  });

  it('Cancel Subscription, then Resume, each drawn from the answer', async () => {
    servePortal(portal(), {
      cancel: portal({ state: 'cancelling' }),
      resume: portal({ state: 'active' }),
    });
    render(<MockBillingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Subscription' }));
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Cancelled. Nothing more will be charged.');
    expect(document.querySelector('[data-billing-state]')!.textContent).toContain(
      `Cancelled. Its limits stay until ${formatDay(RENEWS)}`,
    );
    expect(document.querySelector('[data-billing-state]')!.getAttribute('data-billing-state')).toBe(
      'cancelling',
    );
    expect(sent.at(-1)).toMatchObject({ method: 'POST', body: { action: 'cancel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-billing-state]')!.getAttribute('data-billing-state'),
      ).toBe('active'),
    );
    expect(sent.at(-1)).toMatchObject({ method: 'POST', body: { action: 'resume' } });
    expect(screen.getByRole('button', { name: 'Cancel Subscription' })).toBeTruthy();
  });

  it('the Test Controls are set apart, and each updates the page from its answer', async () => {
    servePortal(portal(), {
      fail_payment: portal({ state: 'past_due', graceEnds: GRACE }),
      recover_payment: portal({ state: 'active' }),
      end_grace: portal({ state: 'ended', tier: 'free', amount: null, currency: null }),
    });
    render(<MockBillingPage />);
    const controls = await screen.findByRole('region', { name: 'Test Controls' });
    expect(controls.hasAttribute('data-test-controls')).toBe(true);
    expect(
      within(controls)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual([
      'Simulate Failed Payment',
      'Simulate Payment Recovered',
      'End Grace Now',
      'End Period Now',
      'Renew Now',
      'Set Seats',
    ]);
    // Only what fits the state can be pressed.
    const button = (name: string) =>
      within(controls).getByRole<HTMLButtonElement>('button', { name });
    expect(button('Simulate Payment Recovered').disabled).toBe(true);
    expect(button('End Grace Now').disabled).toBe(true);

    fireEvent.click(button('Simulate Failed Payment'));
    const state = () =>
      document.querySelector('[data-billing-state]')!.getAttribute('data-billing-state');
    await waitFor(() => expect(state()).toBe('past_due'));
    // A failed renewal is said as a warning, once: the card under it says where the subscription stands.
    const said = () => document.querySelector('[data-callout]')!;
    expect(said().getAttribute('data-callout')).toBe('warning');
    expect(said().textContent).toBe('A renewal failed, and grace has begun.');
    expect(document.querySelector('[data-billing-state]')!.textContent).toContain(
      `The last renewal failed. Pro for Teams stays on until ${formatDay(GRACE)}.`,
    );
    expect(button('Simulate Failed Payment').disabled).toBe(true);

    fireEvent.click(button('Simulate Payment Recovered'));
    await waitFor(() => expect(state()).toBe('active'));
    expect(said().getAttribute('data-callout')).toBe('success');
    expect(said().textContent).toBe(
      'The payment went through. Pro for Teams is paid and renewing.',
    );

    fireEvent.click(button('Simulate Failed Payment'));
    await waitFor(() => expect(state()).toBe('past_due'));
    fireEvent.click(button('End Grace Now'));
    await waitFor(() => expect(state()).toBe('ended'));
    expect(document.querySelector('[data-billing-state]')!.textContent).toContain('Free');
    expect(screen.queryByRole('button', { name: 'Cancel Subscription' })).toBeNull();
    expect(sent.filter((call) => call.method === 'POST').map((call) => call.body)).toEqual([
      { action: 'fail_payment' },
      { action: 'recover_payment' },
      { action: 'fail_payment' },
      { action: 'end_grace' },
    ]);
  });

  it('End Period Now and Renew Now send their actions', async () => {
    servePortal(portal(), {
      renew: portal({ periodEnd: Date.UTC(2027, 0, 20) }),
      end_period: portal({ state: 'ended', tier: 'free', amount: null, currency: null }),
    });
    render(<MockBillingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Renew Now' }));
    expect((await screen.findByRole('status')).textContent).toBe('Renewed for another month.');
    expect(document.querySelector('[data-billing-state]')!.textContent).toContain(
      `Paid and renewing. The next payment is on ${formatDay(Date.UTC(2027, 0, 20))}.`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'End Period Now' }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-billing-state]')!.getAttribute('data-billing-state'),
      ).toBe('ended'),
    );
  });

  it('a team’s seats follow its members; a person has no seats at all', async () => {
    servePortal(portal(), { set_seats: portal({ seats: 9, amount: 54 }, { members: 9 }) });
    const first = render(<MockBillingPage />);
    const field = await screen.findByLabelText<HTMLInputElement>('Joined Members');
    expect(field.value).toBe('6');
    fireEvent.change(field, { target: { value: '2' } });
    expect(screen.getByText('Billed as 3 seats: never fewer than 3.')).toBeTruthy();
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Seats' }));
    await waitFor(() =>
      expect(screen.getByText(`9 × ${gbp(6)} a member · 9 joined members`)).toBeTruthy(),
    );
    expect(sent.at(-1)).toMatchObject({ body: { action: 'set_seats', seats: 9 } });
    first.unmount();

    servePortal(
      portal(
        { owner: 'p:user_ada', tier: 'pro', seats: 1, amount: 8, limits: limitsFor('pro') },
        { ownerName: 'Ada Lovelace', members: null },
      ),
    );
    render(<MockBillingPage />);
    expect(await screen.findByText('Ada Lovelace, personal library')).toBeTruthy();
    expect(screen.queryByLabelText('Joined Members')).toBeNull();
    expect(screen.queryByText(/joined member/)).toBeNull();
  });

  it('an action that fails says so and changes nothing', async () => {
    serve((call) =>
      call.method === 'POST' ? { status: 503, body: { error: 'unavailable' } } : { body: portal() },
    );
    render(<MockBillingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel Subscription' }));
    expect((await screen.findByRole('alert')).textContent).toContain('That didn’t go through.');
    expect(document.querySelector('[data-billing-state]')!.getAttribute('data-billing-state')).toBe(
      'active',
    );
  });

  it('a refused action says why in plain words, never that the connection failed', async () => {
    for (const [error, status, words] of [
      ['invalid_state', 409, 'That can’t be done to this subscription as it is now.'],
      ['not_team_admin', 403, 'Only an admin of this team can change its billing'],
      ['accounts_unavailable', 503, 'Couldn’t confirm you’re an admin of this team just now.'],
    ] as const) {
      serve((call) => (call.method === 'POST' ? { status, body: { error } } : { body: portal() }));
      render(<MockBillingPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Renew Now' }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent, error).toContain(words);
      expect(alert.textContent).not.toContain('Check your connection');
      cleanup();
    }
  });

  it('past due: Cancel Subscription is offered, says the day it ends, and is sent', async () => {
    servePortal(portal({ state: 'past_due', graceEnds: GRACE }), {
      cancel: portal({ state: 'cancelling', periodEnd: GRACE }),
    });
    render(<MockBillingPage />);
    const cancel = await screen.findByRole('button', { name: 'Cancel Subscription' });
    expect(document.body.textContent).toContain(
      `Cancelling keeps everything on until ${formatDay(GRACE)}, and nothing more is charged.`,
    );
    fireEvent.click(cancel);
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Cancelled. Nothing more will be charged.');
    expect(document.querySelector('[data-billing-state]')!.textContent).toContain(
      `Cancelled. Its limits stay until ${formatDay(GRACE)}`,
    );
    expect(sent.at(-1)).toMatchObject({ method: 'POST', body: { action: 'cancel' } });
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
  });

  it('Simulate Failed Payment is for an active subscription only: a cancelled one has no renewal to fail', async () => {
    servePortal(portal({ state: 'cancelling' }), {});
    render(<MockBillingPage />);
    const fail = await screen.findByRole('button', { name: 'Simulate Failed Payment' });
    expect(fail.hasAttribute('disabled')).toBe(true);
  });

  it('a link that has closed says so', async () => {
    serve(() => ({ status: 404, body: { error: 'not_found' } }));
    render(<MockBillingPage />);
    expect(
      await screen.findByRole('heading', { name: 'This Billing Link Has Closed' }),
    ).toBeTruthy();
  });
});

describe('what a billing action says', () => {
  const after = (over: Parameters<typeof portal>[0] = {}) => portal(over);
  it('says each action once, in the tone of where it left the subscription', () => {
    expect(actionDone('cancel', after({ state: 'cancelling' }))).toEqual({
      tone: 'info',
      text: 'Cancelled. Nothing more will be charged.',
    });
    expect(actionDone('resume', after({ state: 'active' })).tone).toBe('success');
    // Resume while past due goes back to past due, never to paid.
    expect(actionDone('resume', after({ state: 'past_due', graceEnds: GRACE }))).toEqual({
      tone: 'warning',
      text: 'Resumed. The failed payment still needs to go through.',
    });
    expect(actionDone('fail_payment', after({ state: 'past_due', graceEnds: GRACE })).tone).toBe(
      'warning',
    );
    expect(actionDone('recover_payment', after({ state: 'active' })).tone).toBe('success');
    expect(actionDone('end_grace', after({ state: 'ended', tier: 'free' }))).toEqual({
      tone: 'info',
      text: 'Grace ran out without a payment.',
    });
    expect(actionDone('end_period', after({ state: 'ended', tier: 'free' })).text).toBe(
      'The period ended, and nothing renewed it.',
    );
    // An active subscription stays on while its renewal is settled.
    expect(actionDone('end_period', after({ state: 'active' })).text).toBe(
      'The period ended. The renewal is being settled.',
    );
    expect(actionDone('renew', after({ state: 'active' })).text).toBe('Renewed for another month.');
    expect(actionDone('set_seats', after({ seats: 5 })).text).toBe('Seats changed to 5.');
    // No action's line repeats the card's own sentence under it.
    for (const action of ['cancel', 'fail_payment', 'recover_payment', 'renew'] as const)
      expect(actionDone(action, after()).text).not.toContain('The last renewal failed');
  });
});
