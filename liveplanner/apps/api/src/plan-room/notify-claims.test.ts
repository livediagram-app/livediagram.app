import { describe, expect, it } from 'vitest';
import { NOTIFY_EMAIL_DEDUPE_MS } from '@liveworkspace/auth-client';
import { sqliteD1 } from '../test-sqlite-d1';
import { claimNotice } from './notify-claims';

// The plan's once-only rules for its notification emails (notify-claims.ts): a key once a window, a sender's
// hourly cap, and a table that never holds more than a day.

const T0 = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

describe('claimNotice', () => {
  it('claims a key once a window, and again once the window has passed', async () => {
    const { env } = sqliteD1();
    const at = (now: number) =>
      claimNotice(env, { key: 'join', sender: 'o', now, dedupeSince: now - 15 * 60_000 });
    expect(await at(T0)).toBe(true);
    expect(await at(T0 + 60_000)).toBe(false);
    expect(await at(T0 + 16 * 60_000)).toBe(true);
  });

  it("holds a sender to the cap, and the cap counts only that sender's claims in the hour", async () => {
    const { env } = sqliteD1();
    const claim = (key: string, sender: string, now = T0) =>
      claimNotice(env, {
        key,
        sender,
        now,
        dedupeSince: now - NOTIFY_EMAIL_DEDUPE_MS,
        rate: { since: now - HOUR, max: 2 },
      });
    expect(await claim('a', 's')).toBe(true);
    expect(await claim('b', 's')).toBe(true);
    expect(await claim('c', 's')).toBe(false);
    expect(await claim('c', 'other')).toBe(true);
    expect(await claim('d', 's', T0 + HOUR + 1)).toBe(true);
  });

  it('keeps no claim past a day', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 50; i++) {
      await claimNotice(db.env, { key: `k${i}`, sender: 's', now: T0 + i, dedupeSince: 0 });
    }
    await claimNotice(db.env, {
      key: 'late',
      sender: 's',
      now: T0 + NOTIFY_EMAIL_DEDUPE_MS + 100,
      dedupeSince: 0,
    });
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM notify_claims').get()!.n).toBe(1);
  });
});
