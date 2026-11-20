import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CreatePageResponse,
  KnowledgeAgentContextResponse,
  KnowledgeOverviewResponse,
  KnowledgePageReadResponse,
  KnowledgePagesResponse,
  KnowledgeSearchResponse,
  MovePageResponse,
} from '@liveknowledge/api-schema';
import { knowledgeKit, TOKEN_ID, type Kit, type Who } from './knowledge-test-kit';

// The knowledgebase as an agent reads and shapes it (docs/specs/024-agents/knowledgebase-for-agents.md): the page
// tree, a page as Markdown, the context, a new page, a move, and what each scope and share role may do.

let kit: Kit;
beforeEach(async () => {
  kit = await knowledgeKit();
});

const get = async <T>(who: Who, path: string) =>
  await (await kit.call(who, 'GET', `/api/documents/kb/${path}`)).json<T>();
const pagesOf = async (who: Who = 'editor') =>
  (await get<KnowledgePagesResponse>(who, 'pages')).pages;
const read = async (tab: string, query = '', who: Who = 'editor') =>
  (await get<KnowledgePageReadResponse>(who, `pages/${tab}${query}`)).page;
const verify = (tab: string) => kit.call('editor', 'POST', `/api/documents/kb/pages/${tab}/verify`);
const grant = (scopes: string[], who: Who = 'editor') =>
  kit.call(who, 'PUT', `/api/documents/kb/agents/${TOKEN_ID}/scopes`, { scopes });
const write = (who: Who, tab = 'holidays') =>
  kit.call(who, 'POST', `/api/documents/kb/tabs/${tab}/pages`, {
    article: { markdown: 'Everyone takes the first week of January off.' },
  });

describe('GET pages', () => {
  it('lists the tree in order with each page’s trust', async () => {
    await verify('rollbacks');
    const pages = await pagesOf('viewer');
    expect(pages.map((p) => [p.tab, p.title, p.depth, p.subpages])).toEqual([
      ['deploys', 'Deploys', 1, 1],
      ['rollbacks', 'Rollbacks', 2, 0],
      ['holidays', 'Holidays', 1, 0],
    ]);
    expect(pages[0]!.trust).toEqual({ state: 'never-verified', stale: false });
    const rollbacks = pages[1]!;
    expect(rollbacks.parent).toBe('deploys');
    expect(rollbacks.owner).toBe('user_o');
    expect(rollbacks.trust).toMatchObject({ state: 'verified', stale: false });
    expect(rollbacks.trust.reviewAt).toBe(rollbacks.trust.verifiedAt! + 90 * 86_400_000);
  });

  it('marks a page whose review is due as stale, and names the pages it conflicts with', async () => {
    await verify('rollbacks');
    kit.db.sql
      .prepare(
        `UPDATE tabs SET data = json_set(data, '$.knowledge.verifiedAt', ?), rev = rev + 1 WHERE id = 'rollbacks'`,
      )
      .run(Date.now() - 91 * 86_400_000);
    kit.db.sql
      .prepare(
        `INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, found_at, state)
         VALUES ('c1', 'When do we deploy?', 'p1', 'deploys', 'h1', 'p2', 'holidays', 'h2', 1, 'open')`,
      )
      .run();
    const pages = await pagesOf();
    expect(pages[1]!.trust).toMatchObject({ state: 'review-due', stale: true });
    expect(pages[0]!.trust.conflictsWith).toEqual([{ tab: 'holidays', title: 'Holidays' }]);
    expect(pages[2]!.trust.conflictsWith).toEqual([{ tab: 'deploys', title: 'Deploys' }]);
    expect((await read('deploys')).trust.conflictsWith).toEqual([
      { tab: 'holidays', title: 'Holidays' },
    ]);
  });

  it('is closed to a stranger and to a link confined to one page', async () => {
    expect((await kit.call('stranger', 'GET', '/api/documents/kb/pages')).status).toBe(403);
    expect((await kit.call('page-link', 'GET', '/api/documents/kb/pages')).status).toBe(403);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/pages')).status).toBe(405);
  });
});

describe('GET pages/<tab>', () => {
  it('answers the page as Markdown with its backlinks, subpages and trust', async () => {
    await verify('deploys');
    const page = await read('deploys');
    expect(page).toMatchObject({ tab: 'deploys', title: 'Deploys', leftOut: 0 });
    expect(page.markdown).toContain('# When we deploy');
    expect(page.markdown).toContain('See [[Rollbacks]] when one fails.');
    expect(page.chars).toBe(page.markdown.length);
    expect(page.headings).toEqual(['When we deploy']);
    expect(page.subpages).toEqual([{ tab: 'rollbacks', title: 'Rollbacks' }]);
    expect(page.trust.state).toBe('verified');
    const linked = await read('rollbacks');
    expect(linked.parent).toBe('deploys');
    expect(linked.backlinks).toEqual([{ tab: 'deploys', title: 'Deploys' }]);
  });

  it('shows a page link by the linked page’s current title', async () => {
    const renamed = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/rollbacks/name', {
      name: 'Rolling Back',
    });
    expect(renamed.status).toBe(200);
    expect((await read('deploys')).markdown).toContain('See [[Rolling Back]] when one fails.');
  });

  it('answers one heading’s section, or a first part, and says what was left out', async () => {
    const whole = await read('deploys');
    const section = await read('deploys', '?heading=when%20we%20deploy');
    expect(section.markdown.startsWith('# When we deploy')).toBe(true);
    expect(section.leftOut).toBe(whole.chars - section.markdown.length);
    const cut = await read('deploys', '?maxChars=40');
    expect(cut.markdown.length).toBeLessThanOrEqual(40);
    expect(cut.leftOut).toBe(whole.chars - cut.markdown.length);
    expect(cut.headings).toEqual(['When we deploy']);
  });

  it('refuses a heading the page lacks by naming the ones it has, and a bad maxChars', async () => {
    const res = await kit.call('editor', 'GET', '/api/documents/kb/pages/deploys?heading=Nope');
    expect(res.status).toBe(400);
    const answer = await res.json<{ error: string; message: string }>();
    expect(answer.error).toBe('heading_unknown');
    expect(answer.message).toContain('"When we deploy"');
    const none = await kit.call('editor', 'GET', '/api/documents/kb/pages/holidays?heading=Nope');
    expect((await none.json<{ message: string }>()).message).toContain('no headings');
    for (const bad of ['0', 'abc', '1.5'])
      expect(
        (await kit.call('editor', 'GET', `/api/documents/kb/pages/deploys?maxChars=${bad}`)).status,
      ).toBe(400);
  });

  it('counts an agent’s read under its name', async () => {
    await read('deploys', '', 'agent-stored');
    await read('deploys', '', 'agent-read-only');
    const overview = await get<KnowledgeOverviewResponse>('editor', 'knowledge');
    expect(overview.agents).toEqual([
      { name: 'Coding Agent', readsThisWeek: 2, topPages: [{ tab: 'deploys', title: 'Deploys' }] },
    ]);
  });

  it('keeps a link confined to one page on that page', async () => {
    expect((await kit.call('page-link', 'GET', '/api/documents/kb/pages/holidays')).status).toBe(
      200,
    );
    expect((await kit.call('page-link', 'GET', '/api/documents/kb/pages/deploys')).status).toBe(
      404,
    );
    expect((await kit.call('editor', 'GET', '/api/documents/kb/pages/nope')).status).toBe(404);
    expect((await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys')).status).toBe(405);
  });
});

describe('search for an agent', () => {
  it('carries the passage whole and when its page’s review is due', async () => {
    await verify('deploys');
    const { results } = await get<KnowledgeSearchResponse>('agent-stored', 'search?q=tuesdays');
    const passage = results.find((r) => !r.isTitle)!;
    expect(passage.text).toContain('Deploys go out on Tuesdays');
    expect(passage.reviewAt).toBe(passage.verifiedAt! + 90 * 86_400_000);
    // A person's results are as they were.
    const mine = await get<KnowledgeSearchResponse>('editor', 'search?q=tuesdays');
    expect(mine.results.find((r) => !r.isTitle)).not.toHaveProperty('text');
  });

  it('names the pages a passage conflicts with', async () => {
    const { results } = await get<KnowledgeSearchResponse>('agent-stored', 'search?q=tuesdays');
    const passage = results.find((r) => !r.isTitle)!;
    kit.db.sql
      .prepare(
        `INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, found_at, state)
         VALUES ('c1', 'When?', ?, 'deploys', 'h1', 'p2', 'holidays', 'h2', 1, 'open')`,
      )
      .run(passage.id);
    const again = await get<KnowledgeSearchResponse>('agent-stored', 'search?q=tuesdays');
    expect(again.results.find((r) => r.id === passage.id)!.conflictsWith).toEqual([
      { tab: 'holidays', title: 'Holidays' },
    ]);
  });
});

describe('GET context', () => {
  const mark = (tab: string) =>
    kit.call('editor', 'PUT', `/api/documents/kb/pages/${tab}/knowledge`, { context: true });

  it('hands over the Always in Context pages in tree order, with what the caller may do', async () => {
    await mark('holidays');
    await mark('rollbacks');
    const context = await get<KnowledgeAgentContextResponse>('agent-stored', 'context');
    expect(context).toMatchObject({
      name: 'Handbook',
      role: 'participate',
      scopes: ['read', 'suggest'],
      budget: 8000,
      pageCount: 3,
      leftOut: [],
    });
    expect(context.pages.map((p) => p.tab)).toEqual(['rollbacks', 'holidays']);
    expect(context.pages[1]!.markdown).toContain('last week of December');
    expect(context.pages[0]!.trust.state).toBe('never-verified');
    expect(context.tokens).toBe(context.pages.reduce((sum, p) => sum + p.tokens, 0));
    // Handing a page to an agent is a read of it.
    const overview = await get<KnowledgeOverviewResponse>('editor', 'knowledge');
    expect(overview.agents[0]).toMatchObject({ name: 'Coding Agent', readsThisWeek: 2 });
  });

  it.each<[Who, string, string[]]>([
    ['editor', 'edit', ['read', 'suggest', 'write']],
    ['participant', 'participate', ['read', 'suggest']],
    ['viewer', 'view', ['read']],
    ['agent', 'edit', ['read', 'suggest', 'write']],
    ['agent-read-only', 'view', ['read']],
    ['participant-agent', 'participate', ['read', 'suggest']],
    ['viewer-agent', 'view', ['read']],
  ])('tells %s it acts as %s', async (who, role, scopes) => {
    const context = await get<KnowledgeAgentContextResponse>(who, 'context');
    expect(context.role).toBe(role);
    expect(context.scopes).toEqual(scopes);
    expect(context.pages).toEqual([]);
  });
});

describe('POST pages', () => {
  const create = (
    who: Who,
    body: unknown = { title: 'Hotfixes', markdown: 'Any day. See [[Deploys]].' },
  ) => kit.call(who, 'POST', '/api/documents/kb/pages', body);

  it('makes a page from Markdown under a parent, never verified', async () => {
    const res = await create('agent-stored', {
      title: 'Hotfixes',
      markdown: 'Any day. See [[Deploys]].',
      parent: 'deploys',
    });
    expect(res.status).toBe(201);
    const { page } = await res.json<CreatePageResponse>();
    expect(page).toMatchObject({ title: 'Hotfixes', parent: 'deploys' });
    const rows = await pagesOf();
    expect(rows.map((p) => p.title)).toEqual(['Deploys', 'Rollbacks', 'Hotfixes', 'Holidays']);
    expect(rows.find((p) => p.tab === page.tab)).toMatchObject({
      depth: 2,
      trust: { state: 'never-verified', stale: false },
    });
    const made = await read(page.tab);
    expect(made.markdown).toContain('title: Hotfixes');
    expect(made.markdown).toContain('Any day. See [[Deploys]].');
    expect((await read('deploys')).backlinks.map((b) => b.tab)).toContain(page.tab);
  });

  it('makes an empty page when no Markdown is sent', async () => {
    const res = await create('editor', { title: 'Later' });
    expect(res.status).toBe(201);
    const { page } = await res.json<CreatePageResponse>();
    expect((await read(page.tab)).markdown.trim()).toBe('');
  });

  it.each<[Who, number]>([
    ['editor', 201],
    ['agent', 201],
    ['agent-stored', 201],
    ['participant', 403],
    ['participant-agent', 403],
    ['viewer', 403],
    ['viewer-agent', 403],
    ['agent-read-only', 403],
    ['stranger', 403],
  ])('as %s answers %i', async (who, status) => {
    expect((await create(who)).status).toBe(status);
  });

  it('refuses a page with no title, a parent that is no page, and one too deep', async () => {
    expect(
      (await (await create('editor', { markdown: 'x' })).json<{ error: string }>()).error,
    ).toBe('no_title');
    expect((await create('editor', { title: 'A', markdown: 7 })).status).toBe(400);
    expect((await create('editor', { title: 'A', parent: 7 })).status).toBe(400);
    const res = await create('editor', { title: 'A', parent: 'nope' });
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toBe('unknown_page');
  });
});

describe('POST pages/<tab>/move', () => {
  const move = (who: Who, tab: string, body: unknown) =>
    kit.call(who, 'POST', `/api/documents/kb/pages/${tab}/move`, body);

  it('moves a page under another, and to the top in front of a page', async () => {
    const res = await move('editor', 'holidays', { parent: 'rollbacks' });
    expect(res.status).toBe(200);
    expect((await res.json<MovePageResponse>()).page).toEqual({
      tab: 'holidays',
      title: 'Holidays',
      parent: 'rollbacks',
      depth: 3,
    });
    expect((await pagesOf()).map((p) => [p.tab, p.depth])).toEqual([
      ['deploys', 1],
      ['rollbacks', 2],
      ['holidays', 3],
    ]);
    expect((await move('editor', 'holidays', { parent: null, before: 'deploys' })).status).toBe(
      200,
    );
    expect((await pagesOf()).map((p) => [p.tab, p.depth])).toEqual([
      ['holidays', 1],
      ['deploys', 1],
      ['rollbacks', 2],
    ]);
    // Already there: answered, nothing written.
    expect((await move('editor', 'holidays', { parent: null, before: 'deploys' })).status).toBe(
      200,
    );
  });

  it('refuses a page under its own subpage, an unknown parent and a bad body', async () => {
    const own = await move('editor', 'deploys', { parent: 'rollbacks' });
    expect(own.status).toBe(409);
    expect((await own.json<{ error: string }>()).error).toBe('own_subtree');
    expect((await move('editor', 'deploys', { parent: 'nope' })).status).toBe(409);
    expect((await move('editor', 'deploys', { parent: 7 })).status).toBe(400);
    expect((await move('editor', 'deploys', { before: 7 })).status).toBe(400);
    expect((await move('editor', 'holidays', { parent: null, before: 'rollbacks' })).status).toBe(
      400,
    );
    expect((await move('editor', 'deploys', [])).status).toBe(400);
    expect((await move('editor', 'nope', { parent: null })).status).toBe(404);
    expect((await kit.call('editor', 'GET', '/api/documents/kb/pages/deploys/move')).status).toBe(
      405,
    );
  });

  it.each<[Who, number]>([
    ['editor', 200],
    ['agent', 200],
    ['agent-stored', 403],
    ['participant', 403],
    ['participant-agent', 403],
    ['viewer-agent', 403],
  ])('as %s answers %i', async (who, status) => {
    expect((await move(who, 'holidays', { parent: 'deploys' })).status).toBe(status);
  });
});

describe('scopes', () => {
  it('holds a new connection to read and suggest: a direct write is refused in words', async () => {
    const res = await write('agent-stored');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: 'scope_needed',
      needs: 'write',
      scopes: ['read', 'suggest'],
    });
    expect((await read('holidays')).markdown).toContain('December');
  });

  it('lets an Editor grant write, in person only', async () => {
    expect((await grant(['write'], 'agent')).status).toBe(403);
    expect((await grant(['write'], 'participant')).status).toBe(403);
    expect((await grant(['admin'])).status).toBe(400);
    const res = await grant(['suggest', 'write']);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tokenId: TOKEN_ID, scopes: ['read', 'suggest', 'write'] });
    expect((await write('agent-stored')).status).toBe(200);
    expect((await read('holidays')).markdown).toContain('January');
    expect(
      (await kit.call('editor', 'GET', `/api/documents/kb/agents/${TOKEN_ID}/scopes`)).status,
    ).toBe(405);
  });

  it('never lets a Participant’s or a Viewer’s agent write, whatever is granted', async () => {
    await grant(['suggest', 'write']);
    expect((await write('participant-agent')).status).toBe(403);
    expect((await write('viewer-agent')).status).toBe(403);
    expect((await write('agent-read-only')).status).toBe(403);
    const context = await get<KnowledgeAgentContextResponse>('participant-agent', 'context');
    expect(context.scopes).toEqual(['read', 'suggest']);
  });

  it('takes suggest away when an Editor grants read alone', async () => {
    await grant(['read']);
    const res = await kit.call(
      'agent-stored',
      'POST',
      '/api/documents/kb/pages/deploys/suggestions',
      {
        reason: 'Why.',
        after: 'More.',
      },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'scope_needed', needs: 'suggest' });
  });

  it('refuses an agent’s write to a verified page, and takes it on one never verified', async () => {
    await verify('holidays');
    const res = await write('agent');
    expect(res.status).toBe(409);
    const answer = await res.json<{ error: string; message: string }>();
    expect(answer.error).toBe('page_verified');
    expect(answer.message).toContain('suggest_edit');
    expect((await read('holidays')).markdown).toContain('December');
    expect((await write('agent', 'rollbacks')).status).toBe(200);
  });
});
