import type { Probe } from '@liveworkspace/status';
import { describe, expect, it } from 'vitest';
import { PROBE_CONCURRENCY } from './config';
import { type Fetch, pooled, probeAll, probeOne } from './probe';
import { probeTargets } from './run';
import { testEnv } from './test-env';

// liveworkspace/docs/specs/009-status/status.md "The hourly run": checks, judged as the page judges them, with a timeout.

const jsonProbe: Probe = {
  kind: 'read',
  url: '/api/index/jwks',
  method: 'GET',
  ok: [200],
  json: true,
};
const reach: Probe = {
  kind: 'reach',
  url: 'https://www.livediagram.app/robots.txt',
  method: 'HEAD',
};

const answer =
  (status: number, type = 'application/json', body: string | null = '{}'): Fetch =>
  async () =>
    new Response(status === 204 || status === 304 ? null : body, {
      status,
      headers: { 'Content-Type': type },
    });

// A clock that moves `step` ms per reading.
const clock = (step: number) => {
  let t = 0;
  return () => (t += step);
};

describe('probeOne', () => {
  it('is up for the expected answer, with its code and time', async () => {
    expect(await probeOne(jsonProbe, 'https://x/api/index/jwks', answer(200), clock(84))).toEqual({
      state: 'up',
      code: 200,
      ms: 84,
      error: null,
    });
  });

  it('is slow past 1.5 s, and down for a wrong code or HTML where JSON is due', async () => {
    expect((await probeOne(jsonProbe, 'https://x.example/', answer(200), clock(1600))).state).toBe(
      'slow',
    );
    expect(await probeOne(jsonProbe, 'https://x.example/', answer(500), clock(10))).toMatchObject({
      state: 'down',
      code: 500,
      error: 'status',
    });
    expect(
      await probeOne(jsonProbe, 'https://x.example/', answer(200, 'text/html'), clock(10)),
    ).toMatchObject({
      state: 'down',
      error: 'not_json',
    });
  });

  it('reads a page the browser could only reach: up on 2xx and 3xx, down on 4xx and 5xx', async () => {
    expect(
      (await probeOne(reach, 'https://x.example/', answer(200, 'text/plain'), clock(30))).state,
    ).toBe('up');
    expect(
      (await probeOne(reach, 'https://x.example/', answer(304, 'text/plain'), clock(30))).state,
    ).toBe('up');
    expect(
      await probeOne(reach, 'https://x.example/', answer(404, 'text/html'), clock(30)),
    ).toMatchObject({
      state: 'down',
      code: 404,
      error: 'status',
    });
  });

  it('is down with no code on a network error, and on a timeout', async () => {
    const broken: Fetch = async () => {
      throw new TypeError('network connection lost');
    };
    expect(await probeOne(jsonProbe, 'https://x.example/', broken, clock(5))).toMatchObject({
      state: 'down',
      code: null,
      error: 'network',
    });
    // A fetch that never settles, even when aborted.
    const hangs: Fetch = () => new Promise(() => {});
    const timedOut = await probeOne(jsonProbe, 'https://x.example/', hangs, Date.now, 20);
    expect(timedOut).toMatchObject({ state: 'down', code: null, error: 'timeout' });
    expect(timedOut.ms).toBeLessThanOrEqual(20);
  });

  it('never reads a body: it sends the probe’s method and a user agent', async () => {
    const seen: Request[] = [];
    await probeOne(reach, 'https://www.livediagram.app/robots.txt', async (r) => {
      seen.push(r);
      return new Response(null, { status: 200 });
    });
    expect(seen[0]!.method).toBe('HEAD');
    expect(seen[0]!.headers.get('User-Agent')).toMatch(/^liveworkspace-status\//);
  });
});

describe('pooled', () => {
  it('keeps at most six requests waiting at once, and answers in order', async () => {
    let inFlight = 0;
    let most = 0;
    const tasks = Array.from({ length: 27 }, (_, i) => async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(await pooled(tasks, PROBE_CONCURRENCY)).toEqual(tasks.map((_, i) => i));
    expect(most).toBe(PROBE_CONCURRENCY);
  });
});

describe('probeTargets', () => {
  it('checks liveworkspace’s own services and every app’s straight out', async () => {
    const viaFetch: string[] = [];
    const targets = probeTargets(
      testEnv(),
      async (r) => (viaFetch.push(r.url), new Response('{}')),
    );
    expect(targets).toHaveLength(27);
    await probeAll(targets);
    expect(viaFetch).toContain('https://lw.example/robots.txt');
    expect(viaFetch).toContain('https://www.liveplanner.app/api/capabilities');
    expect(viaFetch).toContain('https://mcp.livedesign.app/health');
    // livediagram on its own hosts, like the other apps.
    expect(viaFetch).toContain('https://www.livediagram.app/api/capabilities');
    expect(viaFetch).toContain('https://mcp.livediagram.app/health');
  });

  it('checks staging’s addresses on staging, and this machine’s in development', async () => {
    const staging = probeTargets(testEnv({ ENVIRONMENT: 'staging' }), fetch);
    expect(staging.map((t) => t.url)).toContain('https://staging.liveplanner.app/api/capabilities');
    // Staging has no public MCP host, so 4 fewer checks.
    expect(staging).toHaveLength(23);
    const seen: string[] = [];
    const dev = probeTargets(
      testEnv({
        ENVIRONMENT: 'development',
        PLATFORM_ORIGIN: 'http://localhost:3000',
      }),
      async (r) => (seen.push(r.url), new Response('{}')),
    );
    await probeAll(dev);
    expect(seen).toContain('http://localhost:3000/robots.txt');
    expect(seen).toContain('http://localhost:3100/api/capabilities');
  });
});
