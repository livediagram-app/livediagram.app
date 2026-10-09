// The device authorization grant (RFC 8628; docs/specs/015-api/blueprints/cli.md "The device grant", CLI36): a CLI on
// a machine without a browser shows a short code; the person opens /oauth/device anywhere, signs in, enters it and
// approves; the CLI, polling /oauth/token, receives the token the page minted. Built-in clients only. State lives in
// OAUTH_KV for DEVICE_CODE_TTL_S: `device:<device code>` and `usercode:<user code>`.

import { appBase } from './tool-helpers';
import {
  randomBase64Url,
  DEVICE_CODE_TTL_S,
  DEVICE_POLL_INTERVAL_S,
  DEVICE_SLOW_DOWN_S,
  formatUserCode,
  isUserCode,
  newUserCode,
  normaliseUserCode,
} from '@livediagram/api-schema';
import type { Context, Hono } from 'hono';
import type { Env } from './env';
import { BUILT_IN_CLIENTS } from './oauth-clients';

type DeviceRecord = {
  clientId: string;
  clientName: string;
  userCode: string;
  interval: number;
  // Epoch ms the record ends; KV's own TTL is set from it on every rewrite.
  endsAt: number;
  lastPolledAt?: number;
  status: 'pending' | 'approved' | 'denied';
  token?: string;
  expiresAt?: number;
};

// KV refuses a TTL under a minute.
const KV_MIN_TTL_S = 60;
const START_LIMIT = { max: 20, windowS: 3600 };
const LOOKUP_LIMIT = { max: 30, windowS: 600 };
const SIX_MONTHS_S = 60 * 60 * 24 * 180;

const deviceKey = (code: string) => `device:${code}`;
const userCodeKey = (code: string) => `usercode:${code}`;

const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.info(`[oauth] device ${event}`, fields);

// A per-IP counter in KV over a fixed window, as registration counts; true when the caller is over it.
async function overLimit(
  env: Env,
  name: string,
  ip: string,
  limit: { max: number; windowS: number },
): Promise<boolean> {
  const key = `${name}:${ip}`;
  const count = Number((await env.OAUTH_KV.get(key)) ?? '0');
  if (count >= limit.max) {
    console.warn(
      `[oauth] device ${name === 'device-start' ? 'authorization' : 'lookup'} rate-limited`,
    );
    return true;
  }
  await env.OAUTH_KV.put(key, String(count + 1), { expirationTtl: limit.windowS });
  return false;
}

const ipOf = (c: Context<{ Bindings: Env }>) => c.req.header('CF-Connecting-IP') ?? 'unknown';

async function save(env: Env, deviceCode: string, record: DeviceRecord): Promise<void> {
  const ttl = Math.max(KV_MIN_TTL_S, Math.ceil((record.endsAt - Date.now()) / 1000));
  await env.OAUTH_KV.put(deviceKey(deviceCode), JSON.stringify(record), { expirationTtl: ttl });
}

// The pending record a typed user code names, with its device code; null for an unknown or expired code.
async function pendingByUserCode(
  env: Env,
  typed: unknown,
): Promise<{ deviceCode: string; record: DeviceRecord } | null> {
  if (typeof typed !== 'string') return null;
  const userCode = normaliseUserCode(typed);
  if (!isUserCode(userCode)) return null;
  const deviceCode = await env.OAUTH_KV.get(userCodeKey(userCode));
  if (!deviceCode) return null;
  const record = await env.OAUTH_KV.get<DeviceRecord>(deviceKey(deviceCode), 'json');
  if (!record || record.status !== 'pending' || record.endsAt <= Date.now()) return null;
  return { deviceCode, record };
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function registerDeviceRoutes(app: Hono<{ Bindings: Env }>): void {
  app.post('/oauth/device_authorization', async (c) => {
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    const clientId = String(form.client_id ?? '');
    const client = BUILT_IN_CLIENTS[clientId];
    if (!client) return c.json({ error: 'invalid_client' }, 400);
    if (await overLimit(c.env, 'device-start', ipOf(c), START_LIMIT))
      return c.json({ error: 'rate_limited' }, 429);
    const deviceCode = randomBase64Url(32);
    const userCode = newUserCode(randomBytes);
    const record: DeviceRecord = {
      clientId,
      clientName: client.clientName,
      userCode,
      interval: DEVICE_POLL_INTERVAL_S,
      endsAt: Date.now() + DEVICE_CODE_TTL_S * 1000,
      status: 'pending',
    };
    await save(c.env, deviceCode, record);
    await c.env.OAUTH_KV.put(userCodeKey(userCode), deviceCode, {
      expirationTtl: DEVICE_CODE_TTL_S,
    });
    log('started', { clientId });
    const page = `${appBase(c.env)}/oauth/device`;
    return c.json({
      device_code: deviceCode,
      user_code: formatUserCode(userCode),
      verification_uri: page,
      verification_uri_complete: `${page}?code=${formatUserCode(userCode)}`,
      expires_in: DEVICE_CODE_TTL_S,
      interval: DEVICE_POLL_INTERVAL_S,
    });
  });

  // What the device page shows before approval: which client asks. The user code is the read capability.
  app.get('/oauth/device/session/:userCode', async (c) => {
    if (await overLimit(c.env, 'device-lookup', ipOf(c), LOOKUP_LIMIT))
      return c.json({ error: 'rate_limited' }, 429);
    const found = await pendingByUserCode(c.env, c.req.param('userCode'));
    if (!found) return c.json({ error: 'invalid_code' }, 404);
    return c.json({ clientName: found.record.clientName });
  });

  // The signed-in device page posts the token it minted for this code.
  app.post('/oauth/device/complete', async (c) => {
    // A user code is guessable only slowly: the same budget as a lookup, shared with it and with Deny.
    if (await overLimit(c.env, 'device-lookup', ipOf(c), LOOKUP_LIMIT))
      return c.json({ error: 'rate_limited' }, 429);
    const body = (await c.req.json().catch(() => ({}))) as {
      userCode?: unknown;
      token?: unknown;
      expiresAt?: unknown;
    };
    if (typeof body.token !== 'string' || !body.token)
      return c.json({ error: 'invalid_request' }, 400);
    const found = await pendingByUserCode(c.env, body.userCode);
    if (!found) return c.json({ error: 'invalid_code' }, 400);
    await save(c.env, found.deviceCode, {
      ...found.record,
      status: 'approved',
      token: body.token,
      ...(typeof body.expiresAt === 'number' ? { expiresAt: body.expiresAt } : {}),
    });
    await c.env.OAUTH_KV.delete(userCodeKey(found.record.userCode));
    log('authorised', { clientId: found.record.clientId });
    return c.json({ ok: true });
  });

  app.post('/oauth/device/deny', async (c) => {
    if (await overLimit(c.env, 'device-lookup', ipOf(c), LOOKUP_LIMIT))
      return c.json({ error: 'rate_limited' }, 429);
    const body = (await c.req.json().catch(() => ({}))) as { userCode?: unknown };
    const found = await pendingByUserCode(c.env, body.userCode);
    if (!found) return c.json({ error: 'invalid_code' }, 400);
    await save(c.env, found.deviceCode, { ...found.record, status: 'denied' });
    await c.env.OAUTH_KV.delete(userCodeKey(found.record.userCode));
    log('denied', { clientId: found.record.clientId });
    return c.json({ ok: true });
  });
}

// POST /oauth/token with the device grant: the CLI's poll.
export async function handleDeviceToken(
  c: Context<{ Bindings: Env }>,
  form: Record<string, unknown>,
): Promise<Response> {
  const deviceCode = String(form.device_code ?? '');
  const clientId = String(form.client_id ?? '');
  if (!BUILT_IN_CLIENTS[clientId]) return c.json({ error: 'invalid_client' }, 400);
  const record = deviceCode
    ? await c.env.OAUTH_KV.get<DeviceRecord>(deviceKey(deviceCode), 'json')
    : null;
  const now = Date.now();
  if (!record || record.endsAt <= now || record.clientId !== clientId) {
    log('expired');
    return c.json({ error: 'expired_token' }, 400);
  }
  if (record.status === 'denied') {
    await c.env.OAUTH_KV.delete(deviceKey(deviceCode));
    return c.json({ error: 'access_denied' }, 400);
  }
  if (record.status === 'approved') {
    await c.env.OAUTH_KV.delete(deviceKey(deviceCode));
    const expiresIn = record.expiresAt
      ? Math.max(0, Math.floor((record.expiresAt - now) / 1000))
      : SIX_MONTHS_S;
    return c.json({ access_token: record.token, token_type: 'Bearer', expires_in: expiresIn });
  }
  // Polling faster than the interval earns a longer one (RFC 8628 §3.5).
  if (record.lastPolledAt !== undefined && now - record.lastPolledAt < record.interval * 1000) {
    await save(c.env, deviceCode, {
      ...record,
      interval: record.interval + DEVICE_SLOW_DOWN_S,
      lastPolledAt: now,
    });
    log('slow_down', { clientId });
    return c.json({ error: 'slow_down' }, 400);
  }
  await save(c.env, deviceCode, { ...record, lastPolledAt: now });
  return c.json({ error: 'authorization_pending' }, 400);
}
