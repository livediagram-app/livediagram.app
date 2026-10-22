import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { describe, expect, it } from 'vitest';
import { PAGE_HEADERS, RETENTION_MS } from './config';
import worker from './index';
import { testEnv } from './test-env';

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
const get = (path: string) => new Request(`https://liveworkspace.app${path}`);

describe('telemetry worker', () => {
  it('takes events in, and counts them by app', async () => {
    const env = testEnv();
    const send = (app: string) =>
      worker.fetch(
        new Request('https://liveworkspace.app/api/telemetry/events', {
          method: 'POST',
          headers: { Origin: 'http://localhost:3000' },
          body: JSON.stringify({ app, events: [{ category: 'Document', action: 'Created' }] }),
        }),
        env,
        ctx,
      );
    const res = await send('livediagram.app');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    await send('liveplanner.app');
    await send('liveplanner.app');

    const all = (await (
      await worker.fetch(get('/api/telemetry/summary'), env, ctx)
    ).json()) as TelemetrySummary;
    expect(all.app).toBe('all');
    expect(all.windows.today.total).toBe(3);
    expect(all.windows.today.byApp).toEqual({ 'livediagram.app': 1, 'liveplanner.app': 2 });

    const one = (await (
      await worker.fetch(get('/api/telemetry/summary?app=liveplanner.app'), env, ctx)
    ).json()) as TelemetrySummary;
    expect(one.app).toBe('liveplanner.app');
    expect(one.windows.today.total).toBe(2);
  });

  it('refuses an unknown app filter, and answers disabled when off', async () => {
    expect(
      (await worker.fetch(get('/api/telemetry/summary?app=x.app'), testEnv(), ctx)).status,
    ).toBe(400);
    const off = await worker.fetch(
      get('/api/telemetry/summary'),
      testEnv({ TELEMETRY_ENABLED: 'false' }),
      ctx,
    );
    expect(await off.json()).toEqual({ enabled: false });
  });

  it('serves the dashboard from its assets, prefix stripped, with the page headers', async () => {
    const asked: string[] = [];
    const env = testEnv({
      ASSETS: {
        fetch: async (req: Request) => {
          asked.push(new URL(req.url).pathname);
          return new Response('ok');
        },
      } as unknown as Fetcher,
    });
    const res = await worker.fetch(get('/telemetry/_next/static/a.js'), env, ctx);
    await worker.fetch(get('/telemetry'), env, ctx);
    expect(asked).toEqual(['/_next/static/a.js', '/']);
    expect(res.headers.get('Content-Security-Policy')).toBe(
      PAGE_HEADERS['Content-Security-Policy'],
    );
    expect((await worker.fetch(get('/elsewhere'), env, ctx)).status).toBe(404);
    expect((await worker.fetch(get('/api/telemetry/nope'), env, ctx)).status).toBe(404);
  });

  it('keeps its API under /api: the old /telemetry/api path takes no events', async () => {
    const env = testEnv({
      ASSETS: {
        fetch: async () => new Response('not found', { status: 404 }),
      } as unknown as Fetcher,
    });
    const res = await worker.fetch(
      new Request('https://liveworkspace.app/telemetry/api/events', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000' },
        body: JSON.stringify({
          app: 'livediagram.app',
          events: [{ category: 'Document', action: 'Created' }],
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(404);
    expect(env.rows).toEqual([]);
  });

  it('sweeps rows older than 60 days', async () => {
    const env = testEnv();
    env.rows.push(
      {
        app: 'livediagram.app',
        category: 'Document',
        action: 'Created',
        type: null,
        ts: Date.now() - RETENTION_MS - 1,
      },
      {
        app: 'livediagram.app',
        category: 'Document',
        action: 'Created',
        type: null,
        ts: Date.now(),
      },
    );
    const waits: Promise<unknown>[] = [];
    await worker.scheduled({} as ScheduledController, env, {
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    } as unknown as ExecutionContext);
    await Promise.all(waits);
    expect(env.rows).toHaveLength(1);
  });
});
