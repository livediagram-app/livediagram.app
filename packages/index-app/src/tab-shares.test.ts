import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { ItemDb } from './item-db';
import { linkSharedTab, mayLinkTabs, type TabLinkAccess } from './tab-link';
import {
  createTabShares,
  DRAIN_SHARES,
  MAX_TAB_HOLDERS,
  owesShares,
  ShareSchedule,
  tabSharesSchema,
  type ShareDb,
  type ShareMessage,
  type SharedTabBody,
} from './tab-shares';
import { nodeItemSql, nodeSql, nodeTransaction } from './test-sqlite';

// A tab shared between items, each item on its own SQLite as each is its own Durable Object in production. The
// app here is the smallest one: `tabs`, a link table, a saved time, and a derived row (`stats`) a body keeps.
const SCHEMA = `
CREATE TABLE item (id TEXT PRIMARY KEY, saved_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE tabs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0
);
CREATE TRIGGER tabs_rev_advances BEFORE UPDATE OF data ON tabs WHEN NEW.rev IS NOT OLD.rev + 1
  BEGIN SELECT RAISE(ABORT, 'tab_rev_stale'); END;
CREATE TABLE item_tabs (
  item_id TEXT NOT NULL REFERENCES item (id) ON DELETE CASCADE,
  tab_id TEXT NOT NULL REFERENCES tabs (id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (item_id, tab_id)
);
CREATE TABLE stats (tab_id TEXT PRIMARY KEY REFERENCES tabs (id) ON DELETE CASCADE, bytes INTEGER NOT NULL);
CREATE TABLE granted (image_id TEXT PRIMARY KEY);
${tabSharesSchema()}
`;

const statsOf = (db: ShareDb, tab: SharedTabBody) =>
  db
    .prepare('INSERT OR REPLACE INTO stats (tab_id, bytes) VALUES (?, ?)')
    .bind(tab.id, tab.data.length);

// The env here is the item's database itself.
const shares = createTabShares<ShareDb>({
  db: (db) => db,
  linkTable: 'item_tabs',
  itemColumn: 'item_id',
  insertTab: (db, itemId, tab, orderIndex) => [
    db
      .prepare('INSERT INTO tabs (id, name, data, updated_at, rev) VALUES (?, ?, ?, ?, 1)')
      .bind(tab.id, tab.name, tab.data, Date.now()),
    db
      .prepare('INSERT INTO item_tabs (item_id, tab_id, order_index) VALUES (?, ?, ?)')
      .bind(itemId, tab.id, orderIndex),
    statsOf(db, tab),
  ],
  bodyTaken: (db, itemId, tab, now) => [
    statsOf(db, tab),
    db.prepare('UPDATE item SET saved_at = ? WHERE id = ?').bind(now, itemId),
  ],
  // The images the sender may serve travel with the body, and the receiver grants them.
  extra: {
    read: async (_db, _itemId, tab) =>
      tab.data.includes('img') ? { images: ['img-1'] } : undefined,
    // Only an image the body places.
    apply: async (db, _itemId, tab, extra) =>
      (extra as { images: string[] }).images
        .filter((id) => tab.data.includes(id))
        .map((id) => db.prepare('INSERT OR IGNORE INTO granted (image_id) VALUES (?)').bind(id)),
  },
});

type Item = { id: string; db: ShareDb; raw: DatabaseSync };

function world() {
  const items = new Map<string, Item>();
  const calls: string[] = [];
  const open = (id: string): Item => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('PRAGMA foreign_keys = ON');
    raw.exec(SCHEMA);
    raw.prepare('INSERT INTO item (id) VALUES (?)').run(id);
    const db = new ItemDb(nodeItemSql(raw), {
      transaction: nodeTransaction(raw),
      ensureSchema: () => {},
      onWrite: () => {},
    }).asD1();
    const item = { id, db, raw };
    items.set(id, item);
    return item;
  };
  const get = (id: string) => items.get(id)!;
  // A send to another item's Durable Object: `gone` from one that does not exist.
  const send = (from: string) => async (to: string, messages: ShareMessage[]) => {
    calls.push(`${from}->${to}:${messages.map((m) => m.kind).join(',')}`);
    const target = items.get(to);
    if (!target) return messages.map(() => 'gone' as const);
    return shares.receive(target.db, to, from, messages);
  };
  const room = (from: string) => ({
    sharedTabCopy: (tabId: string) => shares.copyOf(get(from).db, from, tabId),
    shareJoined: (tabId: string, member: string, seen: number) =>
      shares.recordJoin(get(from).db, from, tabId, member, seen),
  });
  const edit: TabLinkAccess = { level: 'edit', tab: null, shareCode: null };
  const link = (
    target: string,
    tabId: string,
    from: unknown,
    access: {
      target?: TabLinkAccess | null;
      source?: TabLinkAccess | null;
      workbench?: boolean;
    } = {},
  ) =>
    linkSharedTab({
      targetId: target,
      tabId,
      from,
      workbench: access.workbench ?? false,
      target: access.target === undefined ? edit : access.target,
      source: async (id) =>
        !items.has(id) ? 'missing' : access.source === undefined ? edit : access.source,
      held: async () =>
        (get(target)
          .raw.prepare(
            'SELECT t.id, t.name FROM tabs t JOIN item_tabs l ON l.tab_id = t.id WHERE l.item_id = ? AND t.id = ?',
          )
          .get(target, tabId) as { id: string; name: string } | undefined) ?? null,
      sourceRoom: room,
      take: (copy) => shares.take(get(target).db, target, tabId, copy),
    });
  const drain = async (...ids: string[]) => {
    for (const id of ids) {
      while (owesShares(nodeSql(get(id).raw))) {
        const { failed } = await shares.drain(get(id).db, id, send(id));
        if (failed > 0) break;
      }
    }
  };
  const save = async (id: string, data: string, tabId = 't1') => {
    await new Promise((r) => setTimeout(r, 2));
    get(id)
      .raw.prepare('UPDATE tabs SET data = ?, updated_at = ?, rev = rev + 1 WHERE id = ?')
      .run(data, Date.now(), tabId);
  };
  const dataOf = (id: string, tabId = 't1') =>
    (get(id).raw.prepare('SELECT data FROM tabs WHERE id = ?').get(tabId)?.data as
      string | undefined) ?? null;
  const holders = (id: string, tabId = 't1') =>
    get(id)
      .raw.prepare('SELECT item_id FROM tab_shares WHERE tab_id = ? ORDER BY item_id')
      .all(tabId)
      .map((r) => r.item_id);
  const owed = (id: string) =>
    Number(get(id).raw.prepare('SELECT COUNT(*) AS n FROM share_outbox').get()!.n);
  const deleteTab = async (id: string, tabId = 't1') => {
    const db = get(id).db;
    await db.batch([
      db.prepare('DELETE FROM item_tabs WHERE item_id = ? AND tab_id = ?').bind(id, tabId),
      ...shares.leaveStatements(db, tabId),
      db.prepare('DELETE FROM tabs WHERE id = ?').bind(tabId),
    ]);
  };
  return { items, calls, open, get, send, link, drain, save, dataOf, holders, owed, deleteTab };
}

function withTab(w: ReturnType<typeof world>, id: string, data = '{"v":"from A"}', tabId = 't1') {
  const item = w.open(id);
  item.raw
    .prepare('INSERT INTO tabs (id, name, data, updated_at, rev) VALUES (?, ?, ?, ?, 1)')
    .run(tabId, 'Board', data, Date.now());
  item.raw
    .prepare('INSERT INTO item_tabs (item_id, tab_id, order_index) VALUES (?, ?, 0)')
    .run(id, tabId);
  return item;
}

describe('a tab shared between items', () => {
  it('links the tab into another item: the same tab, at the end of its order', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    const out = await w.link('B', 't1', 'A');
    expect(out).toEqual({ ok: true, tab: { id: 't1', name: 'Board' } });
    expect(w.dataOf('B')).toBe('{"v":"from A"}');
    expect(
      w.get('B').raw.prepare("SELECT order_index FROM item_tabs WHERE tab_id = 't1'").get(),
    ).toEqual({
      order_index: 1,
    });
    expect(w.holders('A')).toEqual(['B']);
    expect(w.holders('B')).toEqual(['A']);
    expect(await shares.count(w.get('A').db, 'A')).toEqual({ tabs: 1, items: 1 });
    expect(await shares.count(w.get('B').db, 'B')).toEqual({ tabs: 1, items: 1 });
    // A repeat is answered as it is, and adds nothing.
    expect(await w.link('B', 't1', 'A')).toMatchObject({ ok: true });
    expect(w.get('B').raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()!.n).toBe(2);
  });

  it('carries an edit in either item to the other, without sending it back', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    await w.link('B', 't1', 'A');
    await w.save('A', '{"v":"edited in A"}');
    expect(w.dataOf('B')).toBe('{"v":"from A"}');
    await w.drain('A');
    expect(w.dataOf('B')).toBe('{"v":"edited in A"}');
    // The derived rows follow the copy taken in.
    expect(w.get('B').raw.prepare("SELECT bytes FROM stats WHERE tab_id = 't1'").get()).toEqual({
      bytes: 19,
    });
    expect(w.owed('B')).toBe(0);
    await w.save('B', '{"v":"edited in B"}');
    await w.drain('B');
    expect(w.dataOf('A')).toBe('{"v":"edited in B"}');
    expect(w.owed('A')).toBe(0);
  });

  it('keeps the later of two writes in every item', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    await w.link('B', 't1', 'A');
    await w.save('B', '{"v":"earlier"}');
    await w.save('A', '{"v":"later"}');
    await w.drain('B', 'A');
    expect(w.dataOf('A')).toBe('{"v":"later"}');
    expect(w.dataOf('B')).toBe('{"v":"later"}');
  });

  it('shares on through a third item, which every holder then hears of', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    withTab(w, 'C', '{}', 'own');
    await w.link('B', 't1', 'A');
    expect(await w.link('C', 't1', 'B')).toMatchObject({ ok: true });
    expect(w.holders('C')).toEqual(['A', 'B']);
    expect(w.holders('A')).toEqual(['B']);
    await w.drain('B');
    expect(w.holders('A')).toEqual(['B', 'C']);
    await w.save('C', '{"v":"edited in C"}');
    await w.drain('C');
    expect(w.dataOf('A')).toBe('{"v":"edited in C"}');
    expect(w.dataOf('B')).toBe('{"v":"edited in C"}');
    expect(await shares.count(w.get('A').db, 'A')).toEqual({ tabs: 1, items: 2 });
  });

  it('passes a write on to a holder the writer had not heard of yet', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    withTab(w, 'C', '{}', 'own');
    await w.link('B', 't1', 'A');
    await w.link('C', 't1', 'B');
    await w.save('A', '{"v":"edited in A"}');
    // Only A's message to B: B's join notice to A is still owed.
    await shares.drain(w.get('A').db, 'A', w.send('A'));
    expect(w.dataOf('C')).toBe('{"v":"from A"}');
    await w.drain('B');
    expect(w.dataOf('C')).toBe('{"v":"edited in A"}');
  });

  it('leaves the others their copy when one item drops the tab, or goes for good', async () => {
    const w = world();
    withTab(w, 'A');
    for (const id of ['B', 'C']) {
      withTab(w, id, '{}', 'own');
      await w.link(id, 't1', 'A');
    }
    await w.drain('A');
    await w.deleteTab('B');
    await w.drain('B');
    expect(w.holders('A')).toEqual(['C']);
    expect(w.holders('C')).toEqual(['A']);
    expect(w.dataOf('A')).toBe('{"v":"from A"}');

    // C is purged: it tells A first, and A's copy stays whole.
    expect(await shares.leaveAll(w.get('C').db, 'C', w.send('C'))).toBe(1);
    w.items.delete('C');
    expect(w.holders('A')).toEqual([]);
    expect(await shares.count(w.get('A').db, 'A')).toEqual({ tabs: 0, items: 0 });
    expect(w.dataOf('A')).toBe('{"v":"from A"}');
  });

  it('drops a holder that no longer has the tab when it says so', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    await w.link('B', 't1', 'A');
    w.get('B').raw.prepare("DELETE FROM tabs WHERE id = 't1'").run();
    await w.save('A', '{"v":"x"}');
    await w.drain('A');
    expect(w.holders('A')).toEqual([]);
    expect(w.owed('A')).toBe(0);
  });

  it('keeps a failed send for the next drain', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    await w.link('B', 't1', 'A');
    await w.save('A', '{"v":"x"}');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = async () => {
      throw new Error('unreachable');
    };
    expect(await shares.drain(w.get('A').db, 'A', failing)).toMatchObject({ sent: 0, failed: 1 });
    expect(w.owed('A')).toBe(1);
    await w.drain('A');
    expect(w.dataOf('B')).toBe('{"v":"x"}');
  });

  it('carries the app’s extra beside a body (the images the sender may serve)', async () => {
    const w = world();
    withTab(w, 'A', '{"img":"img-1"}');
    withTab(w, 'B', '{}', 'own');
    await w.link('B', 't1', 'A');
    expect(w.get('B').raw.prepare('SELECT image_id FROM granted').all()).toEqual([
      { image_id: 'img-1' },
    ]);
  });

  it('sends at most DRAIN_SHARES messages a drain, and says there are more', async () => {
    const w = world();
    withTab(w, 'A');
    const db = w.get('A').db;
    const rows = Array.from({ length: DRAIN_SHARES + 5 }, (_, i) =>
      db
        .prepare("INSERT INTO share_outbox (kind, tab_id, to_item) VALUES ('leave', ?, 'Z')")
        .bind(`x${i}`),
    );
    await db.batch(rows);
    const out = await shares.drain(db, 'A', w.send('A'));
    expect(out).toEqual({ sent: DRAIN_SHARES, failed: 0, more: true });
  });
});

describe('who may link a tab', () => {
  const edit: TabLinkAccess = { level: 'edit', tab: null, shareCode: null };

  it('is a person who edits the item as one of its own', () => {
    expect(mayLinkTabs(edit)).toBe(true);
    expect(mayLinkTabs(null)).toBe(false);
    expect(mayLinkTabs({ ...edit, level: 'participate' })).toBe(false);
    expect(mayLinkTabs({ ...edit, level: 'view' })).toBe(false);
    // An editor through a share link, or one confined to one tab, is not.
    expect(mayLinkTabs({ ...edit, shareCode: 'abc' })).toBe(false);
    expect(mayLinkTabs({ ...edit, tab: 't1' })).toBe(false);
  });

  it('refuses a tab the caller cannot edit, or into an item they cannot edit', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    const viewer: TabLinkAccess = { level: 'view', tab: null, shareCode: null };
    const linkEditor: TabLinkAccess = { level: 'edit', tab: null, shareCode: 'code' };
    expect(await w.link('B', 't1', 'A', { source: null })).toMatchObject({ status: 403 });
    expect(await w.link('B', 't1', 'A', { source: viewer })).toMatchObject({ status: 403 });
    expect(await w.link('B', 't1', 'A', { source: linkEditor })).toMatchObject({ status: 403 });
    expect(await w.link('B', 't1', 'A', { target: null })).toMatchObject({ status: 403 });
    expect(await w.link('B', 't1', 'A', { target: viewer })).toMatchObject({ status: 403 });
    expect(await w.link('B', 't1', 'A', { target: { ...edit, tab: 'own' } })).toMatchObject({
      status: 403,
    });
    expect(await w.link('B', 't1', 'A', { workbench: true })).toMatchObject({ status: 403 });
    expect(w.get('B').raw.prepare('SELECT COUNT(*) AS n FROM tabs').get()!.n).toBe(1);
    expect(w.holders('A')).toEqual([]);
  });

  it('answers 400, 404 and a refusal the index gave', async () => {
    const w = world();
    withTab(w, 'A');
    withTab(w, 'B', '{}', 'own');
    expect(await w.link('B', 't1', undefined)).toMatchObject({ status: 400 });
    expect(await w.link('B', 't1', 'B')).toMatchObject({ status: 400 });
    expect(await w.link('B', 't1', 'missing')).toMatchObject({ status: 404 });
    expect(await w.link('B', 'nope', 'A')).toMatchObject({ status: 404 });
    const refusal = new Response('{"error":"password_required"}', { status: 401 });
    const out = await linkSharedTab({
      targetId: 'B',
      tabId: 't1',
      from: 'A',
      workbench: false,
      target: edit,
      source: async () => refusal,
      held: async () => null,
      sourceRoom: () => ({ sharedTabCopy: async () => null, shareJoined: async () => false }),
      take: async () => false,
    });
    expect(out).toEqual({ ok: false, response: refusal });
  });

  it(`holds a tab in at most ${MAX_TAB_HOLDERS} items`, async () => {
    const w = world();
    withTab(w, 'A');
    for (let i = 1; i < MAX_TAB_HOLDERS; i++) {
      withTab(w, `S${i}`, '{}', 'own');
      expect(await w.link(`S${i}`, 't1', 'A')).toMatchObject({ ok: true });
    }
    expect(await shares.holders(w.get('A').db, 'A', 't1')).toBe(MAX_TAB_HOLDERS);
    withTab(w, 'X', '{}', 'own');
    expect(await w.link('X', 't1', 'A')).toMatchObject({ status: 409, error: 'too_many_holders' });
  });
});

// The hot paths: a save to a shared tab (one more primary-key read, from the trigger) and its fan-out to every other
// holder (one call each, the body read once). Wall-clock budgets, generous for a loaded machine.
describe('cost', () => {
  it(`fans a 1 MB edit out to ${MAX_TAB_HOLDERS - 1} holders within budget`, async () => {
    const w = world();
    withTab(w, 'A');
    for (let i = 1; i < MAX_TAB_HOLDERS; i++) {
      withTab(w, `S${i}`, '{}', 'own');
      await w.link(`S${i}`, 't1', 'A');
    }
    await w.drain('A', ...Array.from({ length: MAX_TAB_HOLDERS - 1 }, (_, i) => `S${i + 1}`));
    const big = JSON.stringify({ v: 'x'.repeat(1_000_000) });
    const saveStart = performance.now();
    await w.save('A', big);
    const saveMs = performance.now() - saveStart - 2;
    w.calls.length = 0;
    const start = performance.now();
    await w.drain('A');
    const fanOutMs = performance.now() - start;
    expect(w.calls).toHaveLength(MAX_TAB_HOLDERS - 1);
    expect(w.dataOf(`S${MAX_TAB_HOLDERS - 1}`)).toBe(big);
    console.info('[perf] 1 MB shared-tab edit', { holders: MAX_TAB_HOLDERS, saveMs, fanOutMs });
    expect(fanOutMs).toBeLessThan(2_000);
  });

  it('adds next to nothing to a save of a tab that is not shared', async () => {
    const w = world();
    withTab(w, 'A');
    const start = performance.now();
    for (let i = 0; i < 1_000; i++) {
      w.get('A')
        .raw.prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
        .run(`{"i":${i}}`);
    }
    const ms = performance.now() - start;
    expect(w.owed('A')).toBe(0);
    console.info('[perf] 1,000 saves of an unshared tab', { ms });
    expect(ms).toBeLessThan(1_000);
  });
});

describe('ShareSchedule', () => {
  it('sends on idle after a write, again a minute after a failure, and keeps what was written meanwhile', async () => {
    let owed = false;
    let now = 1_000;
    const schedule = new ShareSchedule(
      () => owed,
      () => now,
    );
    expect(schedule.noteWrite()).toBe(false);
    owed = true;
    expect(schedule.noteWrite()).toBe(true);
    expect(schedule.at).toBe(3_000);
    expect(schedule.noteWrite()).toBe(false);
    expect(schedule.due(2_999)).toBe(false);
    expect(schedule.due(3_000)).toBe(true);
    now = 3_000;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await schedule.send(async () => ({ sent: 0, failed: 1, more: false }));
    expect(schedule.at).toBe(63_000);
    await schedule.send(async () => {
      throw new Error('down');
    });
    expect(schedule.at).toBe(63_000);
    await schedule.send(async () => ({ sent: 50, failed: 0, more: true }));
    expect(schedule.at).toBe(5_000);
    await schedule.send(async () => ({ sent: 1, failed: 0, more: false }));
    expect(schedule.at).toBe(5_000);
    owed = false;
    await schedule.send(async () => ({ sent: 1, failed: 0, more: false }));
    expect(schedule.at).toBeNull();
    owed = true;
    schedule.restore();
    expect(schedule.at).toBe(3_000);
  });
});
