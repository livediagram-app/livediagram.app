// Gauges (subscription.md "Meters"): counts the service holds per owner, one entry per thing (a published roadmap).
// What media holds (Image Storage, Walkthroughs Stored) is not kept here: media counts it live (src/media-usage.ts).

import {
  GAUGE_LIMIT,
  type Gauge,
  type GaugeResult,
  type OwnerScope,
} from '@liveworkspace/subscription';
import { ENTITLED_LIMIT, limitBinds, meterResult, type MeterRow } from './limits';

// What an owner holds of a gauge now: ?5 is the owner, ?7 the gauge.
const HELD = `(SELECT COUNT(*) FROM gauge_entries WHERE owner = ?5 AND gauge = ?7)`;

// Adds the entry only while the owner is under the limit. An entry already there conflicts and is left as it is.
const ADD = `${ENTITLED_LIMIT}
INSERT INTO gauge_entries (owner, gauge, key, created_at)
SELECT ?5, ?7, ?8, ?6 FROM ent WHERE ent.lim < 0 OR ${HELD} < ent.lim
ON CONFLICT (owner, gauge, key) DO NOTHING`;

const STATE = `${ENTITLED_LIMIT}
SELECT ${HELD} AS used, paid, lim,
  EXISTS (SELECT 1 FROM gauge_entries WHERE owner = ?5 AND gauge = ?7 AND key = ?8) AS present
FROM ent`;

type State = MeterRow & { present: number };

function binds(owner: OwnerScope, gauge: Gauge, key: string, now: number): (string | number)[] {
  return [...limitBinds(owner, GAUGE_LIMIT[gauge], now), gauge, key];
}

/** The second statement of every gauge write: what the owner holds once the write has landed. */
function stateAfter(db: D1Database, owner: OwnerScope, gauge: Gauge, key: string, now: number) {
  return db.prepare(STATE).bind(...binds(owner, gauge, key, now));
}

/**
 * Adds one entry to a counted gauge. Refused, atomically, when the owner is at its limit; an entry already there is
 * a success that changes nothing. One round trip: the add and the read after it are one batch.
 */
export async function addToGauge(
  db: D1Database,
  owner: OwnerScope,
  gauge: Gauge,
  key: string,
  now: number,
): Promise<GaugeResult> {
  const [, after] = await db.batch<State>([
    db.prepare(ADD).bind(...binds(owner, gauge, key, now)),
    stateAfter(db, owner, gauge, key, now),
  ]);
  const state = after!.results[0]!;
  return meterResult(owner, state.present === 1, state);
}

/** Removes an entry. One that was never there is a success too. */
export async function removeFromGauge(
  db: D1Database,
  owner: OwnerScope,
  gauge: Gauge,
  key: string,
  now: number,
): Promise<GaugeResult> {
  const [, after] = await db.batch<State>([
    db
      .prepare('DELETE FROM gauge_entries WHERE owner = ? AND gauge = ? AND key = ?')
      .bind(owner, gauge, key),
    stateAfter(db, owner, gauge, key, now),
  ]);
  return meterResult(owner, true, after!.results[0]!);
}
