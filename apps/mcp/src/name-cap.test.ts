import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Env } from './env';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: (value: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] }),
}));

import { registerTools } from './tools';

// The name cap end to end through the real MCP SDK (docs/specs/006-diagram/name-length.md):
// a client lists the tools and calls them over a transport, so the SDK's own
// input validation runs the schema's truncateName before a tool body sees the
// name, and the api receives the stored form.

const LONG = 'Quarterly platform migration plan for the payments team and friends';
const CAPPED = 'Quarterly platform migration plan for the payments team…';

async function connect() {
  const sent: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const env = {
    API: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname.replace(/^\/api/, '');
        const text = await request.text();
        sent.push({ method: request.method, path, body: text ? JSON.parse(text) : null });
        if (/\/tabs\/[^/]+$/.test(path) && request.method === 'GET') {
          return Response.json({ tab: { id: 't1', name: 'Tab', elements: [] } });
        }
        if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: { id: 't1' } });
        return Response.json({ diagram: { id: 'd1', name: CAPPED, tabs: [{ id: 't1' }] } });
      },
    },
  } as unknown as Env;
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerTools(server, env);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  // Every client message carries a bearer token, the shape the worker's auth
  // layer hands the SDK, so requireToken passes.
  const send = clientSide.send.bind(clientSide);
  clientSide.send = (message, options) =>
    send(message, {
      ...options,
      authInfo: { token: 'lvd_test', clientId: 'test-client', scopes: [] },
    });
  await server.connect(serverSide);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientSide);
  return { client, sent };
}

describe('diagram and tab names through the MCP SDK', () => {
  it('advertises the cap on every name argument', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    for (const name of ['create_diagram', 'add_tab', 'rename_diagram']) {
      const tool = tools.find((t) => t.name === name)!;
      const prop = (tool.inputSchema.properties as Record<string, { description?: string }>).name;
      expect(prop?.description).toContain('at most 60 characters');
    }
  });

  it('create_diagram sends the api the shortened diagram and tab names', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'create_diagram',
      arguments: { name: LONG, tabs: [{ name: LONG, elements: [] }] },
    });
    const create = sent.find((s) => s.method === 'POST' && s.path === '/diagrams')!;
    expect(create.body?.name).toBe(CAPPED);
    expect((create.body?.tabs as { name: string }[])[0]!.name).toBe(CAPPED);
  });

  it('add_tab and a tab rename send and report the shortened name', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'add_tab',
      arguments: { diagramId: 'd1', name: LONG, elements: [], theme: 'brand' },
    });
    const put = sent.find((s) => s.method === 'PUT' && s.path.startsWith('/diagrams/d1/tabs/'))!;
    expect(put.body?.name).toBe(CAPPED);

    const result = await client.callTool({
      name: 'rename_diagram',
      arguments: { diagramId: 'd1', tabId: 't1', name: LONG },
    });
    const renamed = sent.filter((s) => s.method === 'PUT' && s.path === '/diagrams/d1/tabs/t1');
    expect(renamed.at(-1)?.body?.name).toBe(CAPPED);
    const text = (result.content as { type: string; text: string }[])[0]!.text;
    expect(JSON.parse(text).name).toBe(CAPPED);
  });

  it('rename_diagram sends the shortened diagram name', async () => {
    const { client, sent } = await connect();
    await client.callTool({ name: 'rename_diagram', arguments: { diagramId: 'd1', name: LONG } });
    const put = sent.find((s) => s.method === 'PUT' && s.path === '/diagrams/d1')!;
    expect(put.body).toEqual({ name: CAPPED });
  });
});
