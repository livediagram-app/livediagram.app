import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  claimNotifyEmail,
  deleteOldNotifyEmailClaims,
  type NotifyEmailClaim,
} from './notify-email-claims';

// docs/specs/012-collaboration/assigned-actions.md §4 + comment-mentions.md "The email": the same email goes
// once per dedupe window, and one sender's emails are capped per hour, both decided in one statement.
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const T = 1_000 * DAY;

function claim(key: string, over: Partial<NotifyEmailClaim> = {}): NotifyEmailClaim {
  const now = over.now ?? T;
  return {
    key,
    senderId: 'user_a',
    now,
    dedupeSince: now - DAY,
    rateSince: now - HOUR,
    rateMax: 3,
    ...over,
  };
}

describe('claimNotifyEmail', () => {
  it('claims an email once inside the dedupe window, and again once it has passed', async () => {
    const db = sqliteD1();
    expect(await claimNotifyEmail(db.env, claim('k1'))).toBe(true);
    expect(await claimNotifyEmail(db.env, claim('k1', { now: T + HOUR }))).toBe(false);
    expect(await claimNotifyEmail(db.env, claim('k1', { now: T + DAY + 1 }))).toBe(true);
  });

  it('lets two concurrent requests for the same email send it once', async () => {
    const db = sqliteD1();
    const results = await Promise.all([
      claimNotifyEmail(db.env, claim('k1')),
      claimNotifyEmail(db.env, claim('k1')),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('caps one sender per hour, leaving other senders and the next hour alone', async () => {
    const db = sqliteD1();
    for (const key of ['k1', 'k2', 'k3']) {
      expect(await claimNotifyEmail(db.env, claim(key))).toBe(true);
    }
    expect(await claimNotifyEmail(db.env, claim('k4'))).toBe(false);
    expect(await claimNotifyEmail(db.env, claim('k5', { senderId: 'user_b' }))).toBe(true);
    expect(await claimNotifyEmail(db.env, claim('k4', { now: T + HOUR + 1 }))).toBe(true);
    // A refused claim wrote nothing.
    const n = db.sql.prepare('SELECT COUNT(*) AS n FROM notify_email_claims').get() as {
      n: number;
    };
    expect(n.n).toBe(5);
  });

  it('deletes claims older than the cutoff', async () => {
    const db = sqliteD1();
    await claimNotifyEmail(db.env, claim('old', { now: T - 2 * DAY }));
    await claimNotifyEmail(db.env, claim('new'));
    expect(await deleteOldNotifyEmailClaims(db.env, T - DAY)).toBe(1);
    expect(await claimNotifyEmail(db.env, claim('new'))).toBe(false);
  });
});
