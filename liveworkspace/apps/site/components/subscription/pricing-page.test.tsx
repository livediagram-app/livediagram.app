// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPrice, LIMIT_ROWS, PRICES, TEAM_SEATS_MIN } from '@liveworkspace/subscription';
import {
  formatDay,
  preloadUpgradeDialog,
  SubscriptionProvider,
} from '@liveworkspace/subscription-ui';
import {
  meResponse,
  serviceFetch,
  setProForTests,
  summary,
  team,
  tokenOf,
  type Service,
} from '@liveworkspace/subscription-ui/testing';
import type { AccountKnown } from '@liveworkspace/subscription-ui';
import sitemap from '@/app/sitemap';
import PricingRoute from '@/app/pricing/page';
import CheckoutRoute from '@/app/subscription/checkout/page';
import BillingRoute from '@/app/subscription/billing/page';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { PricingComparison } from './PricingComparison';
import { PricingTiers, standingSentence } from './PricingTiers';

// The pricing page (liveworkspace/docs/specs/019-subscription/subscription.md "The pricing page", "The flag").

vi.mock('@/components/AccountControl', () => ({ AccountControl: () => null }));
// The person's own AI key, as Settings › AI keeps it: none unless a test sets one.
const aiKey = vi.hoisted(() => ({ answer: { ok: true, data: { key: null } } as unknown }));
vi.mock('@/lib/account-api', () => ({ accountApi: vi.fn(async () => aiKey.answer) }));

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);
beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
});

function pricing(service: Service, account: AccountKnown) {
  const { fetcher, calls } = serviceFetch(service);
  const navigate = vi.fn();
  render(
    <SubscriptionProvider
      getToken={tokenOf(account === 'in' ? 'tok' : null)}
      fetch={fetcher}
      navigate={navigate}
      account={account}
    >
      <PricingTiers account={account} />
      <PricingComparison account={account} />
    </SubscriptionProvider>,
  );
  const card = (tier: string) =>
    document.querySelector(`section[aria-labelledby="tier-${tier}"]`) as HTMLElement;
  return { calls, navigate, card };
}

const gbp = (amount: number) => formatPrice(amount, 'GBP');

describe('with Pro off', () => {
  beforeEach(() => setProForTests(false));

  it('the pricing, checkout and billing pages are not found', () => {
    for (const Route of [PricingRoute, CheckoutRoute, BillingRoute]) {
      expect(() => Route()).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404|NEXT_NOT_FOUND/);
    }
  });

  it('there is no Pricing link in the header, the footer or the sitemap', () => {
    expect(renderToStaticMarkup(<Header account={false} />)).not.toContain('Pricing');
    expect(renderToStaticMarkup(<Footer />)).not.toContain('Pricing');
    expect(sitemap().map((entry) => entry.url)).not.toContain(
      'https://www.liveworkspace.app/pricing',
    );
  });
});

describe('with Pro on', () => {
  it('the three pages are there, and Pricing is in the header, the footer and the sitemap', () => {
    for (const Route of [PricingRoute, CheckoutRoute, BillingRoute]) {
      expect(() => Route()).not.toThrow();
    }
    // In the header Pricing is a row of the Product menu (site.md "The header"; its rows: HeaderMenus.test.tsx).
    expect(renderToStaticMarkup(<Header account={false} />)).toContain(
      'data-header-menu="Product"',
    );
    expect(renderToStaticMarkup(<Footer />)).toMatch(/<a href="\/pricing"[^>]*>Pricing<\/a>/);
    expect(sitemap().map((entry) => entry.url)).toContain('https://www.liveworkspace.app/pricing');
  });
});

describe('the pricing page, signed out', () => {
  it('shows the three tiers with the service’s prices, and asks for nothing but the prices', async () => {
    const { calls, card } = pricing({}, 'out');
    await waitFor(() => expect(card('pro').textContent).toContain(gbp(PRICES.GBP.pro)));
    expect(card('free').textContent).toContain(`${gbp(0)}always`);
    expect(card('pro').textContent).toContain(`${gbp(PRICES.GBP.pro)}a month`);
    expect(card('team').textContent).toContain(
      `${gbp(PRICES.GBP.team)}a member a month, ${TEAM_SEATS_MIN} or more`,
    );
    expect(
      within(card('pro')).getByRole('heading', { name: 'Pro (for Individuals)' }),
    ).toBeTruthy();
    expect(within(card('team')).getByRole('heading', { name: 'Pro (for Teams)' })).toBeTruthy();
    // Both Pro cards carry the Pro badge; Free's does not.
    expect(within(card('pro')).getByRole('img', { name: 'Pro' })).toBeTruthy();
    expect(within(card('team')).getByRole('img', { name: 'Pro' })).toBeTruthy();
    expect(within(card('free')).queryByRole('img', { name: 'Pro' })).toBeNull();
    expect(calls).toEqual([{ path: '/prices', method: 'GET', auth: null, body: null }]);
  });

  it('every button goes to sign in or sign up and comes back to /pricing', async () => {
    const { card } = pricing({}, 'out');
    const back = encodeURIComponent('/pricing');
    expect(
      within(card('pro')).getByRole('link', { name: 'Get Pro' }).getAttribute('href'),
    ).toContain(`/sign-in?`);
    expect(
      within(card('pro')).getByRole('link', { name: 'Get Pro' }).getAttribute('href'),
    ).toContain(back);
    expect(
      within(card('team')).getByRole('link', { name: 'Get Pro for Teams' }).getAttribute('href'),
    ).toContain(back);
    expect(
      within(card('free')).getByRole('link', { name: 'Start Free' }).getAttribute('href'),
    ).toContain('/sign-up?');
  });

  it('the comparison has every compared row and no usage column, with the way to see your own', () => {
    pricing({}, 'out');
    const table = screen.getByRole('table', { name: 'What each tier allows' });
    expect(table.querySelectorAll('[data-limit-row]')).toHaveLength(
      LIMIT_ROWS.filter((row) => row.compared !== false).length,
    );
    // Largest Image is the same on every tier, so it is not compared (owner, 2026-11-23).
    expect(table.querySelector('[data-limit-row="imageMaxBytes"]')).toBeNull();
    expect(within(table).queryByRole('columnheader', { name: 'Your Usage Now' })).toBeNull();
    const link = screen.getByRole('link', { name: 'Sign In to See Your Own Usage' });
    expect(link.getAttribute('href')).toContain(encodeURIComponent('/pricing'));
  });
});

describe('the pricing page, signed in', () => {
  const byoCell = (table: HTMLElement) =>
    within(table.querySelector('[data-limit-row="ownAiKey"]') as HTMLElement).getAllByRole(
      'cell',
    )[0]!.textContent;

  it('says whether your own AI key is set in the Bring Your Own AI row', async () => {
    aiKey.answer = {
      ok: true,
      data: { key: { provider: 'anthropic', model: 'm', hint: 'x', setAt: 1 } },
    };
    pricing({}, 'in');
    const table = screen.getByRole('table', { name: 'What each tier allows' });
    await waitFor(() => expect(byoCell(table)).toBe('Configured'));
    cleanup();
    aiKey.answer = { ok: true, data: { key: null } };
    pricing({}, 'in');
    await waitFor(() =>
      expect(byoCell(screen.getByRole('table', { name: 'What each tier allows' }))).toBe(
        'Not Configured',
      ),
    );
    cleanup();
    // The account API could not say: the cell stays quiet rather than guess.
    aiKey.answer = { ok: false, status: 503, error: 'unavailable' };
    pricing({}, 'in');
    await waitFor(() =>
      expect(byoCell(screen.getByRole('table', { name: 'What each tier allows' }))).toBe(
        'Not applicable',
      ),
    );
    aiKey.answer = { ok: true, data: { key: null } };
  });

  it('marks your tier, shows your usage, and Get Pro starts the checkout', async () => {
    const { calls, navigate, card } = pricing(
      { checkoutUrl: '/subscription/checkout?session=c1' },
      'in',
    );
    await waitFor(() => expect(within(card('free')).getByText('Your Tier')).toBeTruthy());
    expect(screen.getByText('Comparing your personal usage')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'What each tier allows' });
    expect(within(table).getByRole('columnheader', { name: 'Your Usage Now' })).toBeTruthy();
    expect(
      within(
        table.querySelector('[data-limit-row="automationRunsPerMonth"]') as HTMLElement,
      ).getAllByRole('cell')[0]!.textContent,
    ).toBe('205 of 500 this month');
    expect(
      within(card('free')).getByRole('link', { name: 'Compare the Limits' }).getAttribute('href'),
    ).toBe('#compare');
    fireEvent.click(within(card('pro')).getByRole('button', { name: 'Get Pro' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(navigate.mock.calls[0]![0]).toContain('/subscription/checkout?session=c1');
    expect(calls.find((call) => call.path === '/checkout')!.body).toMatchObject({
      owner: 'p:user_ada',
    });
  });

  it('Get Pro for Teams opens the upgrade dialog on A Team, where the team is chosen', async () => {
    const { card } = pricing(
      { me: meResponse({ teams: [team('t:team_garden', 'Garden Club', 'admin')] }) },
      'in',
    );
    const button = within(card('team')).getByRole('button', { name: 'Get Pro for Teams' });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'One Upgrade, Every App' });
    expect(
      dialog.querySelector('[role="group"][aria-label="Subscribe For"] [aria-pressed="true"]')
        ?.textContent,
    ).toBe('A Team');
  });

  it('a subscriber: Pro is their tier, and its button manages billing', async () => {
    const { calls, navigate, card } = pricing(
      { me: meResponse({ personal: summary('p:user_ada', 'pro') }) },
      'in',
    );
    await waitFor(() => expect(within(card('pro')).getByText('Your Tier')).toBeTruthy());
    expect(within(card('free')).queryByText('Your Tier')).toBeNull();
    fireEvent.click(within(card('pro')).getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.some((call) => call.path === '/portal')).toBe(true);
  });

  it('a subscriber is told where their subscription stands, in the line under the cards', async () => {
    const day = Date.UTC(2026, 11, 20);
    const line = () => document.querySelector('[data-standing]');
    // A visitor's line, which a subscriber's replaces in place: the page does not move.
    pricing({}, 'out');
    expect(line()).toBeNull();
    expect(screen.getByText(/Monthly, with no yearly commitment/)).toBeTruthy();
    cleanup();

    expect(standingSentence(summary('p:user_ada', 'pro', { periodEnd: day }))).toBe(
      `Your Pro renews on ${formatDay(day)}. Cancel any time in Manage Billing.`,
    );
    expect(
      standingSentence(summary('p:user_ada', 'pro', { state: 'cancelling', periodEnd: day })),
    ).toBe(`Your Pro ends on ${formatDay(day)}. Keep it in Manage Billing.`);
    expect(standingSentence(summary('p:user_ada', 'pro', { periodEnd: null }))).toBeNull();
    expect(standingSentence(summary('p:user_ada', 'free'))).toBeNull();
    expect(
      standingSentence(summary('p:user_ada', 'pro', { state: 'ended', periodEnd: day })),
    ).toBeNull();

    pricing(
      {
        me: meResponse({
          personal: summary('p:user_ada', 'pro', { state: 'past_due', graceEnds: day }),
        }),
      },
      'in',
    );
    await waitFor(() => expect(line()).not.toBeNull());
    expect(line()!.getAttribute('data-standing')).toBe('past_due');
    expect(line()!.textContent).toBe(
      `Your Pro payment failed. It stays on until ${formatDay(day)}: update your payment in Manage Billing.`,
    );
    expect(line()!.className).toContain('text-amber-800');
    expect(screen.queryByText(/Monthly, with no yearly commitment/)).toBeNull();
  });

  it('before the page knows who is here it is the signed-out page, with no usage column to drop again', () => {
    const { calls, card } = pricing({}, 'checking');
    expect(within(card('pro')).getByRole('link', { name: 'Get Pro' })).toBeTruthy();
    expect(within(card('free')).getByRole('link', { name: 'Start Free' })).toBeTruthy();
    expect(
      within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Your Usage Now' }),
    ).toBeNull();
    expect(calls).toEqual([]);
  });

  it('a subscription that cannot be read says so, with the way to try again', async () => {
    const service: Service = { down: true };
    const { calls, card } = pricing(service, 'in');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load your subscription');
    expect(
      within(card('pro')).getByRole<HTMLButtonElement>('button', { name: 'Get Pro' }).disabled,
    ).toBe(true);
    service.down = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await waitFor(() => expect(within(card('free')).getByText('Your Tier')).toBeTruthy());
    expect(calls.filter((call) => call.path === '/me')).toHaveLength(2);
  });

  it('a refused checkout says why under the tiers', async () => {
    const { card, navigate } = pricing(
      { refuse: { status: 409, error: 'already_subscribed' } },
      'in',
    );
    const button = within(card('pro')).getByRole('button', { name: 'Get Pro' });
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    expect((await screen.findByRole('alert')).textContent).toContain('This is already subscribed.');
    expect(navigate).not.toHaveBeenCalled();
  });
});
