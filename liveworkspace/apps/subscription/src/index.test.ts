// The Worker's front door (subscription.md "The flag", "The subscription Worker"): with Pro off nothing answers,
// only the API's own path is served, pages get CORS and a failing database is a retryable 503.
import { unavailableD1 } from '@liveworkspace/api-kit/testing/unavailable-d1';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { testDb, type TestDb } from './test-sqlite-d1';
import { asApp, call, fromPage, signer, SITE, subscribe, type Signer } from './test-kit';

let keys: Signer;
beforeAll(async () => {
  keys = await signer();
});

let db: TestDb;
beforeEach(() => {
  db = testDb(keys.env);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const SESSION = 'a'.repeat(43);

describe('with Pro off', () => {
  const ROUTES: [string, string][] = [
    ['GET', '/prices'],
    ['GET', '/me'],
    ['GET', '/owner?scope=p:user_ada'],
    ['POST', '/checkout'],
    ['POST', '/portal'],
    ['GET', `/mock/checkout/${SESSION}`],
    ['POST', `/mock/checkout/${SESSION}`],
    ['GET', `/mock/portal/${SESSION}`],
    ['POST', `/mock/portal/${SESSION}`],
    ['POST', '/internal/entitlement'],
    ['POST', '/internal/spend'],
    ['POST', '/internal/gauge'],
    ['POST', '/internal/item-usage'],
    ['OPTIONS', '/me'],
    ['GET', ''],
    ['GET', '/nothing'],
  ];

  for (const flag of [undefined, 'false', '0', 'off', '', 'yes']) {
    it(`every route answers 404 when PRO_ENABLED is ${JSON.stringify(flag)}`, async () => {
      const off = testDb({ ...keys.env, PRO_ENABLED: flag });
      const prepare = vi.spyOn(off.env.SUBSCRIPTION_DB, 'prepare');
      const token = await keys.token('user_ada');
      for (const [method, path] of ROUTES) {
        const res = await call(off.env, path, {
          method,
          headers: {
            Origin: SITE,
            Authorization: path.startsWith('/internal') ? 'Bearer ld-key' : `Bearer ${token}`,
            'X-Subscription-App': 'livediagram.app',
            'Content-Type': 'application/json',
          },
          ...(method === 'POST'
            ? { body: JSON.stringify({ owner: 'p:user_ada', action: 'pay' }) }
            : {}),
        });
        expect(res.status, `${method} ${path}`).toBe(404);
        expect(res.headers.get('Access-Control-Allow-Origin'), `${method} ${path}`).toBeNull();
      }
      // Nothing is read: there is no service.
      expect(prepare).not.toHaveBeenCalled();
    });
  }

  for (const flag of ['true', 'TRUE', '1', ' on ']) {
    it(`answers when PRO_ENABLED is ${JSON.stringify(flag)}`, async () => {
      const on = testDb({ PRO_ENABLED: flag });
      expect((await call(on.env, '/prices')).status).toBe(200);
    });
  }

  it('the cron does nothing', async () => {
    const off = testDb({ PRO_ENABLED: 'false' });
    const waitUntil = vi.fn();
    worker.scheduled({} as ScheduledController, off.env, {
      waitUntil,
    } as unknown as ExecutionContext);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

describe('the front door', () => {
  it('serves only its own path', async () => {
    for (const path of ['/', '/api/subscriptions/prices', '/api/community', '/api/subscriptionx']) {
      const res = await worker.fetch(new Request(`https://www.liveworkspace.app${path}`), db.env);
      expect(res.status, path).toBe(404);
    }
    expect((await call(db.env, '/nothing')).status).toBe(404);
    expect((await call(db.env, '/hasOwnProperty')).status).toBe(404);
    expect((await call(db.env, '')).status).toBe(404);
  });

  it('answers the wrong method with 405', async () => {
    expect((await call(db.env, '/prices', { method: 'POST' })).status).toBe(405);
    expect((await call(db.env, '/me', { method: 'POST' })).status).toBe(405);
    expect((await call(db.env, '/checkout')).status).toBe(405);
    expect((await call(db.env, `/mock/checkout/${SESSION}`, { method: 'DELETE' })).status).toBe(
      405,
    );
  });

  it('runs the sweep on the cron, and a failing one is logged, not thrown', async () => {
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    } as unknown as ExecutionContext;
    await subscribe(db.env, 'p:user_ada', 0, { state: 'cancelling', period_end: 1 });
    worker.scheduled({} as ScheduledController, db.env, ctx);
    await Promise.all(waits);
    expect(db.sql.prepare('SELECT state FROM subscriptions').get()).toEqual({ state: 'ended' });

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    worker.scheduled(
      {} as ScheduledController,
      { ...db.env, SUBSCRIPTION_DB: unavailableD1() },
      ctx,
    );
    await Promise.all(waits);
    expect(error).toHaveBeenCalledWith('[subscription] sweep failed', expect.anything());
  });
});

describe('CORS', () => {
  const ORIGINS = {
    production: [
      'https://www.liveworkspace.app',
      'https://liveworkspace.app',
      'https://www.livediagram.app',
      'https://liveplanner.app',
      'https://www.livedocuments.app',
      'https://www.livedesign.app',
      'https://www.livehuddle.app',
    ],
    staging: ['https://staging.liveworkspace.app', 'https://staging.liveplanner.app'],
    development: [
      'http://localhost:3000',
      'http://localhost:3200',
      'http://localhost:3202',
      'http://127.0.0.1:3500',
    ],
  };
  const STRANGERS = {
    production: [
      'https://evil.example',
      'http://localhost:3000',
      'https://staging.liveplanner.app',
      'null',
    ],
    staging: ['https://www.liveplanner.app', 'http://localhost:3200'],
    development: ['https://evil.example'],
  };

  for (const environment of ['production', 'staging', 'development'] as const) {
    it(`answers the site's and every app's pages in ${environment}, and nobody else's`, async () => {
      const env = { ...db.env, ENVIRONMENT: environment, SITE_ORIGIN: ORIGINS[environment][0] };
      for (const origin of ORIGINS[environment]) {
        const res = await call(env, '/prices', { headers: { Origin: origin } });
        expect(res.headers.get('Access-Control-Allow-Origin'), origin).toBe(origin);
        expect(res.headers.get('Vary')).toContain('Origin');
        const pre = await call(env, '/checkout', {
          method: 'OPTIONS',
          headers: { Origin: origin },
        });
        expect(pre.status).toBe(204);
        expect(pre.headers.get('Access-Control-Allow-Origin'), origin).toBe(origin);
        expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
        expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      }
      for (const origin of STRANGERS[environment]) {
        const res = await call(env, '/prices', { headers: { Origin: origin } });
        expect(res.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
        const pre = await call(env, '/checkout', {
          method: 'OPTIONS',
          headers: { Origin: origin },
        });
        expect(pre.headers.get('Access-Control-Allow-Origin'), origin).toBeNull();
      }
    });
  }

  it('never allows credentials, and answers a request with no Origin plainly', async () => {
    const res = await call(db.env, '/prices', { headers: { Origin: 'http://localhost:3000' } });
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect((await call(db.env, '/prices')).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('is on a refusal too, so a page can read why', async () => {
    const res = await call(db.env, '/me', fromPage(null, undefined, 'http://localhost:3200'));
    expect(res.status).toBe(401);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3200');
  });
});

describe('when the database is down', () => {
  it('answers a retryable 503, with CORS for a page and none for an app', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = { ...db.env, SUBSCRIPTION_DB: unavailableD1() };
    const page = await call(
      down,
      '/me',
      fromPage(await keys.token('user_ada'), undefined, 'http://localhost:3000'),
    );
    expect(page.status).toBe(503);
    expect(page.headers.get('Retry-After')).toBe('5');
    expect(page.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(await page.json()).toEqual({ error: 'storage_unavailable' });
    const app = await asApp(down, '/spend', { owner: 'p:user_ada', meter: 'aiCredits', amount: 1 });
    expect(app.status).toBe(503);
    expect(app.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('route=POST /internal/spend'),
      expect.anything(),
    );
  });

  it('logs a route in words, never an id', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = { ...db.env, SUBSCRIPTION_DB: unavailableD1() };
    await call(down, `/mock/checkout/${SESSION}`);
    expect(error.mock.calls[0]?.[0]).toContain('route=GET /mock/checkout');
    expect(String(error.mock.calls[0]?.[0])).not.toContain(SESSION);
  });
});
