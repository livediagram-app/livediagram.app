import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';

// A tab id the design does not hold is named as the tab, with the design's tabs (docs/specs/015-api/mcp-server.md),
// as read_design and update_design do. The tab routes answer a bare 404, which read as "no such design".

async function connect() {
  return connectTestClient(async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.includes('/tabs/')) return Response.json({ error: 'not_found' }, { status: 404 });
    if (path === '/designs/d1')
      return Response.json({
        design: {
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
  it('rename_design names the tab and lists the design’s tabs', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_design',
      arguments: { designId: 'd1', tabId: 'nope', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe('No tab "nope" in this design. Tabs: Logo (t1).');
  });

  it('change_pages names the tab and lists the design’s tabs', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'change_pages',
      arguments: { designId: 'd1', tabId: 'nope', changes: [{ op: 'delete', page: 1 }] },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/No tab "nope" in this design\. Tabs: Logo \(t1\)\./);
  });

  it('still blames the design when the design is what is missing', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_design',
      arguments: { designId: 'gone', tabId: 't1', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/no such design/i);
  });
});
