import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';

const { client } = vi.hoisted(() => ({
  client: {
    emailEnabled: vi.fn(() => true),
    sendEmail: vi.fn(async (_env: unknown, _msg: { to: string; kind: string; html: string }) => ({
      sent: true,
    })),
  },
}));
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  ...client,
}));

import { MAX_SEND_ATTEMPTS } from '../db/email-lifecycle';
import { resolveDeclineToken } from '../db/team-invite-decline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runTeamInviteSweep } from './team-invite-reminders';

// docs/specs/013-workspace/teams.md "Reminders and expiry": the daily cron step end to end, against a real
// schema, with the provider stubbed.

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

function setup(rows: { id: string; ageDays: number }[]) {
  const db = sqliteD1();
  db.sql
    .prepare(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'Design', 0, 0)`)
    .run();
  const insert = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, clock_started_at, created_at, updated_at)
     VALUES (?, 't', NULL, ?, 'member', 'invited', ?, 0, 0)`,
  );
  for (const r of rows) insert.run(r.id, `${r.id}@x.test`, NOW - r.ageDays * DAY);
  const row = (id: string) =>
    db.sql.prepare('SELECT * FROM team_members WHERE id = ?').get(id) as Record<string, unknown>;
  return { db, row };
}

// The decline token in a sent email's link.
function tokenIn(html: string): string {
  const match = /\/join\/decline\?token=([^"]+)"/.exec(html);
  return decodeURIComponent(match?.[1] ?? '');
}

describe('runTeamInviteSweep', () => {
  beforeEach(() => {
    client.emailEnabled.mockReturnValue(true);
    client.sendEmail.mockReset();
    client.sendEmail.mockResolvedValue({ sent: true });
  });

  it('sends each due invite the reminder for its window, with a working decline link', async () => {
    const { db, row } = setup([
      { id: '00000000-0000-4000-8000-000000000001', ageDays: 2 },
      { id: '00000000-0000-4000-8000-000000000002', ageDays: 10 },
      { id: '00000000-0000-4000-8000-000000000003', ageDays: 25 },
    ]);
    const result = await runTeamInviteSweep(db.env, NOW);
    expect(result).toEqual({ expired: 0, sent: 3, failed: 0 });
    const kinds = client.sendEmail.mock.calls.map(([, msg]) => [msg.to, msg.kind]);
    expect(kinds).toEqual([
      ['00000000-0000-4000-8000-000000000003@x.test', 'TeamInviteReminder3'],
      ['00000000-0000-4000-8000-000000000002@x.test', 'TeamInviteReminder2'],
      ['00000000-0000-4000-8000-000000000001@x.test', 'TeamInviteReminder1'],
    ]);
    for (const [, msg] of client.sendEmail.mock.calls) {
      const found = await resolveDeclineToken(db.env, tokenIn(msg.html));
      expect(found?.email).toBe(msg.to);
    }
    // The one that fell behind had its skipped stages stamped 0.
    expect(row('00000000-0000-4000-8000-000000000003')).toMatchObject({
      reminder1_sent_at: 0,
      reminder2_sent_at: 0,
    });
  });

  it('sends nothing more the next day, and the next stage once it is due', async () => {
    const { db } = setup([{ id: '00000000-0000-4000-8000-000000000001', ageDays: 2 }]);
    await runTeamInviteSweep(db.env, NOW);
    await runTeamInviteSweep(db.env, NOW + DAY);
    expect(client.sendEmail).toHaveBeenCalledTimes(1);
    await runTeamInviteSweep(db.env, NOW + 5 * DAY);
    expect(client.sendEmail).toHaveBeenCalledTimes(2);
    expect(client.sendEmail.mock.calls[1]![1].kind).toBe('TeamInviteReminder2');
  });

  it('stops for an invite that was answered', async () => {
    const { db } = setup([{ id: '00000000-0000-4000-8000-000000000001', ageDays: 2 }]);
    db.sql.prepare(`UPDATE team_members SET status = 'declined'`).run();
    await runTeamInviteSweep(db.env, NOW);
    expect(client.sendEmail).not.toHaveBeenCalled();
  });

  it('retries a failed send until the attempt cap, storing no hash for it', async () => {
    const { db, row } = setup([{ id: '00000000-0000-4000-8000-000000000001', ageDays: 2 }]);
    client.sendEmail.mockResolvedValue({ sent: false });
    for (let day = 0; day < MAX_SEND_ATTEMPTS + 2; day++) {
      await runTeamInviteSweep(db.env, NOW + day * 0.1 * DAY);
    }
    expect(client.sendEmail).toHaveBeenCalledTimes(MAX_SEND_ATTEMPTS);
    expect(row('00000000-0000-4000-8000-000000000001')).toMatchObject({
      reminder_attempts: MAX_SEND_ATTEMPTS,
      reminder1_sent_at: null,
      decline_token_hashes: null,
    });
  });

  it('expires invites 28 days old even with email off, and sends nothing', async () => {
    client.emailEnabled.mockReturnValue(false);
    const { db, row } = setup([
      { id: '00000000-0000-4000-8000-000000000001', ageDays: 30 },
      { id: '00000000-0000-4000-8000-000000000002', ageDays: 2 },
    ]);
    const result = await runTeamInviteSweep(db.env, NOW);
    expect(result).toEqual({ expired: 1, sent: 0, failed: 0 });
    expect(row('00000000-0000-4000-8000-000000000001').status).toBe('expired');
    expect(client.sendEmail).not.toHaveBeenCalled();
  });

  it('never throws into the cron', async () => {
    const env = {
      DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(runTeamInviteSweep(env as never, NOW)).resolves.toEqual({
      expired: 0,
      sent: 0,
      failed: 0,
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('gives an invite 40 days old at the deploy the full series, not a rejection', async () => {
    const db = sqliteD1({}, { before: '0095' });
    db.sql
      .prepare(`INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'Design', 0, 0)`)
      .run();
    const id = '00000000-0000-4000-8000-000000000009';
    db.sql
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
         VALUES (?, 't', NULL, 'old@x.test', 'member', 'invited', ?, 0)`,
      )
      .run(id, Date.now() - 40 * DAY);
    db.sql.exec(
      readFileSync(
        fileURLToPath(
          new URL('../../migrations/0095_team_invite_decline_and_reminders.sql', import.meta.url)
            .href,
        ),
        'utf8',
      ),
    );
    const deploy = Date.now();
    const status = () =>
      (db.sql.prepare('SELECT status FROM team_members WHERE id = ?').get(id) as { status: string })
        .status;
    // The first run, on deploy day: nothing expires and nothing is due yet.
    await expect(runTeamInviteSweep(db.env, deploy)).resolves.toEqual({
      expired: 0,
      sent: 0,
      failed: 0,
    });
    expect(status()).toBe('invited');
    // The next day: reminder 1, with a working decline link.
    await runTeamInviteSweep(db.env, deploy + DAY + 60_000);
    expect(client.sendEmail).toHaveBeenCalledOnce();
    const [, msg] = client.sendEmail.mock.calls[0]!;
    expect(msg.kind).toBe('TeamInviteReminder1');
    expect((await resolveDeclineToken(db.env, tokenIn(msg.html)))?.email).toBe('old@x.test');
    // And it expires 28 days after the deploy, not after it was sent.
    await runTeamInviteSweep(db.env, deploy + 27 * DAY);
    expect(status()).toBe('invited');
    await runTeamInviteSweep(db.env, deploy + 28 * DAY + 60_000);
    expect(status()).toBe('expired');
  });
});
