// @vitest-environment jsdom

// Settings > Account > Danger Zone: Delete Account is one row, the button beside
// the label, what it does said in the description below the card.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_CATEGORIES, type SettingsDeleteAccountRowSpec } from './settings-catalogue';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/components/providers/deferred-auth', () => ({ useDeferredAuth: () => auth.value }));
vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true, sessionsEnabled: true }));
vi.mock('@/components/chrome/auth-shared', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/?redirect_url=%2Fexplorer' }),
}));

const { DELETE_ACCOUNT_GUEST, DELETE_ACCOUNT_SIGNED_IN, SettingsDeleteAccountRow } =
  await import('./SettingsAccountRows');

const ROW = SETTINGS_CATEGORIES.flatMap((c) => c.rows).find(
  (r) => r.kind === 'deleteAccount',
) as SettingsDeleteAccountRowSpec;

const description = () => document.getElementById(`${ROW.key}-description`)!.textContent ?? '';

afterEach(cleanup);

describe('SettingsDeleteAccountRow', () => {
  it('is one row with the button when signed in, the consequence below it', () => {
    auth.value = { authLoaded: true, isSignedIn: true, user: { id: 'u' }, signOut: vi.fn() };
    render(<SettingsDeleteAccountRow row={ROW} />);
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeTruthy();
    expect(description()).toContain(DELETE_ACCOUNT_SIGNED_IN);
  });

  it('offers a guest the way in beside the label, with no Delete button', () => {
    auth.value = { authLoaded: true, isSignedIn: false, user: null, signOut: vi.fn() };
    render(<SettingsDeleteAccountRow row={ROW} />);
    expect(screen.queryByRole('button', { name: 'Delete Account' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe(
      '/sign-in/?redirect_url=%2Fexplorer',
    );
    expect(description()).toContain(DELETE_ACCOUNT_GUEST);
  });
});
