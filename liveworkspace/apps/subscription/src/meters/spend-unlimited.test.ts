// A spend meter with no limit (subscription.md "A limit of none means unlimited"). No tier has one today, so the
// limit SQL is handed an unlimited figure here: a spend must then be taken, however large the count, and answered
// with `limit: null` as a gauge answers it, never refused and never with the raw -1.
import { describe, expect, it, vi } from 'vitest';
import { subscribe } from '../test-kit';
import { testDb } from '../test-sqlite-d1';
import { UNLIMITED } from './limits';
import { spend } from './spend';

const unlimited = vi.hoisted(() => ({ free: false, paid: false }));
vi.mock('./limits', async (actual) => {
  const real = await actual<typeof import('./limits')>();
  return {
    ...real,
    limitBinds: (...args: Parameters<typeof real.limitBinds>) => {
      const binds = real.limitBinds(...args);
      if (unlimited.free) binds[0] = real.UNLIMITED;
      if (unlimited.paid) binds[1] = real.UNLIMITED;
      return binds;
    },
  };
});

const NOW = Date.UTC(2026, 10, 20, 12);

describe('a spend against no limit', () => {
  it('is always taken, counted, and answered with no limit', async () => {
    const { env } = testDb();
    unlimited.free = true;
    const db = env.SUBSCRIPTION_DB;
    expect(await spend(db, 'p:user_ada', 'aiCredits', 1000, NOW)).toEqual({
      ok: true,
      used: 1000,
      limit: null,
      tier: 'free',
    });
    // Past any tier's number, and still taken: the count keeps going.
    for (let spent = 2000; spent <= 5000; spent += 1000) {
      expect(await spend(db, 'p:user_ada', 'aiCredits', 1000, NOW)).toEqual({
        ok: true,
        used: spent,
        limit: null,
        tier: 'free',
      });
    }
    unlimited.free = false;
    expect(UNLIMITED).toBe(-1);
  });

  it('holds for a team too: an unlimited per-member limit is not multiplied into a number', async () => {
    const { env } = testDb();
    await subscribe(env, 't:team_1', NOW, { seats: 7 });
    unlimited.paid = true;
    expect(await spend(env.SUBSCRIPTION_DB, 't:team_1', 'callMinutes', 900, NOW)).toEqual({
      ok: true,
      used: 900,
      limit: null,
      tier: 'team',
    });
    unlimited.paid = false;
    // With its real limit back, the same owner is refused past it, in the service's numbers.
    expect(await spend(env.SUBSCRIPTION_DB, 't:team_1', 'callMinutes', 1000, NOW)).toMatchObject({
      ok: true,
      limit: 17_500,
    });
  });
});
