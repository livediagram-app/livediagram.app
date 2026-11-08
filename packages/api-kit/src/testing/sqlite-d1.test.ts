import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { D1_MAX_BOUND_PARAMS, sqliteD1 } from './sqlite-d1';

const dir = mkdtempSync(join(tmpdir(), 'sqlite-d1-'));
writeFileSync(join(dir, '0001_t.sql'), 'CREATE TABLE t (a INTEGER PRIMARY KEY, b TEXT);');
writeFileSync(join(dir, '0002_t.sql'), 'ALTER TABLE t ADD COLUMN c TEXT;');
writeFileSync(join(dir, 'README.md'), 'not a migration');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sqliteD1', () => {
  it('applies the migrations in order and runs statements', async () => {
    const { db, raw } = sqliteD1(dir);
    const put = await db
      .prepare('INSERT INTO t (a, b, c) VALUES (?, ?, ?)')
      .bind(1, 'x', 'y')
      .run();
    expect(put.meta.changes).toBe(1);
    expect(await db.prepare('SELECT b, c FROM t WHERE a = ?').bind(1).first()).toEqual({
      b: 'x',
      c: 'y',
    });
    expect((await db.prepare('SELECT a FROM t').all()).results).toEqual([{ a: 1 }]);
    expect(await db.prepare('SELECT a FROM t WHERE a = 9').first()).toBeNull();
    expect(raw.prepare('SELECT COUNT(*) AS n FROM t').get()).toEqual({ n: 1 });
  });

  it('runs a batch as one transaction, rolled back whole on a failure', async () => {
    const { db } = sqliteD1(dir);
    const put = db.prepare('INSERT INTO t (a, b) VALUES (?, ?)');
    await db.batch([put.bind(1, 'a'), put.bind(2, 'b')]);
    await expect(db.batch([put.bind(3, 'c'), put.bind(1, 'again')])).rejects.toThrow();
    expect((await db.prepare('SELECT a FROM t ORDER BY a').all()).results).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  it('refuses a statement binding more parameters than D1 takes, as D1 does', async () => {
    const { db } = sqliteD1(dir);
    const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');
    const fits = Array.from({ length: D1_MAX_BOUND_PARAMS }, (_, i) => i);
    await expect(
      db
        .prepare(`SELECT a FROM t WHERE a IN (${marks(fits.length)})`)
        .bind(...fits)
        .all(),
    ).resolves.toBeDefined();
    const over = [...fits, 100];
    await expect(
      db
        .prepare(`SELECT a FROM t WHERE a IN (${marks(over.length)})`)
        .bind(...over)
        .all(),
    ).rejects.toThrow('too many SQL variables');
  });

  it('refuses a compound SELECT D1 would', () => {
    const { db } = sqliteD1(dir);
    const terms = Array.from({ length: 6 }, (_, i) => `SELECT ${i}`).join(' UNION ALL ');
    expect(() => db.prepare(terms)).toThrow('too many terms in compound SELECT');
  });
});
