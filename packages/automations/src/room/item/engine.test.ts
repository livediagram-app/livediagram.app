import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_QUEUE_MAX } from '../../limits';
import type { ItemEvent, ItemRule } from '../../item';
import { ItemSchedule, itemStoreKit } from './engine';
import { queueItemEvent, touchSettles } from './intake';
import { runItemSettles } from './settles';
import { ANA, TEST_KINDS, itemSql, queued, rowsOf, world } from './test-kit';

afterEach(() => vi.restoreAllMocks());

const event = (over: Partial<ItemEvent>): ItemEvent => ({
  id: 'e1',
  kind: 'joined',
  at: 1000,
  ...over,
});

describe('the store’s kit', () => {
  const kit = itemStoreKit(TEST_KINDS);
  const rule = (trigger: ItemRule['trigger']) => ({ trigger, timeZone: 'UTC' }) as ItemRule;

  it('hears a trigger’s own kinds and its settle’s, and nothing for a kind it lacks', () => {
    expect(kit.hears(rule({ kind: 'joined' }))).toEqual(['joined']);
    expect(kit.hears(rule({ kind: 'everyone_left', minutes: 5 }))).toEqual(['left', 'arrived']);
    expect(kit.hears(rule({ kind: 'edited', minutes: 5 }))).toEqual(['edit']);
    expect(kit.hears(rule({ kind: 'gone_kind' }))).toEqual([]);
  });

  it('gives a time trigger its next moment, and any other none', () => {
    const now = Date.UTC(2026, 0, 5, 8, 0);
    expect(kit.nextAt(rule({ kind: 'scheduled', every: 'day', at: '09:00' }), now)).toBe(
      Date.UTC(2026, 0, 5, 9, 0),
    );
    expect(kit.nextAt(rule({ kind: 'joined' }), now)).toBeNull();
    expect(kit.nextAt(rule({ kind: 'gone_kind' }), now)).toBeNull();
  });
});

describe('the holder', () => {
  it('keeps the triggers’ tables in step with the rules that are on', () => {
    const w = world();
    const added = w.rule({ trigger: { kind: 'tab_added' } });
    const quiet = w.rule({ trigger: { kind: 'edited', minutes: 5, tab: 't1' } });
    w.rule({ trigger: { kind: 'edited', minutes: 30 }, enabled: false });
    w.rule({ trigger: { kind: 'gone_kind' } });
    const hears = () => rowsOf(w.sql, 'SELECT kind FROM automation_hears ORDER BY kind');
    expect(hears()).toEqual([{ kind: 'edit' }, { kind: 'tab_added' }]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_quiet')).toEqual([
      { rule_id: quiet.id, quiet_ms: 300_000, tab: 't1' },
    ]);
    expect(w.engine.settlers.map((s) => s.rule.id)).toEqual([quiet.id]);
    expect([...w.engine.direct]).toEqual(['tab_added']);
    expect(w.armed.count).toBeGreaterThan(0);
    w.engine.store.remove(added.id);
    expect(hears()).toEqual([{ kind: 'edit' }]);
    // A quiet stretch under way goes with its rule.
    w.addTab('t1');
    w.editTab('t1');
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toHaveLength(1);
    w.engine.store.remove(quiet.id);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
    expect(hears()).toEqual([]);
  });

  it('hears nothing while put away, and again once brought back', () => {
    const w = world();
    w.rule({ trigger: { kind: 'tab_added' } });
    w.state.putAway = true;
    w.engine.sync();
    w.addTab('t1');
    expect(queued(w.sql)).toEqual([]);
    expect(w.engine.kinds.size).toBe(0);
    expect(w.engine.schedule.wakeAt).toBeNull();
    w.state.putAway = false;
    w.engine.sync();
    w.addTab('t2');
    expect(queued(w.sql).map((e) => e.tab)).toEqual(['t2']);
  });

  it('rebuilds from what is stored on wake, and reads nothing before the schema exists', () => {
    const w = world();
    w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    w.engine.settlers = [];
    w.engine.restore(5000);
    expect(w.engine.settlers).toHaveLength(1);
    w.state.ready = false;
    w.engine.restore(5000);
    w.engine.sync();
    expect(w.engine.settlers).toEqual([]);
    expect(w.engine.deps()).toBeNull();
    w.state.ready = true;
    w.state.held = false;
    expect(w.engine.deps()).toBeNull();
  });

  it('hands a run the kit, the SQL, the rules and a way to ask the alarm again', () => {
    const w = world();
    const deps = w.engine.deps()!;
    expect(deps.kit).toBe(w.kit);
    expect(deps.sql()).toBe(w.sql);
    expect(deps.store).toBe(w.engine.store);
    const armed = w.armed.count;
    deps.wake();
    expect(w.armed.count).toBe(armed + 1);
  });
});

describe('the wake', () => {
  it('reads what the SQL triggers wrote only while a rule hears a SQL-fed kind', () => {
    const w = world();
    const { schedule } = w.engine;
    w.rule({ trigger: { kind: 'joined' } });
    const exec = vi.spyOn(w.sql, 'exec');
    expect(schedule.wakeAt).toBeNull();
    expect(exec).not.toHaveBeenCalled();
    w.rule({ trigger: { kind: 'tab_added' } });
    w.rule({ trigger: { kind: 'edited', minutes: 5 } });
    w.addTab('t1');
    exec.mockClear();
    const now = Date.now();
    // One statement finds both the queued tab and the settle.
    expect(schedule.wakeAt).toBeLessThanOrEqual(Date.now());
    expect(exec).toHaveBeenCalledTimes(1);
    expect(schedule.settleAt).toBeGreaterThanOrEqual(now + 5 * 60_000 - 1000);
    expect(schedule.due(Date.now())).toBe(true);
    expect(schedule.settleDue(Date.now())).toBe(false);
    expect(schedule.settleDue(Date.now() + 6 * 60_000)).toBe(true);
  });

  it('takes the settle’s time when nothing else waits, and the earlier of the two otherwise', () => {
    const sql = itemSql();
    const schedule = new ItemSchedule(
      () => sql,
      () => true,
      () => true,
    );
    expect(schedule.wakeAt).toBeNull();
    expect(schedule.due(1)).toBe(false);
    sql.exec("INSERT INTO automation_settles VALUES ('r1', '', 5000, '{}')");
    expect(schedule.wakeAt).toBe(5000);
    schedule.timeAt = 9000;
    expect(schedule.wakeAt).toBe(5000);
    schedule.timeAt = 2000;
    expect(schedule.wakeAt).toBe(2000);
    // A failed wake's hold-off pushes every settle back.
    schedule.settleHold = 7000;
    schedule.timeAt = null;
    expect(schedule.wakeAt).toBe(7000);
    schedule.clear();
    expect(schedule.settleAt).toBeNull();
    expect(schedule.settleHold).toBe(0);
  });

  it('asks nothing of an item that is not awake', () => {
    const sql = itemSql(false);
    const schedule = new ItemSchedule(
      () => sql,
      () => false,
      () => true,
    );
    schedule.settleAt = 5;
    expect(schedule.wakeAt).toBeNull();
  });
});

describe('events in', () => {
  it('costs nothing when no rule hears the kind', () => {
    const w = world();
    const exec = vi.spyOn(w.sql, 'exec');
    expect(queueItemEvent(w.sql, w.engine, event({}))).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it('queues an event a rule hears straight, and asks for a wake', () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    const armed = w.armed.count;
    expect(queueItemEvent(w.sql, w.engine, event({ by: ANA }))).toBe(true);
    expect(queued(w.sql)).toEqual([event({ by: ANA })]);
    expect(w.armed.count).toBe(armed + 1);
    expect(w.engine.schedule.at).not.toBeNull();
  });

  it('drops an event past the queue’s room, and says so', () => {
    const w = world();
    w.rule({ trigger: { kind: 'joined' } });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_QUEUE_MAX})
       INSERT INTO automation_queue (event, at) SELECT '{}', 0 FROM n`,
    );
    expect(queueItemEvent(w.sql, w.engine, event({}))).toBe(false);
    expect(w.engine.schedule.dropped).toBe(1);
  });

  it('starts, pushes back and calls off a settle, without queueing its starting event', () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const armed = w.armed.count;
    expect(
      queueItemEvent(
        w.sql,
        w.engine,
        event({ kind: 'left', tab: 't1', by: ANA, role: 'editor', data: { n: 2 } }),
      ),
    ).toBe(false);
    expect(queued(w.sql)).toEqual([]);
    expect(w.armed.count).toBe(armed + 1);
    const rows = () => rowsOf(w.sql, 'SELECT rule_id, key, due_at, data FROM automation_settles');
    expect(rows()).toEqual([
      {
        rule_id: rule.id,
        key: 't1',
        due_at: 1000 + 300_000,
        data: JSON.stringify({ tab: 't1', by: ANA, role: 'editor', data: { n: 2 } }),
      },
    ]);
    expect(w.engine.schedule.settleAt).toBe(301_000);
    queueItemEvent(w.sql, w.engine, event({ kind: 'left', tab: 't1', at: 2000 }));
    expect(rows()[0]).toMatchObject({ due_at: 302_000, data: '{"tab":"t1"}' });
    queueItemEvent(w.sql, w.engine, event({ kind: 'arrived', tab: 't2', at: 3000 }));
    expect(rows()).toHaveLength(1);
    // An event about no tab settles under the item itself.
    queueItemEvent(w.sql, w.engine, event({ kind: 'left', at: 3000 }));
    expect(rows().map((r) => [r['key'], r['data']])).toContainEqual(['', '{}']);
    queueItemEvent(w.sql, w.engine, event({ kind: 'arrived', at: 3000 }));
    queueItemEvent(w.sql, w.engine, event({ kind: 'arrived', tab: 't1', at: 3000 }));
    expect(rows()).toEqual([]);
    expect(w.engine.schedule.settleAt).toBeNull();
  });

  it('starts no settle for the rule’s own change, or for an event its trigger does not match', () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'edited', minutes: 5, tab: 't1' } });
    const settlers = w.engine.settlers;
    expect(touchSettles(w.sql, settlers, event({ kind: 'edit', tab: 't1', rule: rule.id }))).toBe(
      false,
    );
    expect(touchSettles(w.sql, settlers, event({ kind: 'edit', tab: 't2' }))).toBe(false);
    expect(touchSettles(w.sql, settlers, event({ kind: 'joined' }))).toBe(false);
    expect(touchSettles(w.sql, settlers, event({ kind: 'edit', tab: 't1' }))).toBe(true);
    expect(rowsOf(w.sql, 'SELECT key, data FROM automation_settles')).toEqual([
      { key: 't1', data: '{"tab":"t1"}' },
    ]);
  });
});

describe('settles that came due', () => {
  it('queue one event for the rule and fire once', () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const deps = w.engine.deps()!;
    queueItemEvent(w.sql, w.engine, event({ kind: 'left', tab: 't1', by: ANA }));
    expect(runItemSettles(deps, w.engine.schedule, 300_000)).toBe(0);
    expect(runItemSettles(deps, w.engine.schedule, 301_000)).toBe(1);
    expect(queued(w.sql)).toEqual([
      {
        id: `s:${rule.id}:t1:301000`,
        kind: 'settled',
        at: 301_000,
        ruleId: rule.id,
        tab: 't1',
        by: ANA,
      },
    ]);
    expect(w.engine.schedule.settleAt).toBeNull();
    expect(w.engine.schedule.queueDue(301_000)).toBe(true);
    // Fired: nothing more until a later starting event.
    expect(runItemSettles(deps, w.engine.schedule, 900_000)).toBe(0);
    queueItemEvent(w.sql, w.engine, event({ kind: 'left', tab: 't1', at: 900_000 }));
    expect(runItemSettles(deps, w.engine.schedule, 1_300_000)).toBe(1);
  });

  it('drop a settle whose rule is off or no longer settles, and read damaged data as none', () => {
    const w = world();
    const off = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const changed = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const live = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const list = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    const deps = w.engine.deps()!;
    for (const [id, data] of [
      [off.id, '{}'],
      [changed.id, '{}'],
      [live.id, 'not json'],
      [list.id, '[1]'],
      ['gone', '{}'],
    ])
      w.sql.exec('INSERT INTO automation_settles VALUES (?, ?, 100, ?)', id, 'k', data);
    w.sql.exec(
      "UPDATE automation_rules SET body = json_set(body, '$.enabled', json('false')), enabled = 0 WHERE id = ?",
      off.id,
    );
    w.sql.exec(
      'UPDATE automation_rules SET body = json_set(body, \'$.trigger\', json(\'{"kind":"joined"}\')) WHERE id = ?',
      changed.id,
    );
    expect(runItemSettles(deps, w.engine.schedule, 200)).toBe(2);
    expect(queued(w.sql).map((e) => e.ruleId)).toEqual([live.id, list.id]);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toEqual([]);
  });

  it('wait for queue room', () => {
    const w = world();
    const rule = w.rule({ trigger: { kind: 'everyone_left', minutes: 5 } });
    w.sql.exec('INSERT INTO automation_settles VALUES (?, ?, 100, ?)', rule.id, 'k', '{}');
    w.sql.exec(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${AUTOMATION_QUEUE_MAX})
       INSERT INTO automation_queue (event, at) SELECT '{}', 0 FROM n`,
    );
    expect(runItemSettles(w.engine.deps()!, w.engine.schedule, 200)).toBe(0);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toHaveLength(1);
  });
});
