// The MCP Worker's answers outside the tools (each product's docs/specs/015-api/mcp-server.md "Claude connector
// directory"): no token is taken from the URL, and every refusal is in words.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it, vi } from 'vitest';
import { createMcpApp, URL_TOKEN_PARAMS } from './app';
import { mcpListing, serverIdentity } from './listing';
import type { OauthEnv } from './oauth-clients';

const LISTING = mcpListing({ product: 'liveexample', description: 'Examples.', version: '1.0.0' });
const KV = {} as KVNamespace;

const app = createMcpApp<OauthEnv & { CRASH?: boolean }>({
  buildServer: (env) => {
    if (env.CRASH) throw new Error('database exploded');
    return new McpServer(serverIdentity(LISTING));
  },
  oauth: { appBase: () => 'https://www.liveexample.app', builtInClients: {} },
  listing: LISTING,
});

const RPC = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
};

describe('a token in the URL', () => {
  it.each(URL_TOKEN_PARAMS)('is refused in words as ?%s, even beside a header', async (name) => {
    const res = await app.request(
      `https://mcp.liveexample.app/mcp?${name}=lwt_abcdefghijklmnopqrstuvwxyz`,
      { ...RPC, headers: { ...RPC.headers, Authorization: 'Bearer lwt_abc' } },
      { OAUTH_KV: KV },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'invalid_request',
      error_description: expect.stringContaining('Authorization header'),
    });
  });

  it('matches the name in any case, and leaves other parameters alone', async () => {
    const upper = await app.request('https://mcp.liveexample.app/mcp?Access_Token=x', RPC, {
      OAUTH_KV: KV,
    });
    expect(upper.status).toBe(400);
    const other = await app.request('https://mcp.liveexample.app/mcp?view=1', RPC, {
      OAUTH_KV: KV,
    });
    expect(other.status).toBe(401);
  });
});

describe('refusals in words', () => {
  it('answers a missing token 401 with the challenge and a sentence', async () => {
    const res = await app.request('https://mcp.liveexample.app/mcp', RPC, { OAUTH_KV: KV });
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata="https://mcp.liveexample.app/.well-known/oauth-protected-resource"',
    );
    expect(await res.json()).toMatchObject({
      error_description: expect.stringContaining('Sign in'),
    });
  });

  it('names the MCP endpoint for an unknown path', async () => {
    const res = await app.request('https://mcp.liveexample.app/nope', {}, { OAUTH_KV: KV });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'not_found',
      error_description: 'No GET /nope here. The MCP endpoint is /mcp.',
    });
  });

  it('answers a crash as a sentence, never a bare Internal Server Error', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request(
      'https://mcp.liveexample.app/mcp',
      { ...RPC, headers: { ...RPC.headers, Authorization: 'Bearer lwt_abc' } },
      { OAUTH_KV: KV, CRASH: true },
    );
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain('Internal Server Error');
    expect(JSON.parse(body)).toMatchObject({
      error: 'server_error',
      error_description: expect.stringContaining('Try again'),
    });
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
});

describe('the tool list', () => {
  it('says a long description once per tool (tool-list-compact.ts)', async () => {
    const { z } = await import('zod');
    const long = z.string().describe('What the rule does when it runs. '.repeat(10));
    const listed = createMcpApp<OauthEnv>({
      buildServer: () => {
        const server = new McpServer(serverIdentity(LISTING));
        server.registerTool('change', { inputSchema: { first: long, second: long } }, () => ({
          content: [],
        }));
        return server;
      },
      oauth: { appBase: () => 'https://www.liveexample.app', builtInClients: {} },
      listing: LISTING,
    });
    const res = await listed.request(
      'https://mcp.liveexample.app/mcp',
      {
        ...RPC,
        headers: {
          ...RPC.headers,
          Authorization: 'Bearer lwt_abc',
          'Content-Length': String(RPC.body.length),
        },
      },
      { OAUTH_KV: KV },
    );
    const { result } = await res.json<{
      result: { tools: { inputSchema: { properties: Record<string, { description: string }> } }[] };
    }>();
    expect(result.tools[0]!.inputSchema.properties.second!.description).toBe(
      'Same as "first" above.',
    );
  });
});
