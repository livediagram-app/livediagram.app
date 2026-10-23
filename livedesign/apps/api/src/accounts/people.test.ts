import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import {
  __forgetActivity,
  ACTIVITY_REPORT_EVERY_MS,
  claimAccountMilestone,
  emailOf,
  emailsOf,
  recordAccountSighting,
  reportOwnerActivity,
} from './people';
import { getNotificationPrefs } from './settings';

// What the liveworkspace accounts Worker keeps of a signed-in person for livedesign
// (liveworkspace/docs/accounts.md "Sign-ups and milestones per app"), against its stand-in.

let accounts: FakeAccounts;
let env: Env;
let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  __forgetActivity();
  accounts = fakeAccounts();
  accounts.accounts.set('user_ann', { name: 'Ann', email: 'ann@example.com' });
  accounts.accounts.set('user_bo', { name: 'Bo', email: null });
  env = accounts.env as unknown as Env;
  vi.stubGlobal('fetch', accounts.fetch);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  warn.mockRestore();
});

describe('sightings and milestones', () => {
  it('is a sign-up the first time only', async () => {
    expect(await recordAccountSighting(env, 'user_ann')).toBe(true);
    expect(await recordAccountSighting(env, 'user_ann')).toBe(false);
  });

  it('claims a milestone once, and only for an account livedesign has seen', async () => {
    expect(await claimAccountMilestone(env, 'user_ann', 'milestone')).toBe(false);
    await recordAccountSighting(env, 'user_ann');
    expect(await claimAccountMilestone(env, 'user_ann', 'milestone')).toBe(true);
    expect(await claimAccountMilestone(env, 'user_ann', 'milestone')).toBe(false);
    expect(await claimAccountMilestone(env, 'user_ann', 'firstShare')).toBe(true);
  });

  it('asks nothing for a guest or without an accounts Worker, and answers no when it is down', async () => {
    expect(await recordAccountSighting(env, 'guest')).toBeNull();
    expect(await claimAccountMilestone(env, 'guest', 'milestone')).toBe(false);
    expect(await recordAccountSighting({} as Env, 'user_ann')).toBeNull();
    expect(accounts.calls).toHaveLength(0);
    accounts.failing.set('sightings', 500);
    accounts.failing.set('milestones/claim', 500);
    expect(await recordAccountSighting(env, 'user_ann')).toBeNull();
    expect(await claimAccountMilestone(env, 'user_ann', 'milestone')).toBe(false);
  });
});

describe('emailsOf', () => {
  it('reads many verified addresses in one request, accounts only', async () => {
    const found = await emailsOf(env, ['user_ann', 'user_bo', 'guest', 'user_ann']);
    expect([...found]).toEqual([['user_ann', 'ann@example.com']]);
    expect(accounts.callsTo('emails')).toEqual([
      { path: 'emails', body: { ids: ['user_ann', 'user_bo'] } },
    ]);
    expect(await emailOf(env, 'user_bo')).toBeNull();
  });

  it('asks nobody about guests alone, and answers none when it is down', async () => {
    expect((await emailsOf(env, ['guest'])).size).toBe(0);
    expect(accounts.calls).toHaveLength(0);
    accounts.failing.set('emails', 500);
    expect((await emailsOf(env, ['user_ann'])).size).toBe(0);
  });
});

describe('reportOwnerActivity', () => {
  it('reports a design at most once a minute, each design on its own', async () => {
    const t = 1_000_000;
    await reportOwnerActivity(env, 'user_ann', 'd1', t);
    await reportOwnerActivity(env, 'user_ann', 'd1', t + 600);
    await reportOwnerActivity(env, 'user_ann', 'd2', t + 600);
    await reportOwnerActivity(env, 'user_ann', 'd1', t + ACTIVITY_REPORT_EVERY_MS);
    expect(accounts.activity).toEqual([
      { userId: 'user_ann', at: t },
      { userId: 'user_ann', at: t + 600 },
      { userId: 'user_ann', at: t + ACTIVITY_REPORT_EVERY_MS },
    ]);
  });

  // A person editing autosaves every ~600 ms: a minute of it is one request.
  it('turns a minute of autosaves into one request', async () => {
    for (let at = 0; at < ACTIVITY_REPORT_EVERY_MS; at += 600) {
      await reportOwnerActivity(env, 'user_ann', 'd1', 5_000_000 + at);
    }
    expect(accounts.callsTo('activity')).toHaveLength(1);
  });

  it('reports nothing for a guest, and never throws', async () => {
    await reportOwnerActivity(env, 'guest', 'd1');
    expect(accounts.calls).toHaveLength(0);
    accounts.failing.set('activity', 500);
    await expect(reportOwnerActivity(env, 'user_ann', 'd9')).resolves.toBeUndefined();
  });
});

describe('getNotificationPrefs', () => {
  it('reads both scopes: only an explicit false turns one off', async () => {
    accounts.settings.set('user_ann', {
      all: { notifyComments: false, notifyMentions: 'no' },
      app: { notifyDesignJoin: false },
      updatedAt: 1,
    });
    expect(await getNotificationPrefs(env, 'user_ann')).toEqual({
      notifyDesignJoin: false,
      notifyInviteResponse: true,
      notifyComments: false,
      notifyMilestones: true,
      notifyActionAssigned: true,
      notifyMentions: true,
    });
  });

  it('notifies when the settings cannot be read', async () => {
    accounts.failing.set('settings/read', 500);
    const prefs = await getNotificationPrefs(env, 'user_ann');
    expect(Object.values(prefs).every(Boolean)).toBe(true);
  });
});
