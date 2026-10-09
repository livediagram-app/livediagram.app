import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLI_CLIENT_ID,
  DEVICE_CODE_GRANT,
  DEVICE_CODE_TTL_S,
  DEVICE_SLOW_DOWN_S,
} from '@livediagram/api-schema';
import type { Env } from './env';
import { registerOauthRoutes } from './oauth';

// The device grant (docs/specs/015-api/blueprints/cli.md "The device grant", CLI36).

function mockKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string, type?: string) => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => void m.set(k, v),
    delete: async (k: string) => void m.delete(k),
  } as unknown as KVNamespace;
}

let app: Hono<{ Bindings: Env }>;
let env: Env;
let now: number;

beforeEach(() => {
  app = new Hono<{ Bindings: Env }>();
  registerOauthRoutes(app);
  env = { OAUTH_KV: mockKV(), API: {} as Fetcher, CONSENT_BASE_URL: 'https://live.test' };
  now = Date.UTC(2026, 9, 6, 12);
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const form = (fields: Record<string, string>, ip = '1.2.3.4') => ({
  method: 'POST',
  body: new URLSearchParams(fields).toString(),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': ip },
});
const json = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

type Started = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
};

async function start(): Promise<Started> {
  const res = await app.request(
    '/oauth/device_authorization',
    form({ client_id: CLI_CLIENT_ID }),
    env,
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Started;
}

const poll = async (deviceCode: string, clientId = CLI_CLIENT_ID) => {
  const res = await app.request(
    '/oauth/token',
    form({ grant_type: DEVICE_CODE_GRANT, device_code: deviceCode, client_id: clientId }),
    env,
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};

describe('starting', () => {
  it('hands out a device code, a short user code and the page to enter it on', async () => {
    const s = await start();
    expect(s.device_code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s.user_code).toMatch(/^[B-Z]{4}-[B-Z]{4}$/);
    expect(s.verification_uri).toBe('https://live.test/oauth/device');
    expect(s.verification_uri_complete).toBe(`https://live.test/oauth/device?code=${s.user_code}`);
    expect([s.expires_in, s.interval]).toEqual([DEVICE_CODE_TTL_S, 5]);
  });

  it('refuses a client it did not ship, and more than 20 starts an hour from one address', async () => {
    const other = await app.request('/oauth/device_authorization', form({ client_id: 'abc' }), env);
    expect(await other.json()).toEqual({ error: 'invalid_client' });
    for (let i = 0; i < 20; i++) await start();
    const limited = await app.request(
      '/oauth/device_authorization',
      form({ client_id: CLI_CLIENT_ID }),
      env,
    );
    expect(limited.status).toBe(429);
    const elsewhere = await app.request(
      '/oauth/device_authorization',
      form({ client_id: CLI_CLIENT_ID }, '5.6.7.8'),
      env,
    );
    expect(elsewhere.status).toBe(200);
  });
});

describe('the device page', () => {
  it('names the client for a code typed any way, and refuses an unknown one', async () => {
    const s = await start();
    const typed = s.user_code.toLowerCase().replace('-', ' ');
    const found = await app.request(`/oauth/device/session/${encodeURIComponent(typed)}`, {}, env);
    expect(await found.json()).toEqual({ clientName: 'livediagram CLI' });
    expect((await app.request('/oauth/device/session/BBBB-BBBB', {}, env)).status).toBe(404);
    expect((await app.request('/oauth/device/session/nope', {}, env)).status).toBe(404);
  });

  it('caps lookups at 30 in ten minutes from one address', async () => {
    for (let i = 0; i < 30; i++) await app.request('/oauth/device/session/BBBB-BBBB', {}, env);
    expect((await app.request('/oauth/device/session/BBBB-BBBB', {}, env)).status).toBe(429);
  });

  it('caps completions and denials on the same budget, so user codes cannot be sprayed', async () => {
    for (let i = 0; i < 30; i++)
      await app.request('/oauth/device/complete', json({ userCode: 'BBBB-BBBB', token: 't' }), env);
    expect(
      (
        await app.request(
          '/oauth/device/complete',
          json({ userCode: 'BBBB-BBBB', token: 't' }),
          env,
        )
      ).status,
    ).toBe(429);
    expect(
      (await app.request('/oauth/device/deny', json({ userCode: 'BBBB-BBBB' }), env)).status,
    ).toBe(429);
  });
});

describe('polling', () => {
  it('is pending, slows a poll that comes too soon, then hands over the approved token once', async () => {
    const s = await start();
    expect((await poll(s.device_code)).body).toEqual({ error: 'authorization_pending' });
    now += 1000;
    expect((await poll(s.device_code)).body).toEqual({ error: 'slow_down' });
    now += (5 + DEVICE_SLOW_DOWN_S) * 1000;
    expect((await poll(s.device_code)).body).toEqual({ error: 'authorization_pending' });
    const done = await app.request(
      '/oauth/device/complete',
      json({ userCode: s.user_code, token: 'lvd_x', expiresAt: now + 3_600_000 }),
      env,
    );
    expect(await done.json()).toEqual({ ok: true });
    expect((await app.request(`/oauth/device/session/${s.user_code}`, {}, env)).status).toBe(404);
    expect((await poll(s.device_code)).body).toEqual({
      access_token: 'lvd_x',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    expect((await poll(s.device_code)).body).toEqual({ error: 'expired_token' });
  });

  it('reports a denial once, and an expired or foreign code', async () => {
    const s = await start();
    expect(
      await (await app.request('/oauth/device/deny', json({ userCode: s.user_code }), env)).json(),
    ).toEqual({ ok: true });
    expect((await poll(s.device_code)).body).toEqual({ error: 'access_denied' });
    expect((await poll(s.device_code)).body).toEqual({ error: 'expired_token' });
    const late = await start();
    expect((await poll(late.device_code, 'abc')).body).toEqual({ error: 'invalid_client' });
    now += DEVICE_CODE_TTL_S * 1000;
    expect((await poll(late.device_code)).body).toEqual({ error: 'expired_token' });
    expect((await poll('')).body).toEqual({ error: 'expired_token' });
  });

  it('gives the full token life when the page sent no expiry', async () => {
    const s = await start();
    await app.request(
      '/oauth/device/complete',
      json({ userCode: s.user_code, token: 'lvd_y' }),
      env,
    );
    expect((await poll(s.device_code)).body).toMatchObject({ expires_in: 60 * 60 * 24 * 180 });
  });

  it('refuses a completion or denial without a token or a live code', async () => {
    const s = await start();
    expect(
      (await app.request('/oauth/device/complete', json({ userCode: s.user_code }), env)).status,
    ).toBe(400);
    expect(
      await (
        await app.request(
          '/oauth/device/complete',
          json({ userCode: 'BBBB-BBBB', token: 't' }),
          env,
        )
      ).json(),
    ).toEqual({ error: 'invalid_code' });
    expect((await app.request('/oauth/device/deny', json({ userCode: 7 }), env)).status).toBe(400);
    now += DEVICE_CODE_TTL_S * 1000;
    expect(
      (await app.request('/oauth/device/deny', json({ userCode: s.user_code }), env)).status,
    ).toBe(400);
  });
});

describe('malformed requests', () => {
  it('answers each with its refusal, and a host without a consent base links livediagram.app', async () => {
    const bad = { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } };
    expect((await app.request('/oauth/device/complete', bad, env)).status).toBe(400);
    expect((await app.request('/oauth/device/deny', bad, env)).status).toBe(400);
    const empty = {
      method: 'POST',
      body: 'x',
      headers: { 'Content-Type': 'multipart/form-data; boundary=z' },
    };
    expect(await (await app.request('/oauth/device_authorization', empty, env)).json()).toEqual({
      error: 'invalid_client',
    });
    expect(
      await (
        await app.request('/oauth/token', form({ grant_type: DEVICE_CODE_GRANT }), env)
      ).json(),
    ).toEqual({ error: 'invalid_client' });
    delete env.CONSENT_BASE_URL;
    expect((await start()).verification_uri).toBe('https://livediagram.app/oauth/device');
  });
});
