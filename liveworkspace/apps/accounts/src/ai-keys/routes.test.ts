// The AI key routes and the internal door (liveworkspace/docs/specs/003-accounts/ai-keys.md), end to end over an
// in-memory D1: who may set, change and remove a key, what is ever answered, which key the door hands out and to whom,
// and a planted key looked for in everything that leaves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAccountApi } from '../account-api.ts';
import type { Auth } from '../auth.ts';
import { __setBearerVerifier } from '../bearer.ts';
import type { Env } from '../env.ts';
import { addClient, addUser, testD1 } from '../test-d1.ts';
import { AI_KEY_INTERNAL_PATH, fromBinding, handleAiKeyInternal } from './internal.ts';
import { aiKeySecrets, sealAiKey } from './seal.ts';
import { readAiKey, resealAiKeys } from './store.ts';

const BASE = 'https://liveworkspace.app';
const CLIENT = `Basic ${btoa('liveknowledge:secret')}`;
const OTHER_CLIENT = `Basic ${btoa('liveplanner:secret')}`;
const KEY = 'sk-ant-api03-planted-secret-key-4f2a';
const TEAM_KEY = 'sk-proj-planted-team-secret-key-9c1d';
const SECRET = '1:test-ai-key-master-secret';

let env: Env;
let sql: ReturnType<typeof testD1>['sql'];
let sent: { to: string; subject: string; text?: string; html?: string }[];
let signedIn: { id: string; name: string; email: string; emailVerified: boolean } | null;
let providerCalls: { url: string; headers: Record<string, string> }[];
let providerAnswer: () => Response;
let logged: unknown[][];
let waits: Promise<unknown>[];

// Better Auth's stand-in: the session from `signedIn`; introspection knows two clients and the tokens below.
const TOKENS: Record<string, { sub: string; client_id: string }> = {
  'jwt-ada': { sub: 'user_ada', client_id: 'liveknowledge' },
  'jwt-bea': { sub: 'user_bea', client_id: 'liveknowledge' },
  'jwt-ada-planner': { sub: 'user_ada', client_id: 'liveplanner' },
  'jwt-guest': { sub: 'guest_00000000-0000-4000-8000-000000000009', client_id: 'liveknowledge' },
};
const auth = {
  api: { getSession: async () => (signedIn ? { user: signedIn, session: {} } : null) },
  handler: async (request: Request) => {
    const client = { [CLIENT]: 'liveknowledge', [OTHER_CLIENT]: 'liveplanner' }[
      request.headers.get('authorization') ?? ''
    ];
    if (!client) return new Response(null, { status: 401 });
    const token = new URLSearchParams(await request.text()).get('token') ?? '';
    const known = TOKENS[token];
    return Response.json(known ? { active: true, ...known } : { active: false });
  },
} as unknown as Auth;

const ADA = { id: 'user_ada', name: 'Ada', email: 'ada@example.com', emailVerified: true };
const BEA = { id: 'user_bea', name: 'Bea', email: 'bea@example.com', emailVerified: true };

beforeEach(() => {
  const d1 = testD1();
  sql = d1.sql;
  addUser(sql, { id: 'user_ada', email: 'ada@example.com', name: 'Ada' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', name: 'Bea' });
  addUser(sql, { id: 'user_cy', email: 'cy@example.com', name: 'Cy' });
  addClient(sql, 'liveknowledge', 'liveknowledge.app');
  addClient(sql, 'liveplanner', 'liveplanner.app');
  sent = [];
  providerCalls = [];
  providerAnswer = () => new Response('{}', { status: 200 });
  logged = [];
  waits = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => void logged.push(args));
  }
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    providerCalls.push({
      url: String(input instanceof Request ? input.url : input),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return providerAnswer();
  });
  env = {
    BASE_URL: BASE,
    EMAIL_FROM: 'sign-in@liveworkspace.app',
    AUTH_DB: d1.db,
    ENVIRONMENT: 'production',
    AI_KEY_SECRET: SECRET,
    EMAIL: {
      send: async (m: { to: string; subject: string; text?: string; html?: string }) => {
        sent.push(m);
        return { messageId: 'm' };
      },
    } as unknown as SendEmail,
  } as unknown as Env;
  signedIn = ADA;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

const settled = () => Promise.all(waits);

function door(body: unknown, headers: Record<string, string> = {}, authorization = CLIENT) {
  return handleAiKeyInternal(
    new Request(`http://accounts${AI_KEY_INTERNAL_PATH}`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
    env,
    auth,
  );
}

function addTeam(id: string, members: [string, 'admin' | 'member', string?][]) {
  sql
    .prepare(`INSERT INTO team (id, name, createdAt, updatedAt, rev) VALUES (?, ?, 1, 1, 1)`)
    .run(id, `Team ${id}`);
  for (const [userId, role, status = 'joined'] of members) {
    sql
      .prepare(
        `INSERT INTO team_member (id, teamId, userId, email, role, status, createdAt, updatedAt, rev)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1)`,
      )
      .run(`${id}-${userId}`, id, userId, `${userId}@example.com`, role, status);
  }
}

const putKey = (path: string, body: unknown) => call(path, { method: 'PUT', body });

// Every byte that left: answers, logs, emails, rows, audit events.
async function everythingThatLeft(responses: Response[]): Promise<string> {
  const bodies = await Promise.all(responses.map((r) => r.clone().text()));
  const rows = JSON.stringify(sql.prepare('SELECT * FROM ai_key').all());
  const events = JSON.stringify(sql.prepare('SELECT * FROM index_events_outbox').all());
  return [...bodies, JSON.stringify(logged), JSON.stringify(sent), rows, events].join('\n');
}

describe('a person’s own key', () => {
  it('is checked with the provider, sealed, and only ever answered as its state', async () => {
    const empty = await call('/ai-key');
    expect(await empty.clone().json()).toMatchObject({ available: true, key: null, teams: [] });

    const saved = await putKey('/ai-key', {
      provider: 'anthropic',
      model: 'claude-fable-5-2',
      key: ` ${KEY} `,
    });
    expect(saved.status).toBe(200);
    expect(await saved.clone().json()).toMatchObject({
      key: { provider: 'anthropic', model: 'claude-fable-5-2', hint: '4f2a' },
    });
    expect(providerCalls).toEqual([
      expect.objectContaining({ url: 'https://api.anthropic.com/v1/models/claude-fable-5-2' }),
    ]);
    const row = await readAiKey(env.AUTH_DB, 'account', 'user_ada');
    expect(row).toMatchObject({
      provider: 'anthropic',
      keyVersion: 1,
      hint: '4f2a',
      setBy: 'user_ada',
    });
    expect(saved.headers.get('cache-control')).toBe('no-store');

    await settled();
    expect(sent.map((m) => [m.to, m.subject])).toEqual([
      ['ada@example.com', 'Your liveworkspace AI key was changed'],
    ]);
    expect(sent[0]!.text).toContain('Anthropic');
    expect(sent[0]!.text).toContain('added');

    const leaked = await everythingThatLeft([empty, saved, await call('/ai-key')]);
    expect(leaked).not.toContain(KEY);
    expect(leaked).not.toContain(KEY.slice(0, -4));
  });

  it('uses the provider’s default model when none is named, changes model, and is removed at once', async () => {
    await putKey('/ai-key', { provider: 'openai', key: TEAM_KEY });
    expect((await readAiKey(env.AUTH_DB, 'account', 'user_ada'))!.model).toBe('gpt-6.2-astra');
    const patched = await call('/ai-key', { method: 'PATCH', body: { model: 'gpt-6-luna' } });
    expect(await patched.json()).toMatchObject({ key: { model: 'gpt-6-luna' } });
    // A model of the other provider is no model of this key.
    expect(
      (await call('/ai-key', { method: 'PATCH', body: { model: 'claude-fable-5-2' } })).status,
    ).toBe(400);
    expect((await door({ token: 'jwt-ada', want: 'key' })).status).toBe(200);

    const removed = await call('/ai-key', { method: 'DELETE' });
    expect(await removed.json()).toMatchObject({ key: null });
    // The next call finds nothing: no cache stands between.
    expect(await (await door({ token: 'jwt-ada', want: 'key' })).json()).toEqual({ source: null });
    expect((await call('/ai-key', { method: 'DELETE' })).status).toBe(404);
    expect((await call('/ai-key', { method: 'PATCH', body: { model: 'gpt-6-luna' } })).status).toBe(
      404,
    );
    await settled();
    // Set and removed are emailed; a model change is not.
    expect(sent.map((m) => m.text!.match(/was (\w+)/)![1])).toEqual(['added', 'removed']);
  });

  it('refuses what is no provider, no model or no key, before any provider call', async () => {
    const refusals: [unknown, string][] = [
      [{ provider: 'gemini', key: KEY }, 'invalid_provider'],
      [{ provider: 'anthropic', model: 'gpt-6-luna', key: KEY }, 'invalid_model'],
      [{ provider: 'anthropic', key: '' }, 'invalid_key'],
      [{ provider: 'anthropic', key: 'two words' }, 'invalid_key'],
      [{ provider: 'anthropic', key: 'x'.repeat(513) }, 'invalid_key'],
      [{ provider: 'anthropic', key: 42 }, 'invalid_key'],
    ];
    for (const [body, code] of refusals) {
      const response = await putKey('/ai-key', body);
      expect([response.status, await response.json()]).toEqual([400, { error: code }]);
    }
    expect(providerCalls).toEqual([]);
    expect((await call('/ai-key', { method: 'POST', body: {} })).status).toBe(405);
  });

  it('keeps nothing the provider refuses, and never repeats the provider’s words', async () => {
    const answers: [Response, number, string][] = [
      [
        Response.json(
          { type: 'error', error: { type: 'authentication_error', message: `bad ${KEY}` } },
          { status: 401 },
        ),
        422,
        'key_rejected',
      ],
      [
        Response.json(
          { type: 'error', error: { type: 'billing_error', message: 'x' } },
          { status: 400 },
        ),
        422,
        'key_no_credit',
      ],
      [
        Response.json(
          { type: 'error', error: { type: 'not_found_error', message: 'x' } },
          { status: 404 },
        ),
        422,
        'key_model_unavailable',
      ],
      [new Response(`upstream echoed ${KEY}`, { status: 500 }), 502, 'key_check_failed'],
    ];
    const responses: Response[] = [];
    for (const [answer, status, code] of answers) {
      providerAnswer = () => answer;
      const response = await putKey('/ai-key', { provider: 'anthropic', key: KEY });
      responses.push(response);
      expect([response.status, await response.clone().json()]).toEqual([status, { error: code }]);
    }
    expect(await readAiKey(env.AUTH_DB, 'account', 'user_ada')).toBeNull();
    expect(await everythingThatLeft(responses)).not.toContain(KEY);
  });

  it('fails closed without the master secret: nothing is kept or answered', async () => {
    env = { ...env, AI_KEY_SECRET: undefined } as Env;
    expect(await (await call('/ai-key')).json()).toMatchObject({ available: false });
    const refused = await putKey('/ai-key', { provider: 'anthropic', key: KEY });
    expect([refused.status, await refused.json()]).toEqual([503, { error: 'ai_keys_unavailable' }]);
    expect(providerCalls).toEqual([]);
    expect((await door({ token: 'jwt-ada', want: 'key' })).status).toBe(503);
  });

  it('limits writes per account', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    env = { ...env, AI_KEY_WRITE_LIMITER: { limit } } as unknown as Env;
    const refused = await putKey('/ai-key', { provider: 'anthropic', key: KEY });
    expect([refused.status, await refused.json()]).toEqual([429, { error: 'rate_limited' }]);
    expect(limit).toHaveBeenCalledWith({ key: 'write:user_ada' });
    expect(providerCalls).toEqual([]);
  });

  it('needs a signed-in person: no one signed out, no cross-origin write', async () => {
    expect((await putKey('/ai-key', { provider: 'anthropic', key: KEY, headers: {} })).status).toBe(
      200,
    );
    signedIn = null;
    expect((await call('/ai-key')).status).toBe(401);
    expect((await putKey('/ai-key', { provider: 'anthropic', key: KEY })).status).toBe(401);
    signedIn = ADA;
    const foreign = await call('/ai-key', {
      method: 'DELETE',
      headers: { origin: 'https://evil.example' },
    });
    expect(foreign.status).toBe(403);
    expect(await readAiKey(env.AUTH_DB, 'account', 'user_ada')).not.toBeNull();
  });
});

describe('through an app, by bearer', () => {
  beforeEach(() => {
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
  });
  afterEach(() => __setBearerVerifier(null));
  const bearer = (token: string, init: Parameters<typeof call>[1] = {}) => ({
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      origin: 'https://liveknowledge.app',
      ...init.headers,
    },
  });

  it('lets the account set and read their key, and refuses a guest, an API token and a forged token', async () => {
    const saved = await call(
      '/ai-key',
      bearer('tok-ada', { method: 'PUT', body: { provider: 'anthropic', key: KEY } }),
    );
    expect(saved.status).toBe(200);
    expect(await (await call('/ai-key', bearer('tok-ada'))).json()).toMatchObject({
      key: { hint: '4f2a' },
    });
    for (const token of ['tok-guest', 'lwt_0123456789abcdef0123456789abcdef', 'forged']) {
      const read = await call('/ai-key', bearer(token));
      expect(read.status).toBeGreaterThanOrEqual(401);
      expect(read.status).toBeLessThan(404);
      const write = await call('/ai-key', bearer(token, { method: 'DELETE' }));
      expect(write.status).toBeGreaterThanOrEqual(401);
      expect(write.status).toBeLessThan(404);
    }
    expect(await readAiKey(env.AUTH_DB, 'account', 'user_ada')).not.toBeNull();
  });
});

describe("a team's key", () => {
  beforeEach(() => {
    addTeam('team_1', [
      ['user_ada', 'admin'],
      ['user_bea', 'member'],
      ['user_cy', 'member', 'removed'],
    ]);
  });

  it('is set only by an admin, written to the audit log and emailed to the admins, with no key in either', async () => {
    const saved = await putKey('/teams/team_1/ai-key', { provider: 'openai', key: TEAM_KEY });
    expect(saved.status).toBe(200);
    expect(await saved.clone().json()).toMatchObject({
      teams: [{ id: 'team_1', canManage: true, key: { provider: 'openai', hint: '9c1d' } }],
    });
    await putKey('/teams/team_1/ai-key', { provider: 'openai', key: TEAM_KEY });
    await call('/teams/team_1/ai-key', { method: 'PATCH', body: { model: 'gpt-6-luna' } });
    const removed = await call('/teams/team_1/ai-key', { method: 'DELETE' });
    await settled();
    const events = sql
      .prepare(`SELECT body FROM index_events_outbox ORDER BY rowid`)
      .all()
      .map(
        (r) =>
          JSON.parse((r as { body: string }).body) as {
            type: string;
            actorId: string;
            detail: Record<string, string>;
          },
      );
    expect(events.map((e) => [e.type, e.actorId, e.detail.change, e.detail.provider])).toEqual([
      ['team_ai_key_changed', 'user_ada', 'set', 'openai'],
      ['team_ai_key_changed', 'user_ada', 'replaced', 'openai'],
      ['team_ai_key_changed', 'user_ada', 'model', 'openai'],
      ['team_ai_key_changed', 'user_ada', 'removed', 'openai'],
    ]);
    // Only the team's joined admins hear of it.
    expect(sent.map((m) => [m.to, m.subject])).toEqual([
      ['ada@example.com', 'Your team’s AI key was changed'],
      ['ada@example.com', 'Your team’s AI key was changed'],
      ['ada@example.com', 'Your team’s AI key was changed'],
    ]);
    const leaked = await everythingThatLeft([saved, removed]);
    expect(leaked).not.toContain(TEAM_KEY);
    expect(JSON.stringify(sent)).not.toContain('9c1d');
    expect(JSON.stringify(events)).not.toContain('9c1d');
  });

  it('is refused to a member, a removed member and a stranger, and its ending shown only to admins', async () => {
    await putKey('/teams/team_1/ai-key', { provider: 'openai', key: TEAM_KEY });
    signedIn = BEA;
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const response = await call('/teams/team_1/ai-key', {
        method,
        body: { provider: 'openai', key: KEY, model: 'gpt-6-luna' },
      });
      expect([response.status, await response.json()]).toEqual([403, { error: 'admin_only' }]);
    }
    const seen = (await (await call('/ai-key')).json()) as {
      teams: { canManage: boolean; key: { hint: string } }[];
    };
    expect(seen.teams).toEqual([
      expect.objectContaining({ canManage: false, key: expect.objectContaining({ hint: '' }) }),
    ]);
    signedIn = { ...BEA, id: 'user_cy' };
    expect((await putKey('/teams/team_1/ai-key', { provider: 'openai', key: KEY })).status).toBe(
      404,
    );
    expect((await putKey('/teams/team_nope/ai-key', { provider: 'openai', key: KEY })).status).toBe(
      404,
    );
    expect(((await (await call('/ai-key')).json()) as { teams: unknown[] }).teams).toEqual([]);
    // The member's attempts never reached a provider.
    expect(providerCalls).toHaveLength(1);
  });

  it('goes when the team is deleted', async () => {
    await putKey('/teams/team_1/ai-key', { provider: 'openai', key: TEAM_KEY });
    expect((await call('/teams/team_1', { method: 'DELETE' })).status).toBe(200);
    expect(await readAiKey(env.AUTH_DB, 'team', 'team_1')).toBeNull();
  });
});

describe('the internal door', () => {
  beforeEach(async () => {
    addTeam('team_1', [
      ['user_ada', 'admin'],
      ['user_bea', 'member'],
    ]);
    addTeam('team_2', [['user_ada', 'admin']]);
    await putKey('/ai-key', { provider: 'anthropic', key: KEY });
    await putKey('/teams/team_1/ai-key', { provider: 'openai', key: TEAM_KEY });
  });

  it("answers the team's key for a member, else the person's own, else none", async () => {
    const team = await door({ token: 'jwt-bea', teamId: 'team_1', want: 'key' });
    expect(team.headers.get('cache-control')).toBe('no-store');
    expect(await team.json()).toEqual({
      source: 'team',
      provider: 'openai',
      model: 'gpt-6.2-astra',
      key: TEAM_KEY,
    });
    expect(
      await (await door({ token: 'jwt-ada', teamId: 'team_2', want: 'key' })).json(),
    ).toMatchObject({
      source: 'account',
      key: KEY,
    });
    expect(await (await door({ token: 'jwt-ada', want: 'key' })).json()).toMatchObject({
      source: 'account',
    });
    expect(await (await door({ token: 'jwt-bea', want: 'key' })).json()).toEqual({ source: null });
    // `which` names the key that applies, never the key.
    expect(
      await (await door({ token: 'jwt-bea', teamId: 'team_1', want: 'which' })).json(),
    ).toEqual({
      source: 'team',
      provider: 'openai',
      model: 'gpt-6.2-astra',
    });
  });

  it("never answers a team's key to someone not joined to it, read now", async () => {
    // Bea leaves team 1: her next call has no team key, whatever her token says.
    sql.prepare(`UPDATE team_member SET status = 'removed' WHERE id = 'team_1-user_bea'`).run();
    expect(await (await door({ token: 'jwt-bea', teamId: 'team_1', want: 'key' })).json()).toEqual({
      source: null,
    });
    // A team deleted: nobody gets its key, even before the row goes.
    sql.prepare(`UPDATE team SET deletedAt = 2 WHERE id = 'team_1'`).run();
    expect(
      await (await door({ token: 'jwt-ada', teamId: 'team_1', want: 'key' })).json(),
    ).toMatchObject({
      source: 'account',
    });
  });

  it('refuses anything that came from outside, through a router, or without both proofs', async () => {
    const outside: Record<string, string>[] = [
      { 'cf-connecting-ip': '203.0.113.9' },
      { 'x-liveworkspace-proxy': 'liveknowledge.app' },
      { 'x-liveworkspace-client-ip': '203.0.113.9' },
    ];
    for (const headers of outside) {
      const response = await door({ token: 'jwt-ada', want: 'key' }, headers);
      expect([response.status, await response.text()]).toEqual([404, 'Not found']);
    }
    const get = await handleAiKeyInternal(
      new Request(`http://accounts${AI_KEY_INTERNAL_PATH}`),
      env,
      auth,
    );
    expect(get.status).toBe(404);
    const refusals: [Response, number, string][] = [
      // No client, a wrong client secret.
      [await door({ token: 'jwt-ada', want: 'key' }, {}, ''), 401, 'invalid_client'],
      [
        await door({ token: 'jwt-ada', want: 'key' }, {}, `Basic ${btoa('liveknowledge:wrong')}`),
        401,
        'invalid_client',
      ],
      // No token: no "give me account X's key" by id.
      [await door({ userId: 'user_ada', want: 'key' }), 400, 'access_token_required'],
      [await door({ token: 'forged', want: 'key' }), 401, 'invalid_token'],
      // A token minted for another app is not this app's to forward.
      [await door({ token: 'jwt-ada-planner', want: 'key' }), 401, 'invalid_token'],
      // A guest has no key.
      [await door({ token: 'jwt-guest', want: 'key' }), 401, 'invalid_token'],
      [await door({ token: 'jwt-ada', teamId: 7, want: 'key' }), 400, 'invalid_team'],
      [await door({ token: 'jwt-ada', teamId: 'x'.repeat(101), want: 'key' }), 400, 'invalid_team'],
      [await door({ token: 'jwt-ada', want: 'everything' }), 400, 'invalid_want'],
    ];
    for (const [response, status, code] of refusals) {
      expect([response.status, await response.json()]).toEqual([status, { error: code }]);
    }
    expect(fromBinding(new Request('http://accounts/x'))).toBe(true);
  });

  it('answers the other client its own person only', async () => {
    const response = await door({ token: 'jwt-ada-planner', want: 'which' }, {}, OTHER_CLIENT);
    expect(await response.json()).toMatchObject({ source: 'account' });
  });

  it('limits reads per account', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    env = { ...env, AI_KEY_LIMITER: { limit } } as unknown as Env;
    const response = await door({ token: 'jwt-ada', want: 'key' });
    expect([response.status, await response.json()]).toEqual([429, { error: 'rate_limited' }]);
    expect(limit).toHaveBeenCalledWith({ key: 'use:user_ada' });
  });

  it('says a stored key could not be read, and nothing of it, when the secret no longer opens it', async () => {
    env = { ...env, AI_KEY_SECRET: '1:a-different-secret' } as Env;
    const response = await door({ token: 'jwt-ada', want: 'key' });
    expect([response.status, await response.clone().json()]).toEqual([
      409,
      { error: 'ai_key_unreadable', source: 'account' },
    ]);
    expect(await everythingThatLeft([response])).not.toContain(KEY);
  });

  it('logs nothing of a key or a token', async () => {
    const responses = [
      await door({ token: 'jwt-ada', want: 'key' }),
      await door({ token: 'jwt-bea', teamId: 'team_1', want: 'key' }),
    ];
    expect(JSON.stringify(logged)).not.toMatch(/jwt-|sk-/);
    // The plain keys left only in the two answers that carry them.
    const rest = (await everythingThatLeft([])).replace(/"sealed":"[^"]+"/g, '');
    expect(rest).not.toContain(KEY);
    expect(rest).not.toContain(TEAM_KEY);
    expect(responses.every((r) => r.status === 200)).toBe(true);
  });
});

describe('rotating the master secret', () => {
  it('re-seals every row under the new secret, then the old one can go', async () => {
    for (let i = 0; i < 3; i++) addUser(sql, { id: `user_r${i}`, email: `r${i}@example.com` });
    const old = aiKeySecrets({ AI_KEY_SECRET: SECRET })!;
    for (let i = 0; i < 3; i++) {
      const { sealed } = await sealAiKey(old, `account:user_r${i}`, 'anthropic', `${KEY}${i}`);
      sql
        .prepare(
          `INSERT INTO ai_key (owner_kind, owner_id, provider, model, sealed, key_version, hint, set_by, set_at)
           VALUES ('account', ?, 'anthropic', 'claude-fable-5-2', ?, 1, '', ?, ?)`,
        )
        .run(`user_r${i}`, sealed, `user_r${i}`, i);
    }
    // One row no secret opens: counted, left.
    sql
      .prepare(
        `INSERT INTO ai_key (owner_kind, owner_id, provider, model, sealed, key_version, hint, set_by, set_at)
         VALUES ('team', 'team_gone', 'anthropic', 'claude-fable-5-2', '1.AAAA.AAAA.AAAA', 1, '', 'x', 9)`,
      )
      .run();
    const rotated = aiKeySecrets({
      AI_KEY_SECRET: '2:the-new-secret',
      AI_KEY_SECRET_PREVIOUS: SECRET,
    })!;
    expect(await resealAiKeys(env.AUTH_DB, aiKeySecrets({ AI_KEY_SECRET: SECRET })!)).toEqual({
      resealed: 0,
      unreadable: 0,
      left: 0,
    });
    expect(await resealAiKeys(env.AUTH_DB, rotated, 2)).toEqual({
      resealed: 2,
      unreadable: 0,
      left: 2,
    });
    expect(await resealAiKeys(env.AUTH_DB, rotated, 2)).toEqual({
      resealed: 1,
      unreadable: 1,
      left: 1,
    });

    // With only the new secret, every re-sealed key still answers.
    env = { ...env, AI_KEY_SECRET: '2:the-new-secret' } as Env;
    TOKENS['jwt-r2'] = { sub: 'user_r2', client_id: 'liveknowledge' };
    expect(await (await door({ token: 'jwt-r2', want: 'key' })).json()).toMatchObject({
      key: `${KEY}2`,
    });
    delete TOKENS['jwt-r2'];
  });

  it('leaves a row replaced while it ran', async () => {
    const old = aiKeySecrets({ AI_KEY_SECRET: SECRET })!;
    const { sealed } = await sealAiKey(old, 'account:user_ada', 'anthropic', KEY);
    sql
      .prepare(
        `INSERT INTO ai_key (owner_kind, owner_id, provider, model, sealed, key_version, hint, set_by, set_at)
         VALUES ('account', 'user_ada', 'anthropic', 'claude-fable-5-2', ?, 1, '', 'user_ada', 1)`,
      )
      .run(sealed);
    const db = env.AUTH_DB;
    // The person saves a new key between the sweep's read and its write.
    const racing = new Proxy(db, {
      get(target, key) {
        if (key !== 'prepare') return Reflect.get(target, key);
        return (query: string) => {
          if (query.startsWith('UPDATE ai_key SET sealed')) {
            sql.prepare(`UPDATE ai_key SET sealed = 'replaced' WHERE owner_id = 'user_ada'`).run();
          }
          return target.prepare(query);
        };
      },
    });
    const rotated = aiKeySecrets({ AI_KEY_SECRET: '2:new', AI_KEY_SECRET_PREVIOUS: SECRET })!;
    expect(await resealAiKeys(racing, rotated)).toMatchObject({ resealed: 0 });
    expect(sql.prepare(`SELECT sealed FROM ai_key`).get()).toEqual({ sealed: 'replaced' });
  });
});
