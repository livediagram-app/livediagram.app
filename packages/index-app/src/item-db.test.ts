import { describe, expect, it } from 'vitest';
import { ItemDb, type ItemSql } from './item-db';
import { nodeSql, nodeTransaction } from './test-sqlite';

// The adapter tells the room only about calls that changed a row: a read (one statement or a batch of them) and
// a write that matched nothing are not writes, so they record no edit key and arm no outbox flush.
function itemDb() {
  const sql = nodeSql();
  sql.exec('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
  sql.exec('CREATE TABLE log (id INTEGER PRIMARY KEY AUTOINCREMENT, t_id TEXT)');
  sql.exec(
    'CREATE TRIGGER t_log AFTER UPDATE ON t BEGIN INSERT INTO log (t_id) VALUES (NEW.id); END',
  );
  sql.exec("INSERT INTO t (id, v) VALUES ('a', 1)");
  let writes = 0;
  const db = new ItemDb(sql as unknown as ItemSql, {
    transaction: (fn) => fn(),
    ensureSchema: () => {},
    onWrite: () => void writes++,
  });
  return { db, writes: () => writes };
}

describe('ItemDb onWrite', () => {
  it('is not called for reads, one at a time or in a batch', async () => {
    const { db, writes } = itemDb();
    await db.prepare('SELECT * FROM t WHERE id = ?').bind('a').first();
    await db.prepare('SELECT * FROM t').all();
    await db.batch([db.prepare('SELECT * FROM t'), db.prepare('SELECT COUNT(*) FROM log')]);
    expect(writes()).toBe(0);
  });

  it('is not called for a write that changed nothing', async () => {
    const { db, writes } = itemDb();
    const missed = await db.prepare('UPDATE t SET v = 2 WHERE id = ?').bind('nope').run();
    await db.prepare("INSERT OR IGNORE INTO t (id, v) VALUES ('a', 9)").run();
    await db.batch([db.prepare("DELETE FROM t WHERE id = 'nope'")]);
    expect(missed.meta.changes).toBe(0);
    expect(writes()).toBe(0);
  });

  it('is called once per call that changed a row, a batch counting once', async () => {
    const { db, writes } = itemDb();
    const run = await db.prepare('UPDATE t SET v = 2 WHERE id = ?').bind('a').run();
    expect(run.meta.changes).toBe(1);
    expect(writes()).toBe(1);
    await db.batch([
      db.prepare('SELECT * FROM t'),
      db.prepare("INSERT INTO t (id, v) VALUES ('b', 1)"),
      db.prepare("INSERT INTO t (id, v) VALUES ('c', 1)"),
    ]);
    expect(writes()).toBe(2);
  });
});

// batchEach: one transaction over statements a generator makes as they run, so none is held before its turn.
describe('ItemDb batchEach', () => {
  function txDb() {
    const sql = nodeSql();
    sql.exec('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
    let writes = 0;
    const db = new ItemDb(sql as unknown as ItemSql, {
      transaction: nodeTransaction(sql.db),
      ensureSchema: () => {},
      onWrite: () => void writes++,
    });
    const ids = () =>
      sql.db
        .prepare('SELECT id FROM t ORDER BY id')
        .all()
        .map((r) => r['id']);
    return { db, ids, writes: () => writes };
  }

  it('runs each statement as it is made, answering every result in order, as one write', async () => {
    const { db, ids, writes } = txDb();
    const made: string[] = [];
    function* statements() {
      for (const id of ['a', 'b', 'c']) {
        made.push(id);
        // The statements before this one already ran: it is made after they landed.
        expect(ids()).toHaveLength(made.length - 1);
        yield db.prepare('INSERT INTO t (id, v) VALUES (?, 1)').bind(id);
      }
      yield db.prepare('SELECT COUNT(*) AS n FROM t');
    }
    const results = await db.batchEach(statements());
    expect(results.map((r) => r.meta.changes)).toEqual([1, 1, 1, 0]);
    expect(results[3]!.results).toEqual([{ n: 3 }]);
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(writes()).toBe(1);
  });

  it('rolls everything back when a statement fails part way', async () => {
    const { db, ids, writes } = txDb();
    function* statements() {
      yield db.prepare("INSERT INTO t (id, v) VALUES ('a', 1)");
      yield db.prepare("INSERT INTO t (id, v) VALUES ('a', 2)");
    }
    await expect(db.batchEach(statements())).rejects.toThrow();
    expect(ids()).toEqual([]);
    expect(writes()).toBe(0);
  });

  it('rolls everything back when the generator itself throws', async () => {
    const { db, ids } = txDb();
    function* statements() {
      yield db.prepare("INSERT INTO t (id, v) VALUES ('a', 1)");
      throw new Error('planned');
    }
    await expect(db.batchEach(statements())).rejects.toThrow('planned');
    expect(ids()).toEqual([]);
  });

  it('is batch for an array, which runs through it', async () => {
    const { db, ids } = txDb();
    await db.batch([db.prepare("INSERT INTO t (id, v) VALUES ('z', 1)")]);
    expect(ids()).toEqual(['z']);
  });
});
