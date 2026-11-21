// An item's Audit Trail on its own SQLite (liveworkspace/docs/specs/018-automations/automations.md "Runs, limits and
// loops"; blueprint engine.md "Tables"). A run's row goes in as `pending` before it does anything, under the run's
// id, so a second wake or a retry finds it and never runs it again; then it is settled with its result. Kept for 30
// days or the last 2,000 runs. Also each rule's figures for the Rules list and today's count (UTC), which is the
// daily budget. A run's body is stored as the app writes it: the log reads only its id, rule, moment and result.
import { AUTOMATION_LOG_MAX, AUTOMATION_LOG_MAX_AGE_MS } from '../limits';
import type {
  AutomationResult,
  AutomationRuleStats,
  AutomationRunShell,
  AutomationRunsQuery,
} from '../types';
import { countAiAsk } from './automation-ai';
import type { Sql } from './sql';

// What the log reads and rewrites of a run, whatever else an app's run holds.
export type StoredRun = Pick<
  AutomationRunShell<unknown, unknown>,
  'id' | 'ruleId' | 'at' | 'result'
> &
  Partial<Pick<AutomationRunShell<unknown, unknown>, 'reason' | 'gone' | 'waitsUntil'>>;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
export const AUTOMATION_RUNS_LIST_MAX = 200;
const PENDING = 'pending';

const utcMidnight = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

// The Audit Trail's own lines, which are no rule's run: a burst's "Too many changes at once", a time trigger's
// "Ran on 100 of 340" and the same for a trigger an app works out from another change. A run's id is a hash, so
// these prefixes never meet one.
export const burstLineId = (now: number): string => `burst:${now}`;
export const timeLineId = (ruleId: string, moment: number): string => `time:${ruleId}:${moment}`;
export const derivedLineId = (ruleId: string, moment: string): string =>
  `derived:${ruleId}:${moment}`;
// A rule's one line a UTC day saying the day's budget is spent, however many of its triggers came after.
export const budgetLineId = (ruleId: string, now: number): string =>
  `budget:${ruleId}:${utcMidnight(now)}`;
const NO_LINE =
  "id NOT LIKE 'burst:%' AND id NOT LIKE 'time:%' AND id NOT LIKE 'derived:%' AND id NOT LIKE 'budget:%'";

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

// A pending run's AI calls, `asked` of them, marked on its row as each is asked, before its answer comes, and the
// call counted against the day (automation-ai.ts countAiAsk) in the same breath, so it counts at once for a Run Rule,
// a Describe a Rule or another run asking meanwhile. The settled row's lines replace these, the same calls marked. A
// pending row's body is never listed.
export function markAiAsked(sql: Sql, id: string, asked: number, now: number = Date.now()): void {
  const steps = Array.from({ length: asked }, () => ({ ai: true }));
  sql.exec(
    `UPDATE automation_runs SET body = ? WHERE id = ? AND result = '${PENDING}'`,
    JSON.stringify({ steps }),
    id,
  );
  countAiAsk(sql, now);
}

// A claimed run that never started after all (a chain stop whose conditions did not hold): its row goes, so it
// counts against nothing.
export function dropRun(sql: Sql, id: string): void {
  sql.exec(`DELETE FROM automation_runs WHERE id = ? AND result = '${PENDING}'`, id);
}

// The run as it ended. A run that was never claimed (a burst's Skipped line) goes in whole.
export function settleRun<Run extends StoredRun>(sql: Sql, run: Run): void {
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

// One of the Audit Trail's own lines, written once: false when it is there already (a budget line said today).
export function noteLineOnce<Run extends StoredRun>(sql: Sql, run: Run): boolean {
  return (
    sql
      .exec(
        `INSERT OR IGNORE INTO automation_runs (id, rule_id, at, result, body) VALUES (?, ?, ?, ?, ?)
         RETURNING id`,
        run.id,
        run.ruleId,
        run.at,
        run.result,
        JSON.stringify(run),
      )
      .toArray().length > 0
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
  let run: StoredRun;
  try {
    run = JSON.parse(body) as StoredRun;
  } catch {
    return;
  }
  const { waitsUntil: _until, reason: _reason, gone: _gone, ...rest } = run;
  settleRun(sql, { ...rest, result, ...(reason ? { reason } : {}) });
}

// No Match rows kept, apart from the runs: however many there are, they never push a run out of the log.
export const AUTOMATION_NO_MATCH_LOG_MAX = 500;

// The rows past 30 days; then the newest 2,000 runs (done, failed, skipped) and, beside them, the newest 500 No Match
// rows, each kept apart so a busy rule that matches nothing never pushes a real run out. Every wake calls it, so it
// sorts only what is over: the age delete walks the `at` index, one read counts both kinds, and each cap's delete
// (a sort of the whole kind) runs only when its count is past the cap.
export function trimRuns(sql: Sql, now: number): void {
  sql.exec('DELETE FROM automation_runs WHERE at < ?', now - AUTOMATION_LOG_MAX_AGE_MS);
  const counts = sql
    .exec(
      `SELECT COUNT(*) AS n, (SELECT COUNT(*) FROM automation_runs WHERE result = 'no_match') AS misses
         FROM automation_runs`,
    )
    .toArray()[0]!; // A COUNT always answers its one row.
  const misses = Number(counts['misses']);
  const runs = Number(counts['n']) - misses;
  if (misses > AUTOMATION_NO_MATCH_LOG_MAX)
    sql.exec(
      `DELETE FROM automation_runs WHERE id IN
         (SELECT id FROM automation_runs WHERE result = 'no_match' ORDER BY at DESC, id LIMIT -1 OFFSET ?)`,
      AUTOMATION_NO_MATCH_LOG_MAX,
    );
  if (runs > AUTOMATION_LOG_MAX)
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
export function listRuns<Run extends StoredRun>(sql: Sql, query: AutomationRunsQuery): Run[] {
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
  const out: Run[] = [];
  for (const r of rows) {
    try {
      out.push(JSON.parse(r.body) as Run);
    } catch {
      // A row from a later release: left out.
    }
  }
  return out;
}
