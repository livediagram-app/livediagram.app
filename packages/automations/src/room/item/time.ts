// The time triggers' wake (liveworkspace/docs/specs/018-automations/automations.md "Triggers every app has", "Runs,
// limits and loops"; blueprint item-engine.md "A wake"). `automation_schedule` holds each time rule's next moment;
// on a wake past one, the rule's latest missed moment queues one event for it (under 24 hours late; older is skipped
// and said on the Audit Trail), and the row moves on. A kind that runs once per stretch (Not Edited For) answers the
// stretch's key, kept in `automation_fired` so the Audit Trail's trim never lets it run again. A rule with no room
// on the queue waits, its row still due.
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { ITEM_TIME_EVENT, type ItemEvent, type ItemRule } from '../../item';
import { latestMissed, nextMoment, type AutomationTimed } from '../../schedule';
import { firedIds, keepFired, trimFired } from '../automation-fired';
import { settleRun, timeLineId } from '../automation-log';
import type { AutomationTally } from '../automation-telemetry';
import type { ItemSchedule } from './engine';
import type { ItemDeps } from './kit';
import { ITEM_TELEMETRY_ACTION } from './telemetry';

// A time rule left waiting for queue room tries again this soon.
export const ITEM_TIME_RETRY_MS = 1000;
export const TIME_MISSED = 'Missed its time by more than a day, so it did not run';

type Row = { rule_id: string; next_at: number };

/** The due rows, each rule's moment queued; answers how many events went in. */
export async function runItemTimeTriggers(
  deps: ItemDeps,
  schedule: ItemSchedule,
  now: number,
  tally?: AutomationTally,
): Promise<number> {
  const sql = deps.sql();
  const { kit, store } = deps;
  const rows = sql
    .exec(
      'SELECT rule_id, next_at FROM automation_schedule WHERE next_at <= ? ORDER BY next_at',
      now,
    )
    .toArray() as unknown as Row[];
  const count = sql.exec('SELECT COUNT(*) AS n FROM automation_queue').toArray()[0]!;
  let room = AUTOMATION_QUEUE_MAX - Number(count['n']);
  // When the item was last edited, read once: the triggers' stamp, else the app's own, else the rule's.
  let edited: number | null | undefined;
  const editedAt = async (rule: ItemRule): Promise<number> => {
    if (edited === undefined) {
      const row = sql.exec('SELECT MAX(at) AS at FROM automation_edits').toArray()[0]!;
      edited = typeof row['at'] === 'number' ? row['at'] : ((await kit.outline()).editedAt ?? null);
    }
    return edited ?? rule.edited.at;
  };
  let queued = 0;
  let waiting = false;
  let kept = false;
  for (const row of rows) {
    const rule = store.get(row.rule_id);
    const def = rule ? kit.kinds.trigger(rule.trigger.kind) : undefined;
    if (!rule?.enabled || !def?.time) {
      sql.exec('DELETE FROM automation_schedule WHERE rule_id = ?', row.rule_id);
      continue;
    }
    const timed = rule.trigger as unknown as AutomationTimed;
    const moment = latestMissed(timed, rule.timeZone, Number(row.next_at) - 1, now);
    if (moment === null) {
      settleRun(sql, {
        id: timeLineId(rule.id, Number(row.next_at)),
        ruleId: rule.id,
        ruleName: rule.name,
        subject: null,
        at: now,
        result: 'skipped',
        reason: TIME_MISSED,
        tookMs: 0,
        steps: [],
      });
      console.info('[automations] time.missed', { late: now - Number(row.next_at) });
      tally?.track(kit.category, ITEM_TELEMETRY_ACTION, 'AutomationTimeMissed');
    } else {
      if (room <= 0) {
        waiting = true;
        break;
      }
      let id: string | null = `t:${rule.id}:${moment}`;
      if (def.due) {
        const key = def.due(rule.trigger, { moment, editedAt: await editedAt(rule) });
        id = key === null ? null : `t:${rule.id}:${key}`;
        if (id !== null && firedIds(sql, rule.id).has(id)) id = null;
        if (id !== null) {
          keepFired(sql, rule.id, [id], now);
          kept = true;
        }
      }
      if (id !== null) {
        const event: ItemEvent = { id, kind: ITEM_TIME_EVENT, at: moment, ruleId: rule.id };
        sql.exec(
          'INSERT INTO automation_queue (event, at) VALUES (?, ?)',
          JSON.stringify(event),
          now,
        );
        room -= 1;
        queued += 1;
      }
    }
    const next = nextMoment(timed, rule.timeZone, now);
    if (next === null) sql.exec('DELETE FROM automation_schedule WHERE rule_id = ?', rule.id);
    else sql.exec('UPDATE automation_schedule SET next_at = ? WHERE rule_id = ?', next, rule.id);
  }
  if (kept) trimFired(sql);
  schedule.restoreTimes();
  if (waiting) {
    schedule.timeAt = now + ITEM_TIME_RETRY_MS;
    console.info('[automations] time.waiting', { room });
  }
  if (queued > 0) schedule.queued(now);
  return queued;
}
