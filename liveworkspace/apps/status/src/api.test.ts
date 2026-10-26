import { gzipSync } from 'node:zlib';
import {
  type CheckResult,
  probedServices,
  type StatusHistory,
  statusGroups,
} from '@liveworkspace/status';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDays } from './api';
import type { Env } from './env';
import worker from './index';
import { runOnce } from './run';
import { testEnv } from './test-env';

// liveworkspace/docs/status.md "The read API".

const T0 = Date.parse('2026-10-25T09:07:00Z');
const up: CheckResult = { state: 'up', code: 200, ms: 80, error: null };
const all = new Map(probedServices(statusGroups('production')).map((s) => [s.id, up]));

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
const get = (env: Env, path: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://lw.example${path}`, init), env, ctx);

// The edge cache, as a map, so the tests see what is put and served.
let store: Map<string, Response>;
beforeEach(() => {
  store = new Map();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    },
  };
});
afterEach(() => {
  delete (globalThis as { caches?: unknown }).caches;
});

describe('the read API', () => {
  it('answers empty before the first run, so the page can fall back', async () => {
    const env = testEnv();
    const latest = await get(env, '/api/status');
    expect(latest.status).toBe(200);
    expect(await latest.json()).toEqual({ v: 1, at: null, services: {} });
    const history = (await (await get(env, '/api/status/history')).json()) as StatusHistory;
    expect(history).toMatchObject({ v: 1, at: null, days: 90, services: {}, incidents: [] });
  });

  it('serves the last run, cacheable, as compact JSON', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: all });
    const res = await get(env, '/api/status/history');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=120');
    expect(res.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const text = await res.text();
    expect(text).not.toMatch(/\n/);
    const body = JSON.parse(text) as StatusHistory;
    expect(body.at).toBe(T0);
    expect(Object.keys(body.services)).toHaveLength(35);
    expect(body.latest['livediagram:api']).toEqual(['u', 200, 80]);
    const latest = await (await get(env, '/api/status')).json();
    expect(latest).toMatchObject({ v: 1, at: T0 });
  });

  it('slices fewer days on request, and refuses a bad count', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: all });
    const body = (await (await get(env, '/api/status/history?days=7')).json()) as StatusHistory;
    expect(body.days).toBe(7);
    expect(body.from).toBe('2026-10-19');
    expect(body.services['liveworkspace:site']!.w).toHaveLength(7);
    expect((await get(env, '/api/status/history?days=91')).status).toBe(400);
    expect((await get(env, '/api/status/history?days=abc')).status).toBe(400);
    expect(parseDays(null)).toBe(90);
    expect(parseDays('1')).toBe(1);
    expect(parseDays('0')).toBeNull();
  });

  it('serves a repeat from the edge cache, without reading D1', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: all });
    await get(env, '/api/status/history?days=90&x=1');
    expect([...store.keys()]).toEqual(['https://lw.example/api/status/history?days=90']);
    env.raw.exec('DELETE FROM snapshots');
    const again = (await (await get(env, '/api/status/history')).json()) as StatusHistory;
    expect(again.at).toBe(T0);
  });

  it('answers a HEAD from the edge cache with headers only, no body', async () => {
    const env = testEnv();
    await runOnce(env, T0, { results: all });
    await get(env, '/api/status');
    expect(store.size).toBe(1);
    const head = await get(env, '/api/status', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(head.headers.get('Cache-Control')).toBe('public, max-age=120');
    expect(head.body).toBeNull();
  });

  it('skips the cache in development', async () => {
    const env = testEnv({ ENVIRONMENT: 'development' });
    await get(env, '/api/status');
    expect(store.size).toBe(0);
  });

  it('takes GET and HEAD only, and knows only its two reads', async () => {
    const env = testEnv();
    expect((await get(env, '/api/status', { method: 'POST' })).status).toBe(405);
    expect((await get(env, '/api/status/history', { method: 'HEAD' })).status).toBe(200);
    expect((await get(env, '/api/status/other')).status).toBe(404);
    expect((await get(env, '/api/statusx')).status).toBe(404);
    expect((await get(env, '/')).status).toBe(404);
  });

  it('answers an empty history, not a 500, when the stored row is not JSON', async () => {
    const env = testEnv();
    env.raw.exec("INSERT INTO snapshots (key, at, body) VALUES ('history', 1, '{\"v\":1,\"at')");
    const res = await get(env, '/api/status/history?days=7');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ v: 1, at: null, days: 7, services: {} });
  });

  it('limits each network’s reads that miss the cache', async () => {
    const env = testEnv({
      ENVIRONMENT: 'development',
      READ_RATE_LIMITER: { limit: async () => ({ success: false }) },
    });
    const res = await get(env, '/api/status', { headers: { 'CF-Connecting-IP': '203.0.113.9' } });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('keeps every service’s 90 days small, even with two days in three down for every service', async () => {
    const env = testEnv();
    // 90 days of the worst realistic shape: every bar a different uptime.
    for (let d = 0; d < 90; d++) {
      const day = new Date(T0 - d * 86_400_000).toISOString().slice(0, 10);
      for (const id of all.keys())
        env.raw
          .prepare('INSERT INTO daily VALUES (?, ?, 24, ?, 0, ?, 80, 120, ?)')
          .run(day, id, 24 - (d % 3), d % 3, d % 3 ? 'down' : 'up');
    }
    await runOnce(env, T0, { results: all });
    const text = await (await get(env, '/api/status/history')).text();
    console.log(JSON.stringify({ worstCaseBytes: text.length, gzipBytes: gzipSync(text).length }));
    expect(text.length).toBeLessThan(24_000);
    expect(gzipSync(text).length).toBeLessThan(4_000);
  });
});
