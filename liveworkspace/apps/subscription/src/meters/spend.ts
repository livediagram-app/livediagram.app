// Spend meters (subscription.md "Meters"): Automation Runs, AI Credits, Call Minutes and the rest, counted per owner and UTC
// month. An app spends before it does the work, and the spend is one statement: it reads the owner's tier, works out
// the limit and adds to the counter only while the total stays within it, so concurrent spends can never pass it.

import {
  monthKey,
  SPEND_METER_LIMIT,
  type OwnerScope,
  type SpendMeter,
  type SpendResult,
} from '@liveworkspace/subscription';
import { ENTITLED_LIMIT, limitBinds, meterResult, type MeterRow } from './limits';

const SPEND = `${ENTITLED_LIMIT}
INSERT INTO spend_counters (owner, meter, month, used, updated_at)
SELECT ?5, ?7, ?8, ?9, ?6 FROM ent WHERE ent.lim < 0 OR ?9 <= ent.lim
ON CONFLICT (owner, meter, month) DO UPDATE SET used = used + excluded.used, updated_at = excluded.updated_at
  WHERE (SELECT lim FROM ent) < 0 OR spend_counters.used + excluded.used <= (SELECT lim FROM ent)
RETURNING used, (SELECT paid FROM ent) AS paid, (SELECT lim FROM ent) AS lim`;

// Only after a refusal: what the owner has used and may use, to say so.
const REFUSED = `${ENTITLED_LIMIT}
SELECT COALESCE((SELECT used FROM spend_counters WHERE owner = ?5 AND meter = ?7 AND month = ?8), 0) AS used,
  paid, lim FROM ent`;

/** Spends `amount` from an owner's meter for this month, or refuses when that would pass the limit (a limit of 0
 *  refuses everything, and no limit, as gauges have it, refuses nothing). `amount` is a positive whole number: the
 *  route checks it. */
export async function spend(
  db: D1Database,
  owner: OwnerScope,
  meter: SpendMeter,
  amount: number,
  now: number,
): Promise<SpendResult> {
  const binds = [...limitBinds(owner, SPEND_METER_LIMIT[meter], now), meter, monthKey(now)];
  const spent = await db
    .prepare(SPEND)
    .bind(...binds, amount)
    .first<MeterRow>();
  if (spent) return meterResult(owner, true, spent);
  const refused = await db
    .prepare(REFUSED)
    .bind(...binds)
    .first<MeterRow>();
  // The clause always answers one row.
  return meterResult(owner, false, refused!);
}
