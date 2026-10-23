import { describe, expect, it } from 'vitest';
import { fakeD1, type D1Response } from '../test-d1';
import { captureTelemetry, TELEMETRY_ON } from '../test-telemetry';
import type { Env } from '../types';
import { reportSignIn } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (docs/specs/017-telemetry/telemetry.md), once per
// completed sign-in, from the /api/auth/callback. These pin the rule: a new account is SignedUp and
// never also SignedIn; a known one is SignedIn; telemetry off counts nothing.

const ON = TELEMETRY_ON as Partial<Env>;

// A D1 where the account insert reports whether it created a row, beside the events posted to the
// telemetry service.
function db(opts: { newAccount: boolean }, env: Partial<Env> = ON) {
  const d = fakeD1(({ sql }): D1Response | undefined => {
    if (sql.includes('INTO auth_accounts')) return { changes: opts.newAccount ? 1 : 0 };
    return undefined;
  }, env);
  return Object.assign(d, { sent: captureTelemetry() });
}

const counted = (d: ReturnType<typeof db>) => d.sent.map((e) => [e.category, e.action, e.type]);

describe('reportSignIn (docs/specs/017-telemetry/telemetry.md sign-up / sign-in count)', () => {
  it('counts a new account as SignedUp only', async () => {
    const d = db({ newAccount: true });
    expect(await reportSignIn(d.env, 'user_abc')).toBe('SignedUp');
    expect(counted(d)).toEqual([['Session', 'SignedUp', null]]);
  });

  it('counts a known account as SignedIn', async () => {
    const d = db({ newAccount: false });
    expect(await reportSignIn(d.env, 'user_abc')).toBe('SignedIn');
    expect(counted(d)).toEqual([['Session', 'SignedIn', null]]);
  });

  it('counts nothing and writes nothing with telemetry off', async () => {
    const d = db({ newAccount: true }, {});
    expect(await reportSignIn(d.env, 'user_abc')).toBeNull();
    expect(d.calls).toHaveLength(0);
    expect(d.sent).toEqual([]);
  });

  it('never throws when the database does', async () => {
    const d = fakeD1(() => {
      throw new Error('D1 down');
    }, ON);
    expect(await reportSignIn(d.env, 'user_abc')).toBeNull();
  });
});
