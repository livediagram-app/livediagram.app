// @vitest-environment jsdom
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  formatPrice,
  formatTierLimit,
  LIMIT_GROUPS,
  LIMIT_ROWS,
  PRICES,
  TEAM_SEATS_MIN,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { SubscriptionProvider, preloadUpgradeDialog } from '../provider/SubscriptionProvider';
import { useUpgrade } from '../provider/hooks';
import type { UpgradeTarget } from '../provider/context';
import {
  GARDEN,
  ME,
  meResponse,
  serviceFetch,
  SIDE,
  summary,
  team,
  tokenOf,
  withProvider,
  type Service,
} from '../test/fixture';
import { usageWords } from '../usage';

// subscription.md "What people see", "The upgrade dialog".

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);

function Open({ target }: { target?: UpgradeTarget }) {
  const { openUpgrade } = useUpgrade();
  useEffect(() => openUpgrade(target), [openUpgrade, target]);
  return null;
}

async function openDialog(service: Service = {}, target: UpgradeTarget = {}) {
  const { fetcher, calls } = serviceFetch(service);
  const navigate = vi.fn();
  render(withProvider(<Open target={target} />, fetcher, navigate));
  const dialog = await screen.findByRole('dialog', { name: 'One Upgrade, Every App' });
  await waitFor(() => expect(calls.some((call) => call.path === '/me')).toBe(true));
  return { dialog, calls, navigate };
}

const pressed = (dialog: HTMLElement) =>
  dialog.querySelector('[role="group"][aria-label="Subscribe For"] [aria-pressed="true"]')
    ?.textContent;

// The rows the comparison draws: every row the tiers differ on (Largest Image is the same on every tier).
const COMPARED = LIMIT_ROWS.filter((row) => row.compared !== false);

describe('UpgradeDialog', () => {
  it('draws the comparison from LIMIT_ROWS: every compared row, grouped, with each tier’s figure', async () => {
    const { dialog } = await openDialog();
    const table = within(dialog).getByRole('table', { name: 'What each tier allows' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent)
        .filter((text) => !LIMIT_GROUPS.some((group) => group === text)),
    ).toEqual(['What You Get', 'Your Usage Now', 'Free', 'Pro', 'Pro for Teams']);
    // The groups, in the contract's order, each heading its own rows.
    const groups = within(table)
      .getAllByRole('rowgroup')
      .slice(1)
      .map((group) => ({
        heading: within(group).getAllByRole('columnheader')[0]!.textContent,
        rows: [...group.querySelectorAll('[data-limit-row]')].map((row) =>
          row.getAttribute('data-limit-row'),
        ),
      }));
    expect(groups).toEqual(
      LIMIT_GROUPS.map((group) => ({
        heading: group,
        rows: COMPARED.filter((row) => row.group === group).map((row) => row.key),
      })),
    );
    for (const row of COMPARED) {
      const line = table.querySelector(`[data-limit-row="${row.key}"]`) as HTMLElement;
      expect(within(line).getByRole('rowheader').textContent).toContain(row.label);
      const cells = within(line).getAllByRole('cell');
      expect(cells.slice(1).map((cell) => cell.textContent)).toEqual([
        formatTierLimit(row, 'free'),
        formatTierLimit(row, 'pro'),
        formatTierLimit(row, 'team'),
      ]);
      // Each row carries its app's logo and its explanation behind an info button.
      expect(line.querySelector('svg')).not.toBeNull();
      expect(within(line).getByRole('button', { name: `What ${row.label} Means` })).toBeTruthy();
    }
  });

  it('shows your usage now, and a quiet cell (read out as not applicable) where a row has none', async () => {
    const { dialog } = await openDialog();
    const table = within(dialog).getByRole('table');
    const runs = LIMIT_ROWS.find((row) => row.key === 'automationRunsPerMonth')!;
    await waitFor(() =>
      expect(
        within(
          table.querySelector('[data-limit-row="automationRunsPerMonth"]') as HTMLElement,
        ).getAllByRole('cell')[0]!.textContent,
      ).toBe(usageWords(runs, 205, 500)),
    );
    const cell = (key: string) =>
      within(table.querySelector(`[data-limit-row="${key}"]`) as HTMLElement).getAllByRole(
        'cell',
      )[0]!.textContent;
    expect(cell('automationRules')).toBe('6 of 25');
    expect(cell('walkthroughMaxMs')).toBe('Not applicable');
    // The same on every tier, so not compared (owner, 2026-11-23).
    expect(table.querySelector('[data-limit-row="imageMaxBytes"]')).toBeNull();
    // Free's 500 a month, none taken yet: counted all the same.
    expect(cell('formResponsesPerMonth')).toBe('0 of 500 this month');
    expect(table.querySelector('[data-limit-row="webhookDeliveriesPerMonth"]')).toBeNull();
    // Said to a screen reader only: the eye gets a quiet cell, as the design draws it.
    expect(
      table.querySelector('[data-limit-row="walkthroughMaxMs"] [role="cell"] .sr-only'),
    ).not.toBeNull();
  });

  it('a row’s info button shows its explanation on a tap, and Escape closes it without closing the dialog', async () => {
    const { dialog } = await openDialog();
    const row = LIMIT_ROWS[0]!;
    const info = within(dialog).getByRole('button', { name: `What ${row.label} Means` });
    expect(info.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('tooltip').textContent).toBe(row.info);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'One Upgrade, Every App' })).toBeTruthy();
  });

  it('formats the price from the service for the locale: a month, and a member a month for a team', async () => {
    const { dialog } = await openDialog({
      me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'admin')] }),
    });
    const price = () => dialog.querySelector('[data-upgrade-price]') as HTMLElement;
    await waitFor(() =>
      expect(price().textContent).toBe(
        `${formatPrice(PRICES.GBP.pro, 'GBP')}a month, cancel any time`,
      ),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'A Team' }));
    expect(price().getAttribute('data-upgrade-price')).toBe('team');
    expect(price().textContent).toBe(
      `${formatPrice(PRICES.GBP.team, 'GBP')}a member a month, ${TEAM_SEATS_MIN} or more`,
    );
    // What this team would pay: six members, six seats.
    expect(dialog.textContent).toContain(
      `Garden Club has 6 members: 6 seats, ${formatPrice(PRICES.GBP.team * 6, 'GBP')} a month.`,
    );
  });

  it('reads badge, title and sentence first on a phone, with the price beside the button that buys it', async () => {
    const { dialog } = await openDialog();
    const header = dialog.querySelector('header') as HTMLElement;
    await waitFor(() =>
      expect(dialog.querySelector('[data-upgrade-price-phone]')!.textContent).toBe(
        `${formatPrice(PRICES.GBP.pro, 'GBP')}a month`,
      ),
    );
    // Its note moves into the footer's sentence, so the price stays on one line beside the buttons.
    expect(dialog.querySelector('[data-upgrade-cancel-phone]')!.textContent).toContain(
      'Cancel any time.',
    );
    // The header's first column is the badge, then the title, then the sentence; its price only from `sm`.
    const lead = header.firstElementChild as HTMLElement;
    expect([...lead.children].map((child) => child.tagName)).toEqual(['SPAN', 'H2', 'P']);
    expect(header.querySelector('[data-upgrade-price]')!.className).toContain('max-sm:hidden');
    // On a phone the price is in the footer, ahead of Not Now and the primary button.
    const phone = dialog.querySelector('[data-upgrade-price-phone]') as HTMLElement;
    expect(phone.closest('footer')).toBeTruthy();
    expect(phone.className).toContain('sm:hidden');
    expect(phone.nextElementSibling!.textContent).toBe('Not Now');
  });

  it('prices follow the service’s currency', async () => {
    const { dialog } = await openDialog({
      me: meResponse({ prices: { currency: 'USD', ...PRICES.USD } }),
    });
    await waitFor(() =>
      expect(dialog.querySelector('[data-upgrade-price]')!.textContent).toContain(
        formatPrice(PRICES.USD.pro, 'USD'),
      ),
    );
  });

  it('Just Me: Upgrade to Pro starts a checkout for the person and sends the browser to it', async () => {
    const { dialog, calls, navigate } = await openDialog({
      checkoutUrl: 'https://pay.example/c/1',
    });
    expect(pressed(dialog)).toBe('Just Me');
    const upgrade = await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    await waitFor(() => expect(upgrade.hasAttribute('disabled')).toBe(false));
    fireEvent.click(upgrade);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('https://pay.example/c/1'));
    const sent = calls.find((call) => call.path === '/checkout')!;
    expect(sent.method).toBe('POST');
    expect((sent.body as { owner: OwnerScope }).owner).toBe(ME);
    // Still busy while the page leaves, so a second press starts nothing.
    expect(
      within(dialog)
        .getByRole('button', { name: /Opening Checkout/ })
        .getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('A Team: the usage is the team’s, the column offered is Pro for Teams, and the checkout is the team’s', async () => {
    const { dialog, calls, navigate } = await openDialog({
      me: meResponse({
        teams: [team(GARDEN, 'Garden Club', 'admin', 'free', { usage: { rules: { used: 9 } } })],
      }),
    });
    await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'A Team' }));
    expect(pressed(dialog)).toBe('A Team');
    const table = within(dialog).getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Team Usage Now' })).toBeTruthy();
    expect(
      within(table.querySelector('[data-limit-row="automationRules"]') as HTMLElement).getAllByRole(
        'cell',
      )[0]!.textContent,
    ).toBe('9 of 25');
    // One team: named, with no picker.
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Get Pro for Teams' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(
      (calls.find((call) => call.path === '/checkout')!.body as { owner: OwnerScope }).owner,
    ).toBe(GARDEN);
  });

  it('A Team with no team: no usage column left pulsing, and the button waits for a team', async () => {
    const { dialog } = await openDialog();
    const headers = () =>
      within(within(dialog).getByRole('table'))
        .getAllByRole('columnheader')
        .slice(0, 5)
        .map((header) => header.textContent);
    await waitFor(() => expect(headers()).toContain('Your Usage Now'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'A Team' }));
    expect(headers()).not.toContain('Team Usage Now');
    expect(dialog.querySelector('[role="table"] .animate-pulse')).toBeNull();
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Get Pro for Teams' }).disabled,
    ).toBe(true);
    expect(dialog.textContent).toContain('Create a team in the Explorer first');
  });

  it('more than one team: a picker, and a team they are only a member of shows Ask an Admin', async () => {
    const { dialog, calls } = await openDialog({
      me: meResponse({
        teams: [team(SIDE, 'Side Projects', 'member'), team(GARDEN, 'Garden Club', 'admin')],
      }),
    });
    await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'A Team' }));
    const picker = within(dialog).getByRole('combobox', { name: 'Team' }) as HTMLSelectElement;
    // It starts on the team they run.
    expect(picker.value).toBe('team_garden');
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      'Side Projects (member)',
      'Garden Club',
    ]);
    expect(within(dialog).getByRole('button', { name: 'Get Pro for Teams' })).toBeTruthy();
    fireEvent.change(picker, { target: { value: 'team_side' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ask an Admin' }));
    expect(await screen.findByRole('dialog', { name: 'Ask an Admin About Pro' })).toBeTruthy();
    expect(calls.some((call) => call.path === '/checkout')).toBe(false);
  });

  it('opens on A Team, on that team, for a team’s item, and points at the limit that was met', async () => {
    const { dialog } = await openDialog(
      {
        me: meResponse({
          teams: [team(GARDEN, 'Garden Club', 'admin'), team(SIDE, 'Side Projects', 'admin')],
        }),
      },
      { owner: SIDE, limit: 'automationRules' },
    );
    await waitFor(() => expect(pressed(dialog)).toBe('A Team'));
    await waitFor(() =>
      expect(
        (within(dialog).getByRole('combobox', { name: 'Team' }) as HTMLSelectElement).value,
      ).toBe('team_side'),
    );
    const used = within(
      dialog.querySelector('[data-limit-row="automationRules"]') as HTMLElement,
    ).getAllByRole('cell')[0]!;
    expect(used.querySelector('.text-amber-800')).not.toBeNull();
  });

  it('already on Pro: Manage Billing opens the portal', async () => {
    const { dialog, calls, navigate } = await openDialog({
      me: meResponse({ personal: summary(ME, 'pro') }),
    });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Manage Billing' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(calls.some((call) => call.path === '/portal')).toBe(true);
    expect(calls.some((call) => call.path === '/checkout')).toBe(false);
  });

  it('a refused checkout says why and lets the person try again', async () => {
    const { dialog, navigate } = await openDialog({
      refuse: { status: 403, error: 'not_team_admin' },
    });
    const upgrade = await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    await waitFor(() => expect(upgrade.hasAttribute('disabled')).toBe(false));
    fireEvent.click(upgrade);
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Only a team admin can subscribe this team');
    expect(navigate).not.toHaveBeenCalled();
    expect(
      within(dialog).getByRole('button', { name: 'Upgrade to Pro' }).getAttribute('aria-busy'),
    ).toBeNull();
  });

  it('says plainly when billing is not set up, or cannot be changed as it stands', async () => {
    for (const [error, status, words] of [
      [
        'billing_unavailable',
        503,
        'Subscriptions can’t be bought or changed here yet. Nothing was charged.',
      ],
      ['accounts_unavailable', 503, 'Couldn’t confirm you’re an admin of this team just now.'],
      ['invalid_state', 409, 'That can’t be done to this subscription as it is now.'],
    ] as const) {
      const { dialog } = await openDialog({ refuse: { status, error } });
      const upgrade = await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
      await waitFor(() => expect(upgrade.hasAttribute('disabled')).toBe(false));
      fireEvent.click(upgrade);
      const alert = await within(dialog).findByRole('alert');
      expect(alert.textContent, error).toContain(words);
      expect(alert.textContent).not.toContain('Check your connection');
      cleanup();
    }
  });

  it('back from the checkout by the browser’s back: the button is let go, not left spinning', async () => {
    const { dialog } = await openDialog({ checkoutUrl: 'https://pay.example/c/1' });
    const upgrade = await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    await waitFor(() => expect(upgrade.hasAttribute('disabled')).toBe(false));
    fireEvent.click(upgrade);
    // On its way: busy, as it should be while the page leaves.
    await within(dialog).findByRole('button', { name: /Opening Checkout/ });
    // The back cache shows the page again exactly as it was left, and runs none of its code but `pageshow`.
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    const again = await within(dialog).findByRole('button', { name: 'Upgrade to Pro' });
    expect(again.getAttribute('aria-busy')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Opening Checkout/ })).toBeNull();
  });

  it('signed out: the comparison without a usage column, and Sign In to Upgrade back to this page', async () => {
    const { fetcher } = serviceFetch();
    render(
      <SubscriptionProvider
        getToken={tokenOf(null)}
        fetch={fetcher}
        account="out"
        signInHref={(returnTo) => `/sign-in?return=${encodeURIComponent(returnTo)}`}
      >
        <Open />
      </SubscriptionProvider>,
    );
    const dialog = await screen.findByRole('dialog', { name: 'One Upgrade, Every App' });
    expect(within(dialog).queryByRole('columnheader', { name: 'Your Usage Now' })).toBeNull();
    const link = within(dialog).getByRole('link', { name: 'Sign In to Upgrade' });
    expect(link.getAttribute('href')).toBe(
      `/sign-in?return=${encodeURIComponent(window.location.href)}`,
    );
    await waitFor(() =>
      expect(dialog.querySelector('[data-upgrade-price]')!.textContent).toContain(
        formatPrice(PRICES.GBP.pro, 'GBP'),
      ),
    );
  });

  it('a subscription that cannot be read: the comparison still, and Try Again reads it', async () => {
    const service: Service = { down: true };
    const { fetcher, calls } = serviceFetch(service);
    render(withProvider(<Open />, fetcher));
    const dialog = await screen.findByRole('dialog', { name: 'One Upgrade, Every App' });
    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('Couldn’t load your subscription.');
    expect(dialog.querySelectorAll('[data-limit-row]')).toHaveLength(COMPARED.length);
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Upgrade to Pro' }).disabled,
    ).toBe(true);
    service.down = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    await waitFor(() =>
      expect(
        within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Upgrade to Pro' }).disabled,
      ).toBe(false),
    );
    expect(calls.filter((call) => call.path === '/me')).toHaveLength(2);
  });

  it('Not Now closes it', async () => {
    const { dialog } = await openDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Not Now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
