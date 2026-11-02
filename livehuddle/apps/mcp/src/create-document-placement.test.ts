import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

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
          posted.push(await request.json<Record<string, unknown>>());
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
    ['retrospective', { mode: 'workshop', tabKind: 'diagram', templateFamily: 'retrospective' }],
    ['four-ls', { mode: 'workshop', tabKind: 'diagram', templateFamily: 'retrospective' }],
    ['event-storming', { mode: 'diagram', tabKind: 'event-storming' }],
    ['incident-postmortem', { mode: 'workshop', tabKind: 'diagram' }],
    ['lean-coffee', { mode: 'workshop', tabKind: 'diagram' }],
    ['whiteboard', { mode: 'draw', tabKind: 'diagram' }],
    ['flowchart', { mode: 'diagram', tabKind: 'diagram' }],
  ])('sends the intent of a %s template tab', async (template, intent) => {
    const { run, posted } = harness(undefined);
    await run([{ name: 'Tab', template }]);
    expect(posted[0]!.intent).toEqual(intent);
  });

  it('reads the intent from the first tab only', async () => {
    const { run, posted } = harness(undefined);
    await run([elements, { name: 'Retro', template: 'start-stop-continue' }]);
    expect(posted[0]!.intent).toEqual({ mode: 'diagram', tabKind: 'diagram' });
  });
});

// An unnamed template tab takes the template's title, as the editor names one (docs/specs/007-editor/
// templates-by-mode.md "The tab's name"), which the tab argument's description promises; any other is "Tab n".
describe('create_document tab names', () => {
  it('names an unnamed template tab after its template, and an unnamed other tab "Tab n"', async () => {
    const { run, posted } = harness(undefined);
    await run([{ template: 'flowchart' }, { elements: [] }, { name: 'Mine', template: 'swot' }]);
    const tabs = posted[0]!.tabs as { name: string }[];
    expect(tabs.map((t) => t.name)).toEqual(['Flowchart', 'Tab 2', 'Mine']);
  });
});

describe('create_document folder', () => {
  it('reports My Work when the document landed at the root', async () => {
    const { run, requested } = harness({ folderId: null, teamId: null });
    expect((await run([elements])).structuredContent.folder).toBe('My Work');
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

// A tab's own theme wins over the document's (docs/specs/015-api/mcp-server.md §4.3): a theme put on a tab was dropped.
describe('create_document themes', () => {
  it('gives each tab its own theme, else the document’s', async () => {
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

// A tree takes a direction as a flow does (docs/specs/015-api/mcp-server.md §4.7 "Layout choices").
describe('create_document tree direction', () => {
  const org = (direction?: 'down' | 'right') => ({
    name: 'Org',
    graph: {
      style: 'tree',
      ...(direction ? { direction } : {}),
      nodes: ['ceo', 'cto', 'coo', 'a', 'b'].map((id) => ({ id, label: id.toUpperCase() })),
      edges: [
        { from: 'ceo', to: 'cto' },
        { from: 'ceo', to: 'coo' },
        { from: 'cto', to: 'a' },
        { from: 'cto', to: 'b' },
      ],
    },
  });
  type Box = { id: string; x: number; y: number; width: number; height: number };
  const boxes = async (direction?: 'down' | 'right') => {
    const { run, posted } = harness(undefined);
    await run([org(direction)]);
    const tab = (posted[0]!.tabs as { elements: Box[] }[])[0]!;
    return (id: string) => tab.elements.find((e) => e.id === id)!;
  };

  it('runs a tree left to right when asked right', async () => {
    const at = await boxes('right');
    expect(at('cto').x).toBeGreaterThan(at('ceo').x + at('ceo').width);
    expect(at('a').x).toBeGreaterThan(at('cto').x + at('cto').width);
    expect(at('a').x).toBe(at('b').x);
  });

  it('runs a tree down when asked down, and with no direction', async () => {
    for (const direction of ['down', undefined] as const) {
      const at = await boxes(direction);
      expect(at('cto').y).toBeGreaterThan(at('ceo').y + at('ceo').height);
      expect(at('cto').y).toBe(at('coo').y);
    }
  });
});
