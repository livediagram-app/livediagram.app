import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';

// A tab id the document does not hold is named as the tab, with the document's tabs (docs/specs/015-api/mcp-server.md),
// as read_document and update_document do. The tab routes answer a bare 404, which read as "no such document".

async function connect() {
  return connectTestClient(async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.includes('/tabs/')) return Response.json({ error: 'not_found' }, { status: 404 });
    if (path === '/documents/d1')
      return Response.json({
        document: {
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
  it('rename_document names the tab and lists the document’s tabs', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_document',
      arguments: { documentId: 'd1', tabId: 'nope', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toBe('No tab "nope" in this document. Tabs: Logo (t1).');
  });

  it('change_pages and write_article name the tab and list the document’s tabs', async () => {
    const client = await connect();
    for (const [name, rest] of [
      ['change_pages', { changes: [{ op: 'delete', page: 1 }] }],
      ['write_article', { markdown: '# Hi' }],
    ] as const) {
      const r = await client.callTool({
        name,
        arguments: { documentId: 'd1', tabId: 'nope', ...rest },
      });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toMatch(/No tab "nope" in this document\. Tabs: Logo \(t1\)\./);
    }
  });

  it('still blames the document when the document is what is missing', async () => {
    const client = await connect();
    const r = await client.callTool({
      name: 'rename_document',
      arguments: { documentId: 'gone', tabId: 't1', name: 'New' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/no such document/i);
  });
});
