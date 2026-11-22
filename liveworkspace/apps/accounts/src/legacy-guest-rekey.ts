// Re-keying the old livediagram.app's guests from before signing (liveworkspace/docs/specs/003-accounts/accounts.md
// "Re-keying", docs/migration.md step 6). Their work was copied under `guest_<old uuid>`, which the index shows every
// reader of their items, and their browsers hold only that bare uuid, with no signature. So each unclaimed one moves
// to `rekeyedLegacyGuestOwner(old uuid, LEGACY_GUEST_REKEY_SECRET)`: the index's legacy merge moves the work (and
// tells the apps), then one batch here moves the settings and profile and renames the row. A claim derives the same
// id from the bare id (legacy-guests.ts), so holding the old id is proof again while the stored id reveals nothing.
//
//   POST /api/auth/internal/legacy-guests/rekey  {dryRun?, limit?}  (Bearer ADMIN_TOKEN)
//
// The migrate tool's `rekey-guests` command calls it in batches until nothing is left.

import {
  LEGACY_GUEST_SIGNING_LIVE_AT,
  rekeyedLegacyGuestOwner,
} from '@liveworkspace/migration/contract';
import { AUTH_BASE_PATH } from './auth-options.ts';
import type { Env } from './env.ts';
import { guestMergeConfig, mergeGuestInto, type MergeConfig } from './guests.ts';
import { LEGACY_CLAIM_HOLD_MS, LEGACY_ID } from './legacy-guests.ts';
import { sameSecret } from './secrets.ts';

export const REKEY_PATH = `${AUTH_BASE_PATH}/internal/legacy-guests/rekey`;
// Rows one call re-keys: each is an index merge (up to its 5-second timeout) and two writes here, so a call stays
// well inside a request's limits; the command calls again until none are left.
export const REKEY_BATCH_MAX = 50;
export const REKEY_BATCH_DEFAULT = 25;
const SAMPLE_SIZE = 5;

type Row = {
  id: string;
  firstSeenAt: number;
  claimedAt: number | null;
  claimingUntil: number | null;
  rekeyedAt: number | null;
};

export type RekeyConfig = {
  db: D1Database;
  secret: string;
  merge: MergeConfig;
  now?: () => number;
};

export type DryRunAnswer = {
  rows: number;
  claimed: number;
  unclaimed: number;
  // Unclaimed and from after signing: claimed with a signature, never re-keyed.
  signedOnly: number;
  rekeyed: number;
  toRekey: number;
  // Of toRekey, held by a claim under way: left for a later run.
  held: number;
  sample: { from: string; to: string }[];
};

export type RunAnswer = { rekeyed: number; skipped: number; failed: number; remaining: number };

// Unclaimed, not re-keyed, from before signing: the rows a run moves.
const CANDIDATE = (row: Row) =>
  row.claimedAt === null &&
  row.rekeyedAt === null &&
  row.firstSeenAt < LEGACY_GUEST_SIGNING_LIVE_AT &&
  LEGACY_ID.test(row.id.slice('guest_'.length));

async function readRows(db: D1Database): Promise<Row[]> {
  const { results } = await db
    .prepare(
      'SELECT id, firstSeenAt, claimedAt, claimingUntil, rekeyedAt FROM legacy_guest ORDER BY id',
    )
    .all<Row>();
  return results;
}

export async function dryRun(config: RekeyConfig): Promise<DryRunAnswer> {
  const now = config.now?.() ?? Date.now();
  const rows = await readRows(config.db);
  const unclaimed = rows.filter((r) => r.claimedAt === null);
  const candidates = rows.filter(CANDIDATE);
  const sample = await Promise.all(
    candidates.slice(0, SAMPLE_SIZE).map(async (r) => {
      const old = r.id.slice('guest_'.length);
      // Only the start of the old id: in full it is what a claim needs.
      return {
        from: `guest_${old.slice(0, 8)}…`,
        to: await rekeyedLegacyGuestOwner(old, config.secret),
      };
    }),
  );
  return {
    rows: rows.length,
    claimed: rows.length - unclaimed.length,
    unclaimed: unclaimed.length,
    signedOnly: unclaimed.filter((r) => r.firstSeenAt >= LEGACY_GUEST_SIGNING_LIVE_AT).length,
    rekeyed: rows.filter((r) => r.rekeyedAt !== null).length,
    toRekey: candidates.length,
    held: candidates.filter((r) => r.claimingUntil !== null && r.claimingUntil > now).length,
    sample,
  };
}

type Outcome = 'rekeyed' | 'skipped' | 'failed';

// One guest. Held as a claim holds it, so a claim under way is never overtaken and none starts meanwhile (it answers
// 503, and the editor tries on a later load). The index first: a run that stops after it leaves the row as it was,
// still held for a minute, and the next run (or a signed claim, legacy-guests.ts) finishes the move.
async function rekeyOne(config: RekeyConfig, row: Row, hold: string): Promise<Outcome> {
  const { db } = config;
  const now = config.now?.() ?? Date.now();
  const to = await rekeyedLegacyGuestOwner(row.id.slice('guest_'.length), config.secret);
  const held = await db
    .prepare(
      `UPDATE legacy_guest SET claimingBy = ?, claimingUntil = ?
       WHERE id = ? AND claimedAt IS NULL AND rekeyedAt IS NULL
         AND (claimingUntil IS NULL OR claimingUntil <= ?)`,
    )
    .bind(hold, now + LEGACY_CLAIM_HOLD_MS, row.id, now)
    .run();
  if ((held.meta.changes ?? 0) === 0) return 'skipped';
  if (!(await mergeGuestInto(config.merge, row.id, to, { legacy: true }))) {
    await db
      .prepare(
        'UPDATE legacy_guest SET claimingBy = NULL, claimingUntil = NULL WHERE id = ? AND claimingBy = ?',
      )
      .bind(row.id, hold)
      .run();
    return 'failed';
  }
  // A merge into a guest leaves settings and profile here (guests.ts): they move with the row, in one batch, and
  // only while the row still holds this run's hold.
  const [, , renamed] = await db.batch([
    db
      .prepare(
        `UPDATE settings SET owner_id = ?1 WHERE owner_id = ?2
           AND EXISTS (SELECT 1 FROM legacy_guest WHERE id = ?2 AND claimingBy = ?3)`,
      )
      .bind(to, row.id, hold),
    db
      .prepare(
        `UPDATE profile SET owner_id = ?1 WHERE owner_id = ?2
           AND EXISTS (SELECT 1 FROM legacy_guest WHERE id = ?2 AND claimingBy = ?3)`,
      )
      .bind(to, row.id, hold),
    db
      .prepare(
        `UPDATE legacy_guest SET id = ?, rekeyedAt = ?, claimingBy = NULL, claimingUntil = NULL
         WHERE id = ? AND claimingBy = ? AND claimedAt IS NULL`,
      )
      .bind(to, config.now?.() ?? Date.now(), row.id, hold),
  ]);
  return (renamed?.meta.changes ?? 0) > 0 ? 'rekeyed' : 'failed';
}

export async function run(config: RekeyConfig, limit: number): Promise<RunAnswer> {
  const candidates = (await readRows(config.db)).filter(CANDIDATE);
  const hold = `rekey:${crypto.randomUUID()}`;
  const counts: Record<Outcome, number> = { rekeyed: 0, skipped: 0, failed: 0 };
  // One at a time: each is a merge in the index, which every app then hears of.
  for (const row of candidates.slice(0, limit)) {
    counts[await rekeyOne(config, row, hold)]++;
  }
  console.info('[accounts] legacy guests re-keyed', counts);
  return { ...counts, remaining: candidates.length - counts.rekeyed };
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function rekeyLegacyGuests(request: Request, env: Env): Promise<Response> {
  const secret = env.LEGACY_GUEST_REKEY_SECRET?.trim();
  if (!secret) return json({ error: 'not_found' }, 404);
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!env.ADMIN_TOKEN || !(await sameSecret(token, env.ADMIN_TOKEN))) {
    return json({ error: 'unauthorized' }, 401);
  }
  const body = ((await request.json().catch(() => null)) ?? {}) as {
    dryRun?: unknown;
    limit?: unknown;
  };
  const limit = body.limit ?? REKEY_BATCH_DEFAULT;
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > REKEY_BATCH_MAX
  ) {
    return json({ error: 'invalid_limit' }, 400);
  }
  const config: RekeyConfig = { db: env.AUTH_DB, secret, merge: guestMergeConfig(env) };
  return json(body.dryRun === true ? await dryRun(config) : await run(config, limit));
}
