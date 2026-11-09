// A token the api stops accepting (each product's docs/specs/015-api/mcp-server.md §3): one 401 from the api turns
// the /mcp response into the OAuth challenge, so the client signs in again instead of retrying a dead token.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import { createMcpApp } from './app';
import { mcpListing, serverIdentity } from './listing';
import type { OauthEnv } from './oauth-clients';
import { watchTokenRefusal } from './token-refusal';

type TestEnv = OauthEnv & { API?: Fetcher };

const LISTING = mcpListing({ product: 'liveexample', description: 'Examples.', version: '1.0.0' });

// One tool that asks the api, as every product's tools do, and turns a refusal into a tool error.
function buildServer(env: TestEnv): McpServer {
  const server = new McpServer(serverIdentity(LISTING));
  server.registerTool('find_examples', { description: 'Finds examples.' }, async () => {
    const res = await env.API!.fetch('https://liveexample-api/api/examples');
    if (!res.ok) return { isError: true, content: [{ type: 'text', text: 'refused' }] };
    return { content: [{ type: 'text', text: await res.text() }] };
  });
  return server;
}

const app = createMcpApp<TestEnv>({
  buildServer,
  oauth: { appBase: () => 'https://www.liveexample.app', builtInClients: {} },
  listing: LISTING,
});

function apiAnswering(status: number): Fetcher {
  return {
    fetch: vi.fn(async () => new Response(status === 200 ? 'two examples' : '{}', { status })),
    connect: vi.fn(),
  };
}

const RPC_HEADERS = {
  Authorization: 'Bearer lwt_abcdefghijklmnopqrstuvwxyz',
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

function call(env: TestEnv, method: string, params: Record<string, unknown> = {}) {
  return app.request(
    'https://mcp.liveexample.app/mcp',
    {
      method: 'POST',
      headers: RPC_HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    },
    env,
  );
}

const KV = {} as KVNamespace;

describe('/mcp with a token the api refuses', () => {
  it('answers 401 with the invalid_token challenge, so the client signs in again', async () => {
    const res = await call({ OAUTH_KV: KV, API: apiAnswering(401) }, 'tools/call', {
      name: 'find_examples',
      arguments: {},
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer error="invalid_token", resource_metadata="https://mcp.liveexample.app/.well-known/oauth-protected-resource"',
    );
    expect(await res.json()).toEqual({ error: 'invalid_token' });
  });

  it('answers a tool call the api accepts as before', async () => {
    const res = await call({ OAUTH_KV: KV, API: apiAnswering(200) }, 'tools/call', {
      name: 'find_examples',
      arguments: {},
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).toContain('two examples');
  });

  it('keeps any other refusal a tool error inside a 200', async () => {
    const res = await call({ OAUTH_KV: KV, API: apiAnswering(404) }, 'tools/call', {
      name: 'find_examples',
      arguments: {},
    });
    expect(res.status).toBe(200);
  });

  it('answers a request that never reaches the api as before', async () => {
    const api = apiAnswering(401);
    const res = await call({ OAUTH_KV: KV, API: api }, 'tools/list');
    expect(res.status).toBe(200);
    expect(api.fetch).not.toHaveBeenCalled();
  });
});

describe('watchTokenRefusal', () => {
  it('hands back an env without an api binding as it is', () => {
    const env = { OAUTH_KV: KV };
    const watch = watchTokenRefusal(env);
    expect(watch.env).toBe(env);
    expect(watch.refused()).toBe(false);
  });

  it('passes connect through to the binding', () => {
    const api = apiAnswering(200);
    watchTokenRefusal({ API: api }).env.API.connect('example.com:443');
    expect(api.connect).toHaveBeenCalledWith('example.com:443');
  });

  it('names no error on the challenge for a missing token', async () => {
    const res = await app.request(
      'http://localhost:8788/mcp',
      { method: 'POST', body: '{}' },
      { OAUTH_KV: KV },
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer resource_metadata="http://localhost:8788/.well-known/oauth-protected-resource"',
    );
  });
});
