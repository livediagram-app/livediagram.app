import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { renderElementsToSvg, type Element, type Tab } from '@livediagram/document';
import { buildTemplateTab } from '@livediagram/templates';
import { createPngRenderer } from '@liveworkspace/render-png';
import { cpuBudgetMs, cpuMsOf, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import type { Env } from '@liveworkspace/mcp-kit/env';

// The rasteriser does not load under Node; registering tools never renders.
vi.mock('@liveworkspace/mcp-kit/render', () => ({ svgToPngBase64: async () => '' }));

import { registerTools } from './tools';
import {
  clickableElements,
  registerViewPage,
  roomSocketUrl,
  VIEW_URI,
  viewEdit,
  viewEditChangeset,
  viewLive,
  viewTab,
} from './view-tab';

// docs/specs/015-api/mcp-server.md "Interactive view (MCP Apps)": the page, the tools that link it, and view_tab.

type Registered = { name: string; config: { _meta?: Record<string, unknown> } };

function registrations(): Registered[] {
  const seen: Registered[] = [];
  const server = {
    registerTool: (name: string, config: Registered['config']) => void seen.push({ name, config }),
  } as unknown as McpServer;
  registerTools(server, {} as Env);
  return seen;
}

describe('the interactive view', () => {
  it('links create_document, add_tab, update_document and read_document, and only those', () => {
    const linked = registrations()
      .filter((r) => !r.name.includes('deprecated'))
      .filter((r) => (r.config._meta?.ui as { resourceUri?: string })?.resourceUri === VIEW_URI)
      .map((r) => r.name)
      .sort();
    expect(linked).toEqual(['add_tab', 'create_document', 'read_document', 'update_document']);
  });

  it('keeps view_tab, view_live and view_edit from the model in a host with MCP Apps', () => {
    for (const name of ['view_tab', 'view_live', 'view_edit']) {
      const view = registrations().find((r) => r.name === name)!;
      expect(view.config._meta, name).toEqual({ ui: { visibility: ['app'] } });
    }
  });

  it('lists the page under its ui:// address, its CSP allowing only the editor host’s socket', () => {
    const seen: { uri: string; meta: { ui: { csp: unknown } } }[] = [];
    const server = {
      registerResource: (_n: string, uri: string, m: { _meta: { ui: { csp: unknown } } }) =>
        void seen.push({ uri, meta: m._meta }),
    } as unknown as McpServer;
    registerViewPage(server, {});
    registerViewPage(server, { CONSENT_BASE_URL: 'http://localhost:3100' });
    expect(seen.map((r) => r.uri)).toEqual([VIEW_URI, VIEW_URI]);
    expect(seen.map((r) => r.meta.ui.csp)).toEqual([
      { connectDomains: ['wss://www.livediagram.app'], resourceDomains: [] },
      { connectDomains: ['ws://localhost:3100'], resourceDomains: [] },
    ]);
  });

  it('offers every boxed element drawn, with its ref and label, never an arrow or a hidden layer’s', () => {
    const tab = {
      id: 't1',
      name: 'Main',
      layers: [
        { id: 'l1', name: 'Shown', visible: true },
        { id: 'l2', name: 'Hidden', visible: false },
      ],
      elements: [
        { id: 'pay', type: 'shape', x: 0, y: 0, width: 10, height: 10, label: ' Pay ' },
        { id: 'ship', type: 'shape', x: 20, y: 0, width: 10, height: 10, label: '' },
        { id: 'secret', type: 'shape', x: 0, y: 0, width: 10, height: 10, layerId: 'l2' },
        { id: 'link', type: 'arrow', from: 'pay', to: 'ship' },
        { id: 'odd', type: 'shape', x: 0, y: 0, width: Number.NaN, height: 1 },
      ] as unknown as Element[],
    } as unknown as Tab;
    const may = { canRename: true, canMove: true };
    expect(clickableElements(tab)).toEqual([
      { id: 'pay', ref: 'pay', label: 'Pay', x: 0, y: 0, width: 10, height: 10, ...may },
      { id: 'ship', ref: 'ship', label: null, x: 20, y: 0, width: 10, height: 10, ...may },
    ]);
  });

  // "Edits in the view": what an edit may do, as the engine would allow it and the editor carries attachments.
  it('marks what an edit in the view may do to each element', () => {
    const box = { x: 0, y: 0, width: 10, height: 10 };
    const tab = {
      id: 't1',
      name: 'Main',
      layers: [
        { id: 'l1', name: 'Open', visible: true },
        { id: 'l2', name: 'Fixed', visible: true, locked: true },
      ],
      elements: [
        { id: 'shape', type: 'shape', ...box },
        { id: 'note', type: 'sticky', ...box },
        { id: 'pic', type: 'image', ...box },
        { id: 'pinned', type: 'shape', locked: true, ...box },
        { id: 'fixed', type: 'text', layerId: 'l2', ...box },
        { id: 'host', type: 'shape', ...box },
        { id: 'badge', type: 'shape', attachedTo: 'host', ...box },
      ] as unknown as Element[],
    } as unknown as Tab;
    const edits = Object.fromEntries(
      clickableElements(tab).map((e) => [e.id, [e.canRename, e.canMove]]),
    );
    expect(edits).toEqual({
      shape: [true, true],
      note: [true, true],
      pic: [false, true],
      pinned: [false, false],
      fixed: [false, false],
      host: [true, false],
      badge: [true, false],
    });
    const locked = clickableElements({ ...tab, locked: true });
    expect(locked.every((e) => !e.canRename && !e.canMove)).toBe(true);
  });
});

// docs/specs/015-api/mcp-server.md "Live updates": view_live mints a view-only ticket for the token's owner and
// hands it to the view alone: never in the text line or a log.
describe('view_live', () => {
  const envAnswering = (answer: (request: Request) => Response) =>
    ({
      API: { fetch: async (request: Request) => answer(request) },
      CONSENT_BASE_URL: 'https://www.livediagram.app',
    }) as unknown as Env;

  it('mints a view-only ticket through the token, in structured content only', async () => {
    const seen: Request[] = [];
    const env = envAnswering((request) => {
      seen.push(request);
      return Response.json({ ticket: 'rt2~sealed-ticket', expiresAt: Date.now() + 600_000 });
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await viewLive(env, 'lwt_token', { documentId: 'd 1' });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(new URL(seen[0]!.url).pathname).toBe('/api/documents/d%201/room-ticket');
    expect(new URL(seen[0]!.url).search).toBe('?cap=view');
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer lwt_token');
    expect(result.structuredContent).toMatchObject({
      documentId: 'd 1',
      url: 'wss://www.livediagram.app/api/documents/d%201/ws',
      ticket: 'rt2~sealed-ticket',
    });
    expect(JSON.stringify(result.content)).not.toContain('sealed-ticket');
    expect(JSON.stringify(info.mock.calls)).not.toContain('sealed-ticket');
    info.mockRestore();
  });

  // "Edits in the view": offered at edit only, by the level the mint answers; a read-only token's is view.
  it('says the view may edit only at the edit level', async () => {
    const at = (level?: string) =>
      viewLive(
        envAnswering(() =>
          Response.json({ ticket: 'rt2~t', expiresAt: Date.now() + 600_000, level }),
        ),
        'lwt_token',
        { documentId: 'd1' },
      ).then((r) => (r.structuredContent as { canEdit: boolean }).canEdit);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    expect(await at('edit')).toBe(true);
    for (const level of ['participate', 'view', undefined]) expect(await at(level)).toBe(false);
    info.mockRestore();
  });

  it('passes on the api refusing the owner, as for a revoked grant', async () => {
    const env = envAnswering(() => Response.json({ error: 'not_found' }, { status: 404 }));
    await expect(viewLive(env, 'lwt_token', { documentId: 'gone' })).rejects.toThrow();
  });

  it('answers an error, and no ticket, when the api says no lapse', async () => {
    const env = envAnswering(() => Response.json({ ticket: 'G.bare' }));
    const result = await viewLive(env, 'lwt_token', { documentId: 'd1' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('G.bare');
  });

  it('opens the room on the deployment’s own editor host', () => {
    expect(roomSocketUrl({ CONSENT_BASE_URL: 'https://staging.livediagram.app' }, 'd1')).toBe(
      'wss://staging.livediagram.app/api/documents/d1/ws',
    );
  });
});

// The view's cost on the Worker (the spec's "Cost"): it builds the SVG and skips resvg, measured on the densest
// template. Kept as a budget so a slower SVG build shows here.
describe('the view’s cost', () => {
  const require = createRequire(import.meta.url);
  const renderer = createPngRenderer({
    wasm: () => readFile(require.resolve('@resvg/resvg-wasm/index_bg.wasm')),
    font: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Regular.ttf')),
    bold: () => readFile(require.resolve('@liveworkspace/render-png/fonts/Inter-Bold.otf')),
  });

  it('builds a dense tab’s SVG in a fraction of the PNG’s CPU', async () => {
    const tab = buildTemplateTab('t1', 'Blueprint', 'service-blueprint');
    renderElementsToSvg(tab);
    let svg = '';
    const svgMs = cpuMsOf(() => {
      svg = renderElementsToSvg(tab);
    });
    await renderer.renderPng(svg, 1, 2048);
    const pngMs = await cpuMsOfAsync(() => renderer.renderPng(svg, 1, 2048));
    console.info('[view cost]', {
      elements: tab.elements.length,
      svgBytes: svg.length,
      svgMs: Math.round(svgMs),
      pngMs: Math.round(pngMs),
    });
    expect(svgMs).toBeLessThan(cpuBudgetMs(250));
    expect(svg.length).toBeLessThan(1024 * 1024);
  });
});

// docs/specs/015-api/mcp-server.md "Edits in the view": view_edit writes one changeset through the api on the user's
// token, the path update_document takes, so the api decides; what the view may not do is refused before any write.
// The text the model reads when the host passes it on: the picture it holds is stale (docs/specs/015-api/mcp-server.md
// "Edits in the view").
const STALE =
  ' The diagram changed: call read_diagram before describing or editing it again, because any picture of it you hold is out of date.';

describe('view_edit', () => {
  const box = { x: 0, y: 0, width: 40, height: 20 };
  const TAB = {
    id: 't1',
    name: 'Main',
    rev: 7,
    elements: [
      { id: 'a', type: 'shape', shape: 'rectangle', label: 'Pay', ...box },
      { id: 'b', type: 'shape', shape: 'rectangle', locked: true, ...box, x: 100 },
      { id: 'c', type: 'image', ...box, x: 200 },
    ],
  };
  // The api as the MCP reaches it: the document, the tab, and a changeset route answering `changeset`.
  function api(changeset: (request: Request) => Response) {
    const seen: Request[] = [];
    const env = {
      API: {
        fetch: async (request: Request) => {
          seen.push(request);
          const path = new URL(request.url).pathname;
          if (path.endsWith('/changesets')) return changeset(request);
          if (path.endsWith('/tabs/t1')) return Response.json({ tab: TAB });
          return Response.json({ document: { id: 'd1', tabs: [{ id: 't1', name: 'Main' }] } });
        },
      },
      CONSENT_BASE_URL: 'https://www.livediagram.app',
    } as unknown as Env;
    return { env, seen };
  }
  const written = () => Response.json({ changeset: { id: 'cs1' }, text: '', results: [] });
  const quiet = () => vi.spyOn(console, 'info').mockImplementation(() => {});

  it('renames with set label and moves with move by, based on each element as stored', () => {
    const body = viewEditChangeset(TAB as unknown as Tab & { rev: number }, [
      { elementId: 'a', label: 'Charge', dx: 10.4, dy: -3.6 },
    ]);
    expect(body).toMatchObject({
      operations: [
        { op: 'set', target: 'id:"a"', fields: { label: 'Charge' } },
        { op: 'move', target: 'id:"a"', by: [10, -4] },
      ],
      base: { rev: 7 },
      summary: 'Edited in the interactive view',
    });
    expect(Object.keys((body as { base: { elements: object } }).base.elements)).toEqual(['a']);
  });

  it('refuses, before anything is sent, what the view may not do', () => {
    const tab = TAB as unknown as Tab & { rev: number };
    expect(viewEditChangeset(tab, [{ elementId: 'gone', label: 'x' }])).toMatch(/not on this tab/);
    expect(viewEditChangeset(tab, [{ elementId: 'a', dx: 0.2 }])).toMatch(/a new label, a move/);
    expect(viewEditChangeset(tab, [{ elementId: 'b', dx: 5 }])).toMatch(/can't be moved/);
    expect(viewEditChangeset(tab, [{ elementId: 'c', label: 'x' }])).toMatch(/can't be renamed/);
    expect(viewEditChangeset(tab, [{ elementId: 'c', dy: 5 }])).toMatchObject({
      operations: [{ op: 'move', by: [0, 5] }],
    });
  });

  it('posts one changeset as the MCP and answers the tab drawn again', async () => {
    const info = quiet();
    const { env, seen } = api(written);
    const result = await viewEdit(env, 'lwt_token', {
      documentId: 'd1',
      tabId: 't1',
      edits: [{ elementId: 'a', label: 'Charge' }],
    });
    const posts = seen.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(new URL(posts[0]!.url).pathname).toBe('/api/documents/d1/tabs/t1/changesets');
    expect(posts[0]!.headers.get('Authorization')).toBe('Bearer lwt_token');
    expect(posts[0]!.headers.get('X-Livediagram-Client')).toBe('mcp');
    // The document and the tab before, and the tab once more after: no second read of the document.
    expect(seen.filter((r) => r.method === 'GET')).toHaveLength(3);
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: 'Saved 1 edit from the interactive view.' + STALE },
    ]);
    expect(result.structuredContent).toMatchObject({
      documentId: 'd1',
      tabId: 't1',
      changesetId: 'cs1',
      elements: [{ id: 'a', canRename: true, canMove: true }, { id: 'b' }, { id: 'c' }],
    });
    expect(typeof (result.structuredContent as { svg: string }).svg).toBe('string');
    info.mockRestore();
  });

  it('counts its edits, and says no changeset when nothing changed', async () => {
    const info = quiet();
    const { env } = api(() => Response.json({ changeset: null, text: '', results: [] }));
    const result = await viewEdit(env, 'lwt_token', {
      documentId: 'd1',
      tabId: 't1',
      edits: [
        { elementId: 'a', label: 'Pay' },
        { elementId: 'c', dx: 1 },
      ],
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Saved 2 edits from the interactive view.' + STALE },
    ]);
    expect(result.structuredContent).toMatchObject({ changesetId: null });
    info.mockRestore();
  });

  // The role test: a view-only (read-only) token's edit, however the frame was made to send it, is refused by the
  // api's choke point, and the view gets the refusal, never a write.
  it('passes on the api refusing a read-only token, writing nothing', async () => {
    const { env, seen } = api(() => Response.json({ error: 'read_only_token' }, { status: 403 }));
    const result = await viewEdit(env, 'lwt_readonly', {
      documentId: 'd1',
      tabId: 't1',
      edits: [{ elementId: 'a', label: 'Forged', dx: 40 }],
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain('read_only_token');
    // No redraw after the refusal: the view draws the tab again itself.
    expect(seen.filter((r) => r.method === 'GET')).toHaveLength(2);
  });

  it('refuses before writing anything the view may not do, and a document with no tabs', async () => {
    const { env, seen } = api(written);
    const locked = await viewEdit(env, 'lwt_token', {
      documentId: 'd1',
      tabId: 't1',
      edits: [{ elementId: 'b', dx: 10 }],
    });
    expect(locked.isError).toBe(true);
    expect(seen.some((r) => r.method === 'POST')).toBe(false);
    const empty = {
      API: { fetch: async () => Response.json({ document: { id: 'd1', tabs: [] } }) },
    } as unknown as Env;
    const none = await viewEdit(empty, 'lwt_token', {
      documentId: 'd1',
      tabId: undefined as unknown as string,
      edits: [{ elementId: 'a', label: 'x' }],
    });
    expect(none.isError).toBe(true);
    expect((await viewTab(empty, 'lwt_token', { documentId: 'd1' })).isError).toBe(true);
  });

  it('throws an api fault, as the other tools do', async () => {
    const { env } = api(() => new Response('down', { status: 503 }));
    await expect(
      viewEdit(env, 'lwt_token', {
        documentId: 'd1',
        tabId: 't1',
        edits: [{ elementId: 'a', label: 'x' }],
      }),
    ).rejects.toThrow();
  });
});
