import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { GUEST_IDLE_MS, GUEST_SWEEP_LIMIT, noteGuestSeen, sweepIdleGuests } from './guest-sweep.ts';
import { testD1 } from './test-d1.ts';

const guest = (n: number) => `guest_${n.toString(16).padStart(8, '0')}-6d7e-4f3b-9a51-2c1d0e9f8a7b`;
const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

let db: D1Database;
let sql: DatabaseSync;

beforeEach(() => {
  ({ db, sql } = testD1());
});

const seenAt = (id: string) =>
  (
    sql.prepare('SELECT seen_at FROM guest_seen WHERE guest_id = ?').get(id) as
      { seen_at: number } | undefined
  )?.seen_at;

function keepFor(id: string) {
  sql
    .prepare(`INSERT INTO settings (owner_id, scope, prefs, updated_at) VALUES (?, 'all', '{}', 0)`)
    .run(id);
  sql
    .prepare(
      `INSERT INTO profile (owner_id, name, color, created_at, updated_at) VALUES (?, 'G', NULL, 0, 0)`,
    )
    .run(id);
}
const count = (table: string) =>
  (sql.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('noting a guest seen', () => {
  it('stamps at most once a day', async () => {
    await noteGuestSeen(db, guest(1), NOW);
    await noteGuestSeen(db, guest(1), NOW + DAY - 1);
    expect(seenAt(guest(1))).toBe(NOW);
    await noteGuestSeen(db, guest(1), NOW + DAY + 1);
    expect(seenAt(guest(1))).toBe(NOW + DAY + 1);
  });

  it('ignores anything that is not a guest id', async () => {
    await noteGuestSeen(db, 'user_ada', NOW);
    expect(count('guest_seen')).toBe(0);
  });
});

describe('sweeping guests who can never come back', () => {
  it('deletes what is kept for a guest unseen for 400 days, and nothing else', async () => {
    await noteGuestSeen(db, guest(1), NOW - GUEST_IDLE_MS - 1);
    await noteGuestSeen(db, guest(2), NOW - GUEST_IDLE_MS + DAY);
    keepFor(guest(1));
    keepFor(guest(2));
    keepFor('user_ada');
    expect(await sweepIdleGuests(db, NOW)).toBe(1);
    expect(count('settings')).toBe(2);
    expect(count('profile')).toBe(2);
    expect(seenAt(guest(1))).toBeUndefined();
    expect(seenAt(guest(2))).toBeDefined();
  });

  it('takes a bounded batch a run, the longest unseen first, and finishes in budget', async () => {
    const total = GUEST_SWEEP_LIMIT + 100;
    const insert = sql.prepare('INSERT INTO guest_seen (guest_id, seen_at) VALUES (?, ?)');
    for (let i = 0; i < total; i++) {
      insert.run(guest(i), i);
      keepFor(guest(i));
    }
    const started = performance.now();
    expect(await sweepIdleGuests(db, NOW)).toBe(GUEST_SWEEP_LIMIT);
    const took = performance.now() - started;
    expect(count('guest_seen')).toBe(100);
    // The 500 longest unseen went first.
    expect(seenAt(guest(GUEST_SWEEP_LIMIT - 1))).toBeUndefined();
    expect(seenAt(guest(GUEST_SWEEP_LIMIT))).toBe(GUEST_SWEEP_LIMIT);
    expect(await sweepIdleGuests(db, NOW)).toBe(100);
    expect(count('profile')).toBe(0);
    expect(took).toBeLessThan(500);
  });
});
