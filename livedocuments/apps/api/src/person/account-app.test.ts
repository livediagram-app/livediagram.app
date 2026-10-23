import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import {
  claimOwnerMilestone,
  ownerEmail,
  ownerEmails,
  recordOwnerSighting,
  reportOwnerActivity,
} from './account-app';

// What the accounts Worker keeps of an account for livedocuments (liveworkspace/docs/accounts.md
// "Sign-ups and milestones per app"): accounts only, and nothing ever throws.

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

describe('account-app', () => {
  it('claims a milestone once, and only for an account livedocuments has seen', async () => {
    expect(await claimOwnerMilestone(env, 'user_a', 'firstShare')).toBe(false);
    expect(await recordOwnerSighting(env, 'user_a')).toBe(true);
    expect(await recordOwnerSighting(env, 'user_a')).toBe(false);
    expect(await claimOwnerMilestone(env, 'user_a', 'firstShare')).toBe(true);
    expect(await claimOwnerMilestone(env, 'user_a', 'firstShare')).toBe(false);
    expect(await claimOwnerMilestone(env, 'user_a', 'milestone')).toBe(true);
  });

  it('looks addresses up in one call, accounts only', async () => {
    accounts.emails.set('user_a', 'a@example.com');
    const found = await ownerEmails(env, ['user_a', 'user_b', GUEST, 'user_a']);
    expect([...found]).toEqual([['user_a', 'a@example.com']]);
    expect(accounts.calls).toEqual([{ path: '/emails', body: { ids: ['user_a', 'user_b'] } }]);
  });

  it('reports activity for an account, never for a guest', async () => {
    await reportOwnerActivity(env, 'user_a', 5);
    await reportOwnerActivity(env, GUEST, 6);
    expect(accounts.activity).toEqual([{ userId: 'user_a', at: 5 }]);
  });

  it('answers as though there were nothing when the accounts Worker fails, or is not there', async () => {
    accounts.failWith = 502;
    expect(await ownerEmail(env, 'user_a')).toBeNull();
    expect(await claimOwnerMilestone(env, 'user_a', 'milestone')).toBe(false);
    expect(await recordOwnerSighting(env, 'user_a')).toBeNull();
    await expect(reportOwnerActivity(env, 'user_a', 1)).resolves.toBeUndefined();
    expect(await ownerEmail({} as Env, 'user_a')).toBeNull();
  });
});
