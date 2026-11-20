import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

// tools.ts reaches the resvg renderer through ./image-result, which plain node cannot load (tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { registerTools } from './tools';

// list_versions and restore_version (docs/specs/015-api/mcp-server.md §4.9e).

type Registered = { name: string; handler: (args: unknown, extra: unknown) => Promise<unknown> };
const AUTHED = { authInfo: { token: 'tok_test' } };
const DOC = {
  document: {
    id: 'd1',
    name: 'Deck',
    tabs: [
      { id: 't2', name: 'Second', orderIndex: 1 },
      { id: 'tx', name: 'Hidden', orderIndex: 0, outOfScope: true },
      { id: 't1', name: 'First', orderIndex: 0 },
    ],
  },
};
const VERSION = {
  id: 'v1',
  tabId: 't1',
  rev: 3,
  kind: 'agent',
  name: null,
  author: { name: 'Ada', color: '#123456' },
  savedAt: Date.UTC(2026, 10, 14, 9, 30),
  createdAt: Date.UTC(2026, 10, 14, 9, 30),
  bytes: 10,
  elementCount: 1,
};

function harness(answer: (method: string, path: string) => Response) {
  const calls: string[] = [];
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, _config: unknown, handler: Registered['handler']) => {
      registered.push({ name, handler });
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
        calls.push(`${request.method} ${url.pathname}`);
        return answer(request.method, url.pathname);
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const tool = (name: string) => registered.find((r) => r.name === name)!;
  return { calls, tool };
}

const text = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;
const result = (r: unknown) => JSON.parse(text(r)) as Record<string, unknown>;

describe('list_versions', () => {
  it("lists the first reachable tab's versions when no tab is named", async () => {
    const { calls, tool } = harness((_, path) =>
      path.endsWith('/versions') ? Response.json({ versions: [VERSION] }) : Response.json(DOC),
    );
    const out = result(await tool('list_versions').handler({ documentId: 'd1' }, AUTHED));
    expect(calls).toEqual(['GET /api/documents/d1', 'GET /api/documents/d1/tabs/t1/versions']);
    expect(out).toMatchObject({ tabId: 't1', tabName: 'First' });
    expect(out.versions).toEqual([
      {
        id: 'v1',
        rev: 3,
        kind: 'agent',
        name: null,
        author: 'Ada',
        savedAt: '2026-11-14T09:30:00.000Z',
      },
    ]);
  });

  it('names the tabs there are when the one named is not', async () => {
    const { tool } = harness(() => Response.json(DOC));
    const out = (await tool('list_versions').handler(
      { documentId: 'd1', tabId: 'nope' },
      AUTHED,
    )) as { isError?: boolean };
    expect(out.isError).toBe(true);
    expect(text(out)).toContain('First (t1)');
  });
});

describe('restore_version', () => {
  const args = { documentId: 'd1', tabId: 't1', versionId: 'v1' };

  it('restores through the api and names the Undo', async () => {
    const restored = { tabId: 't1', rev: 5, changesetId: 'cs_1', undoVersionId: 'v9' };
    const { calls, tool } = harness(() => Response.json({ restored }));
    const out = result(await tool('restore_version').handler(args, AUTHED));
    expect(calls).toEqual(['POST /api/documents/d1/tabs/t1/versions/v1/restore']);
    expect(out).toMatchObject({ restored: true, rev: 5, undoVersionId: 'v9' });
  });

  it('says when the version is already the content', async () => {
    const { tool } = harness(() => Response.json({ restored: null }));
    expect(result(await tool('restore_version').handler(args, AUTHED))).toMatchObject({
      restored: false,
    });
  });

  it('points a missing version at list_versions', async () => {
    const { tool } = harness(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const out = await tool('restore_version').handler(args, AUTHED);
    expect(text(out)).toContain('list_versions');
  });

  it('answers a held element in the route words', async () => {
    const held = [{ id: 'e1', by: { name: 'Bea', color: '#f00' } }];
    const { tool } = harness(() =>
      Response.json({ error: 'elements_held', held }, { status: 409 }),
    );
    const out = (await tool('restore_version').handler(args, AUTHED)) as { isError?: boolean };
    expect(out.isError).toBe(true);
    expect(text(out)).toContain('e1 (held by Bea)');
  });

  it('leaves another failure to the shared refusal', async () => {
    const { tool } = harness(() => Response.json({ error: 'forbidden' }, { status: 403 }));
    const out = (await tool('restore_version').handler(args, AUTHED)) as { isError?: boolean };
    expect(out.isError).toBe(true);
  });
});
