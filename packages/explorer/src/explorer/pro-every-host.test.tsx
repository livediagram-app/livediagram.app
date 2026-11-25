// Pro in the Explorer on every host (liveworkspace/docs/specs/019-subscription/subscription.md "A team's page in the
// Explorer", "The subscription Worker"): the Explorer each app serves at its own /explorer is the one liveworkspace.app
// shows, so the spaces' Pro badges show the same whichever app hosts it, asked of liveworkspace.app's service with the
// app's own token, and with Pro off nothing Pro shows and nothing is asked (Work Tracker 1474).
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_NAMES, type AppName } from '@liveworkspace/sites';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui/provider';
import {
  GARDEN,
  ME,
  meResponse,
  serviceFetch,
  setProForTests,
  summary,
  team,
} from '@liveworkspace/subscription-ui/testing';
import { proOnForTests } from '@liveworkspace/subscription-ui/testing/who';
import { createFakeIndex } from '../test/fakeClient';
import { EXPANDED_KEY } from './sidebar/expansion';
import { Explorer } from './Explorer';

proOnForTests();
afterEach(cleanup);

// liveworkspace.app's service as a staging app's page reaches it (workspaceOriginFor).
const SERVICE = 'https://staging.liveworkspace.app';
const GARDEN_ID = GARDEN.slice(2);

/** The Explorer as `app`'s address hosts it: the provider over liveworkspace.app's service, the app's token. */
function hostedBy(app: AppName) {
  const { fetcher, calls } = serviceFetch({
    me: meResponse({
      personal: summary(ME, 'pro'),
      teams: [team(GARDEN, 'Garden', 'admin', 'team')],
    }),
  });
  const urls: string[] = [];
  const asked: typeof fetch = (input, init) => {
    urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return fetcher(input, init);
  };
  localStorage.setItem(EXPANDED_KEY, JSON.stringify(['my-work']));
  render(
    <SubscriptionProvider
      getToken={async () => `${app}-token`}
      origin={SERVICE}
      account="in"
      fetch={asked}
      navigate={() => {}}
    >
      <Explorer
        app={app}
        teams={[{ id: GARDEN_ID, name: 'Garden' }]}
        client={createFakeIndex().client}
        view={{ kind: 'all' }}
        onNavigate={() => {}}
        itemHref={(item) => `/item/${item.id}`}
        onCreate={() => {}}
        viewerId="user_ada"
        heroHidden
      />
    </SubscriptionProvider>,
  );
  return { calls, urls };
}

const nav = () => screen.getByRole('navigation', { name: 'Sections' });
const space = (name: string) => within(nav()).findByRole('treeitem', { name });
const badgeIn = (row: HTMLElement) => within(row).queryByRole('img', { name: 'Pro' });

describe('the Explorer’s Pro badges on every app’s address', () => {
  it.each(APP_NAMES)('shows My Work’s and the team’s Pro badge hosted by %s', async (app) => {
    const { calls, urls } = hostedBy(app);
    await waitFor(async () => expect(badgeIn(await space('My Work'))).toBeTruthy());
    expect(badgeIn(await space('Garden'))).toBeTruthy();
    // One read of the person's subscription, of liveworkspace.app's service, as the app's signed-in person.
    expect(calls.filter((c) => c.path === '/me')).toHaveLength(1);
    expect(calls[0]?.auth).toBe(`Bearer ${app}-token`);
    expect(urls.every((u) => u.startsWith(`${SERVICE}/api/subscription/`))).toBe(true);
  });

  it.each(APP_NAMES)(
    'shows nothing Pro and asks nothing with Pro off, hosted by %s',
    async (app) => {
      setProForTests(false);
      const { calls } = hostedBy(app);
      expect(await space('Garden')).toBeTruthy();
      expect(badgeIn(await space('My Work'))).toBeNull();
      expect(document.querySelector('[data-pro-badge]')).toBeNull();
      expect(calls).toHaveLength(0);
    },
  );
});
