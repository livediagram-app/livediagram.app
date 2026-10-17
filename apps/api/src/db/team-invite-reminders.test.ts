import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { MAX_SEND_ATTEMPTS } from './email-lifecycle';
import {
  dueForInviteReminder,
  expireStaleInvites,
  INVITE_EXPIRY_MS,
  INVITE_REMINDER_DELAYS_MS,
  markInviteReminderSent,
  recordInviteReminderFailure,
} from './team-invite-reminders';

// docs/specs/013-workspace/teams.md "Reminders and expiry": the sweep's reads and writes.

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

function setup(rows: { id: string; ageDays: number; status?: string; email?: string | null }[]) {
  const db = sqliteD1();
  db.sql
    .prepare(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'Design', 0, 0)`)
    .run();
  const insert = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, clock_started_at, created_at, updated_at)
     VALUES (?, 't', NULL, ?, 'member', ?, ?, 0, 0)`,
  );
  for (const r of rows) {
    const email = r.email === undefined ? `${r.id}@x.test` : r.email;
    insert.run(r.id, email, r.status ?? 'invited', NOW - r.ageDays * DAY);
  }
  const row = (id: string) =>
    db.sql.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as Record<string, unknown>;
  return { db, row };
}

const ids = (due: { memberId: string }[]) => due.map((d) => d.memberId);

describe('the reminder schedule', () => {
  it('is 1, 7 and 21 days, then expiry at 28', () => {
    expect(INVITE_REMINDER_DELAYS_MS).toEqual({ 1: DAY, 2: 7 * DAY, 3: 21 * DAY });
    expect(INVITE_EXPIRY_MS).toBe(28 * DAY);
  });
});

describe('dueForInviteReminder', () => {
  it('puts each pending invite in exactly one disjoint window', async () => {
    const { db } = setup([
      { id: 'fresh', ageDays: 0.5 },
      { id: 'd1', ageDays: 1 },
      { id: 'd6', ageDays: 6.9 },
      { id: 'd7', ageDays: 7 },
      { id: 'd20', ageDays: 20 },
      { id: 'd21', ageDays: 21 },
      { id: 'd27', ageDays: 27 },
      { id: 'd28', ageDays: 28 },
    ]);
    expect(ids(await dueForInviteReminder(db.env, 1, NOW, 100))).toEqual(['d6', 'd1']);
    expect(ids(await dueForInviteReminder(db.env, 2, NOW, 100))).toEqual(['d20', 'd7']);
    expect(ids(await dueForInviteReminder(db.env, 3, NOW, 100))).toEqual(['d27', 'd21']);
  });

  it('carries the address and team name, oldest first, bounded', async () => {
    const { db } = setup([
      { id: 'a', ageDays: 2 },
      { id: 'b', ageDays: 3 },
    ]);
    expect(await dueForInviteReminder(db.env, 1, NOW, 1)).toEqual([
      { memberId: 'b', email: 'b@x.test', teamName: 'Design' },
    ]);
  });

  it('skips anything not pending, already stamped, addressless, or past the attempt cap', async () => {
    const { db } = setup([
      { id: 'joined', ageDays: 2, status: 'joined' },
      { id: 'declined', ageDays: 2, status: 'declined' },
      { id: 'expired', ageDays: 2, status: 'expired' },
      { id: 'stamped', ageDays: 2 },
      { id: 'noaddress', ageDays: 2, email: null },
      { id: 'dead', ageDays: 2 },
      { id: 'due', ageDays: 2 },
    ]);
    db.sql.prepare(`UPDATE team_members SET reminder1_sent_at = 1 WHERE id = 'stamped'`).run();
    db.sql
      .prepare(`UPDATE team_members SET reminder_attempts = ? WHERE id = 'dead'`)
      .run(MAX_SEND_ATTEMPTS);
    expect(ids(await dueForInviteReminder(db.env, 1, NOW, 100))).toEqual(['due']);
  });
});

describe('markInviteReminderSent', () => {
  it('stamps the stage, marks the earlier ones it stood in for as skipped, and stores the hash', async () => {
    const { db, row } = setup([{ id: 'late', ageDays: 22 }]);
    db.sql
      .prepare(
        `UPDATE team_members SET reminder1_sent_at = 5, decline_token_hashes = 'h0' WHERE id = 'late'`,
      )
      .run();
    await markInviteReminderSent(db.env, 'late', 3, 'h3');
    const r = row('late');
    expect(r.reminder1_sent_at).toBe(5);
    expect(r.reminder2_sent_at).toBe(0);
    expect(Number(r.reminder3_sent_at)).toBeGreaterThan(0);
    expect(r.decline_token_hashes).toBe('h0 h3');
    expect(ids(await dueForInviteReminder(db.env, 3, NOW, 100))).toEqual([]);
  });

  it('starts the hash list when there is none, and resets the attempt count', async () => {
    const { db, row } = setup([{ id: 'a', ageDays: 2 }]);
    await recordInviteReminderFailure(db.env, 'a');
    await markInviteReminderSent(db.env, 'a', 1, 'h1');
    expect(row('a')).toMatchObject({ decline_token_hashes: 'h1', reminder_attempts: 0 });
  });

  it('leaves an invite answered while the email was in flight alone', async () => {
    const { db, row } = setup([{ id: 'a', ageDays: 2, status: 'declined' }]);
    await markInviteReminderSent(db.env, 'a', 1, 'h1');
    expect(row('a')).toMatchObject({ reminder1_sent_at: null, decline_token_hashes: null });
  });
});

describe('recordInviteReminderFailure', () => {
  it('counts failures and answers the new count', async () => {
    const { db } = setup([{ id: 'a', ageDays: 2 }]);
    await expect(recordInviteReminderFailure(db.env, 'a')).resolves.toBe(1);
    await expect(recordInviteReminderFailure(db.env, 'a')).resolves.toBe(2);
    await expect(recordInviteReminderFailure(db.env, 'missing')).resolves.toBe(0);
  });
});

describe('expireStaleInvites', () => {
  it('rejects pending invites 28 days old, oldest first and bounded, and nothing else', async () => {
    const { db, row } = setup([
      { id: 'young', ageDays: 27.9 },
      { id: 'old', ageDays: 28 },
      { id: 'older', ageDays: 40 },
      { id: 'member', ageDays: 90, status: 'joined' },
      { id: 'no', ageDays: 90, status: 'declined' },
    ]);
    await expect(expireStaleInvites(db.env, NOW, 1)).resolves.toBe(1);
    expect(row('older').status).toBe('expired');
    expect(row('old').status).toBe('invited');
    await expect(expireStaleInvites(db.env, NOW, 500)).resolves.toBe(1);
    expect(row('old').status).toBe('expired');
    expect(row('young').status).toBe('invited');
    expect(row('member').status).toBe('joined');
    expect(row('no').status).toBe('declined');
  });

  it('reads the pending index rather than scanning the table', () => {
    const { db } = setup([]);
    const plan = db.sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM team_members
          WHERE status = 'invited' AND clock_started_at <= ? ORDER BY clock_started_at ASC LIMIT ?`,
      )
      .all(NOW, 10) as { detail: string }[];
    expect(plan.map((p) => p.detail).join(' ')).toContain('team_members_pending_idx');
  });
});
