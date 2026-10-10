import { describe, expect, it } from 'vitest';
import type { IllustrateAnswer } from '@livediagram/api-schema';
import { VerbRefusal } from '../define';
import {
  changePages,
  illustrateTabOf,
  readArticle,
  writeArticle,
} from '../illustrate/illustrate-calls';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { articleGet, articleSet, pageLs, pageSet } from './illustrate';

// The Illustrate verbs and calls (docs/specs/024-agents/illustrate-for-agents.md "The front doors",
// "Which tab").
const ONE = 'tab-one-0000';
const TWO = 'tab-two-0000';
const tabPath = (id: string) => `/documents/${DOC_A}/tabs/${id}`;

const ANSWER: IllustrateAnswer = {
  tab: { id: ONE, rev: 5 },
  switched: false,
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
  articles: [{ flow: 'art-1', title: 'Brief', pages: [2], blocks: 2, words: 4, look: null }],
  article: {
    flow: 'art-1',
    title: 'Brief',
    pages: [2],
    blocks: 2,
    words: 4,
    look: null,
    created: true,
  },
  changesetId: null,
};

const ARTICLE_TAB = {
  id: ONE,
  rev: 4,
  opensIn: 'illustrate',
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
  routes[`${tabPath(ONE)}/illustrate`] = async (r: Request) => {
    sent.push(await r.clone().json());
    return answer(r);
  };
  routes[`${tabPath(TWO)}/illustrate`] = routes[`${tabPath(ONE)}/illustrate`];
  routes[`${tabPath(ONE)}?view=pages&door=cli`] = { text: 'tab one · pages' };
  routes[`${tabPath(ONE)}?view=pages&door=cli&budget=50`] = { text: 'tab one · fitted' };
  const api = fakeApi(routes);
  return { api, sent, ctx: contextOf(api, [], [], { readInput: async () => input }) };
}

describe('which tab', () => {
  it('is the one named, else the first in Illustrate mode', async () => {
    const { api } = setUp();
    expect(await illustrateTabOf(api, DOC_A, TWO, 'mcp')).toMatchObject({ tabId: TWO });
    expect(await illustrateTabOf(api, DOC_A, undefined, 'mcp')).toMatchObject({ tabId: ONE });
  });

  it('refuses rather than switching a diagram unasked, in each door’s words', async () => {
    const { api } = setUp({ [TWO]: { id: TWO, elements: [] }, [ONE]: { id: ONE, elements: [] } });
    const mcp = await illustrateTabOf(api, DOC_A, undefined, 'mcp');
    expect(mcp).toMatchObject({ ok: false, code: 'tab_needed' });
    expect((mcp as { message: string }).message).toContain('add_tab');
    const cli = await illustrateTabOf(api, DOC_A, undefined, 'cli');
    expect((cli as { message: string }).message).toContain('--tab');
  });

  it('turns a missing document into the api’s refusal', async () => {
    const { api } = setUp();
    expect(await illustrateTabOf(api, 'nope', undefined, 'mcp')).toMatchObject({
      ok: false,
      code: 'not_found',
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
    const only = await readArticle(api, DOC_A, {}, 'mcp');
    expect(only).toMatchObject({ ok: true, flow: 'art-1', title: 'Brief' });
    expect((only as { markdown: string }).markdown).toBe('---\ntitle: Brief\n---\n\nHello there\n');
    expect(await readArticle(api, DOC_A, { article: 'brief' }, 'mcp')).toMatchObject({ ok: true });
    expect(await readArticle(api, DOC_A, { article: 'Plan' }, 'mcp')).toMatchObject({
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
    expect(await readArticle(api, DOC_A, {}, 'mcp')).toMatchObject({ code: 'article_ambiguous' });
    const none = setUp({
      [TWO]: { id: TWO, elements: [] },
      [ONE]: { ...ARTICLE_TAB, articles: {} },
    });
    expect(await readArticle(none.api, DOC_A, {}, 'mcp')).toMatchObject({
      message: 'That tab has no article.',
    });
    expect(await readArticle(none.api, 'nope', {}, 'mcp')).toMatchObject({ ok: false });
  });
});

describe('page ls and page set', () => {
  it('prints the pages view, fitted when asked', async () => {
    const { ctx } = setUp();
    const out = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A }));
    expect(pageLs.text!(out)).toEqual(['tab one · pages']);
    const fitted = await pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A, budget: 50 }));
    expect(fitted.text).toBe('tab one · fitted');
  });

  it('refuses page ls with no Illustrate tab', async () => {
    const { ctx } = setUp({ [TWO]: { id: TWO, elements: [] }, [ONE]: { id: ONE, elements: [] } });
    await expect(pageLs.run!(ctx, pageLs.input.parse({ doc: DOC_A }))).rejects.toBeInstanceOf(
      VerbRefusal,
    );
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

  it('takes a JSON list of changes, on the tab named', async () => {
    const { ctx, sent } = setUp(undefined, undefined, '[{"op":"add","kind":"logo"}]');
    await pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, tab: 'Details', changes: 'c.json' }));
    expect(sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
    const one = setUp(undefined, undefined, '{"op":"add","kind":"logo"}');
    await pageSet.run!(one.ctx, pageSet.input.parse({ doc: DOC_A, changes: '-' }));
    expect(one.sent).toEqual([{ pages: [{ op: 'add', kind: 'logo' }] }]);
  });

  it('refuses no change, bad JSON, too many changes and the api’s refusal', async () => {
    const run = async (flags: Record<string, unknown>, input = '') => {
      const { ctx } = setUp(
        undefined,
        () =>
          Response.json({ error: 'page_unknown', message: 'No page.', change: 0 }, { status: 400 }),
        input,
      );
      return pageSet.run!(ctx, pageSet.input.parse({ doc: DOC_A, ...flags })).catch((e) => e);
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
