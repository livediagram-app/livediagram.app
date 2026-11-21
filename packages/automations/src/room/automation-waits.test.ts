import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_QUEUE_MAX, AUTOMATION_WAITING_RUNS_MAX } from '../limits';
import { listRuns, settleRun } from './automation-log';
import {
  WAIT_CONDITIONS,
  WAIT_RULE_CHANGED,
  holdRun,
  runWaits,
  stopWaits,
  waitFullWords,
  type ResumableEvent,
} from './automation-waits';
import { rowsOf, testSql } from './test-sql';

const HOUR = 60 * 60 * 1000;
const event: ResumableEvent & { tab: string } = { id: 'e1', kind: 'tab', at: 5, tab: 't1' };

afterEach(() => vi.restoreAllMocks());

function world() {
  const sql = testSql();
  const rules = new Map([['r1', { enabled: true, edited: { at: 7 } }]]);
  const schedule = { queued: vi.fn(() => true), restoreTimes: vi.fn() };
  const deps = { sql: () => sql, store: { get: (id: string) => rules.get(id) ?? null }, more: 1 };
  const waitingRun = (id: string) => settleRun(sql, { id, ruleId: 'r1', at: 1, result: 'waiting' });
  const queued = () =>
    rowsOf(sql, 'SELECT event, at FROM automation_queue ORDER BY id').map((r) => ({
      event: JSON.parse(r['event'] as string) as ResumableEvent,
      at: r['at'],
    }));
  return { sql, rules, schedule, deps, waitingRun, queued };
}

describe('holding a run at its Wait', () => {
  it('keeps the event that goes on with it, and says when', () => {
    const { sql } = world();
    expect(holdRun(sql, 'run1', 'r1', event, 7, { hours: 2, from: 3 }, 1000)).toBe(1000 + 2 * HOUR);
    const row = rowsOf(sql, 'SELECT * FROM automation_waiting')[0]!;
    expect(row).toMatchObject({ id: 'run1', rule_id: 'r1', at: 1000 + 2 * HOUR });
    expect(JSON.parse(row['event'] as string)).toEqual({
      ...event,
      id: 'w:run1',
      kind: 'resume',
      ruleId: 'r1',
      step: 3,
      edited: 7,
      waited: 2,
      origin: 'run1',
    });
  });

  it('adds up the hours of a run that waits again', () => {
    const { sql } = world();
    holdRun(
      sql,
      'run2',
      'r1',
      { ...event, kind: 'resume', waited: 2 },
      7,
      { hours: 3, from: 5 },
      0,
    );
    holdRun(sql, 'run3', 'r1', { ...event, kind: 'resume' }, 7, { hours: 3, from: 5 }, 0);
    const waited = rowsOf(sql, 'SELECT event FROM automation_waiting ORDER BY id').map(
      (r) => (JSON.parse(r['event'] as string) as ResumableEvent).waited,
    );
    expect(waited).toEqual([5, 3]);
  });

  it('holds no more than the item may', () => {
    const { sql } = world();
    sql.exec(
      `INSERT INTO automation_waiting (id, rule_id, at, event)
       SELECT 'r' || value, 'r1', 1, '{}' FROM json_each(?)`,
      JSON.stringify(Array.from({ length: AUTOMATION_WAITING_RUNS_MAX }, (_, i) => i)),
    );
    expect(holdRun(sql, 'run1', 'r1', event, 7, { hours: 1, from: 1 }, 0)).toBeNull();
    expect(waitFullWords('design')).toBe('Too many runs are waiting in this design');
    expect(WAIT_CONDITIONS).toContain('no longer hold');
  });
});

describe('a rule that changed', () => {
  it('settles its waiting runs Skipped at once', () => {
    const { sql, waitingRun } = world();
    waitingRun('run1');
    holdRun(sql, 'run1', 'r1', event, 7, { hours: 1, from: 1 }, 0);
    holdRun(sql, 'other', 'r2', event, 7, { hours: 1, from: 1 }, 0);
    stopWaits(sql, 'r1');
    expect(rowsOf(sql, 'SELECT id FROM automation_waiting')).toEqual([{ id: 'other' }]);
    expect(listRuns(sql, {})).toMatchObject([{ result: 'skipped', reason: WAIT_RULE_CHANGED }]);
  });
});

describe('the wake', () => {
  it('queues each due run to go on, and leaves the rest waiting', () => {
    const { sql, deps, schedule, queued } = world();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    holdRun(sql, 'due', 'r1', event, 7, { hours: 1, from: 2 }, 0);
    holdRun(sql, 'later', 'r1', event, 7, { hours: 5, from: 2 }, 0);
    expect(runWaits(deps, schedule, 2 * HOUR)).toBe(1);
    expect(queued()).toMatchObject([
      { event: { id: 'w:due', kind: 'resume', at: 2 * HOUR }, at: 2 * HOUR },
    ]);
    expect(rowsOf(sql, 'SELECT id FROM automation_waiting')).toEqual([{ id: 'later' }]);
    expect(schedule.queued).toHaveBeenCalledWith(2 * HOUR);
    expect(schedule.restoreTimes).toHaveBeenCalled();
  });

  it('settles Skipped a run whose rule went, was turned off or edited, or whose event cannot be read', () => {
    const { sql, deps, rules, schedule, waitingRun, queued } = world();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    for (const id of ['gone', 'off', 'edited', 'damaged', 'ruleless']) waitingRun(id);
    rules.set('r2', { enabled: false, edited: { at: 7 } });
    holdRun(sql, 'gone', 'r9', event, 7, { hours: 1, from: 2 }, 0);
    holdRun(sql, 'off', 'r2', event, 7, { hours: 1, from: 2 }, 0);
    holdRun(sql, 'edited', 'r1', event, 6, { hours: 1, from: 2 }, 0);
    sql.exec(
      "INSERT INTO automation_waiting (id, rule_id, at, event) VALUES ('damaged', 'r1', 1, 'x')",
    );
    sql.exec(
      "INSERT INTO automation_waiting (id, rule_id, at, event) VALUES ('ruleless', 'r1', 1, '{}')",
    );
    expect(runWaits(deps, schedule, 2 * HOUR)).toBe(0);
    expect(queued()).toEqual([]);
    expect(schedule.queued).not.toHaveBeenCalled();
    expect(listRuns(sql, { result: 'skipped' })).toHaveLength(5);
  });

  it('honours the queue’s room, and does nothing with none', () => {
    const { sql, deps, schedule } = world();
    holdRun(sql, 'due', 'r1', event, 7, { hours: 1, from: 2 }, 0);
    sql.exec(
      `INSERT INTO automation_queue (event, at) SELECT '{}', 1 FROM json_each(?)`,
      JSON.stringify(Array.from({ length: AUTOMATION_QUEUE_MAX }, () => 0)),
    );
    expect(runWaits(deps, schedule, 2 * HOUR)).toBe(0);
    expect(schedule.restoreTimes).not.toHaveBeenCalled();
    expect(rowsOf(sql, 'SELECT id FROM automation_waiting')).toHaveLength(1);
  });

  it('asks the schedule again even when nothing was due', () => {
    const { deps, schedule } = world();
    expect(runWaits(deps, schedule, 1)).toBe(0);
    expect(schedule.restoreTimes).toHaveBeenCalledTimes(1);
  });
});

describe('a count that reads no row', () => {
  it('counts as none: the run is held, and the queue has room', () => {
    const empty = { exec: () => ({ toArray: () => [] }) } as never;
    expect(holdRun(empty, 'run1', 'r1', event, 7, { hours: 1, from: 1 }, 0)).toBe(HOUR);
    const schedule = { queued: vi.fn(() => true), restoreTimes: vi.fn() };
    expect(runWaits({ sql: () => empty, store: { get: () => null } }, schedule, 1)).toBe(0);
  });
});
