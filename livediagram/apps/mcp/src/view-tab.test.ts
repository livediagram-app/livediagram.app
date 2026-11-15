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
import { clickableElements, registerViewPage, VIEW_URI, viewBoxOf } from './view-tab';

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

  it('keeps view_tab from the model in a host with MCP Apps', () => {
    const view = registrations().find((r) => r.name === 'view_tab')!;
    expect(view.config._meta).toEqual({ ui: { visibility: ['app'] } });
  });

  it('lists the page under its ui:// address', () => {
    const uris: string[] = [];
    registerViewPage({
      registerResource: (_n: string, uri: string) => void uris.push(uri),
    } as unknown as McpServer);
    expect(uris).toEqual([VIEW_URI]);
  });

  it('reads the SVG’s view box, and an unreadable one as empty', () => {
    expect(viewBoxOf('<svg width="1" viewBox="-12.5 -8 300 200.25">')).toEqual({
      x: -12.5,
      y: -8,
      width: 300,
      height: 200.25,
    });
    expect(viewBoxOf('<svg>')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewBoxOf('<svg viewBox="a b c d">')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewBoxOf('<svg viewBox="1 2')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
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
