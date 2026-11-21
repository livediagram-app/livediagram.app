// An event into the item's queue, from an app's call site (liveworkspace/docs/specs/018-automations/automations.md
// "Where rules live and run": a write a rule hears queues its trigger in the same transaction; blueprint
// item-engine.md "Events in"). Nothing is built or written unless some rule that is on hears the kind: the check is
// one Set lookup. A kind that starts or calls off a settle touches `automation_settles`; a kind a rule hears
// straight goes on the queue while it has room.
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import type { ItemEvent } from '../../item';
import type { Sql } from '../sql';
import type { ItemHook, ItemSettler } from './engine';

// What a settle keeps of the event that started it, for the run it queues once quiet.
const carried = (event: ItemEvent): Pick<ItemEvent, 'tab' | 'by' | 'role' | 'data'> => ({
  ...(event.tab !== undefined ? { tab: event.tab } : {}),
  ...(event.by ? { by: event.by } : {}),
  ...(event.role ? { role: event.role } : {}),
  ...(event.data ? { data: event.data } : {}),
});

/** The settles `event` starts (or pushes back) and calls off. Answers whether any row changed. A rule's own change
 *  starts none of its own. */
export function touchSettles(
  sql: Sql,
  settlers: readonly ItemSettler[],
  event: ItemEvent,
): boolean {
  let touched = false;
  for (const { rule, def, settle } of settlers) {
    if (event.rule === rule.id) continue;
    if (settle.cancel?.includes(event.kind)) {
      sql.exec(
        'DELETE FROM automation_settles WHERE rule_id = ? AND key = ?',
        rule.id,
        settle.key(event, rule.trigger),
      );
      touched = true;
    } else if (settle.after.includes(event.kind) && def.matches(rule.trigger, event)) {
      sql.exec(
        `INSERT INTO automation_settles (rule_id, key, due_at, data) VALUES (?, ?, ?, ?)
         ON CONFLICT (rule_id, key) DO UPDATE SET due_at = excluded.due_at, data = excluded.data`,
        rule.id,
        settle.key(event, rule.trigger),
        event.at + settle.quietMs(rule.trigger),
        JSON.stringify(carried(event)),
      );
      touched = true;
    }
  }
  return touched;
}

/** Queues `event` if a rule hears it. Answers whether it went on the queue (false: nobody hears it straight, or
 *  the queue is full, which the next wake says once on the Audit Trail). */
export function queueItemEvent(sql: Sql, hook: ItemHook, event: ItemEvent): boolean {
  if (!hook.kinds.has(event.kind)) return false;
  if (touchSettles(sql, hook.settlers, event)) hook.settled();
  if (!hook.direct.has(event.kind)) return false;
  const queued =
    sql
      .exec(
        `INSERT INTO automation_queue (event, at)
         SELECT ?, ? WHERE (SELECT COUNT(*) FROM automation_queue) < ? RETURNING id`,
        JSON.stringify(event),
        event.at,
        AUTOMATION_QUEUE_MAX,
      )
      .toArray().length > 0;
  hook.queued(queued ? 0 : 1);
  return queued;
}
