// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { accountCategories } from '../account-model';
import type { SettingsRow } from '../model';
import { ProfileHeaderCard } from './ProfileHeader';
import { guestProfileRows, profileRows } from './profile-rows';
import { deviceName, type AccountSecurity, type AccountSession } from './SecurityRows';

// Settings › Profile (liveworkspace/docs/site.md "Settings", "Profile"): the header card, Name and Colour, Sign-in
// Methods, Where You're Signed In and Your Account for someone signed in; the guest's card and the way in for a guest.

const base = { all: {}, set: () => {} };
const ada = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  colour: '#8b5cf6',
  joined: '2026-10-23T15:13:54Z',
};

const drawn = (row: SettingsRow | undefined) => {
  if (!row || row.kind !== 'custom') throw new Error(`not a custom row: ${row?.key}`);
  return render(<>{row.render()}</>);
};

const session = (id: string, current: boolean, userAgent: string): AccountSession => ({
  id,
  token: `token-${id}`,
  current,
  userAgent,
  createdAt: '2026-10-20T10:00:00Z',
  updatedAt: '2026-10-24T10:00:00Z',
});

function fakeSecurity(overrides: Partial<AccountSecurity> = {}): AccountSecurity {
  return {
    sessions: vi.fn(async () => [
      session(
        'mine',
        true,
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/156.0 Safari/537.36',
      ),
      session(
        'phone',
        false,
        'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Version/19.0 Mobile Safari/604.1',
      ),
    ]),
    revokeSession: vi.fn(async () => true),
    revokeOtherSessions: vi.fn(async () => true),
    signInMethods: vi.fn(async () => ({ google: 'available' as const })),
    connectGoogle: vi.fn(async () => true),
    ...overrides,
  };
}

describe('the Profile header card', () => {
  it('shows the avatar’s initials, the name, email, account type, when they joined and their colour', () => {
    render(<ProfileHeaderCard identity={ada} />);
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
    expect(document.querySelector('[data-profile-avatar]')?.textContent).toBe('AL');
    const about = screen.getByRole('list', { name: 'About this account' });
    expect(within(about).getByText('liveworkspace account')).toBeTruthy();
    expect(within(about).getByText(/^Joined /)).toBeTruthy();
    expect(within(about).getByText('Colour: Violet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('shows a guest as a guest, with the way to sign in and what an account adds', () => {
    render(
      <ProfileHeaderCard
        guest={{ signInHref: '/sign-in', signUpHref: '/get-started', things: 'plans' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Guest' })).toBeTruthy();
    expect(screen.getByText('Guest · This browser only')).toBeTruthy();
    expect(screen.getByText(/Keep your plans and settings on every device/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in');
    expect(screen.getByRole('link', { name: 'Create account' }).getAttribute('href')).toBe(
      '/get-started',
    );
  });
});

describe('the Profile category', () => {
  it('on liveworkspace.app: the header, Name and Colour, Sign-in Methods, devices and Sign Out, in that order', () => {
    const rows = profileRows({
      ...base,
      identity: ada,
      renderProfile: () => null,
      security: fakeSecurity(),
      onSignOut: vi.fn(),
    });
    expect(rows.map((r) => [r.key, r.section])).toEqual([
      ['identity', undefined],
      ['profile', 'Name and Colour'],
      ['signInMethods', 'Sign-in Methods'],
      ['sessions', 'Where You’re Signed In'],
      ['signOut', 'Your Account'],
    ]);
  });

  it('elsewhere: the header, the name and colour as they stand with Edit, and Manage for sign-in and devices', () => {
    const rows = profileRows({ ...base, identity: ada, profileHref: '/p', securityHref: '/s' });
    expect(rows.map((r) => r.key)).toEqual(['identity', 'profile', 'security']);
    drawn(rows[1]);
    expect(screen.getByText('Ada Lovelace · Violet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe('/p');
    drawn(rows[2]);
    expect(screen.getByRole('link', { name: 'Manage' }).getAttribute('href')).toBe('/s');
  });

  it('is left out where the host has nothing to show, and nests Notifications under it otherwise', () => {
    expect(accountCategories(base).some((c) => c.id === 'account')).toBe(false);
    const categories = accountCategories({ ...base, identity: ada });
    expect(categories[0]).toMatchObject({ id: 'account', label: 'Profile' });
    expect(categories.find((c) => c.id === 'notifications')?.parent).toBe('account');
  });

  it('a guest’s Profile is the guest card', () => {
    const [row] = guestProfileRows({ signInHref: '/sign-in' });
    drawn(row);
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
  });
});

describe('Sign-in Methods and Where You’re Signed In', () => {
  it('lists the email code, connects Google, and shows Connected once it is linked', async () => {
    const security = fakeSecurity();
    drawn(profileRows({ ...base, identity: ada, security }).find((r) => r.key === 'signInMethods'));
    expect(screen.getByText('Email Code')).toBeTruthy();
    expect(screen.getByText(/A one-time code sent to ada@example.com/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(security.connectGoogle).toHaveBeenCalledTimes(1));
  });

  it('shows Google as Connected, and leaves it out where the deployment has no Google', async () => {
    const connected = fakeSecurity({
      signInMethods: vi.fn(async () => ({ google: 'connected' as const })),
    });
    const { unmount } = drawn(
      profileRows({ ...base, identity: ada, security: connected }).find(
        (r) => r.key === 'signInMethods',
      ),
    );
    expect(await screen.findByText('Connected')).toBeTruthy();
    unmount();
    const off = fakeSecurity({ signInMethods: vi.fn(async () => ({ google: 'off' as const })) });
    drawn(
      profileRows({ ...base, identity: ada, security: off }).find((r) => r.key === 'signInMethods'),
    );
    await waitFor(() => expect(off.signInMethods).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Google')).toBeNull());
  });

  it('lists each session, this device first, and signs out of another or all the others', async () => {
    const security = fakeSecurity();
    drawn(profileRows({ ...base, identity: ada, security }).find((r) => r.key === 'sessions'));
    expect(await screen.findByText('Chrome on macOS')).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of Safari on iOS' }));
    await waitFor(() => expect(security.revokeSession).toHaveBeenCalledWith('token-phone'));
    // Read again after the change.
    await waitFor(() => expect(security.sessions).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out Others' }));
    await waitFor(() => expect(security.revokeOtherSessions).toHaveBeenCalledTimes(1));
  });

  it('says so when a sign-out is refused', async () => {
    const security = fakeSecurity({ revokeSession: vi.fn(async () => false) });
    drawn(profileRows({ ...base, identity: ada, security }).find((r) => r.key === 'sessions'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out of Safari on iOS' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('names a device from its browser and system', () => {
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0) Edg/120.0')).toBe('Edge on Windows');
    expect(deviceName('Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko Firefox/120.0')).toBe(
      'Firefox on Linux',
    );
    expect(deviceName(null)).toBe('Unknown device');
  });
});

describe('Sign Out', () => {
  it('signs out through the host, and says so when it is refused', async () => {
    const onSignOut = vi.fn(async () => false);
    drawn(
      profileRows({ ...base, identity: ada, profileHref: '/p', onSignOut }).find(
        (r) => r.key === 'signOut',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(onSignOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
