// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://staging.liveknowledge.app/explorer/home"}
// The Explorer on an app's address reads Pro as liveworkspace.app's does (liveworkspace/docs/specs/019-subscription/
// subscription.md "The subscription Worker", Work Tracker 1474): the site's provider asks liveworkspace.app's service
// (staging's, from a staging app) with the token the app's session gives the page, and with Pro off asks nothing.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubscription } from '@liveworkspace/subscription-ui/provider';
import {
  GARDEN,
  ME,
  meResponse,
  serviceFetch,
  setProForTests,
  summary,
  team,
} from '@liveworkspace/subscription-ui/testing';
import { SiteSubscription } from './SiteSubscription';

vi.mock('@/lib/explorer/token', () => ({
  workspaceIdentity: async () => ({
    token: 'liveknowledge-token',
    kind: 'account',
    sub: 'user_ada',
    expiresAt: Date.now() + 60_000,
  }),
}));

let urls: string[] = [];
let calls: ReturnType<typeof serviceFetch>['calls'] = [];
beforeEach(() => {
  const service = serviceFetch({
    me: meResponse({
      personal: summary(ME, 'pro'),
      teams: [team(GARDEN, 'Garden', 'admin', 'team')],
    }),
  });
  calls = service.calls;
  urls = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return service.fetcher(input, init);
  });
});
afterEach(() => {
  cleanup();
  setProForTests(null);
  vi.unstubAllGlobals();
});

/** What the Explorer's badges read: the person's tier and each team's, once the service has answered. */
function Tiers() {
  const load = useSubscription();
  if (load.status !== 'ready') return <p>{load.status}</p>;
  return (
    <p>{[load.me.personal.tier, ...load.me.teams.map((t) => `${t.name} ${t.tier}`)].join(', ')}</p>
  );
}

describe('SiteSubscription on an app’s address', () => {
  it('asks liveworkspace.app’s service with the app’s own token', async () => {
    setProForTests(true);
    render(
      <SiteSubscription account="in">
        <Tiers />
      </SiteSubscription>,
    );
    expect(await screen.findByText('pro, Garden team')).toBeTruthy();
    expect(urls.length).toBeGreaterThan(0);
    expect(
      urls.every((u) => u.startsWith('https://staging.liveworkspace.app/api/subscription/')),
    ).toBe(true);
    expect(calls.find((c) => c.path === '/me')?.auth).toBe('Bearer liveknowledge-token');
  });

  it('asks nothing with Pro off', async () => {
    setProForTests(false);
    render(
      <SiteSubscription account="in">
        <p>Explorer</p>
      </SiteSubscription>,
    );
    expect(await screen.findByText('Explorer')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(urls).toEqual([]);
  });
});
