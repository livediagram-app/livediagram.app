// What several owners have used of every limit, read together (subscription.md "What people see"): this month's
// spend, what each holds of every gauge, and what all their items hold of each standing count. One
// batch for all the owners, never a read per owner. What media holds for them is media's to say (src/media-usage.ts).

import {
  isGauge,
  isItemMeter,
  isSpendMeter,
  monthKey,
  type OwnerScope,
  type Usage,
} from '@liveworkspace/subscription';
import { subscriptionsOf } from '../subscriptions/store';
import type { SubscriptionRow } from '../subscriptions/state';

/** D1 binds at most 100 values to a statement. The spend read binds one more than its owners. */
const OWNERS_PER_BATCH = 90;

type Counted = { owner: OwnerScope; meter: string; used: number };

export type OwnersRead = {
  subscriptions: Map<OwnerScope, SubscriptionRow>;
  usage: Map<OwnerScope, Usage>;
  /** What the statements handed in as `beside` answered, in their order. */
  beside: D1Result[];
};

function statements(
  db: D1Database,
  owners: readonly OwnerScope[],
  now: number,
): D1PreparedStatement[] {
  const marks = owners.map(() => '?').join(', ');
  return [
    subscriptionsOf(db, owners),
    db
      .prepare(
        `SELECT owner, meter, used FROM spend_counters WHERE owner IN (${marks}) AND month = ?`,
      )
      .bind(...owners, monthKey(now)),
    db
      .prepare(
        `SELECT owner, gauge AS meter, COUNT(*) AS used FROM gauge_entries WHERE owner IN (${marks})
         GROUP BY owner, gauge`,
      )
      .bind(...owners),
    // An owner's standing counts: the sum over every item they own.
    db
      .prepare(
        `SELECT owner, meter, SUM(used) AS used FROM item_usage
         WHERE owner IN (${marks}) GROUP BY owner, meter`,
      )
      .bind(...owners),
  ];
}

/** Every owner's subscription row and usage. Owners with neither are simply absent from the maps. `beside` are
 *  statements of the caller's own to read in the same batch (the first), so a page's read stays one round trip. */
export async function readOwners(
  db: D1Database,
  owners: readonly OwnerScope[],
  now: number,
  beside: readonly D1PreparedStatement[] = [],
): Promise<OwnersRead> {
  const read: OwnersRead = { subscriptions: new Map(), usage: new Map(), beside: [] };
  const usageOf = (owner: OwnerScope): Usage => {
    let usage = read.usage.get(owner);
    if (!usage) read.usage.set(owner, (usage = {}));
    return usage;
  };
  const unique = [...new Set(owners)];
  for (let at = 0; at < unique.length; at += OWNERS_PER_BATCH) {
    const [subscriptions, spent, counted, items, ...rest] = await db.batch([
      ...statements(db, unique.slice(at, at + OWNERS_PER_BATCH), now),
      ...(at === 0 ? beside : []),
    ]);
    if (at === 0) read.beside = rest;
    for (const row of subscriptions!.results as SubscriptionRow[])
      read.subscriptions.set(row.owner, row);
    for (const row of spent!.results as Counted[]) {
      if (isSpendMeter(row.meter)) usageOf(row.owner)[row.meter] = { used: row.used };
    }
    for (const row of counted!.results as Counted[]) {
      if (isGauge(row.meter)) usageOf(row.owner)[row.meter] = { used: row.used };
    }
    for (const row of items!.results as Counted[]) {
      if (isItemMeter(row.meter)) usageOf(row.owner)[row.meter] = { used: row.used };
    }
  }
  return read;
}
