// @vitest-environment jsdom

// Settings > Profile's identity card (Work Tracker 905): the large avatar is your own Google picture, from the same
// own-picture store the header's account control reads, whatever Show My Google Picture says; the initials without one.

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetOwnPictureForTests, setOwnPicture } from '@/lib/own-picture';
import { SETTINGS_CATEGORIES, type SettingsIdentityRowSpec } from './settings-catalogue';

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => auth.value,
}));
vi.mock('@liveworkspace/workbench/lib/auth-config', () => ({ e2eAuthEnabled: false }));
vi.mock('@liveworkspace/workbench/components/chrome/auth-routes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAuthHrefs: () => ({ signInHref: '/sign-in/' }),
}));

const { SettingsIdentityRow } = await import('./SettingsAccountRows');

const ROW = SETTINGS_CATEGORIES.flatMap((c) => c.rows).find(
  (r) => r.kind === 'identity',
) as SettingsIdentityRowSpec;
const PICTURE = 'https://lh3.googleusercontent.com/a/ada-picture';
const avatar = () => document.querySelector('[data-profile-avatar]') as HTMLElement;

afterEach(() => {
  cleanup();
  resetOwnPictureForTests();
});

describe('SettingsIdentityRow', () => {
  it('shows your own Google picture, even with Show My Google Picture off', () => {
    auth.value = { authLoaded: true, isSignedIn: true, user: { fullName: 'Ada Lovelace' } };
    setOwnPicture({ picture: PICTURE, hidden: true });
    render(<SettingsIdentityRow row={ROW} />);
    expect(avatar().querySelector('img')?.getAttribute('src')).toContain('ada-picture');
  });

  it('shows the initials when the account has no picture', () => {
    auth.value = { authLoaded: true, isSignedIn: true, user: { fullName: 'Ada Lovelace' } };
    render(<SettingsIdentityRow row={ROW} />);
    expect(avatar().querySelector('img')).toBeNull();
    expect(avatar().textContent).toBe('AL');
  });
});
