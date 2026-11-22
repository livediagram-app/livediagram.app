import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KnowledgePagesResponse } from '@liveknowledge/api-schema';
import { knowledgeKit, type Kit } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar": a connected file in the tree is
// listed for agents as a connected row, and is never a page: not searched, not read, not counted, not named.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});

afterEach(() => vi.restoreAllMocks());

const CONNECTION = { id: 'cn_abcdefghijklmnop', app: 'liveplanner', itemId: 'plan_1' };

// The knowledgebase with a connected file under Deploys, added as the editor adds one: a whole-tab save of an empty
// tab named after the file, holding its connection.
async function withConnectedRow(): Promise<Kit> {
  const kit = await knowledgeKit();
  const res = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/plan', {
    id: 'plan',
    name: 'Launch Plan',
    elements: [],
    parent: 'deploys',
    connection: CONNECTION,
  });
  if (res.status !== 200) throw new Error(`connect failed: ${res.status} ${await res.text()}`);
  return kit;
}

describe('a connected file in the tree, for agents', () => {
  it('is a connected row in list_pages, in its place, with no trust', async () => {
    const kit = await withConnectedRow();
    const res = await kit.call('agent', 'GET', '/api/documents/kb/pages');
    expect(res.status).toBe(200);
    const { pages } = await res.json<KnowledgePagesResponse>();
    expect(pages.map((p) => p.tab)).toEqual(['deploys', 'rollbacks', 'plan', 'holidays']);
    expect(pages[2]).toEqual({
      tab: 'plan',
      title: 'Launch Plan',
      kind: 'connected',
      app: 'liveplanner',
      depth: 2,
      parent: 'deploys',
      subpages: 0,
    });
    expect(pages[0]).not.toHaveProperty('kind');
  });

  it('is not read or written as a page, and is never in search', async () => {
    const kit = await withConnectedRow();
    const read = await kit.call('agent', 'GET', '/api/documents/kb/pages/plan');
    expect(read.status).toBe(404);
    expect(await read.json()).toMatchObject({ error: 'connected_file' });
    const write = await kit.call('agent', 'PUT', '/api/documents/kb/pages/plan', {
      markdown: 'Hello',
    });
    expect(write.status).toBe(404);
    const count = kit.db.sql
      .prepare("SELECT COUNT(*) AS n FROM passages WHERE tab = 'plan'")
      .get() as { n: number };
    expect(count.n).toBe(0);
    const found = await kit.call('viewer', 'GET', '/api/documents/kb/search?q=launch+plan');
    expect((await found.json<{ results: unknown[] }>()).results).toEqual([]);
  });

  it('is no page to place under, and not counted among the pages', async () => {
    const kit = await withConnectedRow();
    const under = await kit.call('agent', 'POST', '/api/documents/kb/pages', {
      title: 'Inside',
      parent: 'plan',
    });
    expect(under.status).toBe(409);
    const context = await kit.call('agent', 'GET', '/api/documents/kb/context');
    expect((await context.json<{ pageCount: number }>()).pageCount).toBe(3);
    // Deploys lists Rollbacks as its subpage, not the connected file.
    const deploys = await kit.call('agent', 'GET', '/api/documents/kb/pages/deploys');
    const read = await deploys.json<{ page: { subpages: { tab: string }[] } }>();
    expect(read.page.subpages.map((s) => s.tab)).toEqual(['rollbacks']);
  });
});

describe('a connected file in the tree, on Home', () => {
  it('is not counted in Page Health nor listed as a recent page', async () => {
    const kit = await withConnectedRow();
    const res = await kit.call('editor', 'GET', '/api/documents/kb/summary');
    expect(res.status).toBe(200);
    const home = await res.json<{
      pages: number;
      health: { total: number };
      recent: { tab: string }[];
    }>();
    expect(home.health.total).toBe(3);
    expect(home.recent.map((r) => r.tab)).not.toContain('plan');
  });
});
