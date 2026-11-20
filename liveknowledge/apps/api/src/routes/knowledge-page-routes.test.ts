import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeKit, OWNER, page, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/verification.md and ai-knowledge.md "Always in Context".
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

type Health = {
  knowledge: {
    owner?: string;
    verifiedAt?: number;
    verifiedBy?: string;
    reviewEvery?: number | 'never';
    context?: true;
    state: string;
    reviewAt?: number;
    changedSinceVerified: boolean;
    tokens: number;
  };
  reads?: { people: number; agents: number };
};
const read = async (kit: Kit, who: Who = 'viewer', tab = 'deploys') =>
  await (await kit.call(who, 'GET', `/api/documents/kb/pages/${tab}/health`)).json<Health>();
const stored = (kit: Kit, tab = 'deploys') =>
  JSON.parse(
    (kit.db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get(tab) as { data: string }).data,
  ) as { knowledge?: object };
const DAY = 86_400_000;

describe('POST pages/:tab/verify', () => {
  it('verifies now, by the Editor, who owns a page with no owner; every role then sees it', async () => {
    const kit = await knowledgeKit();
    const rev = () =>
      (kit.db.sql.prepare("SELECT rev FROM tabs WHERE id = 'deploys'").get() as { rev: number })
        .rev;
    const before = rev();
    const res = await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    expect(res.status).toBe(200);
    const { knowledge } = await res.json<Health>();
    expect(knowledge).toMatchObject({
      owner: OWNER,
      verifiedBy: OWNER,
      state: 'verified',
      changedSinceVerified: false,
    });
    expect(knowledge.reviewAt).toBe(knowledge.verifiedAt! + 90 * DAY);
    expect(stored(kit).knowledge).toEqual({
      owner: OWNER,
      verifiedAt: knowledge.verifiedAt,
      verifiedBy: OWNER,
    });
    // The tab's revision advances, as a rename's does, and search reads the page as verified.
    expect(rev()).toBe(before + 1);
    expect(
      kit.db.sql
        .prepare("SELECT verified_at, review_days FROM page_trust WHERE tab = 'deploys'")
        .get(),
    ).toEqual({ verified_at: knowledge.verifiedAt, review_days: 90 });
    for (const who of ['participant', 'viewer', 'link'] as const)
      expect((await read(kit, who)).knowledge.state).toBe('verified');
  });

  it("rides the tab summaries, so the page tree shows every page's state from one read", async () => {
    const kit = await knowledgeKit();
    type Summaries = { document: { tabs: { id: string; knowledge?: object }[] } };
    const summaries = async () =>
      (await (await kit.call('viewer', 'GET', '/api/documents/kb')).json<Summaries>()).document
        .tabs;
    expect((await summaries()).every((tab) => !Object.hasOwn(tab, 'knowledge'))).toBe(true);
    const res = await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    const { knowledge } = await res.json<Health>();
    const after = await summaries();
    expect(after.find((tab) => tab.id === 'deploys')?.knowledge).toEqual({
      owner: OWNER,
      verifiedAt: knowledge.verifiedAt,
      verifiedBy: OWNER,
    });
    expect(after.filter((tab) => Object.hasOwn(tab, 'knowledge'))).toHaveLength(1);
  });

  it.each(['participant', 'viewer', 'link', 'page-link', 'stranger'] as const)(
    'is refused for %s, who changes nothing',
    async (who) => {
      const kit = await knowledgeKit();
      const res = await kit.call(who, 'POST', '/api/documents/kb/pages/holidays/verify');
      expect(res.status).toBe(403);
      expect(stored(kit, 'holidays').knowledge).toBeUndefined();
    },
  );

  it('comes due when the interval passes, with nothing written, and never for a page that does not age', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const kit = await knowledgeKit();
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
    await kit.call('editor', 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
      reviewEvery: 'never',
    });
    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));
    expect((await read(kit)).knowledge.state).toBe('review-due');
    const never = (await read(kit, 'viewer', 'holidays')).knowledge;
    expect([never.state, never.reviewAt]).toEqual(['verified', undefined]);
    const summary = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/summary')
    ).json<{
      health: object;
    }>();
    expect(summary.health).toEqual({ verified: 1, reviewDue: 1, neverVerified: 1, total: 3 });
  });

  it('says Changed since verified once more than a fifth of the writing changed, until verified again', async () => {
    const kit = await knowledgeKit();
    const lines = Array.from({ length: 10 }, (_, i) => `Step ${i} of the release is written here.`);
    const write = (text: string[]) =>
      kit.call(
        'editor',
        'PUT',
        '/api/documents/kb/tabs/holidays',
        page('holidays', 'Holidays', [
          { id: 'b1', type: 'paragraph', runs: [{ text: text.join('\n') }] },
        ]),
      );
    await write(lines);
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
    // An editor's own save carries no fields (it may not have heard of the Verify): what is stored stays.
    const save = write;
    await save([...lines.slice(0, 9), 'One line reads differently now.']);
    expect((await read(kit, 'viewer', 'holidays')).knowledge.changedSinceVerified).toBe(false);
    await save([...lines.slice(0, 6), 'A.', 'B.', 'C.', 'Four lines read differently now.']);
    const changed = (await read(kit, 'viewer', 'holidays')).knowledge;
    expect([changed.state, changed.changedSinceVerified]).toEqual(['verified', true]);
    // Nor can a save forge a verification.
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/deploys', {
      ...page('deploys', 'Deploys', []),
      knowledge: { verifiedAt: 1, verifiedBy: 'user_someone', owner: 'user_someone' },
    });
    expect(stored(kit, 'deploys').knowledge).toBeUndefined();
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
    expect((await read(kit, 'viewer', 'holidays')).knowledge.changedSinceVerified).toBe(false);
    // What is kept is a print of the sentences, never the words.
    const print = (
      kit.db.sql
        .prepare("SELECT verified_print AS p FROM knowledge_pages WHERE tab = 'holidays'")
        .get() as {
        p: string;
      }
    ).p;
    expect(print).not.toMatch(/release|differently/);
    expect(print.length).toBeLessThan(200);
  });
});

describe('PUT pages/:tab/knowledge', () => {
  it('sets the owner, the interval and Always in Context for an Editor', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: OWNER,
      reviewEvery: 30,
      context: true,
    });
    expect(res.status).toBe(200);
    expect(stored(kit).knowledge).toEqual({ owner: OWNER, reviewEvery: 30, context: true });
    const cleared = await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: null,
      context: false,
      reviewEvery: 90,
    });
    expect((await cleared.json<Health>()).knowledge).toMatchObject({ state: 'never-verified' });
    expect(stored(kit).knowledge).toEqual({ reviewEvery: 90 });
  });

  it.each(['participant', 'viewer', 'link', 'page-link', 'stranger'] as const)(
    'is refused for %s',
    async (who) => {
      const kit = await knowledgeKit();
      const res = await kit.call(who, 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
        reviewEvery: 30,
      });
      expect(res.status).toBe(403);
      expect(stored(kit, 'holidays').knowledge).toBeUndefined();
    },
  );

  it('takes only an owner who can open the knowledgebase, and only the listed values', async () => {
    const kit = await knowledgeKit();
    const put = (body: unknown) =>
      kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', body);
    const error = async (body: unknown) => {
      const res = await put(body);
      return [res.status, (await res.json<{ error: string }>()).error];
    };
    expect(await error({ owner: 'user_x' })).toEqual([400, 'owner_no_access']);
    expect(await error({ owner: '' })).toEqual([400, 'invalid_owner']);
    expect(await error({ reviewEvery: 45 })).toEqual([400, 'invalid_review_every']);
    expect(await error({ context: 'yes' })).toEqual([400, 'invalid_context']);
    expect(await error({})).toEqual([400, 'invalid_body']);
    expect(await error([1])).toEqual([400, 'invalid_body']);
    expect(stored(kit).knowledge).toBeUndefined();
  });

  it('refuses a page that would pass the Always in Context budget, and says by how much', async () => {
    const kit = await knowledgeKit();
    // 8,000 tokens is 32,000 characters: one page of 20,000 fits, a second does not.
    const long = (id: string) =>
      kit.call(
        'editor',
        'PUT',
        `/api/documents/kb/tabs/${id}`,
        page(
          id,
          id,
          Array.from({ length: 20 }, (_, i) => ({
            id: `b${i}`,
            type: 'paragraph',
            runs: [{ text: 'word '.repeat(200) }],
          })),
        ),
      );
    await long('first');
    await long('second');
    const mark = (id: string) =>
      kit.call('editor', 'PUT', `/api/documents/kb/pages/${id}/knowledge`, { context: true });
    expect((await mark('first')).status).toBe(200);
    const over = await mark('second');
    expect(over.status).toBe(409);
    expect(await over.json()).toMatchObject({ error: 'context_budget', budget: 8000 });
    expect(stored(kit, 'second').knowledge).toBeUndefined();
    // A small page still fits what is left.
    expect((await mark('holidays')).status).toBe(200);
  });
});

describe('GET pages/:tab/health', () => {
  it("answers the week's reads by people and by agents", async () => {
    const kit = await knowledgeKit();
    await kit.call('viewer', 'GET', '/api/documents/kb/tabs/deploys');
    await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
    await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
    const health = await read(kit, 'participant');
    expect(health.reads).toEqual({ people: 1, agents: 2 });
    expect(health.knowledge.tokens).toBeGreaterThan(0);
    expect(
      (await kit.call('stranger', 'GET', '/api/documents/kb/pages/deploys/health')).status,
    ).toBe(403);
  });
});
