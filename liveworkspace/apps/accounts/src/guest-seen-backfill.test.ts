// Guests from before the stamp (liveworkspace/docs/specs/003-accounts/accounts.md "Guests from before the stamp"):
// the index's guest owners dated once, over its service binding alone.
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import {
  ACCOUNTS_BINDING_ORIGIN,
  GUEST_SEEN_BACKFILL_PAGE,
  GUEST_SEEN_BACKFILL_PATH,
} from '@liveworkspace/auth-client/guest-seen-backfill';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import type { Env } from './env.ts';
import {
  backfillGuestSeen,
  GUEST_IDLE_MS,
  GUEST_SEEN_FROM,
  noteGuestSeen,
  OLD_SITE_CLOSED,
  sweepIdleGuests,
} from './guest-sweep.ts';
import { testD1 } from './test-d1.ts';

const guest = (n: number) => `guest_${n.toString(16).padStart(8, '0')}-6d7e-4f3b-9a51-2c1d0e9f8a7b`;
const DAY = 24 * 60 * 60 * 1000;

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
const count = () => (sql.prepare('SELECT count(*) AS n FROM guest_seen').get() as { n: number }).n;
const legacy = (id: string, claimedAt: number | null = null) =>
  sql
    .prepare('INSERT INTO legacy_guest (id, firstSeenAt, claimedAt, claimedBy) VALUES (?, 0, ?, ?)')
    .run(id, claimedAt, claimedAt === null ? null : 'user_ada');

describe('dating the guests accounts has never seen', () => {
  it('gives a guest with no row 2026-10-25, and keeps a row already there', async () => {
    await noteGuestSeen(db, guest(1), Date.UTC(2026, 10, 10));
    expect(await backfillGuestSeen(db, [guest(1), guest(2)])).toBe(1);
    expect(seenAt(guest(1))).toBe(Date.UTC(2026, 10, 10));
    expect(seenAt(guest(2))).toBe(GUEST_SEEN_FROM);
    expect(new Date(GUEST_SEEN_FROM).toISOString()).toBe('2026-10-25T23:59:59.999Z');
    // Sent again, nothing changes.
    expect(await backfillGuestSeen(db, [guest(1), guest(2)])).toBe(0);
    expect(seenAt(guest(2))).toBe(GUEST_SEEN_FROM);
  });

  it("keeps an earlier row as it is, even one older than the backfill's date", async () => {
    await noteGuestSeen(db, guest(1), Date.UTC(2026, 9, 25, 16));
    await backfillGuestSeen(db, [guest(1)]);
    expect(seenAt(guest(1))).toBe(Date.UTC(2026, 9, 25, 16));
  });

  it('dates an old livediagram.app guest from the day the old site closed, and skips a claimed one', async () => {
    legacy(guest(1));
    legacy(guest(2), Date.UTC(2026, 10, 1));
    expect(await backfillGuestSeen(db, [guest(1), guest(2), guest(3)])).toBe(2);
    expect(seenAt(guest(1))).toBe(OLD_SITE_CLOSED);
    expect(new Date(OLD_SITE_CLOSED).toISOString()).toBe('2026-10-27T23:59:59.999Z');
    expect(seenAt(guest(2))).toBeUndefined();
    expect(seenAt(guest(3))).toBe(GUEST_SEEN_FROM);
  });

  it('never dates anything that is not a guest id, and takes each id once', async () => {
    expect(await backfillGuestSeen(db, ['user_ada', 'guest_nope', 'deleted'])).toBe(0);
    expect(await backfillGuestSeen(db, [guest(1), guest(1)])).toBe(1);
    expect(count()).toBe(1);
  });

  it('sweeps them 400 days on, never before', async () => {
    await backfillGuestSeen(db, [guest(1)]);
    legacy(guest(2));
    await backfillGuestSeen(db, [guest(2)]);
    // 2027-11-29, the day before: kept.
    expect(await sweepIdleGuests(db, GUEST_SEEN_FROM + GUEST_IDLE_MS)).toBe(0);
    // The daily run on 2027-11-30 takes the guest; the old site's guest two days later.
    expect(await sweepIdleGuests(db, Date.UTC(2027, 10, 30, 9, 17))).toBe(1);
    expect(seenAt(guest(2))).toBe(OLD_SITE_CLOSED);
    expect(await sweepIdleGuests(db, Date.UTC(2027, 11, 1, 9, 17))).toBe(0);
    expect(await sweepIdleGuests(db, Date.UTC(2027, 11, 2, 9, 17))).toBe(1);
    expect(count()).toBe(0);
    // Anything a credential issued before the stamp could reach is gone by then: a cookie lasts 400 days at most.
    expect(Date.UTC(2027, 10, 30, 9, 17) - Date.UTC(2026, 9, 25, 16)).toBeGreaterThan(400 * DAY);
  });

  it('writes a page of 500 in one statement, inside the sweep budget', async () => {
    const ids = Array.from({ length: GUEST_SEEN_BACKFILL_PAGE }, (_, i) => guest(i));
    for (let i = 0; i < 100; i++) await noteGuestSeen(db, ids[i]!, Date.UTC(2026, 10, 1));
    let added = 0;
    const ms = await cpuMsOfAsync(async () => {
      added = await backfillGuestSeen(db, ids);
    });
    expect(added).toBe(GUEST_SEEN_BACKFILL_PAGE - 100);
    expect(count()).toBe(GUEST_SEEN_BACKFILL_PAGE);
    expect(ms).toBeLessThan(cpuBudgetMs(500));
  });
});

describe('the index door, over the binding alone', () => {
  const env = () => ({ AUTH_DB: db, INDEX_MERGE_KEY: 'merge-key' }) as unknown as Env;
  const call = (
    body: unknown,
    { origin = ACCOUNTS_BINDING_ORIGIN, key = 'merge-key', method = 'POST' } = {},
  ) =>
    handleAccountApi(
      new Request(`${origin}${GUEST_SEEN_BACKFILL_PATH}`, {
        method,
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      }),
      env(),
      {} as Auth,
    );

  it('dates the guests it is sent, and answers how many', async () => {
    const res = await call({ ids: [guest(1), 'user_ada', 7] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ added: 1 });
    expect(seenAt(guest(1))).toBe(GUEST_SEEN_FROM);
  });

  it('is a plain 404 on any public host, even with the key', async () => {
    for (const origin of [
      'https://www.liveworkspace.app',
      'https://liveworkspace.app',
      'https://staging.liveworkspace.app',
    ]) {
      const res = await call({ ids: [guest(1)] }, { origin });
      expect(res.status).toBe(404);
    }
    expect(count()).toBe(0);
  });

  it("refuses a call without the index's key, another method, and too many ids", async () => {
    expect((await call({ ids: [guest(1)] }, { key: 'nope' })).status).toBe(401);
    expect((await call(undefined, { method: 'GET' })).status).toBe(404);
    const tooMany = Array.from({ length: GUEST_SEEN_BACKFILL_PAGE + 1 }, (_, i) => guest(i));
    expect((await call({ ids: tooMany })).status).toBe(400);
    expect((await call({ ids: 'guest' })).status).toBe(400);
    expect(count()).toBe(0);
  });
});
