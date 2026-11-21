import { describe, expect, it } from 'vitest';
import { MAX_TRASHED_PAGES, PAGE_TRASH_DAYS, type TrashedPage } from '@liveknowledge/api-schema';
import { listTrash, relinkListedPages, trashPage } from '../document-room/page-trash';
import { knowledgeKit, page, type Kit, type Who } from './knowledge-test-kit';
import { cpuBudgetMs } from '@liveworkspace/vitest-config/cpu-time';

// The page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"; blueprint page-tree.md
// "The page Trash"): a deleted page waits 30 days, whole, out of every read but the Trash's, and comes back where
// it stood.

const DAY = 24 * 60 * 60 * 1000;
const del = (kit: Kit, who: Who, tab: string) =>
  kit.call(who, 'DELETE', `/api/documents/kb/tabs/${tab}`);
const trash = async (kit: Kit, who: Who = 'editor') => {
  const res = await kit.call(who, 'GET', '/api/documents/kb/trash');
  expect(res.status).toBe(200);
  return (await res.json<{ pages: TrashedPage[] }>()).pages;
};
const tree = async (kit: Kit) => {
  const res = await kit.call('editor', 'GET', '/api/documents/kb');
  const { document } = await res.json<{
    document: { tabs: { id: string; parent?: string }[] };
  }>();
  return document.tabs.map((t) => (t.parent ? `${t.id}<${t.parent}` : t.id));
};
const search = async (kit: Kit, q: string) => {
  const res = await kit.call('editor', 'GET', `/api/documents/kb/search?q=${q}`);
  return (await res.json<{ results: { tab: string }[] }>()).results.map((r) => r.tab);
};
const count = (kit: Kit, sql: string) => (kit.db.sql.prepare(sql).get() as { n: number }).n;

// Deploys holds Rollbacks; the editor's delete of Deploys sends one DELETE a page, the subpage first.
async function deleteDeploys(kit: Kit, who: Who = 'editor') {
  expect((await del(kit, who, 'rollbacks')).status).toBe(204);
  expect((await del(kit, who, 'deploys')).status).toBe(204);
}

describe('a deleted page goes to the Trash', () => {
  it('leaves the tree, keeps its body, and lists with its subpage, who and when', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    expect(await tree(kit)).toEqual(['holidays']);
    expect(count(kit, "SELECT COUNT(*) AS n FROM tabs WHERE id IN ('deploys', 'rollbacks')")).toBe(
      2,
    );
    const pages = await trash(kit);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      id: 'deploys',
      name: 'Deploys',
      subpages: [{ id: 'rollbacks', name: 'Rollbacks' }],
    });
    expect(typeof pages[0]!.trashedAt).toBe('number');
  });

  it('is never found by search, nor read as a page', async () => {
    const kit = await knowledgeKit();
    expect(await search(kit, 'tuesdays')).toEqual(['deploys']);
    await deleteDeploys(kit);
    expect(await search(kit, 'tuesdays')).toEqual([]);
    expect(count(kit, "SELECT COUNT(*) AS n FROM passages WHERE tab = 'deploys'")).toBe(0);
    expect((await kit.call('editor', 'GET', '/api/documents/kb/tabs/deploys')).status).toBe(404);
    expect((await kit.call('agent', 'GET', '/api/documents/kb/pages')).status).toBe(200);
    const listed = JSON.stringify(
      await (await kit.call('agent', 'GET', '/api/documents/kb/pages')).json(),
    );
    expect(listed).toContain('holidays');
    expect(listed).not.toContain('deploys');
    expect(listed).not.toContain('rollbacks');
  });

  it("takes an agent's delete too", async () => {
    const kit = await knowledgeKit();
    expect((await del(kit, 'agent', 'holidays')).status).toBe(204);
    expect((await trash(kit)).map((p) => p.id)).toEqual(['holidays']);
  });

  it('keeps the last page from a token, as a delete does', async () => {
    const kit = await knowledgeKit(undefined, [page('only', 'Only', [])]);
    expect((await del(kit, 'agent', 'only')).status).toBe(409);
    expect(await trash(kit)).toEqual([]);
  });
});

describe('Restore', () => {
  it('puts the page and its subpages back where they stood, and in search', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    const res = await kit.call('participant', 'POST', '/api/documents/kb/trash/deploys/restore');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ restored: ['deploys', 'rollbacks'], topLevel: false });
    expect(await tree(kit)).toEqual(['deploys', 'rollbacks<deploys', 'holidays']);
    expect(await trash(kit)).toEqual([]);
    expect(await search(kit, 'tuesdays')).toEqual(['deploys']);
  });

  it('brings a page whose parent is gone back at the top level, and says so', async () => {
    const kit = await knowledgeKit();
    // Rollbacks alone to the Trash, then its parent removed for good.
    expect((await del(kit, 'editor', 'rollbacks')).status).toBe(204);
    kit.db.sql.exec("DELETE FROM tabs WHERE id = 'deploys'");
    const back = await kit.call('editor', 'POST', '/api/documents/kb/trash/rollbacks/restore');
    expect(await back.json()).toEqual({ restored: ['rollbacks'], topLevel: true });
    expect(await tree(kit)).toEqual(['rollbacks', 'holidays']);
  });

  it('brings a subpage restored alone back at the top level: its parent is still in the Trash', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    const res = await kit.call('editor', 'POST', '/api/documents/kb/trash/rollbacks/restore');
    expect(await res.json()).toEqual({ restored: ['rollbacks'], topLevel: true });
    expect((await trash(kit)).map((p) => [p.id, p.subpages])).toEqual([['deploys', []]]);
  });

  it('refuses a restore past the page limit', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    for (let i = 0; i < 499; i++)
      kit.db.sql.exec(
        `INSERT INTO tabs (id, name, data, updated_at, element_count) VALUES ('x${i}', 'x', '{}', 1, 0);
         INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('kb', 'x${i}', ${i + 10}, 1);`,
      );
    const res = await kit.call('editor', 'POST', '/api/documents/kb/trash/deploys/restore');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'page_limit' });
  });

  it('answers 404 for a page not in the Trash', async () => {
    const kit = await knowledgeKit();
    expect(
      (await kit.call('editor', 'POST', '/api/documents/kb/trash/holidays/restore')).status,
    ).toBe(404);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/trash/holidays')).status).toBe(
      404,
    );
  });

  it("is what an Undo's save does: linking the page again takes it out of the Trash", async () => {
    const kit = await knowledgeKit();
    expect((await del(kit, 'editor', 'holidays')).status).toBe(204);
    const put = await kit.call('editor', 'PUT', '/api/documents/kb/tabs/holidays', {
      id: 'holidays',
      name: 'Holidays',
      elements: [],
    });
    expect(put.status, await put.clone().text()).toBeLessThan(300);
    expect(await trash(kit)).toEqual([]);
  });

  it("is what an Undo's list does, for this person's own delete alone", async () => {
    const kit = await knowledgeKit();
    expect((await del(kit, 'editor', 'holidays')).status).toBe(204);
    const env = kit.db.env as never;
    expect(await relinkListedPages(env, 'kb', ['deploys', 'holidays'], 'user_p')).toEqual([]);
    expect(await relinkListedPages(env, 'kb', [], 'user_o')).toEqual([]);
    const save = await kit.call('editor', 'PUT', '/api/documents/kb', {
      name: 'Handbook',
      tabs: [{ id: 'deploys' }, { id: 'rollbacks' }, { id: 'holidays' }],
    });
    expect(save.status).toBe(200);
    expect(await tree(kit)).toContain('holidays');
    expect(await trash(kit)).toEqual([]);
  });
});

describe('purge', () => {
  it('removes a page for good after 30 days, with what it held', async () => {
    const kit = await knowledgeKit();
    expect((await del(kit, 'editor', 'holidays')).status).toBe(204);
    kit.db.sql.exec(
      `UPDATE page_trash SET trashed_at = trashed_at - ${PAGE_TRASH_DAYS * DAY + 1000}`,
    );
    expect(await trash(kit)).toEqual([]);
    expect(count(kit, "SELECT COUNT(*) AS n FROM tabs WHERE id = 'holidays'")).toBe(0);
  });

  it(`holds ${MAX_TRASHED_PAGES} pages at most, the oldest removed first`, async () => {
    const kit = await knowledgeKit();
    const env = kit.db.env as never;
    const extra = MAX_TRASHED_PAGES + 2;
    for (let i = 0; i < extra; i++)
      kit.db.sql.exec(
        `INSERT INTO tabs (id, name, data, updated_at, element_count) VALUES ('x${i}', 'x${i}', '{}', 1, 0);
         INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('kb', 'x${i}', ${i + 10}, 1);`,
      );
    for (let i = 0; i < extra; i++)
      await trashPage(env, 'kb', `x${i}`, { id: 'user_o', name: 'Owner' }, { now: 1_000_000 + i });
    const started = process.cpuUsage();
    const pages = await listTrash(env, 'kb', 1_000_000 + extra);
    const used = process.cpuUsage(started);
    const spent = (used.user + used.system) / 1000;
    expect(pages).toHaveLength(MAX_TRASHED_PAGES);
    expect(pages[0]!.id).toBe(`x${extra - 1}`);
    expect(pages.some((p) => p.id === 'x0' || p.id === 'x1')).toBe(false);
    expect(count(kit, "SELECT COUNT(*) AS n FROM tabs WHERE id IN ('x0', 'x1')")).toBe(0);
    // A full Trash lists well inside a request's budget.
    expect(spent).toBeLessThan(cpuBudgetMs(200));
  });
});

describe('Delete Forever and Empty Trash', () => {
  it('removes a page and its trashed subpages for good', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/trash/deploys')).status).toBe(
      204,
    );
    expect(count(kit, "SELECT COUNT(*) AS n FROM tabs WHERE id IN ('deploys', 'rollbacks')")).toBe(
      0,
    );
  });

  it('empties the Trash', async () => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    expect((await del(kit, 'editor', 'holidays')).status).toBe(204);
    expect((await kit.call('editor', 'DELETE', '/api/documents/kb/trash')).status).toBe(204);
    expect(await trash(kit)).toEqual([]);
    expect(count(kit, 'SELECT COUNT(*) AS n FROM page_trash')).toBe(0);
  });
});

describe('who', () => {
  it.each<[Who, number, number]>([
    // who, listing and restoring, deleting forever
    ['editor', 200, 204],
    ['participant', 200, 403],
    ['viewer', 403, 403],
    ['link', 403, 403],
    ['page-link', 403, 403],
    ['page-edit-link', 403, 403],
    ['agent', 403, 403],
    ['participant-agent', 403, 403],
  ])('%s: list %i, Delete Forever %i', async (who, list, forever) => {
    const kit = await knowledgeKit();
    await deleteDeploys(kit);
    expect((await kit.call(who, 'GET', '/api/documents/kb/trash')).status).toBe(list);
    expect((await kit.call(who, 'DELETE', '/api/documents/kb/trash/deploys')).status).toBe(forever);
    expect((await kit.call(who, 'DELETE', '/api/documents/kb/trash')).status).toBe(forever);
  });

  it('refuses an agent with the reason', async () => {
    const kit = await knowledgeKit();
    const res = await kit.call('agent', 'GET', '/api/documents/kb/trash');
    expect(await res.json()).toEqual({ error: 'trash_is_a_persons' });
  });

  it('answers the wrong method', async () => {
    const kit = await knowledgeKit();
    expect((await kit.call('editor', 'POST', '/api/documents/kb/trash')).status).toBe(405);
    expect((await kit.call('editor', 'GET', '/api/documents/kb/trash/x/restore')).status).toBe(405);
    expect((await kit.call('editor', 'POST', '/api/documents/kb/trash/x')).status).toBe(405);
  });
});
