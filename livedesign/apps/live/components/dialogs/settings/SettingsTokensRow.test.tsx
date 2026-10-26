// @vitest-environment jsdom
// The API Tokens category (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// a guest gets the reason plus a Sign In link; a signed-in user is sent to liveworkspace.app, where
// the account's tokens are run (liveworkspace/docs/accounts.md "API tokens").
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({
    authLoaded: true,
    isSignedIn: auth.signedIn,
    accountUserId: auth.signedIn ? 'user_1' : null,
  }),
}));
vi.mock('@liveworkspace/workbench/lib/auth-config', () => ({
  manageTokensUrl:
    'https://liveworkspace.app/account/tokens',
}));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/?redirect_url=%2Fexplorer' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const api = vi.hoisted(() => ({
  apiListWorkbenchPairings: vi.fn(),
  apiUnpairWorkbench: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsTokensRow } from './SettingsTokensRow';
import type { SettingsTokensRowSpec } from './settings-catalogue';

const ROW = SETTINGS_CATEGORIES.find((c) => c.id === 'tokens')!.rows[0] as SettingsTokensRowSpec;

beforeEach(() => {
  api.apiListWorkbenchPairings.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.signedIn = true;
  vi.clearAllMocks();
});

describe('SettingsTokensRow', () => {
  it('sends a signed-in person to liveworkspace.app to manage their tokens', () => {
    render(<SettingsTokensRow row={ROW} />);
    expect(screen.getByRole('link', { name: 'Manage API Tokens' }).getAttribute('href')).toBe(
      'https://liveworkspace.app/account/tokens',
    );
  });

  it('gives a guest the reason and a way to sign in, and no link out', () => {
    auth.signedIn = false;
    render(<SettingsTokensRow row={ROW} />);
    expect(screen.getByText(/Sign in to create API tokens/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Manage API Tokens' })).toBeNull();
    expect(api.apiListWorkbenchPairings).not.toHaveBeenCalled();
  });

  it('lists the paired workbenches, which stay this app’s, and unpairs one after confirming', async () => {
    api.apiListWorkbenchPairings.mockResolvedValue([
      {
        id: 'p1',
        tokenId: 'tok1',
        origin: 'https://127.0.0.1:5175',
        name: 'Acme Editor',
        scope: 'design',
        pairedAt: Date.now(),
      },
    ]);
    api.apiUnpairWorkbench.mockResolvedValue(undefined);
    render(<SettingsTokensRow row={ROW} />);
    await screen.findByRole('list', { name: 'Paired workbenches' });
    fireEvent.click(
      screen.getByRole('button', { name: 'Unpair Acme Editor at https://127.0.0.1:5175' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Unpair' }));
    await waitFor(() => expect(api.apiUnpairWorkbench).toHaveBeenCalledWith('user_1', 'p1'));
  });
});
