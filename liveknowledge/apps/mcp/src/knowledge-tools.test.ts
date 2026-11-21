import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MCP_TOOL_VERBS } from '@liveknowledge/agent-verbs/mcp';
import type {
  KnowledgeAgentContextResponse,
  KnowledgePageRead,
  KnowledgePageRow,
  KnowledgeSearchResult,
} from '@liveknowledge/api-schema';

// The wasm rasteriser does not load under Node; no knowledgebase tool draws.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { connectTestClient } from './mcp-test-client';

// The knowledgebase tools end to end through a real MCP client and server
// (docs/specs/024-agents/knowledgebase-for-agents.md): what each asks the api for and how many times, the name it
// sends, the trust fields on every answer, how small an answer is by default, and how a refusal reads.

const DAY = 86_400_000;
const VERIFIED_AT = Date.UTC(2026, 9, 1);

const trust = (state: 'verified' | 'review-due' | 'never-verified') =>
  state === 'never-verified'
    ? { state, stale: false }
    : {
        state,
        verifiedAt: VERIFIED_AT,
        reviewAt: VERIFIED_AT + 90 * DAY,
        stale: state === 'review-due',
      };

const row = (
  tab: string,
  title: string,
  depth: number,
  extra: Partial<KnowledgePageRow> = {},
): KnowledgePageRow => ({
  tab,
  title,
  depth,
  subpages: 0,
  trust: trust('never-verified'),
  ...extra,
});

const ROWS: KnowledgePageRow[] = [
  row('ops', 'Operations', 1, { subpages: 2, owner: 'user_o', trust: trust('verified') }),
  row('deploys', 'Deploys', 2, {
    parent: 'ops',
    subpages: 1,
    context: true,
    trust: { ...trust('review-due'), conflictsWith: [{ tab: 'holidays', title: 'Holidays' }] },
  }),
  row('rollbacks', 'Rollbacks', 3, { parent: 'deploys' }),
  row('holidays', 'Holidays', 1),
];

const PAGE: KnowledgePageRead = {
  tab: 'deploys',
  title: 'Deploys',
  rev: 7,
  markdown: '# When we deploy\n\nOn Tuesdays. See [[Rollbacks]].',
  chars: 9000,
  leftOut: 8952,
  headings: ['When we deploy', 'Who decides'],
  trust: { ...trust('verified'), verifiedBy: 'Webber' },
  parent: 'ops',
  backlinks: [{ tab: 'holidays', title: 'Holidays' }],
  subpages: [{ tab: 'rollbacks', title: 'Rollbacks' }],
};

const passage = (extra: Partial<KnowledgeSearchResult> = {}): KnowledgeSearchResult => ({
  id: 'p1',
  tab: 'deploys',
  isTitle: false,
  title: 'Deploys',
  titleMarked: 'Deploys',
  headings: ['When we deploy', 'Days'],
  snippet: 'On \u0002Tuesdays\u0003.',
  firstBlock: 'b2',
  lastBlock: 'b3',
  trust: 'verified',
  verifiedAt: VERIFIED_AT,
  reviewAt: VERIFIED_AT + 90 * DAY,
  text: 'Deploys go out on Tuesdays.',
  ...extra,
});

const CONTEXT: KnowledgeAgentContextResponse = {
  name: 'Handbook',
  role: 'participate',
  scopes: ['read', 'suggest'],
  budget: 8000,
  tokens: 20,
  pages: [
    {
      tab: 'deploys',
      title: 'Deploys',
      markdown: 'On Tuesdays.',
      tokens: 20,
      trust: trust('verified'),
    },
  ],
  leftOut: [{ tab: 'holidays', title: 'Holidays', tokens: 9000 }],
  pageCount: 4,
  reviewEvery: 90,
};

type Sent = {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  agent: string | null;
  door: string | null;
};

// An api that answers each knowledge route, or what a test puts in its place.
async function connect(answers: Record<string, () => Response> = {}) {
  const sent: Sent[] = [];
  const client = await connectTestClient(async (request) => {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/documents\/kb/, '');
    const text = await request.text();
    sent.push({
      method: request.method,
      path,
      query: url.searchParams,
      body: text ? (JSON.parse(text) as unknown) : null,
      agent: request.headers.get('X-Liveknowledge-Agent'),
      door: request.headers.get('X-Liveknowledge-Client'),
    });
    const given = answers[`${request.method} ${path}`];
    if (given) return given();
    if (path === '/context') return Response.json(CONTEXT);
    if (path === '/pages' && request.method === 'GET')
      return Response.json({ reviewEvery: 'never', pages: ROWS });
    if (path === '/search') return Response.json({ results: [passage()] });
    if (path === '/questions') return Response.json({ key: 'k' }, { status: 201 });
    if (path === '/pages' && request.method === 'POST')
      return Response.json(
        { page: { tab: 'new', title: 'Hotfixes', parent: 'deploys', rev: 1 } },
        { status: 201 },
      );
    if (path.endsWith('/suggestions'))
      return Response.json(
        {
          suggestion: {
            id: 'sg_0000000001',
            tab: 'deploys',
            title: 'Deploys',
            agent: 'test-client',
            reason: 'r',
            summary: 'r',
            kind: 'replace',
            before: 'a',
            after: 'b',
            createdAt: 1,
          },
          pending: 3,
        },
        { status: 201 },
      );
    if (path.endsWith('/move'))
      return Response.json({ page: { tab: 'rollbacks', title: 'Rollbacks', depth: 1 } });
    if (request.method === 'PUT')
      return Response.json({
        tab: { id: 'deploys', rev: 8 },
        lines: ['Wrote the article.'],
        pages: [],
        articles: [],
        changesetId: null,
      });
    return Response.json({ page: PAGE });
  });
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: { documentId: 'kb', ...args } });
    const out = (result.structuredContent ?? {}) as Record<string, unknown>;
    // A success holds nothing its output schema does not declare (the SDK checks the rest).
    if (!result.isError) {
      const verb = MCP_TOOL_VERBS.find((v) => v.mcp.tool === name)!;
      z.strictObject(verb.mcpShapes.output).parse(out);
    }
    const [first] = result.content as { type: string; text: string }[];
    return { out, text: first?.text ?? '', isError: result.isError === true };
  };
  return { client, sent, call };
}

const refuse = (status: number, error: string, message: string) => () =>
  Response.json({ error, message }, { status });

describe('every knowledgebase tool', () => {
  it.each([
    ['get_context', {}, 'GET /context'],
    ['list_pages', {}, 'GET /pages'],
    ['search_pages', { query: 'tuesdays' }, 'GET /search'],
    ['read_page', { page: 'Deploys' }, 'GET /pages/Deploys'],
    ['report_gap', { question: 'Who is on call?' }, 'POST /questions'],
    ['create_page', { title: 'Hotfixes', markdown: 'Any day.' }, 'POST /pages'],
    [
      'suggest_edit',
      { page: 'deploys', reason: 'r', new_text: 'b' },
      'POST /pages/deploys/suggestions',
    ],
    ['write_page', { page: 'deploys', markdown: 'x' }, 'PUT /pages/deploys'],
    ['move_page', { page: 'rollbacks' }, 'POST /pages/rollbacks/move'],
  ])('%s is one request, sent as the MCP client by name', async (name, args, request) => {
    const { call, sent } = await connect();
    const { out, isError } = await call(name, args);
    expect(isError).toBe(false);
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([request]);
    expect(sent[0]).toMatchObject({ agent: 'test-client', door: 'mcp' });
    expect(typeof out.next).toBe('string');
    expect((out.next as string).length).toBeGreaterThan(20);
  });
});

describe('get_context', () => {
  it('answers the context pages with their trust, what did not fit and what the connection may do', async () => {
    const { call } = await connect();
    const { out } = await call('get_context', {});
    expect(out).toMatchObject({
      knowledgebase: 'Handbook',
      role: 'participate',
      scopes: ['read', 'suggest'],
      budget_tokens: 8000,
      tokens: 20,
      page_count: 4,
      // The knowledgebase's Review Period, said once.
      review_period: '90 days',
      left_out: [{ page: 'holidays', title: 'Holidays', tokens: 9000 }],
    });
    expect((out.pages as object[])[0]).toEqual({
      page: 'deploys',
      title: 'Deploys',
      markdown: 'On Tuesdays.',
      tokens: 20,
      verified: 'verified',
      verified_at: '2026-10-01T00:00:00.000Z',
      review_due: '2026-12-30T00:00:00.000Z',
      stale: false,
    });
    expect(out.next).toContain('left_out');
    expect(out.next).toContain('search_pages');
  });

  it('takes no per-page interval anywhere: no tool has an input for a review period', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const inputs = Object.keys((tool.inputSchema as { properties?: object }).properties ?? {});
      expect(inputs.filter((name) => /review|interval|period/i.test(name))).toEqual([]);
    }
    const described = (name: string) => tools.find((t) => t.name === name)!.description!;
    expect(described('get_context')).toContain('Review Period');
    expect(described('list_pages')).toContain('Review Period');
  });

  it('says so when no page is marked', async () => {
    const { call } = await connect({
      'GET /context': () => Response.json({ ...CONTEXT, pages: [], leftOut: [], tokens: 0 }),
    });
    expect((await call('get_context', {})).out.next).toMatch(
      /^No page is marked Always in Context/,
    );
  });
});

describe('list_pages', () => {
  it('answers the tree in order with every trust field', async () => {
    const { call } = await connect();
    const { out } = await call('list_pages', {});
    expect(out.count).toBe(4);
    expect(out.more).toBe(0);
    // The knowledgebase's Review Period, said once for every row: this one's pages never come due.
    expect(out.review_period).toBe('never');
    const pages = out.pages as Record<string, unknown>[];
    expect(pages.map((p) => [p.page, p.depth])).toEqual([
      ['ops', 1],
      ['deploys', 2],
      ['rollbacks', 3],
      ['holidays', 1],
    ]);
    expect(pages[0]).toMatchObject({ owner: 'user_o', verified: 'verified', stale: false });
    expect(pages[1]).toEqual({
      page: 'deploys',
      title: 'Deploys',
      depth: 2,
      parent: 'ops',
      subpages: 1,
      always_in_context: true,
      verified: 'review-due',
      verified_at: '2026-10-01T00:00:00.000Z',
      review_due: '2026-12-30T00:00:00.000Z',
      stale: true,
      conflicts_with: [{ page: 'holidays', title: 'Holidays' }],
    });
    expect(pages[3]).toEqual({
      page: 'holidays',
      title: 'Holidays',
      depth: 1,
      subpages: 0,
      verified: 'never-verified',
      stale: false,
    });
  });

  it('answers one page’s subtree, by its title', async () => {
    const { call } = await connect();
    const { out } = await call('list_pages', { under: 'deploys ' });
    expect((out.pages as { page: string }[]).map((p) => p.page)).toEqual(['deploys', 'rollbacks']);
    const last = await call('list_pages', { under: 'holidays' });
    expect((last.out.pages as { page: string }[]).map((p) => p.page)).toEqual(['holidays']);
  });

  it('pages a long tree and says how many rows follow', async () => {
    const { call } = await connect();
    const first = await call('list_pages', { limit: 2 });
    expect(first.out).toMatchObject({ count: 4, more: 2 });
    expect(first.out.next).toContain('offset 2');
    const rest = await call('list_pages', { limit: 2, offset: 2 });
    expect((rest.out.pages as { page: string }[]).map((p) => p.page)).toEqual([
      'rollbacks',
      'holidays',
    ]);
    expect(rest.out.more).toBe(0);
    expect((await call('list_pages', { offset: 9 })).out).toMatchObject({ pages: [], more: 0 });
  });

  it('names the pages there are when "under" names none, or several', async () => {
    const { call } = await connect({
      'GET /pages': () => Response.json({ pages: [...ROWS, row('h2', 'Holidays', 1)] }),
    });
    const none = await call('list_pages', { under: 'Nope' });
    expect(none.isError).toBe(true);
    expect(none.text).toContain('No page "Nope"');
    expect(none.text).toContain('"Deploys" (deploys)');
    const twice = await call('list_pages', { under: 'Holidays' });
    expect(twice.text).toContain('2 pages are titled "Holidays"');
    expect(twice.text).toContain('holidays, h2');
  });

  it('names twelve pages at most in a refusal', async () => {
    const many = Array.from({ length: 15 }, (_, i) => row(`p${i}`, `Page ${i}`, 1));
    const { call } = await connect({ 'GET /pages': () => Response.json({ pages: many }) });
    const { text } = await call('list_pages', { under: 'Nope' });
    expect(text).toContain('"Page 11" (p11), and 3 more (list_pages lists them)');
    expect(text).not.toContain('Page 12');
  });
});

describe('search_pages', () => {
  it('answers passages, not pages, each with its headings and trust', async () => {
    const { call, sent } = await connect();
    const { out } = await call('search_pages', { query: 'when do we deploy?' });
    expect(sent[0]!.query.get('q')).toBe('when do we deploy?');
    expect(out).toMatchObject({ count: 1, more: 0 });
    expect((out.results as object[])[0]).toEqual({
      page: 'deploys',
      title: 'Deploys',
      heading: 'When we deploy > Days',
      passage: 'Deploys go out on Tuesdays.',
      verified: 'verified',
      verified_at: '2026-10-01T00:00:00.000Z',
      review_due: '2026-12-30T00:00:00.000Z',
      stale: false,
    });
    expect(out.next).toContain('read_page');
  });

  it('marks a stale passage and one in conflict, and says what to do about a conflict', async () => {
    const { call } = await connect({
      'GET /search': () =>
        Response.json({
          results: [
            passage({ isTitle: true, headings: [], text: undefined }),
            passage({
              trust: 'review-due',
              conflictsWith: [{ tab: 'holidays', title: 'Holidays' }],
            }),
            passage({ trust: 'never-verified', verifiedAt: undefined, reviewAt: undefined }),
          ],
        }),
    });
    const { out } = await call('search_pages', { query: 'deploy' });
    const [title, stale, draft] = out.results as Record<string, unknown>[];
    expect(title).not.toHaveProperty('passage');
    expect(title).not.toHaveProperty('heading');
    expect(stale).toMatchObject({
      verified: 'review-due',
      stale: true,
      conflicts_with: [{ page: 'holidays', title: 'Holidays' }],
    });
    expect(draft).toEqual({
      page: 'deploys',
      title: 'Deploys',
      heading: 'When we deploy > Days',
      passage: 'Deploys go out on Tuesdays.',
      verified: 'never-verified',
      stale: false,
    });
    expect(out.next).toContain('tell the user they disagree');
  });

  it('answers eight results unless asked, and counts the rest', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => passage({ id: `p${i}` }));
    const { call } = await connect({ 'GET /search': () => Response.json({ results: twenty }) });
    expect((await call('search_pages', { query: 'q' })).out).toMatchObject({ count: 8, more: 12 });
    expect((await call('search_pages', { query: 'q', limit: 20 })).out).toMatchObject({
      count: 20,
      more: 0,
    });
  });

  it('says what to do when nothing matches', async () => {
    const { call } = await connect({ 'GET /search': () => Response.json({ results: [] }) });
    const { out } = await call('search_pages', { query: 'q' });
    expect(out).toMatchObject({ count: 0, results: [], more: 0 });
    expect(out.next).toContain('report_gap');
  });
});

describe('read_page', () => {
  it('asks for the first part by default and says what was left out and how to get it', async () => {
    const { call, sent } = await connect();
    const { out } = await call('read_page', { page: 'Deploys' });
    expect(sent[0]!.query.get('maxChars')).toBe('6000');
    expect(sent[0]!.query.has('heading')).toBe(false);
    expect(out).toMatchObject({
      page: 'deploys',
      title: 'Deploys',
      rev: 7,
      markdown: PAGE.markdown,
      chars: 9000,
      left_out: 8952,
      headings: ['When we deploy', 'Who decides'],
      parent: 'ops',
      backlinks: [{ page: 'holidays', title: 'Holidays' }],
      subpages: [{ page: 'rollbacks', title: 'Rollbacks' }],
      verified: 'verified',
      verified_by: 'Webber',
      stale: false,
    });
    expect(out.next).toContain('8952 characters of this page were left out');
    expect(out.next).toContain('max_chars 9000');
  });

  it('answers the page’s cover where it has one', async () => {
    const { call } = await connect({
      'GET /pages/Deploys': () => Response.json({ page: { ...PAGE, cover: { gradient: 'Dusk' } } }),
    });
    expect((await call('read_page', { page: 'Deploys' })).out.cover).toEqual({ gradient: 'Dusk' });
    const plain = await connect();
    expect('cover' in (await plain.call('read_page', { page: 'Deploys' })).out).toBe(false);
  });

  it('passes a heading and a size on, and a page’s title encoded', async () => {
    const { call, sent } = await connect({
      'GET /pages/On%20call%2Frota': () =>
        Response.json({ page: { ...PAGE, leftOut: 0, parent: undefined } }),
    });
    const { out } = await call('read_page', {
      page: 'On call/rota',
      heading: 'Who decides',
      max_chars: 500,
    });
    expect(sent[0]!.query.get('maxChars')).toBe('500');
    expect(sent[0]!.query.get('heading')).toBe('Who decides');
    expect(out).not.toHaveProperty('parent');
    expect(out.next).not.toContain('left out');
  });

  it('answers the api’s words when the page or the heading is unknown', async () => {
    const { call } = await connect({
      'GET /pages/Nope': refuse(
        404,
        'page_unknown',
        'No page "Nope" in this knowledgebase. Pages: "Deploys" (deploys).',
      ),
    });
    const { isError, text } = await call('read_page', { page: 'Nope' });
    expect(isError).toBe(true);
    expect(text).toBe('No page "Nope" in this knowledgebase. Pages: "Deploys" (deploys).');
  });
});

describe('the writing tools', () => {
  it('create_page sends the title, the Markdown and the parent, and answers a draft', async () => {
    const { call, sent } = await connect();
    const { out } = await call('create_page', {
      title: 'Hotfixes',
      markdown: 'Any day.',
      parent: 'Deploys',
    });
    expect(sent[0]!.body).toEqual({ title: 'Hotfixes', markdown: 'Any day.', parent: 'Deploys' });
    expect(out).toMatchObject({
      page: 'new',
      title: 'Hotfixes',
      parent: 'deploys',
      verified: 'never-verified',
      url: 'https://www.liveknowledge.app/document/kb',
    });
    const top = await connect({
      'POST /pages': () =>
        Response.json({ page: { tab: 'n', title: 'T', rev: 1 } }, { status: 201 }),
    });
    const made = await top.call('create_page', { title: 'T', markdown: 'x' });
    expect(top.sent[0]!.body).toEqual({ title: 'T', markdown: 'x' });
    expect(made.out).not.toHaveProperty('parent');
  });

  it('suggest_edit sends a passage replaced, or text appended', async () => {
    const { call, sent } = await connect();
    const { out } = await call('suggest_edit', {
      page: 'deploys',
      reason: 'The day changed.',
      old_text: 'On Tuesdays.',
      new_text: 'On Mondays.',
    });
    expect(sent[0]!.body).toEqual({
      reason: 'The day changed.',
      before: 'On Tuesdays.',
      after: 'On Mondays.',
    });
    expect(out).toMatchObject({
      suggestion: 'sg_0000000001',
      page: 'deploys',
      title: 'Deploys',
      kind: 'replace',
      pending: 3,
    });
    expect(out.next).toContain('Nothing changed yet');
    await call('suggest_edit', { page: 'deploys', reason: 'Missing.', new_text: 'More.' });
    expect(sent[1]!.body).toEqual({ reason: 'Missing.', after: 'More.' });
  });

  it('suggest_edit refuses a suggestion over the size before asking the api', async () => {
    const { call, sent } = await connect();
    const { isError, text } = await call('suggest_edit', {
      page: 'deploys',
      reason: 'Why.',
      old_text: 'a'.repeat(10_000),
      new_text: 'b'.repeat(10_000),
    });
    expect(isError).toBe(true);
    expect(text).toContain('at most 20000 characters');
    expect(text).toContain('this one is 20004');
    expect(sent).toEqual([]);
  });

  it('write_page sends the Markdown and the mode, and answers the new revision', async () => {
    const { call, sent } = await connect();
    const { out } = await call('write_page', { page: 'deploys', markdown: 'New.', mode: 'append' });
    expect(sent[0]!.body).toEqual({ markdown: 'New.', mode: 'append' });
    expect(out).toMatchObject({ page: 'deploys', rev: 8, lines: ['Wrote the article.'] });
    await call('write_page', { page: 'deploys', markdown: 'New.' });
    expect(sent[1]!.body).toEqual({ markdown: 'New.' });
  });

  it('write_page sets a cover alone, with the writing, or takes it away (page-surface.md "The cover")', async () => {
    const { call, sent } = await connect();
    const { out } = await call('write_page', {
      page: 'deploys',
      cover: { imageId: 'img_1', focus: 30 },
    });
    expect(sent[0]!.body).toEqual({ cover: { imageId: 'img_1', focus: 30 } });
    expect(out.next).toContain('The cover changed');
    await call('write_page', { page: 'deploys', markdown: 'New.', cover: { gradient: 'Ocean' } });
    expect(sent[1]!.body).toEqual({ markdown: 'New.', cover: { gradient: 'Ocean' } });
    await call('write_page', { page: 'deploys', cover: null });
    expect(sent[2]!.body).toEqual({ cover: null });
    // A gradient that is not one is refused before anything is sent.
    const bad = await call('write_page', { page: 'deploys', cover: { gradient: 'Plaid' } });
    expect(bad.isError).toBe(true);
    expect(sent).toHaveLength(3);
  });

  it('write_page is refused on a verified page, and without the write scope, in the api’s words', async () => {
    const verified = await connect({
      'PUT /pages/deploys': refuse(
        409,
        'page_verified',
        'This page is verified, so an agent does not rewrite it. Suggest the change instead (suggest_edit).',
      ),
    });
    const first = await verified.call('write_page', { page: 'deploys', markdown: 'x' });
    expect(first.isError).toBe(true);
    expect(first.text).toContain('suggest_edit');
    expect(first.text).toContain('This page is verified');
    const scoped = await connect({
      'PUT /pages/deploys': refuse(
        403,
        'scope_needed',
        'This connection holds the read and suggest scopes here. Use suggest_edit.',
      ),
    });
    const second = await scoped.call('write_page', { page: 'deploys', markdown: 'x' });
    expect(second.isError).toBe(true);
    expect(second.text).toBe(
      'This connection holds the read and suggest scopes here. Use suggest_edit.',
    );
  });

  it('a read-only connection is told so', async () => {
    const { call } = await connect({
      'POST /pages': () => Response.json({ error: 'read_only_token' }, { status: 403 }),
    });
    const { isError, text } = await call('create_page', { title: 'T', markdown: 'x' });
    expect(isError).toBe(true);
    expect(text).toContain('read-only');
  });

  it('move_page says the top level as null, and leaves the parent to "before" when it is given alone', async () => {
    const { call, sent } = await connect();
    await call('move_page', { page: 'rollbacks' });
    await call('move_page', { page: 'rollbacks', parent: 'Operations', before: 'deploys' });
    await call('move_page', { page: 'rollbacks', before: 'holidays' });
    expect(sent.map((s) => s.body)).toEqual([
      { parent: null },
      { parent: 'Operations', before: 'deploys' },
      { before: 'holidays' },
    ]);
  });

  it('report_gap records the question', async () => {
    const { call, sent } = await connect();
    const { out } = await call('report_gap', { question: 'Who is on call?' });
    expect(sent[0]!.body).toEqual({ question: 'Who is on call?' });
    expect(out.recorded).toBe(true);
  });
});

describe('what an answer costs', () => {
  it('keeps a default read, search and list small', async () => {
    const { call } = await connect();
    const sizes = {
      read_page: (await call('read_page', { page: 'deploys' })).text.length,
      search_pages: (await call('search_pages', { query: 'q' })).text.length,
      list_pages: (await call('list_pages', {})).text.length,
    };
    // One-line JSON; a passage is at most 1,200 characters and a default read 6,000.
    expect(sizes.read_page).toBeLessThan(1500);
    expect(sizes.search_pages).toBeLessThan(700);
    expect(sizes.list_pages).toBeLessThan(1200);
  });

  it('describes every argument and output field', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const undescribed: string[] = [];
    for (const tool of tools) {
      for (const schema of [tool.inputSchema, tool.outputSchema]) {
        const props = (schema?.properties ?? {}) as Record<string, { description?: string }>;
        for (const [key, value] of Object.entries(props))
          if (!value.description) undescribed.push(`${tool.name}.${key}`);
      }
    }
    expect(undescribed).toEqual([]);
  });
});
