import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_FAILURES_TO_PAUSE } from '../limits';
import { keepFired, firedIds } from './automation-fired';
import { settleRun } from './automation-log';
import { AutomationStore, type AutomationStoreKit } from './automation-store';
import { holdRun } from './automation-waits';
import { rowsOf, testRule, testSql, type TestRule } from './test-sql';

const kit: AutomationStoreKit<TestRule, 'tab' | 'time' | 'incoming'> = {
  hears: (rule) =>
    rule.trigger.kind === 'scheduled'
      ? ['time']
      : rule.trigger.kind === 'incoming_webhook'
        ? ['incoming']
        : ['tab'],
  nextAt: (rule, now) => (rule.trigger.kind === 'scheduled' ? now + 1000 : null),
};

function world(ready = true) {
  const sql = testSql();
  const store = new AutomationStore(
    () => sql,
    () => ready,
    kit,
  );
  return { sql, store };
}

afterEach(() => vi.restoreAllMocks());

describe('an item’s rules', () => {
  it('reads nothing from an item with no tables yet', () => {
    const { store } = world(false);
    store.load();
    expect(store.list()).toEqual([]);
    expect(store.nextAts()).toEqual(new Map());
    expect(store.kinds.size).toBe(0);
  });

  it('keeps rules in the list’s order, and the kinds those that are on hear', () => {
    const { sql, store } = world();
    store.insert(testRule('a'));
    store.insert(testRule('b', { enabled: false, trigger: { kind: 'scheduled' } }));
    store.insert(testRule('c', { trigger: { kind: 'incoming_webhook' } }));
    expect(store.list().map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(store.enabled().map((r) => r.id)).toEqual(['a', 'c']);
    expect([...store.kinds].sort()).toEqual(['incoming', 'tab']);
    expect(store.count()).toBe(3);
    expect(store.get('b')?.name).toBe('Rule b');
    expect(store.get('nope')).toBeNull();
    // A body from a later release reads as no rule.
    sql.exec("UPDATE automation_rules SET body = 'not json' WHERE id = 'a'");
    expect(store.get('a')).toBeNull();
    expect(store.list().map((r) => r.id)).toEqual(['b', 'c']);
    expect(store.enabled().map((r) => r.id)).toEqual(['c']);
  });

  it('reorders the list only when every rule is named once', () => {
    const { store } = world();
    for (const id of ['a', 'b', 'c']) store.insert(testRule(id));
    expect(store.order(['c', 'a', 'b'])).toBe(true);
    expect(store.list().map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(store.order(['a', 'b'])).toBe(false);
    expect(store.order(['a', 'a', 'b'])).toBe(false);
    expect(store.order(['a', 'b', 'x'])).toBe(false);
  });

  it('schedules a time rule that is on, and tells the room when the schedule changed', () => {
    const { sql, store } = world();
    const changed = vi.fn();
    store.onSchedule = changed;
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    store.insert(testRule('t', { trigger: { kind: 'scheduled' } }));
    expect(store.nextAts()).toEqual(new Map([['t', 6000]]));
    expect(changed).toHaveBeenCalledTimes(1);
    vi.spyOn(Date, 'now').mockReturnValue(9000);
    store.update(testRule('t', { trigger: { kind: 'scheduled' } }));
    expect(store.nextAts().get('t')).toBe(10000);
    store.update(testRule('t', { trigger: { kind: 'scheduled' }, enabled: false }));
    expect(rowsOf(sql, 'SELECT * FROM automation_schedule')).toEqual([]);
  });

  it('drops a rule’s secret once its trigger is no Incoming Webhook, and what it ran on once its trigger changes', () => {
    const { sql, store } = world();
    const hook =
      "INSERT INTO automation_hooks (rule_id, hash, last4, made_at) VALUES (?, 'h', 'abcd', 1)";
    store.insert(testRule('w', { trigger: { kind: 'incoming_webhook' } }));
    sql.exec(hook, 'w');
    keepFired(sql, 'w', ['d:1'], 1);
    store.update(testRule('w', { trigger: { kind: 'incoming_webhook' }, name: 'Renamed' }));
    expect(rowsOf(sql, 'SELECT rule_id FROM automation_hooks')).toHaveLength(1);
    expect(firedIds(sql, 'w').size).toBe(1);
    store.update(testRule('w', { trigger: { kind: 'tab_added' } }));
    expect(rowsOf(sql, 'SELECT rule_id FROM automation_hooks')).toEqual([]);
    expect(firedIds(sql, 'w').size).toBe(0);
  });

  it('removes a rule with its schedule, its secret and what it ran on', () => {
    const { sql, store } = world();
    store.insert(testRule('t', { trigger: { kind: 'scheduled' } }));
    keepFired(sql, 't', ['d:1'], 1);
    expect(store.remove('t')).toBe(true);
    expect(store.remove('t')).toBe(false);
    expect(store.nextAts().size).toBe(0);
    expect(firedIds(sql, 't').size).toBe(0);
    expect(store.kinds.size).toBe(0);
  });

  it('settles a rule’s waiting runs as Skipped when it is turned off or edited, never on a plain save', () => {
    const { sql, store } = world();
    const waiting = () => rowsOf(sql, 'SELECT id FROM automation_waiting').length;
    const hold = (runId: string) => {
      settleRun(sql, { id: runId, ruleId: 'a', at: 1, result: 'waiting' });
      holdRun(sql, runId, 'a', { id: 'e', kind: 'tab', at: 1 }, 1, { hours: 1, from: 1 }, 0);
    };
    store.insert(testRule('a'));
    hold('run1');
    store.update(testRule('a'));
    expect(waiting()).toBe(1);
    store.update(testRule('a', { edited: { at: 2 } }));
    expect(waiting()).toBe(0);
    expect(rowsOf(sql, "SELECT result FROM automation_runs WHERE id = 'run1'")[0]?.['result']).toBe(
      'skipped',
    );
    hold('run2');
    store.update(testRule('a', { edited: { at: 2 }, enabled: false }));
    expect(waiting()).toBe(0);
  });
});

describe('turns', () => {
  it('counts the stored place and the turns runs under way have taken', () => {
    const { store } = world();
    store.insert(testRule('a'));
    expect(store.turn('a')).toBe(0);
    expect(store.turn('missing')).toBe(0);
    store.take('a', 2);
    store.take('a', 0);
    expect(store.turn('a')).toBe(2);
    store.giveBack('a', 1);
    expect(store.turn('a')).toBe(1);
    store.giveBack('a', 0);
    store.giveBack('a', 1);
    expect(store.turn('a')).toBe(0);
    // A rule that took none gives none back.
    store.giveBack('never', 1);
    expect(store.turn('never')).toBe(0);
    store.advanceTurn('a', 3);
    store.advanceTurn('a', 0);
    expect(store.turn('a')).toBe(3);
  });
});

describe('a run’s result on its rule', () => {
  it('counts failures in a row, cleared by a done run', () => {
    const { store } = world();
    store.insert(testRule('a'));
    expect(store.settle('missing', 'failed', 'x', 1)).toBe(false);
    expect(store.settle('a', 'done', '', 1)).toBe(false);
    expect(store.settle('a', 'failed', 'x', 1)).toBe(false);
    expect(store.failures('a')).toBe(1);
    expect(store.failures('missing')).toBe(0);
    expect(store.settle('a', 'done', '', 1)).toBe(false);
    expect(store.failures('a')).toBe(0);
  });

  it('pauses the rule on its tenth failure in a row, with the reason and what it names', () => {
    const { store } = world();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    store.insert(testRule('a'));
    for (let i = 1; i < AUTOMATION_FAILURES_TO_PAUSE; i += 1)
      expect(store.settle('a', 'failed', 'x', i)).toBe(false);
    expect(store.settle('a', 'failed', 'The connection is paused', 99, { webhook: 'wh_1' })).toBe(
      true,
    );
    expect(store.get('a')).toMatchObject({
      enabled: false,
      paused: { reason: 'The connection is paused', at: 99, webhook: 'wh_1' },
    });
    // A rule that is off already only counts.
    expect(store.settle('a', 'failed', 'x', 100)).toBe(false);
    expect(store.failures('a')).toBe(AUTOMATION_FAILURES_TO_PAUSE + 1);
  });
});

describe('a count that reads no row', () => {
  it('counts as none', () => {
    const empty = { exec: () => ({ toArray: () => [] }) } as never;
    const store = new AutomationStore(
      () => empty,
      () => true,
      kit,
    );
    expect(store.count()).toBe(0);
    expect(store.turn('a')).toBe(0);
  });
});
