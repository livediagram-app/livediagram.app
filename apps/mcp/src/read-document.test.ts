import { afterEach, describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts).
vi.mock('./image-result', () => ({
  tabPreview: async (tab: { id: string }) => ({
    type: 'image',
    data: `png:${tab.id}`,
    mimeType: 'image/png',
  }),
}));

import type { Env } from './env';
import { readDocument, revFromEtag } from './read-document';

// read_document reads a view (docs/specs/015-api/mcp-server.md §4.2; docs/specs/024-agents/
// document-views.md, R24): the outline by default, fitted to 8,000 tokens, its text first.

const LIVE_DOC = {
  id: 'd1',
  name: 'Roadmap',
  tabs: [
    { id: 't1', name: 'Plan' },
    { id: 't2', name: 'Risks' },
  ],
};
const TAB = { id: 't1', name: 'Plan', rev: 41, elements: [{ id: 'a', type: 'text' }] };
const OUTLINE = 'tab t1 "Plan" · 1 element: 1 box · rev 41\ntext a';

type Answer = Response | (() => Response);

function api(answers: { view?: Answer; doc?: unknown } = {}) {
  const requests: URL[] = [];
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        requests.push(url);
        if (url.searchParams.has('view')) {
          const view = answers.view ?? new Response(OUTLINE, { headers: { ETag: 'W/"41"' } });
          return typeof view === 'function' ? view() : view;
        }
        if (/\/tabs\/[^/]+$/.test(url.pathname)) return Response.json({ tab: TAB });
        return Response.json({ document: answers.doc ?? LIVE_DOC });
      },
    },
  } as unknown as Env;
  return { env, requests };
}

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'info').mockImplementation(() => {});

describe('readDocument', () => {
  it("reads the first tab's outline through the MCP door at the default budget (VW45, VW57)", async () => {
    quiet();
    const { env, requests } = api();
    const result = await readDocument(env, 'tok', { documentId: 'd1' });
    const view = requests.find((r) => r.searchParams.has('view'))!;
    expect(view.pathname).toBe('/api/documents/d1/tabs/t1');
    expect(Object.fromEntries(view.searchParams)).toEqual({
      view: 'outline',
      door: 'mcp',
      budget: '8000',
    });
    expect(result.content).toEqual([
      {
        type: 'text',
        text: `${OUTLINE}\n{"id":"d1","name":"Roadmap","tab":{"id":"t1","name":"Plan","rev":41},"tabs":[{"id":"t1","name":"Plan"},{"id":"t2","name":"Risks"}],"url":"https://livediagram.app/document/d1"}`,
      },
    ]);
    expect(result.structuredContent).toEqual({
      id: 'd1',
      name: 'Roadmap',
      tab: { id: 't1', name: 'Plan', rev: 41, view: 'outline', text: OUTLINE },
      tabs: LIVE_DOC.tabs,
      url: 'https://livediagram.app/document/d1',
    });
    expect(
      requests.some((r) => /\/tabs\/t1$/.test(r.pathname) && !r.searchParams.has('view')),
    ).toBe(false);
  });

  it('passes the view and its arguments through', async () => {
    quiet();
    const { env, requests } = api();
    await readDocument(env, 'tok', {
      documentId: 'd1',
      tabId: 't2',
      view: 'layout',
      budget: 500,
      only: 'c991',
      ref: 'x',
      q: 'pay',
      coarse: true,
      all: false,
      style: true,
    });
    const view = requests.find((r) => r.searchParams.has('view'))!;
    expect(view.pathname).toBe('/api/documents/d1/tabs/t2');
    expect(Object.fromEntries(view.searchParams)).toEqual({
      view: 'layout',
      door: 'mcp',
      budget: '500',
      only: 'c991',
      ref: 'x',
      q: 'pay',
      coarse: '1',
      style: '1',
    });
  });

  it('attaches a PNG only on request, from the plain tab read in parallel (VW48)', async () => {
    quiet();
    const { env } = api();
    const result = await readDocument(env, 'tok', { documentId: 'd1', image: true });
    expect(result.content.at(-1)).toEqual({ type: 'image', data: 'png:t1', mimeType: 'image/png' });
  });

  it('returns the elements with format json, with or without the PNG', async () => {
    quiet();
    const { env, requests } = api();
    const result = await readDocument(env, 'tok', { documentId: 'd1', format: 'json' });
    expect(result.structuredContent).toEqual({
      id: 'd1',
      name: 'Roadmap',
      tab: { id: 't1', name: 'Plan', rev: 41, elements: TAB.elements },
      tabs: LIVE_DOC.tabs,
      url: 'https://livediagram.app/document/d1',
    });
    expect(requests.some((r) => r.searchParams.has('view'))).toBe(false);
    const withImage = await readDocument(env, 'tok', {
      documentId: 'd1',
      format: 'json',
      image: true,
    });
    expect(withImage.content.map((c) => c.type)).toEqual(['text', 'image']);
  });

  it('refuses an unknown tab, naming the tabs there are, and a document without tabs', async () => {
    quiet();
    const { env } = api();
    const named = await readDocument(env, 'tok', { documentId: 'd1', tabId: 'elsewhere' });
    expect(named).toEqual({
      content: [
        { type: 'text', text: 'No tab "elsewhere" in this document. Tabs: Plan (t1), Risks (t2).' },
      ],
      isError: true,
    });
    const empty = api({ doc: { ...LIVE_DOC, tabs: [] } });
    expect(await readDocument(empty.env, 'tok', { documentId: 'd1' })).toEqual({
      content: [{ type: 'text', text: 'That document has no tabs.' }],
      isError: true,
    });
  });
});

describe('readDocument refusals', () => {
  const refusal = (status: number, body: unknown) => () => Response.json(body, { status });

  it('turns a ref refusal into a correctable result naming the candidates', async () => {
    quiet();
    const { env } = api({
      view: refusal(400, {
        error: 'target_ambiguous',
        message: '"e4" matches 2 elements now',
        input: 'e4',
        candidates: [
          { ref: 'e4a8', kind: 'square', label: 'Payments' },
          { ref: 'e4f1', kind: 'text', label: null },
        ],
        stale: false,
      }),
    });
    expect(await readDocument(env, 'tok', { documentId: 'd1', view: 'show', ref: 'e4' })).toEqual({
      content: [
        {
          type: 'text',
          text: '"e4" matches 2 elements now. Candidates: square e4a8 "Payments"; text e4f1',
        },
      ],
      isError: true,
    });
    const gone = api({
      view: refusal(404, {
        error: 'target_not_found',
        message: 'no element "zz"',
        input: 'zz',
        candidates: [],
        stale: false,
      }),
    });
    expect(
      (await readDocument(gone.env, 'tok', { documentId: 'd1', view: 'show', ref: 'zz' })).content,
    ).toEqual([{ type: 'text', text: 'no element "zz"' }]);
  });

  it("passes a refused parameter's message on", async () => {
    quiet();
    const { env } = api({
      view: refusal(400, {
        error: 'invalid_value',
        message: 'only takes an element, not an arrow',
      }),
    });
    expect(await readDocument(env, 'tok', { documentId: 'd1', only: 'arr' })).toMatchObject({
      isError: true,
      content: [{ text: 'only takes an element, not an arrow' }],
    });
  });

  it('throws what the model cannot correct', async () => {
    quiet();
    const plain = (status: number, text: string) => () => new Response(text, { status });
    await expect(
      readDocument(api({ view: plain(404, 'not json') }).env, 'tok', { documentId: 'd1' }),
    ).rejects.toThrow('api 404');
    await expect(
      readDocument(api({ view: refusal(404, { error: 'not_found' }) }).env, 'tok', {
        documentId: 'd1',
      }),
    ).rejects.toThrow('api 404');
    await expect(
      readDocument(api({ view: refusal(400, null) }).env, 'tok', { documentId: 'd1' }),
    ).rejects.toThrow('api 400');
    await expect(
      readDocument(api({ view: plain(403, 'no') }).env, 'tok', { documentId: 'd1' }),
    ).rejects.toThrow('api 403');
    await expect(
      readDocument(api({ view: plain(200, OUTLINE) }).env, 'tok', { documentId: 'd1' }),
    ).rejects.toThrow('without its tab revision');
  });
});

describe('revFromEtag', () => {
  it('reads the weak ETag the tab read carries', () => {
    expect(revFromEtag('W/"41"')).toBe(41);
    expect(revFromEtag('"41"')).toBeNull();
    expect(revFromEtag(null)).toBeNull();
  });
});
