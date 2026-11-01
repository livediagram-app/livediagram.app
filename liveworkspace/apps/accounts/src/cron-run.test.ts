// The Worker's crons (liveworkspace/docs/specs/003-accounts/blueprints/accounts.md "The crons"): which run is which,
// and the hourly run's emails keeping to the send window, or sending nothing at all without a way to send.
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canSendEmail, cronRun, DAILY_RUN_HOUR_UTC } from './cron-run.ts';
import type { Env } from './env.ts';
import worker from './index.ts';
import { startLifecycle } from './lifecycle.ts';
import { createTeam, inviteMember } from './teams.ts';
import { addUser, testD1 } from './test-d1.ts';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// Wednesday 2026-11-04 14:17 UTC: 14:17 in London, 09:17 in New York, 23:17 in Tokyo.
const WEDNESDAY = Date.UTC(2026, 10, 4, 14, 17);

describe('cronRun', () => {
  it('tells the 15-minute run from the hourly one, and the hourly run that does the daily steps', () => {
    const at = (hour: number) => Date.UTC(2026, 10, 4, hour, 17);
    expect(cronRun({ cron: '*/15 * * * *', scheduledTime: at(9) })).toEqual({
      hourly: false,
      daily: false,
    });
    expect(cronRun({ cron: '17 * * * *', scheduledTime: at(8) })).toEqual({
      hourly: true,
      daily: false,
    });
    expect(cronRun({ cron: '17 * * * *', scheduledTime: at(DAILY_RUN_HOUR_UTC) })).toEqual({
      hourly: true,
      daily: true,
    });
  });

  it('can send with the EMAIL binding, or in development, which logs', () => {
    const binding = {} as Env['EMAIL'];
    expect(canSendEmail({ ENVIRONMENT: 'production', EMAIL: binding })).toBe(true);
    expect(canSendEmail({ ENVIRONMENT: 'development' })).toBe(true);
    expect(canSendEmail({ ENVIRONMENT: 'production' })).toBe(false);
    expect(canSendEmail({ ENVIRONMENT: 'staging' })).toBe(false);
  });
});

describe('the hourly run', () => {
  let db: D1Database;
  let sql: DatabaseSync;
  let sent: { to: string; subject: string }[];
  const EMAIL = {
    send: async (message: { to: string; subject: string }) => {
      sent.push({ to: message.to, subject: message.subject });
      return { messageId: 'm' };
    },
  };
  const env = (extra: Partial<Env> = {}) =>
    ({
      ENVIRONMENT: 'production',
      BASE_URL: 'https://www.liveworkspace.app',
      EMAIL_FROM: 'sign-in@example.com',
      AUTH_DB: db,
      ...extra,
    }) as Env;
  const hourly = (e: Env, at = WEDNESDAY) =>
    worker.scheduled({ cron: '17 * * * *', scheduledTime: at } as ScheduledController, e);
  const one = (query: string, ...args: string[]) =>
    sql.prepare(query).get(...args) as Record<string, unknown>;

  beforeEach(async () => {
    ({ db, sql } = testD1());
    sent = [];
    vi.useFakeTimers({ toFake: ['Date'], now: WEDNESDAY });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // Owed week 1 (and the activation nudge): Ada in London, Cy in Tokyo.
    for (const [id, zone] of [
      ['user_ada', 'Europe/London'],
      ['user_cy', 'Asia/Tokyo'],
    ] as const) {
      addUser(sql, { id, email: `${id}@example.com` });
      sql.prepare('UPDATE "user" SET timeZone = ? WHERE id = ?').run(zone, id);
      await startLifecycle(db, { id, email: `${id}@example.com` }, WEDNESDAY - 8 * DAY);
      sql.prepare('UPDATE email_lifecycle SET welcome_sent_at = 1 WHERE user_id = ?').run(id);
    }
    // An invitation owed its first reminder, to an address with no account (London), and one past its 28 days.
    const made = await createTeam(db, { id: 'user_ada', email: 'user_ada@example.com' }, 'Design');
    if (!made.ok) throw new Error(made.error);
    const ada = { id: 'user_ada', email: 'user_ada@example.com' };
    await inviteMember(db, ada, made.value.id, 'dee@example.com', 'member', WEDNESDAY - 2 * DAY);
    await inviteMember(db, ada, made.value.id, 'eve@example.com', 'member', WEDNESDAY - 29 * DAY);
    // A token of Ada's that expires in three days.
    sql
      .prepare(
        `INSERT INTO api_token (id, userId, tokenHash, name, readOnly, createdAt, expiresAt)
         VALUES ('t1', 'user_ada', 'hash', 'CI', 0, 0, ?)`,
      )
      .run(WEDNESDAY + 3 * DAY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sends nothing and stamps nothing without the EMAIL binding, and still expires invitations', async () => {
    await hourly(env());
    expect(sent).toEqual([]);
    expect(
      one('SELECT week1_sent_at AS v FROM email_lifecycle WHERE user_id = ?', 'user_ada'),
    ).toEqual({
      v: null,
    });
    expect(
      one('SELECT send_attempts AS v FROM email_lifecycle WHERE user_id = ?', 'user_ada'),
    ).toEqual({
      v: 0,
    });
    expect(one('SELECT expiryWarnedAt AS v FROM api_token WHERE id = ?', 't1')).toEqual({
      v: null,
    });
    expect(
      one(
        'SELECT reminder1SentAt AS v, reminderAttempts AS n FROM team_member WHERE email = ?',
        'dee@example.com',
      ),
    ).toEqual({ v: null, n: 0 });
    expect(one('SELECT status AS v FROM team_member WHERE email = ?', 'eve@example.com')).toEqual({
      v: 'declined',
    });
  });

  it('sends to whoever is inside the window, then again to nobody an hour later', async () => {
    await hourly(env({ EMAIL: EMAIL as unknown as Env['EMAIL'] }));
    const to = sent.map((e) => e.to).sort();
    // Ada's activation nudge, week 1 and token warning, and Dee's reminder; Cy is asleep in Tokyo.
    expect(to).toEqual([
      'dee@example.com',
      'user_ada@example.com',
      'user_ada@example.com',
      'user_ada@example.com',
    ]);
    vi.setSystemTime(WEDNESDAY + HOUR);
    await hourly(env({ EMAIL: EMAIL as unknown as Env['EMAIL'] }), WEDNESDAY + HOUR);
    expect(sent).toHaveLength(4);
  });
});
