import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';

// `./image-result` reaches the resvg WASM renderer, which cannot load here; the stub hands back the
// structured result so the reported folder can be read.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// create_document and default folders (docs/specs/015-api/mcp-server.md §4.3,
// docs/specs/013-workspace/default-folders.md): the create carries the creation intent of the first
// tab and the template it used, and the result names the folder the document landed in.

type Created = { folderId: string | null; teamId: string | null } | undefined;

function harness(created: Created, lookups: Record<string, unknown> = {}) {
  const posted: Record<string, unknown>[] = [];
  const requested: string[] = [];
  let handler: ((args: unknown, extra: unknown) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (name: string, _config: unknown, h: typeof handler) => {
      if (name === 'create_document') handler = h;
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname.replace(/^\/api/, '');
        requested.push(`${request.method} ${path}`);
        if (path === '/events') return new Response(null, { status: 204 });
        if (request.method === 'POST' && path === '/documents') {
          posted.push((await request.json()) as Record<string, unknown>);
          return Response.json(created ? { document: { id: 'd', ...created } } : {});
        }
        const answer = lookups[path];
        if (answer === undefined) return new Response('nope', { status: 503 });
        return Response.json(answer);
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const run = async (tabs: unknown[], extra: Record<string, unknown> = {}) =>
    (await handler!({ name: 'Doc', tabs, ...extra }, { authInfo: { token: 'tok' } })) as {
      structuredContent: { folder: string };
    };
  return { run, posted, requested };
}

const elements = { name: 'Tab', elements: [] };

// Making a document is a use, unless the model says not (docs/specs/015-api/mcp-server.md §4.3,
// docs/specs/013-workspace/explorer-home.md "Making a document").
describe('create_document markUsed', () => {
  it('sends nothing when the model gives none: the making counts', async () => {
    const { run, posted } = harness(undefined);
    await run([elements]);
    expect(posted[0]).not.toHaveProperty('markUsed');
  });

  it.each([true, false])('passes markUsed: %s through to the create', async (markUsed) => {
    const { run, posted } = harness(undefined);
    await run([elements], { markUsed });
    expect(posted[0]!.markUsed).toBe(markUsed);
  });
});

describe('create_document intent', () => {
  it('sends a diagram for elements', async () => {
    const { run, posted } = harness(undefined);
    await run([elements]);
    expect(posted[0]!.intent).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });

  it.each([
    ['retrospective', { mode: 'diagram', tabKind: 'diagram', templateFamily: 'retrospective' }],
    ['four-ls', { mode: 'diagram', tabKind: 'diagram', templateFamily: 'retrospective' }],
    ['kanban', { mode: 'diagram', tabKind: 'diagram', templateFamily: 'kanban' }],
    ['event-storming', { mode: 'diagram', tabKind: 'event-storming' }],
    ['incident-postmortem', { mode: 'diagram', tabKind: 'diagram' }],
    ['lean-coffee', { mode: 'diagram', tabKind: 'diagram' }],
    ['whiteboard', { mode: 'draw', tabKind: 'diagram' }],
    ['flowchart', { mode: 'diagram', tabKind: 'diagram' }],
  ])('sends the intent of a %s template tab', async (template, intent) => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Tab', template }]);
    expect(posted[0]!.intent).toEqual(intent);
  });

  it('reads the intent from the first tab only', async () => {
    const { run, posted } = harness(undefined);
    await run([elements, { name: 'Board', template: 'kanban' }]);
    expect(posted[0]!.intent).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });
});

describe('create_document folder', () => {
  it('reports My documents when the document landed at the root', async () => {
    const { run, requested } = harness({ folderId: null, teamId: null });
    expect((await run([elements])).structuredContent.folder).toBe('My documents');
    expect(requested.filter((r) => r.startsWith('GET'))).toEqual([]);
  });

  it('names the personal default folder it landed in', async () => {
    const { run } = harness(
      { folderId: 'f1', teamId: null },
      { '/folders': { folders: [{ id: 'f1', name: 'Diagrams' }] } },
    );
    expect((await run([elements])).structuredContent.folder).toBe('Diagrams');
  });

  it('names the team default folder it landed in', async () => {
    const { run } = harness(
      { folderId: 'tf', teamId: 't1' },
      { '/teams/t1/library': { folders: [{ id: 'tf', name: 'Retros' }], documents: [] } },
    );
    expect((await run([elements])).structuredContent.folder).toBe('Retros');
  });

  it('says "your default folder" when the name cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { run } = harness({ folderId: 'f1', teamId: null });
    expect((await run([elements])).structuredContent.folder).toBe('your default folder');
    expect(warn).toHaveBeenCalledWith('[mcp] create_document folder lookup failed status=503');
    warn.mockRestore();
  });
});
