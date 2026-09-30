import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, type DriveItem } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getSealedRefreshToken } from '../db/drive';
import { signDriveState } from '../drive/state';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDrive } from './drive';

// /api/drive/* (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Routes").

const KEY = bytesToBase64(new Uint8Array(32).map((_, i) => i));
const URI = 'https://livediagram.app/drive/connected';
const BROKER: Partial<Env> = {
  GOOGLE_CLIENT_ID: 'cid',
  GOOGLE_CLIENT_SECRET: 'secret',
  DRIVE_TOKEN_KEY: KEY,
  GOOGLE_OAUTH_BASE_URL: 'https://oauth.test',
};
const BROWSER: Partial<Env> = { GOOGLE_CLIENT_ID: 'cid' };

type GoogleReply = { status: number; body: unknown };
let googleReplies: GoogleReply[] = [];
let googleCalls: { url: string; form: URLSearchParams }[] = [];

beforeEach(() => {
  googleReplies = [];
  googleCalls = [];
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      googleCalls.push({ url, form: new URLSearchParams(String(init.body)) });
      const reply = googleReplies.shift() ?? { status: 500, body: {} };
      return new Response(JSON.stringify(reply.body), { status: reply.status });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function call(
  db: SqliteD1,
  method: string,
  path: string,
  opts: {
    body?: unknown;
    clerkUserId?: string | null;
    owner?: string | null;
    verifiedUserId?: string | null;
  } = {},
) {
  const clerkUserId = opts.clerkUserId === undefined ? 'user_a' : opts.clerkUserId;
  return handleDrive(
    makeTestRouteContext(method, `/api/drive${path}`, {
      owner: opts.owner ?? clerkUserId,
      clerkUserId,
      ...(opts.verifiedUserId !== undefined ? { verifiedUserId: opts.verifiedUserId } : {}),
      body: opts.body,
      env: db.env,
    }),
  );
}

async function body<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function connect(db: SqliteD1, owner = 'user_a') {
  const state = await signDriveState(KEY, owner, URI, Date.now());
  googleReplies.push({
    status: 200,
    body: { access_token: 'at', refresh_token: 'rt-1', expires_in: 3600 },
  });
  return call(db, 'POST', '/connect', { body: { code: 'code-1', state }, clerkUserId: owner });
}

function item(over: Partial<DriveItem> = {}): DriveItem {
  return {
    kind: 'document',
    ldId: 'd1',
    driveFileId: 'f1',
    name: 'One.livediagram',
    ldName: 'One',
    parentId: 'root',
    trashed: false,
    md5: null,
    headRevisionId: null,
    mirroredSavedAt: null,
    notice: null,
    noticeParentId: null,
    ...over,
  };
}

describe('gates', () => {
  it('answers 503 drive_not_configured on every route when Drive is off', async () => {
    const db = sqliteD1();
    for (const [method, path] of [
      ['GET', '/connection'],
      ['POST', '/token'],
      ['GET', '/items'],
    ] as const) {
      const res = await call(db, method, path);
      expect(res.status).toBe(503);
      expect(await body(res)).toEqual({ error: 'drive_not_configured' });
    }
  });

  it('refuses a guest (X-Owner-Id) with 401', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'GET', '/connection', { clerkUserId: null, owner: 'guest-uuid' });
    expect(res.status).toBe(401);
  });

  it('refuses an API token caller (verified id without a Clerk session)', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'GET', '/connection', {
      clerkUserId: null,
      owner: 'user_a',
      verifiedUserId: 'user_a',
    });
    expect(res.status).toBe(401);
  });

  it('404s an unknown sub-route', async () => {
    const db = sqliteD1(BROKER);
    expect((await call(db, 'GET', '/nope')).status).toBe(404);
  });
});

describe('POST /drive/state and /drive/connect (broker)', () => {
  it('mints a state for an allowed redirect URI', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'POST', '/state', { body: { redirectUri: URI } });
    expect(res.status).toBe(200);
    expect((await body<{ state: string }>(res)).state).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  it('refuses a redirect URI outside /drive/connected', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'POST', '/state', {
      body: { redirectUri: 'https://evil.example/x' },
    });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_redirect_uri' });
  });

  it('answers 503 drive_broker_unavailable in browser mode', async () => {
    const db = sqliteD1(BROWSER);
    expect((await call(db, 'POST', '/state', { body: { redirectUri: URI } })).status).toBe(503);
    expect((await call(db, 'POST', '/token')).status).toBe(503);
  });

  it('exchanges the code, seals the refresh token and returns the summary', async () => {
    const db = sqliteD1(BROKER);
    const res = await connect(db);
    expect(res.status).toBe(200);
    const { connection } = await body<{ connection: Record<string, unknown> }>(res);
    expect(connection).toMatchObject({ status: 'connected', hasRefreshToken: true });
    expect(JSON.stringify(connection)).not.toContain('rt-1');
    expect(googleCalls[0]!.form.get('redirect_uri')).toBe(URI);
    const sealed = await getSealedRefreshToken(db.env, 'user_a');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('rt-1');
  });

  it("refuses another user's state", async () => {
    const db = sqliteD1(BROKER);
    const state = await signDriveState(KEY, 'user_b', URI, Date.now());
    const res = await call(db, 'POST', '/connect', { body: { code: 'c', state } });
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'invalid_state' });
    expect(googleCalls).toEqual([]);
  });

  it('refuses a missing code', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'POST', '/connect', { body: { state: 'x' } });
    expect(res.status).toBe(400);
  });

  it('answers 502 when Google refuses the code, storing nothing', async () => {
    const db = sqliteD1(BROKER);
    const state = await signDriveState(KEY, 'user_a', URI, Date.now());
    googleReplies.push({ status: 400, body: { error: 'invalid_grant' } });
    const res = await call(db, 'POST', '/connect', { body: { code: 'c', state } });
    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: 'drive_exchange_failed' });
    expect(await getSealedRefreshToken(db.env, 'user_a')).toBeNull();
  });

  it('answers 502 drive_no_refresh_token when Google sends none and none is stored', async () => {
    const db = sqliteD1(BROKER);
    const state = await signDriveState(KEY, 'user_a', URI, Date.now());
    googleReplies.push({ status: 200, body: { access_token: 'at', expires_in: 3600 } });
    const res = await call(db, 'POST', '/connect', { body: { code: 'c', state } });
    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: 'drive_no_refresh_token' });
  });
});

describe('POST /drive/token', () => {
  it('404s without a connection', async () => {
    const db = sqliteD1(BROKER);
    const res = await call(db, 'POST', '/token');
    expect(res.status).toBe(404);
    expect(await body(res)).toEqual({ error: 'drive_not_connected' });
  });

  it('mints an access token from the stored refresh token', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    googleReplies.push({ status: 200, body: { access_token: 'fresh', expires_in: 3600 } });
    const res = await call(db, 'POST', '/token');
    expect(res.status).toBe(200);
    const out = await body<{ accessToken: string; expiresAt: number }>(res);
    expect(out.accessToken).toBe('fresh');
    expect(out.expiresAt).toBeGreaterThan(Date.now());
    expect(googleCalls[1]!.form.get('refresh_token')).toBe('rt-1');
  });

  it('turns invalid_grant into needs_reconnect, deleting nothing', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    await call(db, 'PUT', '/items', { body: { items: [item()] } });
    googleReplies.push({ status: 400, body: { error: 'invalid_grant' } });
    const res = await call(db, 'POST', '/token');
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'drive_needs_reconnect' });
    const conn = await body<{ connection: { status: string } }>(
      await call(db, 'GET', '/connection'),
    );
    expect(conn.connection.status).toBe('needs_reconnect');
    expect((await body<{ items: unknown[] }>(await call(db, 'GET', '/items'))).items).toHaveLength(
      1,
    );
    // Further token calls do not hammer Google.
    expect((await call(db, 'POST', '/token')).status).toBe(409);
    expect(googleCalls).toHaveLength(2);
  });

  it('answers 502 drive_refresh_failed on other Google failures', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    googleReplies.push({ status: 503, body: {} });
    const res = await call(db, 'POST', '/token');
    expect(res.status).toBe(502);
  });

  it('a reconnect restores connected', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    googleReplies.push({ status: 400, body: { error: 'invalid_grant' } });
    await call(db, 'POST', '/token');
    await connect(db);
    const conn = await body<{ connection: { status: string } }>(
      await call(db, 'GET', '/connection'),
    );
    expect(conn.connection.status).toBe('connected');
  });
});

describe('connection state', () => {
  it('GET answers null before connecting', async () => {
    const db = sqliteD1(BROKER);
    expect(await body(await call(db, 'GET', '/connection'))).toEqual({ connection: null });
  });

  it('PUT records the root folder and page token', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    const res = await call(db, 'PUT', '/connection', {
      body: { rootFolderId: 'root-1', pageToken: '42' },
    });
    expect(res.status).toBe(200);
    expect((await body<{ connection: unknown }>(res)).connection).toMatchObject({
      rootFolderId: 'root-1',
      pageToken: '42',
    });
  });

  it('PUT 404s in broker mode without a connection, and creates one in browser mode', async () => {
    const broker = sqliteD1(BROKER);
    expect((await call(broker, 'PUT', '/connection', { body: {} })).status).toBe(404);
    const browser = sqliteD1(BROWSER);
    const res = await call(browser, 'PUT', '/connection', { body: { rootFolderId: 'r' } });
    expect(res.status).toBe(200);
    expect((await body<{ connection: unknown }>(res)).connection).toMatchObject({
      hasRefreshToken: false,
      rootFolderId: 'r',
    });
  });

  it('PUT refuses malformed ids', async () => {
    const db = sqliteD1(BROWSER);
    expect((await call(db, 'PUT', '/connection', { body: { rootFolderId: 'a/b' } })).status).toBe(
      400,
    );
    expect((await call(db, 'PUT', '/connection', { body: { pageToken: 7 } })).status).toBe(400);
  });

  it('DELETE revokes, removes the rows, and answers 204', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    googleReplies.push({ status: 200, body: {} });
    const res = await call(db, 'DELETE', '/connection');
    expect(res.status).toBe(204);
    expect(googleCalls.at(-1)!.url).toBe('https://oauth.test/revoke');
    expect(await body(await call(db, 'GET', '/connection'))).toEqual({ connection: null });
  });
});

describe('items', () => {
  it('PUT upserts and GET lists them', async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    const res = await call(db, 'PUT', '/items', {
      body: { items: [item(), item({ kind: 'folder', ldId: 'fo', driveFileId: 'ff' })] },
    });
    expect(res.status).toBe(200);
    const listed = await body<{ items: DriveItem[] }>(await call(db, 'GET', '/items'));
    expect(listed.items).toHaveLength(2);
  });

  it('PUT 404s without a connection', async () => {
    const db = sqliteD1(BROWSER);
    expect((await call(db, 'PUT', '/items', { body: { items: [item()] } })).status).toBe(404);
  });

  it('PUT refuses an empty, oversized or malformed batch', async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    for (const items of [
      [],
      Array.from({ length: 101 }, (_, i) => item({ ldId: `d${i}`, driveFileId: `f${i}` })),
      [item({ kind: 'nope' as never })],
      [item({ driveFileId: '' })],
      [item({ trashed: 'yes' as never })],
      [item({ notice: 'other' as never })],
      [item({ name: 'x'.repeat(1025) })],
    ]) {
      expect((await call(db, 'PUT', '/items', { body: { items } })).status).toBe(400);
    }
    expect((await call(db, 'PUT', '/items', { body: {} })).status).toBe(400);
  });

  it('PUT answers 409 drive_item_conflict when a file id is already held', async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    await call(db, 'PUT', '/items', { body: { items: [item()] } });
    const res = await call(db, 'PUT', '/items', { body: { items: [item({ ldId: 'd2' })] } });
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'drive_item_conflict' });
  });

  it('DELETE removes one item', async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    await call(db, 'PUT', '/items', { body: { items: [item()] } });
    expect((await call(db, 'DELETE', '/items/document/d1')).status).toBe(204);
    expect((await body<{ items: unknown[] }>(await call(db, 'GET', '/items'))).items).toEqual([]);
    expect((await call(db, 'DELETE', '/items/nope/d1')).status).toBe(400);
  });

  it("never reads another owner's items", async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    await call(db, 'PUT', '/items', { body: { items: [item()] } });
    const other = await body<{ items: unknown[] }>(
      await call(db, 'GET', '/items', { clerkUserId: 'user_b' }),
    );
    expect(other.items).toEqual([]);
  });
});

describe('lease', () => {
  it('grants, refuses another holder, and releases', async () => {
    const db = sqliteD1(BROWSER);
    await call(db, 'PUT', '/connection', { body: {} });
    const a = await body<{ acquired: boolean }>(
      await call(db, 'POST', '/lease', { body: { holder: 'dev-a' } }),
    );
    expect(a.acquired).toBe(true);
    const b = await body<{ acquired: boolean; holder: string }>(
      await call(db, 'POST', '/lease', { body: { holder: 'dev-b' } }),
    );
    expect(b).toMatchObject({ acquired: false, holder: 'dev-a' });
    expect((await call(db, 'DELETE', '/lease?holder=dev-a')).status).toBe(204);
    const c = await body<{ acquired: boolean }>(
      await call(db, 'POST', '/lease', { body: { holder: 'dev-b' } }),
    );
    expect(c.acquired).toBe(true);
  });

  it('refuses a malformed holder and 404s without a connection', async () => {
    const db = sqliteD1(BROWSER);
    expect((await call(db, 'POST', '/lease', { body: { holder: 'dev-a' } })).status).toBe(404);
    await call(db, 'PUT', '/connection', { body: {} });
    expect((await call(db, 'POST', '/lease', { body: { holder: 'a b' } })).status).toBe(400);
    expect((await call(db, 'DELETE', '/lease')).status).toBe(400);
  });
});

describe('POST /drive/token rate limit', () => {
  function limited(allow: boolean) {
    const keys: string[] = [];
    return {
      keys,
      binding: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: allow };
        },
      },
    };
  }

  it('answers 429 drive_token_rate_limited, keyed by owner, without asking Google', async () => {
    const limiter = limited(false);
    const db = sqliteD1({ ...BROKER, DRIVE_TOKEN_RATE_LIMITER: limiter.binding });
    await connect(db);
    const calls = googleCalls.length;
    const res = await call(db, 'POST', '/token');
    expect(res.status).toBe(429);
    expect(await body(res)).toEqual({ error: 'drive_token_rate_limited' });
    expect(limiter.keys).toEqual(['user_a']);
    expect(googleCalls).toHaveLength(calls);
  });

  it('mints as usual under the limit', async () => {
    const limiter = limited(true);
    const db = sqliteD1({ ...BROKER, DRIVE_TOKEN_RATE_LIMITER: limiter.binding });
    await connect(db);
    googleReplies.push({ status: 200, body: { access_token: 'fresh', expires_in: 3600 } });
    expect((await call(db, 'POST', '/token')).status).toBe(200);
  });

  it('allows everything when the binding is absent (self-host)', async () => {
    const db = sqliteD1(BROKER);
    await connect(db);
    googleReplies.push({ status: 200, body: { access_token: 'fresh', expires_in: 3600 } });
    expect((await call(db, 'POST', '/token')).status).toBe(200);
  });

  it('is only on the token route', async () => {
    const limiter = limited(false);
    const db = sqliteD1({ ...BROKER, DRIVE_TOKEN_RATE_LIMITER: limiter.binding });
    expect((await call(db, 'GET', '/connection')).status).toBe(200);
    expect(limiter.keys).toEqual([]);
  });
});
