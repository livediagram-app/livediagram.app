import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveplanner/vitest-config/cpu-time';
import type { Element } from '@liveplanner/project';
import worker from '../index';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { nodePlanSql, nodeTransaction } from '../test-plan-sql';
import type { Env } from '../types';
import { DRAIN_TABS } from './plan-outbox';
import { MAINTENANCE_EVERY_MS, PlanRoom } from './plan-room';

// Each plan's content in its own SQLite-backed Durable Object (docs/specs/015-api/api.md "Storage"), end to end:
// the real worker resolves the caller and forwards to the plan's object, which answers from its own SQLite and
// pushes what D1's cross-plan reads need through its outbox. Every plan here gets its OWN in-memory database (the
// object's `ctx.storage.sql`, node:sqlite behind the SqlStorage surface), so nothing is shared between plans but
// D1, as in production.

vi.mock('../auth/accounts', () => ({ getAccountIdentity: async () => null }));

const box = (id: string, label = id): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label,
});

type Plan = { room: PlanRoom; db: DatabaseSync; transactions: number };

// The PLAN_ROOM namespace: one PlanRoom per name, each on its own database, with the calls the worker made.
function planNamespace(envOf: () => Env) {
  const plans = new Map<string, Plan>();
  const calls: string[] = [];
  const open = (name: string): Plan => {
    const existing = plans.get(name);
    if (existing) return existing;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const store = new Map<string, unknown>();
    const transaction = nodeTransaction(db);
    const plan = { db, transactions: 0 } as Plan;
    const id = { name, equals: (other: { name?: string }) => other?.name === name, toString: () => name };
    const state = {
      id,
      storage: {
        sql: nodePlanSql(db),
        transactionSync: <T>(fn: () => T): T => {
          plan.transactions += 1;
          return transaction(fn);
        },
        get: async (key: string) => store.get(key),
        put: async (key: string, value: unknown) => void store.set(key, value),
        delete: async (key: string) => store.delete(key),
        list: async ({ prefix }: { prefix: string }) =>
          new Map([...store].filter(([key]) => key.startsWith(prefix))),
        setAlarm: async () => {},
        deleteAlarm: async () => {},
        // The runtime's deleteAll drops the SQLite database with the key-value pairs.
        deleteAll: async () => {
          store.clear();
          db.exec('PRAGMA foreign_keys = OFF');
          const tables = db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .all();
          for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${String(t.name)}"`);
          db.exec('PRAGMA foreign_keys = ON');
        },
      },
      sockets: [] as WebSocket[],
      acceptWebSocket(ws: WebSocket) {
        state.sockets.push(ws);
      },
      getWebSockets: () => [...state.sockets],
      blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
      waitUntil: () => {},
    };
    plan.room = new PlanRoom(state as unknown as DurableObjectState, envOf());
    plans.set(name, plan);
    return plan;
  };
  const ns = {
    idFromName: (name: string) => ({ name, equals: (o: { name?: string }) => o?.name === name }),
    get: (id: { name: string }) => {
      const { room } = open(id.name);
      return new Proxy(room, {
        get(target, prop, receiver) {
          const value: unknown = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
    },
  };
  return { ns, plans, calls, open };
}

type World = {
  d1: SqliteD1;
  env: Env;
  plans: Map<string, Plan>;
  calls: string[];
  send: (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>;
};

function world(extra: Partial<Env> = {}): World {
  const d1 = sqliteD1();
  const env = { DB: d1.env.DB, ...extra } as unknown as Env;
  const { ns, plans, calls } = planNamespace(() => env);
  Reflect.set(env, 'PLAN_ROOM', ns);
  const executionCtx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  const send = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    worker.fetch(
      new Request(`https://api.test${path}`, {
        method,
        headers: { 'X-Owner-Id': 'owner', 'Content-Type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
      executionCtx,
    );
  return { d1, env, plans, calls, send };
}

async function createPlan(w: World, id: string, tabs = [{ id: 't1', name: 'Board', elements: [box('a')] }]) {
  const res = await w.send('POST', '/api/projects', { id, name: id, tabs });
  expect(res.status).toBe(201);
}

const count = (db: DatabaseSync, table: string) =>
  Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a plan's content lives in its own Durable Object", () => {
  it('keeps each plan in its own SQLite, D1 holding only the project row', async () => {
    const w = world();
    await createPlan(w, 'A');
    await createPlan(w, 'B', [{ id: 't1', name: 'Same id, other plan', elements: [box('b')] }]);
    expect(count(w.plans.get('A')!.db, 'tabs')).toBe(1);
    expect(count(w.plans.get('B')!.db, 'tabs')).toBe(1);
    // D1 has the rows, and none of the content (its plan tables are the test store's, never written here).
    expect(w.d1.sql.prepare("SELECT id FROM projects ORDER BY id").all().map((r) => r.id)).toEqual(['A', 'B']);
    expect(count(w.d1.sql, 'tabs')).toBe(0);
  });

  it('saves a tab in one call to the plan and one transaction, and reads it back in one call', async () => {
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    w.calls.length = 0;
    const before = plan.transactions;
    const saved = await w.send('PUT', '/api/projects/A/tabs/t1', {
      id: 't1',
      name: 'Board',
      elements: [box('a', 'Edited'), box('c')],
    });
    expect(saved.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    expect(plan.transactions - before).toBe(1);

    w.calls.length = 0;
    const read = await w.send('GET', '/api/projects/A/tabs/t1');
    expect(read.status).toBe(200);
    expect(w.calls).toEqual(['route']);
    const tab = await read.json<{ tab: { elements: { label?: string }[] } }>();
    expect(tab.tab.elements.map((e) => e.label)).toEqual(['Edited', 'c']);
  });

  it('pushes what D1 indexes (the listing summary, the Inbox) from its outbox', async () => {
    const w = world();
    await createPlan(w, 'A', [{ id: 't1', name: 'Board', elements: [] }]);
    const action = {
      ...box('act'),
      action: {
        id: 'act-1',
        name: 'Do it',
        description: '',
        assignee: { userId: 'owner', name: 'Owner' },
        teamId: null,
        assignerId: 'owner',
        assignerName: 'Owner',
        status: 'open',
        createdAt: 1,
        updatedAt: 1,
      },
    } as unknown as Element;
    await w.send('PUT', '/api/projects/A/tabs/t1', { id: 't1', name: 'Board', elements: [action] });
    const plan = w.plans.get('A')!;
    expect(count(plan.db, 'outbox')).toBeGreaterThan(0);
    expect(count(w.d1.sql, 'collab_actions')).toBe(0);

    await plan.room.drain();

    expect(count(plan.db, 'outbox')).toBe(0);
    expect(w.d1.sql.prepare('SELECT project_id, tab_id, tab_name FROM collab_actions').all()).toEqual([
      { project_id: 'A', tab_id: 't1', tab_name: 'Board' },
    ]);
    const summary = w.d1.sql.prepare("SELECT content_summary FROM projects WHERE id = 'A'").get()!;
    expect(JSON.parse(String(summary.content_summary))).toMatchObject({ hasContent: true });
  });

  it('runs its daily upkeep from its alarm: old changesets go', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world();
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    plan.db
      .prepare(
        `INSERT INTO agent_changesets (id, plan_id, tab_id, rev, base_rev, author_id, author_name, author_color,
           fingerprints, added, changed, removed, created_at)
         VALUES ('cs_old', 'A', 't1', 1, 0, 'u', 'U', '#000', '{}', 0, 0, 0, 1)`,
      )
      .run();
    vi.setSystemTime(Date.now() + MAINTENANCE_EVERY_MS + 1);
    await plan.room.alarm();
    expect(count(plan.db, 'agent_changesets')).toBe(0);
  });
});

describe('/api/internal/items (docs/specs/015-api/api.md "Internal")', () => {
  const auth = { Authorization: 'Bearer index-key' };

  it('is a plain 404 without INDEX_KEY, and 401 for a wrong key', async () => {
    const off = world();
    expect((await off.send('DELETE', '/api/internal/items/A', undefined, auth)).status).toBe(404);
    const on = world({ INDEX_KEY: 'index-key' });
    const wrong = await on.send('DELETE', '/api/internal/items/A', undefined, {
      Authorization: 'Bearer nope',
    });
    expect(wrong.status).toBe(401);
    expect(on.calls).toEqual([]);
  });

  it('copies a plan, or one tab of it, into a new plan', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A', [
      { id: 't1', name: 'One', elements: [box('a')] },
      { id: 't2', name: 'Two', elements: [box('b')] },
    ]);
    const all = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(all.status).toBe(201);
    expect(count(w.plans.get('C')!.db, 'tabs')).toBe(2);

    const one = await w.send('POST', '/api/internal/items/A/copy-to/D', { tabId: 't2' }, auth);
    expect(one.status).toBe(201);
    expect(w.plans.get('D')!.db.prepare('SELECT name FROM tabs').all()).toEqual([{ name: 'Two' }]);

    const missing = await w.send('POST', '/api/internal/items/A/copy-to/E', { tabId: 'nope' }, auth);
    expect(missing.status).toBe(404);
    const again = await w.send('POST', '/api/internal/items/A/copy-to/C', {}, auth);
    expect(again.status).toBe(409);
  });

  it('purges a plan: every row, every session', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
    const plan = w.plans.get('A')!;
    const res = await w.send('DELETE', '/api/internal/items/A', undefined, auth);
    expect(res.status).toBe(200);
    expect(
      plan.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()!.n,
    ).toBe(0);
  });

  it('ends the sessions of revoked codes, refusing a body that is not codes', async () => {
    const w = world({ INDEX_KEY: 'index-key' });
    await createPlan(w, 'A');
    const ok = await w.send('POST', '/api/internal/items/A/revoke', { codes: ['abc'] }, auth);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true, closed: 0 });
    const bad = await w.send('POST', '/api/internal/items/A/revoke', { codes: 'abc' }, auth);
    expect(bad.status).toBe(400);
  });
});

// Performance (docs/specs/015-api/api.md "Storage"): a save is one call and one transaction whatever its size, a
// read one call however many tabs. CPU budgets, as the other speed tests (cpu-time.js).
describe('speed', () => {
  it('saves and reads a 1 MB tab within budget', async () => {
    const w = world();
    await createPlan(w, 'A');
    const elements = Array.from({ length: 2_500 }, (_, i) => box(`e${i}`, 'x'.repeat(320)));
    const body = { id: 't1', name: 'Board', elements };
    expect(JSON.stringify(body).length).toBeGreaterThan(1_000_000);
    let status = 0;
    const saveMs = await cpuMsOfAsync(async () => {
      status = (await w.send('PUT', '/api/projects/A/tabs/t1', body)).status;
    });
    expect(status).toBe(200);
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/projects/A/tabs/t1');
      status = res.status;
      await res.text();
    });
    expect(status).toBe(200);
    const drainMs = await cpuMsOfAsync(() => w.plans.get('A')!.room.drain());
    console.info('[perf] 1 MB tab', { saveMs, readMs, drainMs });
    expect(saveMs).toBeLessThan(cpuBudgetMs(200));
    expect(readMs).toBeLessThan(cpuBudgetMs(100));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });

  it('reads a 200-tab plan in one call within budget', async () => {
    const w = world();
    const tabs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 20 }, (_, j) => box(`e${i}-${j}`)),
    }));
    await createPlan(w, 'A', tabs);
    w.calls.length = 0;
    let status = 0;
    let listed = 0;
    const readMs = await cpuMsOfAsync(async () => {
      const res = await w.send('GET', '/api/projects/A');
      status = res.status;
      listed = (await res.json<{ project: { tabs: unknown[] } }>()).project.tabs.length;
    });
    expect(status).toBe(200);
    expect(listed).toBe(200);
    expect(w.calls).toEqual(['route']);
    // The push to D1 goes DRAIN_TABS tabs at a time, each batch bounded whatever the plan's size.
    const plan = w.plans.get('A')!;
    const d1 = w.env.DB as unknown as { batch: (s: unknown[]) => Promise<unknown> };
    const batch = d1.batch.bind(d1);
    const sizes: number[] = [];
    d1.batch = (statements) => {
      sizes.push(statements.length);
      return batch(statements);
    };
    const drainMs = await cpuMsOfAsync(async () => {
      while (count(plan.db, 'outbox') > 0) await plan.room.drain();
    });
    console.info('[perf] 200-tab plan', { readMs, drainMs, batches: sizes });
    expect(sizes).toHaveLength(Math.ceil(200 / DRAIN_TABS));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DRAIN_TABS * 4 + 2);
    expect(readMs).toBeLessThan(cpuBudgetMs(50));
    expect(drainMs).toBeLessThan(cpuBudgetMs(200));
  });
});
