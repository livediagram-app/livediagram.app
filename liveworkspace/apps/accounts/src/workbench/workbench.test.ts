// The workbench service (liveworkspace/docs/workbench.md): pairing, tickets, sessions, the apps' session checks,
// ending access, the allowance, and a store that sits idle with no alarm.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from '../account-api.ts';
import type { Auth } from '../auth.ts';
import { __setBearerVerifier } from '../bearer.ts';
import type { Env } from '../env.ts';
import { addClient, addUser, testD1 } from '../test-d1.ts';
import { mintApiToken } from '../tokens.ts';
import { closeAccountWorkbench } from './revoke.ts';
import { WORKBENCH_SESSION_GRACE_MS } from './store.ts';
import { memoryWorkbench, type MemoryWorkbench } from './test-store.ts';

const BASE = 'https://liveworkspace.app';
const PLANNER = `Basic ${btoa('liveplanner:secret')}`;
const DIAGRAM = `Basic ${btoa('livediagram:secret')}`;
const CLIENTS: Record<string, string> = { [PLANNER]: 'liveplanner', [DIAGRAM]: 'livediagram' };
const ORIGIN = 'https://127.0.0.1:5175';

type IndexCall = { method: string; url: string; body: unknown; headers: Headers };

let env: Env;
let ns: MemoryWorkbench;
let sql: ReturnType<typeof testD1>['sql'];
let signedIn: { id: string } | null;
let indexCalls: IndexCall[];
let grantAnswer: (itemId: string) => Response;
let pending: Promise<unknown>[];

const auth = {
  api: {
    getSession: async () => (signedIn ? { user: signedIn, session: {} } : null),
  },
  handler: async (request: Request) =>
    CLIENTS[request.headers.get('authorization') ?? '']
      ? Response.json({ active: false })
      : new Response(null, { status: 401 }),
} as unknown as Auth;

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  addUser(sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  addClient(sql, 'liveplanner', 'liveplanner.app');
  addClient(sql, 'livediagram', 'livediagram.app');
  sql
    .prepare(
      "INSERT INTO profile (owner_id, name, color, created_at, updated_at) VALUES ('user_ada', 'Ada L', '#f00', 1, 1)",
    )
    .run();
  ns = memoryWorkbench();
  indexCalls = [];
  pending = [];
  signedIn = { id: 'user_ada' };
  grantAnswer = () =>
    Response.json({ grant: 'g', level: 'edit', tabId: null, expiresAt: Date.now() + 60_000 });
  const index = {
    fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const request = new Request(input as RequestInfo, init);
      const url = new URL(request.url);
      const text = await request.text();
      indexCalls.push({
        method: request.method,
        url: `${url.pathname}${url.search}`,
        body: text ? JSON.parse(text) : undefined,
        headers: request.headers,
      });
      const grant = url.pathname.match(/\/items\/([^/]+)\/grant$/);
      if (grant) return grantAnswer(decodeURIComponent(grant[1]!));
      if (url.pathname.endsWith('/folders/previews')) {
        const ids = (url.searchParams.get('ids') ?? '').split(',');
        return Response.json({
          previews: ids
            .filter((id) => id.startsWith('mine'))
            .map((folderId) => ({ folderId, itemCount: 0, items: [] })),
        });
      }
      if (url.pathname.endsWith('/internal/workbench-close')) {
        const body = JSON.parse(text) as { itemIds: string[] };
        return Response.json({ closed: body.itemIds.length, unreached: [] });
      }
      return new Response(null, { status: 404 });
    },
  } as unknown as Fetcher;
  env = {
    BASE_URL: BASE,
    ENVIRONMENT: 'production',
    AUTH_DB: d1.db,
    INDEX_URL: `${BASE}/api/index`,
    INDEX_MERGE_KEY: 'merge-key',
    INDEX: index,
    WORKBENCH: ns,
  } as unknown as Env;
  __setBearerVerifier(
    () => async (token) =>
      token === 'at-ada'
        ? {
            kind: 'account',
            userId: 'user_ada',
            email: 'ada@example.com',
            emailVerified: true,
            scopes: [],
            teams: [],
          }
        : null,
  );
});

afterEach(() => {
  __setBearerVerifier(null);
  vi.restoreAllMocks();
});

type CallInit = {
  method?: string;
  body?: unknown;
  bearer?: string;
  app?: string | null;
  basic?: string;
  origin?: string | null;
};

// A request as an app's router forwards it (its name in X-Liveworkspace-Proxy), or straight to liveworkspace.app.
async function call(path: string, init: CallInit = {}): Promise<Response> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;
  if (init.basic) headers.authorization = init.basic;
  const app = init.app === undefined ? 'liveplanner' : init.app;
  if (app) headers['x-liveworkspace-proxy'] = app;
  const origin = init.origin === undefined ? (method === 'GET' ? null : BASE) : init.origin;
  if (origin) headers.origin = origin;
  return handleAccountApi(
    new Request(`${BASE}/api/account${path}`, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    env,
    auth,
    (promise) => void pending.push(promise),
  );
}

const settle = () => Promise.all(pending);

async function token(options: { readOnly?: boolean; user?: string } = {}) {
  const made = await mintApiToken(env.AUTH_DB, options.user ?? 'user_ada', {
    name: 'Workbench token',
    readOnly: options.readOnly ?? false,
  });
  return made!;
}

const codeOf = (url: string) => new URL(url).searchParams.get('code')!;

// Pairs a token with ORIGIN for a scope, approved by Ada signed in on liveworkspace.app.
async function pair(secret: string, scope: string = 'project', app = 'liveplanner') {
  const asked = await call('/workbench/pairing-requests', {
    method: 'POST',
    bearer: secret,
    app,
    body: { origin: ORIGIN, scope, name: 'Agent' },
  });
  const { pairingUrl } = (await asked.json()) as { pairingUrl: string };
  const approved = await call(`/workbench/pairing-requests/${codeOf(pairingUrl)}/approve`, {
    method: 'POST',
    app: null,
  });
  expect(approved.status).toBe(200);
  return ((await approved.json()) as { pairing: { id: string } }).pairing;
}

async function mint(secret: string, body: Record<string, unknown>, app = 'liveplanner') {
  return call('/workbench/tickets', {
    method: 'POST',
    bearer: secret,
    app,
    body: { origin: ORIGIN, ...body },
  });
}

const ticketOf = (url: string) => url.split('#ticket=')[1]!;

async function redeem(ticket: string, app = 'liveplanner') {
  return call('/workbench/sessions', { method: 'POST', app, body: { ticket } });
}

async function openSession(secret: string, body: Record<string, unknown> = { projectId: 'plan1' }) {
  const minted = (await (await mint(secret, body)).json()) as { url: string };
  const redeemed = await redeem(ticketOf(minted.url));
  expect(redeemed.status).toBe(201);
  return (await redeemed.json()) as { session: string; role: string; expiresAt: number };
}

const check = (session: string, basic = PLANNER) =>
  call('/internal/workbench/session', {
    method: 'POST',
    basic,
    app: null,
    body: { session },
  });

describe('pairing', () => {
  it('asks once per token, origin and scope, and the owner answers on liveworkspace.app', async () => {
    const t = await token();
    const asked = await call('/workbench/pairing-requests', {
      method: 'POST',
      bearer: t.secret,
      body: { origin: ORIGIN, name: ' Agent ' },
    });
    const pending = (await asked.json()) as { status: string; pairingUrl: string; code: string };
    expect(pending).toMatchObject({ status: 'pending', interval: 5 });
    expect(pending.pairingUrl).toBe(`${BASE}/workbench/pair?code=${pending.code}`);
    const again = await call('/workbench/pairing-requests', {
      method: 'POST',
      bearer: t.secret,
      body: { origin: ORIGIN },
    });
    expect(((await again.json()) as { code: string }).code).toBe(pending.code);

    // The pairing page reads the question in the app's words, with the token's name and the app.
    const read = await call(`/workbench/pairing-requests/${pending.code}`, { app: null });
    expect(await read.json()).toMatchObject({
      request: {
        origin: ORIGIN,
        name: 'Agent',
        tokenName: 'Workbench token',
        scope: 'project',
        status: 'pending',
        app: 'liveplanner',
      },
    });
    // The CLI waits by the token that asked.
    const poll = await call(`/workbench/pairing-requests/${pending.code}/status`, {
      bearer: t.secret,
    });
    expect(await poll.json()).toMatchObject({ status: 'pending', interval: 5 });

    const approved = await call(`/workbench/pairing-requests/${pending.code}/approve`, {
      method: 'POST',
      app: null,
    });
    expect(await approved.json()).toMatchObject({
      pairing: {
        tokenId: t.id,
        origin: ORIGIN,
        name: 'Agent',
        scope: 'project',
        app: 'liveplanner',
      },
    });
    const twice = await call(`/workbench/pairing-requests/${pending.code}/approve`, {
      method: 'POST',
      app: null,
    });
    expect(twice.status).toBe(409);
    const paired = await call('/workbench/pairing-requests', {
      method: 'POST',
      bearer: t.secret,
      body: { origin: ORIGIN },
    });
    expect(await paired.json()).toMatchObject({ status: 'paired' });
  });

  it('is answered only by the owner signed in: never by a token, a cross-site write, or someone else', async () => {
    const t = await token();
    const asked = await call('/workbench/pairing-requests', {
      method: 'POST',
      bearer: t.secret,
      body: { origin: ORIGIN },
    });
    const { code } = (await asked.json()) as { code: string };
    const approve = (init: CallInit) =>
      call(`/workbench/pairing-requests/${code}/approve`, { method: 'POST', ...init });
    expect((await approve({ bearer: t.secret })).status).toBe(401);
    expect((await approve({ origin: 'https://evil.example', app: null })).status).toBe(401);
    signedIn = { id: 'user_bea' };
    expect((await approve({ app: null })).status).toBe(404);
    // An account's access token for an app answers, as an app's Settings would.
    signedIn = null;
    expect((await approve({ bearer: 'at-ada' })).status).toBe(200);
  });

  it('refuses a bad origin and an unknown scope, and needs a token', async () => {
    const t = await token();
    const ask = (body: unknown, bearer: string | null = t.secret) =>
      call('/workbench/pairing-requests', { method: 'POST', bearer: bearer ?? undefined, body });
    expect((await ask({ origin: 'http://example.com' })).status).toBe(400);
    expect((await ask({ origin: `${ORIGIN}/` })).status).toBe(400);
    expect((await ask({ origin: ORIGIN, scope: 'document' })).status).toBe(400);
    expect((await ask({ origin: ORIGIN }, null)).status).toBe(403);
  });

  it("lists this app's pairings on its address and every app's on liveworkspace.app, and unpairs", async () => {
    const t = await token();
    const plan = await pair(t.secret);
    await pair(t.secret, 'document', 'livediagram');
    const listed = async (app: string | null) =>
      (
        (await (await call('/workbench/pairings', { bearer: 'at-ada', app })).json()) as {
          pairings: { id: string; app: string }[];
        }
      ).pairings.map((p) => p.app);
    expect(await listed('liveplanner')).toEqual(['liveplanner']);
    expect((await listed(null)).sort()).toEqual(['livediagram', 'liveplanner']);
    // Another app's address can't unpair it.
    expect(
      (
        await call(`/workbench/pairings/${plan.id}`, {
          method: 'DELETE',
          bearer: 'at-ada',
          app: 'livedesign',
        })
      ).status,
    ).toBe(404);
    expect(
      (await call(`/workbench/pairings/${plan.id}`, { method: 'DELETE', bearer: 'at-ada' })).status,
    ).toBe(204);
    expect(await listed('liveplanner')).toEqual([]);
  });
});

describe('tickets and sessions', () => {
  it('answers 428 with the pairing URL until paired, then mints a ticket on the app’s own address', async () => {
    const t = await token();
    const unpaired = await mint(t.secret, { projectId: 'plan1' });
    expect(unpaired.status).toBe(428);
    expect(await unpaired.json()).toMatchObject({
      error: 'pairing_required',
      pairingUrl: expect.stringMatching(/^https:\/\/liveworkspace\.app\/workbench\/pair\?code=/),
    });
    await pair(t.secret);
    const minted = await mint(t.secret, { projectId: 'plan1', tabId: 't1' });
    expect(minted.status).toBe(201);
    const body = (await minted.json()) as { url: string };
    expect(body).toMatchObject({ projectId: 'plan1', tabId: 't1' });
    expect(body.url).toMatch(/^https:\/\/liveplanner\.app\/embed\/workbench\?d=plan1#ticket=/);
    // The owner's access was asked of the index as the person, with accounts' key, for this app.
    const grant = indexCalls.find((c) => c.url.endsWith('/grant'))!;
    expect(grant.url).toBe('/api/index/items/plan1/grant');
    expect(grant.headers.get('authorization')).toBe('Bearer merge-key');
    expect(grant.headers.get('x-index-app')).toBe('liveplanner');
    expect(grant.headers.get('x-index-person')).toBe('user_ada');
  });

  it('redeems a ticket once for a session in the app’s words, with the person', async () => {
    const t = await token();
    await pair(t.secret);
    const { url } = (await (await mint(t.secret, { projectId: 'plan1' })).json()) as {
      url: string;
    };
    const redeemed = await redeem(ticketOf(url));
    expect(redeemed.status).toBe(201);
    expect(await redeemed.json()).toMatchObject({
      session: expect.stringMatching(/^lvw_/),
      scope: 'project',
      projectId: 'plan1',
      folderId: null,
      role: 'edit',
      origin: ORIGIN,
      person: { id: 'user_ada', name: 'Ada L', color: '#f00' },
    });
    expect(await (await redeem(ticketOf(url))).json()).toEqual({
      error: 'invalid_ticket',
      reason: 'used',
    });
  });

  it('keeps a ticket to its app: another app’s address finds it unknown and leaves it unspent', async () => {
    const t = await token();
    await pair(t.secret);
    const { url } = (await (await mint(t.secret, { projectId: 'plan1' })).json()) as {
      url: string;
    };
    expect(await (await redeem(ticketOf(url), 'livediagram')).json()).toEqual({
      error: 'invalid_ticket',
      reason: 'unknown',
    });
    expect((await redeem(ticketOf(url))).status).toBe(201);
  });

  it('caps the level by a read-only token and by the owner’s access, and says when the item is trashed', async () => {
    const reader = await token({ readOnly: true });
    await pair(reader.secret);
    expect((await openSession(reader.secret)).role).toBe('view');

    const t = await token();
    await pair(t.secret);
    grantAnswer = () =>
      Response.json({ grant: 'g', level: 'participate', tabId: null, expiresAt: Date.now() });
    expect((await openSession(t.secret)).role).toBe('participate');
    grantAnswer = () =>
      Response.json({ grant: 'g', level: 'edit', tabId: null, expiresAt: 1, trashed: true });
    const trashed = await mint(t.secret, { projectId: 'plan1' });
    expect(trashed.status).toBe(410);
    expect(await trashed.json()).toEqual({ error: 'project_trashed' });
    grantAnswer = () => Response.json({ error: 'not_found' }, { status: 404 });
    expect((await mint(t.secret, { projectId: 'plan1' })).status).toBe(404);
  });

  it('mints a workspace ticket only with a workspace pairing, on a folder the owner reaches', async () => {
    const t = await token();
    await pair(t.secret);
    expect((await mint(t.secret, { scope: 'workspace' })).status).toBe(428);
    await pair(t.secret, 'workspace');
    const minted = await mint(t.secret, { scope: 'workspace', folderId: 'mine1' });
    const body = (await minted.json()) as { url: string; scope: string; folderId: string };
    expect(minted.status).toBe(201);
    expect(body.url).toMatch(
      /^https:\/\/liveplanner\.app\/embed\/workbench\/explorer\/folder\/mine1#ticket=/,
    );
    expect((await mint(t.secret, { scope: 'workspace', folderId: 'theirs' })).status).toBe(404);
    expect((await mint(t.secret, { scope: 'workspace', projectId: 'p' })).status).toBe(400);
    const session = await redeem(ticketOf(body.url));
    expect(await session.json()).toMatchObject({
      scope: 'workspace',
      projectId: null,
      folderId: 'mine1',
      tabId: null,
    });
  });

  it('limits mints and pairing requests per token', async () => {
    const t = await token();
    let left = 1;
    env.WORKBENCH_LIMITER = { limit: async () => ({ success: left-- > 0 }) } as RateLimit;
    expect((await mint(t.secret, { projectId: 'plan1' })).status).toBe(428);
    expect((await mint(t.secret, { projectId: 'plan1' })).status).toBe(429);
  });

  it('lets a session end itself', async () => {
    const t = await token();
    await pair(t.secret);
    const { session } = await openSession(t.secret);
    expect(
      (await call('/workbench/sessions/current', { method: 'DELETE', bearer: session })).status,
    ).toBe(204);
    expect(await (await check(session)).json()).toMatchObject({ reason: 'unknown' });
  });
});

describe("an app's server checking a session", () => {
  it('answers the session for its own app with the token’s state and the teams, and refuses others', async () => {
    const t = await token();
    await pair(t.secret);
    const { session, expiresAt } = await openSession(t.secret);
    const checked = await check(session);
    expect(checked.status).toBe(200);
    expect(await checked.json()).toMatchObject({
      ownerId: 'user_ada',
      tokenId: t.id,
      scope: 'item',
      itemId: 'plan1',
      level: 'edit',
      expiresAt,
      teams: [],
    });
    expect(await (await check(session, DIAGRAM)).json()).toEqual({
      error: 'invalid_session',
      reason: 'unknown',
    });
    expect((await check('lvw_nope')).status).toBe(404);
    expect(
      (await call('/internal/workbench/session', { method: 'POST', app: null, body: { session } }))
        .status,
    ).toBe(401);
  });

  it('reads a revoked token as revoked at once, and an expired session as expired', async () => {
    const t = await token();
    await pair(t.secret);
    const { session } = await openSession(t.secret);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 9 * 60 * 60 * 1000);
    expect(await (await check(session)).json()).toMatchObject({ reason: 'expired' });
    vi.restoreAllMocks();
    sql.prepare('UPDATE api_token SET revokedAt = 1 WHERE id = ?').run(t.id);
    expect(await (await check(session)).json()).toMatchObject({ reason: 'revoked' });
  });
});

describe('ending access', () => {
  it('closes the rooms of an unpaired pairing through the index, the workspace session’s joined rooms too', async () => {
    const t = await token();
    const pairing = await pair(t.secret, 'workspace');
    const item = await openSession(t.secret);
    const workspace = await openSession(t.secret, { scope: 'workspace' });
    const checked = (await (await check(workspace.session)).json()) as { sessionId: string };
    const noted = await call('/internal/workbench/rooms', {
      method: 'POST',
      basic: PLANNER,
      app: null,
      body: { ownerId: 'user_ada', sessionId: checked.sessionId, itemId: 'plan2' },
    });
    expect(noted.status).toBe(204);
    // Another app can't note a room on this app's session.
    const wrong = await call('/internal/workbench/rooms', {
      method: 'POST',
      basic: DIAGRAM,
      app: null,
      body: { ownerId: 'user_ada', sessionId: checked.sessionId, itemId: 'x' },
    });
    expect(wrong.status).toBe(404);

    await call(`/workbench/pairings/${pairing.id}`, { method: 'DELETE', bearer: 'at-ada' });
    await settle();
    const close = indexCalls.filter((c) => c.url === '/api/index/internal/workbench-close');
    expect(close).toHaveLength(1);
    expect(close[0]!.headers.get('authorization')).toBe('Bearer merge-key');
    expect(close[0]!.body).toEqual({
      app: 'liveplanner',
      pairingId: pairing.id,
      itemIds: ['plan1', 'plan2'],
    });
    expect(await (await check(item.session)).json()).toMatchObject({ reason: 'unknown' });
  });

  it('ends a token’s pairings when it is revoked on liveworkspace.app or revokes itself', async () => {
    const a = await token();
    await pair(a.secret);
    const { session } = await openSession(a.secret);
    const revoked = await call(`/tokens/${a.id}`, { method: 'DELETE', app: null });
    expect(revoked.status).toBe(200);
    await settle();
    expect(indexCalls.some((c) => c.url.endsWith('/internal/workbench-close'))).toBe(true);
    expect(await ns.entryOf('user_ada').core.listPairings(null)).toEqual([]);
    expect(await (await check(session)).json()).toMatchObject({ reason: 'unknown' });

    const b = await token();
    await pair(b.secret);
    const self = await call('/internal/tokens/revoke', {
      method: 'POST',
      basic: PLANNER,
      app: null,
      body: { token: b.secret },
    });
    expect(self.status).toBe(200);
    expect(await ns.entryOf('user_ada').core.listPairings(null)).toEqual([]);
  });

  it('drops a pairing whose token stopped working when the list is read', async () => {
    const t = await token();
    await pair(t.secret);
    sql.prepare('UPDATE api_token SET expiresAt = 1 WHERE id = ?').run(t.id);
    const listed = await call('/workbench/pairings', { bearer: 'at-ada' });
    expect(await listed.json()).toEqual({ pairings: [] });
    await settle();
    expect(await ns.entryOf('user_ada').core.listPairings(null)).toEqual([]);
  });

  it('drops the whole store when the account closes', async () => {
    const t = await token();
    await pair(t.secret);
    await openSession(t.secret);
    await closeAccountWorkbench(env, 'user_ada');
    const { storage } = ns.entryOf('user_ada');
    expect(storage.dropped).toBe(1);
    expect(storage.alarmAt).toBeNull();
    expect(indexCalls.filter((c) => c.url.endsWith('/internal/workbench-close'))).toHaveLength(1);
  });
});

describe('the allowance', () => {
  it("takes from a sender's allowance, kept per app", async () => {
    const take = (basic: string, count: number) =>
      call('/internal/allowance', {
        method: 'POST',
        basic,
        app: null,
        body: { personId: 'user_ada', kind: 'notify-email', max: 3, windowMs: 3_600_000, count },
      });
    expect(await (await take(PLANNER, 2)).json()).toEqual({ taken: 2 });
    expect(await (await take(PLANNER, 2)).json()).toEqual({ taken: 1 });
    expect(await (await take(DIAGRAM, 2)).json()).toEqual({ taken: 2 });
    const bad = await call('/internal/allowance', {
      method: 'POST',
      basic: PLANNER,
      app: null,
      body: { personId: 'user_ada', kind: 'notify-email', max: 5_000, windowMs: 1 },
    });
    expect(bad.status).toBe(400);
  });
});

describe('a store at rest', () => {
  it('sets its alarm only while something will lapse, and holds pairings with none', async () => {
    const t = await token();
    await pair(t.secret);
    const { storage, core } = ns.entryOf('user_ada');
    // The answered request lapses in ten minutes: an alarm for then.
    expect(storage.alarmAt).not.toBeNull();
    await core.alarm(storage.alarmAt!);
    // Only the pairing is left: no alarm at all.
    expect(storage.alarmAt).toBeNull();
    expect(await core.listPairings(null)).toHaveLength(1);

    const { expiresAt } = await openSession(t.secret);
    // The ticket lapses first, then the session a day after its expiry.
    await core.alarm(storage.alarmAt!);
    expect(storage.alarmAt).toBe(expiresAt + WORKBENCH_SESSION_GRACE_MS);
    await core.alarm(storage.alarmAt!);
    expect(storage.alarmAt).toBeNull();
    expect(storage.dropped).toBe(0);
  });

  it('deletes itself once nothing is left', async () => {
    const t = await token();
    const pairing = await pair(t.secret);
    await call(`/workbench/pairings/${pairing.id}`, { method: 'DELETE', bearer: 'at-ada' });
    const { storage } = ns.entryOf('user_ada');
    await ns.entryOf('user_ada').core.alarm(Date.now() + 11 * 60_000);
    expect(storage.dropped).toBe(1);
    expect(storage.alarmAt).toBeNull();
  });

  it('leaves no store behind for a forged secret', async () => {
    const forged = `lvw_${'a'.repeat(43)}.${'0'.repeat(64)}`;
    expect(await (await check(forged)).json()).toMatchObject({ reason: 'unknown' });
    const store = ns.stores.get('0'.repeat(64))!;
    expect(store.storage.alarmAt).toBeNull();
    expect(
      store.storage.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table'").toArray(),
    ).toEqual([]);
  });
});

// What each step costs, for liveworkspace/docs/workbench.md "Performance".
describe('round trips', () => {
  it('counts the store calls and index calls of a mint, a redemption and a session check', async () => {
    const t = await token();
    await pair(t.secret);
    ns.calls.length = 0;
    indexCalls = [];
    const { url } = (await (await mint(t.secret, { projectId: 'plan1' })).json()) as {
      url: string;
    };
    const mintCost = { store: [...ns.calls], index: indexCalls.length };
    ns.calls.length = 0;
    indexCalls = [];
    const { session } = (await (await redeem(ticketOf(url))).json()) as { session: string };
    const redeemCost = { store: [...ns.calls], index: indexCalls.length };
    ns.calls.length = 0;
    await check(session);
    const checkCost = { store: [...ns.calls], index: 0 };
    expect(mintCost).toEqual({ store: ['findPairing', 'mintTicket'], index: 1 });
    expect(redeemCost).toEqual({ store: ['consumeTicket', 'openSession'], index: 1 });
    expect(checkCost).toEqual({ store: ['readSession'], index: 0 });
  });
});
