import { describe, expect, it, vi } from 'vitest';
import { fakeD1, type D1Response } from '../test-d1';
import type { Env } from '../types';
import type { ClerkIdentity } from './clerk';
import { FRESH_SIGN_IN_MINUTES, noteAuthSighting, reportAuthSighting } from './session-telemetry';

// Session·SignedUp / SignedIn are counted server-side (spec/22) so a Google
// sign-up through /sso-callback counts the same as an email-code one, and each
// completed authentication counts exactly once. These pin the rule: a new
// session id is one event; a new account makes it SignedUp and never also
// SignedIn; a seen session, a stale one, or telemetry off counts nothing.

const ON = { TELEMETRY_ENABLED: 'true' } as Partial<Env>;

function identity(over: Partial<ClerkIdentity> = {}): ClerkIdentity {
  return {
    userId: 'user_abc',
    email: null,
    sessionId: 'sess_1',
    firstFactorAgeMinutes: 0,
    ...over,
  };
}

// A D1 where the session / account inserts report whether they created a row.
function db(opts: { newSession: boolean; newAccount: boolean }, env: Partial<Env> = ON) {
  return fakeD1(({ sql }): D1Response | undefined => {
    if (sql.includes('INTO auth_sessions')) return { changes: opts.newSession ? 1 : 0 };
    if (sql.includes('INTO auth_accounts')) return { changes: opts.newAccount ? 1 : 0 };
    return undefined;
  }, env);
}

const counted = (d: ReturnType<typeof fakeD1>) =>
  d.matching('INSERT INTO events').map((c) => c.bindings.slice(0, 3));

describe('reportAuthSighting (spec/22 sign-up / sign-in count)', () => {
  it('counts a new session on a new account as SignedUp only', async () => {
    const d = db({ newSession: true, newAccount: true });
    expect(await reportAuthSighting(d.env, identity())).toBe('SignedUp');
    expect(counted(d)).toEqual([['Session', 'SignedUp', null]]);
  });

  it('counts a new session on a known account as SignedIn', async () => {
    // A Google sign-in of an existing account lands here exactly like an
    // email-code one: the worker never needs to know the method.
    const d = db({ newSession: true, newAccount: false });
    expect(await reportAuthSighting(d.env, identity())).toBe('SignedIn');
    expect(counted(d)).toEqual([['Session', 'SignedIn', null]]);
  });

  it('counts nothing for a session already seen (refreshes, reloads, autosaves)', async () => {
    const d = db({ newSession: false, newAccount: false });
    expect(await reportAuthSighting(d.env, identity())).toBeNull();
    expect(counted(d)).toEqual([]);
    // The account insert isn't even attempted once the session is known.
    expect(d.matching('auth_accounts')).toHaveLength(0);
  });

  it('records but does not count a session whose first factor is long verified', async () => {
    // A session that predates this counting (or outlived the row retention)
    // is not a fresh authentication; its account is still recorded so the
    // user's next real sign-in reads as SignedIn, not SignedUp.
    const d = db({ newSession: true, newAccount: true });
    const stale = identity({ firstFactorAgeMinutes: FRESH_SIGN_IN_MINUTES + 1 });
    expect(await reportAuthSighting(d.env, stale)).toBeNull();
    expect(d.matching('INTO auth_accounts')).toHaveLength(1);
    expect(counted(d)).toEqual([]);
  });

  it('treats a missing fva claim as fresh', async () => {
    const d = db({ newSession: true, newAccount: false });
    expect(await reportAuthSighting(d.env, identity({ firstFactorAgeMinutes: null }))).toBe(
      'SignedIn',
    );
  });

  it('does nothing without a session id, or with telemetry off', async () => {
    const noSid = db({ newSession: true, newAccount: true });
    expect(await reportAuthSighting(noSid.env, identity({ sessionId: null }))).toBeNull();
    expect(noSid.calls).toHaveLength(0);
    const off = db({ newSession: true, newAccount: true }, {});
    expect(await reportAuthSighting(off.env, identity())).toBeNull();
    expect(off.calls).toHaveLength(0);
  });

  it('never throws when D1 does', async () => {
    const env = {
      ...ON,
      DB: {
        prepare: () => {
          throw new Error('D1 down');
        },
      },
    } as unknown as Env;
    expect(await reportAuthSighting(env, identity())).toBeNull();
  });
});

describe('noteAuthSighting (per-isolate memo)', () => {
  it('schedules one sighting per session id, not one per request', () => {
    const d = db({ newSession: true, newAccount: false });
    const waitUntil = vi.fn();
    const id = identity({ sessionId: 'sess_memo' });
    noteAuthSighting(d.env, id, waitUntil);
    noteAuthSighting(d.env, id, waitUntil);
    noteAuthSighting(d.env, identity({ sessionId: 'sess_memo_2' }), waitUntil);
    expect(waitUntil).toHaveBeenCalledTimes(2);
  });

  it('skips guests and telemetry-off deployments', () => {
    const waitUntil = vi.fn();
    noteAuthSighting(db({ newSession: true, newAccount: true }).env, null, waitUntil);
    noteAuthSighting(
      db({ newSession: true, newAccount: true }, {}).env,
      identity({ sessionId: 'sess_off' }),
      waitUntil,
    );
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('does nothing with no waitUntil to schedule onto', () => {
    // The worker passes `executionCtx?.waitUntil`, which is optional — the
    // sighting is background work, so with nowhere to put it there is nothing
    // to do. Notably it must NOT memo the session in that case, or the id
    // would be burned without the write ever running.
    const d = db({ newSession: true, newAccount: false });
    noteAuthSighting(d.env, identity({ sessionId: 'sess_no_ctx' }), undefined);
    expect(d.calls).toHaveLength(0);
    const waitUntil = vi.fn();
    noteAuthSighting(d.env, identity({ sessionId: 'sess_no_ctx' }), waitUntil);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('clears the memo at its cap rather than growing forever', () => {
    // A long-lived isolate must not accumulate every session id it has ever
    // seen. The memo is dropped wholesale at the cap, and the cost of that is
    // one more idempotent write for an id that had already been counted —
    // never a missed count, which is why clearing is safe.
    const d = db({ newSession: true, newAccount: false });
    const waitUntil = vi.fn();
    const early = identity({ sessionId: 'sess_cap_early' });
    noteAuthSighting(d.env, early, waitUntil);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    // Past the cap (10_000) with distinct ids, so at least one clear happens
    // and `early` is never re-added.
    for (let i = 0; i <= 10_000; i++) {
      noteAuthSighting(d.env, identity({ sessionId: `sess_cap_${i}` }), waitUntil);
    }
    waitUntil.mockClear();
    // Cleared, so the pre-cap id reads as new again and schedules once more.
    noteAuthSighting(d.env, early, waitUntil);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});
