// Guests from before accounts stamped them (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests";
// liveworkspace/docs/specs/003-accounts/accounts.md "Guests from before the stamp"). Accounts sweeps a guest 400 days
// after it last saw it, but it only began noting that on 2026-10-25, so a guest from before then, and every returning
// guest of the old livediagram.app who never claimed their work, has no `guest_seen` row and would never be swept.
// Once a day this sends accounts the next page of the index's guest owners, over the ACCOUNTS service binding (the
// only way the route can be reached), and accounts dates each one it has no row for. One pass, then never again:
// every guest since 2026-10-25 is stamped by its own hand-off.

import { deadlineSignal } from '@liveworkspace/auth-client';
import {
  ACCOUNTS_BINDING_ORIGIN,
  GUEST_SEEN_BACKFILL_PAGE,
  GUEST_SEEN_BACKFILL_PATH,
  type GuestSeenBackfillAnswer,
} from '@liveworkspace/auth-client/guest-seen-backfill';
import { GUEST_ID } from './auth';
import type { Env } from './env';

// Its row in cron_cursors.
export const GUEST_SEEN_BACKFILL_JOB = 'guest-seen-backfill';
// How long accounts has to answer: one statement over at most 500 ids.
export const GUEST_SEEN_BACKFILL_TIMEOUT_MS = 10_000;

// Every guest id sorts after the first and before the second: '`' is the character after '_', so the range is an
// index range over items_owner, which `LIKE 'guest_%'` (whose `_` is a wildcard) would not be.
const FIRST = 'guest_';
const PAST_LAST = 'guest`';

export type GuestSeenBackfill =
  { skipped: 'unset' | 'finished' } | { sent: number; added: number; finished: boolean };

export async function backfillGuestSeen(env: Env, now = Date.now()): Promise<GuestSeenBackfill> {
  const key = env.MERGE_KEY?.trim();
  if (!env.ACCOUNTS || !key) return { skipped: 'unset' };
  const db = env.INDEX_DB;
  const saved = await db
    .prepare('SELECT cursor, finished_at FROM cron_cursors WHERE job = ?')
    .bind(GUEST_SEEN_BACKFILL_JOB)
    .first<{ cursor: string; finished_at: number | null }>();
  if (saved?.finished_at != null) return { skipped: 'finished' };
  const after = saved?.cursor ?? FIRST;
  // A guest already merged into someone (person_aliases) is theirs now: never sent, so never swept.
  const { results } = await db
    .prepare(
      `SELECT DISTINCT owner_id FROM items
       WHERE owner_id > ?1 AND owner_id < ?2 AND owner_id NOT IN (SELECT guest_id FROM person_aliases)
       ORDER BY owner_id LIMIT ?3`,
    )
    .bind(after, PAST_LAST, GUEST_SEEN_BACKFILL_PAGE)
    .all<{ owner_id: string }>();
  const ids = results.map((row) => row.owner_id).filter((id) => GUEST_ID.test(id));
  let added = 0;
  if (ids.length > 0) {
    // Straight over the binding, never the public route: accounts answers it nowhere else.
    const res = await env.ACCOUNTS.fetch(`${ACCOUNTS_BINDING_ORIGIN}${GUEST_SEEN_BACKFILL_PATH}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      signal: deadlineSignal(GUEST_SEEN_BACKFILL_TIMEOUT_MS),
    });
    // The cursor stays where it was, so tomorrow's run sends the same page again.
    if (!res.ok) throw new Error(`accounts answered ${res.status}`);
    ({ added } = (await res.json()) as GuestSeenBackfillAnswer);
  }
  const finished = results.length < GUEST_SEEN_BACKFILL_PAGE;
  await db
    .prepare(
      `INSERT INTO cron_cursors (job, cursor, finished_at, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (job) DO UPDATE SET cursor = excluded.cursor, finished_at = excluded.finished_at,
         updated_at = excluded.updated_at`,
    )
    .bind(GUEST_SEEN_BACKFILL_JOB, results.at(-1)?.owner_id ?? after, finished ? now : null, now)
    .run();
  return { sent: ids.length, added, finished };
}
