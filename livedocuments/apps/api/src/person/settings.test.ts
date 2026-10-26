import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { getNotificationPrefs, readPreferences, SETTINGS_APP, writePreferences } from './settings';

// A person's settings live at the accounts Worker in two scopes (liveworkspace/docs/specs/003-accounts/accounts.md
// "Settings"); the editor sees one flat set (docs/specs/007-editor/user-preferences.md).

const env = ACCOUNTS_ON as Env;
const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

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
      app: { pagesTourSeen: true, reduceMotion: false },
    });
    expect(await readPreferences(env, 'user_a')).toEqual({
      reduceMotion: true,
      pagesTourSeen: true,
    });
    expect(accounts.calls).toEqual([
      { path: '/settings/read', body: { owner: 'user_a', app: SETTINGS_APP } },
    ]);
  });

  it("keeps a guest's settings under the accounts Worker's guest id", async () => {
    await writePreferences(env, GUEST, { pagesTourSeen: true });
    expect(accounts.settings.get(`guest_${GUEST}`)).toEqual({
      all: {},
      app: { pagesTourSeen: true },
    });
  });

  it("keeps a common setting's value from before it was shared, until `all` has one", async () => {
    accounts.settings.set('user_a', { all: {}, app: { presentation: { loop: true } } });
    expect(await readPreferences(env, 'user_a')).toEqual({ presentation: { loop: true } });
    accounts.settings.set('user_a', {
      all: { presentation: { loop: false } },
      app: { presentation: { loop: true }, contentsPlacement: 'button' },
    });
    expect(await readPreferences(env, 'user_a')).toEqual({
      presentation: { loop: false },
      contentsPlacement: 'button',
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
      app: { articleDefaults: { width: 'wide', serif: true }, pagesTourSeen: true },
    });
    const now = await writePreferences(env, 'user_a', {
      uiScalePanels: null,
      articleDefaults: { width: 'narrow' },
    });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({
      all: { uiScalePanels: null },
      app: { articleDefaults: { width: 'narrow' } },
    });
    expect(now).toEqual({
      uiScale: 1.1,
      telemetryEnabled: false,
      articleDefaults: { width: 'narrow' },
      pagesTourSeen: true,
    });
  });

  it('sends only the scopes the patch names', async () => {
    await writePreferences(env, 'user_a', { pagesTourSeen: true });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({ app: { pagesTourSeen: true } });
  });

  it("moves a common setting to all on its first change, dropping this app's old copy", async () => {
    accounts.settings.set('user_a', {
      all: {},
      app: { presentation: { speed: 'slow', loop: true }, pagesTourSeen: true },
    });
    const now = await writePreferences(env, 'user_a', {
      presentation: { speed: 'fast', loop: true },
    });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({
      all: { presentation: { speed: 'fast', loop: true } },
      app: { presentation: null },
    });
    expect(accounts.settings.get('user_a')).toEqual({
      all: { presentation: { speed: 'fast', loop: true } },
      app: { pagesTourSeen: true },
    });
    expect(now).toEqual({ presentation: { speed: 'fast', loop: true }, pagesTourSeen: true });
  });
});

describe('getNotificationPrefs', () => {
  it('is opt-out: only an explicit false turns a switch off, legacy names included', async () => {
    accounts.settings.set('user_a', {
      all: { notifyMentions: false },
      app: { notifyDiagramJoin: false, notifyComments: 'no' },
    });
    expect(await getNotificationPrefs(env, 'user_a')).toEqual({
      notifyDocumentJoin: false,
      notifyInviteResponse: true,
      notifyComments: true,
      notifyTips: true,
      notifyMilestones: true,
      notifyActionAssigned: true,
      notifyMentions: false,
    });
  });

  it('notifies when the accounts Worker cannot be read', async () => {
    accounts.failWith = 503;
    expect(Object.values(await getNotificationPrefs(env, 'user_a')).every(Boolean)).toBe(true);
  });
});
