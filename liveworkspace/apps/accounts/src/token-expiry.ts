// The expiring-token warning (liveworkspace/docs/specs/003-accounts/accounts.md "API tokens"): the owner of each live
// token that expires within a week hears about it once, so a script or connected AI tool doesn't stop without
// warning. An account message: it can't be turned off. It waits for the owner's send window (send-window.ts),
// which costs at most a weekend of the week's notice; the hourly cron sends it in the first run inside it.
//
// Bounded: one query picks at most TOKEN_EXPIRY_SWEEP_LIMIT tokens, the soonest to expire first, by
// the partial index in migrations/0002_teams_and_tokens.sql; one sends at a time (Email Service limits how
// fast one account may send); one batched update stamps those that went. A failed send isn't
// stamped, so the next run inside the window tries again while the token is still in its week.
import { tokenExpiringEmail } from './email.ts';
import type { Env } from './env.ts';
import { sendWindowOf, windowFilter, type SendWindowEnv } from './send-window.ts';
import { isSettingsApp } from './settings.ts';
import { timelineStatement } from './index-timeline.ts';
import { reportServerEvent, type TelemetryEnv } from './telemetry.ts';
import { tokenEvent } from './tokens.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
// How long before a token expires its owner is warned.
export const TOKEN_EXPIRY_WARNING_MS = 7 * DAY_MS;
// Tokens warned per run, at most.
export const TOKEN_EXPIRY_SWEEP_LIMIT = 100;

export type TokenExpiryEmail = { to: string; subject: string; text: string; html: string };

type Due = { id: string; name: string; expiresAt: number; email: string; app: string | null };

export async function sweepExpiringTokens(
  db: D1Database,
  env: Pick<Env, 'BASE_URL'> & Partial<TelemetryEnv> & SendWindowEnv,
  send: (email: TokenExpiryEmail) => Promise<void>,
  now = Date.now(),
): Promise<{ sent: number; failed: number }> {
  const inWindow = windowFilter('u.timeZone', sendWindowOf(env), now);
  if (inWindow === 'closed') return { sent: 0, failed: 0 };
  // Each token joined by primary key to its owner (a verified address inside the send window) and the app they
  // signed up through, which the email is counted under.
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name, t.expiresAt, u.email, l.signup_app AS app
       FROM api_token t
       JOIN "user" u ON u.id = t.userId
       LEFT JOIN email_lifecycle l ON l.user_id = t.userId
       WHERE t.revokedAt IS NULL AND t.expiryWarnedAt IS NULL
         AND t.expiresAt > ? AND t.expiresAt <= ? AND u.emailVerified = 1
         ${inWindow ? `AND ${inWindow.sql}` : ''}
       ORDER BY t.expiresAt LIMIT ?`,
    )
    .bind(
      now,
      now + TOKEN_EXPIRY_WARNING_MS,
      ...(inWindow ? [inWindow.bind] : []),
      TOKEN_EXPIRY_SWEEP_LIMIT,
    )
    .all<Due>();
  const warned: string[] = [];
  let failed = 0;
  for (const row of results) {
    try {
      await send({ to: row.email, ...tokenExpiringEmail(env.BASE_URL, row.name, row.expiresAt) });
    } catch (error) {
      failed += 1;
      console.error('[tokens] expiry warning failed', error);
      continue;
    }
    warned.push(row.id);
    // Counted under the owner's sign-up app; one who signed up on liveworkspace.app isn't counted.
    if (isSettingsApp(row.app)) reportServerEvent(env, 'Email', 'Sent', 'TokenExpiring', row.app);
  }
  if (warned.length > 0) {
    await db
      .prepare(
        'UPDATE api_token SET expiryWarnedAt = ? WHERE id IN (SELECT value FROM json_each(?))',
      )
      .bind(now, JSON.stringify(warned))
      .run();
  }
  return { sent: warned.length, failed };
}

// Tokens put on the Timeline per run, at most.
export const TOKEN_EXPIRY_NOTE_LIMIT = 500;

/**
 * Puts each live token that expires within a week on its owner's Timeline, once, dated at its expiry (so it
 * shows under Upcoming), whether or not their address is verified. One read on the partial index
 * api_token_expiry_note_idx, then one batch: the events (index-timeline.ts) and the stamps together.
 */
export async function noteExpiringTokens(db: D1Database, now = Date.now()): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT id, userId, name, expiresAt FROM api_token
       WHERE revokedAt IS NULL AND expiryNotedAt IS NULL AND expiresAt > ? AND expiresAt <= ?
       ORDER BY expiresAt LIMIT ?`,
    )
    .bind(now, now + TOKEN_EXPIRY_WARNING_MS, TOKEN_EXPIRY_NOTE_LIMIT)
    .all<{ id: string; userId: string; name: string; expiresAt: number }>();
  if (results.length === 0) return 0;
  await db.batch([
    ...results.map((token) =>
      timelineStatement(
        db,
        tokenEvent('token_expiring', token, token.userId, null, token.expiresAt),
      ),
    ),
    db
      .prepare(
        'UPDATE api_token SET expiryNotedAt = ? WHERE id IN (SELECT value FROM json_each(?))',
      )
      .bind(now, JSON.stringify(results.map((token) => token.id))),
  ]);
  return results.length;
}
