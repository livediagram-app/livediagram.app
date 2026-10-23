// The expiring-token warning (liveworkspace/docs/accounts.md "API tokens"): once a day, the owner of
// each live token that expires within a week hears about it once, so a script or connected AI tool
// doesn't stop without warning. An account message: it can't be turned off.
//
// Bounded: one query picks at most TOKEN_EXPIRY_SWEEP_LIMIT tokens, the soonest to expire first, by
// the partial index in migrations/0002_teams_and_tokens.sql; one sends at a time (Resend limits how
// fast one account may send); one batched update stamps those that went. A failed send isn't
// stamped, so the next day's run tries again while the token is still in its week.
import { tokenExpiringEmail } from './email.ts';
import type { Env } from './env.ts';
import { isSettingsApp } from './settings.ts';
import { reportServerEvent, type TelemetryEnv } from './telemetry.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
// How long before a token expires its owner is warned.
export const TOKEN_EXPIRY_WARNING_MS = 7 * DAY_MS;
// Tokens warned per run, at most.
export const TOKEN_EXPIRY_SWEEP_LIMIT = 100;

export type TokenExpiryEmail = { to: string; subject: string; text: string; html: string };

type Due = { id: string; name: string; expiresAt: number; email: string; app: string | null };

export async function sweepExpiringTokens(
  db: D1Database,
  env: Pick<Env, 'BASE_URL'> & Partial<TelemetryEnv>,
  send: (email: TokenExpiryEmail) => Promise<void>,
  now = Date.now(),
): Promise<{ sent: number; failed: number }> {
  // Each token joined by primary key to its owner (a verified address) and the app they signed up
  // through, which the email is counted under.
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name, t.expiresAt, u.email, l.signup_app AS app
       FROM api_token t
       JOIN "user" u ON u.id = t.userId
       LEFT JOIN email_lifecycle l ON l.user_id = t.userId
       WHERE t.revokedAt IS NULL AND t.expiryWarnedAt IS NULL
         AND t.expiresAt > ? AND t.expiresAt <= ? AND u.emailVerified = 1
       ORDER BY t.expiresAt LIMIT ?`,
    )
    .bind(now, now + TOKEN_EXPIRY_WARNING_MS, TOKEN_EXPIRY_SWEEP_LIMIT)
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
