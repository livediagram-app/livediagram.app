import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { VerbRefusal, type Verb, type VerbContext } from '../define';
import { contextOf, DOC_A, fakeApi } from '../testing/fake-api';
import {
  context,
  gap,
  knowledgeVerbs,
  move,
  newPage,
  pages,
  read,
  search,
  suggest,
  write,
} from './knowledge';

// The knowledgebase commands (docs/specs/024-agents/knowledgebase-for-agents.md "CLI"): what each asks the api for,
// what it prints, and how far each page it prints can be trusted.

const AT = Date.UTC(2026, 9, 1);
const VERIFIED = {
  state: 'verified' as const,
  verifiedAt: AT,
  reviewAt: AT + 90 * 86_400_000,
  stale: false,
};
const DRAFT = { state: 'never-verified' as const, stale: false };
const base = `/documents/${DOC_A}`;

const ROWS = [
  { tab: 'ops', title: 'Operations', depth: 1, subpages: 2, owner: 'user_o', trust: VERIFIED },
  {
    tab: 'deploys',
    title: 'Deploys',
    depth: 2,
    parent: 'ops',
    subpages: 1,
    context: true,
    trust: DRAFT,
  },
  { tab: 'rollbacks', title: 'Rollbacks', depth: 3, parent: 'deploys', subpages: 0, trust: DRAFT },
  { tab: 'holidays', title: 'Holidays', depth: 1, subpages: 0, trust: DRAFT },
];

type Sent = { method: string; body: unknown };

// A scripted api that records each write's body, and a context that reads `files` for a path.
function setup(routes: Record<string, unknown>, files: Record<string, string> = {}) {
  const sent: Sent[] = [];
  const recording = Object.fromEntries(
    Object.entries(routes).map(([path, answer]) => [
      path,
      async (request: Request) => {
        const text = await request.text();
        sent.push({ method: request.method, body: text ? (JSON.parse(text) as unknown) : null });
        return typeof answer === 'function' ? (answer as () => Response)() : Response.json(answer);
      },
    ]),
  );
  // Naming the knowledgebase by its id reads it once, as every command's addressing does.
  const api = fakeApi({ [base]: { document: { id: DOC_A, name: 'Handbook' } }, ...recording });
  const shareCodes: string[] = [];
  const ctx = contextOf(api, shareCodes, [], {
    readInput: async (path) => files[path] ?? '',
  }) as unknown as VerbContext;
  return { api, ctx, sent, shareCodes };
}

const run = <I extends z.ZodObject, O extends z.ZodType>(
  verb: Verb<I, O>,
  ctx: VerbContext,
  input: z.infer<I>,
) => verb.run!(ctx, input);

describe('context', () => {
  const answer = {
    name: 'Handbook',
    role: 'participate',
    scopes: ['read', 'suggest'],
    budget: 8000,
    tokens: 20,
    pages: [
      { tab: 'deploys', title: 'Deploys', markdown: 'On Tuesdays.\n', tokens: 20, trust: VERIFIED },
    ],
    leftOut: [{ tab: 'holidays', title: 'Holidays', tokens: 9000 }],
    pageCount: 4,
    reviewEvery: 90,
  };

  it('prints the context pages with their trust, and what the credential may do', async () => {
    const { ctx, api } = setup({ [`${base}/context`]: answer });
    const out = await run(context, ctx, { doc: DOC_A });
    expect(api.calls).toEqual([base, `${base}/context`]);
    expect(out).toMatchObject({
      knowledgebase: 'Handbook',
      budget_tokens: 8000,
      page_count: 4,
      review_period: '90 days',
    });
    expect(context.text!(out)).toEqual([
      'Handbook · 4 pages · reviews every 90 days · you act as participate · scopes: read, suggest · 20 of 8000 tokens',
      '',
      '--- "Deploys" (deploys) · verified 2026-10-01, review due 2026-12-30',
      'On Tuesdays.',
      'left out (over the budget): "Holidays" (holidays), 9000 tokens',
    ]);
  });

  it('states the knowledgebase’s Review Period once, whatever it is', async () => {
    for (const [reviewEvery, period, words] of [
      [30, '30 days', 'reviews every 30 days'],
      [365, '365 days', 'reviews every 365 days'],
      ['never', 'never', 'no review period'],
      // An api that does not say reads as the default.
      [undefined, '90 days', 'reviews every 90 days'],
      // So does a period this client does not know.
      [45, '90 days', 'reviews every 90 days'],
    ] as const) {
      const { ctx } = setup({ [`${base}/context`]: { ...answer, reviewEvery } });
      const out = await run(context, ctx, { doc: DOC_A });
      expect(out.review_period).toBe(period);
      expect(context.text!(out)[0]).toContain(` · ${words} · `);
    }
  });
});

describe('pages', () => {
  it('prints the tree, each page with its trust', async () => {
    const { ctx, api } = setup({ [`${base}/pages`]: { reviewEvery: 180, pages: ROWS } });
    const out = await run(pages, ctx, { doc: DOC_A });
    expect(api.calls).toEqual([base, `${base}/pages`]);
    expect(out.count).toBe(4);
    // The Review Period once, for every row's review date.
    expect(out.review_period).toBe('180 days');
    expect(pages.text!(out)).toEqual([
      '4 pages · reviews every 180 days',
      'Operations  (ops)  verified 2026-10-01, review due 2026-12-30',
      '  Deploys  (deploys)  never verified, always in context',
      '    Rollbacks  (rollbacks)  never verified',
      'Holidays  (holidays)  never verified',
    ]);
    expect(pages.quiet!(out)).toEqual(['ops', 'deploys', 'rollbacks', 'holidays']);
    expect(out.pages[0]).toMatchObject({ owner: 'user_o' });
    expect(out.pages[1]).toMatchObject({ parent: 'ops', always_in_context: true });
  });

  it('prints one page’s subtree, by id or title', async () => {
    const { ctx } = setup({ [`${base}/pages`]: { pages: ROWS } });
    const under = await run(pages, ctx, { doc: DOC_A, under: ' deploys' });
    expect(under.pages.map((p) => p.page)).toEqual(['deploys', 'rollbacks']);
    const last = await run(pages, ctx, { doc: DOC_A, under: 'holidays' });
    expect(last).toMatchObject({ count: 1, review_period: '90 days' });
    expect(pages.text!(last)[0]).toBe('1 page · reviews every 90 days');
  });

  it('refuses a page that is not there, or a title two pages share', async () => {
    const twice = [...ROWS, { ...ROWS[3]!, tab: 'h2' }];
    const { ctx } = setup({ [`${base}/pages`]: { pages: twice } });
    await expect(run(pages, ctx, { doc: DOC_A, under: 'Nope' })).rejects.toMatchObject({
      code: 'page_unknown',
      message: 'no page "Nope" in this knowledgebase',
      lines: [],
    });
    const several = await run(pages, ctx, { doc: DOC_A, under: 'Holidays' }).catch(
      (e: unknown) => e,
    );
    expect(several).toBeInstanceOf(VerbRefusal);
    expect(several).toMatchObject({
      code: 'page_ambiguous',
      lines: ['"Holidays" (holidays)', '"Holidays" (h2)'],
    });
  });

  it('says so when there are none', () => {
    expect(pages.text!({ count: 0, review_period: 'never', pages: [] })).toEqual(['no pages']);
  });
});

describe('search', () => {
  const passage = (extra: object = {}) => ({
    id: 'p1',
    tab: 'deploys',
    isTitle: false,
    title: 'Deploys',
    titleMarked: 'Deploys',
    headings: ['When we deploy'],
    snippet: '',
    firstBlock: 'b1',
    lastBlock: 'b1',
    trust: 'verified',
    verifiedAt: AT,
    text: 'On Tuesdays.\nNever on a Friday.',
    ...extra,
  });

  it('prints each result’s page, heading, trust and passage', async () => {
    const results = [
      passage({ isTitle: true, headings: [], text: undefined }),
      passage(),
      passage(),
    ];
    const { ctx, api } = setup({ [`${base}/search?q=when%20do%20we%20deploy`]: { results } });
    const out = await run(search, ctx, {
      doc: DOC_A,
      query: ['when', 'do', 'we', 'deploy'],
      limit: 2,
    });
    expect(api.calls).toEqual([base, `${base}/search?q=when%20do%20we%20deploy`]);
    expect(out).toMatchObject({ count: 2, more: 1 });
    expect(search.text!(out)).toEqual([
      'Deploys  (deploys)  verified 2026-10-01',
      'Deploys > When we deploy  (deploys)  verified 2026-10-01',
      '  On Tuesdays.\n  Never on a Friday.',
      '1 more: raise --limit',
    ]);
    expect(search.quiet!(out)).toEqual(['deploys', 'deploys']);
  });

  it('answers every result without a limit, and says when nothing matches', async () => {
    const { ctx } = setup({
      [`${base}/search?q=a`]: { results: [passage()] },
      [`${base}/search?q=b`]: { results: [] },
    });
    const all = await run(search, ctx, { doc: DOC_A, query: ['a'] });
    expect(search.text!(all)).toHaveLength(2);
    const none = await run(search, ctx, { doc: DOC_A, query: ['b'] });
    expect(search.text!(none)).toEqual([
      'no passage matches (recorded as a question the knowledgebase could not answer)',
    ]);
  });

  it('narrows to the pages of the labels --labels names', async () => {
    const { ctx, api } = setup({
      [`${base}/search?q=a&labels=Engineering%2COps`]: { results: [passage()] },
    });
    const out = await run(search, ctx, { doc: DOC_A, query: ['a'], labels: 'Engineering,Ops' });
    expect(api.calls.at(-1)).toBe(`${base}/search?q=a&labels=Engineering%2COps`);
    expect(out).toMatchObject({ count: 1 });
  });
});

describe('read', () => {
  const page = {
    tab: 'deploys',
    title: 'Deploys',
    rev: 7,
    markdown: '# When\n\nOn Tuesdays.\n',
    chars: 900,
    leftOut: 880,
    headings: ['When'],
    trust: VERIFIED,
    parent: 'ops',
    backlinks: [{ tab: 'holidays', title: 'Holidays' }],
    subpages: [{ tab: 'rollbacks', title: 'Rollbacks' }],
  };

  it('prints the page, then its trust, what was left out, its backlinks and subpages', async () => {
    const path = `${base}/pages/Deploys?maxChars=20&heading=When`;
    const { ctx, api } = setup({ [path]: { page } });
    const out = await run(read, ctx, {
      doc: DOC_A,
      page: 'Deploys',
      heading: 'When',
      maxChars: 20,
    });
    expect(api.calls).toEqual([base, path]);
    expect(read.text!(out)).toEqual([
      '# When\n\nOn Tuesdays.',
      '',
      '--- "Deploys" (deploys) · rev 7 · verified 2026-10-01, review due 2026-12-30',
      '--- 880 of 900 characters left out',
      '--- linked from: "Holidays" (holidays)',
      '--- subpages: "Rollbacks" (rollbacks)',
    ]);
    expect(read.quiet!(out)).toEqual(['# When\n\nOn Tuesdays.']);
    expect(out.parent).toBe('ops');
  });

  it('asks for the whole page by default, and prints only what there is', async () => {
    const whole = {
      ...page,
      leftOut: 0,
      parent: undefined,
      backlinks: [],
      subpages: [],
      trust: DRAFT,
    };
    const { ctx, api } = setup({ [`${base}/pages/deploys`]: { page: whole } });
    const out = await run(read, ctx, { doc: DOC_A, page: 'deploys' });
    expect(api.calls).toEqual([base, `${base}/pages/deploys`]);
    expect(read.text!(out)).toEqual([
      '# When\n\nOn Tuesdays.',
      '',
      '--- "Deploys" (deploys) · rev 7 · never verified',
    ]);
    expect(out).not.toHaveProperty('parent');
  });
});

describe('new', () => {
  it('adds a page from a file under a parent', async () => {
    const { ctx, sent } = setup(
      { [`${base}/pages`]: { page: { tab: 'new', title: 'Hotfixes', parent: 'deploys', rev: 1 } } },
      { 'hotfixes.md': 'Any day.' },
    );
    const out = await run(newPage, ctx, {
      doc: DOC_A,
      title: 'Hotfixes',
      file: 'hotfixes.md',
      parent: 'Deploys',
    });
    expect(sent).toEqual([
      { method: 'POST', body: { title: 'Hotfixes', markdown: 'Any day.', parent: 'Deploys' } },
    ]);
    expect(newPage.text!(out)).toEqual(['+ page "Hotfixes" (new) under deploys · never verified']);
    expect(newPage.quiet!(out)).toEqual(['new']);
  });

  it('adds an empty page at the top level', async () => {
    const { ctx, sent } = setup({
      [`${base}/pages`]: { page: { tab: 'n', title: 'Later', rev: 1 } },
    });
    const out = await run(newPage, ctx, { doc: DOC_A, title: 'Later' });
    expect(sent[0]!.body).toEqual({ title: 'Later' });
    expect(newPage.text!(out)).toEqual(['+ page "Later" (n) · never verified']);
  });

  it('says verification is off where the knowledgebase does not verify pages', async () => {
    const { ctx } = setup({
      [`${base}/pages`]: { page: { tab: 'n', title: 'Later', rev: 1 }, trust: 'off' },
    });
    const out = await run(newPage, ctx, { doc: DOC_A, title: 'Later' });
    expect(out).toMatchObject({ verified: 'off' });
    expect(newPage.text!(out)).toEqual(['+ page "Later" (n) · verification off']);
  });
});

describe('suggest', () => {
  const made = {
    suggestion: { id: 'sg_1', tab: 'deploys', title: 'Deploys', kind: 'replace' },
    pending: 2,
  };
  const path = `${base}/pages/Deploys/suggestions`;

  it('suggests a passage replaced', async () => {
    const { ctx, sent } = setup({ [path]: made });
    const out = await run(suggest, ctx, {
      doc: DOC_A,
      page: 'Deploys',
      reason: 'Moved.',
      old: 'on Tuesdays',
      new: 'on Mondays',
    });
    expect(sent[0]!.body).toEqual({ reason: 'Moved.', after: 'on Mondays', before: 'on Tuesdays' });
    expect(suggest.text!(out)).toEqual([
      '+ suggestion sg_1 on "Deploys" (deploys) (replace) · 2 waiting for an Editor',
    ]);
    expect(suggest.quiet!(out)).toEqual(['sg_1']);
  });

  it('appends text read from a file', async () => {
    const { ctx, sent } = setup({ [path]: made }, { '-': 'More.' });
    await run(suggest, ctx, { doc: DOC_A, page: 'Deploys', reason: 'Missing.', newFile: '-' });
    expect(sent[0]!.body).toEqual({ reason: 'Missing.', after: 'More.' });
  });

  it('refuses no new text, or two, before asking the api', async () => {
    const { ctx, api } = setup({ [path]: made });
    for (const input of [{}, { new: 'a', newFile: 'b' }])
      await expect(
        run(suggest, ctx, { doc: DOC_A, page: 'Deploys', reason: 'Why.', ...input }),
      ).rejects.toMatchObject({ code: 'usage', status: 400 });
    expect(api.calls).toEqual([]);
  });
});

describe('write', () => {
  const done = {
    tab: { id: 'deploys', rev: 8 },
    lines: ['Wrote the article.'],
    pages: [],
    articles: [],
  };
  const path = `${base}/pages/deploys`;

  it('replaces the page’s writing, or appends to it', async () => {
    const { ctx, sent } = setup({ [path]: done }, { 'page.md': 'New.' });
    const out = await run(write, ctx, { doc: DOC_A, page: 'deploys', file: 'page.md' });
    await run(write, ctx, { doc: DOC_A, page: 'deploys', file: 'page.md', append: true });
    expect(sent).toEqual([
      { method: 'PUT', body: { markdown: 'New.' } },
      { method: 'PUT', body: { markdown: 'New.', mode: 'append' } },
    ]);
    expect(write.text!(out)).toEqual(['~ Wrote the article.', '~ page deploys · rev 8']);
    expect(write.quiet!(out)).toEqual(['deploys']);
  });
});

describe('move', () => {
  const path = `${base}/pages/rollbacks/move`;
  const moved = { page: { tab: 'rollbacks', title: 'Rollbacks', parent: 'ops', depth: 2 } };

  it('moves a page under a parent, to the top, or in front of a page', async () => {
    const { ctx, sent } = setup({ [path]: moved });
    const out = await run(move, ctx, { doc: DOC_A, page: 'rollbacks', parent: 'Operations' });
    await run(move, ctx, { doc: DOC_A, page: 'rollbacks', top: true, before: 'holidays' });
    await run(move, ctx, { doc: DOC_A, page: 'rollbacks', before: 'deploys' });
    expect(sent.map((s) => s.body)).toEqual([
      { parent: 'Operations' },
      { parent: null, before: 'holidays' },
      { before: 'deploys' },
    ]);
    expect(move.text!(out)).toEqual(['~ "Rollbacks" (rollbacks) is now at depth 2 under ops']);
    expect(move.quiet!(out)).toEqual(['rollbacks']);
    expect(move.text!({ page: 'h', title: 'Holidays', depth: 1 })).toEqual([
      '~ "Holidays" (h) is now at depth 1, at the top level',
    ]);
  });

  it('refuses nowhere to go, and a parent beside --top', async () => {
    const { ctx, api } = setup({
      [path]: { page: { tab: 'rollbacks', title: 'Rollbacks', depth: 1 } },
    });
    await expect(run(move, ctx, { doc: DOC_A, page: 'rollbacks' })).rejects.toMatchObject({
      message: 'move needs somewhere to go: --parent <page>, --top or --before <page>',
    });
    await expect(
      run(move, ctx, { doc: DOC_A, page: 'rollbacks', parent: 'ops', top: true }),
    ).rejects.toMatchObject({ message: 'move takes --parent <page> or --top, not both' });
    expect(api.calls).toEqual([]);
    const top = await run(move, ctx, { doc: DOC_A, page: 'rollbacks', top: true });
    expect(top).not.toHaveProperty('parent');
  });
});

describe('gap', () => {
  it('records the question as it was asked', async () => {
    const { ctx, sent } = setup({ [`${base}/questions`]: { key: 'k' } });
    const out = await run(gap, ctx, { doc: DOC_A, question: ['Who', 'is', 'on', 'call?'] });
    expect(sent).toEqual([{ method: 'POST', body: { question: 'Who is on call?' } }]);
    expect(gap.text!(out)).toEqual(['+ recorded: Who is on call?']);
  });
});

describe('a knowledgebase named by a share link', () => {
  it('sends the link’s code with the command', async () => {
    const { ctx, shareCodes, api } = setup({
      '/share/AB12': { document: { id: DOC_A, name: 'Handbook' }, role: 'view' },
      [`${base}/questions`]: { key: 'k' },
    });
    await run(gap, ctx, {
      doc: 'https://liveknowledge.app/document/shared?s=AB12',
      question: ['Why?'],
    });
    expect(shareCodes).toEqual(['AB12']);
    expect(api.calls).toEqual(['/share/AB12', `${base}/questions`]);
  });
});

describe('the knowledgebase commands', () => {
  it('are nine top-level commands, each with two examples', () => {
    expect(knowledgeVerbs.map((v) => v.id)).toEqual([
      'context',
      'pages',
      'search',
      'read',
      'new',
      'suggest',
      'write',
      'move',
      'gap',
    ]);
    for (const verb of knowledgeVerbs) {
      expect(
        verb.cli!.examples.every(
          (e) => e.startsWith('liveknowledge ') || e.includes('| liveknowledge '),
        ),
      ).toBe(true);
      expect(`${verb.summary} ${verb.description}`).not.toMatch(/wiki|knowledge base/i);
    }
  });
});
