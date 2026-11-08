import { afterEach, describe, expect, it } from 'vitest';
import { hasOpenExplorerCookie } from '@liveworkspace/sites/open-explorer';
import { createSettingsStore, type SettingsRequest } from './store';

// Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer"): every
// `all` scope the store reads or holds is mirrored into this address's cookie, which the homepage's router reads.
const read = (all: Record<string, unknown>): SettingsRequest =>
  (async () => ({ ok: true, data: { all, app: {} } })) as unknown as SettingsRequest;

afterEach(() => {
  document.cookie = 'lw_open_explorer=; Max-Age=0; Path=/';
});

describe('the settings store and the Open Explorer cookie', () => {
  it('sets the cookie when a read finds the setting on, and clears it when one finds it off', async () => {
    await createSettingsStore(read({ autoOpenExplorer: true })).loadApp('livediagram.app');
    expect(hasOpenExplorerCookie(document.cookie)).toBe(true);
    await createSettingsStore(read({})).loadApp('liveplanner.app');
    expect(hasOpenExplorerCookie(document.cookie)).toBe(false);
  });

  it('follows a change the panel remembers, for one app or for every app', async () => {
    const store = createSettingsStore(read({}));
    await store.loadApp('livediagram.app');
    store.rememberShared({ autoOpenExplorer: true });
    expect(hasOpenExplorerCookie(document.cookie)).toBe(true);
    store.remember('livediagram.app', { all: { autoOpenExplorer: false }, app: {} });
    expect(hasOpenExplorerCookie(document.cookie)).toBe(false);
  });

  it('leaves the cookie as it was when a read fails', async () => {
    document.cookie = 'lw_open_explorer=1; Path=/';
    const failing = (async () => ({ ok: false, error: 'offline' })) as unknown as SettingsRequest;
    await createSettingsStore(failing).loadApp('livediagram.app');
    expect(hasOpenExplorerCookie(document.cookie)).toBe(true);
  });
});
