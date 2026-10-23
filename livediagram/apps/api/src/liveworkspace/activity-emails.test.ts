import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountsServiceFor, type TestAccountsService } from '../test-accounts-service';
import type { Env } from '../types';
import { reportOwnerActivity } from './activity';
import { claimMilestone, getOwnerEmail, getOwnerEmails } from './emails';

const GUEST = '0f5ca4af-9a8a-4a60-be5e-1179e5555880';

let env: Env;
let accounts: TestAccountsService;

beforeEach(() => {
  env = {} as Env;
  accounts = accountsServiceFor(env);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The once-a-minute pacing is the canvas's (its summary push, document-room/document-outbox.ts); this sends.
describe('reportOwnerActivity', () => {
  it('reports an account’s save', async () => {
    await reportOwnerActivity(env, 'user_a', 1000);
    await reportOwnerActivity(env, 'user_a', 2000);
    expect(accounts.activity).toEqual([
      { userId: 'user_a', at: 1000 },
      { userId: 'user_a', at: 2000 },
    ]);
  });

  it('sends nothing for a guest or without sign-in', async () => {
    await reportOwnerActivity(env, GUEST, 1000);
    await reportOwnerActivity({} as Env, 'user_a', 1000);
    expect(accounts.activity).toEqual([]);
  });

  it('never rejects when liveworkspace is out of reach', async () => {
    accounts.failWith = 503;
    await expect(reportOwnerActivity(env, 'user_a', 1000)).resolves.toBeUndefined();
    accounts.failWith = null;
    await reportOwnerActivity(env, 'user_a', 1001);
    expect(accounts.activity).toEqual([{ userId: 'user_a', at: 1001 }]);
  });
});

describe('getOwnerEmails / claimMilestone', () => {
  it('asks once for the accounts among the ids, leaving guests and the unverified out', async () => {
    accounts.accounts.set('user_a', { name: null, email: 'a@example.test' });
    accounts.accounts.set('user_b', { name: null, email: null });
    expect(await getOwnerEmails(env, ['user_a', 'user_b', GUEST])).toEqual({
      user_a: 'a@example.test',
    });
    expect(accounts.calls).toEqual(['POST /emails']);
    expect(await getOwnerEmail(env, 'user_b')).toBeNull();
    expect(await getOwnerEmails(env, [GUEST])).toEqual({});
    expect(await getOwnerEmails({} as Env, ['user_a'])).toEqual({});
  });

  it('writes to nobody when liveworkspace is out of reach', async () => {
    accounts.failWith = 503;
    expect(await getOwnerEmail(env, 'user_a')).toBeNull();
  });

  it('claims a milestone once, and never on doubt', async () => {
    accounts.sightings.add('user_a');
    expect(await claimMilestone(env, 'user_a', 'firstShare')).toBe(true);
    expect(await claimMilestone(env, 'user_a', 'firstShare')).toBe(false);
    expect(await claimMilestone(env, GUEST, 'milestone')).toBe(false);
    accounts.failWith = 503;
    expect(await claimMilestone(env, 'user_a', 'milestone')).toBe(false);
  });
});
