import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutomationSchedule, ItemAutomations } from './automation-queue';
import { rowsOf, testRule, testSql, type TestRule } from './test-sql';

afterEach(() => vi.restoreAllMocks());

const enqueue = (sql: ReturnType<typeof testSql>, event: string, at = 1) =>
  sql.exec('INSERT INTO automation_queue (event, at) VALUES (?, ?)', event, at);

describe('the wake', () => {
  it('asks for nothing from an item with no tables yet', () => {
    const sql = testSql();
    const schedule = new AutomationSchedule(
      () => sql,
      () => false,
    );
    schedule.timeAt = 5;
    schedule.restore(10);
    expect(schedule.waiting()).toBe(false);
    expect(schedule.wakeAt).toBeNull();
    expect(schedule.due(10)).toBe(false);
  });

  it('wakes now while a trigger waits, and at the earliest time moment or waiting run', () => {
    const sql = testSql();
    const schedule = new AutomationSchedule<{ kind: string }>(
      () => sql,
      () => true,
    );
    schedule.restore(100);
    expect(schedule.wakeAt).toBeNull();
    sql.exec("INSERT INTO automation_schedule (rule_id, next_at) VALUES ('a', 900), ('b', 700)");
    sql.exec(
      "INSERT INTO automation_waiting (id, rule_id, at, event) VALUES ('r', 'a', 500, '{}')",
    );
    schedule.restore(100);
    expect(schedule.timeAt).toBe(500);
    expect(schedule.wakeAt).toBe(500);
    expect(schedule.timeDue(499)).toBe(false);
    expect(schedule.timeDue(500)).toBe(true);
    enqueue(sql, JSON.stringify({ kind: 'tab' }));
    schedule.restore(100);
    expect(schedule.wakeAt).toBe(100);
    expect(schedule.queueDue(100)).toBe(true);
    expect(schedule.due(100)).toBe(true);
    schedule.timeAt = null;
    expect(schedule.wakeAt).toBe(100);
    schedule.timeAt = 50;
    expect(schedule.wakeAt).toBe(50);
  });

  it('arms once for queued events, until that wake has passed', () => {
    const sql = testSql();
    const schedule = new AutomationSchedule(
      () => sql,
      () => true,
    );
    expect(schedule.queued(100)).toBe(true);
    expect(schedule.queued(100)).toBe(false);
    expect(schedule.queued(50)).toBe(true);
    schedule.dropped = 3;
    schedule.clear();
    expect([schedule.at, schedule.timeAt, schedule.dropped]).toEqual([null, null, 0]);
  });

  it('hands out the oldest triggers, a damaged one as none, and forgets a done one', () => {
    const sql = testSql();
    const schedule = new AutomationSchedule<{ kind: string }>(
      () => sql,
      () => true,
    );
    enqueue(sql, JSON.stringify({ kind: 'first' }));
    enqueue(sql, 'not json');
    enqueue(sql, JSON.stringify({ kind: 'third' }));
    const next = schedule.next(2);
    expect(next.map((n) => n.event)).toEqual([{ kind: 'first' }, null]);
    schedule.done(next[0]!.id);
    expect(schedule.next(5).map((n) => n.event)).toEqual([null, { kind: 'third' }]);
  });
});

describe('an item’s Automations', () => {
  function world(putAway = false) {
    const sql = testSql();
    const arm = vi.fn();
    const state = { putAway };
    const automations = new ItemAutomations<
      TestRule,
      'tab' | 'time',
      { kind: string },
      { n: number }
    >({
      sql: () => sql,
      ready: () => true,
      arm,
      deps: () => ({ n: 1 }),
      putAway: () => state.putAway,
      kit: {
        hears: () => ['tab'],
        nextAt: (rule, now) => (rule.trigger.kind === 'scheduled' ? now + 10 : null),
      },
    });
    return { sql, arm, state, automations };
  }

  it('hears what its rules hear, and nothing while it is put away', () => {
    const { automations, state } = world();
    automations.store.insert(testRule('a'));
    expect([...automations.kinds]).toEqual(['tab']);
    state.putAway = true;
    expect(automations.kinds.size).toBe(0);
    expect(automations.deps()).toEqual({ n: 1 });
    expect(automations.sql()).toBeDefined();
  });

  it('arms the alarm when a rule write moves the schedule, and when events are queued', () => {
    const { automations, arm } = world();
    automations.store.insert(testRule('t', { trigger: { kind: 'scheduled' } }));
    expect(arm).toHaveBeenCalledTimes(1);
    expect(automations.schedule.timeAt).not.toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    automations.queued(0);
    automations.queued(0);
    expect(arm).toHaveBeenCalledTimes(2);
  });

  it('counts what the queue had no room for', () => {
    const { automations } = world();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    automations.queued(2);
    expect(automations.schedule.dropped).toBe(2);
    expect(warn).toHaveBeenCalledWith('[automations] queue.full', { dropped: 2 });
  });

  it('restores from what is stored, reads its schedule as empty while put away, and clears', () => {
    const { sql, automations, state } = world();
    automations.store.insert(testRule('t', { trigger: { kind: 'scheduled' } }));
    sql.exec("INSERT INTO automation_queue (event, at) VALUES ('{}', 1)");
    automations.store.kinds.clear();
    automations.restore(500);
    expect(automations.kinds.size).toBe(1);
    expect(automations.schedule.at).toBe(500);
    state.putAway = true;
    automations.restore(500);
    expect(automations.schedule.wakeAt).toBeNull();
    automations.clear();
    expect(automations.store.kinds.size).toBe(0);
    expect(rowsOf(sql, 'SELECT id FROM automation_rules')).toHaveLength(1);
  });

  it('is never put away unless its room says so', () => {
    const sql = testSql();
    const automations = new ItemAutomations<TestRule>({
      sql: () => sql,
      ready: () => true,
      arm: () => {},
      deps: () => null,
      kit: { hears: () => ['tab'], nextAt: () => null },
    });
    automations.store.insert(testRule('a'));
    expect([...automations.kinds]).toEqual(['tab']);
  });
});
