// What one app keeps about an account (liveworkspace/docs/accounts.md "Sign-ups and milestones per
// app"): when it first saw the account, which is how it counts a sign-up, and its one-time milestone
// emails. The app is the calling client's own (oauth_client_app), never one the request names.
import type { SettingsApp } from './settings.ts';

// The most ids one email lookup may name.
export const MAX_EMAIL_IDS = 100;

export type Milestone = 'milestone' | 'firstShare';
// A fixed map from name to column: the column in the SQL below is only ever one of these.
const MILESTONE_COLUMN: Record<Milestone, string> = {
  milestone: 'milestone_sent_at',
  firstShare: 'first_share_sent_at',
};

export function isMilestone(value: unknown): value is Milestone {
  return value === 'milestone' || value === 'firstShare';
}

// Records that this app has seen the account, and answers whether this was the first time: one
// statement, the insert's RETURNING row saying it was new. An unknown account is never "first".
export async function recordSighting(
  db: D1Database,
  userId: string,
  app: SettingsApp,
  now = Date.now(),
): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO account_app (user_id, app, first_seen_at)
       SELECT ?1, ?2, ?3 WHERE EXISTS (SELECT 1 FROM "user" WHERE id = ?1)
       ON CONFLICT (user_id, app) DO NOTHING
       RETURNING first_seen_at`,
    )
    .bind(userId, app, now)
    .first<{ first_seen_at: number }>();
  return row !== null;
}

// Claims a one-time milestone email for this app: true only for the first claim, so a burst of saves
// at the milestone sends one email. False when already claimed, or the app has never seen the account.
export async function claimMilestone(
  db: D1Database,
  userId: string,
  app: SettingsApp,
  milestone: Milestone,
  now = Date.now(),
): Promise<boolean> {
  const column = MILESTONE_COLUMN[milestone];
  const result = await db
    .prepare(
      `UPDATE account_app SET ${column} = ? WHERE user_id = ? AND app = ? AND ${column} IS NULL`,
    )
    .bind(now, userId, app)
    .run();
  return result.meta.changes === 1;
}

// The verified addresses of these accounts, for an app's notification emails (someone commented on
// what they own, a form response). One query; an account without a verified address is left out.
export async function verifiedEmails(
  db: D1Database,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { results } = await db
    .prepare(
      `SELECT id, email FROM "user"
       WHERE id IN (SELECT value FROM json_each(?)) AND emailVerified = 1`,
    )
    .bind(JSON.stringify([...new Set(ids)]))
    .all<{ id: string; email: string }>();
  return Object.fromEntries(results.map((row) => [row.id, row.email]));
}
