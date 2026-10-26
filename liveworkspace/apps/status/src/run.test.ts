import {
  type CheckResult,
  dayStart,
  probedServices,
  type StatusHistory,
  type StatusLatest,
  statusGroups,
} from '@liveworkspace/status';
import { describe, expect, it } from 'vitest';
import { DAY_MS } from './config';
import type { Fetch } from './probe';
import { runOnce } from './run';
import { testEnv } from './test-env';

// liveworkspace/docs/specs/009-status/status.md "The hourly run": what one run stores, rolls up, derives and prunes.

const HOUR = 3_600_000;
const T0 = Date.parse('2026-10-25T09:07:00Z');
const probed = probedServices(statusGroups('production')).map((s) => s.id);

const up: CheckResult = { state: 'up', code: 200, ms: 80, error: null };
const down: CheckResult = { state: 'down', code: null, ms: 10_000, error: 'timeout' };

function results(overrides: Record<string, CheckResult> = {}): Map<string, CheckResult> {
  return new Map(probed.map((id) => [id, overrides[id] ?? up]));
}

const rows = <T>(env: ReturnType<typeof testEnv>, sql: string, ...args: (string | number)[]) =>
  env.raw.prepare(sql).all(...args) as T[];

function snapshot<T>(env: ReturnType<typeof testEnv>, key: string): T {
  const [row] = rows<{ body: string }>(env, 'SELECT body FROM snapshots WHERE key = ?', key);
  return JSON.parse(row!.body) as T;
}

describe('runOnce', () => {
  it('stores a row for every service, the day’s rollup and both answers', async () => {
    const env = testEnv();
    const report = await runOnce(env, T0, { results: results() });
    expect(report).toMatchObject({ at: T0, checked: 35, up: 35, down: 0, opened: 0 });
    expect(rows(env, 'SELECT * FROM checks')).toHaveLength(35);
    expect(rows(env, 'SELECT * FROM daily WHERE day = ?', '2026-10-25')).toHaveLength(35);

    const latest = snapshot<StatusLatest>(env, 'latest');
    expect(latest.at).toBe(T0);
    expect(latest.services['liveworkspace:site']).toEqual(['u', 200, 80]);
    // The derived services are stored too.
    expect(latest.services['livediagram:realtime']).toEqual(['u', 200, 80]);
    expect(latest.services['livediagram:router']).toEqual(['u', 200, 80]);

    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.from).toBe('2026-07-28');
    expect(Object.keys(history.services)).toHaveLength(35);
    const site = history.services['liveworkspace:site']!;
    expect(site.w).toBe(`${'-'.repeat(89)}u`);
    // A fully up day isn't listed: only days under 100% are.
    expect(site.u).toEqual([]);
    expect(site.p).toBe(100);
  });

  it('rolls today up again on every run, from all of today’s checks', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: results() });
    await runOnce(env, T0 + HOUR, {
      results: results({ 'livediagram:api': { ...up, state: 'slow', ms: 2000 } }),
    });
    await runOnce(env, T0 + 2 * HOUR, { results: results({ 'livediagram:api': down }) });
    const [day] = rows<Record<string, unknown>>(
      env,
      'SELECT * FROM daily WHERE service = ? AND day = ?',
      'livediagram:api',
      '2026-10-25',
    );
    expect(day).toMatchObject({
      checks: 3,
      up: 1,
      slow: 1,
      down: 1,
      p50: 80,
      p95: 2000,
      worst: 'down',
    });
    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.services['livediagram:api']!.u).toEqual([[89, 667]]);
    expect(history.services['livediagram:api']!.w.at(-1)).toBe('d');
    expect(history.services['livediagram:api']!.p).toBe(66.67);
  });

  it('turns consecutive checks that weren’t up into one incident, closed by the next up check', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: results({ 'liveplanner:api': down }) });
    await runOnce(env, T0 + HOUR, { results: results({ 'liveplanner:api': down }) });
    let open = rows<Record<string, unknown>>(env, 'SELECT * FROM incidents ORDER BY service');
    // The API, and the realtime rooms that stand on it.
    expect(open.map((i) => i.service)).toEqual(['liveplanner:api', 'liveplanner:realtime']);
    expect(open[0]).toMatchObject({
      started_at: T0,
      last_at: T0 + HOUR,
      ended_at: null,
      checks: 2,
      worst: 'down',
      error: 'timeout',
    });

    const report = await runOnce(env, T0 + 2 * HOUR, { results: results() });
    expect(report.closed).toBe(2);
    open = rows(env, 'SELECT * FROM incidents WHERE ended_at IS NULL');
    expect(open).toEqual([]);
    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.incidents).toContainEqual([
      'liveplanner:api',
      T0,
      T0 + 2 * HOUR,
      'd',
      2,
      'timeout',
    ]);

    // A new spell is a new incident.
    await runOnce(env, T0 + 3 * HOUR, { results: results({ 'liveplanner:api': down }) });
    expect(rows(env, 'SELECT * FROM incidents WHERE service = ?', 'liveplanner:api')).toHaveLength(
      2,
    );
    expect(snapshot<StatusHistory>(env, 'history').incidents[0]).toEqual([
      'liveplanner:api',
      T0 + 3 * HOUR,
      null,
      'd',
      1,
      'timeout',
    ]);
  });

  it('prunes checks, days and closed incidents past 90 days in the same run', async () => {
    const env = testEnv();
    const old = T0 - 91 * DAY_MS;
    const kept = T0 - 89 * DAY_MS;
    env.raw.exec(`
      INSERT INTO checks VALUES (${old}, 'liveworkspace:site', 'up', 200, 80, NULL);
      INSERT INTO checks VALUES (${kept}, 'liveworkspace:site', 'up', 200, 80, NULL);
      INSERT INTO daily VALUES ('2026-07-26', 'liveworkspace:site', 24, 24, 0, 0, 80, 90, 'up');
      INSERT INTO daily VALUES ('2026-07-28', 'liveworkspace:site', 24, 23, 0, 1, 80, 90, 'down');
      INSERT INTO incidents (service, started_at, last_at, ended_at, worst, checks, error)
        VALUES ('liveworkspace:site', ${old}, ${old}, ${old + HOUR}, 'down', 1, 'timeout');
      INSERT INTO incidents (service, started_at, last_at, ended_at, worst, checks, error)
        VALUES ('liveworkspace:site', ${kept}, ${kept}, ${kept + HOUR}, 'down', 1, 'timeout');
    `);
    await runOnce(env, T0, { results: results() });
    expect(rows(env, 'SELECT at FROM checks WHERE at < ?', T0)).toEqual([{ at: kept }]);
    expect(rows(env, 'SELECT day FROM daily WHERE day < ?', '2026-10-25')).toEqual([
      { day: '2026-07-28' },
    ]);
    expect(rows(env, 'SELECT started_at FROM incidents')).toEqual([{ started_at: kept }]);
    // The window's first day is the oldest kept, and shows in the bars.
    const site = snapshot<StatusHistory>(env, 'history').services['liveworkspace:site']!;
    expect(site.u).toEqual([[0, 958]]);
    expect(site.w[0]).toBe('d');
    // 23 of 24 that day, and today’s one: 24 of 25.
    expect(site.p).toBe(96);
  });

  it('leaves yesterday alone after midnight, and starts today afresh', async () => {
    const env = testEnv();
    const late = dayStart('2026-10-24') + 23 * HOUR + 7 * 60_000;
    await runOnce(env, late, { results: results({ 'liveworkspace:media': down }) });
    await runOnce(env, late + HOUR, { results: results() });
    const media = rows<{ day: string; checks: number; worst: string }>(
      env,
      'SELECT day, checks, worst FROM daily WHERE service = ? ORDER BY day',
      'liveworkspace:media',
    );
    expect(media).toEqual([
      { day: '2026-10-24', checks: 1, worst: 'down' },
      { day: '2026-10-25', checks: 1, worst: 'up' },
    ]);
  });

  it('checks every service itself when no results are handed in', async () => {
    const env = testEnv();
    // Every service answers as it should (Telemetry's 204, Media's JSON 404), but liveplanner's editor, which 502s.
    const fetchImpl: Fetch = async (r) => {
      if (r.url.includes('liveplanner.app/icon.svg')) return new Response('bad', { status: 502 });
      const status = r.method === 'OPTIONS' ? 204 : r.url.endsWith('/api/previews') ? 404 : 200;
      return new Response(status === 204 ? null : '{}', {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const report = await runOnce(env, T0, { fetch: fetchImpl });
    expect(report).toMatchObject({ checked: 35, down: 1, opened: 1 });
    const latest = snapshot<StatusLatest>(env, 'latest');
    expect(latest.services['liveplanner:editor']).toEqual(['d', 502, expect.any(Number), 'status']);
    expect(latest.services['liveplanner:router']![0]).toBe('u');
    expect(latest.services['liveworkspace:media']![0]).toBe('u');
  });

  it('writes one run in one batch: a statement per row, and a failure leaves nothing half-done', async () => {
    const env = testEnv();
    const batches: number[] = [];
    const db = env.STATUS_DB;
    env.STATUS_DB = {
      prepare: db.prepare.bind(db),
      batch: (stmts: D1PreparedStatement[]) => (batches.push(stmts.length), db.batch(stmts)),
    } as unknown as D1Database;
    await runOnce(env, T0, { results: results() });
    // One read batch (4 queries), one write batch: 35 checks, 35 days, 3 prunes, 2 snapshots.
    expect(batches).toEqual([4, 75]);
  });
});
