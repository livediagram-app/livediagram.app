import { describe, expect, it, vi } from 'vitest';
import { AUTOMATION_LOG_MAX, AUTOMATION_LOG_MAX_AGE_MS } from '../limits';
import { firedIds, forgetFired, keepFired, trimFired } from './automation-fired';
import {
  AUTOMATION_NO_MATCH_LOG_MAX,
  AUTOMATION_RUNS_LIST_MAX,
  budgetLineId,
  burstLineId,
  claimRun,
  derivedLineId,
  dropRun,
  listRuns,
  markAiAsked,
  noteLineOnce,
  ruleStats,
  runsToday,
  settleRun,
  settleWaiting,
  timeLineId,
  trimRuns,
  type StoredRun,
} from './automation-log';
import { rowsOf, testSql } from './test-sql';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 20 * DAY + 5000;
type Run = StoredRun & { subject?: { id: string } | null; steps?: unknown[] };
const run = (id: string, over: Partial<Run> = {}): Run => ({
  id,
  ruleId: 'r1',
  at: NOW,
  result: 'done',
  ...over,
});

describe('a run’s row', () => {
  it('is claimed once, pending, and never listed until it settles', () => {
    const sql = testSql();
    expect(claimRun(sql, 'run1', 'r1', NOW)).toBe(true);
    expect(claimRun(sql, 'run1', 'r1', NOW)).toBe(false);
    expect(listRuns(sql, {})).toEqual([]);
    markAiAsked(sql, 'run1', 2);
    expect(rowsOf(sql, "SELECT body FROM automation_runs WHERE id = 'run1'")[0]?.['body']).toBe(
      JSON.stringify({ steps: [{ ai: true }, { ai: true }] }),
    );
    settleRun(sql, run('run1', { subject: { id: 't1' } }));
    expect(listRuns<Run>(sql, {})).toEqual([run('run1', { subject: { id: 't1' } })]);
    // Settled, it is no longer pending: neither marked nor dropped.
    markAiAsked(sql, 'run1', 1);
    dropRun(sql, 'run1');
    expect(listRuns(sql, {})).toHaveLength(1);
  });

  it('is dropped while pending, so it counts against nothing', () => {
    const sql = testSql();
    claimRun(sql, 'run1', 'r1', NOW);
    expect(runsToday(sql, NOW)).toBe(1);
    dropRun(sql, 'run1');
    expect(runsToday(sql, NOW)).toBe(0);
  });
});

describe('the day’s count', () => {
  it('counts today’s runs (UTC), never a No Match or one of the Audit Trail’s own lines', () => {
    const sql = testSql();
    settleRun(sql, run('a'));
    settleRun(sql, run('b', { result: 'failed' }));
    settleRun(sql, run('c', { result: 'no_match' }));
    settleRun(sql, run('yesterday', { at: NOW - DAY }));
    settleRun(sql, run(burstLineId(NOW), { result: 'skipped' }));
    settleRun(sql, run(timeLineId('r1', NOW), { result: 'skipped' }));
    settleRun(sql, run(derivedLineId('r1', 'x'), { result: 'skipped' }));
    expect(noteLineOnce(sql, run(budgetLineId('r1', NOW), { result: 'skipped' }))).toBe(true);
    expect(runsToday(sql, NOW)).toBe(2);
    expect(ruleStats(sql, NOW).get('r1')).toMatchObject({ runsThisWeek: 3 });
  });

  it('writes a budget line once a rule a UTC day', () => {
    const sql = testSql();
    expect(budgetLineId('r1', NOW)).toBe(budgetLineId('r1', NOW + 1));
    expect(budgetLineId('r1', NOW)).not.toBe(budgetLineId('r1', NOW + DAY));
    expect(noteLineOnce(sql, run(budgetLineId('r1', NOW), { result: 'skipped' }))).toBe(true);
    expect(noteLineOnce(sql, run(budgetLineId('r1', NOW + 5), { result: 'skipped' }))).toBe(false);
    expect(listRuns(sql, {})).toHaveLength(1);
  });
});

describe('a waiting run', () => {
  it('settles once its Wait ends, its reason replaced', () => {
    const sql = testSql();
    settleRun(sql, run('w1', { result: 'waiting', waitsUntil: NOW + 5, reason: 'old', gone: {} }));
    settleWaiting(sql, 'w1', 'skipped', 'The rule changed while this run waited');
    expect(listRuns(sql, {})).toEqual([
      run('w1', { result: 'skipped', reason: 'The rule changed while this run waited' }),
    ]);
    settleRun(sql, run('w2', { result: 'waiting', waitsUntil: NOW + 5 }));
    settleWaiting(sql, 'w2', 'done');
    expect(listRuns(sql, { rule: 'r1', result: 'done' })).toEqual([run('w2')]);
  });

  it('is left alone when it is gone, settled already or unreadable', () => {
    const sql = testSql();
    settleWaiting(sql, 'missing', 'done');
    settleRun(sql, run('done1'));
    settleWaiting(sql, 'done1', 'skipped', 'x');
    expect(listRuns(sql, {})).toEqual([run('done1')]);
    sql.exec(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES ('bad', 'r1', 1, 'waiting', 'not json')",
    );
    settleWaiting(sql, 'bad', 'done');
    expect(rowsOf(sql, "SELECT result FROM automation_runs WHERE id = 'bad'")[0]?.['result']).toBe(
      'waiting',
    );
    sql.exec(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES ('blob', 'r1', 1, 'waiting', x'00')",
    );
    settleWaiting(sql, 'blob', 'done');
    expect(rowsOf(sql, "SELECT result FROM automation_runs WHERE id = 'blob'")[0]?.['result']).toBe(
      'waiting',
    );
  });
});

describe('the Audit Trail', () => {
  it('lists newest first, by rule, result and since when, a whole limit at most 200', () => {
    const sql = testSql();
    for (let i = 0; i < 5; i += 1)
      settleRun(sql, run(`run${i}`, { at: NOW + i, ruleId: i % 2 ? 'odd' : 'even' }));
    settleRun(sql, run('failed', { result: 'failed', at: NOW - 10 }));
    sql.exec(
      "INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES ('later', 'r1', 1, 'done', 'not json')",
    );
    expect(listRuns(sql, {}).map((r) => r.id)).toEqual([
      'run4',
      'run3',
      'run2',
      'run1',
      'run0',
      'failed',
    ]);
    expect(listRuns(sql, { rule: 'odd' }).map((r) => r.id)).toEqual(['run3', 'run1']);
    expect(listRuns(sql, { result: 'failed' }).map((r) => r.id)).toEqual(['failed']);
    expect(listRuns(sql, { result: 'nonsense' as never })).toHaveLength(6);
    expect(listRuns(sql, { since: NOW + 3 }).map((r) => r.id)).toEqual(['run4', 'run3']);
    expect(listRuns(sql, { limit: 2.5 })).toHaveLength(2);
    expect(listRuns(sql, { limit: 0 })).toHaveLength(1);
    expect(listRuns(sql, { limit: 9999 })).toHaveLength(6);
    expect(AUTOMATION_RUNS_LIST_MAX).toBe(200);
  });

  it('trims rows past 30 days, and No Match rows apart from the runs', () => {
    const sql = testSql();
    settleRun(sql, run('old', { at: NOW - AUTOMATION_LOG_MAX_AGE_MS - 1 }));
    settleRun(sql, run('kept'));
    settleRun(sql, run('nothing', { result: 'no_match' }));
    trimRuns(sql, NOW);
    expect(
      listRuns(sql, {})
        .map((r) => r.id)
        .sort(),
    ).toEqual(['kept', 'nothing']);
  });

  it('keeps the newest 2,000 runs and 500 No Matches, and sorts nothing while under both', () => {
    const sql = testSql();
    const fill = (prefix: string, count: number, result: string) =>
      sql.exec(
        `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
         INSERT INTO automation_runs (id, rule_id, at, result, body)
         SELECT '${prefix}' || i, 'r1', ? - i, '${result}', '{}' FROM n`,
        NOW,
      );
    fill('run', AUTOMATION_LOG_MAX, 'done');
    fill('miss', AUTOMATION_NO_MATCH_LOG_MAX, 'no_match');
    const exec = vi.spyOn(sql, 'exec');
    trimRuns(sql, NOW);
    // The age delete and the one count: no cap's delete.
    expect(exec).toHaveBeenCalledTimes(2);
    fill('xrun', 3, 'failed');
    fill('xmiss', 2, 'no_match');
    trimRuns(sql, NOW);
    const count = (where: string) =>
      rowsOf(sql, `SELECT COUNT(*) AS n FROM automation_runs WHERE ${where}`)[0]?.['n'];
    expect(count("result = 'no_match'")).toBe(AUTOMATION_NO_MATCH_LOG_MAX);
    expect(count("result != 'no_match'")).toBe(AUTOMATION_LOG_MAX);
    // The oldest went: `run2000` (NOW - 2000) and older runs, the newest kept.
    expect(count("id = 'xrun1'")).toBe(1);
    expect(count(`id = 'run${AUTOMATION_LOG_MAX}'`)).toBe(0);
  });

  it('gives each rule its last run and its runs this week, as the day’s meter counts them', () => {
    const sql = testSql();
    settleRun(sql, run('a', { at: NOW - 8 * DAY }));
    settleRun(sql, run('b', { at: NOW - DAY }));
    settleRun(sql, run('c', { at: NOW, result: 'no_match' }));
    claimRun(sql, 'pending', 'r1', NOW + 1);
    settleRun(sql, run('other', { ruleId: 'r2', at: NOW - 9 * DAY }));
    expect(ruleStats(sql, NOW)).toEqual(
      new Map([
        ['r1', { lastRunAt: NOW - DAY, runsThisWeek: 1 }],
        ['r2', { lastRunAt: NOW - 9 * DAY, runsThisWeek: 0 }],
      ]),
    );
  });
});

describe('what a time rule ran on', () => {
  it('is kept by rule, each id once, trimmed to the newest and forgotten with the rule', () => {
    const sql = testSql();
    keepFired(sql, 'r1', ['d:1', 'd:2'], 10);
    keepFired(sql, 'r1', ['d:2', 'd:3'], 20);
    keepFired(sql, 'r2', ['k:1'], 30);
    expect(firedIds(sql, 'r1')).toEqual(new Set(['d:1', 'd:2', 'd:3']));
    trimFired(sql);
    expect(firedIds(sql, 'r1').size).toBe(3);
    forgetFired(sql, 'r1');
    expect(firedIds(sql, 'r1').size).toBe(0);
    expect(firedIds(sql, 'r2')).toEqual(new Set(['k:1']));
  });
});

describe('a count that reads no row', () => {
  it('counts as none', () => {
    const empty = { exec: () => ({ toArray: () => [] }) } as never;
    expect(runsToday(empty, NOW)).toBe(0);
  });
});
