// @vitest-environment jsdom
// The API Tokens category (docs/specs/015-api/public-api-and-tokens.md#36-management-the-settings-dialogs-api-tokens-category):
// a guest gets the reason plus a Sign In link; a signed-in user is sent to liveworkspace.app, where
// the account's tokens are run (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens").
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ signedIn: true }));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => ({
    authLoaded: true,
    isSignedIn: auth.signedIn,
    accountUserId: auth.signedIn ? 'user_1' : null,
  }),
}));
vi.mock('@liveworkspace/workbench/lib/auth-config', () => ({
  manageTokensUrl: 'https://liveworkspace.app/account/tokens',
}));
// The Sign In link reads its hrefs from the workbench's auth routes.
vi.mock('@liveworkspace/workbench/components/chrome/auth-routes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuthHrefs: () => ({ signInHref: '/sign-in/?redirect_url=%2Fexplorer' }),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { SettingsTokensRow } from './SettingsTokensRow';
import type { SettingsTokensRowSpec } from './settings-catalogue';

const ROW = SETTINGS_CATEGORIES.find((c) => c.id === 'tokens')!.rows[0] as SettingsTokensRowSpec;

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
  });
});
