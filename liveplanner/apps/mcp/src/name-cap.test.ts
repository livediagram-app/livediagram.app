import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts). The
// stub keeps the structured result the SDK validates
// (docs/specs/015-api/mcp-server.md §4.17).
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';

// The name cap end to end through the real MCP SDK (docs/specs/006-project/name-length.md):
// a client lists the tools and calls them over a transport, so the SDK's own
// input validation runs the schema's truncateName before a tool body sees the
// name, and the api receives the stored form.

const LONG = 'Quarterly platform migration plan for the payments team and friends';
const CAPPED = 'Quarterly platform migration plan for the payments team…';

async function connect() {
  const sent: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  const client = await connectTestClient(async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    const text = await request.text();
    sent.push({
      method: request.method,
      path,
      body: text ? (JSON.parse(text) as Record<string, unknown>) : null,
    });
    if (/\/tabs\/[^/]+$/.test(path) && request.method === 'GET') {
      return Response.json({ tab: { id: 't1', name: 'Tab', rev: 1, elements: [] } });
    }
    if (path.endsWith('/changesets')) {
      return Response.json({
        dryRun: false,
        changeset: null,
        results: [],
        text: '',
        warnings: [],
      });
    }
    if (path.endsWith('/name')) {
      return Response.json({
        tab: { id: 't1', name: (JSON.parse(text) as { name: string }).name },
      });
    }
    return Response.json({ project: { id: 'd1', name: CAPPED, tabs: [{ id: 't1' }] } });
  });
  return { client, sent };
}

describe('project and tab names through the MCP SDK', () => {
  it('advertises the cap on every name argument', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    for (const name of ['create_project', 'add_tab', 'rename_project']) {
      const tool = tools.find((t) => t.name === name)!;
      const prop = (tool.inputSchema.properties as Record<string, { description?: string }>).name;
      expect(prop?.description).toContain('at most 60 characters');
    }
  });

  it('create_project sends the api the shortened project and tab names', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'create_project',
      arguments: { name: LONG, tabs: [{ name: LONG, elements: [] }] },
    });
    const create = sent.find((s) => s.method === 'POST' && s.path === '/projects')!;
    expect(create.body?.name).toBe(CAPPED);
    expect((create.body?.tabs as { name: string }[] | undefined)?.[0]?.name).toBe(CAPPED);
  });

  it('create_project takes a single tab alias, checked and capped as tabs are, and names what is wrong', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'create_project',
      arguments: { name: 'Doc', tab: { name: LONG, elements: [] } },
    });
    const create = sent.find((s) => s.method === 'POST' && s.path === '/projects')!;
    expect((create.body?.tabs as { name: string }[] | undefined)?.[0]?.name).toBe(CAPPED);
    const bad = await client.callTool({
      name: 'create_project',
      arguments: { name: 'Doc', tab: { name: 'One', elements: 'none' } },
    });
    expect(bad.isError).toBe(true);
    expect((bad.content as { text: string }[])[0]!.text).toMatch(/^"tab": elements: .*Pass "tabs"/);
  });

  it('add_tab and a tab rename send and report the shortened name', async () => {
    const { client, sent } = await connect();
    await client.callTool({
      name: 'add_tab',
      arguments: { projectId: 'd1', name: LONG, elements: [], theme: 'brand' },
    });
    // The tab arrives as a changeset that creates it (docs/specs/024-agents/agent-changesets.md).
    const created = sent.find((s) => s.method === 'POST' && s.path.endsWith('/changesets'))!;
    expect((created.body?.replace as { name: string } | undefined)?.name).toBe(CAPPED);

    const result = await client.callTool({
      name: 'rename_project',
      arguments: { projectId: 'd1', tabId: 't1', name: LONG },
    });
    const renamed = sent.filter(
      (s) => s.method === 'PUT' && s.path === '/projects/d1/tabs/t1/name',
    );
    expect(renamed.at(-1)?.body?.name).toBe(CAPPED);
    const text = (result.content as { type: string; text: string }[])[0]!.text;
    expect(JSON.parse(text)).toHaveProperty('name', CAPPED);
  });

  it('rename_project sends the shortened project name', async () => {
    const { client, sent } = await connect();
    await client.callTool({ name: 'rename_project', arguments: { projectId: 'd1', name: LONG } });
    const put = sent.find((s) => s.method === 'PUT' && s.path === '/projects/d1')!;
    expect(put.body).toEqual({ name: CAPPED });
  });
});
