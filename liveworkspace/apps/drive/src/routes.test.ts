// The Worker's routes (liveworkspace/docs/specs/005-drive/drive.md "The service"): who may call what, the 503 when not configured,
// config's cheap answer, the state and consent round trip, Google's push, and the index's and accounts' calls, over
// the test harness's mirror standing in for the Durable Object.
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { channelToken } from './channel-token';
import type { Env } from './env';
import { handle } from './dispatch';
import type { MirrorApi, RouteDeps } from './routes';
import { GOOGLE_USER, harness, ORIGIN, PERSON, TOKEN_KEY, type Harness } from './test-support';

const ACCOUNTS = 'https://accounts.test';
const ISSUER = `${ACCOUNTS}/api/auth`;
const AUDIENCE = 'https://liveplanner.app/api';

let key: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  key = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'acc1', alg: 'EdDSA' };
});

function token(sub: string, claims: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'acc1' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

const ENV = {
  ENVIRONMENT: 'development',
  GOOGLE_CLIENT_ID: 'client',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_PICKER_KEY: 'picker',
  GOOGLE_APP_ID: '123',
  DRIVE_TOKEN_KEY: TOKEN_KEY,
  DRIVE_PUBLIC_URL: ORIGIN,
  ACCOUNTS_URL: ACCOUNTS,
  INDEX_AUDIENCES: AUDIENCE,
  DRIVE_KEY_INDEX: 'index-key',
  DRIVE_KEY_ACCOUNTS: 'accounts-key',
  APP_ORIGIN_LIVEPLANNER: 'http://localhost:3200',
} as unknown as Env;

let h: Harness;
let deps: RouteDeps;
let pending: Promise<unknown>[];
let objectWakes: number;

/** The harness's mirror as the routes see the object: every call a promise. */
function asObject(): MirrorApi {
  const m = h.mirror;
  const wake = () => objectWakes++;
  return {
    isConnected: async (p) => (wake(), m.isConnected(p)),
    connectGoogle: (p, code, uri) => (wake(), m.connect(p, code, uri)),
    connection: async (p) => (wake(), m.connectionSummary(p)),
    confirmSwitch: (p) => (wake(), m.confirmSwitch(p)),
    cancelSwitch: (p) => (wake(), m.cancelSwitch(p)),
    disconnect: (p) => (wake(), m.disconnect(p)),
    signal: (p) => (wake(), m.signal(p)),
    check: (p) => (wake(), m.check(p)),
    marks: async (p) => (wake(), m.marks(p)),
    pickerToken: (p) => (wake(), m.pickerToken(p)),
    adopt: (p, f, i) => (wake(), m.adopt(p, f, i)),
    open: (p, t) => (wake(), m.open(p, t)),
    importFile: (p, t) => (wake(), m.importFile(p, t)),
  };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === `${ISSUER}/jwks`) return Response.json({ keys: [jwk] });
    throw new Error(`unexpected fetch ${url}`);
  });
  h = harness();
  pending = [];
  objectWakes = 0;
  const object = asObject();
  deps = {
    mirrors: () => object,
    index: h.index,
    now: h.clock.now,
    waitUntil: (p) => pending.push(p),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function call(
  path: string,
  {
    method = 'GET',
    body,
    bearer,
    env = ENV,
    headers = {},
  }: {
    method?: string;
    body?: unknown;
    bearer?: string;
    env?: Env;
    headers?: Record<string, string>;
  } = {},
) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (bearer) (init.headers as Record<string, string>).Authorization = `Bearer ${bearer}`;
  if (body !== undefined) init.body = JSON.stringify(body);
  return handle(new Request(`${ORIGIN}${path}`, init), env, deps);
}

describe('config', () => {
  it('says not enabled without the client, the secret or a valid key, and refuses every other route', async () => {
    for (const off of [
      { GOOGLE_CLIENT_ID: '' },
      { GOOGLE_CLIENT_SECRET: undefined },
      { DRIVE_TOKEN_KEY: 'short' },
    ]) {
      const env = { ...ENV, ...off } as Env;
      const res = await call('/api/drive/config', { env });
      expect(await res.json()).toEqual({
        enabled: false,
        connected: false,
        clientId: null,
        pickerKey: null,
        appId: null,
      });
      const marks = await call('/api/drive/marks', { env, bearer: await token(PERSON) });
      expect(marks.status).toBe(503);
      expect(await marks.json()).toEqual({ error: 'drive_not_configured' });
    }
  });

  it('answers from the index’s flag, never waking the object, and connected false for a guest', async () => {
    h.index.mirrored.add(PERSON);
    const res = await call('/api/drive/config', { bearer: await token(PERSON) });
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      enabled: true,
      connected: true,
      clientId: 'client',
      pickerKey: 'picker',
      appId: '123',
    });
    const guest = await call('/api/drive/config', {
      bearer: await token('guest_1', { kind: 'guest' }),
    });
    expect(await guest.json()).toMatchObject({ enabled: true, connected: false });
    expect(objectWakes).toBe(0);
  });

  it('asks the object only when the index can’t say', async () => {
    h.index.isMirrored = async () => null;
    await call('/api/drive/config', { bearer: await token(PERSON) });
    expect(objectWakes).toBe(1);
  });
});

describe('who may call', () => {
  it('refuses a guest, a bad token and none with 401', async () => {
    for (const bearer of [await token('guest_1', { kind: 'guest' }), 'nonsense', undefined]) {
      const res = await call('/api/drive/connection', { bearer });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorised' });
    }
    expect(objectWakes).toBe(0);
  });

  it('answers 404 for an unknown route or method', async () => {
    const bearer = await token(PERSON);
    expect((await call('/api/drive/nope', { bearer })).status).toBe(404);
    expect((await call('/api/drive/marks', { method: 'DELETE', bearer })).status).toBe(404);
    expect((await call('/api/drive/marks/x', { bearer })).status).toBe(404);
    expect((await call('/elsewhere', { bearer })).status).toBe(404);
  });
});

describe('connecting through the routes', () => {
  it('signs a state, keeps returnTo to this environment’s pages, and connects with the code', async () => {
    const bearer = await token(PERSON);
    const res = await call('/api/drive/state', {
      method: 'POST',
      bearer,
      body: { returnTo: 'http://localhost:3200/explorer?x=1' },
    });
    const answer = (await res.json()) as { state: string; authUrl: string; redirectUri: string };
    expect(answer.redirectUri).toBe(`${ORIGIN}/drive/connected`);
    const auth = new URL(answer.authUrl);
    expect(auth.origin + auth.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(auth.searchParams.get('access_type')).toBe('offline');
    expect(auth.searchParams.get('prompt')).toBe('consent');
    expect(auth.searchParams.get('state')).toBe(answer.state);

    const connect = await call('/api/drive/connect', {
      method: 'POST',
      bearer,
      body: { code: h.google.consent(GOOGLE_USER), state: answer.state },
    });
    expect(await connect.json()).toEqual({
      outcome: 'connected',
      returnTo: 'http://localhost:3200/explorer?x=1',
    });
    expect(h.index.mirrored.has(PERSON)).toBe(true);
    const connection = await call('/api/drive/connection', { bearer });
    expect(await connection.json()).toMatchObject({ connected: true, status: 'ok' });
  });

  it('sends returnTo elsewhere back to the Explorer, and refuses a state for someone else', async () => {
    const res = await call('/api/drive/state', {
      method: 'POST',
      bearer: await token(PERSON),
      body: { returnTo: 'https://evil.test/' },
    });
    const { state } = (await res.json()) as { state: string };
    const other = await call('/api/drive/connect', {
      method: 'POST',
      bearer: await token('user_bob'),
      body: { code: 'c', state },
    });
    expect(other.status).toBe(400);
    expect(await other.json()).toEqual({ error: 'invalid_state' });
    const self = await call('/api/drive/connect', {
      method: 'POST',
      bearer: await token(PERSON),
      body: { code: h.google.consent(GOOGLE_USER), state },
    });
    expect(await self.json()).toMatchObject({ returnTo: `${ORIGIN}/explorer` });
  });

  it('disconnects with DELETE /connection, and 404s an account switch that isn’t pending', async () => {
    const bearer = await token(PERSON);
    await h.connect();
    expect((await call('/api/drive/account-switch', { method: 'POST', bearer })).status).toBe(404);
    expect((await call('/api/drive/connection', { method: 'DELETE', bearer })).status).toBe(204);
    expect(h.index.mirrored.has(PERSON)).toBe(false);
  });

  it('refuses Check now and the Picker for someone not connected', async () => {
    const bearer = await token(PERSON);
    const check = await call('/api/drive/check', { method: 'POST', bearer });
    expect(check.status).toBe(404);
    expect(await check.json()).toEqual({ error: 'not_connected' });
    expect((await call('/api/drive/picker-token', { method: 'POST', bearer })).status).toBe(404);
  });

  it('refuses a malformed open, import or adopt', async () => {
    const bearer = await token(PERSON);
    for (const route of ['open', 'import', 'adopt']) {
      const res = await call(`/api/drive/${route}`, {
        method: 'POST',
        bearer,
        body: { fileId: 42 },
      });
      expect(res.status).toBe(400);
    }
  });
});

describe('Google’s push', () => {
  it('signals the person its token names, ignores sync and strangers, and always answers 200', async () => {
    await h.connect();
    await h.runDue();
    const token = await channelToken(TOKEN_KEY, PERSON);
    const push = (headers: Record<string, string>) =>
      call('/api/drive/push', { method: 'POST', headers });

    expect(
      (await push({ 'X-Goog-Resource-State': 'sync', 'X-Goog-Channel-Token': token })).status,
    ).toBe(200);
    expect(pending).toHaveLength(0);
    expect(
      (await push({ 'X-Goog-Resource-State': 'change', 'X-Goog-Channel-Token': 'user_ada.forged' }))
        .status,
    ).toBe(200);
    expect(pending).toHaveLength(0);
    const before = h.alarm.at;
    expect(
      (await push({ 'X-Goog-Resource-State': 'change', 'X-Goog-Channel-Token': token })).status,
    ).toBe(200);
    await Promise.all(pending);
    expect(h.alarm.at).toBe(h.clock.now() + 30_000);
    expect(h.alarm.at).not.toBe(before);
  });
});

describe('open and import', () => {
  it('answer 502 google_failed, never a 500, when Google, the index or a door fails unexpectedly', async () => {
    await h.connect();
    const object = asObject();
    const boom = async () => {
      throw Object.assign(new Error('upstream'), { name: 'DriveApiError', status: 503 });
    };
    deps = { ...deps, mirrors: () => ({ ...object, open: boom, importFile: boom }) };
    for (const route of ['open', 'import']) {
      const res = await call(`/api/drive/${route}`, {
        method: 'POST',
        bearer: await token(PERSON),
        body: { fileId: 'file_1' },
      });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'google_failed' });
    }
  });

  it('answers 413 file_too_large for a file bigger than an import takes', async () => {
    await h.connect();
    const object = asObject();
    deps = {
      ...deps,
      mirrors: () => ({
        ...object,
        importFile: async () => ({ refused: 'file_too_large' as const }),
      }),
    };
    const res = await call('/api/drive/import', {
      method: 'POST',
      bearer: await token(PERSON),
      body: { fileId: 'file_1' },
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'file_too_large' });
  });
});

describe('the index’s and accounts’ calls', () => {
  it('takes the index’s signal with its key only', async () => {
    await h.connect();
    await h.runDue();
    const body = { personId: PERSON, at: h.clock.now() };
    expect(
      (await call('/app/changes', { method: 'POST', body, bearer: 'accounts-key' })).status,
    ).toBe(401);
    expect(
      (await call('/app/changes', { method: 'POST', body: { personId: 1 }, bearer: 'index-key' }))
        .status,
    ).toBe(400);
    expect((await call('/app/changes', { method: 'POST', body, bearer: 'index-key' })).status).toBe(
      204,
    );
    expect(h.alarm.at).toBe(h.clock.now() + 30_000);
  });

  it('forgets a deleted account with accounts’ key, 404 when it never connected', async () => {
    const path = `/app/people/${PERSON}`;
    expect((await call(path, { method: 'DELETE', bearer: 'index-key' })).status).toBe(401);
    expect((await call(path, { method: 'DELETE', bearer: 'accounts-key' })).status).toBe(404);
    await h.connect();
    expect((await call(path, { method: 'DELETE', bearer: 'accounts-key' })).status).toBe(204);
    expect(h.store.connection()).toBeNull();
    expect(h.google.requests.some((r) => r.path === '/revoke')).toBe(true);
  });
});

// A mirror's Durable Object out of reach (liveworkspace/docs/specs/002-architecture/architecture.md "When a request
// fails"): a retryable 503, never a Google failure.
describe('when the mirror is unavailable', () => {
  const outage = () =>
    Object.assign(new Error('Durable Object reset because its code was updated.'), {
      retryable: true,
    });

  it('answers open 503 storage_unavailable, not 502 google_failed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await h.connect();
    const object = asObject();
    deps = { ...deps, mirrors: () => ({ ...object, open: async () => Promise.reject(outage()) }) };

    const res = await call('/api/drive/open', {
      method: 'POST',
      bearer: await token(PERSON),
      body: { fileId: 'file_1' },
    });

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(error).toHaveBeenCalledWith(
      '[durable-object] unavailable route=Post.Drive.Open',
      expect.any(Error),
    );
  });

  it("names an app door under Drive's path, never with the person's id", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const object = asObject();
    deps = {
      ...deps,
      mirrors: () => ({ ...object, disconnect: async () => Promise.reject(outage()) }),
    };

    const res = await call('/app/people/user_secret_7', {
      method: 'DELETE',
      bearer: 'accounts-key',
    });

    expect(res.status).toBe(503);
    expect(error).toHaveBeenCalledWith(
      '[durable-object] unavailable route=Delete.Drive.App.People',
      expect.any(Error),
    );
    for (const [line] of error.mock.calls) expect(String(line)).not.toContain('user_secret_7');
  });
});
