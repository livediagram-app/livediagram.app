import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import {
  AGENT_NAME_TTL_SECONDS,
  HANDSHAKE_MAX_BYTES,
  agentNameOf,
  clientNameFor,
  currentClientName,
  rememberClientName,
  runWithClientName,
  withAgentHeaders,
  type SeesHandshake,
} from './agent-name';

// The client name every product's MCP sends its api (each product's mcp-server.md §2 "Who is calling", Work Tracker
// 1381; liveknowledge's knowledgebase-for-agents.md): sanitised, remembered at the handshake against the token's hash,
// read back by a later call, and named on every api call the request makes.

function kv() {
  const held = new Map<string, string>();
  const puts: { key: string; value: string; ttl: number | undefined }[] = [];
  const store = {
    get: async (key: string) => held.get(key) ?? null,
    put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
      held.set(key, value);
      puts.push({ key, value, ttl: options?.expirationTtl });
    },
  };
  return { env: { OAUTH_KV: store } as unknown as Env, held, puts };
}

const handshake = (
  name: unknown,
  init: { token?: string | null; path?: string; method?: string } = {},
) => {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { clientInfo: { name, version: '1' } },
  });
  return new Request(`https://mcp.test${init.path ?? '/mcp'}`, {
    method: init.method ?? 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(body.length),
      ...(init.token === null
        ? {}
        : { Authorization: `Bearer ${init.token ?? 'lwt_secret_token_value_1234'}` }),
    },
    ...(init.method === 'GET' ? {} : { body }),
  });
};

const serverSeeing = (name?: string) =>
  ({
    server: { getClientVersion: () => (name === undefined ? undefined : { name }) },
  }) as SeesHandshake;

describe('agentNameOf', () => {
  it('keeps a plain name', () => {
    expect(agentNameOf('Claude Code')).toBe('Claude Code');
  });

  it('drops what a header cannot carry, and caps the rest at 60 characters', () => {
    expect(agentNameOf('  Claude\r\nX-Evil: 1‮ ')).toBe('Claude X-Evil: 1');
    expect(agentNameOf('Cürsor 🚀 IDE')).toBe('C rsor IDE');
    expect(agentNameOf('a'.repeat(59) + ' bcd')).toBe('a'.repeat(59));
    expect(agentNameOf('x'.repeat(200))).toHaveLength(60);
  });

  it('answers nothing for no name', () => {
    for (const none of [undefined, null, 7, '', '   ', '‮\u0000'])
      expect(agentNameOf(none)).toBe('');
  });
});

describe('rememberClientName', () => {
  it('keeps the handshake’s client name against the token’s hash, never the token', async () => {
    const { env, puts } = kv();
    const request = handshake('Claude Code');
    await rememberClientName(env, request);
    expect(puts).toHaveLength(1);
    expect(puts[0]).toMatchObject({ value: 'Claude Code', ttl: AGENT_NAME_TTL_SECONDS });
    expect(puts[0]!.key).toMatch(/^agent-name:[0-9a-f]{64}$/);
    expect(puts[0]!.key).not.toContain('lwt_secret');
    // The request itself is still whole for the transport.
    expect((await request.json<{ method: string }>()).method).toBe('initialize');
    expect(await clientNameFor(serverSeeing(), env, 'lwt_secret_token_value_1234')).toBe(
      'Claude Code',
    );
    expect(await clientNameFor(serverSeeing(), env, 'lwt_another_token')).toBe('');
  });

  it('writes nothing when the same client connects again', async () => {
    const { env, puts } = kv();
    await rememberClientName(env, handshake('Cursor'));
    await rememberClientName(env, handshake('Cursor'));
    expect(puts).toHaveLength(1);
    await rememberClientName(env, handshake('Claude Code'));
    expect(puts.map((p) => p.value)).toEqual(['Cursor', 'Claude Code']);
  });

  it('reads nothing but a small handshake on POST /mcp from a signed-in caller', async () => {
    const { env, puts } = kv();
    const call = new Request('https://mcp.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer lwt_x', 'Content-Length': '60' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: {} }),
    });
    const big = new Request('https://mcp.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer lwt_x', 'Content-Length': String(HANDSHAKE_MAX_BYTES + 1) },
      body: 'x',
    });
    const clone = vi.spyOn(big, 'clone');
    const unsized = new Request('https://mcp.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer lwt_x' },
      body: '{}',
    });
    for (const request of [
      call,
      big,
      unsized,
      handshake('Claude', { token: null }),
      handshake('Claude', { path: '/oauth/token' }),
      handshake('Claude', { method: 'GET' }),
      handshake(42),
      handshake('‮'),
    ])
      await rememberClientName(env, request);
    expect(puts).toEqual([]);
    expect(clone).not.toHaveBeenCalled();
  });

  it('never throws: a body that is no JSON, or a store that is down, is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = kv();
    const broken = new Request('https://mcp.test/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer lwt_x', 'Content-Length': '5' },
      body: 'nope!',
    });
    await expect(rememberClientName(env, broken)).resolves.toBeUndefined();
    const down = {
      OAUTH_KV: {
        get: async () => {
          throw new Error('kv down');
        },
      },
    } as unknown as Env;
    await expect(rememberClientName(down, handshake('Claude'))).resolves.toBeUndefined();
    expect(await clientNameFor(serverSeeing(), down, 'lwt_x')).toBe('');
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });
});

describe('clientNameFor', () => {
  it('takes the name from a handshake this server saw, without reading the store', async () => {
    const get = vi.fn(async () => 'Remembered');
    const env = { OAUTH_KV: { get } } as unknown as Env;
    expect(await clientNameFor(serverSeeing('  Zed\tEditor '), env, 'lwt_x')).toBe('Zed Editor');
    expect(get).not.toHaveBeenCalled();
    expect(await clientNameFor(serverSeeing(), env, 'lwt_x')).toBe('Remembered');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('answers nothing on a server with no store', async () => {
    expect(await clientNameFor(serverSeeing(), {} as Env, 'lwt_x')).toBe('');
  });
});

describe("the request's name on every api call", () => {
  const HEADERS = { client: 'X-Livediagram-Client', agent: 'X-Livediagram-Agent' };
  const call = (headers: Record<string, string> = {}) =>
    new Request('https://livediagram-api/api/documents/d', { method: 'PUT', headers, body: '{}' });

  it('names the door and the client, looking the name up once a request', async () => {
    const lookup = vi.fn(async () => 'Claude Code');
    await runWithClientName(lookup, async () => {
      const first = await withAgentHeaders(call(), HEADERS);
      const second = await withAgentHeaders(call(), HEADERS);
      for (const sent of [first, second]) {
        expect(sent.headers.get('X-Livediagram-Client')).toBe('mcp');
        expect(sent.headers.get('X-Livediagram-Agent')).toBe('Claude Code');
      }
      expect(await first.text()).toBe('{}');
    });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('sends the door alone for a client with no name, and outside a request', async () => {
    await runWithClientName(
      async () => '',
      async () => {
        const sent = await withAgentHeaders(call(), HEADERS);
        expect(sent.headers.get('X-Livediagram-Client')).toBe('mcp');
        expect(sent.headers.has('X-Livediagram-Agent')).toBe(false);
      },
    );
    expect(await currentClientName()).toBe('');
    expect((await withAgentHeaders(call(), HEADERS)).headers.get('X-Livediagram-Client')).toBe(
      'mcp',
    );
  });

  it('keeps what the caller set', async () => {
    await runWithClientName(
      async () => 'Claude Code',
      async () => {
        const sent = await withAgentHeaders(
          call({ 'X-Livediagram-Client': 'cli', 'X-Livediagram-Agent': 'Own' }),
          HEADERS,
        );
        expect(sent.headers.get('X-Livediagram-Client')).toBe('cli');
        expect(sent.headers.get('X-Livediagram-Agent')).toBe('Own');
      },
    );
  });
});
