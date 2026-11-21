// What each time rule that runs once per thing it finds has run on (liveworkspace/docs/specs/018-automations/
// automations.md "Runs, limits and loops"; blueprint engine.md "Tables"): the event ids a wake queued, in
// `automation_fired`, apart from the Audit Trail. The Audit Trail's trim (30 days, 2,000 runs) drops a run's row, and
// with it the run id that kept the rule from running on the same thing again; these ids stay, so one that still
// matches (for weeks, for months) never runs twice. A Scheduled moment's id is never kept: its day never comes
// again. The newest AUTOMATION_FIRED_MAX are kept.
import type { Sql } from './sql';

export const AUTOMATION_FIRED_MAX = 20_000;

/** The event ids the rule has run on. */
export function firedIds(sql: Sql, ruleId: string): Set<string> {
  const rows = sql
    .exec('SELECT id FROM automation_fired WHERE rule_id = ?', ruleId)
    .toArray() as unknown as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** The event ids a wake queued for the rule, kept. */
export function keepFired(sql: Sql, ruleId: string, ids: readonly string[], now: number): void {
  sql.exec(
    'INSERT OR IGNORE INTO automation_fired (id, rule_id, at) SELECT value, ?, ? FROM json_each(?)',
    ruleId,
    now,
    JSON.stringify(ids),
  );
}

/** The newest AUTOMATION_FIRED_MAX kept, once a wake that kept any. */
export function trimFired(sql: Sql): void {
  sql.exec(
    `DELETE FROM automation_fired WHERE id IN
       (SELECT id FROM automation_fired ORDER BY at DESC, id LIMIT -1 OFFSET ?)`,
    AUTOMATION_FIRED_MAX,
  );
}

/** The rule's kept ids forgotten: it was deleted, or its trigger changed. */
export function forgetFired(sql: Sql, ruleId: string): void {
  sql.exec('DELETE FROM automation_fired WHERE rule_id = ?', ruleId);
}
