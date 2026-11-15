import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { ITEMS_MAX } from '@liveplanner/items';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { itemsBytesStep } from './items-bytes-schema';

// The plan fields budget's running total (docs/specs/026-plan/items.md "Limits", blueprint item-store.md "Performance
// and limits"), on real SQLite with every schema step: the triggers keep plan.items_bytes equal to the cards' stored
// fields through every kind of row write, the step seeds a plan from before, and the bookkeeping's cost on writes.

function plan(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('P', 'o', 'Plan', 0, 1, 1)`);
  return db;
}

let nextKey = 1;
const insertSql = `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
   VALUES ('P', ?, 'task', ?, 'i', ?, 1, 0, 0, '{}', '{}')`;
const insert = (db: DatabaseSync, id: string, fields: Record<string, unknown>) =>
  db.prepare(insertSql).run(id, nextKey++, JSON.stringify(fields));

const kept = (db: DatabaseSync) =>
  (db.prepare(`SELECT items_bytes AS b FROM plan WHERE id = 'P'`).get() as { b: number }).b;
const summed = (db: DatabaseSync) =>
  (
    db
      .prepare(
        `SELECT COALESCE(SUM(length(CAST(fields AS BLOB))), 0) AS b FROM items WHERE plan_id = 'P'`,
      )
      .get() as { b: number }
  ).b;
const utf8 = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('plan.items_bytes', () => {
  it('counts every card made, changed, moved and deleted, in UTF-8 bytes', () => {
    const { sql } = plan();
    insert(sql, 'card-0001', { title: 'One', status: 'todo' });
    insert(sql, 'card-0002', { title: 'Zwei – größer', description: 'ü'.repeat(500) });
    expect(kept(sql)).toBe(summed(sql));
    // A longer value, then a shorter one.
    sql
      .prepare(`UPDATE items SET fields = ? WHERE id = 'card-0001'`)
      .run(JSON.stringify({ title: 'One', status: 'todo', description: 'x'.repeat(5000) }));
    expect(kept(sql)).toBe(summed(sql));
    sql
      .prepare(`UPDATE items SET fields = ? WHERE id = 'card-0001'`)
      .run(JSON.stringify({ title: 'One' }));
    expect(kept(sql)).toBe(summed(sql));
    // A rank-only write (a move within a column) leaves it alone; a status added, then changed, counts.
    const before = kept(sql);
    sql.exec(`UPDATE items SET rank = 'j', rev = rev + 1 WHERE id = 'card-0001'`);
    expect(kept(sql)).toBe(before);
    sql.exec(
      `UPDATE items SET fields = json_set(fields, '$.status', 'done') WHERE id = 'card-0002'`,
    );
    sql.exec(
      `UPDATE items SET fields = json_set(fields, '$.status', 'in progress') WHERE id = 'card-0002'`,
    );
    expect(kept(sql)).toBe(before + ',"status":"in progress"'.length);
    expect(kept(sql)).toBe(summed(sql));
    // A card deleted, then the rest with a json_remove (the comments sweep), then all of them.
    sql.exec(`DELETE FROM items WHERE id = 'card-0001'`);
    expect(kept(sql)).toBe(summed(sql));
    sql.exec(`UPDATE items SET fields = json_remove(fields, '$.description')`);
    expect(kept(sql)).toBe(summed(sql));
    sql.exec(`DELETE FROM items`);
    expect(kept(sql)).toBe(0);
  });

  it('keeps each plan its own total, and goes with its plan', () => {
    const { sql } = plan();
    sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
              VALUES ('Q', 'o', 'Other', 0, 1, 1)`);
    insert(sql, 'card-0001', { title: 'Here' });
    sql
      .prepare(insertSql.replace(`'P'`, `'Q'`))
      .run('card-0002', nextKey++, JSON.stringify({ title: 'There, longer' }));
    expect(kept(sql)).toBe(utf8({ title: 'Here' }));
    const q = () =>
      (sql.prepare(`SELECT items_bytes AS b FROM plan WHERE id = 'Q'`).get() as { b: number }).b;
    expect(q()).toBe(utf8({ title: 'There, longer' }));
    sql.exec(`DELETE FROM plan WHERE id = 'Q'`);
    expect(kept(sql)).toBe(utf8({ title: 'Here' }));
  });

  it('seeds a plan from before from its cards, once, and runs again harmlessly', () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec(`CREATE TABLE plan (id TEXT PRIMARY KEY, items_rev INTEGER NOT NULL DEFAULT 0);
              CREATE TABLE items (plan_id TEXT NOT NULL, id TEXT NOT NULL, fields TEXT NOT NULL);
              INSERT INTO plan (id) VALUES ('P');
              INSERT INTO items VALUES ('P', 'a', '{"title":"Á"}'), ('P', 'b', '{"title":"bb"}');`);
    const exec = (q: string) => ({
      toArray: () => sql.prepare(q).all() as Record<string, unknown>[],
    });
    const run = (q: string) => {
      if (/^\s*(PRAGMA|SELECT)/i.test(q)) return exec(q);
      sql.exec(q);
      return { toArray: () => [] };
    };
    itemsBytesStep(run);
    expect(kept(sql)).toBe(summed(sql));
    expect(kept(sql)).toBe(utf8({ title: 'Á' }) + utf8({ title: 'bb' }));
    itemsBytesStep(run);
    expect(kept(sql)).toBe(summed(sql));
    sql.exec(`INSERT INTO items VALUES ('P', 'c', '{"title":"c"}')`);
    expect(kept(sql)).toBe(summed(sql));
  });

  // The bookkeeping's cost on writes (blueprint "Performance and limits"): ITEMS_MAX cards made in one transaction and
  // all of them edited in one statement, with the triggers and without, on the full schema (every other items trigger
  // too). Logged for the blueprint; budgets hold the extra well under the writes themselves.
  it('costs one indexed plan update per card row written', { timeout: 60_000 }, () => {
    const big = { title: 'A card of a plan', description: 'w'.repeat(1500), status: 'todo' };
    const fill = (sql: DatabaseSync) => {
      sql.exec('BEGIN');
      for (let i = 0; i < ITEMS_MAX; i += 1)
        insert(sql, `card-${i.toString().padStart(5, '0')}`, big);
      sql.exec('COMMIT');
    };
    const edit = (sql: DatabaseSync) =>
      sql.exec(
        `UPDATE items SET fields = json_set(fields, '$.title', 'A longer card title') WHERE plan_id = 'P'`,
      );
    const one = (sql: DatabaseSync) =>
      cpuMsOf(() => {
        for (let i = 0; i < 200; i += 1)
          sql
            .prepare(`UPDATE items SET fields = ? WHERE id = 'card-00001'`)
            .run(JSON.stringify({ ...big, title: `Edit ${i}` }));
      });
    const measure = (triggers: boolean) => {
      const { sql } = plan();
      if (!triggers)
        sql.exec(
          `DROP TRIGGER items_bytes_insert; DROP TRIGGER items_bytes_update; DROP TRIGGER items_bytes_delete;`,
        );
      const made = cpuMsOf(() => fill(sql));
      const edited = cpuMsOf(() => edit(sql));
      const single = one(sql);
      if (triggers) expect(kept(sql)).toBe(summed(sql));
      return { made, edited, single };
    };
    // Each the quicker of two runs, taken in turn, so neither side pays the warm-up alone.
    const runs = [measure(false), measure(true), measure(false), measure(true)];
    const best = (side: 0 | 1, k: 'made' | 'edited' | 'single') =>
      Math.min(runs[side]![k], runs[side + 2]![k]);
    const withThem = {
      made: best(1, 'made'),
      edited: best(1, 'edited'),
      single: best(1, 'single'),
    };
    const without = { made: best(0, 'made'), edited: best(0, 'edited'), single: best(0, 'single') };
    console.info('[items-bytes] cost', { without, with: withThem });
    expect(withThem.made).toBeLessThan(cpuBudgetMs(3000));
    expect(withThem.edited).toBeLessThan(cpuBudgetMs(400));
    expect(withThem.single).toBeLessThan(cpuBudgetMs(500));
  });
});
