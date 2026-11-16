import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CheckResult,
  probedServices,
  type StatusHistory,
  type StatusLatest,
  statusGroups,
} from '@liveworkspace/status';
import { describe, expect, it } from 'vitest';
import { SIGNED_IN_CRON } from './config';
import type { Fetch } from './probe';
import { runOnce } from './run';
import { runSignedIn } from './signed-in-run';
import { testEnv } from './test-env';

// liveworkspace/docs/specs/009-status/status.md "The signed-in check": the 5-minute run, its second-down-in-a-row
// incidents, and how it shares the hourly run's tables and snapshots.

const MIN = 60_000;
const HOUR_MS = 60 * MIN;
const HOURLY = Date.parse('2026-11-13T13:07:00Z');
const INDEX = 'liveworkspace:index';
const COOKIE = 'guest_test.not-a-real-signature';

const up: CheckResult = { state: 'up', code: 200, ms: 90, error: null };
const stalled: CheckResult = { state: 'down', code: null, ms: 5_000, error: 'timeout' };
const only = (r: CheckResult) => new Map([[INDEX, r]]);
const probed = probedServices(statusGroups('production')).map((s) => s.id);
const everyUp = (overrides: Record<string, CheckResult> = {}) =>
  new Map(probed.map((id) => [id, overrides[id] ?? up]));

const signedEnv = () => testEnv({ STATUS_GUEST_COOKIE: COOKIE });
const rows = <T>(env: ReturnType<typeof testEnv>, sql: string, ...args: (string | number)[]) =>
  env.raw.prepare(sql).all(...args) as T[];
function snapshot<T>(env: ReturnType<typeof testEnv>, key: string): T {
  const [row] = rows<{ body: string }>(env, 'SELECT body FROM snapshots WHERE key = ?', key);
  return JSON.parse(row!.body) as T;
}

describe('runSignedIn', () => {
  it('checks nothing and says why without the secret: never a false red', async () => {
    const env = testEnv();
    const report = await runSignedIn(env, HOURLY + 5 * MIN);
    expect(report).toMatchObject({ skipped: 'no_secret', checked: 0, down: 0 });
    expect(rows(env, 'SELECT * FROM checks')).toEqual([]);
  });

  it('would have opened an incident on 2026-11-13: the second stalled check in a row opens it at the first', async () => {
    const env = signedEnv();
    await runOnce(env, HOURLY, { results: everyUp() });
    // 13:53: the index stalls. One down check is no incident yet.
    const first = HOURLY + 46 * MIN;
    let report = await runSignedIn(env, first, { results: only(stalled) });
    expect(report).toMatchObject({ checked: 1, down: 1, opened: 0 });
    expect(rows(env, 'SELECT * FROM incidents')).toEqual([]);
    // 13:58: the second in a row opens one, from 13:53.
    report = await runSignedIn(env, first + 5 * MIN, { results: only(stalled) });
    expect(report.opened).toBe(1);
    expect(
      rows(env, 'SELECT service, started_at, last_at, ended_at, checks, error FROM incidents'),
    ).toEqual([
      {
        service: INDEX,
        started_at: first,
        last_at: first + 5 * MIN,
        ended_at: null,
        checks: 2,
        error: 'timeout',
      },
    ]);
    expect(snapshot<StatusHistory>(env, 'history').incidents[0]).toEqual([
      INDEX,
      first,
      null,
      'd',
      2,
      'timeout',
    ]);
    // 14:03: still down, extended.
    await runSignedIn(env, first + 10 * MIN, { results: only(stalled) });
    // 14:07: the hourly run, signed in, still down: extended too.
    await runOnce(env, HOURLY + HOUR_MS, { results: everyUp({ [INDEX]: stalled }) });
    // 14:12: an answer closes it.
    report = await runSignedIn(env, HOURLY + HOUR_MS + 5 * MIN, { results: only(up) });
    expect(report.closed).toBe(1);
    expect(rows(env, 'SELECT checks, ended_at FROM incidents')).toEqual([
      { checks: 4, ended_at: HOURLY + HOUR_MS + 5 * MIN },
    ]);
    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.incidents).toEqual([
      [INDEX, first, HOURLY + HOUR_MS + 5 * MIN, 'd', 4, 'timeout'],
    ]);
  });

  it('opens nothing for one slow key fetch between two answers', async () => {
    const env = signedEnv();
    await runSignedIn(env, HOURLY + 5 * MIN, { results: only(up) });
    await runSignedIn(env, HOURLY + 10 * MIN, { results: only(stalled) });
    await runSignedIn(env, HOURLY + 15 * MIN, { results: only(up) });
    expect(rows(env, 'SELECT * FROM incidents')).toEqual([]);
  });

  it('adds its check to today’s row and patches both snapshots, keeping the hourly run’s time', async () => {
    const env = signedEnv();
    await runOnce(env, HOURLY, { results: everyUp() });
    await runSignedIn(env, HOURLY + 5 * MIN, { results: only(stalled) });
    expect(
      rows(env, 'SELECT checks, up, slow, down, p50, worst FROM daily WHERE service = ?', INDEX),
    ).toEqual([{ checks: 2, up: 1, slow: 0, down: 1, p50: 90, worst: 'down' }]);
    expect(rows(env, 'SELECT at, state FROM checks WHERE service = ? ORDER BY at', INDEX)).toEqual([
      { at: HOURLY, state: 'up' },
      { at: HOURLY + 5 * MIN, state: 'down' },
    ]);
    const latest = snapshot<StatusLatest>(env, 'latest');
    expect(latest.at).toBe(HOURLY);
    expect(latest.services[INDEX]).toEqual(['d', null, 5_000, 'timeout']);
    expect(latest.services['liveworkspace:site']).toEqual(['u', 200, 90]);
    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.at).toBe(HOURLY);
    expect(history.latest[INDEX]).toEqual(['d', null, 5_000, 'timeout']);
    expect(history.services[INDEX]!.w.at(-1)).toBe('d');
    expect(history.services[INDEX]!.u).toEqual([[89, 500]]);
    // An answer brings today's bar back up to its share: 2 of 3.
    await runSignedIn(env, HOURLY + 10 * MIN, { results: only(up) });
    expect(snapshot<StatusHistory>(env, 'history').services[INDEX]!.u).toEqual([[89, 667]]);
  });

  it('stores its check and day before any hourly run, with no snapshot to patch', async () => {
    const env = signedEnv();
    const report = await runSignedIn(env, HOURLY + 5 * MIN, { results: only(up) });
    expect(report).toMatchObject({ checked: 1, down: 0 });
    expect(rows(env, 'SELECT checks, p50, p95 FROM daily WHERE service = ?', INDEX)).toEqual([
      { checks: 1, p50: 90, p95: 90 },
    ]);
    expect(rows(env, 'SELECT * FROM snapshots')).toEqual([]);
  });

  it('leaves the bars to the hourly run after midnight, until it starts the new day', async () => {
    const env = signedEnv();
    const late = Date.parse('2026-11-13T23:07:00Z');
    await runOnce(env, late, { results: everyUp() });
    await runSignedIn(env, late + 55 * MIN, { results: only(stalled) });
    const history = snapshot<StatusHistory>(env, 'history');
    expect(history.services[INDEX]!.w.at(-1)).toBe('u');
    expect(history.latest[INDEX]![0]).toBe('d');
    expect(rows(env, 'SELECT day FROM daily WHERE service = ? ORDER BY day', INDEX)).toEqual([
      { day: '2026-11-13' },
      { day: '2026-11-14' },
    ]);
  });

  it('makes the check itself when no results are handed in, signed in', async () => {
    const env = signedEnv();
    const seen: string[] = [];
    const fetchImpl: Fetch = async (r) => {
      seen.push(new URL(r.url).pathname);
      const url = new URL(r.url);
      if (url.hostname === 'www.livediagram.app') {
        const next = `https://lw.example/api/auth/guest?state=${url.searchParams.get('state')}`;
        return new Response(null, { status: 302, headers: { Location: next } });
      }
      if (url.pathname === '/api/auth/guest') {
        const back = `https://www.livediagram.app/auth/guest#guest_token=t&state=${url.searchParams.get('state')}`;
        return new Response(null, { status: 302, headers: { Location: back } });
      }
      return Response.json({ defaults: [] });
    };
    expect(await runSignedIn(env, HOURLY + 5 * MIN, { fetch: fetchImpl })).toMatchObject({
      checked: 1,
      down: 0,
    });
    expect(seen).toEqual(['/api/auth/guest', '/api/auth/guest', '/api/index/placement-defaults']);
  });
});

describe('runSignedIn with snapshots it can’t read', () => {
  it('stores the check and leaves an unreadable snapshot for the hourly run to rebuild', async () => {
    const env = signedEnv();
    env.raw.exec(
      "INSERT INTO snapshots VALUES ('latest', 1, 'not json'), ('history', 1, '{\"v\":2}')",
    );
    await runSignedIn(env, HOURLY + 5 * MIN, { results: only(up) });
    expect(rows(env, 'SELECT key, body FROM snapshots ORDER BY key')).toEqual([
      { key: 'history', body: '{"v":2}' },
      { key: 'latest', body: 'not json' },
    ]);
    env.raw.exec("UPDATE snapshots SET body = 'not json either' WHERE key = 'history'");
    env.raw.exec("UPDATE snapshots SET body = '{\"v\":1}' WHERE key = 'latest'");
    await runSignedIn(env, HOURLY + 10 * MIN, { results: only(up) });
    expect(rows(env, 'SELECT * FROM checks')).toHaveLength(2);
  });

  it('keeps other services’ incidents in the answer, newest first', async () => {
    const env = signedEnv();
    await runOnce(env, HOURLY, { results: everyUp({ 'liveplanner:api': stalled }) });
    await runSignedIn(env, HOURLY + 5 * MIN, { results: only(stalled) });
    await runSignedIn(env, HOURLY + 10 * MIN, { results: only(stalled) });
    const incidents = snapshot<StatusHistory>(env, 'history').incidents.map(([id, started]) => [
      id,
      started,
    ]);
    expect(incidents).toEqual([
      [INDEX, HOURLY + 5 * MIN],
      ['liveplanner:api', HOURLY],
      ['liveplanner:realtime', HOURLY],
    ]);
  });
});

describe('the Cron Triggers', () => {
  it('run the signed-in check alone at every 5 minutes but minute 7, where the hourly run makes it', () => {
    const toml = readFileSync(join(import.meta.dirname, '../wrangler.toml'), 'utf8');
    const crons = [...toml.matchAll(/^crons = (.+)$/gm)].map((m) => JSON.parse(m[1]!) as string[]);
    // Production and staging alike.
    expect(crons).toEqual([
      ['7 * * * *', SIGNED_IN_CRON],
      ['7 * * * *', SIGNED_IN_CRON],
    ]);
    const minutes = SIGNED_IN_CRON.split(' ')[0]!.split(',').map(Number);
    expect([...minutes, 7].toSorted((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => 2 + i * 5),
    );
  });
});
