import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { VIEW_MIME_TYPE } from '@liveworkspace/mcp-kit/app-view';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { laidOutPagesOf, renderPagesToSvg, type Element, type Tab } from '@livedocuments/document';
import { buildTemplateTabs } from '@livedocuments/templates';

// The rasteriser is WASM and never runs for the view: a call to it here is the view drawing a PNG.
const rastered: string[] = [];
vi.mock('@liveworkspace/mcp-kit/render', () => ({
  svgToPngBase64: async (svg: string) => {
    rastered.push(svg);
    return 'cG5n';
  },
}));

// Each picture's bytes: a small PNG header, so every picture fits the view's budget.
const fetched: string[] = [];
vi.mock('./api', async (actual) => ({
  ...(await actual<typeof import('./api')>()),
  apiFetch: async (_env: unknown, _token: string, path: string) => {
    fetched.push(path);
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, 64);
    new DataView(b.buffer).setUint32(20, 64);
    return new Response(b, { headers: { 'Content-Type': 'image/png' } });
  },
}));

const { registerTools } = await import('./tools');
const { pageView, registerViewPage, VIEW_URI, viewLive, viewTab } = await import('./view-tab');
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

// A slide deck of `copies` times the template's slides, every slide holding its content and a picture.
function deck(copies: number): Tab {
  let n = 0;
  const base = buildTemplateTabs({ id: 't1', name: 'Deck' }, 'slide-deck', () => `x${n++}`)[0]!;
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
      'create_document',
      'read_document',
      'update_document',
      'write_article',
    ]);
  });

  it('keeps view_tab and view_live from the model in a host with MCP Apps', () => {
    for (const name of ['view_tab', 'view_live']) {
      const view = registrations().find((r) => r.name === name)!;
      expect(view.config._meta, name).toEqual({ ui: { visibility: ['app'] } });
    }
  });

  it('lists the page under its ui:// address, with a CSP that opens only the editor host’s room', async () => {
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
    registerViewPage(server, { CONSENT_BASE_URL: 'https://staging.livedocuments.app' });
    expect(seen.map((r) => r.uri)).toEqual([VIEW_URI]);
    expect(seen[0]!.meta.ui.csp).toEqual({
      connectDomains: ['wss://staging.livedocuments.app'],
      resourceDomains: [],
    });
    const { contents } = (await seen[0]!.read(new URL(VIEW_URI))) as {
      contents: { mimeType: string; text: string }[];
    };
    expect(contents[0]!.mimeType).toBe(VIEW_MIME_TYPE);
    // The page viewer, keyed by the document's id, with its pager, following its room live.
    expect(contents[0]!.text).toContain('id="pager"');
    expect(contents[0]!.text).toContain('"documentId"');
    expect(contents[0]!.text).toMatch(/LIVE_ON = true/);
  });
});

describe('view_tab', () => {
  const tab = {
    id: 't1',
    name: 'Board',
    elements: [
      { id: 'small', type: 'image', imageId: 'img-small', x: 0, y: 0, width: 40, height: 40 },
    ],
  };
  const envWith = (tabs: { id: string; name: string }[]) =>
    ({
      API: {
        fetch: async (request: Request) => {
          const path = new URL(request.url).pathname;
          return Response.json(
            path.includes('/tabs/') ? { tab } : { document: { id: 'd1', name: 'D', tabs } },
          );
        },
      },
    }) as unknown as Env;

  it('draws a tab’s first page with its picture, in one line of text', async () => {
    const result = await viewTab(envWith([{ id: 't1', name: 'Board' }]), 'lwt_x', {
      documentId: 'd1',
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Drew tab "Board" for the interactive view.' },
    ]);
    const value = result.structuredContent as { svg: string };
    expect(value).toMatchObject({
      documentId: 'd1',
      tabId: 't1',
      tabs: [{ id: 't1', name: 'Board' }],
    });
    expect(value.svg.match(/data:image\/png;base64/g)).toHaveLength(1);
  });

  it('refuses a document without tabs', async () => {
    const result = await viewTab(envWith([]), 'lwt_x', { documentId: 'd1' });
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

// The spec's cost test: one page of a 40-page deck draws within its CPU budget and stays small, fetching only that
// page's picture and never rasterising.
describe('the view’s cost', () => {
  it('draws one page of a 40-page deck within its CPU budget, under 1 MB', async () => {
    const copies = Math.ceil(40 / laidOutPagesOf(deck(1)).length);
    const tab = deck(copies);
    const laid = laidOutPagesOf(tab);
    expect(laid.length).toBeGreaterThanOrEqual(40);
    const auth = { env: {} as Env, token: 'lwt_x' };
    const draw = () => {
      const { page, pictures, writingSvg } = pageView(tab, laid[20]!.id);
      return tabSvg(tab, auth, page, { pictures, writingSvg });
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

// docs/specs/015-api/mcp-server.md "Live updates": view_live mints a view-only ticket for the token's owner and
// hands it to the view alone: never in the text line or a log.
describe('view_live', () => {
  const envAnswering = (answer: (request: Request) => Response) =>
    ({
      API: { fetch: async (request: Request) => answer(request) },
      CONSENT_BASE_URL: 'https://www.livedocuments.app',
    }) as unknown as Env;

  it('mints a view-only ticket through the token, in structured content only', async () => {
    const seen: Request[] = [];
    const env = envAnswering((request) => {
      seen.push(request);
      return Response.json({
        ticket: 'rt2~sealed-ticket',
        expiresAt: Date.now() + 600_000,
        level: 'edit',
      });
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await viewLive(env, 'lwt_token', { documentId: 'x 1' });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(new URL(seen[0]!.url).pathname).toBe('/api/documents/x%201/room-ticket');
    expect(new URL(seen[0]!.url).search).toBe('?cap=view');
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer lwt_token');
    expect(result.structuredContent).toEqual({
      documentId: 'x 1',
      url: 'wss://www.livedocuments.app/api/documents/x%201/ws',
      ticket: 'rt2~sealed-ticket',
      expiresAt: expect.any(Number),
    });
    // A read-only view: no edit answer, whatever the level.
    expect(result.structuredContent).not.toHaveProperty('canEdit');
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
    const result = await viewLive(env, 'lwt_token', { documentId: 'x1' });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain('G.bare');
  });
});

// docs/specs/015-api/mcp-server.md "One live view": a view that names the step it was opened by hears whether an agent
// changed the tab after it.
describe('view_tab for a view that names its own step', () => {
  const tab = { id: 't1', name: 'Board', rev: 6, elements: [] };
  function api(changesets: unknown[] | null) {
    const seen: string[] = [];
    const env = {
      API: {
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          seen.push(url.pathname + url.search);
          if (url.pathname.endsWith('/changesets'))
            return changesets
              ? Response.json({ changesets })
              : new Response('down', { status: 500 });
          return Response.json(
            url.pathname.includes('/tabs/')
              ? { tab }
              : { document: { id: 'd1', name: 'D', tabs: [{ id: 't1', name: 'Board' }] } },
          );
        },
      },
      CONSENT_BASE_URL: 'https://www.acme.app',
    } as unknown as Env;
    return { env, seen };
  }
  const listed = (seen: string[]) => seen.filter((p) => p.includes('/changesets'));
  const quiet = () => {
    const spies = [
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
    ];
    return () => spies.forEach((s) => s.mockRestore());
  };

  it('asks nothing for a view that sent no revision, and says the revision drawn', async () => {
    const restore = quiet();
    const { env, seen } = api([{ rev: 9, agent: true }]);
    const result = await viewTab(env, 'lwt_x', { documentId: 'd1' });
    expect(listed(seen)).toEqual([]);
    expect(result.structuredContent).toMatchObject({ tabId: 't1', rev: 6 });
    expect(result.structuredContent).not.toHaveProperty('superseded');
    restore();
  });

  it('answers no drawing to a view that holds its own picture once an agent wrote after it', async () => {
    const restore = quiet();
    const { env, seen } = api([{ rev: 6, agent: true }]);
    const result = await viewTab(env, 'lwt_x', { documentId: 'd1', rev: 4, held: true });
    expect(listed(seen)).toHaveLength(1);
    expect(listed(seen)[0]).toMatch(/\/documents\/d1\/changesets\?tab=t1&limit=5$/);
    expect(result.structuredContent).toMatchObject({
      documentId: 'd1',
      tabId: 't1',
      name: 'Board',
      rev: 6,
      svg: '',
      elements: [],
      tabs: [],
      superseded: true,
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Tab "Board" has a later step: the view keeps its own.' },
    ]);
    restore();
  });

  it('draws the tab as it is, marked superseded, for a view with no picture of its own', async () => {
    const restore = quiet();
    const { env } = api([{ rev: 6, agent: true }]);
    const result = await viewTab(env, 'lwt_x', { documentId: 'd1', rev: 4 });
    const value = result.structuredContent as { svg: string };
    expect(value).toMatchObject({ tabId: 't1', rev: 6, superseded: true });
    expect(value.svg).toContain('<svg');
    restore();
  });

  it('lets the view follow when no agent wrote after it, or the list cannot be read', async () => {
    const restore = quiet();
    for (const changesets of [[{ rev: 6, agent: true }], [{ rev: 7, agent: false }], [], null]) {
      const { env } = api(changesets);
      const result = await viewTab(env, 'lwt_x', { documentId: 'd1', rev: 6, held: true });
      const value = result.structuredContent as { svg: string };
      expect(value).not.toHaveProperty('superseded');
      expect(value.svg).toContain('<svg');
    }
    restore();
  });
});
