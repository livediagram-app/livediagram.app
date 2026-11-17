import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { parseStoredPresentation } from '@livediagram/document';
import { buildTemplateTab, TEMPLATE_SLIDES } from '@livediagram/templates';

// The renderer cannot load here; the stub hands back the structured result.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// A presented template seeds the deck (docs/specs/015-api/mcp-server.md §4.3 and §4.3a,
// docs/specs/012-collaboration/presentation-mode.md "Decks a template seeds"): create_document sends it with the
// create, add_tab appends the new tab's slides after the deck's own.

const ROADMAP_SLIDES = TEMPLATE_SLIDES.roadmap!.map((s) => s.name);

function harness(opts: { deck?: string | null; refuseDeck?: boolean } = {}) {
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const handlers: Record<string, (args: unknown, extra: unknown) => Promise<unknown>> = {};
  const server = {
    registerTool: (name: string, _config: unknown, h: (typeof handlers)[string]) => {
      handlers[name] = h;
    },
  } as unknown as McpServer;
  // The tab add_tab's changeset built, as the api stores it.
  const stored = { ...buildTemplateTab('t', 'Roadmap', 'roadmap', 'brand'), rev: 1 };
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api/, '');
        if (path === '/events') return new Response(null, { status: 204 });
        if (url.searchParams.get('view') === 'lint') return new Response('down', { status: 503 });
        if (request.method === 'POST' || request.method === 'PUT') {
          if (opts.refuseDeck && request.method === 'PUT')
            return new Response('down', { status: 503 });
          writes.push({
            method: request.method,
            path,
            body: await request.json<Record<string, unknown>>(),
          });
        }
        if (request.method === 'POST' && path === '/documents') return Response.json({});
        if (path.endsWith('/changesets'))
          return Response.json({ changeset: { id: 'c1' }, text: 'ok' });
        if (/\/documents\/[^/]+$/.test(path))
          return Response.json({
            document: { id: 'd', tabs: [{ id: 't', name: 'T' }], presentation: opts.deck ?? null },
          });
        if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: stored });
        return new Response('nope', { status: 503 });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const call = (name: string, args: unknown) =>
    handlers[name]!(args, { authInfo: { token: 'tok' } }) as Promise<{
      isError?: boolean;
      structuredContent?: { notes?: string[] };
    }>;
  return { call, writes };
}

const slideNames = (presentation: unknown) =>
  parseStoredPresentation(presentation)?.decks[0]?.slides.map((s) => s.name);

describe('create_document from a presented template', () => {
  it('seeds the deck with its slides, in talk order', async () => {
    const { call, writes } = harness();
    const result = await call('create_document', { name: 'Plan', tabs: [{ template: 'roadmap' }] });
    expect(result.isError).toBeFalsy();
    const create = writes.find((w) => w.path === '/documents')!;
    expect(slideNames(create.body.presentation)).toEqual(ROADMAP_SLIDES);
    const [tab] = create.body.tabs as { id: string }[];
    const deck = parseStoredPresentation(create.body.presentation)!.decks[0]!;
    expect(deck.slides.every((s) => s.tabId === tab!.id)).toBe(true);
    expect(result.structuredContent?.notes).toEqual([expect.stringContaining('5 slides added')]);
  });

  it('runs two presented tabs one after the other, and sends no deck for the others', async () => {
    const two = harness();
    await two.call('create_document', {
      name: 'Plan',
      tabs: [{ template: 'roadmap' }, { template: 'swot' }, { template: 'pyramid' }],
    });
    const names = slideNames(two.writes[0]!.body.presentation)!;
    expect(names).toHaveLength(ROADMAP_SLIDES.length + TEMPLATE_SLIDES.pyramid!.length);
    const none = harness();
    await none.call('create_document', { name: 'Plan', tabs: [{ template: 'swot' }] });
    expect(none.writes[0]!.body).not.toHaveProperty('presentation');
  });
});

describe('add_tab from a presented template', () => {
  it("appends its slides after the deck's own", async () => {
    const deck = JSON.stringify({
      decks: [{ slides: [{ id: 'mine', tabId: 'x', elementIds: ['e'] }] }],
    });
    const { call, writes } = harness({ deck });
    const result = await call('add_tab', { documentId: 'd', template: 'roadmap' });
    expect(result.isError).toBeFalsy();
    const put = writes.find((w) => w.method === 'PUT')!;
    expect(put.path).toBe('/documents/d');
    const slides = parseStoredPresentation(put.body.presentation)!.decks[0]!.slides;
    expect(slides[0]!.id).toBe('mine');
    expect(slides.slice(1).map((s) => s.name)).toEqual(ROADMAP_SLIDES);
    expect(result.structuredContent?.notes).toEqual([expect.stringContaining('added to the deck')]);
  });

  it('leaves the deck alone for a template that is not presented', async () => {
    const { call, writes } = harness();
    const result = await call('add_tab', { documentId: 'd', template: 'swot' });
    expect(result.isError).toBeFalsy();
    expect(writes.some((w) => w.method === 'PUT')).toBe(false);
    expect(result.structuredContent?.notes).toBeUndefined();
  });

  it('still makes the tab when the deck cannot be written, and says so', async () => {
    const { call } = harness({ refuseDeck: true });
    const result = await call('add_tab', { documentId: 'd', template: 'roadmap' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.notes).toEqual([
      expect.stringContaining('could not be added to the deck'),
    ]);
  });
});
