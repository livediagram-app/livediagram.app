// Revoking a token tells the apps its AI tool is gone (accounts.md "Revoking a token tells the apps", Work Tracker
// 1294): only when it was the tool's last writable token, only for its owner, after the answer, and never failing it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from './account-api.ts';
import type { Auth } from './auth.ts';
import { signalAssistantRevoked, revokedTool } from './assistant-revoked.ts';
import type { Env } from './env.ts';
import { addClient, addUser, testD1 } from './test-d1.ts';
import { mintApiToken, revokeApiToken } from './tokens.ts';

const BASE = 'https://liveworkspace.app';
const PLANNER = `Basic ${btoa('liveplanner:secret')}`;

type IndexCall = { url: string; body: unknown; authorization: string | null };

let env: Env;
let sql: ReturnType<typeof testD1>['sql'];
let signedIn: { id: string } | null;
let indexCalls: IndexCall[];
let indexAnswer: () => Response | Promise<Response>;
let pending: Promise<unknown>[];

const auth = {
  api: {
    getSession: async () => (signedIn ? { user: signedIn, session: {} } : null),
  },
  // The client check: liveplanner's credentials pass, anything else is refused.
  handler: async (request: Request) =>
    request.headers.get('authorization') === PLANNER
      ? Response.json({ active: false })
      : new Response(null, { status: 401 }),
} as unknown as Auth;

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  addUser(sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  addClient(sql, 'liveplanner', 'liveplanner.app');
  sql
    .prepare(
      `INSERT INTO team (id, name, createdAt, updatedAt, rev) VALUES ('team_t', 'T', 1, 1, 1)`,
    )
    .run();
  sql
    .prepare(
      `INSERT INTO team_member (id, teamId, userId, email, role, status, createdAt, updatedAt, rev)
       VALUES ('m1', 'team_t', 'user_ada', 'ada@example.com', 'member', 'joined', 1, 1, 1)`,
    )
    .run();
  indexCalls = [];
  indexAnswer = () => Response.json({ items: 1 });
  pending = [];
  signedIn = { id: 'user_ada' };
  const index = {
    fetch: async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const request = new Request(input as RequestInfo, init);
      const text = await request.text();
      indexCalls.push({
        url: new URL(request.url).pathname,
        body: text ? JSON.parse(text) : undefined,
        authorization: request.headers.get('authorization'),
      });
      if (request.url.endsWith('/internal/assistant-revoked')) return indexAnswer();
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
  } as unknown as Env;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function call(path: string, init: { method?: string; body?: unknown; basic?: string } = {}) {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.basic) headers.authorization = init.basic;
  if (method !== 'GET') headers.origin = BASE;
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

async function token(name = 'Claude', options: { readOnly?: boolean; user?: string } = {}) {
  return (await mintApiToken(env.AUTH_DB, options.user ?? 'user_ada', {
    name,
    readOnly: options.readOnly ?? false,
  }))!;
}

const signals = () => indexCalls.filter((c) => c.url === '/api/index/internal/assistant-revoked');

describe('revoking a token in Settings', () => {
  it('tells the index its tool is gone, after the answer, with the account and its teams', async () => {
    const claude = await token(' Claude ');
    const revoked = await call(`/tokens/${claude.id}`, { method: 'DELETE' });
    expect(revoked.status).toBe(200);
    // Nothing is sent before the answer: the signal waits in waitUntil.
    expect(signals()).toHaveLength(0);
    await settle();
    expect(signals()).toEqual([
      {
        url: '/api/index/internal/assistant-revoked',
        body: { personId: 'user_ada', client: 'Claude', teamIds: ['team_t'] },
        authorization: 'Bearer merge-key',
      },
    ]);
  });

  it('only for the token’s owner: another account’s revoke is refused and tells nobody', async () => {
    const beas = await token('Claude', { user: 'user_bea' });
    const refused = await call(`/tokens/${beas.id}`, { method: 'DELETE' });
    expect(refused.status).toBe(404);
    await settle();
    expect(signals()).toHaveLength(0);
  });

  it('never fails the revoke when the index is down or answers an error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    indexAnswer = () => new Response(null, { status: 503 });
    const a = await token();
    expect((await call(`/tokens/${a.id}`, { method: 'DELETE' })).status).toBe(200);
    await settle();
    expect(warn).toHaveBeenCalledWith('[tokens] assistant revoke signal', {
      error: 'Error: status_503',
    });

    indexAnswer = () => {
      throw new Error('unreachable');
    };
    const b = await token();
    expect((await call(`/tokens/${b.id}`, { method: 'DELETE' })).status).toBe(200);
    await settle();
    expect(warn).toHaveBeenLastCalledWith('[tokens] assistant revoke signal', {
      error: 'Error: unreachable',
    });
  });
});

describe('a CLI revoking its own token', () => {
  it('tells the index too', async () => {
    const cli = await token('liveplanner CLI');
    const self = await call('/internal/tokens/revoke', {
      method: 'POST',
      basic: PLANNER,
      body: { token: cli.secret },
    });
    expect(self.status).toBe(200);
    await settle();
    expect(signals().map((c) => c.body)).toEqual([
      { personId: 'user_ada', client: 'liveplanner CLI', teamIds: ['team_t'] },
    ]);
  });
});

describe('revokedTool', () => {
  it('names the tool only when no other live writable token of the account holds its name', async () => {
    const now = Date.now();
    const first = await token('Claude');
    const second = await token('claude ');
    await revokeApiToken(env.AUTH_DB, 'user_ada', first.id);
    // Another token under the same name, case and spaces aside, keeps the tool.
    expect(await revokedTool(env.AUTH_DB, 'user_ada', first.id, now)).toBeNull();
    await revokeApiToken(env.AUTH_DB, 'user_ada', second.id);
    expect(await revokedTool(env.AUTH_DB, 'user_ada', second.id, now)).toBe('claude');

    // A read-only token of that name is no tool, and keeps nothing; nor does another account's, or an expired one.
    const third = await token('Cursor');
    await token('Cursor', { readOnly: true });
    await token('Cursor', { user: 'user_bea' });
    const lapsed = await token('Cursor');
    sql.prepare('UPDATE api_token SET expiresAt = 1 WHERE id = ?').run(lapsed.id);
    await revokeApiToken(env.AUTH_DB, 'user_ada', third.id);
    expect(await revokedTool(env.AUTH_DB, 'user_ada', third.id, now)).toBe('Cursor');
  });

  it('names no tool for a read-only token, a token with no name, or another account’s', async () => {
    const reader = await token('Claude', { readOnly: true });
    expect(await revokedTool(env.AUTH_DB, 'user_ada', reader.id)).toBeNull();
    const blank = await token('Claude');
    sql.prepare(`UPDATE api_token SET name = '  ' WHERE id = ?`).run(blank.id);
    expect(await revokedTool(env.AUTH_DB, 'user_ada', blank.id)).toBeNull();
    expect(await revokedTool(env.AUTH_DB, 'user_bea', blank.id)).toBeNull();
    expect(await revokedTool(env.AUTH_DB, 'user_ada', 'nope')).toBeNull();
  });

  it('sends nothing for a read-only token, or where no index is configured', async () => {
    const reader = await token('Claude', { readOnly: true });
    await signalAssistantRevoked(env, 'user_ada', reader.id);
    const tool = await token('Claude');
    await signalAssistantRevoked({ ...env, INDEX_MERGE_KEY: ' ' } as Env, 'user_ada', tool.id);
    await signalAssistantRevoked({ ...env, INDEX_URL: undefined } as Env, 'user_ada', tool.id);
    expect(signals()).toHaveLength(0);
  });

  it('reaches the index over the network when there is no binding', async () => {
    const tool = await token('Claude');
    const fetched = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));
    await signalAssistantRevoked({ ...env, INDEX: undefined } as Env, 'user_ada', tool.id);
    expect(fetched).toHaveBeenCalledWith(
      `${BASE}/api/index/internal/assistant-revoked`,
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
