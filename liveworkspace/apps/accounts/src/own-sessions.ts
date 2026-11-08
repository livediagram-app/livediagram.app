// Where You're Signed In, over an app's bearer (liveworkspace/docs/specs/003-accounts/accounts.md "Every account
// setting in every app"): the account's liveworkspace sessions, and ending them. liveworkspace.app's Settings uses
// Better Auth's own endpoints with its cookie; an app's Settings has only its access token, so it asks here. A
// session's token is the credential itself, so it is never read, let alone answered: sessions go by their id.
import { endSessionTokens } from './end-session.ts';

export interface OwnSession {
  id: string;
  // The session the asking access token was minted under (its `sid`).
  current: boolean;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  userAgent: string | null;
  createdAt: string | number;
  updatedAt: string | number;
  expiresAt: string | number;
};

// Better Auth keeps its dates as ISO text in D1; a number is read as milliseconds all the same.
const timeOf = (value: string | number): number =>
  typeof value === 'number' ? value : Date.parse(value);
const isoOf = (value: string | number): string => {
  const time = timeOf(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : String(value);
};

/** The account's live sessions, the most recently active first. One query on `session_userId_idx`. */
export async function listOwnSessions(
  db: D1Database,
  userId: string,
  currentId: string | null,
  now = Date.now(),
): Promise<OwnSession[]> {
  const { results } = await db
    .prepare('SELECT id, userAgent, createdAt, updatedAt, expiresAt FROM session WHERE userId = ?')
    .bind(userId)
    .all<Row>();
  return results
    .filter((row) => timeOf(row.expiresAt) > now)
    .sort((a, b) => timeOf(b.updatedAt) - timeOf(a.updatedAt))
    .map((row) => ({
      id: row.id,
      current: row.id === currentId,
      userAgent: row.userAgent || null,
      createdAt: isoOf(row.createdAt),
      updatedAt: isoOf(row.updatedAt),
    }));
}

/** Ends one of the account's own sessions, with every app's tokens on it, as Sign out does. False for an id that
 *  isn't the account's. */
export async function endOwnSession(db: D1Database, userId: string, id: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM session WHERE id = ? AND userId = ?')
    .bind(id, userId)
    .first<{ id: string }>();
  if (!row) return false;
  await endSessionTokens(db, row.id);
  return true;
}

/** Ends every session of the account but `keep`, with their apps' tokens; answers how many. */
export async function endOtherSessions(
  db: D1Database,
  userId: string,
  keep: string,
): Promise<number> {
  const { results } = await db
    .prepare('SELECT id FROM session WHERE userId = ? AND id != ?')
    .bind(userId, keep)
    .all<{ id: string }>();
  const ids = results.map((row) => row.id);
  await endSessionTokens(db, ids);
  return ids.length;
}
