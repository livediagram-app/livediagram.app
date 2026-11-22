import { describe, expect, it } from 'vitest';
import type { PagesAnswer } from '@liveknowledge/api-schema';
import { VerbRefusal } from '../define';
import { changePages, pagesTabOf, readArticle, writeArticle } from '../pages/pages-calls';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import { articleGet, articleSet, pageLs } from './pages';

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
      readability: {
        readingMinutes: 1,
        sentences: 2,
        wordsPerSentence: 2,
        longSentences: 0,
        ease: 77.9,
        level: 'Fairly easy to read',
      },
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
    readability: {
      readingMinutes: 1,
      sentences: 2,
      wordsPerSentence: 2,
      longSentences: 0,
      ease: 77.9,
      level: 'Fairly easy to read',
    },
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
    // Spacing aside, as write_article names it.
    expect(await readArticle(api, DOC_A, { article: '  BRIEF ' })).toMatchObject({ ok: true });
    const spaced = setUp({
      [ONE]: {
        ...ARTICLE_TAB,
        articles: {
          'art-1': {
            blocks: [
              { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Q3  plan ' }] },
            ],
          },
        },
      },
    });
    expect(await readArticle(spaced.api, DOC_A, { article: 'q3 plan' })).toMatchObject({
      ok: true,
      flow: 'art-1',
    });
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

describe('page ls', () => {
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
      }),
    );
    expect(sent).toEqual([
      {
        article: {
          markdown: '# Hello',
          article: 'Brief',
          mode: 'append',
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

  // docs/specs/024-agents/pages-for-agents.md "Held paragraphs".
  it('waits out a held paragraph with --wait-held, and refuses once the time is up', async () => {
    const held = () =>
      Response.json(
        { error: 'paragraphs_held', message: 'Sam Lee is writing in "Hello there".' },
        { status: 409 },
      );
    let left = 2;
    const later = setUp(undefined, () => (left-- > 0 ? held() : Response.json(ANSWER)), 'x');
    const logs: string[] = [];
    later.ctx.log = (line) => void logs.push(line);
    const out = await articleSet.run!(
      later.ctx,
      articleSet.input.parse({ doc: DOC_A, file: '-', waitHeld: '30' }),
    );
    expect(out).toMatchObject({ flow: 'art-1' });
    expect(later.sent).toHaveLength(3);
    expect(later.ctx.slept).toEqual([2000, 2000]);
    expect(logs.filter((l) => l.startsWith('held'))).toEqual(['held retry 1', 'held retry 2']);

    const never = setUp(undefined, held, 'x');
    await expect(
      articleSet.run!(never.ctx, articleSet.input.parse({ doc: DOC_A, file: '-', waitHeld: 5 })),
    ).rejects.toThrow('Sam Lee is writing in "Hello there".');
    // Tries at 0, 2 and 4 s; a fourth at 6 s would be past the 5 s given.
    expect(never.sent).toHaveLength(3);

    const once = setUp(undefined, held, 'x');
    await expect(
      articleSet.run!(once.ctx, articleSet.input.parse({ doc: DOC_A, file: '-' })),
    ).rejects.toMatchObject({ hint: 'wait for them to pause with: --wait-held <seconds>' });
    expect(once.sent).toHaveLength(1);
  });

  it('refuses what the api refuses', async () => {
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
