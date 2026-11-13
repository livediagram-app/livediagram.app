// A plan's Audit Trail on its own SQLite (docs/specs/026-plan/automations.md "Runs, limits and loops", "The Automations
// screen"; blueprint automations.md "Storage", "The run"). A run's row goes in as `pending` before it does anything,
// under the run's id, so a second wake or a retry finds it and never runs it again; then it is settled with its
// result. Kept for 30 days or the last 2,000 runs. Also each rule's figures for the Rules list and today's count (UTC),
// which is the daily budget.
import {
  AUTOMATION_LOG_MAX,
  AUTOMATION_LOG_MAX_AGE_MS,
  type AutomationResult,
  type AutomationRuleStats,
  type AutomationRun,
} from '@liveplanner/items';
import type { AutomationRunsQuery } from '@liveplanner/api-schema';
import type { Sql } from './automation-store';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const AUTOMATION_RUNS_LIST_MAX = 200;
const PENDING = 'pending';

const utcMidnight = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

// The Audit Trail's own lines, which are no rule's run: a burst's "Too many changes at once" and a time trigger's
// "Ran on 100 of 340". A run's id is a hash, so these prefixes never meet one.
export const burstLineId = (now: number): string => `burst:${now}`;
export const timeLineId = (ruleId: string, moment: number): string => `time:${ruleId}:${moment}`;
const NO_LINE = "id NOT LIKE 'burst:%' AND id NOT LIKE 'time:%'";

// Runs today (UTC) that did something, failed or were skipped, pending ones too: what the daily budget counts. A No
// Match is logged and never counted, nor is one of the Audit Trail's own lines.
export function runsToday(sql: Sql, now: number): number {
  const row = sql
    .exec(
      `SELECT COUNT(*) AS n FROM automation_runs WHERE at >= ? AND result != 'no_match' AND ${NO_LINE}`,
      utcMidnight(now),
    )
    .toArray()[0];
  return Number(row?.['n'] ?? 0);
}

// The run's row, held as pending: false when it is there already (it ran, or is running).
export function claimRun(sql: Sql, id: string, ruleId: string, at: number): boolean {
  return (
    sql
      .exec(
        `INSERT OR IGNORE INTO automation_runs (id, rule_id, at, result, body)
         VALUES (?, ?, ?, '${PENDING}', '{}') RETURNING id`,
        id,
        ruleId,
        at,
      )
      .toArray().length > 0
  );
}

// A claimed run that never started after all (a chain stop whose conditions did not hold): its row goes, so it
// counts against nothing.
export function dropRun(sql: Sql, id: string): void {
  sql.exec(`DELETE FROM automation_runs WHERE id = ? AND result = '${PENDING}'`, id);
}

// The run as it ended. A run that was never claimed (a burst's Skipped line) goes in whole.
export function settleRun(sql: Sql, run: AutomationRun): void {
  sql.exec(
    `INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET result = excluded.result, body = excluded.body`,
    run.id,
    run.ruleId,
    run.at,
    run.result,
    JSON.stringify(run),
  );
}

// A waiting run settled once its Wait ends: Done when the rest went on (a run of its own), Skipped with why when it
// never could. A row gone (trimmed) is left gone.
export function settleWaiting(
  sql: Sql,
  id: string,
  result: Exclude<AutomationResult, 'waiting'>,
  reason?: string,
): void {
  const row = sql
    .exec("SELECT body FROM automation_runs WHERE id = ? AND result = 'waiting'", id)
    .toArray()[0];
  if (!row) return;
  const body = row['body'];
  if (typeof body !== 'string') return;
  let run: AutomationRun;
  try {
    run = JSON.parse(body) as AutomationRun;
  } catch {
    return;
  }
  const { waitsUntil: _until, reason: _reason, gone: _gone, ...rest } = run;
  settleRun(sql, { ...rest, result, ...(reason ? { reason } : {}) });
}

// No Match rows kept, apart from the runs: however many there are, they never push a run out of the log.
export const AUTOMATION_NO_MATCH_LOG_MAX = 500;

// The rows past 30 days; then the newest 2,000 runs (done, failed, skipped) and, beside them, the newest 500 No Match
// rows, each kept apart so a busy rule that matches nothing never pushes a real run out.
export function trimRuns(sql: Sql, now: number): void {
  sql.exec('DELETE FROM automation_runs WHERE at < ?', now - AUTOMATION_LOG_MAX_AGE_MS);
  sql.exec(
    `DELETE FROM automation_runs WHERE id IN
       (SELECT id FROM automation_runs WHERE result = 'no_match' ORDER BY at DESC, id LIMIT -1 OFFSET ?)`,
    AUTOMATION_NO_MATCH_LOG_MAX,
  );
  sql.exec(
    `DELETE FROM automation_runs WHERE id IN
       (SELECT id FROM automation_runs WHERE result != 'no_match' ORDER BY at DESC, id LIMIT -1 OFFSET ?)`,
    AUTOMATION_LOG_MAX,
  );
}

// Each rule's last run and its runs this week, by rule id, counted as the day's meter counts them (No Match and the
// Audit Trail's own lines aside); a rule never run is absent.
export function ruleStats(
  sql: Sql,
  now: number,
): Map<string, Pick<AutomationRuleStats, 'lastRunAt' | 'runsThisWeek'>> {
  const rows = sql
    .exec(
      `SELECT rule_id, MAX(at) AS last, SUM(CASE WHEN at >= ? THEN 1 ELSE 0 END) AS week
         FROM automation_runs WHERE result NOT IN ('${PENDING}', 'no_match') AND ${NO_LINE}
         GROUP BY rule_id`,
      now - WEEK_MS,
    )
    .toArray() as unknown as { rule_id: string; last: number; week: number }[];
  return new Map(
    rows.map((r) => [r.rule_id, { lastRunAt: Number(r.last), runsThisWeek: Number(r.week) }]),
  );
}

const RESULTS: ReadonlySet<string> = new Set<AutomationResult>([
  'done',
  'no_match',
  'skipped',
  'failed',
  'waiting',
]);

// The Audit Trail, newest first: by rule, result and since when, at most AUTOMATION_RUNS_LIST_MAX.
export function listRuns(sql: Sql, query: AutomationRunsQuery): AutomationRun[] {
  const where: string[] = [`result != '${PENDING}'`];
  const bindings: unknown[] = [];
  if (query.rule) {
    where.push('rule_id = ?');
    bindings.push(query.rule);
  }
  if (query.result && RESULTS.has(query.result)) {
    where.push('result = ?');
    bindings.push(query.result);
  }
  if (query.since !== undefined) {
    where.push('at >= ?');
    bindings.push(query.since);
  }
  // A whole number: SQLite refuses a LIMIT of 2.5 (datatype mismatch).
  const limit = Math.min(Math.max(1, Math.floor(query.limit ?? 50)), AUTOMATION_RUNS_LIST_MAX);
  const rows = sql
    .exec(
      `SELECT body FROM automation_runs WHERE ${where.join(' AND ')} ORDER BY at DESC, id LIMIT ?`,
      ...bindings,
      limit,
    )
    .toArray() as unknown as { body: string }[];
  const out: AutomationRun[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.body) as AutomationRun);
    } catch {
      // A row from a later release: left out.
    }
  }
  return out;
}
