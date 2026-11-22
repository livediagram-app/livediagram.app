import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_KNOWLEDGEBASE_PAGES, MAX_PAGE_DEPTH } from '@liveknowledge/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// The page tree over the api (docs/specs/030-knowledgebase/blueprints/page-tree.md "Storage" and "The room's
// check"): the tab summaries carry each page's parent, the metadata save places pages whose bodies the editor never
// loaded, and both saves refuse a tree the limits do not take.

const OWNER = 'user_owner';

function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: OWNER,
      accountUserId: OWNER,
      verifiedUserId: OWNER,
      body,
    }),
  );
}

type Seed = { id: string; parent?: string };
const page = (p: Seed) => ({
  id: p.id,
  name: p.id,
  elements: [],
  ...(p.parent ? { parent: p.parent } : {}),
});

async function knowledgebase(pages: Seed[], id = 'D'): Promise<SqliteD1> {
  const db = sqliteD1();
  await seed(db, pages, id);
  return db;
}
async function seed(db: SqliteD1, pages: Seed[], id: string): Promise<void> {
  const res = await call(db, 'POST', '/api/documents', { id, name: 'K', tabs: pages.map(page) });
  expect(res.status).toBe(201);
}

const parents = (db: SqliteD1, id = 'D'): Record<string, unknown> =>
  Object.fromEntries(
    db.sql
      .prepare(
        `SELECT t.id AS id, json_extract(t.data, '$.parent') AS parent FROM document_tabs dt
           JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = ? ORDER BY dt.order_index`,
      )
      .all(id)
      .map((r): [string, unknown] => [String(r.id), r.parent]),
  );

const chain = (levels: number): Seed[] =>
  Array.from({ length: levels }, (_, i) =>
    i === 0 ? { id: 'p0' } : { id: `p${i}`, parent: `p${i - 1}` },
  );

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('the tree in the tab summaries', () => {
  it('carries each page’s parent, absent at the top level', async () => {
    const db = await knowledgebase([
      { id: 'a' },
      { id: 'b', parent: 'a' },
      { id: 'c', parent: 'b' },
    ]);
    const res = await call(db, 'GET', '/api/documents/D');
    const { document } = await res.json<{ document: { tabs: Record<string, unknown>[] } }>();
    expect(document.tabs.map((t) => [t.id, t.parent])).toEqual([
      ['a', undefined],
      ['b', 'a'],
      ['c', 'b'],
    ]);
    expect(Object.hasOwn(document.tabs[0]!, 'parent')).toBe(false);
  });
});

describe('the metadata save places pages', () => {
  it('writes a moved page’s parent into its body, and takes one out to the top level', async () => {
    const db = await knowledgebase([{ id: 'a' }, { id: 'b', parent: 'a' }, { id: 'c' }]);
    const res = await call(db, 'PUT', '/api/documents/D', {
      tabs: [
        { id: 'a', parent: null },
        { id: 'c', parent: 'a' },
        { id: 'b', parent: null },
      ],
    });
    expect(res.status).toBe(200);
    expect(parents(db)).toEqual({ a: null, c: 'a', b: null });
    // The body is otherwise as it was.
    const body = JSON.parse(
      db.sql.prepare("SELECT data FROM tabs WHERE id = 'c'").get()!.data as string,
    ) as { elements: unknown };
    expect(body.elements).toEqual([]);
  });

  it('leaves the tree alone when the list names no parent', async () => {
    const db = await knowledgebase([{ id: 'a' }, { id: 'b', parent: 'a' }]);
    expect((await call(db, 'PUT', '/api/documents/D', { tabs: ['b', 'a'] })).status).toBe(200);
    expect(parents(db)).toEqual({ b: 'a', a: null });
  });

  it.each([
    ['a ninth level', [{ id: 'x', parent: `p${MAX_PAGE_DEPTH - 1}` }], 'depth_limit'],
    ['a cycle', [{ id: 'p0', parent: 'p1' }], 'own_subtree'],
    ['a parent in another document', [{ id: 'x', parent: 'other' }], 'unknown_page'],
  ])('refuses %s whole: nothing is written, not even the name', async (_label, tabs, reason) => {
    const db = await knowledgebase([...chain(MAX_PAGE_DEPTH), { id: 'x' }]);
    await seed(db, [{ id: 'other' }], 'E');
    const before = parents(db);
    const res = await call(db, 'PUT', '/api/documents/D', { name: 'Renamed', tabs });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: reason });
    expect(parents(db)).toEqual(before);
    expect(db.sql.prepare("SELECT name FROM document WHERE id = 'D'").get()!.name).toBe('K');
  });
});

describe('the whole-tab save meets the tree’s limits', () => {
  const put = (db: SqliteD1, p: Seed) => call(db, 'PUT', `/api/documents/D/tabs/${p.id}`, page(p));

  it('refuses the 501st page', async () => {
    const db = await knowledgebase(
      Array.from({ length: MAX_KNOWLEDGEBASE_PAGES - 1 }, (_, i) => ({ id: `t${i}` })),
    );
    expect((await put(db, { id: 'last' })).status).toBe(200);
    const res = await put(db, { id: 'over' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'page_limit' });
    // A page already there still saves.
    expect((await put(db, { id: 'last' })).status).toBe(200);
  });

  it('refuses a page below level 8, a cycle, and a parent in another document', async () => {
    const db = await knowledgebase(chain(MAX_PAGE_DEPTH));
    await seed(db, [{ id: 'other' }], 'E');
    const refused = async (p: Seed) => {
      const res = await put(db, p);
      expect(res.status).toBe(409);
      return (await res.json<{ error: string }>()).error;
    };
    expect(await refused({ id: 'new', parent: `p${MAX_PAGE_DEPTH - 1}` })).toBe('depth_limit');
    expect(await refused({ id: 'p0', parent: 'p3' })).toBe('own_subtree');
    expect(await refused({ id: 'new', parent: 'other' })).toBe('unknown_page');
    expect((await put(db, { id: 'new', parent: `p${MAX_PAGE_DEPTH - 2}` })).status).toBe(200);
    expect(parents(db).new).toBe(`p${MAX_PAGE_DEPTH - 2}`);
  });
});
