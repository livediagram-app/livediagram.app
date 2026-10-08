// @vitest-environment jsdom
// The API Tokens category's manager (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// a guest gets the reason plus a Sign In link; a signed-in user creates a
// token, sees its secret once, and revokes from the list after confirming.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@/hooks/persistence/useClerkApiBootstrap', () => ({
  useClerkApiBootstrap: () => ({
    authLoaded: true,
    isSignedIn: auth.signedIn,
    clerkUserId: auth.signedIn ? 'user_1' : null,
  }),
}));
vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true }));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/?redirect_url=%2Fexplorer' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const api = vi.hoisted(() => ({
  apiListTokens: vi.fn(),
  apiCreateToken: vi.fn(),
  apiRevokeToken: vi.fn(),
  apiListWorkbenchPairings: vi.fn(),
  apiUnpairWorkbench: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsTokensRow } from './SettingsTokensRow';
import type { SettingsTokensRowSpec } from './settings-catalogue';

const ROW = SETTINGS_CATEGORIES.find((c) => c.id === 'tokens')!.rows[0] as SettingsTokensRowSpec;
const DAY = 86_400_000;
const TOKEN = {
  id: 'tok1',
  name: 'CI bot',
  createdAt: Date.now() - DAY,
  expiresAt: Date.now() + 100 * DAY,
  lastUsedAt: null,
  readOnly: false,
};

beforeEach(() => {
  api.apiListWorkbenchPairings.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.signedIn = true;
  vi.clearAllMocks();
});

describe('SettingsTokensRow', () => {
  it('tells a guest why, and links to sign in', () => {
    auth.signedIn = false;
    render(<SettingsTokensRow row={ROW} />);
    expect(screen.getByText(/Sign in to create API tokens/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe(
      '/sign-in/?redirect_url=%2Fexplorer',
    );
    expect(screen.queryByRole('button', { name: 'Create Token' })).toBeNull();
    expect(api.apiListTokens).not.toHaveBeenCalled();
    expect(api.apiListWorkbenchPairings).not.toHaveBeenCalled();
  });

  it('opens on the create form when there are no tokens, with nothing competing', async () => {
    api.apiListTokens.mockResolvedValue([]);
    render(<SettingsTokensRow row={ROW} />);
    // The form is the empty state: no second button to it, no "0 of 10".
    expect(await screen.findByLabelText('What Is It For?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New token' })).toBeNull();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });

  it('creates a token and shows its secret once', async () => {
    api.apiListTokens.mockResolvedValue([]);
    api.apiCreateToken.mockResolvedValue({ token: 'lvd_secret', id: 'tok1' });
    render(<SettingsTokensRow row={ROW} />);
    // A chip fills the name; the field stays editable.
    fireEvent.click(await screen.findByRole('button', { name: 'CI Bot' }));
    expect((screen.getByLabelText('What Is It For?') as HTMLInputElement).value).toBe('CI Bot');
    api.apiListTokens.mockResolvedValue([TOKEN]);
    fireEvent.click(screen.getByRole('button', { name: 'Create Token' }));
    const reveal = await screen.findByRole('status', { name: 'New token created' });
    expect(reveal.textContent).toContain('lvd_secret');
    expect(api.apiCreateToken).toHaveBeenCalledWith('user_1', 'CI Bot');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/lvd_secret/)).toBeNull();
    // Now there is one: the list, the meter and New take over.
    expect(await screen.findByText('CI bot')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe('1 of 10');
    expect(screen.getByRole('button', { name: 'New token' })).toBeTruthy();
  });

  it('closes an opened composer on Escape without creating anything', async () => {
    api.apiListTokens.mockResolvedValue([TOKEN]);
    render(<SettingsTokensRow row={ROW} />);
    fireEvent.click(await screen.findByRole('button', { name: 'New token' }));
    fireEvent.keyDown(screen.getByLabelText('What Is It For?'), { key: 'Escape' });
    expect(screen.queryByLabelText('What Is It For?')).toBeNull();
    expect(api.apiCreateToken).not.toHaveBeenCalled();
  });

  it('lists tokens and revokes one only after confirming', async () => {
    api.apiListTokens.mockResolvedValue([TOKEN]);
    api.apiRevokeToken.mockResolvedValue(undefined);
    render(<SettingsTokensRow row={ROW} />);
    await screen.findByText('CI bot');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke CI bot' }));
    expect(api.apiRevokeToken).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(api.apiRevokeToken).toHaveBeenCalledWith('user_1', 'tok1'));
  });

  it('shows a token’s paired workbenches under its card and unpairs one after confirming', async () => {
    api.apiListTokens.mockResolvedValue([TOKEN, { ...TOKEN, id: 'tok2', name: 'Laptop' }]);
    api.apiListWorkbenchPairings.mockResolvedValue([
      {
        id: 'p1',
        tokenId: 'tok1',
        origin: 'https://127.0.0.1:5175',
        name: 'Acme Editor',
        pairedAt: Date.now(),
      },
    ]);
    api.apiUnpairWorkbench.mockResolvedValue(undefined);
    render(<SettingsTokensRow row={ROW} />);
    const list = await screen.findByRole('list', { name: 'Paired workbenches' });
    expect(within(list).getByText('Acme Editor')).toBeTruthy();
    // One list for the account, grouped in the client: the other token's card shows none.
    expect(screen.getAllByRole('list', { name: 'Paired workbenches' })).toHaveLength(1);
    expect(api.apiListWorkbenchPairings).toHaveBeenCalledTimes(1);
    expect(api.apiListWorkbenchPairings).toHaveBeenCalledWith('user_1');

    fireEvent.click(
      screen.getByRole('button', { name: 'Unpair Acme Editor at https://127.0.0.1:5175' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Unpair' }));
    await waitFor(() => expect(api.apiUnpairWorkbench).toHaveBeenCalledWith('user_1', 'p1'));
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Paired workbenches' })).toBeNull(),
    );
  });
});
