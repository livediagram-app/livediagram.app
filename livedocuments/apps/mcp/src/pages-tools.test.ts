import { describe, expect, it, vi } from 'vitest';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts); the Pages tools never render.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { ARTICLE_MARKDOWN_MAX } from '@livedocuments/document';
import { connectTestClient } from './mcp-test-client';

// The Pages tools end to end through a real SDK client (docs/specs/024-agents/pages-for-agents.md): a
// mistake the caller can fix is a tool error in words, naming the change it stopped at.
const LIVE_DOC = { id: 'd1', name: 'Deck', tabs: [{ id: 't1', name: 'Slides', orderIndex: 0 }] };
const TAB = { id: 't1', name: 'Slides', rev: 3, elements: [] };
// A design saved to the caller's Library (docs/specs/011-theme/page-designs.md "Saved designs").
const SAVED = [
  {
    id: 'saved:lib1',
    title: 'Brand Aurora',
    scope: 'team',
    team: 'Brand',
    design: { id: 'aurora', scale: 1.4, flow: true },
  },
];
const ARTICLE = { flow: 'art-1', title: 'Brief', pages: [1], blocks: 2, words: 3, look: null };

function api(answer: (body: unknown) => Response) {
  const sent: unknown[] = [];
  const handler = async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    if (path.endsWith('/events')) return new Response(null, { status: 204 });
    if (path.endsWith('/pages')) {
      const body = await request.json();
      sent.push(body);
      return answer(body);
    }
    if (path === '/page-designs') return Response.json({ designs: SAVED });
    if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: TAB });
    return Response.json({ document: LIVE_DOC });
  };
  return { handler, sent };
}

const done = (extra: Record<string, unknown> = {}) =>
  Response.json({
    tab: { id: 't1', rev: 4 },
    lines: ['Wrote it.'],
    pages: [],
    articles: [ARTICLE],
    changesetId: null,
    ...extra,
  });

type Result = {
  isError?: boolean;
  content: { text: string }[];
  structuredContent?: Record<string, unknown>;
};

async function call(
  handler: (r: Request) => Promise<Response>,
  name: string,
  args: Record<string, unknown>,
) {
  const client = await connectTestClient(handler);
  return (await client.callTool({ name, arguments: { documentId: 'd1', ...args } })) as Result;
}

describe('the Pages tools', () => {
  it('change pages on the first Pages tab and answer the pages', async () => {
    const { handler, sent } = api(() => done());
    const out = await call(handler, 'change_pages', { changes: [{ op: 'add', kind: 'slide' }] });
    expect(out.isError).toBeFalsy();
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
    expect(out.structuredContent).toMatchObject({ tabId: 't1', rev: 4, lines: ['Wrote it.'] });
  });

  it('send a saved design, named saved:<id>, as the design it holds; a page’s without flow', async () => {
    const { handler, sent } = api(() => done());
    const out = await call(handler, 'change_pages', {
      changes: [
        { op: 'tab_design', design: 'saved:lib1' },
        { op: 'set', page: 1, design: 'saved:lib1' },
      ],
    });
    expect(out.isError).toBeFalsy();
    expect(sent).toEqual([
      {
        pages: [
          { op: 'tab_design', design: { id: 'aurora', scale: 1.4, flow: true } },
          { op: 'set', page: 1, design: { id: 'aurora', scale: 1.4 } },
        ],
      },
    ]);
  });

  it('refuse a saved design the caller can’t see, listing the ones they can', async () => {
    const { handler, sent } = api(() => done());
    const out = await call(handler, 'change_pages', {
      changes: [{ op: 'tab_design', design: 'saved:nope' }],
    });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toContain('Change 1: No saved design "saved:nope"');
    expect(out.content[0]!.text).toContain('saved:lib1 (Brand Aurora)');
    expect(sent).toEqual([]);
  });

  it('list the saved designs with the templates', async () => {
    const { handler } = api(() => done());
    const client = await connectTestClient(handler);
    const out = (await client.callTool({ name: 'list_templates', arguments: {} })) as Result;
    expect(out.structuredContent?.savedDesigns).toEqual([
      { id: 'saved:lib1', title: 'Brand Aurora', whose: 'Brand' },
    ]);
  });

  it('name the change a refusal stopped at, counting from 1', async () => {
    const { handler } = api(() =>
      Response.json({ error: 'page_unknown', message: 'No page "9".', change: 1 }, { status: 400 }),
    );
    const out = await call(handler, 'change_pages', {
      changes: [
        { op: 'add', kind: 'slide' },
        { op: 'delete', page: 9 },
      ],
    });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toBe('Change 2: No page "9".');
  });

  it('write an article, sending only what was given', async () => {
    const { handler, sent } = api(() => done({ article: { ...ARTICLE, created: true } }));
    const out = await call(handler, 'write_article', { markdown: '# Brief', look: 'report' });
    expect(sent).toEqual([{ article: { markdown: '# Brief', look: 'report' } }]);
    expect(out.structuredContent).toMatchObject({ article: { flow: 'art-1', created: true } });
  });

  it('say so when the write cannot be read back, or is refused', async () => {
    const lost = api(() => done());
    expect(
      (await call(lost.handler, 'write_article', { markdown: 'x' })).content[0]!.text,
    ).toContain('could not be read back');
    const refused = api(() =>
      Response.json({ error: 'article_ambiguous', message: 'Name one.' }, { status: 400 }),
    );
    const out = await call(refused.handler, 'write_article', { markdown: 'x' });
    expect(out).toMatchObject({ isError: true, content: [{ text: 'Name one.' }] });
  });

  // The over-long write reaches the request reader, whose refusal says how to write the rest (pages-for-agents.md
  // "write_article"): a schema cap in front of it answered with a bare length error.
  it('pass an over-long write to the api, which says to append the rest', async () => {
    const message = 'The Markdown is too long. Write the rest with mode "append".';
    const { handler, sent } = api(() =>
      Response.json({ error: 'article_too_large', message }, { status: 400 }),
    );
    const out = await call(handler, 'write_article', {
      markdown: 'x'.repeat(ARTICLE_MARKDOWN_MAX + 1),
    });
    expect(sent).toHaveLength(1);
    expect(out).toMatchObject({ isError: true, content: [{ text: message }] });
  });
});

describe('style_document', () => {
  const twoTabs = (refuseSecond = false) => {
    const sent: { path: string; body: unknown }[] = [];
    const handler = async (request: Request): Promise<Response> => {
      const path = new URL(request.url).pathname.replace(/^\/api/, '');
      if (path.endsWith('/events')) return new Response(null, { status: 204 });
      if (path.endsWith('/pages')) {
        const body = await request.json();
        sent.push({ path, body });
        if (refuseSecond && path.includes('/t2/'))
          return Response.json(
            { error: 'unknown_theme', message: '"theme": unknown' },
            { status: 400 },
          );
        return done({ lines: ['Restyled the tab: theme forest.'] });
      }
      if (/\/tabs\/[^/]+$/.test(path)) return Response.json({ tab: TAB });
      return Response.json({
        document: {
          ...LIVE_DOC,
          tabs: [
            { id: 't1', name: 'Slides', orderIndex: 0 },
            { id: 't2', name: 'Notes', orderIndex: 1 },
          ],
        },
      });
    };
    return { handler, sent };
  };

  it('restyles every tab when none is named, each as one tab_style', async () => {
    const { handler, sent } = twoTabs();
    const out = await call(handler, 'style_document', { theme: 'forest' });
    expect(out.isError).toBeFalsy();
    expect(sent.map((s) => s.body)).toEqual([
      { pages: [{ op: 'tab_style', theme: 'forest' }] },
      { pages: [{ op: 'tab_style', theme: 'forest' }] },
    ]);
    expect(sent.map((s) => s.path.split('/')[4])).toEqual(['t1', 't2']);
    expect(out.structuredContent!.lines).toEqual([
      '"Slides": Restyled the tab: theme forest.',
      '"Notes": Restyled the tab: theme forest.',
    ]);
  });

  it('restyles only the tab named, and refuses a call with nothing to set', async () => {
    const { handler, sent } = twoTabs();
    await call(handler, 'style_document', { tabId: 't2', font: 'lora' });
    expect(sent).toHaveLength(1);
    const empty = await call(handler, 'style_document', {});
    expect(empty.isError).toBe(true);
    expect(empty.content[0]!.text).toContain('at least one of style, theme, font and finish');
  });

  it('says which tabs were restyled before a refusal', async () => {
    const { handler } = twoTabs(true);
    const out = await call(handler, 'style_document', { theme: 'forest' });
    expect(out.isError).toBe(true);
    expect(out.content[0]!.text).toContain('("Slides" restyled first)');
  });
});
