import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECTIONS_PER_ITEM,
  type IndexAppClient,
  type TabConnection,
} from '@liveworkspace/index-client';
import {
  TAB_CONNECTION_SCHEMA,
  appendConnectedTab,
  confirmTabConnection,
  connectionLeftStatement,
  connectionToKeep,
  sameConnection,
  storedTabConnection,
  tabConnectionOf,
  tabConnectionStatement,
} from './connected-tabs';
import { CONNECTION_LEFT_KIND, connectionLeftKeyOf } from './outbox';
import { handleInternalItems, type InternalItemHandlers } from './internal';
import { ItemDb } from './item-db';
import { nodeItemSql, nodeTransaction } from './test-sqlite';

afterEach(() => vi.restoreAllMocks());

const CONNECTION: TabConnection = { id: 'cn_abcdefghijklmnop', app: 'liveplanner', itemId: 'p1' };
const other = (n: number): TabConnection => ({
  id: `cn_${String(n).padStart(16, '0')}`,
  app: 'livedesign',
  itemId: `d${n}`,
});

function item() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`
    CREATE TABLE tabs (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE item_tabs (item_id TEXT NOT NULL, tab_id TEXT NOT NULL, order_index INTEGER NOT NULL);
    ${TAB_CONNECTION_SCHEMA}
  `);
  const db = new ItemDb(nodeItemSql(raw), {
    transaction: nodeTransaction(raw),
    ensureSchema: () => {},
    onWrite: () => {},
  }).asD1();
  let n = 0;
  const append = (write = { name: 'Plan', connection: CONNECTION }) =>
    appendConnectedTab(db, 'A', write, {
      linkTable: 'item_tabs',
      itemColumn: 'item_id',
      newId: () => `t${++n}`,
      insertTab: (tabId, name, orderIndex) => [
        db.prepare("INSERT INTO tabs (id, name, data) VALUES (?, ?, '{}')").bind(tabId, name),
        db
          .prepare('INSERT INTO item_tabs (item_id, tab_id, order_index) VALUES (?, ?, ?)')
          .bind('A', tabId, orderIndex),
      ],
    });
  const rows = () =>
    raw
      .prepare(
        'SELECT t.id, t.name, l.order_index, t.connection FROM tabs t JOIN item_tabs l ON l.tab_id = t.id ORDER BY l.order_index',
      )
      .all();
  return { raw, db, append, rows };
}

describe('appendConnectedTab', () => {
  it('adds one loose tab at the end, holding the connection and nothing else', async () => {
    const it_ = item();
    it_.raw.exec("INSERT INTO tabs (id, name, data) VALUES ('own', 'Board', '{}')");
    it_.raw.exec("INSERT INTO item_tabs VALUES ('A', 'own', 0)");
    expect(await it_.append()).toEqual({ tabId: 't1', made: true });
    expect(it_.rows()).toEqual([
      { id: 'own', name: 'Board', order_index: 0, connection: null },
      {
        id: 't1',
        name: 'Plan',
        order_index: 1,
        connection: '{"id":"cn_abcdefghijklmnop","app":"liveplanner","itemId":"p1"}',
      },
    ]);
  });

  it('answers the same tab for the same connection, adding nothing', async () => {
    const it_ = item();
    await it_.append();
    expect(await it_.append()).toEqual({ tabId: 't1', made: false });
    expect(it_.rows()).toHaveLength(1);
  });

  it('refuses past CONNECTIONS_PER_ITEM', async () => {
    const it_ = item();
    for (let i = 0; i < CONNECTIONS_PER_ITEM; i++)
      await it_.append({ name: `F${i}`, connection: other(i) });
    expect(await it_.append()).toBe('connection_limit');
    expect(it_.rows()).toHaveLength(CONNECTIONS_PER_ITEM);
  });

  it('refuses a table name that is not one', async () => {
    const it_ = item();
    await expect(
      appendConnectedTab(
        it_.db,
        'A',
        { name: 'x', connection: CONNECTION },
        {
          linkTable: 'item_tabs; DROP',
          itemColumn: 'item_id',
          insertTab: () => [],
        },
      ),
    ).rejects.toThrow('bad table name');
  });

  it('makes a random id by default', async () => {
    const it_ = item();
    const out = await appendConnectedTab(
      it_.db,
      'A',
      { name: 'x', connection: CONNECTION },
      { linkTable: 'item_tabs', itemColumn: 'item_id', insertTab: () => [] },
    );
    expect(out).toMatchObject({ made: true, tabId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });
});

describe('the column', () => {
  it('sets and clears a tab connection, and reads it back', async () => {
    const it_ = item();
    it_.raw.exec("INSERT INTO tabs (id, name, data) VALUES ('t', 'T', '{}')");
    await tabConnectionStatement(it_.db, 't', CONNECTION).run();
    const text = it_.raw.prepare("SELECT connection FROM tabs WHERE id = 't'").get()!.connection;
    expect(storedTabConnection(text as string)).toEqual(CONNECTION);
    await tabConnectionStatement(it_.db, 't', null).run();
    expect(it_.raw.prepare("SELECT connection FROM tabs WHERE id = 't'").get()!.connection).toBe(
      null,
    );
    expect(storedTabConnection(null)).toBeNull();
  });
});

describe('what a save keeps', () => {
  it('reads exactly { id, app, itemId } from a body, or nothing', () => {
    expect(tabConnectionOf({ connection: { ...CONNECTION, code: 'secret' } })).toEqual(CONNECTION);
    expect(tabConnectionOf({ connection: { id: 'nope' } })).toBeUndefined();
    expect(tabConnectionOf({})).toBeUndefined();
    expect(tabConnectionOf(null)).toBeUndefined();
  });

  it('keeps a sent connection on a new or connected tab, never on a tab of content', () => {
    expect(connectionToKeep(CONNECTION, { exists: false, connection: null })).toEqual(CONNECTION);
    expect(connectionToKeep(CONNECTION, { exists: true, connection: other(1) })).toEqual(
      CONNECTION,
    );
    expect(connectionToKeep(CONNECTION, { exists: true, connection: null })).toBeUndefined();
    expect(connectionToKeep(undefined, { exists: false, connection: null })).toBeUndefined();
  });

  it('compares connections by every field', () => {
    expect(sameConnection(CONNECTION, { ...CONNECTION })).toBe(true);
    expect(sameConnection(CONNECTION, { ...CONNECTION, itemId: 'p2' })).toBe(false);
    expect(sameConnection(null, undefined)).toBe(true);
    expect(sameConnection(CONNECTION, null)).toBe(false);
  });
});

describe('telling the index', () => {
  const client = (fail = false) => {
    const confirmConnection = vi.fn(async () => {
      if (fail) throw new Error('down');
    });
    return {
      confirmConnection,
      client: { confirmConnection } as unknown as IndexAppClient,
    };
  };

  it('confirms a connected tab', async () => {
    const c = client();
    await confirmTabConnection(c.client, 'H', 't1', CONNECTION);
    expect(c.confirmConnection).toHaveBeenCalledWith('H', CONNECTION.id, 't1');
  });

  it('confirms nothing with no index', async () => {
    const c = client();
    await confirmTabConnection(null, 'H', 't1', CONNECTION);
    expect(c.confirmConnection).not.toHaveBeenCalled();
  });

  it('logs an index out of reach rather than failing the write', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = client(true);
    await confirmTabConnection(c.client, 'H', 't1', CONNECTION);
    expect(warn).toHaveBeenCalledWith('[connections] confirm failed', expect.any(Object));
  });
});

describe('the removal, in the outbox', () => {
  const OUTBOX = { table: 'outbox', itemColumn: 'item_id' } as const;
  function host() {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`
      CREATE TABLE tabs (id TEXT PRIMARY KEY, name TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE item_tabs (item_id TEXT NOT NULL, tab_id TEXT NOT NULL, order_index INTEGER NOT NULL);
      CREATE TABLE outbox (id INTEGER PRIMARY KEY, item_id TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL,
        UNIQUE (item_id, kind, key));
      ${TAB_CONNECTION_SCHEMA}
    `);
    const db = new ItemDb(nodeItemSql(raw), {
      transaction: nodeTransaction(raw),
      ensureSchema: () => {},
      onWrite: () => {},
    }).asD1();
    const add = (tabId: string, connection: string | null) => {
      raw
        .prepare("INSERT INTO tabs (id, name, data, connection) VALUES (?, 'T', '{}', ?)")
        .run(tabId, connection);
      raw.prepare("INSERT INTO item_tabs VALUES ('H', ?, 0)").run(tabId);
    };
    // The app's delete: the unlink, the key, then the tab's row.
    const remove = (tabId: string, unlink = true) =>
      db.batch([
        db
          .prepare('DELETE FROM item_tabs WHERE item_id = ? AND tab_id = ? AND ? = 1')
          .bind('H', tabId, unlink ? 1 : 0),
        connectionLeftStatement(db, OUTBOX, 'item_tabs', 'H', tabId),
        db
          .prepare(
            'DELETE FROM tabs WHERE id = ? AND NOT EXISTS (SELECT 1 FROM item_tabs WHERE tab_id = ?)',
          )
          .bind(tabId, tabId),
      ]);
    const keys = () =>
      raw.prepare('SELECT item_id, kind, key FROM outbox ORDER BY id').all() as {
        item_id: string;
        kind: string;
        key: string;
      }[];
    return { add, remove, keys };
  }

  it('keys a connected tab that left with its connection id and tab id, as the drain reads it', async () => {
    const h = host();
    h.add('t2', JSON.stringify(CONNECTION));
    await h.remove('t2');
    expect(h.keys()).toEqual([
      {
        item_id: 'H',
        kind: CONNECTION_LEFT_KIND,
        key: connectionLeftKeyOf({ connectionId: CONNECTION.id, tabId: 't2' }),
      },
    ]);
  });

  it('keys nothing for a tab with no connection, a malformed one, or one still in the item', async () => {
    const h = host();
    h.add('t1', null);
    h.add('t3', 'not json');
    h.add('t4', JSON.stringify({ app: 'livedesign' }));
    h.add('t5', JSON.stringify(CONNECTION));
    await h.remove('t1');
    await h.remove('t3');
    await h.remove('t4');
    await h.remove('t5', false);
    expect(h.keys()).toEqual([]);
  });

  it('keys a connection made again in the same tab apart from the first', async () => {
    const h = host();
    h.add('t2', JSON.stringify(CONNECTION));
    await h.remove('t2');
    h.add('t2', JSON.stringify(other(7)));
    await h.remove('t2');
    expect(h.keys().map((k) => JSON.parse(k.key).connectionId)).toEqual([
      CONNECTION.id,
      other(7).id,
    ]);
  });

  it('refuses a table name that is not one word', () => {
    const h = item();
    expect(() =>
      connectionLeftStatement(
        h.db,
        { table: 'outbox; --', itemColumn: 'item_id' },
        'item_tabs',
        'H',
        't',
      ),
    ).toThrow('bad table name');
  });
});

describe('the internal door', () => {
  const send = (body: unknown, connectedTab?: InternalItemHandlers['connectedTab']) =>
    handleInternalItems(
      new Request('https://app.test/api/internal/items/A/connected-tabs', {
        method: 'POST',
        headers: { Authorization: 'Bearer k', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { key: 'k', handlers: { purge: async () => {}, ...(connectedTab ? { connectedTab } : {}) } },
    );

  it('answers 201 { tabId } for a new tab, and 200 for one it made already', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const run = vi.fn(async () => ({ tabId: 't1', made: true }));
    const res = await send({ name: ' Diagram ', connection: { ...CONNECTION, code: 'x' } }, run);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ tabId: 't1' });
    expect(run).toHaveBeenCalledWith('A', { name: 'Diagram', connection: CONNECTION });
    const again = await send({ name: 'D', connection: CONNECTION }, async () => ({
      tabId: 't1',
      made: false,
    }));
    expect(again.status).toBe(200);
  });

  it('refuses a malformed write, and answers 404, 409 and 503', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi.fn(async () => 'not_found' as const);
    expect((await send({ name: 'D', connection: { id: 'x' } }, run)).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
    expect((await send({ name: 'D', connection: CONNECTION }, run)).status).toBe(404);
    const full = await send({ name: 'D', connection: CONNECTION }, async () => 'connection_limit');
    expect(full.status).toBe(409);
    expect(await full.json()).toEqual({ error: 'connection_limit' });
    const down = await send({ name: 'D', connection: CONNECTION }, async () => {
      throw new Error('down');
    });
    expect(down.status).toBe(503);
  });

  it('is a 404 for an app without the door', async () => {
    expect((await send({ name: 'D', connection: CONNECTION })).status).toBe(404);
  });
});
