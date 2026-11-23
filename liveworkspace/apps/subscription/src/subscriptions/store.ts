// The `subscriptions` table: one row per owner that has ever subscribed. Every read here is by the primary key.

import type { OwnerScope } from '@liveworkspace/subscription';
import { changed, isLive, type SubscriptionChange, type SubscriptionRow } from './state';

const COLUMNS =
  'owner, tier, state, seats, currency, unit_amount, period_start, period_end, anchor_day, grace_end, ' +
  'cancel_at_period_end, provider, provider_ref, subscribed_by, seats_checked_at, ended_at, ended_seen, ' +
  'created_at, updated_at';

/** An owner's row, or null when it has never subscribed. One indexed read. */
export function readSubscription(
  db: D1Database,
  owner: OwnerScope,
): Promise<SubscriptionRow | null> {
  return db
    .prepare(`SELECT ${COLUMNS} FROM subscriptions WHERE owner = ?`)
    .bind(owner)
    .first<SubscriptionRow>();
}

/** The statement that reads several owners' rows, for a batch. At most 90 owners: D1 binds no more than 100. */
export function subscriptionsOf(
  db: D1Database,
  owners: readonly OwnerScope[],
): D1PreparedStatement {
  const marks = owners.map(() => '?').join(', ');
  return db
    .prepare(`SELECT ${COLUMNS} FROM subscriptions WHERE owner IN (${marks})`)
    .bind(...owners);
}

/** The statement that writes a new subscription over whatever the owner had (a first one, or one after an earlier
 *  one ended), for a batch or on its own. */
export function writeSubscriptionStatement(
  db: D1Database,
  row: SubscriptionRow,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO subscriptions (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (owner) DO UPDATE SET
         tier = excluded.tier, state = excluded.state, seats = excluded.seats, currency = excluded.currency,
         unit_amount = excluded.unit_amount, period_start = excluded.period_start, period_end = excluded.period_end,
         anchor_day = excluded.anchor_day, grace_end = excluded.grace_end, cancel_at_period_end = excluded.cancel_at_period_end,
         provider = excluded.provider, provider_ref = excluded.provider_ref, subscribed_by = excluded.subscribed_by,
         seats_checked_at = excluded.seats_checked_at, ended_at = excluded.ended_at,
         ended_seen = excluded.ended_seen, updated_at = excluded.updated_at`,
    )
    .bind(
      row.owner,
      row.tier,
      row.state,
      row.seats,
      row.currency,
      row.unit_amount,
      row.period_start,
      row.period_end,
      row.anchor_day,
      row.grace_end,
      row.cancel_at_period_end,
      row.provider,
      row.provider_ref,
      row.subscribed_by,
      row.seats_checked_at,
      row.ended_at,
      row.ended_seen,
      row.created_at,
      row.updated_at,
    );
}

/** Why a change was not made: the owner has no subscription, or its state does not allow the change. */
export type ChangeRefusal = 'not_subscribed' | 'invalid_state';

/**
 * Applies a provider's report to an owner's subscription and answers the row as it now is. The write only lands on
 * the row the change was worked out from (same state and period), so two reports at once can't both apply.
 */
export async function applyChange(
  db: D1Database,
  owner: OwnerScope,
  change: SubscriptionChange,
  now: number,
): Promise<SubscriptionRow | ChangeRefusal> {
  const row = await readSubscription(db, owner);
  if (!row) return 'not_subscribed';
  const patch = changed(row, change, now);
  if (!patch) return 'invalid_state';
  // A change lands on a live row, or ends it now: either way nothing has been dismissed about how it stands.
  const next: SubscriptionRow = { ...row, ...patch, ended_seen: 0, updated_at: now };
  const written = await db
    .prepare(
      `UPDATE subscriptions SET state = ?, seats = ?, period_start = ?, period_end = ?, grace_end = ?,
         cancel_at_period_end = ?, seats_checked_at = ?, ended_at = ?, ended_seen = 0, updated_at = ?
       WHERE owner = ? AND state = ? AND period_end = ? AND updated_at = ?`,
    )
    .bind(
      next.state,
      next.seats,
      next.period_start,
      next.period_end,
      next.grace_end,
      next.cancel_at_period_end,
      next.seats_checked_at,
      next.ended_at,
      next.updated_at,
      owner,
      row.state,
      row.period_end,
      row.updated_at,
    )
    .run();
  return written.meta.changes === 1 ? next : 'invalid_state';
}

/**
 * The owner has read "You're Back on Free" (subscription.md): the ending their row holds is not said again, in any
 * browser. Nothing is written for an owner with no row or one that is live, so a paid tier's next ending is said.
 */
export async function dismissEnded(db: D1Database, owner: OwnerScope, now: number): Promise<void> {
  const row = await readSubscription(db, owner);
  if (!row || isLive(row, now) || row.ended_seen === 1) return;
  await db
    .prepare(
      'UPDATE subscriptions SET ended_seen = 1 WHERE owner = ? AND state = ? AND period_end = ?',
    )
    .bind(owner, row.state, row.period_end)
    .run();
}
