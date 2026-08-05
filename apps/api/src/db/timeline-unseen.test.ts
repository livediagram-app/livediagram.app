import { describe, expect, it, vi } from 'vitest';
import { countUnseen } from './timeline';
import type { Env } from '../types';

// The unread badge (spec/138 §2.5).
//
// Regression coverage for a badge nobody could clear. Expiry warnings are
// written FUTURE-dated on purpose — a token lapsing on the 12th is recorded at
// the 12th so it renders in the Upcoming band — and they carry no actor, so
// the `actor_id IS NULL` clause counts them by design. Marking a scope seen
// only ever writes `now`, so `occurred_at > last_seen_at` stayed true for
// them on every single visit: one lapsing credential pinned the sidebar badge
// to "1" for a week, two pinned it to "2", and reading the feed did nothing.
function fakeDb(count = 0) {
  const first = vi.fn().mockResolvedValue({ n: count });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { env: { DB: { prepare } } as unknown as Env, prepare, bind };
}

const SCOPE = { scopeType: 'user' as const, scopeId: 'u-1' };
const NOW = 1_700_000_000_000;

describe('countUnseen', () => {
  it('bounds the window at both ends, so a future-dated event cannot pin the badge', async () => {
    const { env, prepare, bind } = fakeDb();
    await countUnseen(env, SCOPE, NOW - 86_400_000, 99, NOW);
    const sql = prepare.mock.calls[0]![0] as string;
    // Since the reader last looked…
    expect(sql).toContain('e.occurred_at > ?3');
    // …and no further forward than the present. Without this clause the
    // count can never reach zero while an Upcoming event exists.
    expect(sql).toContain('e.occurred_at <= ?5');
    expect(bind).toHaveBeenCalledWith('user', 'u-1', NOW - 86_400_000, 100, NOW);
  });

  it('still excludes the reader as the actor while keeping system events', async () => {
    // The two halves have to hold together: dropping the actor clause would
    // silence the expiry warnings this fix is about, since they have no actor.
    const { env, prepare } = fakeDb();
    await countUnseen(env, SCOPE, 0, 99, NOW);
    const sql = prepare.mock.calls[0]![0] as string;
    expect(sql).toContain('e.actor_id IS NULL OR e.actor_id <> ?2');
  });

  it('defaults the clamp to the current time', async () => {
    // Callers in the route don't pass `now`; the parameter exists so a test
    // can pin it. If the default were dropped the clamp would bind undefined
    // and SQLite would compare against NULL, counting nothing at all.
    const { env, bind } = fakeDb();
    const before = Date.now();
    await countUnseen(env, SCOPE, 0);
    const bound = bind.mock.calls[0]![4] as number;
    expect(bound).toBeGreaterThanOrEqual(before);
    expect(bound).toBeLessThanOrEqual(Date.now());
  });

  it('returns 0 rather than NaN when the row is missing', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const env = { DB: { prepare: vi.fn().mockReturnValue({ bind }) } } as unknown as Env;
    expect(await countUnseen(env, SCOPE, 0, 99, NOW)).toBe(0);
  });
});
