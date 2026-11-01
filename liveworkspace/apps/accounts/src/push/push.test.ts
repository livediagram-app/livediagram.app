import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PUSH_DEVICES, type PushNotification } from '@liveworkspace/settings/push';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { handleAccountApi } from '../account-api.ts';
import type { Auth } from '../auth.ts';
import { __setBearerVerifier } from '../bearer.ts';
import type { Env } from '../env.ts';
import { writeSettings } from '../settings.ts';
import { addClient, addUser, testD1 } from '../test-d1.ts';
import {
  deliverPush,
  heldForQuietHours,
  isAppLink,
  MAX_PUSH_SENDS_PER_CALL,
  readNotifications,
} from './deliver.ts';
import {
  devicesOf,
  isPushEndpoint,
  listDevices,
  readRegistration,
  registerDevice,
} from './devices.ts';
import { toBase64Url } from './web-push.ts';

const BASE = 'https://www.liveworkspace.app';
const PLANNER = `Basic ${btoa('liveplanner:secret')}`;
const NO_APP = `Basic ${btoa('lonely:secret')}`;
const CLIENTS: Record<string, true> = { [PLANNER]: true, [NO_APP]: true };

const auth = {
  api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  handler: async (request: Request) =>
    CLIENTS[request.headers.get('authorization') ?? '']
      ? Response.json({ active: false })
      : new Response(null, { status: 401 }),
} as unknown as Auth;

let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;
let env: Env;
let db: D1Database;
let waits: Promise<unknown>[];

async function vapidPair() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
  ])) as CryptoKeyPair;
  const publicKey = toBase64Url(
    new Uint8Array((await crypto.subtle.exportKey('raw', keys.publicKey)) as ArrayBuffer),
  );
  const { d } = (await crypto.subtle.exportKey('jwk', keys.privateKey)) as JsonWebKey;
  return { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: d! };
}

// A browser's subscription keys: a real P-256 point and a 16-byte secret.
async function subscriptionKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  return {
    p256dh: toBase64Url(
      new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer),
    ),
    auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

const endpoint = (n: number | string) => `https://fcm.googleapis.com/fcm/send/device-${n}`;

beforeEach(async () => {
  const d1 = testD1();
  db = d1.db;
  addUser(d1.sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addUser(d1.sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  addClient(d1.sql, 'liveplanner', 'liveplanner.app');
  addClient(d1.sql, 'lonely', null);
  waits = [];
  env = {
    BASE_URL: BASE,
    ENVIRONMENT: 'production',
    AUTH_DB: db,
    ...(await vapidPair()),
  } as unknown as Env;
  signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
});

afterEach(() => {
  vi.unstubAllGlobals();
  __setBearerVerifier(null);
});

function call(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const method = init.method ?? 'GET';
  return handleAccountApi(
    new Request(`${BASE}/api/account${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(method === 'GET' ? {} : { origin: BASE }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
    auth,
    (promise) => void waits.push(promise),
  );
}

describe('registering a device', () => {
  it('takes only a push service on https', () => {
    expect(isPushEndpoint(endpoint(1))).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QAbc')).toBe(true);
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com:8443/fcm/send/x')).toBe(false);
    expect(isPushEndpoint('https://user:pw@fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('https://notfcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isPushEndpoint('not a url at all')).toBe(false);
    expect(isPushEndpoint(42)).toBe(false);
  });

  it('checks the keys and cleans the label', async () => {
    const keys = await subscriptionKeys();
    expect(readRegistration({ endpoint: endpoint(1), keys, label: '  iPhone‮  ' })).toEqual({
      endpoint: endpoint(1),
      ...keys,
      label: 'iPhone',
      app: 'liveworkspace',
    });
    expect(readRegistration({ endpoint: endpoint(1), keys })).toMatchObject({ label: 'A device' });
    expect(readRegistration({ endpoint: endpoint(1), keys, app: 'liveplanner' })).toMatchObject({
      app: 'liveplanner',
    });
    expect(readRegistration({ endpoint: endpoint(1), keys, app: 'evil' })).toMatchObject({
      app: 'liveworkspace',
    });
    expect(readRegistration({ endpoint: 'https://evil.example/x', keys })).toEqual({
      error: 'invalid_endpoint',
    });
    expect(readRegistration({ endpoint: endpoint(1), keys: { ...keys, auth: 'AAAA' } })).toEqual({
      error: 'invalid_keys',
    });
    expect(readRegistration({ endpoint: endpoint(1), keys: { ...keys, p256dh: 'AAAA' } })).toEqual({
      error: 'invalid_keys',
    });
    expect(readRegistration({ endpoint: endpoint(1) })).toEqual({ error: 'invalid_keys' });
  });

  it('keeps one row per browser, moves it to whoever registered last, and caps an account', async () => {
    const keys = await subscriptionKeys();
    const one = await registerDevice(
      db,
      'user_ada',
      { endpoint: endpoint(1), ...keys, app: 'liveworkspace' as const, label: 'Phone' },
      1,
    );
    const again = await registerDevice(
      db,
      'user_ada',
      { endpoint: endpoint(1), ...keys, app: 'liveworkspace' as const, label: 'Phone 2' },
      2,
    );
    expect(again.id).toBe(one.id);
    expect(await listDevices(db, 'user_ada')).toEqual([
      { id: one.id, label: 'Phone 2', app: 'liveworkspace', createdAt: 2, lastSentAt: null },
    ]);
    await registerDevice(
      db,
      'user_bea',
      { endpoint: endpoint(1), ...keys, app: 'liveworkspace' as const, label: 'Shared' },
      3,
    );
    expect(await listDevices(db, 'user_ada')).toEqual([]);
    for (let i = 0; i < MAX_PUSH_DEVICES + 2; i += 1)
      await registerDevice(
        db,
        'user_ada',
        { endpoint: endpoint(`a${i}`), ...keys, app: 'liveworkspace' as const, label: `D${i}` },
        10 + i,
      );
    const kept = await listDevices(db, 'user_ada');
    expect(kept).toHaveLength(MAX_PUSH_DEVICES);
    expect(kept[0]!.label).toBe(`D${MAX_PUSH_DEVICES + 1}`);
    expect(kept.map((d) => d.label)).not.toContain('D0');
    expect(await devicesOf(db, [])).toEqual([]);
  });
});

describe('the device routes', () => {
  it('lists, registers and removes the signed-in person’s devices, with the public key', async () => {
    const keys = await subscriptionKeys();
    const empty = (await (await call('/push/devices')).json()) as { publicKey: string };
    expect(empty).toEqual({ publicKey: env.VAPID_PUBLIC_KEY, devices: [] });
    const made = await call('/push/devices', {
      method: 'POST',
      body: { endpoint: endpoint(1), keys, label: 'iPhone, Safari' },
    });
    expect(made.status).toBe(201);
    const { device } = (await made.json()) as { device: { id: string } };
    expect(device.id).toMatch(/^pd_[0-9a-f]{32}$/);
    const listed = (await (await call('/push/devices')).json()) as { devices: unknown[] };
    expect(listed.devices).toHaveLength(1);

    // Someone else can't remove it.
    signedIn = { id: 'user_bea', name: 'Bea', email: 'bea@example.com', emailVerified: true };
    expect((await call(`/push/devices/${device.id}`, { method: 'DELETE' })).status).toBe(404);
    signedIn = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
    expect((await call(`/push/devices/${device.id}`, { method: 'DELETE' })).status).toBe(200);
    expect((await call(`/push/devices/${device.id}`, { method: 'DELETE' })).status).toBe(404);
    expect((await call('/push/devices/nope', { method: 'DELETE' })).status).toBe(404);
  });

  it('refuses a bad registration, a write from another site, signed out, and a path it has not', async () => {
    expect((await call('/push/devices', { method: 'POST', body: { endpoint: 'x' } })).status).toBe(
      400,
    );
    expect(
      (
        await call('/push/devices', {
          method: 'POST',
          body: {},
          headers: { origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
    expect((await call('/push/devices/a/b')).status).toBe(404);
    expect((await call('/push/devices', { method: 'PATCH', body: {} })).status).toBe(404);
    expect((await call('/push/other')).status).toBe(404);
    signedIn = null;
    expect((await call('/push/devices')).status).toBe(401);
  });

  it('answers no key, and takes no device, when the deployment has no VAPID pair', async () => {
    env = { ...env, VAPID_PUBLIC_KEY: undefined } as Env;
    expect(await (await call('/push/devices')).json()).toEqual({ publicKey: null, devices: [] });
    const keys = await subscriptionKeys();
    const refused = await call('/push/devices', {
      method: 'POST',
      body: { endpoint: endpoint(1), keys },
    });
    expect(refused.status).toBe(503);
  });

  it("answers an app's bearer the same way, on its own address", async () => {
    signedIn = null;
    __setBearerVerifier(
      () => async (token) =>
        token === 'tok-ada'
          ? {
              kind: 'account',
              userId: 'user_ada',
              email: 'ada@example.com',
              emailVerified: true,
              scopes: [],
              teams: null,
            }
          : token === 'tok-guest'
            ? { kind: 'guest', guestId: 'guest_00000000-0000-4000-8000-000000000009' }
            : null,
    );
    const keys = await subscriptionKeys();
    const headers = { authorization: 'Bearer tok-ada', origin: 'https://www.liveplanner.app' };
    const made = await call('/push/devices', {
      method: 'POST',
      body: { endpoint: endpoint(2), keys, label: 'Pixel', app: 'liveplanner' },
      headers,
    });
    expect(made.status).toBe(201);
    const listed = (await (await call('/push/devices', { headers })).json()) as {
      devices: { label: string; app: string }[];
    };
    expect(listed.devices.map((d) => [d.label, d.app])).toEqual([['Pixel', 'liveplanner']]);
    expect(
      (await call('/push/devices', { headers: { authorization: 'Bearer tok-guest' } })).status,
    ).toBe(401);
    expect((await call('/push/elsewhere', { headers })).status).toBe(404);
  });
});

describe('an app asking for notifications', () => {
  const link = 'https://www.liveplanner.app/project/p1#item=c1';
  const note = (over: Record<string, unknown> = {}): PushNotification =>
    ({
      userId: 'user_bea',
      kind: 'mention',
      title: 'Ada mentioned you in Roadmap',
      url: link,
      ...over,
    }) as PushNotification;

  it('checks every notification, and links only to the app’s own addresses', () => {
    expect(isAppLink(link, 'liveplanner.app', 'production')).toBe(true);
    expect(isAppLink('https://liveplanner.app/project/p1', 'liveplanner.app', 'production')).toBe(
      true,
    );
    expect(
      isAppLink('https://www.livediagram.app/document/d', 'liveplanner.app', 'production'),
    ).toBe(false);
    expect(isAppLink('http://localhost:3200/project/p1', 'liveplanner.app', 'development')).toBe(
      true,
    );
    expect(isAppLink('nope', 'liveplanner.app', 'production')).toBe(false);
    const read = (body: Record<string, unknown>) =>
      readNotifications(body, 'liveplanner.app', 'production');
    expect(
      read({ notifications: [note({ tag: 'p1:c1', title: `  ${'x'.repeat(200)}` })] }),
    ).toEqual({
      ok: true,
      notifications: [note({ tag: 'p1:c1', title: 'x'.repeat(120) })],
    });
    expect(read({})).toEqual({ ok: false, error: 'notifications_required' });
    expect(read({ notifications: Array.from({ length: 51 }, () => note()) })).toEqual({
      ok: false,
      error: 'too_many_notifications',
    });
    expect(read({ notifications: [note({ userId: 'guest_x' })] })).toMatchObject({
      error: 'invalid_user',
    });
    expect(read({ notifications: [note({ kind: 'tip' })] })).toMatchObject({
      error: 'invalid_kind',
    });
    expect(read({ notifications: [note({ title: '   ' })] })).toMatchObject({
      error: 'invalid_title',
    });
    expect(read({ notifications: [note({ url: 'https://evil.example/' })] })).toMatchObject({
      error: 'invalid_url',
    });
    expect(read({ notifications: [note({ tag: 'has space' })] })).toMatchObject({
      error: 'invalid_tag',
    });
    expect(read({ notifications: [null] })).toMatchObject({ error: 'invalid_user' });
  });

  it('answers 202 at once and sends after the answer; refuses a client that is no app', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    const keys = await subscriptionKeys();
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Bea',
    });
    const internal = (body: unknown, authorization = PLANNER) =>
      call('/internal/push', { method: 'POST', body, headers: { authorization } });
    const answer = await internal({ notifications: [note()] });
    expect(answer.status).toBe(202);
    expect(await answer.json()).toEqual({ accepted: 1 });
    expect(waits).toHaveLength(1);
    await Promise.all(waits);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      (await internal({ notifications: [note({ url: 'https://evil.example/' })] })).status,
    ).toBe(400);
    expect((await internal({ notifications: [note()] }, NO_APP)).status).toBe(403);
  });

  it('sends to every device whose switch is on, encrypted and signed, and forgets the ones gone', async () => {
    const keys = await subscriptionKeys();
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b1'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Phone',
    });
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b2'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Tablet',
    });
    await registerDevice(db, 'user_ada', {
      endpoint: endpoint('a1'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Ada',
    });
    // Ada turned replies in her threads off.
    await writeSettings(db, 'user_ada', null, { all: { pushThreadReplies: false } });
    const posted: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      posted.push({ url, init });
      return new Response(null, { status: url.endsWith('b2') ? 410 : 201 });
    }) as unknown as typeof fetch;
    const summary = await deliverPush(
      env,
      'liveplanner.app',
      [note(), note({ userId: 'user_ada', kind: 'threadReply' })],
      fetcher,
      5_000,
    );
    expect(summary).toEqual({ sent: 1, gone: 1, failed: 0, skipped: 0 });
    expect(posted.map((p) => p.url).sort()).toEqual([endpoint('b1'), endpoint('b2')]);
    const headers = posted[0]!.init.headers as Record<string, string>;
    expect(headers['content-encoding']).toBe('aes128gcm');
    expect(headers.ttl).toBe('14400');
    expect(headers.authorization).toMatch(/^vapid t=.+, k=/);
    expect(await listDevices(db, 'user_bea')).toEqual([
      expect.objectContaining({ label: 'Phone', lastSentAt: 5_000 }),
    ]);
  });

  it('counts a refusal or a failed post, and sends nothing without a VAPID pair', async () => {
    const keys = await subscriptionKeys();
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b1'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Phone',
    });
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b2'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Tablet',
    });
    const fetcher = (async (url: string) => {
      if (url.endsWith('b2')) throw new Error('offline');
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    expect(await deliverPush(env, 'liveplanner.app', [note()], fetcher)).toEqual({
      sent: 0,
      gone: 0,
      failed: 2,
      skipped: 0,
    });
    const none = vi.fn();
    expect(
      await deliverPush(
        { ...env, VAPID_PRIVATE_KEY: 'bad' } as Env,
        'liveplanner.app',
        [note()],
        none,
      ),
    ).toEqual({ sent: 0, gone: 0, failed: 0, skipped: 1 });
    expect(
      await deliverPush(
        { ...env, VAPID_PRIVATE_KEY: undefined } as Env,
        'liveplanner.app',
        [note()],
        none,
      ),
    ).toMatchObject({ skipped: 1 });
    expect(none).not.toHaveBeenCalled();
  });

  it('removes a device whose stored keys no longer encrypt, and never throws', async () => {
    const keys = await subscriptionKeys();
    await registerDevice(db, 'user_bea', {
      endpoint: endpoint('b1'),
      ...keys,
      app: 'liveworkspace' as const,
      label: 'Phone',
    });
    // A point that is no point on the curve, written straight into the row.
    const offCurve = toBase64Url(Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1)));
    await db.prepare('UPDATE push_device SET p256dh = ?').bind(offCurve).run();
    const none = vi.fn();
    expect(await deliverPush(env, 'liveplanner.app', [note()], none)).toMatchObject({ gone: 1 });
    expect(await listDevices(db, 'user_bea')).toEqual([]);
    const broken = {
      ...env,
      AUTH_DB: {
        prepare: () => {
          throw new Error('down');
        },
      },
    } as unknown as Env;
    expect(await deliverPush(broken, 'liveplanner.app', [note()], none)).toEqual({
      sent: 0,
      gone: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it('holds the posts of one request to the cap, and counts a failed switch read as on', async () => {
    const keys = await subscriptionKeys();
    for (let i = 0; i < MAX_PUSH_DEVICES; i += 1)
      await registerDevice(
        db,
        'user_bea',
        { endpoint: endpoint(`c${i}`), ...keys, app: 'liveworkspace' as const, label: `D${i}` },
        i,
      );
    let posts = 0;
    const fetcher = (async () => {
      posts += 1;
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const many = Array.from({ length: 25 }, () => note());
    let summary!: Awaited<ReturnType<typeof deliverPush>>;
    const cpuMs = await cpuMsOfAsync(async () => {
      summary = await deliverPush(env, 'liveplanner.app', many, fetcher);
    });
    expect(posts).toBe(MAX_PUSH_SENDS_PER_CALL);
    expect(summary.skipped).toBe(25 * MAX_PUSH_DEVICES - MAX_PUSH_SENDS_PER_CALL);
    // The worst case one request can ask for (200 encryptions and posts) stays well inside a Worker's budget.
    expect(cpuMs).toBeLessThan(cpuBudgetMs(5_000));
  });

  it('has a hook for quiet hours that holds nothing yet', () => {
    expect(heldForQuietHours('user_ada', Date.now())).toBe(false);
  });
});
