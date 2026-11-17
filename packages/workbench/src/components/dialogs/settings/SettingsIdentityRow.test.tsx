// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Settings › Profile's identity card (Work Tracker 905): the large avatar wears the account's Google picture, by the
// header's rule, and falls back to the initials with none or when it fails to load.

const auth = vi.hoisted(() => ({
  authLoaded: true,
  isSignedIn: true,
  user: null as null | Record<string, string | null | undefined>,
}));
vi.mock('../../providers/deferred-auth', () => ({ useDeferredAuth: () => auth }));
vi.mock('../../chrome/auth-routes', () => ({
  useAuthHrefs: () => ({ signInHref: '/sign-in/', signUpHref: '/get-started/' }),
}));

const { SettingsIdentityRow } = await import('./SettingsIdentityRow');

const PICTURE = 'https://lh3.googleusercontent.com/a/ada-picture';
const ADA = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  createdAt: '2026-01-05T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  auth.authLoaded = true;
  auth.isSignedIn = true;
  auth.user = null;
});

const avatar = (root: HTMLElement) => root.querySelector('[data-profile-avatar]') as HTMLElement;

describe('SettingsIdentityRow', () => {
  it("shows the session's Google picture over the initials", () => {
    auth.user = { ...ADA, picture: PICTURE };
    const { container } = render(
      <SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />,
    );
    expect(container.querySelector('[data-settings-cell="identity"]')).not.toBeNull();
    const disc = avatar(container);
    expect(disc.textContent).toContain('AL');
    const img = disc.querySelector('img');
    expect(img?.getAttribute('src')).toContain('lh3.googleusercontent.com/a/ada-picture');
    expect(img?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(container.textContent).toContain('Ada Lovelace');
    expect(container.textContent).toContain('ada@example.com');
  });

  it("prefers the editor's own-picture store when it passes one, even with Show My Google Picture off", () => {
    // The own-picture store keeps the picture with the switch off: the person's own screen always shows it.
    auth.user = { ...ADA, picture: null };
    const { container } = render(
      <SettingsIdentityRow row={{ key: 'identity' }} things="designs" picture={PICTURE} />,
    );
    expect(avatar(container).querySelector('img')?.getAttribute('src')).toContain('ada-picture');
  });

  it('shows the initials alone when the account has no picture', () => {
    auth.user = { ...ADA };
    const { container } = render(<SettingsIdentityRow row={{ key: 'identity' }} things="plans" />);
    expect(avatar(container).querySelector('img')).toBeNull();
    expect(avatar(container).textContent).toBe('AL');
  });

  it('falls back to the initials when the picture fails to load', () => {
    auth.user = { ...ADA, picture: PICTURE };
    const { container } = render(
      <SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />,
    );
    fireEvent.error(avatar(container).querySelector('img')!);
    expect(avatar(container).querySelector('img')).toBeNull();
    expect(avatar(container).textContent).toBe('AL');
  });

  it('names the account by its username or email when it has no full name', () => {
    auth.user = { username: 'ada', email: 'ada@example.com' };
    const first = render(<SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />);
    expect(first.container.querySelector('h3')?.textContent).toBe('ada');
    first.unmount();
    auth.user = { email: 'ada@example.com' };
    const second = render(<SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />);
    expect(second.container.querySelector('h3')?.textContent).toBe('ada@example.com');
    second.unmount();
    auth.user = {};
    const third = render(<SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />);
    expect(third.container.querySelector('h3')?.textContent).toBe('Your account');
  });

  it("gives a guest the guest card, naming this app's work, with the way in", () => {
    auth.isSignedIn = false;
    const { container, getByText } = render(
      <SettingsIdentityRow row={{ key: 'identity' }} things="spaces" />,
    );
    expect(getByText('Keep your spaces and settings on every device.')).toBeTruthy();
    expect(container.querySelector('a[href="/sign-in/"]')).not.toBeNull();
    expect(container.querySelector('a[href="/get-started/"]')).not.toBeNull();
    expect(avatar(container).querySelector('img')).toBeNull();
  });

  it('shows the guest card until the session has loaded', () => {
    auth.authLoaded = false;
    auth.user = { ...ADA, picture: PICTURE };
    const { container } = render(
      <SettingsIdentityRow row={{ key: 'identity' }} things="canvases" />,
    );
    expect(container.textContent).toContain('Not signed in');
  });
});
