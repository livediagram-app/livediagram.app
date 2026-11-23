// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { preloadUpgradeDialog, SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  meResponse,
  serviceFetch,
  setProForTests,
  summary,
  tokenOf,
  type Service,
} from '@liveworkspace/subscription-ui/testing';
import { AccountMenu } from './AccountMenu';
import { preloadProParts } from './pro-parts';

// The account menu and Pro (liveworkspace/docs/specs/019-subscription/subscription.md "What people see"): a solid
// badge beside the name for someone who has Pro, a quiet Upgrade to Pro for someone on Free, and nothing with Pro off.

beforeAll(async () => {
  await Promise.all([preloadUpgradeDialog(), preloadProParts()]);
}, 60_000);
beforeEach(() => setProForTests(true));
afterEach(() => setProForTests(null));

const signedIn = <AccountMenu name="Ada" fullName="Ada Lovelace" onSignOut={async () => true} />;

function under(service: Service, node: ReactNode) {
  const { fetcher, calls } = serviceFetch(service);
  render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      {node}
    </SubscriptionProvider>,
  );
  return calls;
}

const open = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Ada, account menu' }));
  return screen.getByRole('menu');
};

describe('the account menu, with Pro', () => {
  it('someone with Pro: the solid badge beside their name, and no upgrade item', async () => {
    const calls = under({ me: meResponse({ personal: summary('p:user_ada', 'pro') }) }, signedIn);
    await waitFor(() => expect(calls).toHaveLength(1));
    const menu = open();
    const badge = await within(menu).findByRole('img', { name: 'You Have Pro' });
    expect(badge.getAttribute('data-pro-badge')).toBe('solid');
    expect(badge.closest('p')!.textContent).toContain('Ada');
    expect(within(menu).queryByRole('menuitem', { name: /Upgrade to Pro/ })).toBeNull();
  });

  it('someone on Free: a quiet Upgrade to Pro that opens the upgrade dialog, and no badge', async () => {
    under({}, signedIn);
    const menu = open();
    const item = await within(menu).findByRole('menuitem', { name: /Upgrade to Pro/ });
    expect(item.textContent).toContain('Higher limits in every app');
    expect(within(menu).queryByRole('img', { name: 'You Have Pro' })).toBeNull();
    fireEvent.click(item);
    expect(await screen.findByRole('dialog', { name: 'One Upgrade, Every App' })).toBeTruthy();
    // The menu closed as the dialog opened.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('while the service has not answered, neither is shown', async () => {
    const calls = under({ down: true }, signedIn);
    const menu = open();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(within(menu).queryByRole('img', { name: 'You Have Pro' })).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /Upgrade to Pro|See Pro/ })).toBeNull();
  });

  it('with no provider on the page: See Pro, a link to the pricing page, and nothing asked', async () => {
    render(signedIn);
    const menu = open();
    const item = await within(menu).findByRole('menuitem', { name: /See Pro/ });
    expect(item.getAttribute('href')).toMatch(/\/pricing$/);
    expect(within(menu).queryByRole('img', { name: 'You Have Pro' })).toBeNull();
  });

  it('with Pro off: no badge and no item, even for a subscriber', async () => {
    setProForTests(false);
    const calls = under({ me: meResponse({ personal: summary('p:user_ada', 'pro') }) }, signedIn);
    const menu = open();
    await Promise.resolve();
    expect(within(menu).queryByRole('img')).toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: /Upgrade to Pro|See Pro/ })).toBeNull();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['SettingsProfile, emails, API tokens', 'Sign OutEvery app in this browser']);
    expect(calls).toEqual([]);
  });

  it('a guest keeps their menu as it was, Pro on or off', () => {
    render(<AccountMenu guest={{ signInHref: '/sign-in', signUpHref: '/sign-up' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Guest, account menu' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('Free, and one account for every app')).toBeTruthy();
    expect(within(menu).queryByRole('menuitem', { name: /Upgrade to Pro|See Pro/ })).toBeNull();
    expect(within(menu).queryByRole('img', { name: 'You Have Pro' })).toBeNull();
  });
});
