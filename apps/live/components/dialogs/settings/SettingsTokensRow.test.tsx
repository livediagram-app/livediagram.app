// @vitest-environment jsdom
// The API Tokens category's manager (docs/specs/015-api/public-api-and-tokens.md#36-management--the-settings-dialogs-api-tokens-category):
// a guest gets the reason plus a Sign In link; a signed-in user creates a
// token, sees its secret once, and revokes from the list after confirming.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  });

  it('creates a token and shows its secret once', async () => {
    api.apiListTokens.mockResolvedValue([]);
    api.apiCreateToken.mockResolvedValue({ token: 'lvd_secret', id: 'tok1' });
    render(<SettingsTokensRow row={ROW} />);
    await screen.findByText('No Tokens Yet');
    expect(
      screen.getByRole('meter', { name: 'Token slots used' }).getAttribute('aria-valuetext'),
    ).toBe('0 of 10');
    fireEvent.click(screen.getByRole('button', { name: 'New Token' }));
    // A chip fills the name; the field stays editable.
    fireEvent.click(screen.getByRole('button', { name: 'CI Bot' }));
    expect((screen.getByLabelText('What Is It For?') as HTMLInputElement).value).toBe('CI Bot');
    fireEvent.click(screen.getByRole('button', { name: 'Create Token' }));
    const reveal = await screen.findByRole('status', { name: 'New token created' });
    expect(reveal.textContent).toContain('lvd_secret');
    // The Try It command carries the new token.
    expect(reveal.textContent).toContain('Authorization: Bearer lvd_secret');
    expect(api.apiCreateToken).toHaveBeenCalledWith('user_1', 'CI Bot');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/lvd_secret/)).toBeNull();
    expect(screen.getByRole('button', { name: 'New Token' })).toBeTruthy();
  });

  it('closes the composer on Escape without creating anything', async () => {
    api.apiListTokens.mockResolvedValue([]);
    render(<SettingsTokensRow row={ROW} />);
    await screen.findByText('No Tokens Yet');
    fireEvent.click(screen.getByRole('button', { name: 'Create Your First Token' }));
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
});
