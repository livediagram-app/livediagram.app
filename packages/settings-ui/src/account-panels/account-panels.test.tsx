// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountCategories } from '../account-model';
import type { SettingsRow } from '../model';
import { bearerAccountSecurity } from '../profile/bearer-security';
import { bearerSettingsRequest } from '../request';
import { accountPanels, preloadAccountPanels } from './lazy';

// An editor's Account section (liveworkspace/docs/specs/010-site/site.md "Settings"): sign-in and devices, API Tokens
// and Download Your Data drawn in place over the account API's bearer door through the app's router, each
// panel's code fetched when its category shows, and nothing that leaves for liveworkspace.app.

const request = bearerSettingsRequest({
  baseUrl: '/api/workspace/account',
  token: async () => 'bearer',
});
const host = { request };
const section = {
  all: {},
  set: () => {},
  identity: { name: 'Ada Lovelace', email: 'ada@example.com', colour: null },
  security: bearerAccountSecurity(request, { settingsParam: 'account:account' }),
  ...accountPanels(host),
};

type Call = { url: string; method: string; auth: string | null };
let calls: Call[];

beforeAll(async () => {
  // Warm, so each lazy panel resolves in a tick and the test times the panel, not the transform.
  await preloadAccountPanels();
}, 60_000);

beforeEach(() => {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push({
        url,
        method: init?.method ?? 'GET',
        auth: new Headers(init?.headers).get('authorization'),
      });
      const body = url.endsWith('/tokens')
        ? { tokens: [] }
        : url.endsWith('/teams')
          ? { teams: [] }
          : url.endsWith('/data-export')
            ? { personal: null, teams: [] }
            : url.endsWith('/sessions')
              ? { sessions: [] }
              : url.endsWith('/sign-in-methods')
                ? { google: 'available' }
                : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const rowOf = (category: string, key: string) => {
  const row = accountCategories(section)
    .find((c) => c.id === category)
    ?.rows.find((r) => r.key === key) as Extract<SettingsRow, { kind: 'custom' }> | undefined;
  if (!row) throw new Error(`no ${category} ${key}`);
  return row;
};

describe('an editor’s Account section, over the bearer door', () => {
  it('draws the API tokens in place, read over the app’s router with the person’s token', async () => {
    const { container } = render(<>{rowOf('tokens', 'apiTokens').render()}</>);
    expect(container.querySelector('[data-settings-cell="tokens"]')).toBeTruthy();
    expect(await screen.findByText(/No tokens yet/)).toBeTruthy();
    expect(calls).toContainEqual({
      url: '/api/workspace/account/tokens',
      method: 'GET',
      auth: 'Bearer bearer',
    });
    expect(container.querySelector('a')).toBeNull();
  });

  it('draws Download Your Data in place, never a link to liveworkspace.app, and no Webhooks', async () => {
    expect(accountCategories(section).map((c) => c.id)).not.toContain('webhooks');
    const data = render(<>{rowOf('data', 'dataExport').render()}</>);
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/workspace/account/data-export')).toBe(true),
    );
    expect(data.container.querySelector('[data-settings-cell="data"]')).toBeTruthy();
    expect(data.container.querySelector('a[href*="explorer?settings="]')).toBeNull();
  });

  it('draws sign-in methods and devices in place, with no Manage link', async () => {
    const methods = render(<>{rowOf('account', 'signInMethods').render()}</>);
    expect(await methods.findByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(methods.container.querySelector('a')).toBeNull();
    methods.unmount();
    render(<>{rowOf('account', 'sessions').render()}</>);
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/workspace/account/sessions')).toBe(true),
    );
    expect(screen.queryByRole('link', { name: 'Manage' })).toBeNull();
  });
});
