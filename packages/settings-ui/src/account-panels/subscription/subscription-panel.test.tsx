// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatPrice,
  formatTierLimit,
  LIMIT_GROUPS,
  LIMIT_ROWS,
  PRICES,
  type MeResponse,
  type OwnerScope,
} from '@liveworkspace/subscription';
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
import { accountCategories } from '../../account-model';
import { SettingsCategoryTile } from '../../glyphs';
import { SettingsCategoryList } from '../../SettingsCategoryList';
import type { SettingsRow } from '../../model';
import { accountPanels } from '../lazy';
import { bearerSettingsRequest } from '../../request';
import { preloadSubscriptionPanel, subscriptionRows } from './rows';
import { SubscriptionScope } from './SubscriptionScope';
import { SubscriptionTierHint } from './TierHint';

// Settings › Subscription (liveworkspace/docs/specs/019-subscription/subscription.md "What people see"): your tier,
// your teams and your usage, with the banners for a failed renewal and a cancel still running out.

const ME: OwnerScope = 'p:user_ada';
const NORTH: OwnerScope = 't:team_north';
const GARDEN: OwnerScope = 't:team_garden';
const SIDE: OwnerScope = 't:team_side';
const RENEWS = Date.UTC(2026, 11, 20);
const GRACE_ENDS = Date.UTC(2026, 10, 27);

const request = bearerSettingsRequest({ baseUrl: '/api/account', token: async () => 'tok' });

beforeAll(async () => {
  await Promise.all([preloadSubscriptionPanel(), preloadUpgradeDialog()]);
}, 60_000);

beforeEach(() => {
  setProForTests(true);
  localStorage.clear();
});
afterEach(() => {
  setProForTests(null);
  vi.unstubAllGlobals();
});

const renderRow = (row: SettingsRow): ReactNode => (row.kind === 'custom' ? row.render() : null);

/** The category's three cells, as the panel draws them, over the service the test stands in. */
async function panel(service: Service = {}, token: string | null = 'tok') {
  const { fetcher, calls } = serviceFetch(service);
  const navigate = vi.fn();
  render(
    <SubscriptionProvider getToken={tokenOf(token)} fetch={fetcher} navigate={navigate}>
      {subscriptionRows().map((row) => (
        <div key={row.key}>{renderRow(row)}</div>
      ))}
    </SubscriptionProvider>,
  );
  const cell = (name: string) =>
    document.querySelector(`[data-settings-cell="subscription-${name}"]`) as HTMLElement;
  // The cells' own chunk has landed.
  await waitFor(() => expect(cell('tier').querySelector('[aria-busy].rounded-lg')).toBeNull());
  return { calls, navigate, tier: cell('tier'), teams: cell('teams'), usage: cell('usage') };
}

const ready = (tier: HTMLElement) =>
  waitFor(() => expect(tier.querySelector('[data-subscription-tier]')).not.toBeNull());

describe('the Subscription category', () => {
  it('is listed after Profile, with a tile of its own, only with Pro on and a way to the service', () => {
    const base = { all: {}, set: () => {}, identity: { name: 'Ada', email: null, colour: null } };
    const access = { getToken: tokenOf('tok') };
    const ids = (section: Parameters<typeof accountCategories>[0]) =>
      accountCategories(section).map((category) => category.id);
    expect(ids({ ...base, subscription: access }).slice(0, 3)).toEqual([
      'account',
      'subscription',
      'notifications',
    ]);
    expect(ids(base)).not.toContain('subscription');
    const category = accountCategories({ ...base, subscription: access }).find(
      (c) => c.id === 'subscription',
    )!;
    expect(category.label).toBe('Subscription');
    expect(category.rows.map((row) => [row.key, row.section])).toEqual([
      ['subscriptionTier', undefined],
      ['subscriptionTeams', 'Your Teams'],
      ['subscriptionUsage', 'Your Usage'],
    ]);
    const { container } = render(<SettingsCategoryTile id="subscription" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.firstElementChild!.classList).toContain('bg-slate-900');

    setProForTests(false);
    expect(ids({ ...base, subscription: access })).not.toContain('subscription');
  });

  it('names the tier at the right of its row in the rail, once the service has answered', async () => {
    const base = { all: {}, set: () => {}, identity: { name: 'Ada', email: null, colour: null } };
    const categories = accountCategories({ ...base, subscription: { getToken: tokenOf('tok') } });
    const rail = (service: Service) => {
      const { fetcher } = serviceFetch(service);
      return render(
        <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
          <SettingsCategoryList
            categories={[...categories]}
            selected={null}
            onSelect={() => {}}
            variant="sidebar"
          />
        </SubscriptionProvider>,
      );
    };
    const hint = () =>
      screen.getByRole('button', { name: /^Subscription/ }).querySelector('[data-settings-hint]');
    const free = rail({});
    // Nothing is drawn, and no room is kept, until there is a tier to name.
    expect(hint()!.textContent).toBe('');
    await waitFor(() => expect(hint()!.textContent).toBe('Free'));
    free.unmount();
    rail({ me: meResponse({ personal: summary(ME, 'pro') }) });
    await waitFor(() => expect(hint()!.textContent).toBe('Pro'));
    // No other category carries a hint.
    expect(document.querySelectorAll('[data-settings-hint]')).toHaveLength(1);
  });

  it('with Pro off the hint draws nothing and asks nothing', () => {
    setProForTests(false);
    const { fetcher, calls } = serviceFetch();
    const { container } = render(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
        <SubscriptionTierHint />
      </SubscriptionProvider>,
    );
    expect(container.textContent).toBe('');
    expect(calls).toEqual([]);
  });

  it('reaches every host through accountPanels, where the host hands the service in', () => {
    const access = { getToken: tokenOf('tok'), origin: () => 'https://www.liveworkspace.app' };
    expect(accountPanels({ request, subscription: access }).subscription).toBe(access);
    expect('subscription' in accountPanels({ request })).toBe(false);
  });

  it('with Pro off the panel asks the service nothing', async () => {
    setProForTests(false);
    const { fetcher, calls } = serviceFetch();
    vi.stubGlobal('fetch', fetcher);
    const { container } = render(
      <SubscriptionScope access={{ getToken: tokenOf('tok') }}>
        <p>Settings</p>
      </SubscriptionScope>,
    );
    await Promise.resolve();
    expect(container.textContent).toBe('Settings');
    expect(calls).toEqual([]);
  });

  it('mounts its own read where the page has none: one for all three cells', async () => {
    const { fetcher, calls } = serviceFetch();
    const seen: string[] = [];
    vi.stubGlobal('fetch', ((input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(input));
      return fetcher(input, init);
    }) as typeof fetch);
    render(
      <SubscriptionScope
        access={{ getToken: tokenOf('tok'), origin: () => 'https://www.liveworkspace.app' }}
      >
        {subscriptionRows().map((row) => (
          <div key={row.key}>{renderRow(row)}</div>
        ))}
      </SubscriptionScope>,
    );
    await waitFor(() => expect(document.querySelector('[data-subscription-tier]')).not.toBeNull());
    expect(calls).toEqual([{ path: '/me', method: 'GET', auth: 'Bearer tok', body: null }]);
    // At the origin the host named, read when the panel was drawn.
    expect(seen).toEqual(['https://www.liveworkspace.app/api/subscription/me']);
  });

  it('uses the page’s own read where it has one, and asks nothing again', async () => {
    const outer = serviceFetch();
    render(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={outer.fetcher}>
        <SubscriptionScope access={{ getToken: tokenOf('other') }}>
          {subscriptionRows().map((row) => (
            <div key={row.key}>{renderRow(row)}</div>
          ))}
        </SubscriptionScope>
      </SubscriptionProvider>,
    );
    await waitFor(() => expect(document.querySelector('[data-subscription-tier]')).not.toBeNull());
    expect(outer.calls).toEqual([{ path: '/me', method: 'GET', auth: 'Bearer tok', body: null }]);
  });
});

describe('Settings › Subscription, your tier', () => {
  it('Free: what Pro adds, Upgrade to Pro and its price a month', async () => {
    const { tier } = await panel();
    await ready(tier);
    expect(
      tier.querySelector('[data-subscription-tier]')!.getAttribute('data-subscription-tier'),
    ).toBe('free');
    expect(within(tier).getByText('Free')).toBeTruthy();
    expect(within(tier).queryByRole('img', { name: 'You Have Pro' })).toBeNull();
    expect(within(tier).getByText(`${formatPrice(PRICES.GBP.pro, 'GBP')} a month`)).toBeTruthy();
    fireEvent.click(within(tier).getByRole('button', { name: 'Upgrade to Pro' }));
    expect(await screen.findByRole('dialog', { name: 'One Upgrade, Every App' })).toBeTruthy();
  });

  it('Pro: the badge, the price in the subscription’s own currency, the renewal day and Manage Billing', async () => {
    const me = meResponse({
      personal: summary(ME, 'pro', { currency: 'USD', amount: 10, periodEnd: RENEWS }),
      // The visitor's own prices are another currency: the subscription's wins.
      prices: { currency: 'GBP', ...PRICES.GBP },
    });
    const { tier, calls, navigate } = await panel({ me });
    await ready(tier);
    expect(within(tier).getByRole('img', { name: 'You Have Pro' })).toBeTruthy();
    expect(
      within(tier).getByText(`${formatPrice(10, 'USD')} a month. Renews ${formatDay(RENEWS)}.`),
    ).toBeTruthy();
    expect(within(tier).queryByRole('button', { name: 'Upgrade to Pro' })).toBeNull();
    expect(within(tier).queryByRole('status')).toBeNull();
    fireEvent.click(within(tier).getByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.find((call) => call.path === '/portal')!.body).toMatchObject({ owner: ME });
  });

  it('past due: the banner with the day grace ends, and Update Payment opens the portal', async () => {
    const me = meResponse({
      personal: summary(ME, 'pro', { state: 'past_due', graceEnds: GRACE_ENDS, periodEnd: RENEWS }),
    });
    const { tier, calls, navigate } = await panel({ me });
    await ready(tier);
    const banner = within(tier).getByRole('status');
    expect(banner.getAttribute('data-callout')).toBe('warning');
    expect(banner.textContent).toContain('This Month’s Payment Didn’t Go Through');
    // The day the service names: the later of the paid period's end and grace's, never "7 days" by rote.
    expect(banner.textContent).toContain(
      `Pro stays on until ${formatDay(GRACE_ENDS)} while you sort it out.`,
    );
    expect(banner.textContent).not.toContain('7 days');
    fireEvent.click(within(banner).getByRole('button', { name: 'Update Payment' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.some((call) => call.path === '/portal')).toBe(true);
    // Still Pro while in grace.
    expect(within(tier).getByRole('img', { name: 'You Have Pro' })).toBeTruthy();
  });

  it('cancelling: the banner with the day Pro ends, and Keep Pro opens the portal', async () => {
    const me = meResponse({
      personal: summary(ME, 'pro', { state: 'cancelling', periodEnd: RENEWS }),
    });
    const { tier, calls, navigate } = await panel({ me });
    await ready(tier);
    const banner = within(tier).getByRole('status');
    expect(banner.getAttribute('data-callout')).toBe('info');
    expect(banner.textContent).toContain(`Pro Ends on ${formatDay(RENEWS)}`);
    expect(banner.textContent).toContain('you won’t be charged again');
    expect(within(tier).getByText(new RegExp(`Ends ${formatDay(RENEWS)}\\.$`))).toBeTruthy();
    fireEvent.click(within(banner).getByRole('button', { name: 'Keep Pro' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.some((call) => call.path === '/portal')).toBe(true);
  });

  const ENDED = Date.UTC(2026, 10, 18);
  const ended = (over: Parameters<typeof summary>[2] = {}) =>
    meResponse({ personal: summary(ME, 'free', { endedAt: ENDED, endedTier: 'pro', ...over }) });

  it('back on Free, as the service says: what changed, nothing deleted, and the way back', async () => {
    const { tier } = await panel({
      me: ended({ usage: { imageStorageBytes: { used: 2_100_000_000 } } }),
    });
    await ready(tier);
    const card = tier.querySelector('[data-back-on-free]') as HTMLElement;
    expect(card.getAttribute('data-back-on-free')).toBe('pro');
    expect(within(card).getByRole('heading', { name: 'You’re Back on Free' })).toBeTruthy();
    expect(card.textContent).toContain('Pro has ended. Nothing was deleted.');
    const change = (key: string) =>
      card.querySelector(`[data-lapsed-change="${key}"]`)!.textContent;
    expect(change('runs')).toBe(
      'Automation Runs500 a month across all your items again, down from 10,000. Rules that send to Slack, Teams or a webhook stay on.Lower Limit',
    );
    expect(change('rules')).toBe(
      'Automation Rules25 across all your items, down from 500. Every rule stays; new ones wait until you are under.Lower Limit',
    );
    // Over Free's storage: every image stays, and uploads wait.
    expect(change('images')).toBe(
      'Image Storage2.1 GB of 500 MB. Every image stays; uploads pause until you are under.Uploads Paused',
    );
    expect(change('history')).toContain('kept for 7 days.');
    // One leading button: the card's, while it is shown.
    expect(
      within(tier)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Go Pro Again', 'Dismiss', 'Upgrade to Pro']);
    fireEvent.click(within(card).getByRole('button', { name: 'Go Pro Again' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('back on Free: under the storage limit it is only smaller, and Dismiss tells the service', async () => {
    const { tier, calls } = await panel({ me: ended() });
    await ready(tier);
    const card = tier.querySelector('[data-back-on-free]') as HTMLElement;
    expect(card.querySelector('[data-lapsed-change="images"]')!.textContent).toBe(
      'Image Storage500 MB again, down from 50 GB. Every image stays.Lower Limit',
    );
    fireEvent.click(within(card).getByRole('button', { name: 'Dismiss' }));
    expect(tier.querySelector('[data-back-on-free]')).toBeNull();
    // The service keeps the word, so another browser says nothing either.
    await waitFor(() =>
      expect(calls.find((call) => call.path === '/ended/dismiss')).toMatchObject({
        method: 'POST',
        body: { owner: ME },
      }),
    );
    // Nothing is kept in this browser.
    expect(localStorage.length).toBe(0);
  });

  it('Free with no word of an ending from the service says nothing of going back', async () => {
    const free = await panel();
    await ready(free.tier);
    expect(free.tier.querySelector('[data-back-on-free]')).toBeNull();
    // Whatever an older build left in this browser is not read.
    localStorage.setItem(`liveworkspace:subscription:paid:${ME}`, 'pro');
    const again = await panel();
    await ready(again.tier);
    expect(again.tier.querySelector('[data-back-on-free]')).toBeNull();
  });

  it('a refused portal says why, in place', async () => {
    const me = meResponse({ personal: summary(ME, 'pro') });
    const { tier, navigate } = await panel({
      me,
      refuse: { status: 409, error: 'not_subscribed' },
    });
    await ready(tier);
    fireEvent.click(within(tier).getByRole('button', { name: 'Manage Billing' }));
    expect((await within(tier).findByRole('alert')).textContent).toContain(
      'There is no subscription here to manage yet.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('while the service answers, each cell holds its shape', async () => {
    let answer: (me: MeResponse) => void = () => {};
    const pending = new Promise<MeResponse>((resolve) => (answer = resolve));
    const fetcher = (async () =>
      new Response(JSON.stringify(await pending), { status: 200 })) as typeof fetch;
    render(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
        {subscriptionRows().map((row) => (
          <div key={row.key}>{renderRow(row)}</div>
        ))}
      </SubscriptionProvider>,
    );
    await waitFor(() =>
      expect(screen.getAllByLabelText('Loading your subscription')).toHaveLength(3),
    );
    answer(meResponse());
    await waitFor(() => expect(document.querySelector('[data-subscription-tier]')).not.toBeNull());
    expect(screen.queryByLabelText('Loading your subscription')).toBeNull();
  });

  it('signed out: says so, and asks nothing', async () => {
    const { tier, teams, usage, calls } = await panel({}, null);
    await waitFor(() => expect(tier.textContent).toContain('Sign in to see your subscription.'));
    expect(teams.textContent).toBe('Shown once you are signed in.');
    expect(usage.textContent).toBe('Shown once you are signed in.');
    expect(calls).toEqual([]);
  });

  it('an unreachable service: one error with Try Again, which reads again', async () => {
    const service: Service = { down: true };
    const { tier, teams, calls } = await panel(service);
    const alert = await within(tier).findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load your subscription.');
    expect(teams.textContent).toBe('Not loaded.');
    service.down = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await ready(tier);
    expect(calls.filter((call) => call.path === '/me')).toHaveLength(2);
  });
});

describe('Settings › Subscription, your teams', () => {
  const me = meResponse({
    teams: [
      team(NORTH, 'Northwind Studio', 'admin', 'team', {
        members: 12,
        seats: 12,
        amount: 72,
        periodEnd: RENEWS,
      }),
      team(GARDEN, 'Garden Club', 'admin'),
      team(SIDE, 'Side Projects', 'member', 'free', { members: 4 }),
    ],
  });
  const row = (teams: HTMLElement, id: string) =>
    teams.querySelector(`[data-subscription-team="${id}"]`) as HTMLElement;

  it('an admin of a subscribed team: its tier, cost and renewal, and Manage Billing', async () => {
    const { tier, teams, calls, navigate } = await panel({ me });
    await ready(tier);
    const north = row(teams, 'team_north');
    expect(
      within(north).getByRole('img', { name: 'Northwind Studio Has Pro for Teams' }),
    ).toBeTruthy();
    expect(north.textContent).toContain(
      `You’re an admin · 12 seats · ${formatPrice(72, 'GBP')} a month · Renews ${formatDay(RENEWS)}`,
    );
    fireEvent.click(
      within(north).getByRole('button', { name: 'Manage Billing: Northwind Studio' }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.find((call) => call.path === '/portal')!.body).toMatchObject({ owner: NORTH });
  });

  it('an admin of a team on Free: Upgrade Team opens the dialog on that team', async () => {
    const { tier, teams } = await panel({ me });
    await ready(tier);
    const garden = row(teams, 'team_garden');
    expect(garden.textContent).toContain('You’re an admin · 6 members · Free');
    expect(within(garden).queryByRole('img')).toBeNull();
    fireEvent.click(within(garden).getByRole('button', { name: 'Upgrade Team: Garden Club' }));
    const dialog = await screen.findByRole('dialog', { name: 'One Upgrade, Every App' });
    await waitFor(() =>
      expect(
        (within(dialog).getByRole('combobox', { name: 'Team' }) as HTMLSelectElement).value,
      ).toBe('team_garden'),
    );
  });

  it('a member: Ask an Admin, and never the team’s billing', async () => {
    const { tier, teams } = await panel({ me });
    await ready(tier);
    const side = row(teams, 'team_side');
    expect(side.textContent).toContain('You’re a member · 4 members · Free');
    expect(within(side).queryByRole('button', { name: /Upgrade|Manage/ })).toBeNull();
    fireEvent.click(within(side).getByRole('button', { name: 'Ask an Admin: Side Projects' }));
    expect(await screen.findByRole('dialog', { name: 'Ask an Admin About Pro' })).toBeTruthy();
  });

  it('an admin of a team on Free is told who asked for Pro for Teams, why, when and their note', async () => {
    const asked = Date.UTC(2026, 10, 21, 9);
    const { tier, teams } = await panel({
      me: meResponse({
        teams: [
          team(GARDEN, 'Garden Club', 'admin', 'free', {
            requests: {
              count: 7,
              latest: [
                {
                  name: 'Bea Lee',
                  limit: 'automationRules',
                  note: 'We need more rules.',
                  at: asked,
                },
                { name: null, limit: null, note: null, at: asked - 86_400_000 },
              ],
            },
          }),
          team(NORTH, 'Northwind Studio', 'admin', 'free', {
            requests: {
              count: 1,
              latest: [{ name: 'Cy', limit: null, note: null, at: asked }],
            },
          }),
        ],
      }),
    });
    await ready(tier);
    const garden = row(teams, 'team_garden').querySelector('[data-team-requests]') as HTMLElement;
    expect(garden.tagName).toBe('DETAILS');
    expect((garden as HTMLDetailsElement).open).toBe(false);
    expect(garden.querySelector('summary')!.textContent).toBe(
      '7 members have asked for Pro for Teams›',
    );
    expect(garden.textContent).toContain('Bea Lee · Automation Rules · 21 November');
    expect(garden.textContent).toContain('“We need more rules.”');
    expect(garden.textContent).toContain('A member · 20 November');
    expect(garden.textContent).toContain('and 5 more');
    expect(
      row(teams, 'team_north').querySelector('[data-team-requests] summary')!.textContent,
    ).toBe('Cy asked for Pro for Teams›');
  });

  it('a member who asked today is told so beside the team', async () => {
    const { tier, teams } = await panel({
      me: meResponse({
        teams: [
          team(SIDE, 'Side Projects', 'member', 'free', { askedAt: Date.UTC(2026, 10, 21, 9) }),
        ],
      }),
    });
    await ready(tier);
    const side = row(teams, 'team_side');
    expect(side.querySelector('[data-team-asked]')!.textContent).toBe('You asked on 21 November');
    expect(side.querySelector('[data-team-requests]')).toBeNull();
  });

  it('a member of a subscribed team sees its tier, not its price, and has nothing to press', async () => {
    const { tier, teams } = await panel({
      me: meResponse({
        teams: [team(NORTH, 'Northwind Studio', 'member', 'team', { amount: 72 })],
      }),
    });
    await ready(tier);
    const north = row(teams, 'team_north');
    expect(north.textContent).toContain('You’re a member · 3 seats · Pro for Teams');
    expect(north.textContent).not.toContain(formatPrice(72, 'GBP'));
    expect(north.querySelector('button')).toBeNull();
  });

  it('a member is sent a team’s tier and counts alone, and the panel draws that without its billing', async () => {
    // What the service sends someone who is not an admin: no currency, amount, renewal or grace day, on a paid tier.
    const stripped = team(NORTH, 'Northwind Studio', 'member', 'team', {
      state: 'past_due',
      currency: null,
      amount: null,
      periodEnd: null,
      graceEnds: null,
      usage: { rules: { used: 40 } },
    });
    const { tier, teams } = await panel({ me: meResponse({ teams: [stripped] }) });
    await ready(tier);
    const north = row(teams, 'team_north');
    expect(north.textContent).toContain('You’re a member · 3 seats · Pro for Teams');
    expect(north.textContent).not.toMatch(/null|undefined|NaN|Invalid Date/);
    expect(north.textContent).not.toMatch(/Renews|Payment failed|a month/);
    expect(north.querySelector('button')).toBeNull();
  });

  it('no teams: an empty state that says where teams are made', async () => {
    const { tier, teams } = await panel();
    await ready(tier);
    expect(teams.textContent).toContain('No Teams Yet');
    expect(teams.textContent).toContain('Create one in the Explorer');
  });
});

describe('Settings › Subscription, your usage', () => {
  it('lists every row from LIMIT_ROWS, grouped, each with its app’s logo', async () => {
    const { tier, usage } = await panel();
    await ready(tier);
    expect(
      [...usage.querySelectorAll('section')].map((section) => ({
        group: section.getAttribute('aria-label'),
        rows: [...section.querySelectorAll('[data-usage-row]')].map((row) =>
          row.getAttribute('data-usage-row'),
        ),
      })),
    ).toEqual(
      LIMIT_GROUPS.map((group) => ({
        group,
        rows: LIMIT_ROWS.filter((row) => row.group === group).map((row) => row.key),
      })),
    );
    for (const row of LIMIT_ROWS) {
      const line = usage.querySelector(`[data-usage-row="${row.key}"]`) as HTMLElement;
      expect(line.textContent).toContain(row.label);
      expect(line.querySelector('svg')).not.toBeNull();
    }
  });

  it('a meter where there is usage, and the limit as words where there is not', async () => {
    const { tier, usage } = await panel();
    await ready(tier);
    const line = (key: string) => usage.querySelector(`[data-usage-row="${key}"]`) as HTMLElement;
    const runs = within(line('automationRunsPerMonth')).getByRole('meter', {
      name: 'Automation Runs',
    });
    expect(runs.getAttribute('aria-valuetext')).toBe('205 of 500 this month');
    // Counted across every item, none named, and the grey figure is the limit on Pro.
    expect(line('automationRunsPerMonth').textContent).toContain('Every app');
    expect(line('automationRunsPerMonth').textContent).not.toContain('per item');
    expect(line('automationRunsPerMonth').textContent).toContain('10,000 a month on Pro');
    // Not counted: the limit in words.
    const history = LIMIT_ROWS.find((row) => row.key === 'historyDays')!;
    expect(within(line('historyDays')).queryByRole('meter')).toBeNull();
    expect(line('historyDays').textContent).toContain(formatTierLimit(history, 'free'));
    // Free's 500 a month, none taken yet: a meter like the rest.
    expect(
      within(line('formResponsesPerMonth')).getByRole('meter', { name: 'Form Responses' }),
    ).toBeTruthy();
    expect(usage.querySelector('[data-usage-row="webhookDeliveriesPerMonth"]')).toBeNull();
  });

  it('on Pro: Pro’s limits and no grey figures', async () => {
    const { tier, usage } = await panel({
      me: meResponse({
        personal: summary(ME, 'pro', { usage: { emailToBoard: { used: 40 } } }),
      }),
    });
    await ready(tier);
    expect(usage.textContent).not.toContain('on Pro');
    expect(usage.textContent).not.toContain('The grey figure');
    const hooks = usage.querySelector('[data-usage-row="emailToBoardPerMonth"]') as HTMLElement;
    expect(within(hooks).getByRole('meter').getAttribute('aria-valuetext')).toBe(
      '40 of 10,000 this month',
    );
    expect(within(hooks).queryByRole('button')).toBeNull();
  });
});
