import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';

// A tab id the plan does not hold is named as the tab, with the plan's tabs (docs/specs/015-api/mcp-server.md),
// as read_project and update_project do. The tab routes answer a bare 404, which read as "no such plan".

async function connect() {
  return connectTestClient(async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.includes('/tabs/')) return Response.json({ error: 'not_found' }, { status: 404 });
    if (path === '/projects/d1')
      return Response.json({
        project: {
          id: 'd1',
          name: 'Brand',
          tabs: [{ id: 't1', name: 'Logo', orderIndex: 0 }],
        },
      });
    return Response.json({ error: 'not_found' }, { status: 404 });
  });
}

const textOf = (r: Record<string, unknown>) => (r.content as { text: string }[])[0]!.text;

describe('an unknown tab id', () => {
  it('rename_project names the tab and lists the plan’s tabs', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_project',
      arguments: { projectId: 'd1', tabId: 'nope', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe('No tab "nope" in this plan. Tabs: Logo (t1).');
  });

  it('still blames the plan when the plan is what is missing', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_project',
      arguments: { projectId: 'gone', tabId: 't1', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/no such plan/i);
  });
});
