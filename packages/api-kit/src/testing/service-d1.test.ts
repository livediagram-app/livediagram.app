import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { serviceD1 } from './service-d1';

const dir = mkdtempSync(join(tmpdir(), 'service-d1-')) + '/';
writeFileSync(
  join(dir, '0002_u.sql'),
  'CREATE TABLE u (id INTEGER PRIMARY KEY, t INTEGER REFERENCES t (a));',
);
writeFileSync(
  join(dir, '0001_t.sql'),
  'CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT, ok INTEGER);',
);
writeFileSync(join(dir, 'README.md'), 'not a migration');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('serviceD1', () => {
  it('applies the migrations in order, binds a boolean as D1 does, and reads rows and columns', async () => {
    const { db, sql } = serviceD1(dir);
    const put = await db
      .prepare('INSERT INTO t (a, b, ok) VALUES (?, ?, ?)')
      .bind(1, 'x', true)
      .run();
    expect(put.meta.changes).toBe(1);
    expect(await db.prepare('SELECT b, ok FROM t WHERE a = ?').bind(1).first()).toEqual({
      b: 'x',
      ok: 1,
    });
    expect(await db.prepare('SELECT b FROM t WHERE a = ?').bind(1).first('b')).toBe('x');
    expect(await db.prepare('SELECT b FROM t WHERE a = 9').first('b')).toBeNull();
    expect((await db.prepare('SELECT a FROM t').all()).results).toEqual([{ a: 1 }]);
    expect(sql.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 1 });
    await db.prepare('INSERT INTO t (a, ok) VALUES (?, ?)').bind(2, false).run();
    expect(await db.prepare('SELECT ok FROM t WHERE a = 2').first('ok')).toBe(0);
  });

  it('refuses what D1 refuses: undefined, over 100 parameters, a long compound, a broken foreign key', async () => {
    const { db } = serviceD1(dir);
    expect(() => db.prepare('SELECT ?').bind(undefined)).toThrow(/D1_TYPE_ERROR/);
    expect(() => db.prepare('SELECT 1').bind(...Array.from({ length: 101 }, () => 1))).toThrow(
      /too many SQL variables/,
    );
    const compound = Array.from({ length: 6 }, (_, i) => `SELECT ${i}`).join(' UNION ALL ');
    expect(() => db.prepare(compound)).toThrow();
    await expect(db.prepare('INSERT INTO u (id, t) VALUES (1, 99)').run()).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('runs batches one after another, each as one transaction', async () => {
    const { db, sql } = serviceD1(dir);
    const results = await db.batch([
      db.prepare('INSERT INTO t (a) VALUES (?)').bind(1),
      db.prepare('SELECT a FROM t'),
    ]);
    expect(results).toEqual([
      { results: [], success: true, meta: { changes: 1 } },
      { results: [{ a: 1 }], success: true, meta: { changes: 0 } },
    ]);
    const failed = db.batch([
      db.prepare('INSERT INTO t (a) VALUES (?)').bind(2),
      db.prepare('INSERT INTO t (a) VALUES (?)').bind(1),
    ]);
    const after = db.batch([db.prepare('INSERT INTO t (a) VALUES (?)').bind(3)]);
    await expect(failed).rejects.toThrow();
    await after;
    expect(sql.prepare('SELECT a FROM t ORDER BY a').all()).toEqual([{ a: 1 }, { a: 3 }]);
  });
});
