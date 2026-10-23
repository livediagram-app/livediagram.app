import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { reportSignIn } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (docs/specs/017-telemetry/telemetry.md), once per
// completed sign-in, from the /api/auth/callback. Whether livedesign has seen the account before is kept
// by the liveworkspace accounts Worker (its sightings). These pin the rule: a new account is SignedUp and
// never also SignedIn; a known one is SignedIn; telemetry off counts nothing but still records the
// sighting, which livedesign's milestone emails need.

const TELEMETRY = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as Partial<Env>;

// What reached the central telemetry service, as [category, action, type].
let sent: unknown[][] = [];
let accounts: FakeAccounts;
beforeEach(() => {
  sent = [];
  accounts = fakeAccounts((_url, init) => {
    const { events } = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
      events: { category: string; action: string; type: string | null }[];
    };
    sent.push(...events.map((e) => [e.category, e.action, e.type]));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  accounts.accounts.set('user_abc', { name: 'Ann', email: null });
  vi.stubGlobal('fetch', accounts.fetch);
});
afterEach(() => vi.unstubAllGlobals());
const env = (extra: Partial<Env> = TELEMETRY) => ({ ...accounts.env, ...extra }) as Env;

describe('reportSignIn (docs/specs/017-telemetry/telemetry.md sign-up / sign-in count)', () => {
  it('counts a new account as SignedUp only', async () => {
    expect(await reportSignIn(env(), 'user_abc')).toBe('SignedUp');
    expect(sent).toEqual([['Session', 'SignedUp', null]]);
    expect(accounts.callsTo('sightings')[0]!.body).toEqual({ userId: 'user_abc' });
  });

  it('counts a known account as SignedIn', async () => {
    accounts.sightings.add('user_abc');
    expect(await reportSignIn(env(), 'user_abc')).toBe('SignedIn');
    expect(sent).toEqual([['Session', 'SignedIn', null]]);
  });

  it('records the sighting but counts nothing with telemetry off', async () => {
    expect(await reportSignIn(env({}), 'user_abc')).toBeNull();
    expect(accounts.sightings.has('user_abc')).toBe(true);
    expect(sent).toHaveLength(0);
  });

  it('counts nothing without an accounts Worker, or for an id that is not an account', async () => {
    expect(await reportSignIn(TELEMETRY as Env, 'user_abc')).toBeNull();
    expect(await reportSignIn(env(), 'guest-id')).toBeNull();
    expect(accounts.calls).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('never throws when the accounts Worker does', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    accounts.failing.set('sightings', 500);
    expect(await reportSignIn(env(), 'user_abc')).toBeNull();
    expect(sent).toHaveLength(0);
    warn.mockRestore();
  });

  it('never throws when the telemetry service does', async () => {
    vi.stubGlobal('fetch', fakeAccounts(() => Promise.reject(new Error('down'))).fetch);
    // The account is unknown to this stand-in, so a sighting, never a sign-up.
    await expect(reportSignIn(env(), 'user_abc')).resolves.toBe('SignedIn');
  });
});
