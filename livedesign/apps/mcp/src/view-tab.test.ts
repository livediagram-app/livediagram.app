import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { VIEW_MIME_TYPE } from '@liveworkspace/mcp-kit/app-view';
import { VIEW_IMAGE_MAX_BYTES } from '@liveworkspace/mcp-kit/preview-budget';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { laidOutPagesOf, renderPagesToSvg, type Element, type Tab } from '@livedesign/design';
import { buildTemplateTabs } from '@livedesign/templates';

// The rasteriser is WASM and never runs for the view: a call to it here is the view drawing a PNG.
const rastered: string[] = [];
vi.mock('@liveworkspace/mcp-kit/render', () => ({
  svgToPngBase64: async (svg: string) => {
    rastered.push(svg);
    return 'cG5n';
  },
}));

// Each picture's bytes: a small PNG header, so it fits the view's budget, or past the view's per-picture cap for a
// "big" one (a full-size photo).
const fetched: string[] = [];
vi.mock('./api', async (actual) => ({
  ...(await actual<typeof import('./api')>()),
  apiFetch: async (_env: unknown, _token: string, path: string) => {
    fetched.push(path);
    const b = new Uint8Array(path.includes('big') ? VIEW_IMAGE_MAX_BYTES + 1 : 24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, 64);
    new DataView(b.buffer).setUint32(20, 64);
    return new Response(b, { headers: { 'Content-Type': 'image/png' } });
  },
}));

const { registerTools } = await import('./tools');
const { pageView, registerViewPage, VIEW_URI, viewTab } = await import('./view-tab');
const { tabPreview, tabSvg } = await import('./image-result');

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

// A wireframe flow of `copies` times the template's screens, every page holding its content and a picture.
function deck(copies: number): Tab {
  let n = 0;
  const base = buildTemplateTabs(
    { id: 't1', name: 'Flow' },
    'wireframe-mobile-app',
    () => `x${n++}`,
  )[0]!;
  const basePages = laidOutPagesOf(base);
  const pages = Array.from({ length: copies }, (_, k) =>
    basePages.map(({ index: _i, rect: _r, ...p }) => ({ ...p, id: `${p.id}~${k}` })),
  ).flat();
  const laid = laidOutPagesOf({ ...base, pages });
  const elements: Element[] = [];
  basePages.forEach((orig, j) => {
    const own = base.elements.filter((el) => {
      const { x, y } = el as { x?: number; y?: number };
      return (
        typeof x === 'number' &&
        typeof y === 'number' &&
        x >= orig.rect.x &&
        y >= orig.rect.y &&
        x < orig.rect.x + orig.rect.width &&
        y < orig.rect.y + orig.rect.height
      );
    });
    for (let k = 0; k < copies; k++) {
      const at = laid[k * basePages.length + j]!.rect;
      const dx = at.x - orig.rect.x;
      const dy = at.y - orig.rect.y;
      for (const el of own) {
        const { x, y } = el as unknown as { x: number; y: number };
        elements.push({ ...el, id: `${el.id}~${k}`, x: x + dx, y: y + dy } as Element);
      }
      elements.push({
        id: `pic-${j}-${k}`,
        type: 'image',
        imageId: `img-${j}-${k}`,
        x: at.x + 10,
        y: at.y + 10,
        width: 40,
        height: 40,
      } as unknown as Element);
    }
  });
  return { ...base, pages, elements };
}

describe('the interactive view', () => {
  it('links the tools that draw or read a tab, and only those', () => {
    const linked = registrations()
      .filter((r) => (r.config._meta?.ui as { resourceUri?: string })?.resourceUri === VIEW_URI)
      .map((r) => r.name)
      .sort();
    expect(linked).toEqual([
      'add_tab',
      'change_pages',
      'create_design',
      'read_design',
      'update_design',
    ]);
  });

  it('keeps view_tab from the model in a host with MCP Apps', () => {
    const view = registrations().find((r) => r.name === 'view_tab')!;
    expect(view.config._meta).toEqual({ ui: { visibility: ['app'] } });
  });

  it('lists the page under its ui:// address, with a CSP that opens no connection', async () => {
    const seen: {
      uri: string;
      meta: { ui: { csp: unknown } };
      read: (u: URL) => Promise<unknown>;
    }[] = [];
    const server = {
      registerResource: (
        _n: string,
        uri: string,
        m: { _meta: { ui: { csp: unknown } } },
        read: (u: URL) => Promise<unknown>,
      ) => void seen.push({ uri, meta: m._meta, read }),
    } as unknown as McpServer;
    registerViewPage(server);
    expect(seen.map((r) => r.uri)).toEqual([VIEW_URI]);
    expect(seen[0]!.meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
    const { contents } = (await seen[0]!.read(new URL(VIEW_URI))) as {
      contents: { mimeType: string; text: string }[];
    };
    expect(contents[0]!.mimeType).toBe(VIEW_MIME_TYPE);
    // The page viewer, keyed by the design's id, with its pager and no live room to follow.
    expect(contents[0]!.text).toContain('id="pager"');
    expect(contents[0]!.text).toContain('"designId"');
    expect(contents[0]!.text).toMatch(/LIVE_ON = false/);
  });
});

describe('view_tab', () => {
  const tab = {
    id: 't1',
    name: 'Board',
    elements: [
      { id: 'small', type: 'image', imageId: 'img-small', x: 0, y: 0, width: 40, height: 40 },
      { id: 'photo', type: 'image', imageId: 'img-big', x: 60, y: 0, width: 40, height: 40 },
    ],
  };
  const env = {
    API: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        const body = path.includes('/tabs/')
          ? { tab }
          : { design: { id: 'd1', name: 'D', tabs: [{ id: 't1', name: 'Board' }] } };
        return Response.json(body);
      },
    },
  } as unknown as Env;

  it('draws a tab’s first page, leaving out a full-size picture, in one line of text', async () => {
    fetched.length = 0;
    const result = await viewTab(env, 'lwt_x', { designId: 'd1' });
    expect(result.content).toEqual([
      { type: 'text', text: 'Drew tab "Board" for the interactive view.' },
    ]);
    const value = result.structuredContent as { svg: string; pageId: unknown; pages: unknown[] };
    expect(value).toMatchObject({
      designId: 'd1',
      tabId: 't1',
      pageId: 'page-1',
      pages: [{ id: 'page-1', name: 'Page 1' }],
    });
    expect(value.svg.match(/data:image\/png;base64/g)).toHaveLength(1);
    expect(fetched.sort()).toEqual(['/images/img-big', '/images/img-small']);
  });
});

describe('view_tab without tabs', () => {
  it('refuses a design without tabs', async () => {
    const env = {
      API: { fetch: async () => Response.json({ design: { id: 'd1', name: 'D', tabs: [] } }) },
    } as unknown as Env;
    const result = await viewTab(env, 'lwt_x', { designId: 'd1' });
    expect(result).toMatchObject({ isError: true });
  });
});

describe('pageView', () => {
  const tab = deck(2);
  const laid = laidOutPagesOf(tab);

  it('offers the page asked for, every page for the pager, and only the elements on it', () => {
    const page = laid[3]!;
    const view = pageView(tab, page.id);
    expect(view.page?.id).toBe(page.id);
    expect(view.pages.map((p) => p.id)).toEqual(laid.map((p) => p.id));
    expect(view.elements.length).toBeGreaterThan(1);
    for (const el of view.elements) {
      expect(el.x < page.rect.x + page.rect.width && el.x + el.width > page.rect.x).toBe(true);
    }
    // Only the shown page's pictures are embedded.
    const pictures = view.pictures.elements.filter((el) => el.type === 'image').map((el) => el.id);
    expect(pictures).toHaveLength(1);
  });

  it('falls back to the first page for a page since removed', () => {
    expect(pageView(tab, 'gone').page?.id).toBe(laid[0]!.id);
    expect(pageView(tab).page?.id).toBe(laid[0]!.id);
  });
});

// The spec's cost test: one page of a 40-page wireframe flow draws within its CPU budget and stays small, fetching only that
// page's picture and never rasterising.
describe('the view’s cost', () => {
  it('draws one page of a 40-page wireframe flow within its CPU budget, under 1 MB', async () => {
    const copies = Math.ceil(40 / laidOutPagesOf(deck(1)).length);
    const tab = deck(copies);
    const laid = laidOutPagesOf(tab);
    expect(laid.length).toBeGreaterThanOrEqual(40);
    const auth = { env: {} as Env, token: 'lwt_x' };
    const draw = () => {
      const { page, pictures } = pageView(tab, laid[20]!.id);
      return tabSvg(tab, auth, page, { pictures });
    };
    await draw();
    fetched.length = 0;
    rastered.length = 0;
    let svg = '';
    const ms = await cpuMsOfAsync(async () => {
      ({ svg } = await draw());
    });
    const whole = renderPagesToSvg(tab)!;
    console.info('[view cost]', {
      pages: laid.length,
      pageBytes: svg.length,
      wholeBytes: whole.length,
      ms: Math.round(ms),
    });
    expect(ms).toBeLessThan(cpuBudgetMs(250));
    expect(svg.length).toBeLessThan(1024 * 1024);
    expect(svg.length).toBeLessThan(whole.length / 10);
    expect(fetched).toHaveLength(1);
    expect(rastered).toEqual([]);
  });

  it('still answers the PNG preview for the tools that link the view', async () => {
    const blocks = await tabPreview(deck(1));
    expect(blocks).toMatchObject([{ type: 'image', data: 'cG5n', mimeType: 'image/png' }]);
  });
});
