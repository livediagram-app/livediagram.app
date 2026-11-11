// The time triggers' wake (docs/specs/026-plan/automations.md "Time triggers"; blueprint automations.md "Phase 2",
// "The wake"). `automation_schedule` holds each time rule's next moment; on a wake past one, the rule's latest missed
// moment (never one more than a day late: @liveplanner/items latestMissed) picks the cards it runs on (timeCards,
// over the plan's cards read once for every due rule), queues one event per card for the runner, says in one Skipped
// row how many waited past 100, and moves the row on to the next moment. The events' ids come from the rule, the
// card and the moment (or the due date), so the runner's run ids make each once ever, however often a wake repeats.
// A rule whose cards don't fit in the queue now waits, its row still due, until the queue drains.
import {
  AUTOMATION_QUEUE_MAX,
  AUTOMATION_TIME_CARDS_MAX,
  automationPerson,
  isTimeTrigger,
  latestMissed,
  nextMoment,
  timeCards,
  type AutomationEvent,
  type Item,
} from '@liveplanner/items';
import { listItems } from '../../db/items';
import { readAutomationPlan, type AutomationPlan } from './automation-plan';
import { settleRun } from './automation-log';
import type { AutomationSchedule } from './automation-queue';
import type { RunnerDeps } from './automation-runner';

// A time rule left waiting for queue room tries again this soon.
export const AUTOMATION_TIME_RETRY_MS = 1000;

export const timeWaited = (ran: number, matched: number): string =>
  `Ran on ${ran} of ${matched} matching cards: the rest wait for the next time`;

type Row = { rule_id: string; next_at: number };

// The due rows, each rule's cards queued; answers how many events went in.
export async function runTimeTriggers(
  deps: RunnerDeps,
  schedule: AutomationSchedule,
  now: number,
): Promise<number> {
  const sql = deps.sql();
  const rows = sql
    .exec(
      'SELECT rule_id, next_at FROM automation_schedule WHERE next_at <= ? ORDER BY next_at',
      now,
    )
    .toArray() as unknown as Row[];
  const count = sql.exec('SELECT COUNT(*) AS n FROM automation_queue').toArray()[0];
  let room = AUTOMATION_QUEUE_MAX - Number(count?.['n'] ?? 0);
  let plan: AutomationPlan | null = null;
  let items: Item[] | null = null;
  let queued = 0;
  let waiting = false;
  for (const row of rows) {
    const rule = deps.store.get(row.rule_id);
    if (!rule || !rule.enabled || !isTimeTrigger(rule.trigger)) {
      sql.exec('DELETE FROM automation_schedule WHERE rule_id = ?', row.rule_id);
      continue;
    }
    const moment = latestMissed(rule.trigger, rule.timeZone, Number(row.next_at) - 1, now);
    if (moment !== null) {
      plan ??= await readAutomationPlan(deps.env, deps.planId);
      items ??= await listItems(deps.env, deps.planId);
      const by = automationPerson(rule.name);
      const found = timeCards({ ...rule, trigger: rule.trigger }, items, moment, {
        outline: plan.outline,
        by,
        role: 'system',
        timeZone: rule.timeZone,
        isDone: plan.isDone,
      });
      if (found.cards.length > room) {
        waiting = true;
        break;
      }
      const events: AutomationEvent[] = found.cards.map((c) => ({
        id: c.eventId,
        kind: 'time',
        cardId: c.card.id,
        by,
        role: 'system',
        ruleId: rule.id,
        at: moment,
      }));
      if (events.length)
        sql.exec(
          'INSERT INTO automation_queue (event, at) SELECT value, ? FROM json_each(?)',
          now,
          JSON.stringify(events.map((e) => JSON.stringify(e))),
        );
      room -= events.length;
      queued += events.length;
      if (found.matched > AUTOMATION_TIME_CARDS_MAX)
        settleRun(sql, {
          id: `time:${rule.id}:${moment}`,
          ruleId: rule.id,
          ruleName: rule.name,
          card: null,
          at: now,
          result: 'skipped',
          reason: timeWaited(found.cards.length, found.matched),
          tookMs: 0,
          steps: [],
        });
      console.info('[automations] time.queued', { cards: events.length, matched: found.matched });
    } else console.info('[automations] time.missed', { late: now - Number(row.next_at) });
    const next = nextMoment(rule.trigger, rule.timeZone, now);
    if (next === null) sql.exec('DELETE FROM automation_schedule WHERE rule_id = ?', rule.id);
    else sql.exec('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?', next, rule.id);
  }
  schedule.restoreTimes();
  if (waiting) {
    schedule.timeAt = now + AUTOMATION_TIME_RETRY_MS;
    console.info('[automations] time.waiting', { room });
  }
  if (queued > 0) schedule.queued(now);
  return queued;
}
