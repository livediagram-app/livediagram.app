// A plan's marks of its owner's monthly limits (docs/specs/026-plan/email-to-board.md "Tiers"; blueprint
// email-to-board.md "Tiers (Pro)"), in its SQLite: one row a meter, holding the UTC month (`2026-11`) the owner's
// count was found used in and the limit met then (`used`). The count itself is the subscription service's, over
// everything the owner has. Kept only with Pro on: with it off no statement here runs.
import type { PlanEnv } from '../../types';

// A plan schema step (plan-schema.ts), append-only like every other.
export const PLAN_METERS_SCHEMA = `
CREATE TABLE IF NOT EXISTS plan_meters (
  plan_id  TEXT    NOT NULL REFERENCES plan (id) ON DELETE CASCADE,
  meter    TEXT    NOT NULL,
  period   TEXT    NOT NULL,
  used     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (plan_id, meter)
);
`;

/** Email to Board's mark: the month its owner's emails were found used in, and the limit met then. */
export const EMAIL_METER = 'emailToBoard';

type Db = Pick<PlanEnv, 'PLAN_DB'>;

/** The owner's month of `meter` was refused at `limit`: kept so later mail, and the dialog, read it as used with no
 *  call to the subscription service until the month turns or the limit grows. */
export async function markMonthFull(
  env: Db,
  planId: string,
  meter: string,
  month: string,
  limit: number,
): Promise<void> {
  await env.PLAN_DB.prepare(
    `INSERT INTO plan_meters (plan_id, meter, period, used) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (plan_id, meter) DO UPDATE SET period = excluded.period, used = excluded.used`,
  )
    .bind(planId, meter, month, limit)
    .run();
}

/** Whether the owner's month of `meter` was found used at `limit` or more: a new month, or a larger limit (an
 *  upgrade), reads as not. */
export async function monthFull(
  env: Db,
  planId: string,
  meter: string,
  month: string,
  limit: number,
): Promise<boolean> {
  const row = await env.PLAN_DB.prepare(
    'SELECT used FROM plan_meters WHERE plan_id = ? AND meter = ? AND period = ?',
  )
    .bind(planId, meter, month)
    .first<{ used: number }>();
  return !!row && Number(row.used) >= limit;
}
