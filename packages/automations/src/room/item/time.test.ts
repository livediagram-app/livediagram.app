import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemRun } from '../../item';
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import { listRuns } from '../automation-log';
import { AutomationTally } from '../automation-telemetry';
import { keptSnapshotIds } from './kept';
import { queued, rowsOf, world, type World } from './test-kit';
import { ITEM_TIME_RETRY_MS, TIME_MISSED, runItemTimeTriggers } from './time';
import { runItemAutomations } from './wake';

const DAY = 24 * 60 * 60 * 1000;
const at = (day: number, hour: number, minute = 0) => Date.UTC(2027, 0, day, hour, minute);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(4, 8));
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const runs = (w: World): ItemRun[] => listRuns<ItemRun>(w.sql, { limit: 200 });
const time = (w: World, now: number, tally?: AutomationTally) =>
  runItemTimeTriggers(w.engine.deps()!, w.engine.schedule, now, tally);
const nextAt = (w: World, id: string) =>
  rowsOf(w.sql, 'SELECT next_at FROM automation_schedule WHERE rule_id = ?', id)[0]?.['next_at'];

describe('Scheduled', () => {
  it('queues its moment once, moves on to the next, and runs with nobody behind it', async () => {
    const w = world();
    const rule = w.rule({
      trigger: { kind: 'scheduled', every: 'day', at: '09:00' },
      steps: [{ kind: 'take_snapshot', name: 'Daily {{person}}{{now.date}}' }],
    });
    expect(nextAt(w, rule.id)).toBe(at(4, 9));
    expect(w.engine.schedule.wakeAt).toBe(at(4, 9));
    vi.setSystemTime(at(4, 9));
    await runItemAutomations(w.engine, at(4, 9));
    expect(nextAt(w, rule.id)).toBe(at(5, 9));
    const [run] = runs(w);
    expect(run).toMatchObject({ result: 'done', subject: null });
    expect(run!.steps[0]).toEqual({ kind: 'trigger', text: 'Automation · Every Day at 9:00' });
    expect(w.taken[0]!.name).toBe('Daily 4 Jan 2027');
    // The same wake again queues nothing.
    expect(await time(w, at(4, 9))).toBe(0);
  });

  it('runs a moment under a day late once, and skips an older one, said on the Audit Trail', async () => {
    const w = world();
    const late = w.rule({ trigger: { kind: 'scheduled', every: 'week', days: [1], at: '09:00' } });
    const tally = new AutomationTally();
    // Monday 4 January, woken 23 hours late.
    expect(await time(w, at(5, 8), tally)).toBe(1);
    expect(queued(w.sql)).toEqual([
      { id: `t:${late.id}:${at(4, 9)}`, kind: 'time', at: at(4, 9), ruleId: late.id },
    ]);
    expect(nextAt(w, late.id)).toBe(at(11, 9));
    // The next Monday, woken two days late.
    expect(await time(w, at(13, 9), tally)).toBe(0);
    expect(runs(w)[0]).toMatchObject({
      id: `time:${late.id}:${at(11, 9)}`,
      result: 'skipped',
      reason: TIME_MISSED,
      subject: null,
    });
    expect(nextAt(w, late.id)).toBe(at(18, 9));
    expect(tally.size).toBe(1);
    expect(await time(w, at(20, 9))).toBe(0);
  });

  it('forgets a row whose rule is gone, off, or no time rule any more, and one with no next moment', async () => {
    const w = world();
    const off = w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    const never = w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    w.sql.exec("INSERT INTO automation_schedule (rule_id, next_at) VALUES ('gone', 1)");
    w.sql.exec(
      "UPDATE automation_rules SET body = json_set(body, '$.enabled', json('false')) WHERE id = ?",
      off.id,
    );
    // A stored trigger no day satisfies (never one the check accepts).
    w.sql.exec(
      `UPDATE automation_rules SET body = json_set(body, '$.trigger', json('{"kind":"scheduled","every":"week","days":[],"at":"09:00"}')) WHERE id = ?`,
      never.id,
    );
    await time(w, at(4, 10));
    expect(rowsOf(w.sql, 'SELECT * FROM automation_schedule')).toEqual([]);
    expect(w.engine.schedule.timeAt).toBeNull();
  });

  it('waits, its row still due, when the queue has no room', async () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_QUEUE_MAX})
       INSERT INTO automation_queue (event, at) SELECT '{}', 0 FROM n`,
    );
    expect(await time(w, at(4, 9))).toBe(0);
    expect(nextAt(w, rule.id)).toBe(at(4, 9));
    expect(w.engine.schedule.timeAt).toBe(at(4, 9) + ITEM_TIME_RETRY_MS);
  });
});

describe('Not Edited For', () => {
  const stale = (w: World) =>
    w.rule({
      trigger: { kind: 'not_edited', days: 2, at: '09:00' },
      steps: [{ kind: 'clear_box' }],
    });

  it('fires once each time the item goes that long untouched, by the edits the triggers stamped', async () => {
    const w = world();
    w.addTab('t1');
    const rule = stale(w);
    w.editTab('t1');
    w.sql.exec('UPDATE automation_edits SET at = ?', at(4, 8));
    expect(await time(w, at(4, 9))).toBe(0);
    expect(await time(w, at(5, 9))).toBe(0);
    expect(await time(w, at(6, 9))).toBe(1);
    expect(queued(w.sql)[0]).toMatchObject({
      id: `t:${rule.id}:${at(4, 8)}`,
      kind: 'time',
      ruleId: rule.id,
    });
    // Still untouched the next day: the same stretch, nothing more.
    expect(await time(w, at(7, 9))).toBe(0);
    expect(rowsOf(w.sql, 'SELECT id FROM automation_fired')).toHaveLength(1);
    // Edited, then stale again: a new stretch.
    w.sql.exec('UPDATE automation_edits SET at = ?', at(7, 10));
    expect(await time(w, at(8, 9))).toBe(0);
    expect(await time(w, at(10, 9))).toBe(1);
  });

  it('reads the app’s own last edit, else the rule’s own stamp, when no edit was stamped', async () => {
    const w = world();
    w.outline.editedAt = at(1, 0);
    stale(w);
    stale(w);
    // Read once for both rules.
    expect(await time(w, at(4, 9))).toBe(2);
    const fresh = world();
    const rule = stale(fresh);
    fresh.sql.exec(
      "UPDATE automation_rules SET body = json_set(body, '$.edited.at', ?) WHERE id = ?",
      at(4, 0),
      rule.id,
    );
    expect(await time(fresh, at(5, 9))).toBe(0);
    expect(await time(fresh, at(6, 9))).toBe(1);
    expect(at(6, 9) - at(4, 0)).toBeGreaterThan(2 * DAY);
  });
});

describe('kept snapshots', () => {
  it('are the ones the rules name, on or off', () => {
    const w = world();
    w.rule({ steps: [{ kind: 'revert_snapshot', snapshot: 's1' }] });
    w.rule({ steps: [{ kind: 'revert_snapshot', snapshot: 's2' }], enabled: false });
    w.rule({ steps: [{ kind: 'revert_snapshot', snapshot: 's1' }] });
    expect(keptSnapshotIds(w.engine.store)).toEqual(['s1', 's2']);
  });
});
