// Existing connections, replayed from the old client's side through the Worker's own entry (index.ts) (liveworkspace/
// docs/specs/021-mcp/mcp.md "Existing connections"; Work Tracker 1447, 1448). What a client connected before this
// change holds is what main's authorization server handed it: the account token itself (`lwt_`, six months) as its
// access token, no refresh token, and a dynamically registered `client_id` (`client:<32 hex>` → its redirect URIs and
// name). It replays exactly that: `initialize`, `tools/list` and a `tools/call` inside the 30-day window, a revoked
// one refused, and after the window the sign-in it is sent through with the client id it kept.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pkceChallenge } from '@liveworkspace/api-kit/oauth';
import { randomBase64Url } from '@liveworkspace/api-kit/bytes';
import { forgetCatalogues } from './app-client';
import { LEGACY_TOKENS_UNTIL, forgetBearers } from './bearer';
import type { WorkerEnv } from './env';

// Each app's MCP package as a stub speaking its contract: JSON-RPC over fetch, the person's token in Authorization.
const shared = vi.hoisted(() => ({
  seen: [] as { app: string; method: string; auth: string | null }[],
  answer: null as
    null | ((app: string, method: string, params: Record<string, unknown>) => unknown),
}));
const stub = (app: string) => ({
  default: {
    fetch: async (request: Request) => {
      const body = await request.json<{
        id: number;
        method: string;
        params: Record<string, unknown>;
      }>();
      shared.seen.push({ app, method: body.method, auth: request.headers.get('Authorization') });
      const result = shared.answer!(app, body.method, body.params ?? {});
      if (result === undefined)
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: 'Method not found' },
        });
      return Response.json({ jsonrpc: '2.0', id: body.id, result });
    },
  },
});
vi.mock('@livediagram/mcp', () => stub('livediagram'));
vi.mock('@livedocuments/mcp', () => stub('livedocuments'));
vi.mock('@liveplanner/mcp', () => stub('liveplanner'));
vi.mock('@livedesign/mcp', () => stub('livedesign'));
vi.mock('@liveknowledge/mcp', () => stub('liveknowledge'));

import worker from './index';

function mockKV() {
  const m = new Map<string, string>();
  const kv = {
    get: async (k: string, type?: string): Promise<unknown> => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => {
      m.set(k, v);
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
  return { kv, m };
}

function recorded(app: string): unknown[] {
  const parsed: unknown = JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'eval', 'tools', `${app}.json`), 'utf8'),
  );
  return Array.isArray(parsed) ? parsed : [];
}

const HOST = 'https://mcp.liveworkspace.app';
const CLAUDE_AI = 'https://claude.ai/api/mcp/auth_callback';
const DAY = 24 * 60 * 60 * 1000;
const INSIDE = LEGACY_TOKENS_UNTIL - 2 * DAY;
const AFTER = LEGACY_TOKENS_UNTIL + DAY;

let kv: KVNamespace;
let store: Map<string, string>;
let revoked: Set<string>;
let checked: string[];
let pending: Promise<unknown>[];
// What the old client holds, as main's authorization server handed it out.
let held: { accessToken: string; clientId: string };

function api(name: string): Fetcher {
  return {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const token = request.headers.get('Authorization')?.slice('Bearer '.length) ?? '';
      if (new URL(request.url).pathname === '/api/tokens/current') {
        checked.push(`${name} ${token}`);
        return revoked.has(token)
          ? Response.json({ error: 'invalid_token' }, { status: 401 })
          : Response.json({ tokenId: 'tok_1', role: 'full' });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    },
    connect: () => {
      throw new Error('no sockets');
    },
  };
}

let env: WorkerEnv;
const ctx = {
  waitUntil: (p: Promise<unknown>) => pending.push(p),
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

beforeEach(() => {
  forgetCatalogues();
  forgetBearers();
  shared.seen = [];
  shared.answer = (app, method) => {
    if (method === 'tools/list') return { tools: recorded(app) };
    if (method === 'tools/call')
      return { content: [{ type: 'text', text: JSON.stringify({ documents: [] }) }] };
    if (method === 'initialize') return { protocolVersion: '2025-06-18', instructions: `${app}.` };
    return undefined;
  };
  ({ kv, m: store } = mockKV());
  revoked = new Set();
  checked = [];
  pending = [];
  env = {
    LIVEDIAGRAM_API: api('livediagram-api'),
    LIVEDOCUMENTS_API: api('livedocuments-api'),
    LIVEPLANNER_API: api('liveplanner-api'),
    LIVEDESIGN_API: api('livedesign-api'),
    LIVEKNOWLEDGE_API: api('liveknowledge-api'),
    OAUTH_KV: kv,
    CONSENT_BASE_URL: 'https://www.liveworkspace.app',
  };
  // main's /oauth/register wrote this record, and its /oauth/token answered the consent page's account token as is.
  held = {
    accessToken: `lwt_${randomBase64Url(32)}`,
    clientId: crypto.randomUUID().replace(/-/g, ''),
  };
  store.set(
    `client:${held.clientId}`,
    JSON.stringify({ redirectUris: [CLAUDE_AI], clientName: 'Claude' }),
  );
  store.set(`grant:${held.clientId}`, JSON.stringify(['tok_1']));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(INSIDE);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function mcp(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  host = HOST,
) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const response = await worker.fetch(
    new Request(`${host}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': String(body.length),
        Accept: 'application/json, text/event-stream',
      },
      body,
    }),
    env,
    ctx,
  );
  await Promise.all(pending);
  return response;
}

const INITIALIZE = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'Claude', version: '1.0' },
};

describe('a client connected before this change, inside the 30-day window', () => {
  it('initializes, lists tools and calls one with the token it holds', async () => {
    const init = await mcp(held.accessToken, 'initialize', INITIALIZE);
    expect(init.status).toBe(200);
    expect((await init.json<{ result: { serverInfo: unknown } }>()).result.serverInfo).toBeTruthy();
    const list = await mcp(held.accessToken, 'tools/list');
    expect(list.status).toBe(200);
    const tools = (await list.json<{ result: { tools: { name: string }[] } }>()).result.tools;
    expect(tools.map((t) => t.name)).toContain('find_items');
    const call = await mcp(held.accessToken, 'tools/call', {
      name: 'find_items',
      arguments: { query: 'retro' },
    });
    expect(call.status).toBe(200);
    expect((await call.json<{ result?: unknown; error?: unknown }>()).error).toBeUndefined();
    // Each app was called as the person, and liveworkspace was asked about the token first.
    const calls = shared.seen.filter((s) => s.method === 'tools/call');
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls.map((c) => c.auth))).toEqual(new Set([`Bearer ${held.accessToken}`]));
    expect(checked[0]).toBe(`livediagram-api ${held.accessToken}`);
  });

  it('works with a token carried over from the old livediagram.app (`lvd_`, docs/migration.md)', async () => {
    const carried = `lvd_${randomBase64Url(32)}`;
    expect((await mcp(carried, 'initialize', INITIALIZE)).status).toBe(200);
    expect((await mcp(carried, 'tools/list')).status).toBe(200);
    const call = await mcp(carried, 'tools/call', { name: 'find_items', arguments: {} });
    expect(call.status).toBe(200);
    expect(shared.seen.filter((s) => s.method === 'tools/call').at(-1)?.auth).toBe(
      `Bearer ${carried}`,
    );
  });

  it('keeps its old app address too', async () => {
    const response = await mcp(held.accessToken, 'tools/list', {}, 'https://mcp.livediagram.app');
    expect(response.status).toBe(200);
    expect(shared.seen.at(-1)).toEqual({
      app: 'livediagram',
      method: 'tools/list',
      auth: `Bearer ${held.accessToken}`,
    });
  });

  it('can’t initialize or list tools once the token is revoked, nor with a made-up one', async () => {
    revoked.add(held.accessToken);
    revoked.add('lwt_madeup');
    for (const token of [held.accessToken, 'lwt_madeup', 'made-up'])
      for (const method of ['initialize', 'tools/list']) {
        const response = await mcp(token, method, method === 'initialize' ? INITIALIZE : {});
        expect(response.status).toBe(401);
        expect(response.headers.get('WWW-Authenticate')).toBe(
          `Bearer error="invalid_token", resource_metadata="${HOST}/.well-known/oauth-protected-resource"`,
        );
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      }
    expect(shared.seen).toEqual([]);
  });
});

describe('the same client after the window', () => {
  it('is asked to sign in, and signs in again with the client id it kept', async () => {
    vi.setSystemTime(AFTER);
    const refused = await mcp(held.accessToken, 'initialize', INITIALIZE);
    expect(refused.status).toBe(401);
    expect(refused.headers.get('WWW-Authenticate')).toContain('error="invalid_token"');
    expect(shared.seen).toEqual([]);
    // The client follows the challenge, as an MCP client does.
    const resource = await (
      await worker.fetch(new Request(`${HOST}/.well-known/oauth-protected-resource`), env, ctx)
    ).json<{ authorization_servers: string[]; resource: string }>();
    expect(resource.resource).toBe(`${HOST}/mcp`);
    const as = await (
      await worker.fetch(
        new Request(`${resource.authorization_servers[0]}/.well-known/oauth-authorization-server`),
        env,
        ctx,
      )
    ).json<{
      authorization_endpoint: string;
      token_endpoint: string;
      grant_types_supported: string[];
    }>();
    expect(as.grant_types_supported).toContain('refresh_token');
    const verifier = 'k'.repeat(64);
    const authorize = await worker.fetch(
      new Request(
        `${as.authorization_endpoint}?client_id=${held.clientId}&redirect_uri=${encodeURIComponent(CLAUDE_AI)}` +
          `&code_challenge=${await pkceChallenge(verifier)}&code_challenge_method=S256&response_type=code&state=st` +
          `&resource=${encodeURIComponent(`${HOST}/mcp`)}`,
      ),
      env,
      ctx,
    );
    expect(authorize.status).toBe(302);
    const consent = new URL(authorize.headers.get('location')!);
    expect(consent.origin).toBe('https://www.liveworkspace.app');
    // The consent page mints a fresh account token and hands it over, as it does today.
    const minted = `lwt_${randomBase64Url(32)}`;
    const complete = await worker.fetch(
      new Request(`${HOST}/oauth/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: consent.searchParams.get('session'),
          token: minted,
          expiresAt: AFTER + 180 * DAY,
          tokenId: 'tok_2',
          apps: ['livediagram', 'livedocuments', 'liveplanner', 'livedesign', 'liveknowledge'],
        }),
      }),
      env,
      ctx,
    );
    const handed = await complete.json<{ redirectTo: string; replaces: string[] }>();
    expect(handed.replaces).toEqual(['tok_1']);
    const code = new URL(handed.redirectTo).searchParams.get('code')!;
    const token = await (
      await worker.fetch(
        new Request(as.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            code_verifier: verifier,
            redirect_uri: CLAUDE_AI,
            client_id: held.clientId,
            resource: `${HOST}/mcp`,
          }),
        }),
        env,
        ctx,
      )
    ).json<{ access_token: string; refresh_token: string; expires_in: number }>();
    expect(token.access_token).toMatch(/^lwm_/);
    expect(token.refresh_token).toMatch(/^lwr_/);
    expect(token.expires_in).toBe(3600);
    // Back to work with the new token: the apps see the account token, never the client's.
    expect((await mcp(token.access_token, 'initialize', INITIALIZE)).status).toBe(200);
    expect((await mcp(token.access_token, 'tools/list')).status).toBe(200);
    const call = await mcp(token.access_token, 'tools/call', {
      name: 'find_items',
      arguments: { query: 'retro' },
    });
    expect(call.status).toBe(200);
    const auths = new Set(shared.seen.map((s) => s.auth));
    expect(auths).toEqual(new Set([`Bearer ${minted}`]));
    expect([...store.values()].join('\n')).not.toContain(minted);
    // The handshake's client name is kept by the account token, where each app's package looks for it.
    const nameKeys = [...store.keys()].filter((k) => k.startsWith('agent-name:'));
    expect(nameKeys).toHaveLength(1);
    // The old token stays refused, at the old address as well.
    expect((await mcp(held.accessToken, 'tools/list')).status).toBe(401);
    expect(
      (await mcp(held.accessToken, 'tools/list', {}, 'https://mcp.livediagram.app')).status,
    ).toBe(401);
    // The new token is for this address alone.
    const elsewhere = await mcp(
      token.access_token,
      'tools/list',
      {},
      'https://mcp.livediagram.app',
    );
    expect(elsewhere.status).toBe(401);
    expect(await elsewhere.text()).toContain('https://mcp.liveworkspace.app/mcp');
  });
});
