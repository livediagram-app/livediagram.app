import { AsyncLocalStorage } from 'node:async_hooks';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { PlanDb } from './plan-room/plan-db';
import { migratePlanSchema } from './plan-room/plan-schema';
import { nodePlanSql, nodeTransaction } from './test-plan-sql';
import type { Env, PlanEnv } from './types';

// A REAL D1 for tests: an in-memory SQLite database with every migration in
// apps/api/migrations applied, behind the D1 prepare/bind/first/all/run/batch
// surface the db/ modules call.
//
// test-d1.ts records which SQL ran; this one answers whether it WORKED. Use it
// where the behaviour lives in the schema: foreign-key cascades, primary-key
// collisions, INSERT OR IGNORE outcomes. D1 enforces foreign keys, so this
// turns them on too.
//
// The plans' content (docs/specs/015-api/api.md "Storage") is each plan's own Durable Object in production. Here
// every plan's tables sit in the same database as D1's (their names do not overlap), behind `env.PLAN_DB`, so a
// test arranges and asserts on both through one handle, and a handler runs as it does inside a plan's object.
// `env.PLAN_ROOM` answers the plan RPCs (plan-client.ts) from those same tables, and hands `fetch` (the room's
// relays) to the PLAN_ROOM the test passed, if any. A project row inserted into D1 gets its plan row, as a
// create does, and what a plan owes D1 (plan-outbox.ts) is pushed before every D1 call, so a test reads D1 as
// it would be once the plan's push has landed.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url).href);

export type SqliteD1 = {
  // The worker's bindings and the plans' (PLAN_DB): every content module and every D1 module runs against it.
  env: PlanEnv;
  // The raw handle, for arranging rows and asserting on them directly.
  sql: DatabaseSync;
  // Land what the plans owe D1 now (every D1 call does this first), for a test that reads D1 through `sql`.
  flush: () => Promise<void>;
};

// D1 binds a boolean as 1 / 0; node:sqlite refuses one outright.
function toSql(value: unknown): SQLInputValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value === undefined) throw new TypeError('D1_TYPE_ERROR: undefined is not a bindable value');
  return value as SQLInputValue;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function sqliteD1(base: Partial<Env> = {}): SqliteD1 {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys = ON');
  for (const file of migrationFiles()) sql.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
  const planSql = nodePlanSql(sql);
  migratePlanSchema((q) => planSql.exec(q));
  // A project row comes with its plan's, as a create makes both.
  sql.exec(`CREATE TEMP TRIGGER project_plan AFTER INSERT ON projects
    BEGIN
      INSERT OR IGNORE INTO plan (id, saved_at, created_at)
      VALUES (NEW.id, COALESCE(NEW.saved_at, 0), COALESCE(NEW.created_at, 0));
    END`);

  // Push what the plans owe D1 before D1 answers anything. A call made while a push runs waits for it; the
  // push's own D1 batch (inside it, by its async context) goes straight through.
  const inPush = new AsyncLocalStorage<true>();
  let pushing: Promise<void> | null = null;
  const push = async (): Promise<void> => {
    if (inPush.getStore()) return;
    while (pushing) await pushing;
    if (sql.prepare('SELECT 1 FROM outbox LIMIT 1').all().length === 0) return;
    pushing = inPush.run(true, async () => {
      const { drainOutbox } = await import('./plan-room/plan-outbox');
      const plans = sql.prepare('SELECT DISTINCT plan_id FROM outbox').all() as { plan_id: string }[];
      for (const { plan_id } of plans) {
        let more = true;
        while (more) more = (await drainOutbox(env, plan_id)).more;
      }
    });
    try {
      await pushing;
    } finally {
      pushing = null;
    }
  };

  const statement = (query: string, args: SQLInputValue[]) => {
    const rows = () =>
      sql
        .prepare(query)
        .all(...args)
        .map((row) => ({ ...row }));
    return {
      bind: (...next: unknown[]) => statement(query, next.map(toSql)),
      first: async (column?: string) => {
        await push();
        const row = rows()[0] ?? null;
        return column && row ? (row[column] ?? null) : row;
      },
      all: async () => {
        await push();
        return { results: rows(), success: true, meta: {} };
      },
      run: async () => {
        await push();
        const res = sql.prepare(query).run(...args);
        return {
          success: true,
          meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) },
        };
      },
      // What D1's batch hands back per statement: a read's rows, a write's
      // change count.
      batchResult: async () => {
        const prepared = sql.prepare(query);
        if (prepared.columns().length > 0) {
          return { results: rows(), success: true, meta: { changes: 0 } };
        }
        const res = prepared.run(...args);
        return { results: [], success: true, meta: { changes: Number(res.changes) } };
      },
    };
  };

  // D1 isolates each batch from every other. Each batch here awaits between its statements, so two run
  // concurrently (the cron's sweeps, under waitUntil) would interleave inside one SQLite connection and the
  // second BEGIN would fail. Batches therefore queue behind one another, as D1 serialises them.
  let batches: Promise<unknown> = Promise.resolve();
  const runBatch = async (statements: { batchResult: () => Promise<unknown> }[]) => {
    sql.exec('BEGIN');
    try {
      const results = [];
      for (const s of statements) results.push(await s.batchResult());
      sql.exec('COMMIT');
      return results;
    } catch (err) {
      sql.exec('ROLLBACK');
      throw err;
    }
  };
  const db = {
    prepare: (query: string) => statement(query, []),
    // D1 runs a batch as one transaction: all of it lands or none of it does.
    batch: async (statements: { batchResult: () => Promise<unknown> }[]) => {
      await push();
      const run = batches.then(() => runBatch(statements));
      batches = run.catch(() => undefined);
      return run;
    },
  };

  const planDb = new PlanDb(planSql, {
    transaction: nodeTransaction(sql),
    ensureSchema: () => {},
    onWrite: () => {},
  });
  const env = { ...base, DB: db, PLAN_DB: planDb.asD1() } as unknown as PlanEnv;
  // A test that sets env.PLAN_ROOM later (its relay recorder) gets it wrapped the same way.
  let rooms = testPlanRooms(env, sql, base.PLAN_ROOM);
  Object.defineProperty(env, 'PLAN_ROOM', {
    enumerable: true,
    get: () => rooms,
    set: (next: DurableObjectNamespace | undefined) => {
      rooms = testPlanRooms(env, sql, next);
    },
  });
  return { env, sql, flush: push };
}

// The plan RPCs (plan-client.ts) over the shared tables, and the room's `fetch` handed to the test's own
// PLAN_ROOM (a recorder of relays), or answered 404 without one.
function testPlanRooms(
  env: PlanEnv,
  sql: DatabaseSync,
  rooms: DurableObjectNamespace | undefined,
): DurableObjectNamespace {
  type FakeId = DurableObjectId & { planName: string; roomId: unknown };
  const roomOf = (id: FakeId) =>
    rooms ? (rooms.get(id.roomId as DurableObjectId) as { fetch: typeof fetch }) : null;
  const ns = {
    idFromName: (name: string): FakeId =>
      ({
        planName: name,
        roomId: rooms ? rooms.idFromName(name) : name,
        name,
        toString: () => name,
        equals: (other: DurableObjectId) => (other as FakeId).planName === name,
      }),
    get: (id: FakeId) => ({
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const room = roomOf(id);
        return room ? room.fetch(input, init) : Promise.resolve(new Response(null, { status: 404 }));
      },
      outline: async (planId: string) =>
        (await import('./plan-room/plan-content')).readPlanOutline(env, planId),
      route: async (_planId: string, request: Request, identity: unknown) =>
        (await import('./plan-room/plan-route')).answerPlanRequest(
          env,
          request,
          identity as never,
          () => {},
        ),
      image: async (_planId: string, subject: unknown, tabId: string | null) =>
        (await import('./thumbnail')).renderPlanImage(env, subject as never, tabId, {}),
      hasTab: async (planId: string, tabId: string) =>
        (await import('./db/tabs')).planHasTab(env, planId, tabId),
      item: async (planId: string, itemId: string) =>
        (await import('./db/items')).readItem(env, planId, itemId),
      exportCopy: async (planId: string, onlyTabId: string | null, redact: string | null) =>
        (await import('./plan-room/plan-content')).exportPlanCopy(env, planId, onlyTabId, redact),
      importCopy: async (planId: string, copy: unknown) =>
        (await import('./plan-room/plan-content')).importPlanCopy(env, planId, copy as never),
      // Everything the plan stored goes, and the room hears it as it did (its `/purge`).
      purge: async (planId: string) => {
        sql.exec('SAVEPOINT purge');
        try {
          sql
            .prepare(
              `DELETE FROM tabs WHERE id IN (SELECT tab_id FROM plan_tabs WHERE plan_id = ?)`,
            )
            .run(planId);
          sql.prepare('DELETE FROM plan WHERE id = ?').run(planId);
          sql.prepare('DELETE FROM outbox WHERE plan_id = ?').run(planId);
          sql.exec('RELEASE purge');
        } catch (err) {
          sql.exec('ROLLBACK TO purge');
          sql.exec('RELEASE purge');
          throw err;
        }
        const room = roomOf(id);
        if (room) {
          const res = await room.fetch('https://room/purge', { method: 'POST' });
          if (!res.ok) throw new Error(`status ${res.status}`);
        }
      },
      revokeCodes: async () => 0,
    }),
  };
  return ns as unknown as DurableObjectNamespace;
}
