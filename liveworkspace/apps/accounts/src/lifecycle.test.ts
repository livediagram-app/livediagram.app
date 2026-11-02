import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { recordSighting } from './account-apps.ts';
import type { Env } from './env.ts';
import { appUrl, lifecycleEmail } from './lifecycle-email.ts';
import {
  ACTIVATION_DELAY_MS,
  MAX_SEND_ATTEMPTS,
  queueWelcome,
  recordActivity,
  runLifecycle,
  sendWelcomes,
  startLifecycle,
  SWEEP_LIMIT,
  takeWelcomes,
  WINBACK_QUIET_MS,
  type SendEmail,
} from './lifecycle.ts';
import { writeSettings } from './settings.ts';
import { addUser, testD1 } from './test-d1.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_000 * DAY;
// No send window here, for the tests of what goes rather than when: "the send window" below has when.
const env = {
  ENVIRONMENT: 'production',
  BASE_URL: 'https://liveworkspace.app',
  EMAIL_SEND_WINDOW: 'always',
} as Pick<Env, 'ENVIRONMENT' | 'BASE_URL' | 'EMAIL_SEND_WINDOW'>;

let db: D1Database;
let sql: DatabaseSync;
let sent: { to: string; subject: string; unsubscribeUrl?: string; html: string; text: string }[];
let failing: boolean;

const send: SendEmail = async (email) => {
  if (failing) throw new Error('Email Service refused the email');
  sent.push(email);
};

beforeEach(() => {
  ({ db, sql } = testD1());
  sent = [];
  failing = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

async function account(
  id: string,
  at = T0,
  verified = true,
  signupApp: Parameters<typeof startLifecycle>[3] = null,
) {
  addUser(sql, { id, email: `${id}@example.com`, verified });
  await startLifecycle(db, { id, email: `${id}@example.com` }, at, signupApp);
}

const stamp = (id: string, column: string) =>
  (
    sql.prepare(`SELECT ${column} AS v FROM email_lifecycle WHERE user_id = ?`).get(id) as {
      v: number | null;
    }
  ).v;

const run = (now: number, stages?: Parameters<typeof runLifecycle>[3]) =>
  runLifecycle(db, env, send, stages, now);

describe('starting the series', () => {
  it('starts once per account, and never for the client registrar', async () => {
    addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
    expect(await startLifecycle(db, { id: 'user_ada', email: 'ada@example.com' })).toBe(true);
    expect(await startLifecycle(db, { id: 'user_ada', email: 'ada@example.com' })).toBe(false);
    expect(
      await startLifecycle(db, { id: 'user_reg', email: 'client-registrar@liveworkspace.invalid' }),
    ).toBe(false);
  });

  it('hands each waiting welcome out once', () => {
    queueWelcome('user_a');
    queueWelcome('user_b');
    expect(takeWelcomes()).toEqual(['user_a', 'user_b']);
    expect(takeWelcomes()).toEqual([]);
  });
});

describe('the welcome', () => {
  it('goes at once to the accounts named, links to the app they first used, and only once', async () => {
    await account('user_ada');
    await account('user_bea');
    await recordSighting(db, 'user_ada', 'liveplanner.app');
    expect(await sendWelcomes(db, env, send, ['user_ada'], T0)).toMatchObject({ sent: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: 'user_ada@example.com',
      subject: 'Welcome to liveworkspace',
    });
    expect(sent[0]!.html).toContain('https://www.liveplanner.app/new');
    // The welcome carries no opt-out: nothing could have been turned off yet.
    expect(sent[0]!.unsubscribeUrl).toBeUndefined();
    // The catch-up run sends Bea's, and not Ada's again.
    await run(T0 + 1, ['welcome']);
    expect(sent.map((e) => e.to)).toEqual(['user_ada@example.com', 'user_bea@example.com']);
  });

  it('speaks for the app the sign-up came through, before any app has seen them', async () => {
    await account('user_ada', T0, true, 'livedocuments.app');
    await sendWelcomes(db, env, send, ['user_ada'], T0);
    expect(sent[0]!.html).toContain('https://www.livedocuments.app/new');
    expect(sent[0]!.text).toContain('Start in livedocuments');
  });

  it('sends a sign-up on liveworkspace.app to the apps, until they open one', async () => {
    await account('user_ada', T0, true, 'liveworkspace.app');
    await account('user_bea', T0, true, 'liveworkspace.app');
    await sendWelcomes(db, env, send, ['user_ada'], T0);
    expect(sent[0]!.html).toContain('href="https://liveworkspace.app/#apps"');
    expect(sent[0]!.text).toContain('Pick an app: https://liveworkspace.app/#apps');
    expect(sent[0]!.html).not.toContain('livediagram.app/new');
    // Later in the series, the first app they opened.
    await recordSighting(db, 'user_bea', 'liveplanner.app', T0 + 1);
    await run(T0 + 7 * DAY, ['week1']);
    const bea = sent.find((e) => e.to === 'user_bea@example.com')!;
    expect(bea.html).toContain('https://www.liveplanner.app/explorer');
    const ada = sent.find(
      (e) => e.to === 'user_ada@example.com' && e.subject !== 'Welcome to liveworkspace',
    )!;
    expect(ada.html).toContain('https://liveworkspace.app/#apps');
  });

  it('keeps the app signed up through over the first one opened', async () => {
    await account('user_ada', T0, true, 'livedesign.app');
    await recordSighting(db, 'user_ada', 'livediagram.app', T0);
    await run(T0 + 7 * DAY, ['week1']);
    expect(sent[0]!.html).toContain('https://www.livedesign.app/explorer');
  });

  it('waits for a verified address', async () => {
    await account('user_ada', T0, false);
    await run(T0, ['welcome']);
    expect(sent).toEqual([]);
  });

  it('takes its stamp back when the send fails, and gives up after three', async () => {
    await account('user_ada');
    failing = true;
    for (let i = 0; i < MAX_SEND_ATTEMPTS; i++) {
      expect((await run(T0 + i * DAY, ['welcome'])).welcome).toMatchObject({ failed: 1 });
      expect(stamp('user_ada', 'welcome_sent_at')).toBeNull();
    }
    failing = false;
    expect((await run(T0 + 5 * DAY, ['welcome'])).welcome).toMatchObject({ sent: 0, failed: 0 });
    expect(stamp('user_ada', 'send_attempts')).toBe(MAX_SEND_ATTEMPTS);
  });

  it('resets the failure count once a send gets through', async () => {
    await account('user_ada');
    failing = true;
    await run(T0, ['welcome']);
    failing = false;
    await run(T0 + DAY, ['welcome']);
    expect(stamp('user_ada', 'send_attempts')).toBe(0);
  });
});

describe('the series', () => {
  it('sends the activation nudge, then week 1 and week 2, each once', async () => {
    await account('user_ada');
    await run(T0);
    expect(sent.map((e) => e.subject)).toEqual(['Welcome to liveworkspace']);
    await run(T0 + ACTIVATION_DELAY_MS);
    expect(sent.at(-1)!.subject).toBe('Your first piece of work is waiting');
    await run(T0 + 7 * DAY);
    expect(sent.at(-1)!.subject).toBe('Find your way around the Explorer');
    await run(T0 + 14 * DAY);
    expect(sent.at(-1)!.subject).toBe('Bring your team into your work');
    await run(T0 + 15 * DAY);
    expect(sent).toHaveLength(4);
  });

  it('skips the nudge for someone who has made something, and wins back the quiet ones', async () => {
    await account('user_ada');
    await recordActivity(db, 'user_ada', T0 + DAY);
    await run(T0 + 14 * DAY);
    expect(sent.map((e) => e.subject)).not.toContain('Your first piece of work is waiting');
    await run(T0 + DAY + WINBACK_QUIET_MS - 1);
    expect(sent.map((e) => e.subject)).not.toContain('Your work is waiting');
    await run(T0 + DAY + WINBACK_QUIET_MS);
    expect(sent.at(-1)!.subject).toBe('Your work is waiting');
    await run(T0 + DAY + 2 * WINBACK_QUIET_MS);
    expect(sent.filter((e) => e.subject === 'Your work is waiting')).toHaveLength(1);
  });

  it('respects tips turned off in any app, stamping rather than sending', async () => {
    await account('user_ada');
    await writeSettings(db, 'user_ada', null, { all: { notifyTips: false } });
    await run(T0 + 14 * DAY);
    expect(sent.map((e) => e.subject)).toEqual(['Welcome to liveworkspace']);
    expect(stamp('user_ada', 'week2_sent_at')).toBe(T0 + 14 * DAY);
  });

  it('carries where to turn tips off, on liveworkspace.app, and links to the app they first used', async () => {
    await account('user_ada');
    await recordSighting(db, 'user_ada', 'livedesign.app', T0);
    await recordSighting(db, 'user_ada', 'livediagram.app', T0 + 1);
    await run(T0 + 7 * DAY);
    expect(sent.at(-1)!.unsubscribeUrl).toBe(
      'https://liveworkspace.app/explorer?settings=notifications',
    );
    expect(sent.at(-1)!.html).toContain('https://www.livedesign.app/explorer');
  });

  it('only moves activity forward', async () => {
    await account('user_ada');
    await recordActivity(db, 'user_ada', 500);
    await recordActivity(db, 'user_ada', 100);
    expect(stamp('user_ada', 'active_at')).toBe(500);
  });

  it('goes with the account', async () => {
    await account('user_ada');
    sql.prepare('DELETE FROM "user" WHERE id = ?').run('user_ada');
    expect(sql.prepare('SELECT count(*) AS n FROM email_lifecycle').get()).toEqual({ n: 0 });
  });

  it('takes a bounded batch a stage, oldest first, within budget', async () => {
    const total = SWEEP_LIMIT + 50;
    for (let i = 0; i < total; i++) await account(`user_${String(i).padStart(4, '0')}`, T0 + i);
    const started = performance.now();
    const result = await run(T0 + total, ['welcome']);
    const took = performance.now() - started;
    expect(result.welcome).toMatchObject({ sent: SWEEP_LIMIT });
    expect(sent[0]!.to).toBe('user_0000@example.com');
    expect((await run(T0 + total, ['welcome'])).welcome).toMatchObject({ sent: 50 });
    expect(took).toBeLessThan(1000);
  });
});

describe('telemetry', () => {
  const posted: { app: string; events: { type: string }[] }[] = [];
  const telemetry = {
    TELEMETRY_URL: 'https://liveworkspace.app/api/telemetry',
    TELEMETRY_KEY_LIVEDIAGRAM: 'ld',
    TELEMETRY_KEY_LIVEDESIGN: 'lds',
    TELEMETRY: {
      fetch: async (request: Request) => {
        posted.push((await request.json()) as (typeof posted)[number]);
        return new Response(null, { status: 204 });
      },
    } as unknown as Fetcher,
  };
  beforeEach(() => {
    posted.length = 0;
  });

  it('counts each email sent under the app it speaks for, once the run ends', async () => {
    await account('user_ada', T0, true, 'livediagram.app');
    await account('user_bo', T0, true, 'liveworkspace.app');
    await recordSighting(db, 'user_bo', 'livedesign.app', T0);
    // Signed up on liveworkspace.app and opened no app: speaks for liveworkspace, counted nowhere.
    await account('user_cy', T0, true, 'liveworkspace.app');
    await runLifecycle(db, { ...env, ...telemetry }, send, ['welcome', 'week1'], T0 + 7 * DAY);
    expect(sent).toHaveLength(6);
    const types = (app: string) =>
      posted
        .filter((b) => b.app === app)
        .flatMap((b) => b.events.map((e) => e.type))
        .sort();
    expect(types('livediagram.app')).toEqual(['Week1', 'Welcome']);
    expect(types('livedesign.app')).toEqual(['Week1', 'Welcome']);
    expect(posted).toHaveLength(2);
  });

  it('counts nothing that wasn’t sent, and never holds up a send', async () => {
    await account('user_ada', T0, true, 'livediagram.app');
    await writeSettings(db, 'user_ada', null, { all: { notifyTips: false } });
    const down = {
      ...telemetry,
      TELEMETRY: {
        fetch: async () => {
          throw new Error('telemetry is down');
        },
      } as unknown as Fetcher,
    };
    await runLifecycle(db, { ...env, ...down }, send, undefined, T0 + 7 * DAY);
    expect(sent.map((e) => e.subject)).toEqual(['Welcome to liveworkspace']);
    await sendWelcomes(db, { ...env, ...telemetry }, send, ['user_ada'], T0 + 8 * DAY);
    expect(posted).toEqual([]);
  });
});

describe('the emails', () => {
  it('link to each app in its environment', () => {
    expect(appUrl({ ENVIRONMENT: 'development' }, 'liveplanner.app')).toBe('http://localhost:3200');
    expect(appUrl({ ENVIRONMENT: 'staging' }, 'livedesign.app')).toBe(
      'https://staging.livedesign.app',
    );
    const email = lifecycleEmail(env, 'week2', { home: null });
    expect(email.html).toContain('https://liveworkspace.app/explorer');
    expect(email.text).toContain('Manage your notifications');
    expect(email.unsubscribeUrl).toBe('https://liveworkspace.app/explorer?settings=notifications');
    expect(email.html).toContain(
      'href="https://liveworkspace.app/explorer?settings=notifications" style="color:#334155;text-decoration:underline">Manage your notifications',
    );
    // A deployment's own origin.
    expect(
      lifecycleEmail(
        {
          ...env,
          BASE_URL: 'https://staging.liveworkspace.app/',
        },
        'winback',
        {
          home: null,
        },
      ).unsubscribeUrl,
    ).toBe('https://staging.liveworkspace.app/explorer?settings=notifications');
    for (const name of ['livediagram', 'liveplanner', 'livedocuments', 'livedesign']) {
      expect(lifecycleEmail(env, 'welcome', { home: null }).text).toContain(name);
    }
  });
});

describe('the send window', () => {
  const HOUR = 60 * 60 * 1000;
  // Monday 2026-11-02 00:17 UTC, the hourly run's minute; London is on GMT, New York on EST (UTC-5) and Tokyo
  // on JST (UTC+9).
  const MONDAY = Date.UTC(2026, 10, 2, 0, 17);
  const windowed = { ...env, EMAIL_SEND_WINDOW: undefined };
  const zone = (id: string, timeZone: string | null) =>
    sql.prepare('UPDATE "user" SET timeZone = ? WHERE id = ?').run(timeZone, id);
  const ZONES: Record<string, string | null> = {
    user_lon: 'Europe/London',
    user_nyc: 'America/New_York',
    user_tyo: 'Asia/Tokyo',
    user_none: null,
  };
  // Four accounts owed week 1 since before the weekend: in London, New York and Tokyo, and one with no zone known.
  async function owedWeek1() {
    for (const [id, timeZone] of Object.entries(ZONES)) {
      await account(id, MONDAY - 8 * DAY);
      zone(id, timeZone);
    }
  }
  const toWhom = () => sent.map((e) => e.to.replace('@example.com', '')).sort();

  it('sends only to the accounts whose local time is inside it', async () => {
    await owedWeek1();
    // 00:17 UTC: 09:17 in Tokyo, 19:17 on Sunday in New York, 00:17 in London.
    await runLifecycle(db, windowed, send, ['week1'], MONDAY);
    expect(toWhom()).toEqual(['user_tyo']);
    // 14:17 UTC: 09:17 in New York, 14:17 in London (and for no zone known), 23:17 in Tokyo.
    await runLifecycle(db, windowed, send, ['week1'], MONDAY + 14 * HOUR);
    expect(toWhom()).toEqual(['user_lon', 'user_none', 'user_nyc', 'user_tyo']);
  });

  it('times an account with no zone known by London', async () => {
    await owedWeek1();
    await runLifecycle(db, windowed, send, ['week1'], MONDAY + 8 * HOUR); // 08:17 in London
    expect(toWhom()).toEqual(['user_tyo']);
    await runLifecycle(db, windowed, send, ['week1'], MONDAY + 9 * HOUR); // 09:17 in London
    expect(toWhom()).toEqual(['user_lon', 'user_none', 'user_tyo']);
  });

  it('times an account by London when its stored zone is one the runtime no longer knows', async () => {
    await account('user_old', MONDAY - 8 * DAY);
    zone('user_old', 'Old/Zone');
    await runLifecycle(db, windowed, send, ['week1'], MONDAY + 8 * HOUR); // 08:17 in London
    expect(sent).toEqual([]);
    await runLifecycle(db, windowed, send, ['week1'], MONDAY + 9 * HOUR); // 09:17 in London
    expect(toWhom()).toEqual(['user_old']);
  });

  it('sends each email once across hourly runs, each inside its window', async () => {
    await owedWeek1();
    const sentAt: Record<string, number[]> = {};
    for (let at = MONDAY - 2 * DAY; at < MONDAY + 9 * DAY; at += HOUR) {
      const before = sent.length;
      await runLifecycle(db, windowed, send, undefined, at);
      for (const email of sent.slice(before)) {
        if (email.subject !== 'Welcome to liveworkspace') (sentAt[email.to] ??= []).push(at);
      }
    }
    for (const [id, timeZone] of Object.entries(ZONES)) {
      // The activation nudge and week 1 (both owed by the first run inside), then week 2, one each, each on a
      // weekday 09:00 to 21:00 in the account's zone (London's for none).
      const times = sentAt[`${id}@example.com`] ?? [];
      expect(times, id).toHaveLength(3);
      for (const at of times) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: timeZone ?? 'Europe/London',
          weekday: 'short',
          hour: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(at);
        const hour = Number(parts.find((p) => p.type === 'hour')!.value);
        const day = parts.find((p) => p.type === 'weekday')!.value;
        expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], `${id} on ${day}`).toContain(day);
        expect(hour, id).toBeGreaterThanOrEqual(9);
        expect(hour, id).toBeLessThan(21);
      }
    }
    const subjects = sent.map((e) => `${e.to} ${e.subject}`);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it('holds the weekend over to Monday morning, local time', async () => {
    const saturday = Date.UTC(2026, 10, 7, 0, 17);
    await account('user_ada', saturday - 7 * DAY);
    for (let at = saturday; at < saturday + 2 * DAY; at += HOUR) {
      await runLifecycle(db, windowed, send, ['week1'], at);
    }
    expect(sent).toEqual([]);
    await runLifecycle(db, windowed, send, ['week1'], saturday + 2 * DAY + 9 * HOUR);
    expect(sent.map((e) => e.subject)).toEqual(['Find your way around the Explorer']);
  });

  it('never holds the welcome', async () => {
    await account('user_ada', MONDAY);
    zone('user_ada', 'Asia/Tokyo');
    // Saturday 18:00 UTC is Sunday 03:00 in Tokyo: outside, but the welcome goes.
    const sunday = Date.UTC(2026, 10, 7, 18, 0);
    expect(await sendWelcomes(db, windowed, send, ['user_ada'], sunday)).toMatchObject({ sent: 1 });
    await account('user_bea', MONDAY);
    expect((await runLifecycle(db, windowed, send, ['welcome'], sunday)).welcome).toMatchObject({
      sent: 1,
    });
  });

  it('runs no due query while every zone is in its weekend', async () => {
    await owedWeek1();
    const prepare = vi.spyOn(db, 'prepare');
    const result = await runLifecycle(
      db,
      windowed,
      send,
      ['activation', 'week1', 'week2', 'winback'],
      Date.UTC(2026, 10, 7, 12, 17),
    );
    expect(prepare).not.toHaveBeenCalled();
    expect(result.week1).toEqual({ sent: 0, skipped: 0, failed: 0, taken: 0 });
  });
});
