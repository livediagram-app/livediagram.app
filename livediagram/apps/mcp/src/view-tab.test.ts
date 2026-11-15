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
import { clickableElements, registerViewPage, roomSocketUrl, VIEW_URI, viewLive } from './view-tab';

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

  it('keeps view_tab and view_live from the model in a host with MCP Apps', () => {
    for (const name of ['view_tab', 'view_live']) {
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
    expect(clickableElements(tab)).toEqual([
      { id: 'pay', ref: 'pay', label: 'Pay', x: 0, y: 0, width: 10, height: 10 },
      { id: 'ship', ref: 'ship', label: null, x: 20, y: 0, width: 10, height: 10 },
    ]);
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
