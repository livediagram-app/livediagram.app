import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';

// `./image-result` reaches the resvg WASM renderer, which cannot load here; the stub hands back the
// structured result so the reported folder can be read.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// create_project and default folders (docs/specs/015-api/mcp-server.md §4.3,
// docs/specs/013-workspace/default-folders.md): the create carries the creation intent of the first
// tab and the template it used, and the result names the folder the project landed in.

type Created = { folderId: string | null; teamId: string | null } | undefined;

function harness(created: Created, lookups: Record<string, unknown> = {}) {
  const posted: Record<string, unknown>[] = [];
  const requested: string[] = [];
  let handler: ((args: unknown, extra: unknown) => Promise<unknown>) | undefined;
  const server = {
    registerTool: (name: string, _config: unknown, h: typeof handler) => {
      if (name === 'create_project') handler = h;
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname.replace(/^\/api/, '');
        requested.push(`${request.method} ${path}`);
        if (path === '/events') return new Response(null, { status: 204 });
        if (request.method === 'POST' && path === '/projects') {
          posted.push(await request.json<Record<string, unknown>>());
          return Response.json(created ? { project: { id: 'd', ...created } } : {});
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

// Making a project is a use, unless the model says not (docs/specs/015-api/mcp-server.md §4.3,
// docs/specs/013-workspace/explorer-home.md "Making a project").
describe('create_project markUsed', () => {
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

describe('create_project intent', () => {
  it('sends a Plan intent for elements', async () => {
    const { run, posted } = harness(undefined);
    await run([elements]);
    expect(posted[0]!.intent).toEqual({ mode: 'plan', tabKind: 'diagram' });
  });

  it.each([
    ['team-retro', { mode: 'plan', tabKind: 'diagram', templateFamily: 'retrospective' }],
    ['kanban', { mode: 'plan', tabKind: 'diagram', templateFamily: 'kanban' }],
    ['blank-spreadsheet', { mode: 'plan', tabKind: 'diagram' }],
  ])('sends the intent of a %s template tab', async (template, intent) => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Tab', template }]);
    expect(posted[0]!.intent).toEqual(intent);
  });

  it('adds every tab of a Plan template with several, the first named as given', async () => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Plan', template: 'project-planner' }]);
    const tabs = posted[0]!.tabs as { id: string; name: string }[];
    expect(tabs.map((t) => t.name)).toEqual([
      'Plan',
      'Backlog',
      'Sprint',
      'Daily Standup',
      'Overview',
    ]);
    expect(new Set(tabs.map((t) => t.id)).size).toBe(5);
  });

  // docs/specs/026-plan/item-types.md "The type catalogue": a template's boards choose a new project's card types.
  it('makes a Plan template’s project with exactly the card types its boards take', async () => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Plan', template: 'project-planner' }]);
    const itemTypes = posted[0]!.itemTypes as { types: { id: string }[] };
    expect(itemTypes.types.map((t) => t.id)).toEqual(['project', 'story', 'task', 'bug']);
  });

  it('sends no catalogue for a project with no Plan board', async () => {
    const { run, posted } = harness(undefined);
    await run([elements, { name: 'Budget', template: 'blank-spreadsheet' }]);
    expect(posted[0]).not.toHaveProperty('itemTypes');
  });

  it('reads the intent from the first tab only', async () => {
    const { run, posted } = harness(undefined);
    await run([elements, { name: 'Board', template: 'kanban' }]);
    expect(posted[0]!.intent).toEqual({ mode: 'plan', tabKind: 'diagram' });
  });
});

describe('create_project folder', () => {
  it('reports My Projects when the project landed at the root', async () => {
    const { run, requested } = harness({ folderId: null, teamId: null });
    expect((await run([elements])).structuredContent.folder).toBe('My Projects');
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
      { '/teams/t1/library': { folders: [{ id: 'tf', name: 'Retros' }], projects: [] } },
    );
    expect((await run([elements])).structuredContent.folder).toBe('Retros');
  });

  it('says "your default folder" when the name cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { run } = harness({ folderId: 'f1', teamId: null });
    expect((await run([elements])).structuredContent.folder).toBe('your default folder');
    expect(warn).toHaveBeenCalledWith('[mcp] create_project folder lookup failed status=503');
    warn.mockRestore();
  });
});

// A tab's own theme wins over the project's (docs/specs/015-api/mcp-server.md §4.3): a theme put on a tab was dropped.
describe('create_project themes', () => {
  it('gives each tab its own theme, else the project’s', async () => {
    const { run, posted } = harness({ folderId: null, teamId: null });
    await run(
      [
        { name: 'Own', elements: [], theme: 'mocha' },
        { name: 'Doc', elements: [] },
      ],
      { theme: 'ocean' },
    );
    const tabs = (posted[0]!.tabs as { theme?: string }[]).map((t) => t.theme);
    expect(tabs).toEqual(['mocha', 'ocean']);
  });
});
