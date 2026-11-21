// A wake that fails as a whole (liveworkspace/docs/specs/018-automations/automations.md "Runs, limits and loops";
// blueprint engine.md "Behaviour kept from liveplanner"). Each failure in a row waits longer before the next try (1,
// 2, 4 … minutes, an hour at most), counted in `automation_wake` so a restart keeps the count and the hold-off. The
// 12th in a row gives up: what would wake the room again at once (the queue, held runs whose Wait is over, settles
// that came due, time rules' past moments) is let go, one Audit Trail line says so, and the count starts again. The
// rules stay on; the next change or the next moment starts afresh. A wake that does its work clears the count.
import { settleRun, settleWaiting, stoppedLineId } from './automation-log';
import type { AutomationSchedule } from './automation-queue';
import type { Sql } from './sql';

export const WAKE_RETRY_MS = 60_000;
export const WAKE_RETRY_MAX_MS = 60 * 60_000;
export const WAKE_FAILURES_MAX = 12;
export const WAKE_GAVE_UP =
  'Automations stopped after repeated errors; they start again on the next change';

/** How long the `failures`th failed wake in a row waits before the next try. */
export const wakeRetryMs = (failures: number): number =>
  Math.min(WAKE_RETRY_MS * 2 ** (failures - 1), WAKE_RETRY_MAX_MS);

/** A wake that failed as a whole: counted, and the next try held off by the count. Answers the count. */
export function wakeFailed(sql: Sql, schedule: AutomationSchedule<unknown>, now: number): number {
  const row = sql
    .exec(
      `INSERT INTO automation_wake (id, failures, retry_at) VALUES (1, 1, 0)
       ON CONFLICT (id) DO UPDATE SET failures = failures + 1 RETURNING failures`,
    )
    .toArray()[0]!;
  const failures = Number(row['failures']);
  const retryAt = now + wakeRetryMs(failures);
  sql.exec('UPDATE automation_wake SET retry_at = ? WHERE id = 1', retryAt);
  schedule.failures = failures;
  schedule.retryAt = retryAt;
  return failures;
}

/** A wake that did its work: the count goes. No statement once the count is known to be none. */
export function wakeDone(sql: Sql, schedule: AutomationSchedule<unknown>): void {
  if (schedule.failures === 0) return;
  sql.exec('DELETE FROM automation_wake');
  schedule.failures = 0;
  schedule.retryAt = 0;
}

// What giving up asks of the app: its rules' store (to move past moments on), whether it has settles, and its
// Audit Trail line's own fields (`ruleName`, and `subject` or `card`).
export interface WakeGiveUp {
  store: { advanceDue(now: number): void };
  settles: boolean;
  line: Record<string, unknown>;
}

/** The 12th failed wake in a row: nothing that would wake the room again at once is left, the runs it held settle
 *  Skipped, one Audit Trail line says so, and the count starts again. */
export function giveUpWake(
  sql: Sql,
  schedule: AutomationSchedule<unknown>,
  now: number,
  app: WakeGiveUp,
): void {
  const queued = sql.exec('DELETE FROM automation_queue RETURNING event').toArray() as unknown as {
    event: string;
  }[];
  const held = (
    sql
      .exec('DELETE FROM automation_waiting WHERE at <= ? RETURNING id', now)
      .toArray() as unknown as { id: string }[]
  ).map((r) => r.id);
  // A run going on after its Wait was queued under its waiting run's id.
  for (const row of queued) {
    try {
      const origin: unknown = (JSON.parse(row.event) as { origin?: unknown }).origin;
      if (typeof origin === 'string') held.push(origin);
    } catch {
      // A damaged row holds no run.
    }
  }
  for (const id of held) settleWaiting(sql, id, 'skipped', WAKE_GAVE_UP);
  if (app.settles) sql.exec('DELETE FROM automation_settles WHERE due_at <= ?', now);
  app.store.advanceDue(now);
  settleRun(sql, {
    ruleId: '',
    tookMs: 0,
    steps: [],
    ...app.line,
    id: stoppedLineId(now),
    at: now,
    result: 'skipped',
    reason: WAKE_GAVE_UP,
  });
  sql.exec('DELETE FROM automation_wake');
  schedule.failures = 0;
  schedule.retryAt = 0;
  schedule.at = null;
  schedule.restoreTimes();
  console.warn('[automations] wake.gave_up', { queued: queued.length, held: held.length });
}
