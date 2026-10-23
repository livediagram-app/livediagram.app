import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { getNotificationPrefs, readPreferences, SETTINGS_APP, writePreferences } from './settings';

// A person's settings live at the accounts Worker in two scopes (liveworkspace/docs/accounts.md
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
      app: { mapSize: 'tall', reduceMotion: false },
    });
    expect(await readPreferences(env, 'user_a')).toEqual({ reduceMotion: true, mapSize: 'tall' });
    expect(accounts.calls).toEqual([
      { path: '/settings/read', body: { owner: 'user_a', app: SETTINGS_APP } },
    ]);
  });

  it("keeps a guest's settings under the accounts Worker's guest id", async () => {
    await writePreferences(env, GUEST, { mapSize: 'short' });
    expect(accounts.settings.get(`guest_${GUEST}`)).toEqual({ all: {}, app: { mapSize: 'short' } });
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
      app: { presentation: { speed: 'slow', loop: true }, mapSize: 'tall' },
    });
    const now = await writePreferences(env, 'user_a', {
      uiScalePanels: null,
      presentation: { speed: 'fast' },
    });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({
      all: { uiScalePanels: null },
      app: { presentation: { speed: 'fast' } },
    });
    expect(now).toEqual({
      uiScale: 1.1,
      telemetryEnabled: false,
      presentation: { speed: 'fast' },
      mapSize: 'tall',
    });
  });

  it('sends only the scopes the patch names', async () => {
    await writePreferences(env, 'user_a', { mapSize: 'short' });
    expect(accounts.calls.at(-1)!.body.patch).toEqual({ app: { mapSize: 'short' } });
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
