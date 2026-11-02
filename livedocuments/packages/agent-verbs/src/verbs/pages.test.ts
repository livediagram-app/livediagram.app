import { describe, expect, it } from 'vitest';
import type { PagesAnswer } from '@livedocuments/api-schema';
import { VerbRefusal } from '../define';
import { changePages, pagesTabOf, readArticle, writeArticle } from '../pages/pages-calls';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { articleGet, articleSet, pageLs, pageSet } from './pages';

// The Pages verbs and calls (docs/specs/024-agents/pages-for-agents.md "The front doors",
// "Which tab").
const ONE = 'tab-one-0000';
const TWO = 'tab-two-0000';
const tabPath = (id: string) => `/documents/${DOC_A}/tabs/${id}`;

const ANSWER: PagesAnswer = {
  tab: { id: ONE, rev: 5 },
  lines: ['Added page 2 (slide, Slide (16:9)).'],
  pages: [
    {
      place: 1,
      id: 'page-1',
      name: 'Cover',
      kind: 'slide',
      size: 'slide',
      orientation: null,
      rect: { x: -960, y: -540, width: 1920, height: 1080 },
      background: null,
      locked: false,
      flow: null,
      elements: 3,
    },
  ],
  articles: [
    {
      flow: 'art-1',
      title: 'Brief',
      pages: [2],
      blocks: 2,
      words: 4,
      estimatedPages: 1,
      look: null,
    },
  ],
  article: {
    flow: 'art-1',
    title: 'Brief',
    pages: [2],
    blocks: 2,
    words: 4,
    estimatedPages: 1,
    look: null,
    created: true,
  },
  changesetId: null,
};

const ARTICLE_TAB = {
  id: ONE,
  rev: 4,
  elements: [],
  pages: [{ id: 'a1', orientation: 'portrait', kind: 'article', flow: 'art-1' }],
  articles: {
    'art-1': {
      blocks: [
        { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Brief' }] },
        { id: 'b2', type: 'paragraph', runs: [{ text: 'Hello there' }] },
      ],
    },
  },
};

function setUp(
  tabs: Record<string, unknown> = { [TWO]: { id: TWO, elements: [] }, [ONE]: ARTICLE_TAB },
  answer: (r: Request) => Response | Promise<Response> = () => Response.json(ANSWER),
  input = '',
) {
  const sent: unknown[] = [];
  const routes: Record<string, unknown> = { ...library, ...tabsOfA };
  for (const [id, tab] of Object.entries(tabs)) routes[tabPath(id)] = { tab };
  routes[`${tabPath(ONE)}/pages`] = async (r: Request) => {
    sent.push(await r.clone().json());
    return answer(r);
  };
  routes[`${tabPath(TWO)}/pages`] = routes[`${tabPath(ONE)}/pages`];
  routes[`${tabPath(ONE)}?view=pages&door=cli`] = { text: 'tab one · pages' };
  routes[`${tabPath(ONE)}?view=pages&door=cli&budget=50`] = { text: 'tab one · fitted' };
  const api = fakeApi(routes);
  return { api, sent, ctx: contextOf(api, [], [], { readInput: async () => input }) };
}

describe('which tab', () => {
  it('is the one named, else the first', async () => {
    const { api } = setUp();
    expect(await pagesTabOf(api, DOC_A, TWO)).toMatchObject({ tabId: TWO });
    expect(await pagesTabOf(api, DOC_A, undefined)).toMatchObject({ tabId: ONE });
  });

  it('turns a missing document into the api’s refusal', async () => {
    const { api } = setUp();
    expect(await pagesTabOf(api, 'nope', undefined)).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  it('asks for a tab when the document has none the caller can reach', async () => {
    const api = fakeApi({
      ...library,
      [`/documents/${DOC_A}`]: {
        document: { id: DOC_A, name: 'Auth flow', tabs: [{ id: ONE, outOfScope: true }] },
      },
    });
    expect(await pagesTabOf(api, DOC_A, undefined)).toMatchObject({
      ok: false,
      code: 'tab_needed',
    });
  });
});

describe('the calls', () => {
  it('sends page changes and answers what the api did', async () => {
    const { api, sent } = setUp();
    const done = await changePages(api, DOC_A, { changes: [{ op: 'add', kind: 'slide' }] }, 'mcp');
    expect(done).toMatchObject({ ok: true, documentId: DOC_A, tabId: ONE, tab: { rev: 5 } });
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
  });

  it('passes the api’s refusal through with its change', async () => {
    const { api } = setUp(undefined, () =>
      Response.json({ error: 'page_unknown', message: 'No page "9".', change: 0 }, { status: 400 }),
    );
    expect(
      await changePages(api, DOC_A, { tabId: ONE, changes: [{ op: 'delete', page: 9 }] }, 'mcp'),
    ).toEqual({ ok: false, code: 'page_unknown', message: 'No page "9".', change: 0 });
  });

  it('reads a refusal without a message as the generic words, and lets a 5xx throw', async () => {
    const bare = setUp(undefined, () => new Response('nope', { status: 403 }));
    expect(await writeArticle(bare.api, DOC_A, { tabId: ONE, markdown: 'x' }, 'mcp')).toMatchObject(
      {
        ok: false,
        code: 'http_403',
      },
    );
    const down = setUp(undefined, () => new Response('down', { status: 503 }));
    await expect(
      writeArticle(down.api, DOC_A, { tabId: ONE, markdown: 'x' }, 'mcp'),
    ).rejects.toThrow();
  });

  it('reads an article as Markdown, by id, title or as the only one', async () => {
    const { api } = setUp();
    const only = await readArticle(api, DOC_A, {});
    expect(only).toMatchObject({ ok: true, flow: 'art-1', title: 'Brief' });
    expect((only as { markdown: string }).markdown).toBe('---\ntitle: Brief\n---\n\nHello there\n');
    expect(await readArticle(api, DOC_A, { article: 'brief' })).toMatchObject({ ok: true });
    expect(await readArticle(api, DOC_A, { article: 'Plan' })).toMatchObject({
      ok: false,
      code: 'article_unknown',
    });
  });

  it('asks which article when there are two, and says when there are none', async () => {
    const two = {
      ...ARTICLE_TAB,
      articles: { ...ARTICLE_TAB.articles, 'art-2': { blocks: [] } },
    };
    const { api } = setUp({ [TWO]: { id: TWO, elements: [] }, [ONE]: two });
    expect(await readArticle(api, DOC_A, {})).toMatchObject({ code: 'article_ambiguous' });
    const none = setUp({
      [TWO]: { id: TWO, elements: [] },
      [ONE]: { ...ARTICLE_TAB, articles: {} },
    });
    expect(await readArticle(none.api, DOC_A, {})).toMatchObject({
      message: 'That tab has no article.',
    });
    expect(await readArticle(none.api, 'nope', {})).toMatchObject({ ok: false });
  });

  it('passes on the refusal of a document it cannot find, sending nothing', async () => {
    const { api, sent } = setUp();
    expect(await changePages(api, 'nope', { changes: [] }, 'cli')).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(await writeArticle(api, 'nope', { markdown: 'x' }, 'mcp')).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(sent).toEqual([]);
  });
});

describe('page ls and page set', () => {
  it('refuses a tab it cannot read, as the api refuses it', async () => {
    const { ctx } = setUp({ [ONE]: ARTICLE_TAB });
    await expect(pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A, tab: TWO }))).rejects.toThrow(
      VerbRefusal,
    );
  });

  it('prints the pages view, fitted when asked', async () => {
    const { ctx } = setUp();
    const out = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A }));
    expect(pageLs.text!(out)).toEqual(['tab one · pages']);
    const fitted = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A, budget: 50 }));
    expect(fitted.text).toBe('tab one · fitted');
  });

  it('makes one change from the flags', async () => {
    const cases: [Record<string, unknown>, unknown][] = [
      [
        { add: 'slide', layout: 'slide-title', name: 'Cover' },
        { op: 'add', kind: 'slide', name: 'Cover', layout: 'slide-title' },
      ],
      [
        { page: '2', delete: true },
        { op: 'delete', page: 2 },
      ],
      [
        { page: 'Cover', duplicate: true },
        { op: 'duplicate', page: 'Cover' },
      ],
      [
        { page: '1', backgroundToAll: true },
        { op: 'apply_background_to_all', page: 1 },
      ],
      [
        { page: '2', move: 1 },
        { op: 'move', page: 2, to: 1 },
      ],
      [
        { page: '2', layout: 'quote' },
        { op: 'layout', page: 2, layout: 'quote' },
      ],
      [
        { page: '2', size: 'a3', orientation: 'landscape' },
        { op: 'set', page: 2, size: 'a3', orientation: 'landscape' },
      ],
    ];
    for (const [flags, change] of cases) {
      const { ctx, sent } = setUp();
      const out = await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, ...flags }));
      expect(sent).toEqual([{ pages: [change] }]);
      expect(pageSet.text!(out)).toEqual([
        '~ Added page 2 (slide, Slide (16:9)).',
        '1  slide  slide  -960,-540 1920x1080  Cover',
      ]);
      expect(pageSet.quiet!(out)).toEqual(['page-1']);
    }
  });

  it('adds a page with no layout, and lists an unnamed page without a name', async () => {
    const unnamed = { ...ANSWER, pages: [{ ...ANSWER.pages[0]!, name: null }] };
    const { ctx, sent } = setUp(undefined, () => Response.json(unnamed));
    const out = await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, add: 'slide' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
    expect(pageSet.text!(out)[1]).toBe('1  slide  slide  -960,-540 1920x1080');
  });

  // docs/specs/007-editor/flashcards.md "Agents".
  it('adds a flashcard', async () => {
    const { ctx, sent } = setUp();
    await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, add: 'flashcard' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'flashcard' }] }]);
  });

  it('takes a JSON list of changes, on the tab named', async () => {
    const { ctx, sent } = setUp(undefined, undefined, '[{"op":"add","kind":"slide"}]');
    await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, tab: 'Details', changes: 'c.json' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
    const one = setUp(undefined, undefined, '{"op":"add","kind":"slide"}');
    await pageSet.run!(one.ctx, pageSet.input.parse({ doc: DOC_A, changes: '-' }));
    expect(one.sent).toEqual([{ pages: [{ op: 'add', kind: 'slide' }] }]);
  });

  it('refuses no change, bad JSON, too many changes and the api’s refusal', async () => {
    const run = async (flags: Record<string, unknown>, input = '') => {
      const { ctx } = setUp(
        undefined,
        () =>
          Response.json({ error: 'page_unknown', message: 'No page.', change: 0 }, { status: 400 }),
        input,
      );
      return pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, ...flags })).catch(
        (e: unknown) => e,
      );
    };
    expect(await run({})).toBeInstanceOf(VerbRefusal);
    expect(await run({ page: '2' })).toBeInstanceOf(VerbRefusal);
    expect(await run({ changes: 'c' }, 'not json')).toBeInstanceOf(VerbRefusal);
    expect(await run({ changes: 'c' }, '[]')).toBeInstanceOf(VerbRefusal);
    const refused = await run({ page: '9', delete: true });
    expect(refused).toBeInstanceOf(VerbRefusal);
    expect((refused as Error).message).toContain('change 1: No page.');
  });
});

describe('article get and article set', () => {
  it('prints an article as Markdown', async () => {
    const { ctx } = setUp();
    const out = await articleGet.run!(
      ctx,
      articleGet.input.parse({ doc: DOC_A, article: 'Brief' }),
    );
    expect(articleGet.text!(out)).toEqual(['---\ntitle: Brief\n---\n\nHello there']);
    const { ctx: none } = setUp({
      [TWO]: { id: TWO, elements: [] },
      [ONE]: { ...ARTICLE_TAB, articles: {} },
    });
    await expect(
      articleGet.run!(none, articleGet.input.parse({ doc: DOC_A })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });

  it('writes an article from a file with its options', async () => {
    const { ctx, sent } = setUp(undefined, undefined, '# Hello');
    const out = await articleSet.run!(
      ctx,
      articleSet.input.parse({
        doc: DOC_A,
        file: 'a.md',
        article: 'Brief',
        append: true,
        look: 'report',
        accent: '#ff0066',
        pageNumbers: true,
        size: 'letter',
        orientation: 'portrait',
      }),
    );
    expect(sent).toEqual([
      {
        article: {
          markdown: '# Hello',
          article: 'Brief',
          mode: 'append',
          size: 'letter',
          orientation: 'portrait',
          look: 'report',
          accent: '#ff0066',
          pageNumbers: true,
        },
      },
    ]);
    expect(out).toMatchObject({ flow: 'art-1', title: 'Brief', created: true, rev: 5 });
    expect(articleSet.text!(out)).toEqual(['~ Added page 2 (slide, Slide (16:9)).']);
    expect(articleSet.quiet!(out)).toEqual(['art-1']);
  });

  it('reads and writes on the tab named', async () => {
    const { ctx, sent } = setUp(undefined, undefined, 'x');
    const got = await articleGet.run!(ctx, articleGet.input.parse({ doc: DOC_A, tab: 'Overview' }));
    expect(got.flow).toBe('art-1');
    await articleSet.run!(ctx, articleSet.input.parse({ doc: DOC_A, tab: 'Overview', file: '-' }));
    expect(sent).toEqual([{ article: { markdown: 'x' } }]);
  });

  it('starts a new article, and refuses what the api refuses', async () => {
    const { ctx, sent } = setUp(undefined, undefined, 'x');
    await articleSet.run!(ctx, articleSet.input.parse({ doc: DOC_A, file: '-', new: true }));
    expect(sent).toEqual([{ article: { markdown: 'x', new: true } }]);
    const refused = setUp(
      undefined,
      () => Response.json({ error: 'article_ambiguous', message: 'Name one.' }, { status: 400 }),
      'x',
    );
    await expect(
      articleSet.run!(refused.ctx, articleSet.input.parse({ doc: DOC_A, file: '-' })),
    ).rejects.toBeInstanceOf(VerbRefusal);
  });
});
