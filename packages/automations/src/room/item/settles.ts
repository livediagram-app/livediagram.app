// The settles that came due (blueprint item-engine.md "A wake"): each quiet stretch whose time is up queues one
// event for its rule and its row goes, so it fires once; only a later starting event writes the row again. Queue
// room is honoured: the rest wait for the next wake.
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { ITEM_SETTLED_EVENT, type ItemEvent } from '../../item';
import { isObj } from '../../validate-read';
import type { ItemSchedule } from './engine';
import type { ItemDeps } from './kit';

type Row = { rule_id: string; key: string; due_at: number; data: string };

function carriedOf(data: string): Partial<ItemEvent> {
  try {
    const read: unknown = JSON.parse(data);
    return isObj(read) ? read : {};
  } catch {
    return {};
  }
}

/** The due settles, each queued for its rule; answers how many went in. */
export function runItemSettles(deps: ItemDeps, schedule: ItemSchedule, now: number): number {
  const sql = deps.sql();
  const count = sql.exec('SELECT COUNT(*) AS n FROM automation_queue').toArray()[0]!;
  const room = AUTOMATION_QUEUE_MAX - Number(count['n']);
  let queued = 0;
  if (room > 0) {
    const rows = sql
      .exec(
        'SELECT rule_id, key, due_at, data FROM automation_settles WHERE due_at <= ? ORDER BY due_at LIMIT ?',
        now,
        room,
      )
      .toArray() as unknown as Row[];
    for (const row of rows) {
      sql.exec(
        'DELETE FROM automation_settles WHERE rule_id = ? AND key = ?',
        row.rule_id,
        row.key,
      );
      const rule = deps.store.get(row.rule_id);
      // Turned off or changed to another trigger since the quiet began: nothing runs.
      if (!rule?.enabled || !deps.kit.kinds.trigger(rule.trigger.kind)?.settle) continue;
      const event: ItemEvent = {
        ...carriedOf(row.data),
        id: `s:${row.rule_id}:${row.key}:${Number(row.due_at)}`,
        kind: ITEM_SETTLED_EVENT,
        at: now,
        ruleId: rule.id,
      };
      sql.exec(
        'INSERT INTO automation_queue (event, at) VALUES (?, ?)',
        JSON.stringify(event),
        now,
      );
      queued += 1;
    }
  }
  if (queued > 0) schedule.queued(now);
  schedule.poll(now);
  return queued;
}
