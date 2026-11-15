import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { FLOW_DAYS_MAX, flowCountsOf, ITEMS_MAX, TRASH_STATUS } from '@liveplanner/items';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { migratePlanSchema } from '../plan-room/plan-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { PlanEnv } from '../types';
import { deleteOldFlowCounts, readFlowCounts } from './flow-counts';

// The plan's daily flow counts (docs/specs/026-plan/items.md "Flow counts", blueprint item-store.md "Flow counts"), on
// real SQLite with every schema step: the triggers keep today's counts through every kind of card write, carry the day
// before forward, seed a plan from before, and the reads and the upkeep's trim reach the plan's own storage alone.

type Row = { day: number; type: string; status: string; cards: number };

function plan(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO test_plans (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('P', 'o', 'Plan', 0, 1, 1)`);
  return db;
}

const today = (db: SqliteD1) =>
  (
    db.sql.prepare(`SELECT CAST(julianday('now') - 2440587.5 AS INTEGER) AS d`).get() as {
      d: number;
    }
  ).d;

let nextKey = 1;
function insert(db: SqliteD1, id: string, status: string | null, type = 'task') {
  const fields = JSON.stringify(status === null ? { title: id } : { title: id, status });
  db.sql
    .prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('P', ?, ?, ?, 'i', ?, 1, 0, 0, '{}', '{}')`,
    )
    .run(id, type, nextKey++, fields);
}

const setStatus = (db: SqliteD1, id: string, status: string) =>
  db.sql
    .prepare(
      `UPDATE items SET fields = json_set(fields, '$.status', ?), rev = rev + 1 WHERE id = ?`,
    )
    .run(status, id);

// Today's counts as `type:status` → cards, zeros included (a zero row is stored until the next day leaves it behind).
function countsOn(db: SqliteD1, day: number): Record<string, number> {
  const rows = db.sql
    .prepare(
      'SELECT type, status, cards FROM flow_counts WHERE plan_id = ? AND day = ? ORDER BY type, status',
    )
    .all('P', day) as Row[];
  return Object.fromEntries(rows.map((r) => [`${r.type}:${r.status}`, r.cards]));
}

const allRows = (db: SqliteD1) =>
  db.sql
    .prepare('SELECT day, type, status, cards FROM flow_counts ORDER BY day, type, status')
    .all() as Row[];

// The plan's own storage alone: any other binding read throws.
function onlyPlanDb(env: PlanEnv): Pick<PlanEnv, 'PLAN_DB'> {
  return new Proxy({} as Pick<PlanEnv, 'PLAN_DB'>, {
    get: (_t, prop) => {
      if (prop === 'PLAN_DB') return env.PLAN_DB;
      throw new Error(`flow counts reached env.${String(prop)}`);
    },
  });
}

describe('flow counts triggers', () => {
  it('count a made card in its type and status, and one with no status under the empty status', () => {
    const db = plan();
    insert(db, 'card-0001', 'todo');
    insert(db, 'card-0002', 'todo');
    insert(db, 'card-0003', null, 'bug');
    expect(countsOn(db, today(db))).toEqual({ 'bug:': 1, 'task:todo': 2 });
  });

  it('move a card between statuses, and between types', () => {
    const db = plan();
    insert(db, 'card-0001', 'todo');
    insert(db, 'card-0002', 'todo');
    setStatus(db, 'card-0001', 'doing');
    expect(countsOn(db, today(db))).toEqual({ 'task:doing': 1, 'task:todo': 1 });
    db.sql.prepare(`UPDATE items SET type = 'bug' WHERE id = 'card-0002'`).run();
    expect(countsOn(db, today(db))).toEqual({ 'bug:todo': 1, 'task:doing': 1, 'task:todo': 0 });
  });

  it('count the Trash as a status, and leave an archived card in its own', () => {
    const db = plan();
    insert(db, 'card-0001', 'done');
    db.sql
      .prepare(`UPDATE items SET fields = json_set(fields, '$.archived', 1) WHERE id = 'card-0001'`)
      .run();
    expect(countsOn(db, today(db))).toEqual({ 'task:done': 1 });
    setStatus(db, 'card-0001', TRASH_STATUS);
    expect(countsOn(db, today(db))).toEqual({ 'task:done': 0, [`task:${TRASH_STATUS}`]: 1 });
  });

  it('write nothing for an edit that changes neither the status nor the type', () => {
    const db = plan();
    insert(db, 'card-0001', 'todo');
    const before = allRows(db);
    db.sql
      .prepare(
        `UPDATE items SET fields = json_set(fields, '$.title', 'Renamed'), rank = 'j' WHERE id = 'card-0001'`,
      )
      .run();
    db.sql.prepare(`UPDATE items SET updated_by = '{"id":"x"}' WHERE id = 'card-0001'`).run();
    expect(allRows(db)).toEqual(before);
  });

  it('take a deleted card out', () => {
    const db = plan();
    insert(db, 'card-0001', 'todo');
    insert(db, 'card-0002', 'todo');
    db.sql.prepare(`DELETE FROM items WHERE id = 'card-0001'`).run();
    expect(countsOn(db, today(db))).toEqual({ 'task:todo': 1 });
  });

  it('carry the last stored day into today before the first change of the day, leaving its zeros behind', () => {
    const db = plan();
    const day = today(db);
    const put = db.sql.prepare(
      `INSERT INTO flow_counts (plan_id, day, type, status, cards) VALUES ('P', ?, 'task', ?, ?)`,
    );
    // Three days ago, then a quiet two days: the plan stood at 4 in To Do, 2 in Doing, none in Review.
    put.run(day - 3, 'todo', 4);
    put.run(day - 3, 'doing', 2);
    put.run(day - 3, 'review', 0);
    put.run(day - 5, 'todo', 9);
    insert(db, 'card-0001', 'doing');
    expect(countsOn(db, day)).toEqual({ 'task:doing': 3, 'task:todo': 4 });
    // A second change today carries nothing more.
    insert(db, 'card-0002', 'todo');
    expect(countsOn(db, day)).toEqual({ 'task:doing': 3, 'task:todo': 5 });
    // The days before are left as they were.
    expect(countsOn(db, day - 3)).toEqual({ 'task:doing': 2, 'task:review': 0, 'task:todo': 4 });
  });

  it('count every card of a bulk write, and of a plan deleted with its cards', () => {
    const db = plan();
    for (let i = 0; i < 40; i++)
      insert(db, `card-${String(i).padStart(4, '0')}`, i % 2 ? 'todo' : 'done');
    db.sql.prepare(`UPDATE items SET fields = json_set(fields, '$.status', 'done')`).run();
    expect(countsOn(db, today(db))).toEqual({ 'task:done': 40, 'task:todo': 0 });
    db.sql.prepare(`DELETE FROM items`).run();
    expect(countsOn(db, today(db))).toEqual({ 'task:done': 0, 'task:todo': 0 });
  });
});

describe('flow counts step', () => {
  it('seeds a plan from before with today’s counts of its cards, and runs again harmlessly', () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec('PRAGMA foreign_keys = ON');
    const exec = nodeItemSql(sql);
    migratePlanSchema((q) => exec.exec(q));
    // As a plan from before the step: no table, no triggers, its version one step back, with cards.
    sql.exec(`DROP TRIGGER flow_counts_insert; DROP TRIGGER flow_counts_update; DROP TRIGGER flow_counts_delete;
              DROP TABLE flow_counts; UPDATE _plan_schema SET version = version - 1`);
    sql.exec(`INSERT INTO plan (id, saved_at, created_at) VALUES ('P', 1, 1)`);
    const add = sql.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('P', ?, ?, ?, 'i', ?, 1, 0, 0, '{}', '{}')`,
    );
    add.run('card-0001', 'task', 1, '{"status":"todo"}');
    add.run('card-0002', 'task', 2, '{"status":"todo"}');
    add.run('card-0003', 'bug', 3, '{"status":"done"}');
    add.run('card-0004', 'task', 4, '{}');
    migratePlanSchema((q) => exec.exec(q));
    const rows = () =>
      sql.prepare('SELECT type, status, cards FROM flow_counts ORDER BY type, status').all();
    expect(rows()).toEqual([
      { type: 'bug', status: 'done', cards: 1 },
      { type: 'task', status: '', cards: 1 },
      { type: 'task', status: 'todo', cards: 2 },
    ]);
    sql.exec('UPDATE _plan_schema SET version = 0');
    expect(() => migratePlanSchema((q) => exec.exec(q))).not.toThrow();
    expect(rows()).toHaveLength(3);
  });
});

describe('readFlowCounts', () => {
  it('answers the range’s days and the last stored day before it, from the plan’s storage alone', async () => {
    const db = plan();
    const put = db.sql.prepare(
      `INSERT INTO flow_counts (plan_id, day, type, status, cards) VALUES (?, ?, 'task', 'todo', ?)`,
    );
    put.run('P', 100, 1);
    put.run('P', 104, 2);
    put.run('P', 110, 3);
    put.run('P', 121, 4);
    put.run('Q', 112, 9);
    const rows = await readFlowCounts(onlyPlanDb(db.env), 'P', 108, 120);
    expect(rows.map((r) => [r.day, r.cards])).toEqual([
      [104, 2],
      [110, 3],
    ]);
    expect(flowCountsOf(rows, 108, 120).byStatus.get('todo')).toEqual([
      2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
    ]);
    // A range starting on a stored day reads from that day, and one before any day from its start.
    expect((await readFlowCounts(db.env, 'P', 110, 110)).map((r) => r.day)).toEqual([110]);
    expect((await readFlowCounts(db.env, 'P', 50, 101)).map((r) => r.day)).toEqual([100]);
  });
});

describe('deleteOldFlowCounts', () => {
  it('drops the days past the kept range but the last of them, which the days after carry', async () => {
    const db = plan();
    const put = db.sql.prepare(
      `INSERT INTO flow_counts (plan_id, day, type, status, cards) VALUES ('P', ?, 'task', 'todo', 1)`,
    );
    const now = 1000;
    for (const day of [now - FLOW_DAYS_MAX - 30, now - FLOW_DAYS_MAX - 5, now - 10, now])
      put.run(day);
    expect(await deleteOldFlowCounts(onlyPlanDb(db.env), now)).toBe(1);
    expect(allRows(db).map((r) => r.day)).toEqual([now - FLOW_DAYS_MAX - 5, now - 10, now]);
    // Run again, nothing more goes; and a plan with no counts that old loses none.
    expect(await deleteOldFlowCounts(db.env, now)).toBe(0);
    expect(await deleteOldFlowCounts(db.env, now - 100)).toBe(0);
  });
});

// The triggers' cost on the write paths a full plan (ITEMS_MAX) takes: a copy or import making every card at
// once, and a bulk move of every card. Each must stay a small share of the write itself.
describe('flow counts on a full plan (ITEMS_MAX cards)', () => {
  const fill = (db: SqliteD1) => {
    // One prepared statement, as a copy's or import's batch runs: preparing per row cost the test ten times the
    // triggers (613 ms of CPU at 5,000 cards, against 56 ms prepared once).
    const statement = db.sql.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES ('P', ?, ?, ?, 'i', ?, 1, 0, 0, '{}', '{}')`,
    );
    db.sql.exec('BEGIN');
    for (let i = 0; i < ITEMS_MAX; i++) {
      const id = `perf-${String(i).padStart(5, '0')}`;
      statement.run(id, `t${i % 3}`, nextKey++, JSON.stringify({ title: id, status: `s${i % 8}` }));
    }
    db.sql.exec('COMMIT');
  };

  it('makes every card of a full plan and moves every one within budget', () => {
    const db = plan();
    const made = cpuMsOf(() => fill(db));
    const moved = cpuMsOf(() => {
      db.sql.prepare(`UPDATE items SET fields = json_set(fields, '$.status', 'done')`).run();
    });
    expect(countsOn(db, today(db))['t0:done']).toBe(Math.ceil(ITEMS_MAX / 3));
    expect(made).toBeLessThan(cpuBudgetMs(300));
    expect(moved).toBeLessThan(cpuBudgetMs(300));
  });
});
