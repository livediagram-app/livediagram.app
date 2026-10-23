import { describe, expect, it } from 'vitest';
import { accountsServiceFor } from '../test-accounts-service';
import { captureTelemetry, TELEMETRY_ON } from '../test-telemetry';
import type { Env } from '../types';
import { reportSignIn } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (docs/specs/017-telemetry/telemetry.md), once per
// completed sign-in, from the /api/auth/callback. liveworkspace keeps which accounts this app has seen
// (recordSighting). These pin the rule: a new account is SignedUp and never also SignedIn; a known one
// is SignedIn; telemetry off counts nothing but still records the sighting, which milestone claims need.

function setUp(env: Partial<Env> = { ...TELEMETRY_ON }) {
  const sent = captureTelemetry();
  const accounts = accountsServiceFor(env);
  accounts.accounts.set('user_abc', { name: 'Ada', email: 'ada@example.test' });
  return { env: env as Env, sent, accounts };
}

const counted = (sent: ReturnType<typeof captureTelemetry>) =>
  sent.map((e) => [e.category, e.action, e.type]);

describe('reportSignIn (docs/specs/017-telemetry/telemetry.md sign-up / sign-in count)', () => {
  it('counts a new account as SignedUp only', async () => {
    const { env, sent } = setUp();
    expect(await reportSignIn(env, 'user_abc')).toBe('SignedUp');
    expect(counted(sent)).toEqual([['Session', 'SignedUp', null]]);
  });

  it('counts a known account as SignedIn', async () => {
    const { env, sent, accounts } = setUp();
    accounts.sightings.add('user_abc');
    expect(await reportSignIn(env, 'user_abc')).toBe('SignedIn');
    expect(counted(sent)).toEqual([['Session', 'SignedIn', null]]);
  });

  it('records the sighting but counts nothing with telemetry off', async () => {
    const { env, sent, accounts } = setUp({});
    expect(await reportSignIn(env, 'user_abc')).toBeNull();
    expect(accounts.sightings.has('user_abc')).toBe(true);
    expect(sent).toEqual([]);
  });

  it('does nothing without sign-in configured', async () => {
    const sent = captureTelemetry();
    expect(await reportSignIn({ ...TELEMETRY_ON } as Env, 'user_abc')).toBeNull();
    expect(sent).toEqual([]);
  });

  it('never throws when liveworkspace fails', async () => {
    const { env, accounts } = setUp();
    accounts.failWith = 500;
    expect(await reportSignIn(env, 'user_abc')).toBeNull();
  });
});
