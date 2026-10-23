import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeD1, type D1Response } from '../test-d1';
import type { Env } from '../types';
import { reportSignIn } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (docs/specs/017-telemetry/telemetry.md), once per
// completed sign-in, from the /api/auth/callback. These pin the rule: a new account is SignedUp and
// never also SignedIn; a known one is SignedIn; telemetry off counts nothing.

const ON = { TELEMETRY_ENABLED: 'true', TELEMETRY_KEY: 'k' } as Partial<Env>;

// A D1 where the account insert reports whether it created a row.
function db(opts: { newAccount: boolean }, env: Partial<Env> = ON) {
  return fakeD1(({ sql }): D1Response | undefined => {
    if (sql.includes('INTO auth_accounts')) return { changes: opts.newAccount ? 1 : 0 };
    return undefined;
  }, env);
}

// What reached the central telemetry service, as [category, action, type].
let sent: unknown[][] = [];
beforeEach(() => {
  sent = [];
  vi.stubGlobal('fetch', (_url: string, init: { body: string }) => {
    const { events } = JSON.parse(init.body) as {
      events: { category: string; action: string; type: string | null }[];
    };
    sent.push(...events.map((e) => [e.category, e.action, e.type]));
    return Promise.resolve(new Response(null, { status: 204 }));
  });
});
afterEach(() => vi.unstubAllGlobals());
const counted = (_d: ReturnType<typeof fakeD1>) => sent;

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
    expect(sent).toHaveLength(0);
  });

  it('never throws when the database does', async () => {
    const d = fakeD1(() => {
      throw new Error('D1 down');
    }, ON);
    expect(await reportSignIn(d.env, 'user_abc')).toBeNull();
  });
});
