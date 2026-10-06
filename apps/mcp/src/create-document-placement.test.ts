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

function harness(created: Created, lookups: Record<string, unknown> = {}, lint?: unknown) {
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
        // The lint summary of each created tab (docs/specs/024-agents/diagram-lint.md LN24).
        if (new URL(request.url).searchParams.get('view') === 'lint')
          return lint ? Response.json(lint) : new Response('down', { status: 503 });
        const answer = lookups[path];
        if (answer === undefined) return new Response('nope', { status: 503 });
        return Response.json(answer);
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const run = async (tabs: unknown[], extra: Record<string, unknown> = {}) =>
    (await handler!({ name: 'Doc', tabs, ...extra }, { authInfo: { token: 'tok' } })) as {
      structuredContent: { folder: string; lint: string[] };
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
    ['kanban', { mode: 'plan', tabKind: 'diagram', templateFamily: 'kanban' }],
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

  it('adds every tab of a Plan template with several, the first named as given', async () => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Plan', template: 'project-planner' }]);
    const tabs = posted[0]!.tabs as { id: string; name: string; opensIn?: string }[];
    expect(tabs.map((t) => t.name)).toEqual(['Plan', 'Backlog', 'Sprint', 'Daily Standup']);
    expect(new Set(tabs.map((t) => t.id)).size).toBe(4);
    expect(tabs.every((t) => t.opensIn === 'plan')).toBe(true);
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
    expect(requested.filter((r) => r.startsWith('GET') && !r.includes('/tabs/'))).toEqual([]);
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

describe('create_document lint', () => {
  const report = {
    measures: {
      crossings: 0,
      behind: 0,
      overlaps: 0,
      extent: { width: 120, height: 60 },
      arrows: 0,
      boxes: 1,
    },
    findings: [],
    counts: { error: 0, warning: 0, info: 0 },
    skipped: { crossings: false },
  };

  it('carries one summary line per created tab', async () => {
    const { run } = harness(undefined, {}, report);
    const result = await run([elements, elements]);
    expect(result.structuredContent.lint).toEqual([
      '0 crossings · 0 behind · 0 overlaps · 120×60 → clean',
      '0 crossings · 0 behind · 0 overlaps · 120×60 → clean',
    ]);
  });

  it('says lint unavailable when the view fails, and logs it', async () => {
    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args));
    const { run } = harness(undefined);
    expect((await run([elements])).structuredContent.lint).toEqual(['lint unavailable']);
    expect(errors[0]?.[0]).toBe('[lint] failed');
    vi.restoreAllMocks();
  });
});
