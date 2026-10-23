import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { describe, expect, it } from 'vitest';
import { RETENTION_MS } from './config';
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
          headers: { Origin: 'http://localhost:3100' },
          body: JSON.stringify({
            app,
            // Each app's own word for what it makes: liveplanner's is a project.
            events: [
              { category: app === 'liveplanner.app' ? 'Project' : 'Document', action: 'Created' },
            ],
          }),
        }),
        env,
        ctx,
      );
    const res = await send('livediagram.app');
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    await send('liveplanner.app');
    await send('liveplanner.app');
    await send('livedocuments.app');
    await send('livedesign.app');

    const all = (await (
      await worker.fetch(get('/api/telemetry/summary'), env, ctx)
    ).json()) as TelemetrySummary;
    expect(all.app).toBe('all');
    expect(all.windows.today.total).toBe(5);
    expect(all.windows.today.byApp).toEqual({
      'livediagram.app': 1,
      'liveplanner.app': 2,
      'livedocuments.app': 1,
      'livedesign.app': 1,
    });

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

  it("answers nothing outside its API: every page is the static site's", async () => {
    const env = testEnv();
    for (const path of [
      '/telemetry',
      '/telemetry/_next/static/a.js',
      '/elsewhere',
      '/api/telemetry/nope',
    ])
      expect((await worker.fetch(get(path), env, ctx)).status).toBe(404);
  });

  it('keeps its API under /api: the old /telemetry/api path takes no events', async () => {
    const env = testEnv();
    const res = await worker.fetch(
      new Request('https://liveworkspace.app/telemetry/api/events', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3100' },
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
