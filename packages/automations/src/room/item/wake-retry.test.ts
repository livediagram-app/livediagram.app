// A wake that fails as a whole: it backs off (1, 2, 4 … minutes, an hour at most), keeps its count over a restart,
// clears it on a wake that works, and gives up after 12 in a row (automation-wake.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ItemEvent, ItemRun } from '../../item';
import { listRuns, settleRun, stoppedLineId } from '../automation-log';
import {
  WAKE_FAILURES_MAX,
  WAKE_GAVE_UP,
  WAKE_RETRY_MAX_MS,
  giveUpWake,
  wakeRetryMs,
} from '../automation-wake';
import { ItemEngine } from './engine';
import { queueItemEvent } from './intake';
import { ANA, TEST_KINDS, rowsOf, world, type World } from './test-kit';
import { runItemAutomations } from './wake';

const MIN = 60_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now());
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const joined = (id: string): ItemEvent => ({
  id,
  kind: 'joined',
  at: Date.now(),
  by: ANA,
  role: 'editor',
});
const runs = (w: World): ItemRun[] => listRuns<ItemRun>(w.sql, { limit: 200 });
const wakeRow = (w: World) => rowsOf(w.sql, 'SELECT failures, retry_at FROM automation_wake');

// An item whose wake always fails: a rule that hears `joined`, one trigger queued, the rules unreadable.
function broken(): World {
  const w = world();
  w.rule({ trigger: { kind: 'joined' } });
  queueItemEvent(w.sql, w.engine, joined('j1'));
  vi.spyOn(w.engine.store, 'enabled').mockImplementation(() => {
    throw new Error('bad stored data');
  });
  return w;
}

describe('a wake that keeps failing', () => {
  it('waits 1, 2, 4 … minutes between tries, an hour at most', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 12].map(wakeRetryMs)).toEqual(
      [1, 2, 4, 8, 16, 32, 60, 60, 60].map((m) => m * MIN),
    );
    expect(wakeRetryMs(40)).toBe(WAKE_RETRY_MAX_MS);
  });

  it('backs off on each failure in a row, then gives up on the 12th with one Audit Trail line', async () => {
    const w = broken();
    // A run a Wait held, whose resume is queued: it settles Skipped when the wake gives up.
    settleRun(w.sql, { id: 'held', ruleId: 'r1', at: 1, result: 'waiting', waitsUntil: 2 });
    w.sql.exec(
      'INSERT INTO automation_queue (event, at) VALUES (?, 1)',
      JSON.stringify({ ...joined('w:held'), kind: 'resume', ruleId: 'r1', origin: 'held' }),
    );
    let now = Date.now();
    const gaps: number[] = [];
    for (let i = 1; i < WAKE_FAILURES_MAX; i += 1) {
      await runItemAutomations(w.engine, now);
      expect(w.engine.schedule.failures).toBe(i);
      expect(wakeRow(w)).toEqual([{ failures: i, retry_at: w.engine.schedule.retryAt }]);
      gaps.push(w.engine.schedule.retryAt - now);
      // Nothing is due before the hold-off.
      expect(w.engine.schedule.due(w.engine.schedule.retryAt - 1)).toBe(false);
      now = w.engine.schedule.wakeAt!;
    }
    expect(gaps).toEqual([1, 2, 4, 8, 16, 32, 60, 60, 60, 60, 60].map((m) => m * MIN));
    expect(runs(w).filter((r) => r.reason === WAKE_GAVE_UP)).toEqual([]);

    await runItemAutomations(w.engine, now);
    expect(rowsOf(w.sql, 'SELECT * FROM automation_queue')).toEqual([]);
    expect(wakeRow(w)).toEqual([]);
    expect(w.engine.schedule).toMatchObject({ failures: 0, retryAt: 0, at: null });
    expect(w.engine.schedule.wakeAt).toBeNull();
    const line = runs(w).find((r) => r.id === stoppedLineId(now));
    expect(line).toMatchObject({ ruleId: '', result: 'skipped', reason: WAKE_GAVE_UP, steps: [] });
    expect(runs(w).find((r) => r.id === 'held')).toMatchObject({
      result: 'skipped',
      reason: WAKE_GAVE_UP,
    });
    await w.settled();
    const types = w.events.map((e) => e.type);
    expect(types.filter((t) => t === 'AutomationWakeFailed')).toHaveLength(WAKE_FAILURES_MAX);
    expect(types.filter((t) => t === 'AutomationWakeGaveUp')).toHaveLength(1);
    // The rule stays on: the next change starts afresh.
    expect(w.engine.store.get('r1')?.enabled).toBe(true);
  });

  it('clears the count on a wake that works', async () => {
    const w = broken();
    const now = Date.now();
    await runItemAutomations(w.engine, now);
    await runItemAutomations(w.engine, w.engine.schedule.wakeAt!);
    expect(w.engine.schedule.failures).toBe(2);
    vi.mocked(w.engine.store.enabled).mockRestore();
    await runItemAutomations(w.engine, w.engine.schedule.wakeAt!);
    expect(wakeRow(w)).toEqual([]);
    expect(w.engine.schedule).toMatchObject({ failures: 0, retryAt: 0 });
    expect(runs(w).map((r) => r.result)).toEqual(['done']);
    // Known to be none, a later wake writes nothing for it.
    const exec = vi.spyOn(w.sql, 'exec');
    await runItemAutomations(w.engine, Date.now());
    expect(exec.mock.calls.some(([q]) => String(q).includes('automation_wake'))).toBe(false);
  });

  it('keeps its count and hold-off over a restart', async () => {
    const w = broken();
    let now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      await runItemAutomations(w.engine, now);
      now = w.engine.schedule.wakeAt!;
    }
    const retryAt = w.engine.schedule.retryAt;
    // The object evicted: a fresh engine over the same SQLite.
    const fresh = new ItemEngine({
      sql: () => w.sql,
      ready: () => true,
      arm: () => {},
      kinds: TEST_KINDS,
      kit: () => w.kit,
      putAway: () => false,
    });
    fresh.restore(retryAt - 5 * MIN);
    expect(fresh.schedule).toMatchObject({ failures: 3, retryAt });
    expect(fresh.schedule.wakeAt).toBe(retryAt);
    expect(fresh.schedule.due(retryAt - 1)).toBe(false);
    vi.spyOn(fresh.store, 'enabled').mockImplementation(() => {
      throw new Error('bad stored data');
    });
    await runItemAutomations(fresh, retryAt);
    expect(fresh.schedule.failures).toBe(4);
    expect(fresh.schedule.retryAt).toBe(retryAt + 8 * MIN);
  });

  it('holds off an hour when even the count cannot be kept', async () => {
    const w = broken();
    const exec = w.sql.exec.bind(w.sql);
    vi.spyOn(w.sql, 'exec').mockImplementation((query: string, ...bindings: unknown[]) => {
      if (query.includes('automation_wake')) throw new Error('storage');
      return exec(query, ...bindings);
    });
    const now = Date.now();
    await expect(runItemAutomations(w.engine, now)).resolves.toBeUndefined();
    expect(w.engine.schedule.retryAt).toBe(now + WAKE_RETRY_MAX_MS);
  });
});

describe('giving up', () => {
  it('lets go of what would wake the room at once, and keeps what is still to come', () => {
    const w = world();
    const timed = w.rule({ trigger: { kind: 'scheduled', every: 'day', at: '09:00' } });
    const off = w.rule({
      trigger: { kind: 'scheduled', every: 'day', at: '10:00' },
      enabled: false,
    });
    const now = Date.now();
    w.sql.exec('UPDATE automation_schedule SET next_at = 1');
    w.sql.exec(
      "INSERT INTO automation_schedule (rule_id, next_at) VALUES (?, 1), ('gone', 1)",
      off.id,
    );
    settleRun(w.sql, { id: 'due', ruleId: timed.id, at: 1, result: 'waiting', waitsUntil: 2 });
    settleRun(w.sql, { id: 'later', ruleId: timed.id, at: 1, result: 'waiting', waitsUntil: 2 });
    w.sql.exec(
      "INSERT INTO automation_waiting (id, rule_id, at, event) VALUES ('due', 'r1', 1, '{}'), ('later', 'r1', ?, '{}')",
      now + MIN,
    );
    w.sql.exec(
      "INSERT INTO automation_settles VALUES ('r1', '', 1, '{}'), ('r1', 'k', ?, '{}')",
      now + MIN,
    );
    w.sql.exec("INSERT INTO automation_queue (event, at) VALUES ('not json', 1), ('{}', 1)");
    giveUpWake(w.sql, w.engine.schedule, now, {
      store: w.engine.store,
      settles: true,
      line: { ruleName: '', subject: null },
    });
    expect(rowsOf(w.sql, 'SELECT * FROM automation_queue')).toEqual([]);
    expect(rowsOf(w.sql, 'SELECT id FROM automation_waiting')).toEqual([{ id: 'later' }]);
    expect(rowsOf(w.sql, 'SELECT key FROM automation_settles')).toEqual([{ key: 'k' }]);
    const schedule = rowsOf(w.sql, 'SELECT rule_id, next_at FROM automation_schedule');
    expect(schedule.map((r) => r['rule_id'])).toEqual([timed.id]);
    expect(Number(schedule[0]!['next_at'])).toBeGreaterThan(now);
    const results = Object.fromEntries(runs(w).map((r) => [r.id, r.result]));
    expect(results).toMatchObject({ due: 'skipped', later: 'waiting' });
  });

  it('leaves settles alone for an app with none', () => {
    const w = world();
    w.sql.exec("INSERT INTO automation_settles VALUES ('r1', '', 1, '{}')");
    giveUpWake(w.sql, w.engine.schedule, Date.now(), {
      store: w.engine.store,
      settles: false,
      line: { ruleName: '', card: null },
    });
    expect(rowsOf(w.sql, 'SELECT * FROM automation_settles')).toHaveLength(1);
  });
});
