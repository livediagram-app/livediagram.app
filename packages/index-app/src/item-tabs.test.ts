import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { TAB_CONNECTION_SCHEMA } from './connected-tabs';
import { ItemDb } from './item-db';
import { itemTabOrder, normalizeReorderEntry, readReorderEntries } from './item-tab-order';
import { itemTabReads } from './item-tab-reads';
import { checkItemTabTables } from './item-tab-tables';
import {
  isTabRevStale,
  itemTabWrites,
  revFromBatch,
  type ItemTabWritesConfig,
} from './item-tab-writes';
import { tabSharesSchema } from './tab-share-types';
import { nodeItemSql, nodeTransaction } from './test-sqlite';

type Tab = { id: string; name: string; elements: { id: string; actions?: number }[] };
type Env = { DB: D1Database };
type Stats = { elementCount: number };
const tables = { item: 'item', links: 'item_tabs', key: 'item_id' };

function item() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE item (id TEXT PRIMARY KEY, saved_at INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE tabs (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL,
      element_count INTEGER NULL, rev INTEGER NOT NULL DEFAULT 1);
    ${TAB_CONNECTION_SCHEMA}
    CREATE TRIGGER tabs_rev_advances BEFORE UPDATE OF data ON tabs WHEN NEW.rev IS NOT OLD.rev + 1
      BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;
    CREATE TABLE item_tabs (item_id TEXT NOT NULL, tab_id TEXT NOT NULL, order_index INTEGER NOT NULL,
      added_at INTEGER NOT NULL, folder TEXT NULL, PRIMARY KEY (item_id, tab_id));
    CREATE TABLE stats (tab_id TEXT PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE, element_count INTEGER,
      written_at INTEGER, rev INTEGER);
    CREATE TABLE refs (tab_id TEXT NOT NULL, ref TEXT NOT NULL, PRIMARY KEY (tab_id, ref));
    CREATE TABLE outbox (item_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
      PRIMARY KEY (item_id, kind, key));
    CREATE TABLE extra (step TEXT NOT NULL);
    ${tabSharesSchema()}
    INSERT INTO item (id) VALUES ('A'), ('B');
  `);
  const db = new ItemDb(nodeItemSql(raw), {
    transaction: nodeTransaction(raw),
    ensureSchema: () => {},
    onWrite: () => {},
  }).asD1();
  return { raw, env: { DB: db } as Env };
}

const writesConfig = (
  over: Partial<ItemTabWritesConfig<Env, Tab, Stats>> = {},
): ItemTabWritesConfig<Env, Tab, Stats> => ({
  db: (env) => env.DB,
  tables,
  outbox: () => ({ table: 'outbox', itemColumn: 'item_id' }),
  drawnCount: (tab) => tab.elements.length,
  assertFits: (tabId, data, write) => {
    if (data.length > 200) throw new Error(`too large: ${write} ${tabId}`);
  },
  statsOf: (body) => ({ elementCount: body.elements.length }),
  statsStatement: (env, tabId, stats, writtenAt, ifStoredRev) =>
    ifStoredRev === undefined
      ? env.DB.prepare(
          'INSERT OR REPLACE INTO stats (tab_id, element_count, written_at) VALUES (?, ?, ?)',
        ).bind(tabId, stats.elementCount, writtenAt)
      : env.DB.prepare(
          'INSERT OR REPLACE INTO stats (tab_id, element_count, written_at, rev) SELECT ?, ?, ?, ? WHERE (SELECT rev FROM tabs WHERE id = ?) = ?',
        ).bind(tabId, stats.elementCount, writtenAt, ifStoredRev, tabId, ifStoredRev),
  refsOnWrite: (env, tab) => [
    env.DB.prepare('DELETE FROM refs WHERE tab_id = ?').bind(tab.id),
    ...tab.elements.map((e) =>
      env.DB.prepare('INSERT INTO refs (tab_id, ref) VALUES (?, ?)').bind(tab.id, e.id),
    ),
  ],
  ...over,
});

const tab = (id: string, n = 1, name = id.toUpperCase()): Tab => ({
  id,
  name,
  elements: Array.from({ length: n }, (_, i) => ({ id: `${id}-e${i}`, actions: 9 })),
});

describe('checkItemTabTables', () => {
  it('refuses a name that is not a bare identifier', () => {
    expect(() => checkItemTabTables({ ...tables, key: 'item_id; DROP' })).toThrow(/not a table/);
    expect(checkItemTabTables(tables)).toBe(tables);
  });
});

describe('itemTabWrites', () => {
  it('upserts a tab with its link, stats, saved_at and references, advancing its revision', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    expect(await w.upsertTab(env, 'A', tab('t1', 2), 0)).toBe(1);
    expect(await w.upsertTab(env, 'A', tab('t1', 1), 3)).toBe(2);
    expect(raw.prepare('SELECT * FROM item_tabs').all()).toEqual([
      expect.objectContaining({ item_id: 'A', tab_id: 't1', order_index: 3 }),
    ]);
    expect(raw.prepare('SELECT element_count FROM tabs').get()).toEqual({ element_count: 1 });
    expect(raw.prepare('SELECT element_count FROM stats').get()).toEqual({ element_count: 1 });
    expect(raw.prepare('SELECT ref FROM refs').all()).toEqual([{ ref: 't1-e0' }]);
    expect(
      (raw.prepare("SELECT saved_at FROM item WHERE id = 'A'").get() as { saved_at: number })
        .saved_at,
    ).toBeGreaterThan(0);
  });

  it('runs prepareTab first, and keeps a connection out of the body', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(
      writesConfig({ prepareTab: (t) => ({ ...t, elements: t.elements.slice(0, 1) }) }),
    );
    await w.upsertTab(env, 'A', { ...tab('t1', 3), connection: { id: 'x' } } as Tab, 0);
    const data = JSON.parse((raw.prepare('SELECT data FROM tabs').get() as { data: string }).data);
    expect(data).toEqual({ elements: [{ id: 't1-e0', actions: 9 }] });
  });

  it('refuses a body over the cap before writing', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    await expect(w.upsertTab(env, 'A', tab('t1', 20), 0)).rejects.toThrow('upsertTab t1');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()).toEqual({ n: 0 });
  });

  it('writes at a revision, with its connection, or refuses a stale one', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    await w.upsertTab(env, 'A', tab('t1'), 0);
    const connection = { id: 'cn_abcdefghijklmnop', app: 'liveplanner', itemId: 'p1' } as const;
    expect(await w.upsertTabAtRev(env, 'A', tab('t1', 2), 0, 1, connection)).toBe(2);
    expect(raw.prepare('SELECT connection FROM tabs').get()).toEqual({
      connection: JSON.stringify(connection),
    });
    expect(await w.upsertTabAtRev(env, 'A', tab('t1', 1), 0, 2)).toBe(3);
    const stale = await w.upsertTabAtRev(env, 'A', tab('t1'), 0, 1).catch((err: unknown) => err);
    expect(isTabRevStale(stale)).toBe(true);
    expect(isTabRevStale('tab_rev_stale')).toBe(false);
  });

  it('builds statements a caller batches itself', () => {
    const { env } = item();
    const w = itemTabWrites(writesConfig());
    expect(w.tabWriteStatements(env, 'A', tab('t1'), 0, { advance: true }, 5)).toHaveLength(6);
  });

  it('reads the revision a batch returned, or says there was none', () => {
    expect(revFromBatch([{ results: [{ rev: 4 }] }])).toBe(4);
    expect(() => revFromBatch([])).toThrow('no revision');
  });

  it('renames a tab, advancing its revision, and answers null for no tab', async () => {
    const { env } = item();
    const w = itemTabWrites(writesConfig());
    await w.upsertTab(env, 'A', tab('t1'), 0);
    expect(await w.renameTab(env, 't1', 'Renamed')).toBe(2);
    expect(await w.renameTab(env, 'nope', 'X')).toBeNull();
  });

  it('seeds every tab in one batch, keeping a connection in its column, or none at all', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    await w.seedTabs(env, 'A', []);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()).toEqual({ n: 0 });
    const connection = { id: 'cn_abcdefghijklmnop', app: 'livedesign', itemId: 'd1' };
    await w.seedTabs(env, 'A', [tab('t1'), { ...tab('t2', 2), connection } as Tab], 42);
    expect(
      raw.prepare('SELECT tab_id, order_index FROM item_tabs ORDER BY order_index').all(),
    ).toEqual([
      { tab_id: 't1', order_index: 0 },
      { tab_id: 't2', order_index: 1 },
    ]);
    expect(raw.prepare("SELECT saved_at FROM item WHERE id = 'A'").get()).toEqual({ saved_at: 42 });
    expect(raw.prepare("SELECT connection FROM tabs WHERE id = 't2'").get()).toEqual({
      connection: JSON.stringify(connection),
    });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM refs').get()).toEqual({ n: 3 });
    await expect(w.seedTabs(env, 'B', [tab('t3'), tab('t4', 20)])).rejects.toThrow('seedTabs t4');
    expect(raw.prepare("SELECT COUNT(*) AS n FROM item_tabs WHERE item_id = 'B'").get()).toEqual({
      n: 0,
    });
    await w.seedTabs(env, 'B', [tab('t5')]);
    expect(raw.prepare("SELECT saved_at FROM item WHERE id = 'B'").get()).not.toEqual({
      saved_at: 0,
    });
  });

  it('deletes a tab with its link, keying a connected tab and telling its share holders', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(
      writesConfig({
        onDelete: {
          afterLeft: (e) => [e.DB.prepare("INSERT INTO extra VALUES ('left')")],
          afterBody: (e) => [e.DB.prepare("INSERT INTO extra VALUES ('body')")],
        },
      }),
    );
    const connection = { id: 'cn_abcdefghijklmnop', app: 'livedesign', itemId: 'd1' };
    await w.seedTabs(env, 'A', [{ ...tab('t1'), connection } as Tab, tab('t2')]);
    raw.exec("INSERT INTO tab_shares (tab_id, item_id) VALUES ('t1', 'C')");
    expect(await w.deleteTabRow(env, 'A', 't1')).toEqual({
      data: JSON.stringify({ elements: tab('t1').elements }),
    });
    expect(raw.prepare('SELECT id FROM tabs').all()).toEqual([{ id: 't2' }]);
    expect(raw.prepare('SELECT kind FROM outbox').all()).toEqual([{ kind: 'connection_left' }]);
    expect(raw.prepare('SELECT kind, to_item FROM share_outbox').all()).toEqual([
      { kind: 'leave', to_item: 'C' },
    ]);
    expect(raw.prepare('SELECT step FROM extra').all()).toEqual([
      { step: 'left' },
      { step: 'body' },
    ]);
    expect(await w.deleteTabRow(env, 'A', 'nope')).toBeNull();
  });

  it('keeps a body another item still links, unless told to take it', async () => {
    const { raw, env } = item();
    const keep = itemTabWrites(writesConfig());
    await keep.seedTabs(env, 'A', [tab('t1')]);
    raw.exec(
      "INSERT INTO item_tabs (item_id, tab_id, order_index, added_at) VALUES ('B', 't1', 0, 1)",
    );
    await keep.deleteTabRow(env, 'A', 't1');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()).toEqual({ n: 1 });
    const take = itemTabWrites(writesConfig({ onDelete: { bodyEvenIfLinked: true } }));
    await take.deleteTabRow(env, 'B', 't1');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()).toEqual({ n: 0 });
  });

  it('with keepLast, refuses the last tab and answers null for one it lacks', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    await w.seedTabs(env, 'A', [tab('t1'), tab('t2')]);
    raw.exec("INSERT INTO tab_shares (tab_id, item_id) VALUES ('t2', 'C')");
    expect(await w.deleteTabRow(env, 'A', 'nope', { keepLast: true })).toBeNull();
    expect(await w.deleteTabRow(env, 'A', 't1', { keepLast: true })).toEqual({
      data: JSON.stringify({ elements: tab('t1').elements }),
    });
    expect(await w.deleteTabRow(env, 'A', 't2', { keepLast: true })).toBe('last');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM share_outbox').get()).toEqual({ n: 0 });
  });

  it('answers null when the unlinked tab had no body row', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    raw.exec(
      "INSERT INTO item_tabs (item_id, tab_id, order_index, added_at) VALUES ('A', 'ghost', 0, 1)",
    );
    expect(await w.deleteTabRow(env, 'A', 'ghost')).toBeNull();
  });

  it('swaps a body only at the version read, adding references, and moves saved_at when it won', async () => {
    const { raw, env } = item();
    const added: string[] = [];
    const w = itemTabWrites(
      writesConfig({
        refsOnSwap: (e, _tabId, body) => {
          added.push(...body.elements.map((el) => el.id));
          return [e.DB.prepare("INSERT INTO extra VALUES ('swap')")];
        },
      }),
    );
    await w.upsertTab(env, 'A', tab('t1'), 0);
    const row = raw.prepare('SELECT rev, updated_at FROM tabs').get() as {
      rev: number;
      updated_at: number;
    };
    raw.exec("UPDATE item SET saved_at = 0 WHERE id = 'A'");
    const body = { elements: tab('t1', 2).elements };
    expect(
      await w.swapTabData(
        env,
        'A',
        't1',
        { rev: 9, updatedAt: row.updated_at },
        JSON.stringify(body),
        body,
      ),
    ).toBe(false);
    expect(raw.prepare("SELECT saved_at FROM item WHERE id = 'A'").get()).toEqual({ saved_at: 0 });
    expect(
      await w.swapTabData(
        env,
        'A',
        't1',
        { rev: row.rev, updatedAt: row.updated_at },
        JSON.stringify(body),
        body,
      ),
    ).toBe(true);
    expect(raw.prepare('SELECT rev, element_count FROM tabs').get()).toEqual({
      rev: 2,
      element_count: 2,
    });
    expect(raw.prepare('SELECT rev FROM stats').get()).toEqual({ rev: 2 });
    expect(added).toEqual(['t1-e0', 't1-e1', 't1-e0', 't1-e1']);
    await expect(
      w.swapTabData(env, 'A', 't1', { rev: 2, updatedAt: 0 }, 'x'.repeat(300), body),
    ).rejects.toThrow('swapTabData t1');
  });

  it('adds no references on a swap by default', async () => {
    const { raw, env } = item();
    const w = itemTabWrites(writesConfig());
    await w.upsertTab(env, 'A', tab('t1'), 0);
    const row = raw.prepare('SELECT rev, updated_at FROM tabs').get() as {
      rev: number;
      updated_at: number;
    };
    const body = { elements: [] };
    expect(
      await w.swapTabData(
        env,
        'A',
        't1',
        { rev: row.rev, updatedAt: row.updated_at },
        '{"elements":[]}',
        body,
      ),
    ).toBe(true);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM extra').get()).toEqual({ n: 0 });
  });
});

describe('itemTabReads', () => {
  const rowToTab = (row: {
    id: string;
    item_id: string;
    order_index: number;
    folder: string | null;
  }) => ({
    id: row.id,
    itemId: row.item_id,
    order: row.order_index,
    folder: row.folder,
  });
  const reads = (markers?: string[]) =>
    itemTabReads({
      db: (env: Env) => env.DB,
      tables,
      rowToTab,
      drawnCount: (body) => (Array.isArray(body.elements) ? body.elements.length : -1),
      ...(markers ? { commentMarkers: markers } : {}),
    });

  async function seeded() {
    const it_ = item();
    await itemTabWrites(writesConfig()).seedTabs(it_.env, 'A', [tab('t1', 2), tab('t2', 3)]);
    return it_;
  }

  it('refuses a comment marker it cannot quote, or none', () => {
    expect(() => reads(["it's"])).toThrow(/quotable/);
    expect(() => reads([])).toThrow(/quotable/);
  });

  it('reads one tab through its link, a page in order, and whether the item holds it', async () => {
    const { env } = await seeded();
    const r = reads();
    expect(await r.getTab(env, 'A', 't2')).toEqual({
      id: 't2',
      itemId: 'A',
      order: 1,
      folder: null,
    });
    expect(await r.getTab(env, 'B', 't2')).toBeNull();
    expect((await r.tabBodiesInOrder(env, 'A', 1, 5)).map((t) => t.id)).toEqual(['t2']);
    expect(await r.hasTab(env, 'A', 't1')).toBe(true);
    expect(await r.hasTab(env, 'B', 't1')).toBe(false);
  });

  it('lists the tabs holding comments, by one marker or several', async () => {
    const { raw, env } = await seeded();
    raw.exec(`UPDATE tabs SET data = '{"commentThread":1}', rev = rev + 1 WHERE id = 't2'`);
    raw.exec(`UPDATE tabs SET data = '{"cellComments":1}', rev = rev + 1 WHERE id = 't1'`);
    expect(await reads().tabIdsWithComments(env, 'A')).toEqual(['t2']);
    expect(await reads(['"commentThread"', '"cellComments"']).tabIdsWithComments(env, 'A')).toEqual(
      ['t1', 't2'],
    );
  });

  it('reads the first or a named body, its row and version, and its element count', async () => {
    const { raw, env } = await seeded();
    const r = reads();
    expect(await r.getTabBody(env, 'A')).toEqual(
      expect.objectContaining({ id: 't1', elementCount: 2 }),
    );
    expect(await r.getTabBody(env, 'A', 't2')).toEqual(
      expect.objectContaining({ id: 't2', elementCount: 3 }),
    );
    expect(await r.getTabBody(env, 'B')).toBeNull();
    expect(await r.getTabRow(env, 'A', 't1')).toEqual(expect.objectContaining({ rev: 1 }));
    expect(await r.getTabRow(env, 'B', 't1')).toBeNull();
    expect(await r.firstTabElementCount(env, 'A')).toBe(2);
    expect(await r.firstTabElementCount(env, 'B')).toBe(0);
    raw.exec("UPDATE tabs SET element_count = NULL WHERE id = 't1'");
    expect(await r.firstTabElementCount(env, 'A')).toBe(2);
    await r.stampTabElementCount(env, 't1', 7);
    await r.stampTabElementCount(env, 't1', 8);
    expect(await r.firstTabElementCount(env, 'A')).toBe(7);
    raw.exec(
      "UPDATE tabs SET element_count = NULL, data = 'not json', rev = rev + 1 WHERE id = 't1'",
    );
    expect(await r.firstTabElementCount(env, 'A')).toBe(0);
  });
});

describe('itemTabOrder', () => {
  it('reads and normalises reorder entries', () => {
    expect(readReorderEntries(['a', { id: 'b', folder: null }, { id: 'c' }])).toHaveLength(3);
    expect(readReorderEntries(['a', { id: 1 }])).toBeNull();
    expect(readReorderEntries([null])).toBeNull();
    expect(readReorderEntries([{ id: 'a', folder: 3 }])).toBeNull();
    expect(normalizeReorderEntry('a')).toEqual({ id: 'a', folder: null });
    expect(normalizeReorderEntry({ id: 'a', folder: ' Org ' })).toEqual({ id: 'a', folder: 'Org' });
    expect(normalizeReorderEntry({ id: 'a', folder: '  ' })).toEqual({ id: 'a', folder: null });
    expect(normalizeReorderEntry({ id: 'a' })).toEqual({ id: 'a', folder: null });
  });

  for (const savedAt of ['in-batch', 'after'] as const) {
    it(`places only the item's own tabs, each at its last place, saved_at ${savedAt}`, async () => {
      const { raw, env } = item();
      await itemTabWrites(writesConfig()).seedTabs(env, 'A', [tab('t1'), tab('t2')]);
      raw.exec("UPDATE item SET saved_at = 0 WHERE id = 'A'");
      const order = itemTabOrder({ db: (e: Env) => e.DB, tables, savedAt });
      await order.reorderTabs(env, 'A', ['t2', 'x', { id: 't1', folder: ' F ' }, 't2']);
      expect(
        raw.prepare('SELECT tab_id, order_index, folder FROM item_tabs ORDER BY tab_id').all(),
      ).toEqual([
        { tab_id: 't1', order_index: 2, folder: 'F' },
        { tab_id: 't2', order_index: 3, folder: null },
      ]);
      expect(raw.prepare("SELECT saved_at FROM item WHERE id = 'A'").get()).not.toEqual({
        saved_at: 0,
      });
      await order.reorderTabs(env, 'B', ['t1']);
      expect(raw.prepare("SELECT saved_at FROM item WHERE id = 'B'").get()).not.toEqual({
        saved_at: 0,
      });
    });
  }
});
