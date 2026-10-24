import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { getNotificationPrefs, readPreferences, SETTINGS_APP, writePreferences } from './settings';

// A person's settings live at the accounts Worker in two scopes (liveworkspace/docs/accounts.md
// "Settings"); the editor sees one flat set (docs/specs/007-editor/user-preferences.md).

const env = ACCOUNTS_ON as Env;
const GUEST = 'guest_0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let accounts: FakeAccounts;
beforeEach(() => {
  accounts = stubAccounts();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readPreferences', () => {
  it('joins all and this app in one read, a shared key coming only from all', async () => {
    accounts.settings.set('user_a', {
      all: { reduceMotion: true },
      app: { planTourSeen: true, reduceMotion: false },
    });
    expect(await readPreferences(env, 'user_a')).toEqual({
      reduceMotion: true,
      planTourSeen: true,
    });
    expect(accounts.calls).toEqual([
      { path: '/settings/read', body: { owner: 'user_a', app: SETTINGS_APP } },
    ]);
  });

  it("keeps a guest's settings under its guest id", async () => {
    await writePreferences(env, GUEST, { planTourSeen: true });
    expect(accounts.settings.get(GUEST)).toEqual({ all: {}, app: { planTourSeen: true } });
  });

  it("keeps a common setting's value from before it was shared, until `all` has one", async () => {
    accounts.settings.set('user_a', { all: {}, app: { homeBanner: false } });
    expect(await readPreferences(env, 'user_a')).toEqual({ homeBanner: false });
    accounts.settings.set('user_a', {
      all: { homeBanner: true },
      app: { homeBanner: false, collaboratePanelEnabled: false },
    });
    expect(await readPreferences(env, 'user_a')).toEqual({
      homeBanner: true,
      collaboratePanelEnabled: false,
    });
  });

  it('answers null with no accounts Worker, or an owner it has no place for, asking nothing', async () => {
    expect(await readPreferences({} as Env, 'user_a')).toBeNull();
    expect(await readPreferences(env, 'not-a-guest-id')).toBeNull();
    expect(accounts.calls).toHaveLength(0);
  });
});

describe('writePreferences', () => {
  it('splits a patch into its scopes; a value replaces whole, null deletes, the rest stays', async () => {
    accounts.settings.set('user_a', {
      all: { uiScale: 1.1, uiScalePanels: 0.9, telemetryEnabled: false },
      app: { sheetDefaults: { width: 'wide', frozen: true }, planTourSeen: true },
    });
    const now = await writePreferences(env, 'user_a', {
      uiScalePanels: null,
      sheetDefaults: { width: 'narrow' },
    });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({
      all: { uiScalePanels: null },
      app: { sheetDefaults: { width: 'narrow' } },
    });
    expect(now).toEqual({
      uiScale: 1.1,
      telemetryEnabled: false,
      sheetDefaults: { width: 'narrow' },
      planTourSeen: true,
    });
  });

  it('sends only the scopes the patch names', async () => {
    await writePreferences(env, 'user_a', { planTourSeen: true });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({ app: { planTourSeen: true } });
  });

  it("moves a common setting to all on its first change, dropping this app's old copy", async () => {
    accounts.settings.set('user_a', { all: {}, app: { homeBanner: false, planTourSeen: true } });
    const now = await writePreferences(env, 'user_a', { homeBanner: true });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({
      all: { homeBanner: true },
      app: { homeBanner: null },
    });
    expect(accounts.settings.get('user_a')).toEqual({
      all: { homeBanner: true },
      app: { planTourSeen: true },
    });
    expect(now).toEqual({ homeBanner: true, planTourSeen: true });
  });
});

describe('getNotificationPrefs', () => {
  it('is opt-out: only an explicit false turns a switch off', async () => {
    accounts.settings.set('user_a', {
      all: { notifyComments: false },
      app: { notifyFormResponses: 'no' },
    });
    expect(await getNotificationPrefs(env, 'user_a')).toEqual({
      notifyComments: false,
      notifyFormResponses: true,
    });
  });

  it("reads liveplanner's own switch from its scope, a shared one from all", async () => {
    accounts.settings.set('user_a', {
      all: {},
      app: { notifyFormResponses: false, notifyComments: false },
    });
    // A shared key only ever comes from `all`, so a stale copy in the app's row never wins.
    expect(await getNotificationPrefs(env, 'user_a')).toEqual({
      notifyComments: true,
      notifyFormResponses: false,
    });
  });

  it('notifies when the accounts Worker cannot be read', async () => {
    accounts.failWith = 503;
    expect(Object.values(await getNotificationPrefs(env, 'user_a')).every(Boolean)).toBe(true);
  });
});
