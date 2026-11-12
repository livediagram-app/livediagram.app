// The runs a Wait holds (docs/specs/026-plan/automations.md "Wait"; blueprint automations.md "Wait"). A run that
// reaches a Wait keeps what it did, settles as Waiting and is held in `automation_waiting` with the event that goes
// on with it; at most AUTOMATION_WAITING_RUNS_MAX a plan. The room's alarm wakes for the earliest (with the time
// triggers' moments, AutomationSchedule.restoreTimes): each due one whose rule is still on and unchanged queues its
// resume event, which runs the rule from the step after the Wait as a run of its own; one whose rule went or changed
// settles Skipped. Queue room is honoured: the rest wait for the next wake.
import {
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_WAITING_RUNS_MAX,
  type AutomationEvent,
} from '@liveplanner/items';
import { settleWaiting } from './automation-log';
import type { AutomationSchedule } from './automation-queue';
import type { RunnerDeps } from './automation-runner';
import type { Sql } from './automation-store';

export const WAIT_FULL = 'Too many runs are waiting in this plan';
export const WAIT_RULE_CHANGED = 'The rule changed while this run waited';
export const WAIT_CONDITIONS = 'Its conditions no longer hold after the wait';

const HOUR_MS = 60 * 60 * 1000;

// Holds a run at its Wait: when it goes on, or null when the plan holds as many waiting runs as it may.
export function holdRun(
  sql: Sql,
  runId: string,
  ruleId: string,
  event: AutomationEvent,
  edited: number,
  wait: { hours: number; from: number },
  now: number,
): number | null {
  const count = sql.exec('SELECT COUNT(*) AS n FROM automation_waiting').toArray()[0];
  if (Number(count?.['n'] ?? 0) >= AUTOMATION_WAITING_RUNS_MAX) return null;
  const until = now + wait.hours * HOUR_MS;
  const resume: AutomationEvent = {
    ...event,
    id: `w:${runId}`,
    kind: 'resume',
    ruleId,
    step: wait.from,
    edited,
    waited: (event.kind === 'resume' ? (event.waited ?? 0) : 0) + wait.hours,
    origin: runId,
  };
  sql.exec(
    'INSERT OR REPLACE INTO automation_waiting (id, rule_id, at, event) VALUES (?, ?, ?, ?)',
    runId,
    ruleId,
    until,
    JSON.stringify(resume),
  );
  return until;
}

type Row = { id: string; event: string };

// The due waiting runs, each queued to go on (or settled Skipped); answers how many went in.
export function runWaits(deps: RunnerDeps, schedule: AutomationSchedule, now: number): number {
  const sql = deps.sql();
  const count = sql.exec('SELECT COUNT(*) AS n FROM automation_queue').toArray()[0];
  const room = AUTOMATION_QUEUE_MAX - Number(count?.['n'] ?? 0);
  if (room <= 0) return 0;
  const rows = sql
    .exec('SELECT id, event FROM automation_waiting WHERE at <= ? ORDER BY at LIMIT ?', now, room)
    .toArray() as unknown as Row[];
  let queued = 0;
  for (const row of rows) {
    sql.exec('DELETE FROM automation_waiting WHERE id = ?', row.id);
    let event: AutomationEvent;
    try {
      event = JSON.parse(row.event) as AutomationEvent;
    } catch {
      settleWaiting(sql, row.id, 'skipped', WAIT_RULE_CHANGED);
      continue;
    }
    const rule = event.ruleId ? deps.store.get(event.ruleId) : undefined;
    if (!rule || !rule.enabled || rule.edited.at !== event.edited) {
      settleWaiting(sql, row.id, 'skipped', WAIT_RULE_CHANGED);
      continue;
    }
    sql.exec(
      'INSERT INTO automation_queue (event, at) VALUES (?, ?)',
      JSON.stringify({ ...event, at: now }),
      now,
    );
    queued += 1;
  }
  if (rows.length)
    console.info('[automations] waits.due', { queued, settled: rows.length - queued });
  if (queued > 0) schedule.queued(now);
  schedule.restoreTimes();
  return queued;
}
