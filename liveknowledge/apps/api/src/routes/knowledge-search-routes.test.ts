import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { settleQueued } from '../knowledge/knowledge-index';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { knowledgeKit, page, PAGES, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/search-and-ask.md "Search", links-and-embeds.md "Backlinks",
// knowledgebase-home.md (the summary), insights.md "Reads".
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => vi.restoreAllMocks());

const count = (kit: Kit, sql: string, ...args: (string | number)[]) =>
  Number((kit.db.sql.prepare(sql).get(...args) as { n: number }).n);
const changes = (kit: Kit) => count(kit, 'SELECT total_changes() AS n');
const body = <T>(res: Response) => res.json<T>();
type Results = {
  results: { tab: string; isTitle: boolean; snippet: string; trust: string; titleMarked: string }[];
};

const EVERY_ROLE: Who[] = ['editor', 'participant', 'viewer', 'link'];

describe('the index, kept in step with the pages', () => {
  it('indexes a page in the transaction that stores it: passages, title row, links and trust', async () => {
    const kit = await knowledgeKit();
    // A heading and the blocks under it are one passage.
    expect(
      count(kit, "SELECT COUNT(*) AS n FROM passages WHERE tab = 'deploys' AND ordinal >= 0"),
    ).toBe(1);
    expect(count(kit, 'SELECT COUNT(*) AS n FROM passages WHERE ordinal = -1')).toBe(3);
    expect(kit.db.sql.prepare('SELECT from_tab, to_tab FROM page_links').all()).toEqual([
      { from_tab: 'deploys', to_tab: 'rollbacks' },
    ]);
    expect(count(kit, 'SELECT COUNT(*) AS n FROM page_trust')).toBe(3);
    expect(count(kit, 'SELECT COUNT(*) AS n FROM knowledge_dirty')).toBe(0);
  });

  it('rewrites nothing when a save did not change the writing', async () => {
    const kit = await knowledgeKit();
    // A save that moves a colour, not a word.
    const before = changes(kit);
    const same = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/holidays', {
      ...PAGES[2],
      backgroundColor: '#ffffff',
    });
    expect(same.status).toBe(200);
    const unchangedSave = changes(kit) - before;
    const changed = await kit.call(
      'editor',
      'PUT',
      '/api/documents/kb/tabs/holidays',
      page('holidays', 'Holidays', [
        {
          id: 'b1',
          type: 'paragraph',
          runs: [{ text: 'Everyone takes the first week of August off.' }],
        },
      ]),
    );
    expect(changed.status).toBe(200);
    const changedSave = changes(kit) - before - unchangedSave;
    console.info('[measured] rows changed by a save of a one-passage page', {
      unchangedSave,
      changedSave,
    });
    // The index's own writes are the difference: the mark and its removal for a save that changed no word.
    expect(changedSave).toBeGreaterThan(unchangedSave);
    expect(unchangedSave).toBeLessThanOrEqual(16);
    const found = await body<Results>(
      await kit.call('viewer', 'GET', '/api/documents/kb/search?q=august'),
    );
    expect(found.results.map((r) => r.tab)).toEqual(['holidays']);
    const gone = await body<Results>(
      await kit.call('viewer', 'GET', '/api/documents/kb/search?q=december'),
    );
    expect(gone.results).toEqual([]);
  });

  it('follows a rename and a delete', async () => {
    const kit = await knowledgeKit();
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/holidays/name', { name: 'Time Off' });
    const renamed = await body<Results>(
      await kit.call('viewer', 'GET', '/api/documents/kb/search?q=time+off'),
    );
    expect(renamed.results[0]).toMatchObject({ tab: 'holidays', isTitle: true });
    expect(
      (await kit.call('editor', 'DELETE', '/api/documents/kb/tabs/rollbacks')).status,
    ).toBeLessThan(300);
    expect(count(kit, "SELECT COUNT(*) AS n FROM passages WHERE tab = 'rollbacks'")).toBe(0);
    expect(count(kit, "SELECT COUNT(*) AS n FROM page_trust WHERE tab = 'rollbacks'")).toBe(0);
    // The link to it stays in the other page's writing: it shows as Deleted Page.
    expect(count(kit, "SELECT COUNT(*) AS n FROM page_links WHERE to_tab = 'rollbacks'")).toBe(1);
  });

  it('backfills tabs that predate the index a batch a turn, never all at once', async () => {
    const kit = await knowledgeKit();
    const sql = nodeItemSql(kit.db.sql);
    // As the schema step leaves a room whose tabs were stored before it: every page queued, nothing indexed.
    kit.db.sql
      .exec(`DELETE FROM passages_fts; DELETE FROM passages; DELETE FROM page_trust; DELETE FROM page_links;
      DELETE FROM knowledge_pages; INSERT INTO knowledge_dirty (tab, queued) SELECT id, 1 FROM tabs`);
    expect(settleQueued(sql, 2)).toMatchObject({ pages: 2, queued: 1 });
    expect(settleQueued(sql, 2)).toMatchObject({ pages: 1, queued: 0 });
    expect(count(kit, 'SELECT COUNT(*) AS n FROM page_trust')).toBe(3);
    const found = await body<Results>(
      await kit.call('viewer', 'GET', '/api/documents/kb/search?q=tuesdays'),
    );
    expect(found.results.map((r) => r.tab)).toEqual(['deploys']);
  });

  it('writes a bounded number of rows a passage for a changed page, and holds a 100,000 character page to its budget', async () => {
    const kit = await knowledgeKit();
    const sentence =
      'The release train leaves the station when every check has passed and not before. ';
    const blocks = Array.from({ length: 125 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: `${i} ${sentence.repeat(10)}` }],
    }));
    const big = page('big', 'Big', blocks);
    expect(JSON.stringify(blocks).length).toBeGreaterThan(100_000);
    const before = changes(kit);
    const t0 = cpuNowMs();
    const res = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/big', big);
    const cpu = cpuNowMs() - t0;
    expect(res.status).toBe(200);
    const written = changes(kit) - before;
    const passages = count(
      kit,
      "SELECT COUNT(*) AS n FROM passages WHERE tab = 'big' AND ordinal >= 0",
    );
    expect(passages).toBeGreaterThan(80);
    // The tab's own rows, then a row a passage and its search index entries (SQLite counts the index's own rows
    // too): a budget a row per word would not meet.
    console.info('[measured] a 100,000 character page', {
      passages,
      written,
      cpuMs: Math.round(cpu),
    });
    expect(written).toBeLessThan(passages * 4 + 40);
    // The whole save, index included (the spec's 50 ms is the indexing's share; passages.test.ts holds that alone).
    expect(cpu).toBeLessThan(cpuBudgetMs(400));
    // The same page saved again writes no passage.
    const again = changes(kit);
    await kit.call('editor', 'PUT', '/api/documents/kb/tabs/big', {
      ...big,
      backgroundColor: '#fff',
    });
    expect(changes(kit) - again).toBeLessThan(20);
  });
});

describe('GET search', () => {
  it.each(EVERY_ROLE)('answers %s, titles first, with the words marked', async (who) => {
    const kit = await knowledgeKit();
    const res = await kit.call(who, 'GET', '/api/documents/kb/search?q=deploy');
    expect(res.status).toBe(200);
    const { results } = await body<Results>(res);
    expect(results[0]).toMatchObject({ tab: 'deploys', isTitle: true, trust: 'never-verified' });
    expect(results[0]!.titleMarked).toBe('\u0002Deploys\u0003');
    // The stemmer finds "deploys" for "deploy" in another page's writing too.
    expect(results.map((r) => r.tab)).toContain('rollbacks');
    expect(results.every((r) => !('text' in r))).toBe(true);
  });

  it('refuses someone with no access, and shows a link confined to one page only that page', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('stranger', 'GET', '/api/documents/kb/search?q=deploy')).status).toBe(
      403,
    );
    const confined = await body<Results>(
      await kit.call('page-link', 'GET', '/api/documents/kb/search?q=deploy'),
    );
    expect(confined.results).toEqual([]);
    const own = await body<Results>(
      await kit.call('page-link', 'GET', '/api/documents/kb/search?q=december'),
    );
    expect(own.results.map((r) => r.tab)).toEqual(['holidays']);
  });

  it('bounds the query, reads operators as words and answers nothing for no words', async () => {
    const kit = await knowledgeKit();
    const long = await kit.call('viewer', 'GET', `/api/documents/kb/search?q=${'a'.repeat(201)}`);
    expect([long.status, await long.json()]).toEqual([
      400,
      { error: 'query_too_long', message: 'A search is at most 200 characters.' },
    ]);
    for (const q of ['"', 'NEAR(', 'text:', '*', '   ', ''])
      expect(
        await body<Results>(
          await kit.call('viewer', 'GET', `/api/documents/kb/search?q=${encodeURIComponent(q)}`),
        ),
      ).toEqual({ results: [] });
    const many = Array.from({ length: 30 }, (_, i) =>
      page(`p${i}`, `Deploy Notes ${i}`, [
        { id: 'b1', type: 'paragraph', runs: [{ text: 'A deploy note.' }] },
      ]),
    );
    const wide = await knowledgeKit({}, many);
    const all = await body<Results>(
      await wide.call('viewer', 'GET', '/api/documents/kb/search?q=deploy'),
    );
    expect(all.results).toHaveLength(20);
  });

  it('rate-limits a caller, by person or by token', async () => {
    const keys: string[] = [];
    const kit = await knowledgeKit({
      SEARCH_RATE_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: keys.length < 3 };
        },
      },
    });
    expect((await kit.call('viewer', 'GET', '/api/documents/kb/search?q=deploy')).status).toBe(200);
    expect((await kit.call('agent', 'GET', '/api/documents/kb/search?q=deploy')).status).toBe(200);
    expect((await kit.call('viewer', 'GET', '/api/documents/kb/search?q=deploy')).status).toBe(429);
    expect(keys).toEqual(['search:user_v', 'search:token:tok_1', 'search:user_v']);
  });

  it("counts an agent's results as reads and its empty search as a question; a person's as neither", async () => {
    const kit = await knowledgeKit();
    await kit.call('viewer', 'GET', '/api/documents/kb/search?q=deploy');
    await kit.call('viewer', 'GET', '/api/documents/kb/search?q=parental+leave');
    expect(count(kit, 'SELECT COUNT(*) AS n FROM page_reads')).toBe(0);
    expect(count(kit, 'SELECT COUNT(*) AS n FROM questions')).toBe(0);
    await kit.call('agent', 'GET', '/api/documents/kb/search?q=deploy');
    await kit.call('agent', 'GET', '/api/documents/kb/search?q=parental+leave');
    expect(
      kit.db.sql
        .prepare('SELECT tab, reader_kind, agent, reads FROM page_reads ORDER BY tab')
        .all(),
    ).toEqual([
      { tab: 'deploys', reader_kind: 'agent', agent: 'Coding Agent', reads: 1 },
      { tab: 'rollbacks', reader_kind: 'agent', agent: 'Coding Agent', reads: 1 },
    ]);
    expect(kit.db.sql.prepare('SELECT question, asked, people FROM questions').all()).toEqual([
      { question: 'parental leave', asked: 1, people: 0 },
    ]);
  });
});

describe('reads', () => {
  it("counts a person's open of a page once a day, an agent's every time, and keeps no one's id", async () => {
    const kit = await knowledgeKit();
    for (let i = 0; i < 3; i++) await kit.call('viewer', 'GET', '/api/documents/kb/tabs/deploys');
    await kit.call('participant', 'GET', '/api/documents/kb/tabs/deploys');
    for (let i = 0; i < 2; i++) await kit.call('agent', 'GET', '/api/documents/kb/tabs/deploys');
    expect(
      kit.db.sql
        .prepare('SELECT reader_kind, agent, reads FROM page_reads ORDER BY reader_kind')
        .all(),
    ).toEqual([
      { reader_kind: 'agent', agent: 'Coding Agent', reads: 2 },
      { reader_kind: 'person', agent: '', reads: 2 },
    ]);
    const stored = JSON.stringify([
      kit.db.sql.prepare('SELECT * FROM page_reads').all(),
      kit.db.sql.prepare('SELECT * FROM usage_counters').all(),
    ]);
    expect(stored).not.toMatch(/user_v|user_p/);
  });
});

describe('GET pages/:tab/backlinks', () => {
  it.each(EVERY_ROLE)(
    'lists the pages that link here for %s, and none for a page nothing links to',
    async (who) => {
      const kit = await knowledgeKit();
      const linked = await kit.call(who, 'GET', '/api/documents/kb/pages/rollbacks/backlinks');
      expect([linked.status, await linked.json()]).toEqual([
        200,
        { backlinks: [{ tab: 'deploys', title: 'Deploys' }] },
      ]);
      expect(
        await body(await kit.call(who, 'GET', '/api/documents/kb/pages/deploys/backlinks')),
      ).toEqual({ backlinks: [] });
    },
  );

  it('is closed to no access, to a link confined to another page, and for a page that is not there', async () => {
    const kit = await knowledgeKit();
    expect(
      (await kit.call('stranger', 'GET', '/api/documents/kb/pages/rollbacks/backlinks')).status,
    ).toBe(403);
    expect(
      (await kit.call('page-link', 'GET', '/api/documents/kb/pages/rollbacks/backlinks')).status,
    ).toBe(404);
    expect(
      (await kit.call('page-link', 'GET', '/api/documents/kb/pages/holidays/backlinks')).status,
    ).toBe(200);
    expect((await kit.call('editor', 'GET', '/api/documents/kb/pages/nope/backlinks')).status).toBe(
      404,
    );
  });
});

describe('GET summary', () => {
  it.each(EVERY_ROLE)(
    'answers %s the counts and the recent pages, cacheable for a minute',
    async (who) => {
      const kit = await knowledgeKit();
      await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
      const res = await kit.call(who, 'GET', '/api/documents/kb/summary');
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
      const summary = await body<{ pages: number; health: object; recent: { tab: string }[] }>(res);
      expect(summary.pages).toBe(3);
      expect(summary.health).toEqual({ verified: 1, reviewDue: 0, neverVerified: 2, total: 3 });
      expect(summary.recent[0]!.tab).toBe('deploys');
      expect(summary.recent).toHaveLength(3);
    },
  );

  // verification.md "Reminders", knowledgebase-home.md "Yours to Review": the caller's own pages that are due.
  describe('yoursToReview', () => {
    const DAY = 86_400_000;
    const T0 = Date.parse('2026-01-01T00:00:00Z');
    afterEach(() => vi.useRealTimers());
    const due = async (kit: Kit, who: Who) =>
      (
        await body<{ yoursToReview: { tab: string; title: string; reviewAt: number }[] }>(
          await kit.call(who, 'GET', '/api/documents/kb/summary'),
        )
      ).yoursToReview;

    // Holidays verified first, Deploys a day later, both the Editor's; Rollbacks is the Participant's. Then the
    // 90 days pass for all three.
    async function agedKit(): Promise<Kit> {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(T0);
      const kit = await knowledgeKit();
      await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
      vi.setSystemTime(T0 + DAY);
      await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
      await kit.call('editor', 'POST', '/api/documents/kb/pages/rollbacks/verify');
      // The Participant owns Rollbacks. Written where the route would write it: this kit's index knows no one but
      // the caller, so the owner route (which asks it whether a person can open the knowledgebase) is not the way.
      kit.db.sql
        .prepare(
          "UPDATE tabs SET rev = rev + 1, data = json_set(data, '$.knowledge.owner', 'user_p') WHERE id = 'rollbacks'",
        )
        .run();
      vi.setSystemTime(T0 + 120 * DAY);
      return kit;
    }

    it('lists an Editor their own due pages, the longest overdue first, each with when it came due', async () => {
      const kit = await agedKit();
      expect(await due(kit, 'editor')).toEqual([
        { tab: 'holidays', title: 'Holidays', reviewAt: T0 + 90 * DAY },
        { tab: 'deploys', title: 'Deploys', reviewAt: T0 + 91 * DAY },
      ]);
    });

    it('lists a Participant theirs alone, and a Viewer who owns nothing none', async () => {
      const kit = await agedKit();
      expect((await due(kit, 'participant')).map((p) => p.tab)).toEqual(['rollbacks']);
      expect(await due(kit, 'viewer')).toEqual([]);
    });

    it('lists none for a visitor with no account, and an agent the pages of the account it acts for', async () => {
      const kit = await agedKit();
      expect(await due(kit, 'link')).toEqual([]);
      expect((await due(kit, 'agent')).map((p) => p.tab)).toEqual(['holidays', 'deploys']);
    });

    it('lists nothing before a page is due, nothing never verified, and a page again only once it is due again', async () => {
      const kit = await agedKit();
      vi.setSystemTime(T0 + 30 * DAY);
      expect(await due(kit, 'editor')).toEqual([]);
      vi.setSystemTime(T0 + 120 * DAY);
      // Still Right: verified again, so it leaves the list.
      await kit.call('editor', 'POST', '/api/documents/kb/pages/holidays/verify');
      expect((await due(kit, 'editor')).map((p) => p.tab)).toEqual(['deploys']);
    });

    it('caps the list at ten, the oldest kept', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const many = Array.from({ length: 12 }, (_, i) => page(`p${i}`, `Page ${i}`, []));
      const kit = await knowledgeKit({}, many);
      // Verified newest first, so the cap is seen to keep the oldest and not the first in the tree.
      for (let i = 0; i < 12; i++) {
        vi.setSystemTime(T0 + (12 - i) * DAY);
        await kit.call('editor', 'POST', `/api/documents/kb/pages/p${i}/verify`);
      }
      vi.setSystemTime(T0 + 200 * DAY);
      const listed = await due(kit, 'editor');
      expect(listed.map((p) => p.tab)).toEqual([
        'p11',
        'p10',
        'p9',
        'p8',
        'p7',
        'p6',
        'p5',
        'p4',
        'p3',
        'p2',
      ]);
    });
  });

  // The worst the route can be asked: a full knowledgebase (500 pages of 4,000 characters), every page the
  // caller's own and due, so every body is looked at for its owner before the ten oldest are kept.
  it('answers a full knowledgebase whose every page is the caller’s and due within its budget', async () => {
    const words = 'The release train leaves when every check has passed. '.repeat(75);
    const many = Array.from({ length: 500 }, (_, i) =>
      page(`p${i}`, `Page ${i}`, [{ id: 'b1', type: 'paragraph', runs: [{ text: words }] }]),
    );
    const kit = await knowledgeKit({}, many);
    kit.db.sql.exec(
      `UPDATE tabs SET rev = rev + 1, data = json_set(data, '$.knowledge.owner', 'user_o');
       INSERT OR REPLACE INTO page_trust (tab, title, verified_at)
         SELECT id, name, 1000 + rowid FROM tabs`,
    );
    // Once to warm the statement, then measured.
    await kit.call('editor', 'GET', '/api/documents/kb/summary');
    const t0 = cpuNowMs();
    const res = await kit.call('editor', 'GET', '/api/documents/kb/summary');
    const cpu = cpuNowMs() - t0;
    const summary = await body<{ pages: number; yoursToReview: { tab: string }[] }>(res);
    console.info('[measured] summary of 500 owned, due pages', { cpuMs: Math.round(cpu) });
    expect(summary.pages).toBe(500);
    expect(summary.yoursToReview).toHaveLength(10);
    expect(cpu).toBeLessThan(cpuBudgetMs(150));
  });

  it('is closed to no access and to a link confined to one page', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('stranger', 'GET', '/api/documents/kb/summary')).status).toBe(403);
    expect((await kit.call('page-link', 'GET', '/api/documents/kb/summary')).status).toBe(403);
  });
});
