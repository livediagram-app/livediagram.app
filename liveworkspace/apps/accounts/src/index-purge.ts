// Closing an account empties the index too (liveworkspace/docs/specs/003-accounts/accounts.md "Closing an account"). The
// request is written to pending_purges before the user row goes, then sent to the index
// (`POST ${INDEX_URL}/internal/purge-person`, the same key as the guest merge); the row is cleared only
// once the index has taken it. A request the index couldn't take, or a Worker that died between the two,
// leaves the row for the cron, which sends it again until it lands. Sending twice is harmless: the
// index's purge is idempotent.
import type { Env } from './env.ts';

export interface IndexPurgeConfig {
  indexUrl?: string;
  // The index Worker's service binding; plain fetch to indexUrl without one (tests, other hosts).
  indexService?: Fetcher;
  indexKey?: string;
}

export const indexPurgeConfig = (env: Env): IndexPurgeConfig => ({
  indexUrl: env.INDEX_URL,
  indexService: env.INDEX,
  indexKey: env.INDEX_MERGE_KEY,
});

// The index works on a purge for up to five seconds before answering (the rest it finishes itself).
const PURGE_TIMEOUT_MS = 15_000;
// The accounts Worker's frequent cron (wrangler.toml), which sends waiting requests again.
export const PURGE_RETRY_CRON = '*/15 * * * *';
// Requests the cron sends per run, oldest try first.
export const PURGES_PER_RUN = 25;
// From this many failed tries on, each failure is logged as an error, not a warning.
const LOUD_AFTER = 3;

export type PurgeResult = { ok: true } | { ok: false; error: string };

// The request, written while the account still exists (with the teams that closed, in the batch closing them). A
// request already there (an earlier try at closing the account that stopped part way) keeps its teams and gains
// these: a retry finds the teams it ran alone already gone, and must still name them.
export function pendingPurgeStatement(
  db: D1Database,
  userId: string,
  teamIds: string[],
  now = Date.now(),
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO pending_purges (userId, teamIds, createdAt) VALUES (?, ?, ?)
       ON CONFLICT (userId) DO UPDATE SET teamIds = (
         SELECT json_group_array(value) FROM (
           SELECT value FROM json_each(pending_purges.teamIds) UNION SELECT value FROM json_each(excluded.teamIds)))`,
    )
    .bind(userId, JSON.stringify(teamIds), now);
}

export async function recordPendingPurge(
  db: D1Database,
  userId: string,
  teamIds: string[],
  now = Date.now(),
): Promise<void> {
  await pendingPurgeStatement(db, userId, teamIds, now).run();
}

export async function sendPurge(
  config: IndexPurgeConfig,
  userId: string,
  teamIds: string[],
): Promise<PurgeResult> {
  if (!config.indexUrl || !config.indexKey) return { ok: false, error: 'index_not_configured' };
  const send = config.indexService ? config.indexService.fetch.bind(config.indexService) : fetch;
  try {
    const response = await send(`${config.indexUrl}/internal/purge-person`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.indexKey}` },
      body: JSON.stringify({ personId: userId, teamIds }),
      signal: AbortSignal.timeout(PURGE_TIMEOUT_MS),
    });
    await response.body?.cancel();
    return response.ok ? { ok: true } : { ok: false, error: `status_${response.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.name : 'fetch_failed' };
  }
}

const ACCOUNT_GONE = `NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = p.userId)`;

type PendingRow = { userId: string; teamIds: string; attempts: number };

function teamIdsOf(text: string): string[] {
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

// Sends one recorded request, and clears it or notes the failure.
async function attempt(
  db: D1Database,
  config: IndexPurgeConfig,
  row: PendingRow,
  now: number,
): Promise<boolean> {
  const result = await sendPurge(config, row.userId, teamIdsOf(row.teamIds));
  if (result.ok) {
    await db.prepare('DELETE FROM pending_purges WHERE userId = ?').bind(row.userId).run();
    return true;
  }
  await db
    .prepare(
      `UPDATE pending_purges SET attempts = attempts + 1, lastAttemptAt = ?, lastError = ?
       WHERE userId = ?`,
    )
    .bind(now, result.error, row.userId)
    .run();
  const attempts = row.attempts + 1;
  const log = attempts >= LOUD_AFTER ? console.error : console.warn;
  log('[accounts] index purge not taken; the cron will send it again', {
    attempts,
    error: result.error,
  });
  return false;
}

// Right after the account is deleted: send the request recorded for it.
export async function purgeFromIndex(
  db: D1Database,
  config: IndexPurgeConfig,
  userId: string,
  now = Date.now(),
): Promise<boolean> {
  const row = await db
    .prepare('SELECT userId, teamIds, attempts FROM pending_purges WHERE userId = ?')
    .bind(userId)
    .first<PendingRow>();
  return row ? attempt(db, config, row, now) : true;
}

// The cron: every request still waiting, the never-tried and longest-waiting first. Only for an account that is gone:
// one whose closing stopped before the user was deleted waits for it to be tried again, and is never sent while the
// person can still sign in.
export async function retryPendingPurges(
  db: D1Database,
  config: IndexPurgeConfig,
  now = Date.now(),
): Promise<{ sent: number; failed: number; waiting: number }> {
  const { results } = await db
    .prepare(
      `SELECT userId, teamIds, attempts FROM pending_purges p WHERE ${ACCOUNT_GONE}
       ORDER BY lastAttemptAt LIMIT ?`,
    )
    .bind(PURGES_PER_RUN)
    .all<PendingRow>();
  let sent = 0;
  for (const row of results) if (await attempt(db, config, row, now)) sent++;
  const waiting = await db
    .prepare(`SELECT COUNT(*) AS n FROM pending_purges p WHERE ${ACCOUNT_GONE}`)
    .first<number>('n');
  return { sent, failed: results.length - sent, waiting: waiting ?? 0 };
}
