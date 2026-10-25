import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { reportSignIn } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (docs/specs/017-telemetry/telemetry.md), once per
// completed sign-in, from the /api/auth/callback. These pin the rule: a new account is SignedUp and
// never also SignedIn; a known one is SignedIn; telemetry off counts nothing. Whether an account is new
// to livedocuments is the accounts Worker's sighting, recorded either way.

const TELEMETRY = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as Partial<Env>;
const env = (over: Partial<Env> = {}) => ({ ...ACCOUNTS_ON, ...TELEMETRY, ...over }) as Env;

let accounts: FakeAccounts;
beforeEach(() => {
  accounts = stubAccounts();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const counted = () => accounts.telemetry.map((e) => [e.category, e.action, e.type]);

describe('reportSignIn (docs/specs/017-telemetry/telemetry.md sign-up / sign-in count)', () => {
  it('counts a new account as SignedUp only', async () => {
    expect(await reportSignIn(env(), 'user_abc')).toBe('SignedUp');
    expect(counted()).toEqual([['Session', 'SignedUp', null]]);
    expect(accounts.sightings.has('user_abc')).toBe(true);
  });

  it('counts a known account as SignedIn', async () => {
    accounts.sightings.add('user_abc');
    expect(await reportSignIn(env(), 'user_abc')).toBe('SignedIn');
    expect(counted()).toEqual([['Session', 'SignedIn', null]]);
  });

  it('records the sighting but counts nothing with telemetry off', async () => {
    expect(await reportSignIn(env({ TELEMETRY_ENABLED: undefined }), 'user_abc')).toBeNull();
    expect(accounts.sightings.has('user_abc')).toBe(true);
    expect(accounts.telemetry).toHaveLength(0);
  });

  it('never throws when the accounts Worker does', async () => {
    accounts.failWith = 502;
    expect(await reportSignIn(env(), 'user_abc')).toBeNull();
    expect(accounts.telemetry).toHaveLength(0);
  });
});
