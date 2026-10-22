// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGuestSelfId, setGuestIdentity } from './local-identity';

const { apiMigrateGuestData } = vi.hoisted(() => ({
  apiMigrateGuestData: vi.fn(),
}));
vi.mock('./api-client', () => ({ apiMigrateGuestData }));

const {
  GUEST_MIGRATION_WAIT_MS,
  guestMigrationPending,
  resetGuestMigrationForTests,
  settleGuestMigration,
  subscribeGuestMigration,
} = await import('./guest-migration');

const MIGRATED = { documents: 1, folders: 0, shared: 0, images: 0 };

beforeEach(() => {
  localStorage.clear();
  resetGuestMigrationForTests();
  apiMigrateGuestData.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('guestMigrationPending', () => {
  it('is false without a guest id', () => {
    expect(guestMigrationPending('user_abc')).toBe(false);
  });

  it('is false when the guest id already is the Clerk id', () => {
    setGuestIdentity('user_abc', null);
    expect(guestMigrationPending('user_abc')).toBe(false);
  });

  it('is true while a different guest id still holds the data', () => {
    setGuestIdentity('guest-1', 'sig-1');
    expect(guestMigrationPending('user_abc')).toBe(true);
  });
});

describe('settleGuestMigration', () => {
  it('migrates the signed guest id and clears it on success', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(MIGRATED);

    await settleGuestMigration('user_abc');

    expect(apiMigrateGuestData).toHaveBeenCalledWith('guest-1', 'sig-1');
    expect(getGuestSelfId()).toBeNull();
    expect(guestMigrationPending('user_abc')).toBe(false);
  });

  it('sends one request however many callers wait on it', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(MIGRATED);

    await Promise.all([settleGuestMigration('user_abc'), settleGuestMigration('user_abc')]);

    expect(apiMigrateGuestData).toHaveBeenCalledTimes(1);
  });

  it('settles on a refused migrate, keeping the guest id for the next load', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(null);

    await settleGuestMigration('user_abc');

    expect(getGuestSelfId()).toBe('guest-1');
    expect(guestMigrationPending('user_abc')).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('settles on a network failure, keeping the guest id for the next load', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockRejectedValue(new TypeError('Failed to fetch'));

    await settleGuestMigration('user_abc');

    expect(getGuestSelfId()).toBe('guest-1');
    expect(guestMigrationPending('user_abc')).toBe(false);
  });

  it('stops holding the page once the wait budget runs out', async () => {
    vi.useFakeTimers();
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockReturnValue(new Promise(() => {}));

    const settled = settleGuestMigration('user_abc');
    await vi.advanceTimersByTimeAsync(GUEST_MIGRATION_WAIT_MS);
    await settled;

    expect(guestMigrationPending('user_abc')).toBe(false);
  });

  it('resolves straight away when nothing needs migrating', async () => {
    await settleGuestMigration('user_abc');
    expect(apiMigrateGuestData).not.toHaveBeenCalled();
  });
});

// The React Compiler memoises a render-time `guestMigrationPending(userId)` on its
// argument, so the hook can only see the pending state change through a store
// notification: signing in with a guest document open otherwise held the editor
// on "Opening your document" until a refresh.
describe('subscribeGuestMigration', () => {
  it('notifies once the migration settles', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(MIGRATED);
    const onChange = vi.fn(() => guestMigrationPending('user_abc'));
    const unsubscribe = subscribeGuestMigration(onChange);

    await settleGuestMigration('user_abc');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.results.at(-1)?.value).toBe(false);
    unsubscribe();
  });

  it('notifies when a refused migration settles too', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(null);
    const onChange = vi.fn();
    const unsubscribe = subscribeGuestMigration(onChange);

    await settleGuestMigration('user_abc');
    expect(onChange).toHaveBeenCalled();
    expect(guestMigrationPending('user_abc')).toBe(false);
    unsubscribe();
  });

  it('notifies when the guest id changes', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeGuestMigration(onChange);
    setGuestIdentity('guest-2', null);
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops notifying once unsubscribed', async () => {
    setGuestIdentity('guest-1', 'sig-1');
    apiMigrateGuestData.mockResolvedValue(MIGRATED);
    const onChange = vi.fn();
    subscribeGuestMigration(onChange)();

    await settleGuestMigration('user_abc');
    expect(onChange).not.toHaveBeenCalled();
  });
});
