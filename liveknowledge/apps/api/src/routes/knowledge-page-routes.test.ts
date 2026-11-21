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
    context?: true;
    state: string;
    reviewAt?: number;
    changedSinceVerified: boolean;
    tokens: number;
  };
  reads?: { people: number; agents: number };
  created?: { by: string; at: number; kind: string };
  updated?: { by: string; at: number; kind: string };
  editors?: { by: string; at: number; kind: string }[];
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
      kit.db.sql.prepare("SELECT verified_at FROM page_trust WHERE tab = 'deploys'").get(),
    ).toEqual({ verified_at: knowledge.verifiedAt });
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

  it('lets a Participant verify, as an Editor does', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('participant', 'POST', '/api/documents/kb/pages/holidays/verify');
    expect(res.status).toBe(200);
    expect(stored(kit, 'holidays').knowledge).toBeDefined();
  });

  it.each(['viewer', 'link', 'page-link', 'stranger'] as const)(
    'is refused for %s, who changes nothing',
    async (who) => {
      const kit = await knowledgeKit();
      const res = await kit.call(who, 'POST', '/api/documents/kb/pages/holidays/verify');
      expect(res.status).toBe(403);
      expect(stored(kit, 'holidays').knowledge).toBeUndefined();
    },
  );

  it("comes due when the knowledgebase's Review Period passes, with nothing written, and never under Never", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const kit = await knowledgeKit();
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
    vi.setSystemTime(new Date('2026-04-02T00:00:00Z'));
    const summary = async () =>
      await (
        await kit.call('viewer', 'GET', '/api/documents/kb/summary')
      ).json<{ health: object; reviewEvery: unknown }>();
    expect((await read(kit)).knowledge.state).toBe('review-due');
    expect(await summary()).toMatchObject({
      reviewEvery: 90,
      health: { verified: 0, reviewDue: 2, neverVerified: 1, total: 3 },
    });
    await kit.call('editor', 'PUT', '/api/documents/kb/knowledge-settings', {
      reviewEvery: 'never',
    });
    const never = (await read(kit, 'viewer', 'holidays')).knowledge;
    expect([never.state, never.reviewAt]).toEqual(['verified', undefined]);
    expect(await summary()).toMatchObject({
      reviewEvery: 'never',
      health: { verified: 2, reviewDue: 0, neverVerified: 1, total: 3 },
    });
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
  it('sets the owner and Always in Context for an Editor', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: OWNER,
      context: true,
    });
    expect(res.status).toBe(200);
    expect(stored(kit).knowledge).toEqual({ owner: OWNER, context: true });
    const cleared = await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: null,
      context: false,
    });
    expect((await cleared.json<Health>()).knowledge).toMatchObject({ state: 'never-verified' });
    expect(stored(kit).knowledge).toBeUndefined();
  });

  it('lets a Participant set Always in Context, as an Editor does', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('participant', 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
      context: true,
    });
    expect(res.status).toBe(200);
    expect(stored(kit, 'holidays').knowledge).toBeDefined();
  });

  it.each(['viewer', 'link', 'page-link', 'stranger'] as const)(
    'is refused for %s',
    async (who) => {
      const kit = await knowledgeKit();
      const res = await kit.call(who, 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
        context: true,
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
    // A page has no review period of its own: the refusal says where the setting lives.
    for (const body of [{ reviewEvery: 30 }, { owner: OWNER, reviewEvery: 'never' }]) {
      const res = await put(body);
      const refusal = await res.json<{ error: string; message: string }>();
      expect([res.status, refusal.error]).toEqual([400, 'review_period_is_the_knowledgebases']);
      expect(refusal.message).toContain('/knowledge-settings');
    }
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
    // Refused: Always in Context is not set; the page keeps only the owner its save gave it.
    expect(stored(kit, 'second').knowledge).toEqual({ owner: OWNER });
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

describe('Created and Updated (verification.md)', () => {
  it("makes a new page's creator its owner, and says who created and last updated each page", async () => {
    const kit = await knowledgeKit();
    const save = (id: string, text: string) =>
      kit.call('editor', 'PUT', `/api/documents/kb/tabs/${id}`, {
        ...page(id, 'Fresh', [{ id: 'p1', type: 'paragraph', runs: [{ text }] }]),
      });
    // The knowledgebase's own pages, made with it by its creator (the editor names the owner in what it seeds).
    const seeded = await read(kit);
    expect(seeded.created?.by).toBe(OWNER);
    expect(seeded.updated).toEqual(seeded.created);
    // A page from before the table: nothing guessed.
    kit.db.sql.prepare("DELETE FROM page_authors WHERE tab = 'deploys'").run();
    expect((await read(kit)).created).toBeUndefined();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    expect((await save('fresh', 'One')).status).toBeLessThan(300);
    const made = await read(kit, 'viewer', 'fresh');
    expect(made.knowledge.owner).toBe(OWNER);
    expect(made.created).toEqual({ by: OWNER, at: 1_000_000, kind: 'human' });
    expect(made.updated).toEqual({ by: OWNER, at: 1_000_000, kind: 'human' });

    vi.setSystemTime(2_000_000);
    expect((await save('fresh', 'One and two')).status).toBeLessThan(300);
    const later = await read(kit, 'viewer', 'fresh');
    expect(later.created).toEqual({ by: OWNER, at: 1_000_000, kind: 'human' });
    expect(later.updated).toEqual({ by: OWNER, at: 2_000_000, kind: 'human' });
    // Everyone who made or changed it, the first writer first, each person once (page-surface.md "Who made the page").
    expect(later.editors).toEqual([{ by: OWNER, at: 1_000_000, kind: 'human' }]);
    vi.setSystemTime(3_000_000);
    const byParticipant = await kit.call('participant', 'PUT', '/api/documents/kb/tabs/fresh', {
      ...page('fresh', 'Fresh', [{ id: 'p1', type: 'paragraph', runs: [{ text: 'Three' }] }]),
    });
    expect(byParticipant.status).toBeLessThan(300);
    expect((await read(kit, 'viewer', 'fresh')).editors).toEqual([
      { by: OWNER, at: 1_000_000, kind: 'human' },
      { by: 'user_p', at: 3_000_000, kind: 'human' },
    ]);

    // A deleted page takes its row with it.
    await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/fresh');
    expect(
      kit.db.sql.prepare("SELECT tab FROM page_authors WHERE tab = 'fresh'").get(),
    ).toBeUndefined();
    expect(
      kit.db.sql.prepare("SELECT tab FROM page_editors WHERE tab = 'fresh'").get(),
    ).toBeUndefined();
  });
});
