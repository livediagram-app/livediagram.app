import { describe, expect, it } from 'vitest';
import { ItemDb, type ItemSql } from './item-db';
import { nodeSql } from './test-sqlite';

// The adapter tells the room only about calls that changed a row: a read (one statement or a batch of them) and
// a write that matched nothing are not writes, so they record no edit key and arm no outbox flush.
function itemDb() {
  const sql = nodeSql();
  sql.exec('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
  sql.exec('CREATE TABLE log (id INTEGER PRIMARY KEY AUTOINCREMENT, t_id TEXT)');
  sql.exec('CREATE TRIGGER t_log AFTER UPDATE ON t BEGIN INSERT INTO log (t_id) VALUES (NEW.id); END');
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
