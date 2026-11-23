// Items' standing counts (subscription.md "Meters"): an owner's automation rules and knowledgebase pages, counted
// where each item lives and told here, one row an item, so the owner's total is the sum over every item they own.
// A count that grows because someone adds is refused, in the one statement that writes it, when it would take the
// owner's total past their limit; any other count (a delete, an item that changed owner, a count told again) is
// recorded whatever the total, as an item keeps what it holds.

import {
  ITEM_METER_LIMIT,
  type ItemCountResult,
  type ItemMeter,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { ENTITLED_LIMIT, LIMIT_BINDS, limitBinds, meterResult, type MeterRow } from './limits';

export type ItemCount = {
  owner: OwnerScope;
  meter: ItemMeter;
  item: string;
  used: number;
  adding?: boolean;
};

const B = LIMIT_BINDS;
// ?7 meter, ?8 item, ?9 the count, ?10 whether it is an add, ?11 now.
const OTHERS = `(SELECT COALESCE(SUM(used), 0) FROM item_usage WHERE owner = ?5 AND meter = ?${B + 1} AND item <> ?${B + 2})`;
const HELD = `COALESCE((SELECT used FROM item_usage WHERE owner = ?5 AND meter = ?${B + 1} AND item = ?${B + 2}), 0)`;
const ALLOWED = `(?${B + 4} = 0 OR ?${B + 3} <= ${HELD} OR (SELECT lim FROM ent) < 0 OR ${OTHERS} + ?${B + 3} <= (SELECT lim FROM ent))`;

const COUNT = `${ENTITLED_LIMIT}
INSERT INTO item_usage (owner, meter, item, used, updated_at)
SELECT ?5, ?${B + 1}, ?${B + 2}, ?${B + 3}, ?${B + 5} FROM ent WHERE ${ALLOWED}
ON CONFLICT (owner, meter, item) DO UPDATE SET used = excluded.used, updated_at = excluded.updated_at
RETURNING ${OTHERS} + used AS used, (SELECT paid FROM ent) AS paid, (SELECT lim FROM ent) AS lim`;

// Only after a refusal: the owner's total as it stands, and their limit.
const REFUSED = `${ENTITLED_LIMIT}
SELECT ${OTHERS} + ${HELD} AS used, paid, lim FROM ent`;

const DROP = 'DELETE FROM item_usage WHERE owner = ? AND meter = ? AND item = ?';
// After a drop: what the owner's other items hold.
const LEFT = `${ENTITLED_LIMIT}
SELECT ${OTHERS} AS used, paid, lim FROM ent`;

/** Records an item's count, or refuses a growing one past the owner's limit. A count of nothing drops the item's
 *  row: it holds none now, or is gone (one round trip: the drop and the read after it are one batch). */
export async function countItem(
  db: D1Database,
  count: ItemCount,
  now: number,
): Promise<ItemCountResult> {
  const binds = [
    ...limitBinds(count.owner, ITEM_METER_LIMIT[count.meter], now),
    count.meter,
    count.item,
  ];
  if (count.used === 0) {
    const [, left] = await db.batch<MeterRow>([
      db.prepare(DROP).bind(count.owner, count.meter, count.item),
      db.prepare(LEFT).bind(...binds),
    ]);
    return meterResult(count.owner, true, left!.results[0]!);
  }
  const written = await db
    .prepare(COUNT)
    .bind(...binds, count.used, count.adding ? 1 : 0, now)
    .first<MeterRow>();
  if (written) return meterResult(count.owner, true, written);
  const refused = await db
    .prepare(REFUSED)
    .bind(...binds)
    .first<MeterRow>();
  // The clause always answers one row.
  return meterResult(count.owner, false, refused!);
}
