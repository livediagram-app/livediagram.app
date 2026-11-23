// The Health Score's facts read (docs/specs/030-knowledgebase/verification.md "Health Score"): one statement for
// every page or a set of them, each count from the room's own tables, and the routes that carry the score.
import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';
import { countPageDailyReads, dayOf } from '@liveknowledge/knowledge';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { knowledgeKit, page, PAGES } from '../routes/knowledge-test-kit';
import { settleQueued, settlePage } from './knowledge-index';
import { knowledgeShapeStep } from './knowledge-schema';
import { pageHealthRows, pageHealthScores, pageHealthWires } from './page-health-read';

const para = (id: string, text: string, style?: string) => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});

afterEach(() => vi.useRealTimers());

describe('the facts of each page', () => {
  it('counts what the score reads from the room, and the index keeps each page’s shape', async () => {
    const pages = [
      ...PAGES,
      page('gone-link', 'Old Links', [
        para('b1', 'Old Links', 'title'),
        {
          id: 'b2',
          type: 'paragraph',
          runs: [
            { text: 'See ' },
            { text: 'Removed', page: 'removed' },
            { text: ' and ' },
            { text: 'Deploys', page: 'deploys' },
          ],
        },
      ]),
    ];
    const kit = await knowledgeKit({}, pages);
    const now = Date.now();
    kit.db.sql.exec(`
      INSERT INTO page_threads (tab, id, created_at, created_by, updated_at, resolved, comments)
        VALUES ('deploys', 'th1', 1, 'u', 1, 0, '[]'), ('deploys', 'th2', 1, 'u', 1, 1, '[]');
      INSERT INTO page_approvals (tab, state, requested_by, requested_at) VALUES ('holidays', 'pending', 'u', 1);
      INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, state, found_at)
        VALUES ('c1', 'When?', 'p1', 'deploys', 'h', 'p2', 'holidays', 'h', 'open', 1),
               ('c2', 'Who?', 'p1', 'deploys', 'h', 'p2', 'holidays', 'h', 'dismissed', 1);
      INSERT INTO suggestions (id, tab, agent, reason, kind, after, created_at)
        VALUES ('s1', 'rollbacks', 'Claude', 'r', 'append', 'x', 1);
      INSERT INTO page_reads (day, tab, reader_kind, agent, reads)
        VALUES ('${dayOf(now)}', 'deploys', 'person', '', 2), ('${dayOf(now)}', 'deploys', 'agent', 'Claude', 3),
               ('2000-01-01', 'holidays', 'person', '', 9);
    `);
    await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: 'user_o',
    });
    const rows = await pageHealthRows(kit.db.env, 'kb', now);
    const by = new Map(rows.map((r) => [r.tab, r]));
    expect(rows.map((r) => r.tab)).toEqual(['deploys', 'rollbacks', 'holidays', 'gone-link']);
    expect(by.get('deploys')).toMatchObject({
      owned: 1,
      headings: 1,
      openThreads: 1,
      openConflicts: 1,
      backlinks: 1,
      brokenLinks: 0,
      reads: 5,
      order: 0,
    });
    // The words reading time counts: the title, the heading and both paragraphs.
    expect(by.get('deploys')!.words).toBe(22);
    expect(by.get('rollbacks')).toMatchObject({ owned: 0, suggestions: 1, backlinks: 1 });
    expect(by.get('holidays')).toMatchObject({ pendingApproval: 1, openConflicts: 1, reads: 0 });
    expect(by.get('gone-link')).toMatchObject({ brokenLinks: 1, backlinks: 0 });

    // A set of pages, given twice, read once each.
    const some = await pageHealthRows(kit.db.env, 'kb', now, ['holidays', 'deploys', 'holidays']);
    expect(some.map((r) => r.tab).sort()).toEqual(['deploys', 'holidays']);
    expect(await pageHealthScores(kit.db.env, 'kb', 90, now, [])).toEqual(new Map());
    const wires = await pageHealthWires(kit.db.env, 'kb', 90, now, ['gone-link']);
    expect(wires.get('gone-link')).toMatchObject({ label: 'needs-work', reason: 'Never verified' });
    expect(wires.get('gone-link')!.factors.find((f) => f.factor === 'links')).toEqual({
      factor: 'links',
      points: 2,
      max: 5,
      raise: 'Fix 1 broken link: +2',
    });
  });

  it('a page the backfill has not reached reads its owner from its body', async () => {
    const kit = await knowledgeKit();
    await kit.call('editor', 'PUT', '/api/documents/kb/pages/deploys/knowledge', {
      owner: 'user_o',
    });
    kit.db.sql.exec('UPDATE knowledge_pages SET words = NULL, headings = NULL, owned = NULL');
    const [deploys, rollbacks] = await pageHealthRows(kit.db.env, 'kb', Date.now());
    expect(deploys).toMatchObject({ owned: 1, words: null, headings: null });
    expect(rollbacks).toMatchObject({ owned: 0 });
    // Schema step 38, run again, adds nothing and queues the pages; the settle writes the shape alone.
    knowledgeShapeStep((query) => {
      // As a Durable Object's `exec` does: the statement runs at once.
      const statement = kit.db.sql.prepare(query);
      const rows = query.startsWith('PRAGMA') ? statement.all() : (statement.run(), []);
      return { toArray: () => rows };
    });
    const sql = nodeItemSql(kit.db.sql);
    expect(settleQueued(sql, 10)).toMatchObject({ pages: 3, queued: 0, indexed: [] });
    expect(settlePage(sql, 'deploys')).toBe('unchanged');
    const [again] = await pageHealthRows(kit.db.env, 'kb', Date.now());
    expect(again).toMatchObject({ owned: 1, words: 22, headings: 1 });
  });

  it('scores 500 pages in one read, and a 20-page search’s in one', async () => {
    const many = Array.from({ length: 500 }, (_, at) =>
      page(`p${at}`, `Page ${at}`, [
        para('b1', `Page ${at}`, 'title'),
        para('b2', 'Section', 'h2'),
        {
          id: 'b3',
          type: 'paragraph',
          runs: [
            { text: 'Words about the thing, and a link to ' },
            { text: 'next', page: `p${(at + 1) % 520}` },
          ],
        },
      ]),
    );
    const kit = await knowledgeKit({}, many);
    // Past the dozen a write settles at once, the alarm indexes the rest, a batch a turn.
    const sql = nodeItemSql(kit.db.sql);
    while (settleQueued(sql, 100).queued > 0);
    const now = Date.now();
    const prepare = vi.spyOn(kit.db.env.DOCUMENT_DB, 'prepare');
    const started = process.cpuUsage();
    const scores = await pageHealthScores(kit.db.env, 'kb', 90, now);
    const spent = process.cpuUsage(started);
    const ms = (spent.user + spent.system) / 1000;
    console.info('[health] 500 pages scored in', ms.toFixed(1), 'ms CPU');
    expect(scores.size).toBe(500);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
    prepare.mockClear();
    const twenty = await pageHealthWires(
      kit.db.env,
      'kb',
      90,
      now,
      Array.from({ length: 20 }, (_, at) => `p${at * 7}`),
    );
    expect(twenty.size).toBe(20);
    expect(prepare).toHaveBeenCalledTimes(1);
    // The last page links past the knowledgebase's end: one broken link.
    const broken = [...scores.values()].filter((s) => s.row.brokenLinks > 0);
    expect(broken.map((s) => s.row.tab)).toEqual(['p499']);
  });

  // insights.md "Not Read in 90 Days", "Page Insights": both ride reads already made, at 500 pages with every
  // page read on every one of the 90 days the room keeps (45,000 rows, the worst a busy knowledgebase holds).
  it('answers each page’s last read in the same one read, and one page’s 30 days in one, at 500 pages', async () => {
    const many = Array.from({ length: 500 }, (_, at) =>
      page(`p${at}`, `Page ${at}`, [para('b1', `Page ${at}`, 'title')]),
    );
    const kit = await knowledgeKit({}, many);
    const now = Date.now();
    // Every page read by a person each day for 90 days, but the last 20 pages not since 100 days back.
    const insert = kit.db.sql.prepare(
      "INSERT INTO page_reads (day, tab, reader_kind, agent, reads) VALUES (?, ?, 'person', '', 1)",
    );
    kit.db.sql.exec('BEGIN');
    for (let at = 0; at < 500; at++)
      for (let back = 0; back < 90; back++)
        insert.run(dayOf(now - (at >= 480 ? back + 100 : back) * 86_400_000), `p${at}`);
    kit.db.sql.exec('COMMIT');
    const prepare = vi.spyOn(kit.db.env.DOCUMENT_DB, 'prepare');
    const started = process.cpuUsage();
    const rows = await pageHealthRows(kit.db.env, 'kb', now);
    const spent = process.cpuUsage(started);
    const ms = (spent.user + spent.system) / 1000;
    console.info(
      '[health] 500 pages with 45,000 reads, last read each, in',
      ms.toFixed(1),
      'ms CPU',
    );
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(rows.filter((r) => r.lastRead === dayOf(now))).toHaveLength(480);
    expect(rows.find((r) => r.tab === 'p499')!.lastRead).toBe(dayOf(now - 100 * 86_400_000));
    expect(ms).toBeLessThan(cpuBudgetMs(400));
    prepare.mockClear();
    const one = process.cpuUsage();
    const daily = kit.db.sql
      .prepare(countPageDailyReads('p7', now).sql)
      .all(...(countPageDailyReads('p7', now).params as string[]));
    const oneSpent = process.cpuUsage(one);
    const oneMs = (oneSpent.user + oneSpent.system) / 1000;
    console.info('[insights] one page’s 30 days of 90 kept, in', oneMs.toFixed(2), 'ms CPU');
    expect(daily).toHaveLength(30);
    expect(oneMs).toBeLessThan(cpuBudgetMs(20));
  });

  it('rides Page Health’s read, the agents’ reads and searches, and Insights’ conflicts', async () => {
    const kit = await knowledgeKit();
    kit.db.sql.exec(`
      INSERT INTO conflicts (id, question, a_passage, a_tab, a_hash, b_passage, b_tab, b_hash, state, found_at)
        SELECT 'c1', 'When?', a.id, 'deploys', a.text_hash, b.id, 'holidays', b.text_hash, 'open', 1
          FROM passages a, passages b WHERE a.tab = 'deploys' AND a.ordinal = 0 AND b.tab = 'holidays' AND b.ordinal = 0;
    `);
    await kit.call('editor', 'POST', '/api/documents/kb/pages/deploys/verify');
    const health = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/pages/deploys/health')
    ).json<{ signals: unknown }>();
    expect(health.signals).toEqual({
      openConflicts: 1,
      openThreads: 0,
      suggestions: 0,
      backlinks: 0,
    });

    const read = await (
      await kit.call('agent', 'GET', '/api/documents/kb/pages/deploys')
    ).json<{
      page: { trust: { health: { score: number; label: string; factors: unknown[] } } };
    }>();
    expect(read.page.trust.health).toMatchObject({ label: 'healthy' });
    expect(read.page.trust.health.factors).toHaveLength(8);

    const found = await (
      await kit.call('agent', 'GET', '/api/documents/kb/search?q=tuesdays')
    ).json<{ results: { tab: string; health?: { score: number } }[] }>();
    expect(found.results.length).toBeGreaterThan(0);
    expect(found.results.every((r) => typeof r.health?.score === 'number')).toBe(true);
    // A person's search in the editor carries none: Page Health scores the page it opens.
    const theirs = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/search?q=tuesdays')
    ).json<{ results: { health?: unknown }[] }>();
    expect(theirs.results.every((r) => r.health === undefined)).toBe(true);

    await kit.call('editor', 'PUT', '/api/documents/kb/pages/holidays/knowledge', {
      context: true,
    });
    const context = await (
      await kit.call('agent', 'GET', '/api/documents/kb/context')
    ).json<{
      pages: { trust: { health?: { label: string } } }[];
    }>();
    expect(context.pages[0]!.trust.health?.label).toBe('needs-work');

    const overview = await (
      await kit.call('viewer', 'GET', '/api/documents/kb/knowledge')
    ).json<{
      conflicts: { a: { health: { score: number } }; b: { health: { score: number } } }[];
    }>();
    const [conflict] = overview.conflicts;
    expect(conflict!.a.health.score - conflict!.b.health.score).toBeGreaterThanOrEqual(10);
  });
});
