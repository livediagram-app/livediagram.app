// The onboarding series (liveworkspace/docs/accounts.md "Onboarding emails"): one per account, not one
// per app, so a person who uses all four apps hears it once. A row is made with the account; the welcome
// goes as soon as the sign-up's response has gone, and the cron sends the rest when each is due:
//
//   welcome      at once (caught up every 15 minutes if that send failed)
//   activation   ~3 days in, to someone who hasn't made anything in any app yet (tips)
//   week1        ~7 days in: the Explorer (tips)
//   week2        ~14 days in: teams (tips)
//   winback      once, ~4 weeks after their last save in any app (tips)
//
// "tips" stages respect the notifyTips setting in the `all` scope: turned off, the stage is stamped and
// nothing is sent. Each stage is claimed (stamped) before it is sent, so two runs can't both send it;
// a failed send takes the stamp back and counts against the row, which leaves every due list at three.
import type { SiteId } from '@liveworkspace/sites';
import { lifecycleEmail, type LifecycleEmail, type LifecycleStage } from './lifecycle-email.ts';
import type { Env } from './env.ts';
import { isSettingsApp, type SettingsApp } from './settings.ts';
import { flushServerEvents, reportServerEvent, type TelemetryEnv } from './telemetry.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const ACTIVATION_DELAY_MS = 3 * DAY_MS;
export const WINBACK_QUIET_MS = 4 * WEEK_MS;
// Accounts per stage per run, the longest-waiting first.
export const SWEEP_LIMIT = 100;
// Failed sends after which an account leaves every due list: three daily runs ride out an outage, and
// an address that has failed three days running is dead. A success resets the count.
export const MAX_SEND_ATTEMPTS = 3;

export type { LifecycleStage } from './lifecycle-email.ts';

type Stage = {
  column: string;
  // Which rows are owed the stage, given the cutoff (one `?`).
  where: string;
  order: string;
  tips: boolean;
  cutoff: (now: number) => number;
};

// The columns and conditions below are fixed literals, never anything a caller supplies. Each `where`
// matches its partial index in migrations/0008_email_lifecycle.sql.
const STAGES: Record<LifecycleStage, Stage> = {
  welcome: {
    column: 'welcome_sent_at',
    where: 'l.welcome_sent_at IS NULL AND l.created_at <= ?',
    order: 'l.created_at',
    tips: false,
    cutoff: (now) => now,
  },
  activation: {
    column: 'activation_sent_at',
    where:
      'l.activation_sent_at IS NULL AND l.week1_sent_at IS NULL AND l.active_at IS NULL AND l.created_at <= ?',
    order: 'l.created_at',
    tips: true,
    cutoff: (now) => now - ACTIVATION_DELAY_MS,
  },
  week1: {
    column: 'week1_sent_at',
    where: 'l.week1_sent_at IS NULL AND l.created_at <= ?',
    order: 'l.created_at',
    tips: true,
    cutoff: (now) => now - WEEK_MS,
  },
  week2: {
    column: 'week2_sent_at',
    where: 'l.week2_sent_at IS NULL AND l.created_at <= ?',
    order: 'l.created_at',
    tips: true,
    cutoff: (now) => now - 2 * WEEK_MS,
  },
  winback: {
    column: 'winback_sent_at',
    // A null active_at (never made anything) is not <= anything: the activation nudge is theirs.
    where: 'l.winback_sent_at IS NULL AND l.active_at <= ?',
    order: 'l.active_at',
    tips: true,
    cutoff: (now) => now - WINBACK_QUIET_MS,
  },
};

// The order a run goes in: the activation nudge before week 1, so an empty account hears it first
// (its list leaves out anyone already sent week 1).
export const STAGE_ORDER: LifecycleStage[] = ['welcome', 'activation', 'week1', 'week2', 'winback'];

type Due = {
  user_id: string;
  email: string;
  attempts: number;
  // notifyTips in the `all` scope: 0 when turned off, else 1 or null.
  tips: number | null;
  // The app the email speaks for: the one they signed up through, else the first they used; null for
  // neither (a sign-up on liveworkspace.app that hasn't opened an app yet).
  app: string | null;
};

// One query a stage: the owed rows by their partial index, each joined by primary key to the account
// (a verified address), its `all` settings and, when it didn't sign up through an app, its first app.
function dueStatement(
  db: D1Database,
  stage: LifecycleStage,
  now: number,
  limit: number,
  ids?: string[],
): D1PreparedStatement {
  const spec = STAGES[stage];
  const only = ids ? 'AND l.user_id IN (SELECT value FROM json_each(?))' : '';
  return db
    .prepare(
      `SELECT l.user_id, u.email, l.send_attempts AS attempts,
              json_extract(s.prefs, '$.notifyTips') AS tips,
              COALESCE(NULLIF(l.signup_app, 'liveworkspace.app'),
                (SELECT a.app FROM account_app a WHERE a.user_id = l.user_id
                 ORDER BY a.first_seen_at LIMIT 1)) AS app
       FROM email_lifecycle l
       JOIN "user" u ON u.id = l.user_id
       LEFT JOIN settings s ON s.owner_id = l.user_id AND s.scope = 'all'
       WHERE ${spec.where} AND l.send_attempts < ? AND u.emailVerified = 1 ${only}
       ORDER BY ${spec.order} LIMIT ?`,
    )
    .bind(spec.cutoff(now), MAX_SEND_ATTEMPTS, ...(ids ? [JSON.stringify(ids)] : []), limit);
}

export type SendEmail = (email: LifecycleEmail & { to: string }) => Promise<void>;
export type Outcome = 'sent' | 'skipped' | 'failed' | 'taken';
export type StageCounts = Record<Outcome, number>;

// What a run needs of the Env: the emails' links, and where to report what went.
export type LifecycleEnv = Pick<Env, 'ENVIRONMENT' | 'BASE_URL'> & Partial<TelemetryEnv>;

type Ctx = { db: D1Database; env: LifecycleEnv; send: SendEmail };

// Each stage's kind on `Email·Sent`, as the apps' own series named them, so each app's dashboard
// keeps counting it in the same chart.
const EMAIL_SENT_TYPE: Record<LifecycleStage, string> = {
  welcome: 'Welcome',
  activation: 'Activation',
  week1: 'Week1',
  week2: 'Week2',
  winback: 'WinBack',
};

async function deliver(ctx: Ctx, stage: LifecycleStage, row: Due, now: number): Promise<Outcome> {
  const { db, env } = ctx;
  const { column, tips } = STAGES[stage];
  // Claimed before sending: a second run, or the inline welcome racing the cron, finds it taken.
  const claim = await db
    .prepare(`UPDATE email_lifecycle SET ${column} = ? WHERE user_id = ? AND ${column} IS NULL`)
    .bind(now, row.user_id)
    .run();
  if (claim.meta.changes !== 1) return 'taken';
  // Turned off: the stamp stays, so they aren't asked about again, and nothing is sent.
  if (tips && row.tips === 0) return 'skipped';
  const home = isSettingsApp(row.app) ? row.app : null;
  try {
    await ctx.send({ to: row.email, ...lifecycleEmail(env, stage, { home }) });
  } catch (error) {
    const failed = await db
      .prepare(
        `UPDATE email_lifecycle SET ${column} = NULL, send_attempts = send_attempts + 1,
           last_attempt_at = ? WHERE user_id = ? RETURNING send_attempts`,
      )
      .bind(now, row.user_id)
      .first<number>('send_attempts');
    if (failed === MAX_SEND_ATTEMPTS) {
      console.warn(`[lifecycle] giving up on an account after ${failed} failed sends`, error);
    } else {
      console.error(`[lifecycle] ${stage} send failed`, error);
    }
    return 'failed';
  }
  // Counted under the app the email speaks for (its links' app), sent when the run ends. One that speaks
  // for liveworkspace itself isn't counted: the dashboards chart the four apps, and counting it under
  // one of them would claim a sign-up that app never had.
  if (home) reportServerEvent(env, 'Email', 'Sent', EMAIL_SENT_TYPE[stage], home);
  if (row.attempts > 0) {
    await db
      .prepare('UPDATE email_lifecycle SET send_attempts = 0 WHERE user_id = ?')
      .bind(row.user_id)
      .run();
  }
  return 'sent';
}

async function runStage(
  ctx: Ctx,
  stage: LifecycleStage,
  now: number,
  ids?: string[],
): Promise<StageCounts> {
  const counts: StageCounts = { sent: 0, skipped: 0, failed: 0, taken: 0 };
  const limit = ids ? ids.length : SWEEP_LIMIT;
  const { results } = await dueStatement(ctx.db, stage, now, limit, ids).all<Due>();
  // One at a time: Resend limits how fast one account may send.
  for (const row of results) counts[await deliver(ctx, stage, row, now)] += 1;
  return counts;
}

// A run of the cron: each stage in turn, up to SWEEP_LIMIT accounts each. The 15-minute cron passes
// just the welcome, catching up a sign-up whose welcome failed.
export async function runLifecycle(
  db: D1Database,
  env: LifecycleEnv,
  send: SendEmail,
  stages: LifecycleStage[] = STAGE_ORDER,
  now = Date.now(),
): Promise<Partial<Record<LifecycleStage, StageCounts>>> {
  const result: Partial<Record<LifecycleStage, StageCounts>> = {};
  try {
    for (const stage of stages) result[stage] = await runStage({ db, env, send }, stage, now);
  } finally {
    // What went is reported once the sending is done, one batch per app.
    await flushServerEvents(env);
  }
  return result;
}

// The welcome for accounts just made, sent after the sign-up's response (index.ts).
export async function sendWelcomes(
  db: D1Database,
  env: LifecycleEnv,
  send: SendEmail,
  ids: string[],
  now = Date.now(),
): Promise<StageCounts> {
  try {
    return await runStage({ db, env, send }, 'welcome', now, [...new Set(ids)]);
  } finally {
    await flushServerEvents(env);
  }
}

// A new account starts its series, with the app it signed up through (liveworkspace.app for the site
// itself; null when not known). Not for the client registrar, whose `.invalid` address can never
// receive mail. True when the row is new.
export async function startLifecycle(
  db: D1Database,
  user: { id: string; email: string },
  now = Date.now(),
  signupApp: SiteId | null = null,
): Promise<boolean> {
  if (user.email.endsWith('.invalid')) return false;
  const result = await db
    .prepare(
      'INSERT OR IGNORE INTO email_lifecycle (user_id, created_at, signup_app) VALUES (?, ?, ?)',
    )
    .bind(user.id, now, signupApp)
    .run();
  return result.meta.changes === 1;
}

// The app an account signed up through, for the team emails it sends: null for liveworkspace.app, an
// account made before this was recorded, or one with no series (the client registrar, Clerk imports).
export async function signupAppOf(db: D1Database, userId: string): Promise<SettingsApp | null> {
  const app = await db
    .prepare('SELECT signup_app FROM email_lifecycle WHERE user_id = ?')
    .bind(userId)
    .first<string | null>('signup_app');
  return isSettingsApp(app) ? app : null;
}

// Accounts made in this isolate whose welcome hasn't gone yet: the Better Auth hook adds to it while
// the sign-up runs, and index.ts sends what is here once the response has gone (ctx.waitUntil).
// Taking empties it, so each welcome is handed out once; the claim stops a double send anyway.
const waitingWelcomes: string[] = [];
const MAX_WAITING = 1000;

export function queueWelcome(userId: string): void {
  if (waitingWelcomes.length < MAX_WAITING) waitingWelcomes.push(userId);
}

export function takeWelcomes(): string[] {
  return waitingWelcomes.splice(0);
}

// An app saying the person saved something at `at` (their newest save on anything they own). Only
// ever moves forward, and writes nothing when it wouldn't: one statement. A guest has no series.
export async function recordActivity(db: D1Database, userId: string, at: number): Promise<void> {
  await db
    .prepare(
      `UPDATE email_lifecycle SET active_at = ?2
       WHERE user_id = ?1 AND (active_at IS NULL OR active_at < ?2)`,
    )
    .bind(userId, at)
    .run();
}
