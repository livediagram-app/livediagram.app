import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

// tools.ts reaches the resvg renderer through ./image-result, which plain node cannot load (tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { registerTools } from './tools';

// archive_document, unarchive_document and find_documents's `archived` (docs/specs/015-api/mcp-server.md "Archived").

type Registered = { name: string; handler: (args: unknown, extra: unknown) => Promise<unknown> };
const AUTHED = { authInfo: { token: 'tok_test' } };

function harness(answer: (method: string, path: string) => Response) {
  const calls: { method: string; path: string; body: unknown }[] = [];
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
        const text = await request.text();
        calls.push({
          method: request.method,
          path: `${url.pathname}${url.search}`,
          body: text ? JSON.parse(text) : null,
        });
        return answer(request.method, url.pathname);
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const tool = (name: string) => registered.find((r) => r.name === name)!;
  return { calls, tool };
}

const result = (r: unknown) =>
  JSON.parse((r as { content: { text: string }[] }).content[0]!.text) as Record<string, unknown>;

describe('archive_document', () => {
  it('archives through the api and says so', async () => {
    const { calls, tool } = harness(() => Response.json({ document: { id: 'd1', name: 'Old' } }));
    const answer = await tool('archive_document').handler({ documentId: 'd1' }, AUTHED);
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/documents/d1/archive']);
    expect(result(answer)).toEqual({ archived: 'document', id: 'd1', name: 'Old' });
  });

  it('answers a teammate who is not the owner in words', async () => {
    const { tool } = harness(() => Response.json({ error: 'not_owner' }, { status: 403 }));
    const answer = (await tool('archive_document').handler({ documentId: 'd1' }, AUTHED)) as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(answer.isError).toBe(true);
    expect(answer.content[0]!.text).toContain('owner can archive it');
  });
});

describe('unarchive_document', () => {
  it('moves it to the top of My Work by default, and names the team it went to', async () => {
    const { calls, tool } = harness((_m, path) =>
      path === '/api/teams'
        ? Response.json({ teams: [{ id: 't1', name: 'Crew' }] })
        : Response.json({
            document: { id: 'd1', name: 'Old', teamId: path.includes('d2') ? 't1' : null },
          }),
    );
    const mine = await tool('unarchive_document').handler({ documentId: 'd1' }, AUTHED);
    expect(result(mine)).toMatchObject({ unarchived: 'document', id: 'd1', library: 'personal' });
    expect(result(mine).url).toContain('/d1');
    const team = await tool('unarchive_document').handler(
      { documentId: 'd2', teamId: 't1' },
      AUTHED,
    );
    expect(result(team)).toMatchObject({ library: 'Crew' });
    expect(calls.filter((c) => c.path.endsWith('/unarchive'))).toEqual([
      {
        method: 'POST',
        path: '/api/documents/d1/unarchive',
        body: { folderId: null, teamId: null },
      },
      {
        method: 'POST',
        path: '/api/documents/d2/unarchive',
        body: { folderId: null, teamId: 't1' },
      },
    ]);
  });
});

describe('find_documents with archived', () => {
  it('asks the index for the Archived alone and marks each found', async () => {
    const { calls, tool } = harness((_m, path) =>
      path === '/api/teams'
        ? Response.json({ teams: [] })
        : Response.json({ documents: [{ id: 'd1', name: 'Old', savedAt: 1, teamId: null }] }),
    );
    const answer = await tool('find_documents').handler({ archived: true }, AUTHED);
    expect(calls.map((c) => c.path)).toContain('/api/documents?team=all&limit=20&archived=1');
    expect(result(answer)).toMatchObject({
      count: 1,
      documents: [{ id: 'd1', archived: true }],
    });
  });
});
